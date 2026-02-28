/**
 * DataUploadAI
 *
 * Full-featured dataset upload & preview panel.
 *
 * Features:
 *  - react-dropzone drag-drop (CSV / TSV / XLSX / XLS)
 *  - Client-side parse: PapaParse (CSV/TSV), XLSX library (Excel)
 *  - Server-side fallback: POST /api/v1/data/parse (pandas, GxP logging)
 *  - Schema chips: column name, inferred type badge, null %
 *  - 10-row TanStack Table preview with sticky header
 *  - Issue detection: missing %, type inconsistency, constant cols, high cardinality
 *  - Stores result in useDatasetStore (consumed by AIBiostatisticsChat)
 *  - "Send to Chat" button fires onReady() so parent can focus the chat
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload,
  Loader2,
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Server,
  RefreshCw,
  Send,
  Table2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataPreviewTable } from './DataPreviewTable';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  useDatasetStore,
  type ColumnMeta,
  type DataIssue,
  type ParsedDataset,
  type ColDtype,
} from '@/stores/datasetStore';

// ── Constants ──────────────────────────────────────────────────────────────────

const PARSE_API = '/api/v1/data/parse';
const ACCEPTED = { 'text/csv': ['.csv'], 'text/tab-separated-values': ['.tsv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'] };
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// ── Local analysis helpers ────────────────────────────────────────────────────

function inferDtype(colName: string, values: unknown[]): ColDtype {
  const lower = colName.toLowerCase();
  if (/^(id|usubjid|subjid|patid|subject_id)$/.test(lower)) return 'id';
  if (/date|dt$|_dtc$/.test(lower)) return 'date';
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'categorical';
  const numericCount = nonNull.filter((v) => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')).length;
  if (numericCount === nonNull.length) return 'numeric';
  if (numericCount === 0) return 'categorical';
  return 'mixed';
}

function buildColumnMeta(rows: Record<string, unknown>[], columns: string[]): ColumnMeta[] {
  return columns.map((col) => {
    const values = rows.map((r) => r[col] ?? null);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
    const nullCount = values.length - nonNull.length;
    const uniqueVals = new Set(nonNull.map(String));
    return {
      name: col,
      dtype: inferDtype(col, nonNull),
      nullCount,
      nullPct: values.length ? (nullCount / values.length) * 100 : 0,
      uniqueCount: uniqueVals.size,
      sampleValues: (nonNull.slice(0, 5) as (string | number | null)[]),
    };
  });
}

function detectIssues(
  rows: Record<string, unknown>[],
  columns: string[],
  meta: ColumnMeta[]
): DataIssue[] {
  const issues: DataIssue[] = [];
  const total = rows.length;

  for (const m of meta) {
    // Missing values (any > 0)
    if (m.nullCount > 0) {
      issues.push({
        column: m.name,
        type: 'missing',
        description: `${m.nullPct.toFixed(1)}% missing (${m.nullCount} of ${total})`,
        affectedCount: m.nullCount,
        affectedPct: m.nullPct,
      });
    }

    // Mixed types
    if (m.dtype === 'mixed') {
      const values = rows.map((r) => r[m.name]);
      const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
      const numericCount = nonNull.filter((v) => !isNaN(Number(v)) && String(v).trim() !== '').length;
      issues.push({
        column: m.name,
        type: 'type_inconsistency',
        description: `Mixed types: ${numericCount} numeric, ${nonNull.length - numericCount} text values`,
        affectedCount: nonNull.length - numericCount,
        affectedPct: ((nonNull.length - numericCount) / total) * 100,
      });
    }

    // Constant column
    if (m.uniqueCount === 1 && m.nullCount < total) {
      const sample = m.sampleValues[0];
      issues.push({
        column: m.name,
        type: 'constant',
        description: `All non-null values are "${sample}" — possible data-entry error`,
        affectedCount: total,
        affectedPct: 100,
      });
    }

    // High cardinality on categorical (potential free-text leakage)
    if (m.dtype === 'categorical' && m.uniqueCount > 50 && m.uniqueCount > total * 0.5) {
      issues.push({
        column: m.name,
        type: 'high_cardinality',
        description: `${m.uniqueCount} unique text values — may be free-text or ID column`,
        affectedCount: m.uniqueCount,
        affectedPct: (m.uniqueCount / total) * 100,
      });
    }
  }

  return issues;
}

// ── Client-side parsers ───────────────────────────────────────────────────────

function parseCSV(file: File): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        if (result.errors.length && result.data.length === 0) {
          const e = result.errors[0];
          reject(new Error(`CSV parsing failed — ${e.message} (row ${e.row ?? '?'}). Check delimiters/quotes. Try saving as CSV UTF-8 in Excel.`));
          return;
        }
        const columns = (result.meta.fields ?? []).filter(Boolean);
        resolve({ rows: result.data as Record<string, unknown>[], columns });
      },
      error: (err) => {
        reject(new Error(`CSV parsing failed — ${err.message}. Try opening in Excel and re-saving as CSV UTF-8.`));
      },
    });
  });
}

function parseExcel(file: File): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
        // Get headers from first row via sheet_to_json header:1
        const header = (XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][])[0] as string[];
        resolve({ rows: raw, columns: header.map(String) });
      } catch (err) {
        reject(new Error(`Excel parsing failed — ${err instanceof Error ? err.message : String(err)}. Try re-saving the file.`));
      }
    };
    reader.onerror = () => reject(new Error('File read error. Check the file is not corrupted.'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Server-side parse ─────────────────────────────────────────────────────────

async function serverParse(
  file: File
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('user_id', 'local_user');

  const res = await fetch(PARSE_API, { method: 'POST', body: fd });
  const json = await res.json();

  if (!json.success) {
    throw new Error(
      `${json.error ?? 'Server parse failed'}${json.suggestion ? ` — ${json.suggestion}` : ''}`
    );
  }

  return { rows: json.preview ?? [], columns: json.columns ?? [] };
}

// ── Type badge ────────────────────────────────────────────────────────────────

const DTYPE_COLOR: Record<ColDtype, string> = {
  numeric:     'bg-blue-100 text-blue-700',
  date:        'bg-purple-100 text-purple-700',
  categorical: 'bg-emerald-100 text-emerald-700',
  id:          'bg-gray-100 text-gray-600',
  mixed:       'bg-orange-100 text-orange-700',
};

function TypeBadge({ dtype }: { dtype: ColDtype }) {
  return (
    <span className={cn('text-[9px] px-1 py-0.5 rounded font-mono uppercase', DTYPE_COLOR[dtype])}>
      {dtype}
    </span>
  );
}

// ── Issue icon ────────────────────────────────────────────────────────────────

const ISSUE_ICON: Record<DataIssue['type'], React.ReactNode> = {
  missing:           <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />,
  type_inconsistency:<AlertCircle   className="w-3 h-3 text-orange-500 flex-shrink-0" />,
  constant:          <Info          className="w-3 h-3 text-blue-400  flex-shrink-0" />,
  high_cardinality:  <Info          className="w-3 h-3 text-blue-400  flex-shrink-0" />,
  outlier_suspected: <AlertCircle   className="w-3 h-3 text-red-400   flex-shrink-0" />,
};

// ── Main component ────────────────────────────────────────────────────────────

interface DataUploadAIProps {
  /** Called after dataset is stored — lets parent focus the chat input */
  onReady?: () => void;
}

export default function DataUploadAI({ onReady }: DataUploadAIProps) {
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [parseMsg, setParseMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullDataOpen, setFullDataOpen] = useState(false);

  const { dataset, setDataset, clearDataset } = useDatasetStore();

  // ── Core parse flow ───────────────────────────────────────────────────────

  const runParse = useCallback(
    async (file: File, forceServer = false) => {
      setPhase('parsing');
      setParseMsg(forceServer ? 'Server parsing…' : 'Parsing…');
      setLastFile(file);

      try {
        let rows: Record<string, unknown>[];
        let columns: string[];
        let source: ParsedDataset['source'] = 'client';

        if (forceServer) {
          ({ rows, columns } = await serverParse(file));
          source = 'server';
        } else {
          const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
          if (ext === 'csv' || ext === 'tsv') {
            ({ rows, columns } = await parseCSV(file));
          } else if (ext === 'xlsx' || ext === 'xls') {
            ({ rows, columns } = await parseExcel(file));
          } else {
            throw new Error(`Unsupported file type .${ext}. Use CSV, TSV, XLSX, or XLS.`);
          }
        }

        if (!rows.length) throw new Error('File parsed successfully but contains no data rows.');

        const columnMeta = buildColumnMeta(rows, columns);
        const issues = detectIssues(rows, columns, columnMeta);

        const parsed: ParsedDataset = {
          fileName: file.name,
          uploadedAt: new Date(),
          rows,
          columns,
          columnMeta,
          issues,
          rowCount: rows.length,
          source,
        };

        setDataset(parsed);
        setPhase('done');
        toast.success(
          `Loaded ${file.name} — ${rows.length.toLocaleString()} rows, ${columns.length} columns` +
          (issues.length ? ` · ${issues.length} issue${issues.length > 1 ? 's' : ''} detected` : '')
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setPhase('error');
        toast.error(msg.slice(0, 120));
      }
    },
    [setDataset]
  );

  // ── Dropzone ──────────────────────────────────────────────────────────────

  const onDrop = useCallback(
    (accepted: File[], rejected: ReturnType<typeof useDropzone>['fileRejections']) => {
      if (rejected.length > 0) {
        const reason = rejected[0].errors[0].message;
        toast.error(`File rejected: ${reason}`);
        return;
      }
      if (accepted[0]) runParse(accepted[0]);
    },
    [runParse]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_BYTES,
    multiple: false,
    disabled: phase === 'parsing',
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleClear = () => {
    clearDataset();
    setPhase('idle');
    setErrorMsg('');
    setLastFile(null);
  };

  // ── Render: idle ──────────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div className="space-y-2 p-1">
        <div
          {...getRootProps()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none',
            isDragActive
              ? 'border-blue-400 bg-blue-50 scale-[1.01]'
              : 'border-blue-200 bg-blue-50/30 hover:border-blue-300 hover:bg-blue-50'
          )}
        >
          <input {...getInputProps()} />
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-center px-4">
            <p className="text-xs font-semibold text-gray-700">
              {isDragActive ? 'Drop to parse' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">CSV · TSV · XLSX · XLS — max 50 MB</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['PapaParse client', 'XLSX client', 'Pandas server fallback', 'Issue detection'].map((b) => (
            <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100">
              {b}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: parsing ───────────────────────────────────────────────────────

  if (phase === 'parsing') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p>{parseMsg}</p>
      </div>
    );
  }

  // ── Render: error ─────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div className="space-y-2 p-1">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700">Parse failed</p>
              <p className="text-[11px] text-red-600 mt-0.5 leading-snug">{errorMsg}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => lastFile && runParse(lastFile, false)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md border border-border hover:bg-muted/50 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry client parse
          </button>
          <button
            onClick={() => lastFile && runParse(lastFile, true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Server className="w-3 h-3" /> Try server parse (pandas)
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md border border-border text-gray-500 hover:bg-muted/50 transition-colors ml-auto"
          >
            <X className="w-3 h-3" /> Dismiss
          </button>
        </div>
      </div>
    );
  }

  // ── Render: done ──────────────────────────────────────────────────────────

  if (!dataset) return null;

  const issuesBySeverity = [
    ...dataset.issues.filter((i) => i.type === 'type_inconsistency'),
    ...dataset.issues.filter((i) => i.type === 'missing' && i.affectedPct > 30),
    ...dataset.issues.filter((i) => i.type === 'missing' && i.affectedPct <= 30),
    ...dataset.issues.filter((i) => i.type === 'constant'),
    ...dataset.issues.filter((i) => i.type === 'high_cardinality'),
  ];

  return (
    <div className="space-y-2.5 text-xs">

      {/* ── Summary bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-800 truncate max-w-[200px]" title={dataset.fileName}>
            {dataset.fileName}
          </p>
          <p className="text-[10px] text-gray-400">
            {dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} cols
            {dataset.issues.length > 0 && (
              <span className="ml-1 text-amber-600 font-medium">
                · {dataset.issues.length} issue{dataset.issues.length !== 1 ? 's' : ''}
              </span>
            )}
            {dataset.issues.length === 0 && (
              <span className="ml-1 text-emerald-600">· no issues</span>
            )}
            <span className="ml-1 text-gray-300">via {dataset.source}</span>
          </p>
        </div>
        <button
          onClick={handleClear}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0"
          aria-label="Remove dataset"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Column schema chips ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {dataset.columnMeta.slice(0, 12).map((m) => (
          <div
            key={m.name}
            title={`${m.name}: ${m.nullPct.toFixed(1)}% null, ${m.uniqueCount} unique`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50 border border-border"
          >
            <span className="font-mono text-[10px] text-foreground truncate max-w-[80px]">{m.name}</span>
            <TypeBadge dtype={m.dtype} />
            {m.nullPct > 0 && (
              <span className={cn('text-[9px]', m.nullPct > 30 ? 'text-red-500 font-semibold' : 'text-gray-400')}>
                {m.nullPct.toFixed(0)}%∅
              </span>
            )}
          </div>
        ))}
        {dataset.columns.length > 12 && (
          <span className="text-[10px] text-muted-foreground self-center">
            +{dataset.columns.length - 12} more
          </span>
        )}
      </div>

      {/* ── Preview table (head 20 + tail 5) ─────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Preview (head 20 + tail 5{dataset.columns.length > 12 ? ', first 12 cols' : ''})
          </p>
          <button
            onClick={() => setFullDataOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border border-border hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            <Table2 className="w-3 h-3" />
            View Full Data
          </button>
        </div>
        <ErrorBoundary label="Data Preview">
          <DataPreviewTable
            rows={dataset.rows}
            columns={dataset.columns}
          />
        </ErrorBoundary>
      </div>

      {/* ── View Full Data modal ──────────────────────────────────────── */}
      <Dialog open={fullDataOpen} onOpenChange={setFullDataOpen}>
        <DialogContent className="max-w-5xl w-full">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {dataset.fileName} — {dataset.rowCount.toLocaleString()} rows × {dataset.columns.length} columns
            </DialogTitle>
          </DialogHeader>
          <ErrorBoundary label="Full Data View">
            <DataPreviewTable
              rows={dataset.rows}
              columns={dataset.columns}
              virtualize
              height={500}
            />
          </ErrorBoundary>
        </DialogContent>
      </Dialog>

      {/* ── Issues ───────────────────────────────────────────────────── */}
      {issuesBySeverity.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Detected issues ({issuesBySeverity.length})
          </p>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {issuesBySeverity.map((issue, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/60"
              >
                {ISSUE_ICON[issue.type]}
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[10px] font-semibold text-foreground">{issue.column}</span>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-[10px] text-gray-600">{issue.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {issuesBySeverity.length === 0 && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-emerald-50 border border-emerald-100">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <p className="text-[11px] text-emerald-700">No data quality issues detected</p>
        </div>
      )}

      {/* ── Issues confirm dialog ─────────────────────────────────────── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Dataset has quality issues
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dataset?.issues.length ?? 0} issue
              {(dataset?.issues.length ?? 0) !== 1 ? 's were' : ' was'} detected
              (missing values, mixed types, or constant columns).
              The AI will receive a compact summary — not raw rows — so these issues
              won&apos;t cause a crash, but results may be less accurate.
              Consider running <strong>AI Clean</strong> first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                try {
                  onReady?.();
                  toast.success('Dataset context sent to chat');
                } catch (err) {
                  toast.error('Failed to prepare dataset for chat — try re-uploading');
                  console.error('[DataUploadAI] onReady error:', err);
                }
              }}
            >
              Send anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 pt-0.5 border-t border-border/50">
        <button
          onClick={() => {
            if (!dataset) return;
            try {
              if (dataset.issues.length > 0) {
                setConfirmOpen(true);
              } else {
                onReady?.();
                toast.success('Dataset ready in chat — ask your question below');
              }
            } catch (err) {
              toast.error('Failed to prepare dataset for chat — try re-uploading');
              console.error('[DataUploadAI] Send to Chat error:', err);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Send className="w-3 h-3" />
          Send to Chat
          {(dataset?.issues.length ?? 0) > 0 && (
            <span className="ml-1 text-[9px] bg-amber-400 text-amber-900 rounded-full px-1 font-bold">
              {dataset!.issues.length}
            </span>
          )}
        </button>
        <button
          onClick={() => lastFile && runParse(lastFile, true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] border border-border hover:bg-muted/50 transition-colors text-gray-600"
          title="Re-parse via pandas server for stricter validation and GxP logging"
        >
          <Server className="w-3 h-3" />
          Server parse
        </button>

        {/* Re-drop zone — small */}
        <div
          {...getRootProps()}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] border border-dashed border-blue-200 text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
          title="Replace with a different file"
        >
          <input {...getInputProps()} />
          <RefreshCw className="w-3 h-3" />
          Replace
        </div>
      </div>
    </div>
  );
}
