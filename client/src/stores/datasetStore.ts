/**
 * datasetStore — Zustand store for the active parsed dataset.
 *
 * KEY DESIGN RULE:
 *   The full `rows` array is stored locally but is NEVER sent to the LLM.
 *   All LLM/API calls use `DataContext` — a compact summary capped at ~15 KB.
 *
 * Consumers:
 *   - DataUploadAI    → calls setDataset() after parse
 *   - AIBiostatisticsChat → calls getDataContext() for prompt injection
 */

import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ColDtype = 'numeric' | 'date' | 'categorical' | 'id' | 'mixed';

export interface ColumnMeta {
  name: string;
  dtype: ColDtype;
  nullCount: number;
  nullPct: number;       // 0-100
  uniqueCount: number;
  sampleValues: (string | number | null)[];
}

export type IssueType =
  | 'missing'
  | 'type_inconsistency'
  | 'constant'
  | 'high_cardinality'
  | 'outlier_suspected';

export interface DataIssue {
  column: string;
  type: IssueType;
  description: string;
  affectedCount: number;
  affectedPct: number;  // 0-100
}

export interface ParsedDataset {
  fileName: string;
  uploadedAt: Date;
  /** Full row data — stored locally, NEVER serialised to API payloads */
  rows: Record<string, unknown>[];
  columns: string[];
  columnMeta: ColumnMeta[];
  issues: DataIssue[];
  rowCount: number;
  source: 'client' | 'server';
}

// ── DataContext ───────────────────────────────────────────────────────────────
// The ONLY thing that leaves the browser toward the LLM/API.
// Maximum payload size: ~10-15 KB even for wide datasets.

export interface SummaryStatEntry {
  type: ColDtype;
  /** 0-100 */
  missingPct: number;
  uniqueValues: number;
  /** Up to 5 representative values as strings */
  sampleValues: string[];
}

export interface DataContext {
  fileName: string;
  rowCount: number;
  columns: string[];
  /** First 15 rows — enough for the LLM to understand structure */
  previewHead: Record<string, unknown>[];
  /** Last 5 rows — helps spot trailing anomalies */
  previewTail: Record<string, unknown>[];
  issues: Array<{
    column: string;
    type: IssueType;
    description: string;
    affectedPct: string;
  }>;
  summaryStats: Record<string, SummaryStatEntry>;
}

/** Pure function — safe to call outside React. Returns null on stringify failure. */
export function computeDataContext(dataset: ParsedDataset): DataContext {
  // Sanitise rows: replace NaN / Infinity / undefined → null so JSON.stringify never throws
  const sanitise = (rows: Record<string, unknown>[]): Record<string, unknown>[] =>
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          v === undefined || (typeof v === 'number' && !isFinite(v)) ? null : v,
        ])
      )
    );

  return {
    fileName: dataset.fileName,
    rowCount: dataset.rowCount,
    columns: dataset.columns,
    previewHead: sanitise(dataset.rows.slice(0, 15)),
    previewTail: sanitise(dataset.rows.slice(-5)),
    issues: dataset.issues.map((i) => ({
      column: i.column,
      type: i.type,
      description: i.description,
      affectedPct: `${i.affectedPct.toFixed(1)}%`,
    })),
    summaryStats: Object.fromEntries(
      dataset.columnMeta.map((m) => [
        m.name,
        {
          type: m.dtype,
          missingPct: parseFloat(m.nullPct.toFixed(2)),
          uniqueValues: m.uniqueCount,
          sampleValues: m.sampleValues.slice(0, 5).map(String),
        } satisfies SummaryStatEntry,
      ])
    ),
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface DatasetStore {
  dataset: ParsedDataset | null;
  setDataset: (d: ParsedDataset) => void;
  clearDataset: () => void;
  /**
   * Returns a typed DataContext (compact, LLM-safe summary) or null if no
   * dataset is loaded. Replaces the old getPromptSummary() raw-rows approach.
   */
  getDataContext: () => DataContext | null;
  /**
   * Returns a JSON string of DataContext for injecting into LLM prompts.
   * Returns null when no dataset is loaded or stringify fails.
   */
  getPromptSummary: () => string | null;
}

export const useDatasetStore = create<DatasetStore>((set, get) => ({
  dataset: null,

  setDataset: (d) => set({ dataset: d }),

  clearDataset: () => set({ dataset: null }),

  getDataContext: () => {
    const d = get().dataset;
    if (!d) return null;
    return computeDataContext(d);
  },

  getPromptSummary: () => {
    const ctx = get().getDataContext();
    if (!ctx) return null;
    try {
      return JSON.stringify(ctx, null, 2);
    } catch (err) {
      console.error('[datasetStore] getPromptSummary stringify failed:', err);
      return null;
    }
  },
}));
