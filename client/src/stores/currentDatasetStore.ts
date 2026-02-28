/**
 * currentDatasetStore — single source of truth for the active dataset.
 *
 * The chat's paperclip is the only upload entry point. When a file is
 * uploaded, this store is populated so every component (UnifiedDatasetManager,
 * AI chat prompt, etc.) sees the same data without prop drilling.
 *
 * KEY DESIGN RULE (same as datasetStore):
 *   Full `rows` are stored locally and used for clean/transform API calls.
 *   LLM prompts receive only a compact summary (filename + rowCount + columns).
 */

import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DatasetVersion {
  id: string;
  filename: string;
  rowCount: number;
  columns: string[];
  /** Full row data — stored locally, not sent to LLM */
  rows: Record<string, unknown>[];
  cleaned: boolean;
  /** smart_cleaning session_id — set after "Clean Now" succeeds */
  cleanedSessionId?: string;
  createdAt: Date;
}

export interface CleanedSource {
  id: string;
  filename: string;
  originalFilename: string;
  rowCount: number;
  cleanedAt: Date;
}

interface CurrentDatasetStore {
  currentDataset: DatasetVersion | null;
  /** Up to 10 previous versions (newest first) */
  versions: DatasetVersion[];
  /** Cleaned datasets produced in this session, shown in SourcesPanel */
  cleanedSources: CleanedSource[];

  /** Set (or replace) the active dataset. Automatically pushed into version history. */
  setCurrentDataset: (d: Omit<DatasetVersion, 'id' | 'createdAt'>) => void;
  /** Mark the active dataset as cleaned (called after /api/v1/clean/apply succeeds). */
  markCleaned: (sessionId: string) => void;
  /** Switch the active dataset to a previous version by id. */
  switchToVersion: (id: string) => void;
  /** Remove the active dataset (e.g. user clicks X on the pill). */
  clearCurrentDataset: () => void;
  /** Record a cleaned dataset in the sources list. */
  addCleanedSource: (s: Omit<CleanedSource, 'id' | 'cleanedAt'>) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCurrentDatasetStore = create<CurrentDatasetStore>((set, get) => ({
  currentDataset: null,
  versions: [],
  cleanedSources: [],

  setCurrentDataset: (d) => {
    const version: DatasetVersion = {
      ...d,
      id: `ds-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date(),
    };
    set((s) => ({
      currentDataset: version,
      // Prepend + cap at 10 versions
      versions: [version, ...s.versions].slice(0, 10),
    }));
  },

  markCleaned: (sessionId) => {
    set((s) => {
      if (!s.currentDataset) return s;
      const updated: DatasetVersion = {
        ...s.currentDataset,
        cleaned: true,
        cleanedSessionId: sessionId,
      };
      const cleanedSource: CleanedSource = {
        id: `cs-${Date.now()}`,
        filename: updated.filename.replace(/(\.[^.]+)$/, '_cleaned$1'),
        originalFilename: updated.filename,
        rowCount: updated.rowCount,
        cleanedAt: new Date(),
      };
      return {
        currentDataset: updated,
        versions: s.versions.map((v) => (v.id === updated.id ? updated : v)),
        cleanedSources: [cleanedSource, ...s.cleanedSources],
      };
    });
  },

  switchToVersion: (id) => {
    const v = get().versions.find((ver) => ver.id === id);
    if (v) set({ currentDataset: v });
  },

  clearCurrentDataset: () => set({ currentDataset: null }),

  addCleanedSource: (s) => {
    const source: CleanedSource = {
      ...s,
      id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      cleanedAt: new Date(),
    };
    set((state) => ({ cleanedSources: [source, ...state.cleanedSources] }));
  },
}));
