/**
 * useDataUpload — shared file upload + dirty-data detection hook.
 *
 * Used by the left-panel UploadBar to parse a local file, store it in
 * currentDatasetStore, and return a dirtyCount so callers can suggest cleaning.
 *
 * Now delegates to useFileHandler for consistent binary-safe parsing.
 */

import { useCallback } from 'react';
import { useCurrentDatasetStore } from '@/stores/currentDatasetStore';
import { useFileHandler } from './useFileHandler';

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
  const { handleFile } = useFileHandler();

  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    const result = await handleFile(file);
    if (!result.success || !result.rows.length) return null;

    const columns = result.columns;
    const rows = result.rows as Array<Record<string, unknown>>;
    const dirtyCount = countDirtyCells(rows);

    useCurrentDatasetStore.getState().setCurrentDataset({
      filename: file.name,
      rowCount: rows.length,
      columns,
      rows,
      cleaned: false,
    });

    return { filename: file.name, rowCount: rows.length, columns, dirtyCount };
  }, [handleFile]);

  return { upload };
}
