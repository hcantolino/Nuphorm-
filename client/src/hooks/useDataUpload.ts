/**
 * useDataUpload — shared CSV upload + dirty-data detection hook.
 *
 * Used by the left-panel UploadBar to parse a local file, store it in
 * currentDatasetStore, and return a dirtyCount so callers can suggest cleaning.
 */

import { useCallback } from 'react';
import { useCurrentDatasetStore } from '@/stores/currentDatasetStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCSV(text: string): Array<Record<string, unknown>> {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const v = values[i] ?? '';
      row[h] = v === '' ? '' : isNaN(Number(v)) ? v : Number(v);
    });
    return row;
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/** Count cells that are empty string or whitespace-only — proxy for missing values */
function countDirtyCells(rows: Array<Record<string, unknown>>): number {
  let count = 0;
  for (const row of rows) {
    for (const val of Object.values(row)) {
      if (val === '' || val === null || val === undefined) count++;
    }
  }
  return count;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
  filename: string;
  rowCount: number;
  columns: string[];
  dirtyCount: number;
}

export function useDataUpload() {
  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'txt', 'tsv'].includes(ext)) return null;

    const text = await readFileAsText(file);
    const rows = parseCSV(text);
    if (!rows.length) return null;

    const columns = Object.keys(rows[0]);
    const dirtyCount = countDirtyCells(rows);

    useCurrentDatasetStore.getState().setCurrentDataset({
      filename: file.name,
      rowCount: rows.length,
      columns,
      rows,
      cleaned: false,
    });

    return { filename: file.name, rowCount: rows.length, columns, dirtyCount };
  }, []);

  return { upload };
}
