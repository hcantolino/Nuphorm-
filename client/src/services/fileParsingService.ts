import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedFileData {
  fileName: string;
  data: Record<string, any>[];
  columns: string[];
  rowCount: number;
  format: 'CSV' | 'XLSX' | 'JSON';
}

/**
 * Parse CSV file content
 */
function parseCSV(content: string, fileName: string): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results: any) => {
        if (results.errors && results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }

        const data = results.data as Record<string, any>[];
        const columns = results.meta.fields || Object.keys(data[0] || {});

        resolve({
          fileName,
          data,
          columns,
          rowCount: data.length,
          format: 'CSV',
        });
      },
      error: (error: any) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  }) as Promise<ParsedFileData>;
}

/**
 * Parse XLSX file content
 */
function parseXLSX(arrayBuffer: ArrayBuffer, fileName: string): ParsedFileData {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      throw new Error('No sheets found in XLSX file');
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
    const columns = Object.keys(data[0] || {});

    return {
      fileName,
      data,
      columns,
      rowCount: data.length,
      format: 'XLSX',
    };
  } catch (error) {
    throw new Error(`XLSX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse JSON file content
 */
function parseJSON(content: string, fileName: string): ParsedFileData {
  try {
    const parsed = JSON.parse(content);
    
    // Handle both array of objects and single object
    const data = Array.isArray(parsed) ? parsed : [parsed];
    const columns = Object.keys(data[0] || {});

    return {
      fileName,
      data,
      columns,
      rowCount: data.length,
      format: 'JSON',
    };
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main file parsing function
 * Detects file format and parses accordingly
 */
export async function parseFile(file: File): Promise<ParsedFileData> {
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase();

  try {
    if (extension === 'csv') {
      const content = await file.text();
      return parseCSV(content, fileName);
    } else if (extension === 'xlsx' || extension === 'xls') {
      const arrayBuffer = await file.arrayBuffer();
      return parseXLSX(arrayBuffer, fileName);
    } else if (extension === 'json') {
      const content = await file.text();
      return parseJSON(content, fileName);
    } else {
      throw new Error(`Unsupported file format: .${extension}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to parse ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
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
