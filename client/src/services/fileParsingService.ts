import { routeFileUpload } from '@/utils/fileUploadRouter';
import * as XLSX from 'xlsx';

export interface ParsedFileData {
  fileName: string;
  data: Record<string, any>[];
  columns: string[];
  rowCount: number;
  format: 'CSV' | 'XLSX' | 'JSON';
}

const FORMAT_MAP: Record<string, 'CSV' | 'XLSX' | 'JSON'> = {
  csv: 'CSV', tsv: 'CSV', txt: 'CSV', json: 'JSON', xlsx: 'XLSX', xls: 'XLSX',
};

/**
 * Client-side XLSX fallback for contexts without tRPC (e.g. Biostatistics.tsx).
 * Converts to base64 → XLSX.read locally.
 */
async function clientXlsxParser(base64: string, _fileName: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const wb = XLSX.read(bytes, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('No sheets found in XLSX file');
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[];
  const columns = Object.keys(rows[0] || {});
  return { rows, columns, rowCount: rows.length };
}

/**
 * Main file parsing function — delegates to centralized routeFileUpload
 */
export async function parseFile(file: File): Promise<ParsedFileData> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const result = await routeFileUpload(file, {
    parseXlsx: clientXlsxParser,
  });

  if (!result.success) {
    throw new Error(`Failed to parse ${file.name}: ${result.error || 'Unknown error'}`);
  }

  return {
    fileName: file.name,
    data: result.rows,
    columns: result.columns,
    rowCount: result.rowCount,
    format: FORMAT_MAP[ext] ?? 'CSV',
  };
}

/**
 * Parse multiple files
 */
export async function parseMultipleFiles(files: File[]): Promise<ParsedFileData[]> {
  try {
    const results = await Promise.all(files.map((file) => parseFile(file)));
    return results;
  } catch (error) {
    throw new Error(
      `Failed to parse files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Merge multiple parsed datasets
 */
export function mergeDatasets(datasets: ParsedFileData[]): ParsedFileData {
  if (datasets.length === 0) {
    throw new Error('No datasets to merge');
  }

  if (datasets.length === 1) {
    return datasets[0];
  }

  // Get all unique columns from all datasets
  const allColumns = new Set<string>();
  datasets.forEach((dataset) => {
    dataset.columns.forEach((col) => allColumns.add(col));
  });

  const columns = Array.from(allColumns);
  const mergedData: Record<string, any>[] = [];

  // Merge rows from all datasets
  datasets.forEach((dataset) => {
    dataset.data.forEach((row) => {
      const mergedRow: Record<string, any> = {};
      columns.forEach((col) => {
        mergedRow[col] = row[col] !== undefined ? row[col] : null;
      });
      mergedData.push(mergedRow);
    });
  });

  return {
    fileName: `Merged (${datasets.map((d) => d.fileName).join(', ')})`,
    data: mergedData,
    columns,
    rowCount: mergedData.length,
    format: 'CSV', // Default to CSV for merged data
  };
}

/**
 * Get numeric columns from parsed data
 */
export function getNumericColumns(data: Record<string, any>[]): string[] {
  if (data.length === 0) return [];

  const numericCols = new Set<string>();
  const firstRow = data[0];

  Object.keys(firstRow).forEach((col) => {
    // Check if column values are numeric
    const isNumeric = data.slice(0, Math.min(100, data.length)).every((row) => {
      const val = row[col];
      return val === null || val === undefined || typeof val === 'number' || !isNaN(Number(val));
    });

    if (isNumeric) {
      numericCols.add(col);
    }
  });

  return Array.from(numericCols);
}

/**
 * Get date columns from parsed data
 */
export function getDateColumns(data: Record<string, any>[]): string[] {
  if (data.length === 0) return [];

  const dateCols = new Set<string>();
  const firstRow = data[0];

  Object.keys(firstRow).forEach((col) => {
    // Check if column values are dates
    const isDate = data.slice(0, Math.min(100, data.length)).every((row) => {
      const val = row[col];
      if (val === null || val === undefined) return true;
      if (val instanceof Date) return true;
      if (typeof val === 'string') {
        return !isNaN(Date.parse(val));
      }
      return false;
    });

    if (isDate) {
      dateCols.add(col);
    }
  });

  return Array.from(dateCols);
}
