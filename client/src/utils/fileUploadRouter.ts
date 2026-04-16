import * as Papa from 'papaparse';

export type ParsedFile = {
  success: boolean;
  rows: Record<string, any>[];
  columns: string[];
  rowCount: number;
  csvText?: string;
  error?: string;
  warnings?: string[];
  sourceType: 'csv' | 'tsv' | 'xlsx' | 'xls' | 'json' | 'pdf' | 'docx' | 'txt' | 'unknown';
};

const MAX_FILE_SIZE_MB = 50;
const SUPPORTED_EXTENSIONS = ['csv', 'tsv', 'xlsx', 'xls', 'json', 'pdf', 'docx', 'txt'];

const MAGIC_BYTES = {
  xlsx: [0x50, 0x4B, 0x03, 0x04],
  pdf: [0x25, 0x50, 0x44, 0x46],
};

async function readMagicBytes(file: File, count = 8): Promise<Uint8Array> {
  const buffer = await file.slice(0, count).arrayBuffer();
  return new Uint8Array(buffer);
}

function matchesMagic(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

export async function routeFileUpload(
  file: File,
  serverParsers: {
    parseXlsx: (base64: string, fileName: string) => Promise<any>;
    parsePdf?: (base64: string, fileName: string) => Promise<any>;
  }
): Promise<ParsedFile> {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    return {
      success: false, rows: [], columns: [], rowCount: 0,
      sourceType: 'unknown',
      error: `File is ${sizeMB.toFixed(1)}MB. Maximum allowed is ${MAX_FILE_SIZE_MB}MB.`,
    };
  }

  const ext = file.name.toLowerCase().split('.').pop() || '';
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      success: false, rows: [], columns: [], rowCount: 0,
      sourceType: 'unknown',
      error: `Unsupported file type: .${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    };
  }

  const magic = await readMagicBytes(file);

  if ((ext === 'xlsx' || ext === 'xls') && !matchesMagic(magic, MAGIC_BYTES.xlsx)) {
    return {
      success: false, rows: [], columns: [], rowCount: 0,
      sourceType: 'xlsx',
      error: 'File extension says Excel but the file content is not a valid Excel file.',
    };
  }

  if (ext === 'pdf' && !matchesMagic(magic, MAGIC_BYTES.pdf)) {
    return {
      success: false, rows: [], columns: [], rowCount: 0,
      sourceType: 'pdf',
      error: 'File extension says PDF but the file content is not a valid PDF.',
    };
  }

  if (ext === 'docx' && !matchesMagic(magic, MAGIC_BYTES.xlsx)) {
    return {
      success: false, rows: [], columns: [], rowCount: 0,
      sourceType: 'docx',
      error: 'File extension says Word doc but the file content is not a valid .docx.',
    };
  }

  try {
    switch (ext) {
      case 'csv':
        return await parseCSV(file);
      case 'tsv':
        return await parseTSV(file);
      case 'xlsx':
      case 'xls':
        return await parseXLSX(file, serverParsers.parseXlsx);
      case 'json':
        return await parseJSON(file);
      case 'txt':
        return await parseTXT(file);
      case 'pdf':
        if (!serverParsers.parsePdf) {
          return {
            success: false, rows: [], columns: [], rowCount: 0,
            sourceType: 'pdf',
            error: 'PDF parsing is not available in this environment.',
          };
        }
        return await parsePDF(file, serverParsers.parsePdf);
      default:
        return {
          success: false, rows: [], columns: [], rowCount: 0,
          sourceType: 'unknown',
          error: `No parser registered for .${ext}`,
        };
    }
  } catch (err: any) {
    console.error('[FileRouter] Parse failed:', err);
    return {
      success: false, rows: [], columns: [], rowCount: 0,
      sourceType: ext as any,
      error: err?.message || 'Unknown parsing error',
    };
  }
}

async function parseCSV(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const result = Papa.parse<Record<string, any>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  const rows = result.data.filter(r => Object.values(r).some(v => v !== null && v !== ''));
  return {
    success: result.errors.length === 0 || rows.length > 0,
    rows,
    columns: result.meta.fields || [],
    rowCount: rows.length,
    sourceType: 'csv',
    csvText: text,
    warnings: result.errors.length > 0 ? result.errors.map(e => e.message) : undefined,
  };
}

async function parseTSV(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const result = Papa.parse<Record<string, any>>(text, {
    header: true,
    delimiter: '\t',
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  const rows = result.data.filter(r => Object.values(r).some(v => v !== null && v !== ''));
  return {
    success: rows.length > 0,
    rows,
    columns: result.meta.fields || [],
    rowCount: rows.length,
    sourceType: 'tsv',
    csvText: text,
  };
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function parseXLSX(
  file: File,
  serverParser: (base64: string, fileName: string) => Promise<any>,
): Promise<ParsedFile> {
  const base64 = await fileToBase64(file);
  const result = await serverParser(base64, file.name);

  if (!result || !Array.isArray(result.rows) || !Array.isArray(result.columns)) {
    return {
      success: false, rows: [], columns: [], rowCount: 0,
      sourceType: 'xlsx',
      error: 'Server returned invalid response shape for xlsx parse.',
    };
  }

  return {
    success: true,
    rows: result.rows,
    columns: result.columns,
    rowCount: result.rowCount ?? result.rows.length,
    csvText: result.csvText ?? '',
    sourceType: 'xlsx',
  };
}

async function parseJSON(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!Array.isArray(data)) {
    return {
      success: false, rows: [], columns: [], rowCount: 0,
      sourceType: 'json',
      error: 'JSON file must contain an array of objects at the top level.',
    };
  }

  const rows = data.filter((r: any) => r !== null && typeof r === 'object');
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    success: rows.length > 0,
    rows, columns, rowCount: rows.length,
    sourceType: 'json',
    csvText: text,
  };
}

async function parseTXT(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const firstLine = text.split('\n')[0] || '';
  const delimiter =
    firstLine.includes('\t') ? '\t' :
    firstLine.includes(',') ? ',' :
    firstLine.includes('|') ? '|' : ',';

  const result = Papa.parse<Record<string, any>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  const rows = result.data.filter(r => Object.values(r).some(v => v !== null && v !== ''));
  return {
    success: rows.length > 0,
    rows,
    columns: result.meta.fields || [],
    rowCount: rows.length,
    sourceType: 'txt',
    csvText: text,
    warnings: [`Auto-detected delimiter: ${delimiter === '\t' ? 'TAB' : delimiter}`],
  };
}

async function parsePDF(
  file: File,
  serverParser: (base64: string, fileName: string) => Promise<any>,
): Promise<ParsedFile> {
  const base64 = await fileToBase64(file);
  const result = await serverParser(base64, file.name);
  return {
    success: !!result?.text,
    rows: [],
    columns: [],
    rowCount: 0,
    sourceType: 'pdf',
    csvText: result?.text ?? '',
    warnings: result?.text ? undefined : ['PDF text extraction returned empty — may be a scanned/image-based PDF'],
  };
}
