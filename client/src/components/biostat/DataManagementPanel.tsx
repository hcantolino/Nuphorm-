/**
 * DataManagementPanel
 *
 * Collapsible panel for dataset preparation:
 *   - Upload  — CSV, XLSX, SAS, TSV
 *   - Clean   — missing values, outliers, normalisation
 *   - Transform — log, sqrt, z-score, min-max, group-by
 *
 * Sits above the analysis-category tabs inside BiostatisticsMeasurementsPanel.
 * * Calls the Python biostat-api (proxied via /api/v1 → BIOSTAT_API_URL) for server-side processing;
 * falls back to a local JS implementation when the API is unreachable.
 */

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Wand2,
  GitBranch,
  CheckCircle2,
  Loader2,
  X,
  FileSpreadsheet,
  FileText,
  File,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import SmartDataUpload from './SmartDataUpload';
import DataUploadAI from './DataUploadAI';

// ── Types ──────────────────────────────────────────────────────────────────

type DatasetRow = Record<string, string | number | null>;

interface Dataset {
  name: string;
  rows: DatasetRow[];
  columns: string[];
  uploadedAt: Date;
}

interface AuditEntry {
  id: string;
  action: string;
  timestamp: Date;
  details: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const BIOSTAT_API = '/api/v1';

// ── File icon helper ───────────────────────────────────────────────────────

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['csv', 'xlsx', 'xls', 'tsv'].includes(ext))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
  if (ext === 'pdf')
    return <FileText className="w-4 h-4 text-rose-500 flex-shrink-0" />;
  return <File className="w-4 h-4 text-blue-500 flex-shrink-0" />;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DataManagementPanel() {
  const [activeSection, setActiveSection] = useState<'upload' | 'ai-clean' | 'clean' | 'transform'>('upload');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetIdx, setActiveDatasetIdx] = useState<number | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean options
  const [cleanMissing, setCleanMissing] = useState<'drop' | 'mean' | 'median' | 'zero'>('mean');
  const [cleanOutliers, setCleanOutliers] = useState(false);
  const [normalizeData, setNormalizeData] = useState(false);

  // Transform options
  const [transformType, setTransformType] = useState<
    'log' | 'sqrt' | 'zscore' | 'minmax' | 'group_by'
  >('log');
  const [transformColumn, setTransformColumn] = useState('');

  const activeDataset = activeDatasetIdx !== null ? datasets[activeDatasetIdx] : null;

  const addAudit = useCallback((action: string, details: string) => {
    setAuditLog((prev) => [
      { id: Date.now().toString(), action, timestamp: new Date(), details },
      ...prev,
    ]);
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setIsProcessing(true);
    try {
      for (const file of files) {
        let rows: DatasetRow[] = [];
        let columns: string[] = [];

        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch(`${BIOSTAT_API}/data/upload`, {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            rows = data.rows;
            columns = data.columns;
          } else {
            throw new Error('API unavailable');
          }
        } catch {
          // Local CSV fallback
          const text = await file.text();
          const lines = text.split('\n').filter(Boolean);
          columns = lines[0].split(',').map((c) => c.trim().replace(/"/g, ''));
          rows = lines.slice(1).map((line) => {
            const values = line.split(',');
            return Object.fromEntries(
              columns.map((col, i) => [col, values[i]?.trim().replace(/"/g, '') ?? null])
            );
          });
        }

        const dataset: Dataset = { name: file.name, rows, columns, uploadedAt: new Date() };
        setDatasets((prev) => {
          const next = [...prev, dataset];
          setActiveDatasetIdx(next.length - 1);
          return next;
        });
        addAudit('UPLOAD', `"${file.name}" — ${rows.length} rows, ${columns.length} columns`);
        toast.success(`Loaded: ${file.name} (${rows.length} rows)`);
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // ── Clean ──────────────────────────────────────────────────────────────

  const handleClean = async () => {
    if (!activeDataset) return;
    setIsProcessing(true);
    try {
      let cleanedRows: DatasetRow[];
      let auditLines: string[] = [];

      try {
        const res = await fetch(`${BIOSTAT_API}/data/clean`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: activeDataset.rows,
            missing_strategy: cleanMissing,
            remove_outliers: cleanOutliers,
            normalize: normalizeData,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          cleanedRows = data.rows;
          auditLines = data.audit ?? [];
        } else {
          throw new Error('API unavailable');
        }
      } catch {
        // JS fallback: drop rows with any null / empty value
        cleanedRows = activeDataset.rows.filter((row) =>
          Object.values(row).every((v) => v !== null && v !== '')
        );
        auditLines = [`Dropped ${activeDataset.rows.length - cleanedRows.length} rows with missing values (local fallback)`];
      }

      setDatasets((prev) =>
        prev.map((d, i) => (i === activeDatasetIdx ? { ...d, rows: cleanedRows } : d))
      );
      const summary = `Missing:${cleanMissing} | Outliers:${cleanOutliers ? 'yes' : 'no'} | Normalize:${normalizeData ? 'yes' : 'no'}`;
      addAudit('CLEAN', summary + (auditLines.length ? ` — ${auditLines[0]}` : ''));
      toast.success(`Data cleaned — ${activeDataset.rows.length - cleanedRows.length} rows removed`);
    } catch {
      toast.error('Clean operation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Transform ──────────────────────────────────────────────────────────

  const handleTransform = async () => {
    if (!activeDataset || !transformColumn) {
      toast.error('Select a column to transform');
      return;
    }
    setIsProcessing(true);
    try {
      let transformedRows: DatasetRow[];
      let newColumns: string[] = activeDataset.columns;
      let auditMsg = '';

      try {
        const res = await fetch(`${BIOSTAT_API}/data/transform`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: activeDataset.rows,
            transform_type: transformType,
            column: transformColumn,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          transformedRows = data.rows;
          newColumns = data.columns;
          auditMsg = data.audit ?? '';
        } else {
          throw new Error('API unavailable');
        }
      } catch {
        // JS fallback
        const newCol = `${transformColumn}_${transformType}`;
        transformedRows = activeDataset.rows.map((row) => {
          const val = Number(row[transformColumn]) || 0;
          let transformed: number;
          if (transformType === 'log') transformed = Math.log(Math.max(val, 1e-10));
          else if (transformType === 'sqrt') transformed = Math.sqrt(Math.max(val, 0));
          else transformed = val;
          return { ...row, [newCol]: transformed };
        });
        if (!newColumns.includes(newCol)) newColumns = [...newColumns, newCol];
        auditMsg = `${transformType}(${transformColumn}) → ${newCol} (local fallback)`;
      }

      setDatasets((prev) =>
        prev.map((d, i) =>
          i === activeDatasetIdx ? { ...d, rows: transformedRows, columns: newColumns } : d
        )
      );
      addAudit('TRANSFORM', auditMsg || `${transformType}(${transformColumn})`);
      toast.success(`Transformation applied: ${transformType}(${transformColumn})`);
    } catch {
      toast.error('Transform failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="text-xs">
      {/* Section tabs */}
      <div className="flex border-b border-border/50 bg-muted/20">
        {(['upload', 'ai-clean', 'clean', 'transform'] as const).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-medium capitalize transition-colors',
              activeSection === section
                ? 'bg-background text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:bg-muted/40'
            )}
          >
            {section === 'upload' ? 'Upload'
              : section === 'ai-clean' ? (
                <span className="flex items-center justify-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" />AI
                </span>
              )
              : section === 'clean' ? 'Clean'
              : 'Transform'}
          </button>
        ))}
      </div>

      <div className="p-2.5 space-y-2.5">

        {/* ── Upload (DataUploadAI) ─────────────────────────────────── */}
        {activeSection === 'upload' && (
          <>
            {/* AI-powered drag-drop upload with schema preview + issue detection */}
            <DataUploadAI
              onReady={() => {
                /* parent can scroll to chat — no-op here since chat is a sibling panel */
              }}
            />

            {/* Legacy dataset list — shown when any datasets have been loaded via
                the old handleUpload path or via AI-Clean "Use in Analysis" */}
            {datasets.length > 0 && (
              <div className="space-y-0.5 mt-2 max-h-24 overflow-y-auto rounded-md border border-border">
                {datasets.map((ds, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDatasetIdx(i)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors',
                      activeDatasetIdx === i
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50 text-foreground'
                    )}
                  >
                    <FileIcon name={ds.name} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-[11px]">{ds.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {ds.rows.length} rows · {ds.columns.length} cols
                      </p>
                    </div>
                    {activeDatasetIdx === i && (
                      <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDatasets((prev) => {
                          const next = prev.filter((_, j) => j !== i);
                          setActiveDatasetIdx(next.length > 0 ? 0 : null);
                          return next;
                        });
                      }}
                      className="p-0.5 rounded hover:text-red-500 transition-all flex-shrink-0"
                      title="Remove dataset"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {/* Hidden file input kept for legacy handleUpload used by AI-Clean onDataReady */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.tsv,.sas7bdat,.xpt"
              className="hidden"
              onChange={handleUpload}
            />
          </>
        )}

        {/* ── AI Clean ─────────────────────────────────────────────────── */}
        {activeSection === 'ai-clean' && (
          <SmartDataUpload
            onDataReady={(rows, columns, fileName) => {
              const dataset: Dataset = {
                name: fileName,
                rows: rows as DatasetRow[],
                columns,
                uploadedAt: new Date(),
              };
              setDatasets((prev) => {
                const next = [...prev, dataset];
                setActiveDatasetIdx(next.length - 1);
                return next;
              });
              addAudit('AI-CLEAN', `"${fileName}" cleaned — ${rows.length} rows ready`);
              toast.success(`Cleaned data loaded: ${fileName}`);
              setActiveSection('upload');
            }}
          />
        )}

        {/* ── Clean ────────────────────────────────────────────────────── */}
        {activeSection === 'clean' && (
          <>
            {!activeDataset ? (
              <p className="text-[11px] text-muted-foreground text-center py-4">
                Upload a dataset first
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-gray-500">
                  Active: <span className="text-primary font-semibold">{activeDataset.name}</span>
                  <span className="text-gray-400 ml-1">({activeDataset.rows.length} rows)</span>
                </p>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Handle Missing Values
                  </label>
                  <select
                    value={cleanMissing}
                    onChange={(e) => setCleanMissing(e.target.value as typeof cleanMissing)}
                    className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="drop">Drop rows with missing values</option>
                    <option value="mean">Impute with column mean</option>
                    <option value="median">Impute with column median</option>
                    <option value="zero">Fill with 0</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cleanOutliers}
                    onChange={(e) => setCleanOutliers(e.target.checked)}
                    className="rounded accent-primary"
                  />
                  <span className="text-[11px] text-gray-700">Remove outliers (IQR ×1.5)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={normalizeData}
                    onChange={(e) => setNormalizeData(e.target.checked)}
                    className="rounded accent-primary"
                  />
                  <span className="text-[11px] text-gray-700">Z-score normalize numeric columns</span>
                </label>

                <button
                  onClick={handleClean}
                  disabled={isProcessing}
                  className="w-full py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isProcessing
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Wand2 className="w-3 h-3" />}
                  {isProcessing ? 'Cleaning…' : 'Apply Cleaning'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Transform ────────────────────────────────────────────────── */}
        {activeSection === 'transform' && (
          <>
            {!activeDataset ? (
              <p className="text-[11px] text-muted-foreground text-center py-4">
                Upload a dataset first
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-gray-500">
                  Active: <span className="text-primary font-semibold">{activeDataset.name}</span>
                </p>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Transformation
                  </label>
                  <select
                    value={transformType}
                    onChange={(e) => setTransformType(e.target.value as typeof transformType)}
                    className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="log">Log Transform (ln)</option>
                    <option value="sqrt">Square Root Transform</option>
                    <option value="zscore">Z-Score Standardisation</option>
                    <option value="minmax">Min-Max Normalisation [0,1]</option>
                    <option value="group_by">Group By (count)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Target Column
                  </label>
                  <select
                    value={transformColumn}
                    onChange={(e) => setTransformColumn(e.target.value)}
                    className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select column…</option>
                    {activeDataset.columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleTransform}
                  disabled={isProcessing || !transformColumn}
                  className="w-full py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isProcessing
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <GitBranch className="w-3 h-3" />}
                  {isProcessing ? 'Transforming…' : 'Apply Transform'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Audit trail ──────────────────────────────────────────────── */}
        {auditLog.length > 0 && (
          <div className="border-t border-border/50 pt-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
              Audit Trail
            </p>
            <div className="space-y-0.5 max-h-20 overflow-y-auto">
              {auditLog.map((entry) => (
                <div key={entry.id} className="flex gap-1.5 text-[10px] leading-relaxed">
                  <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="font-semibold text-primary">{entry.action}</span>
                  <span className="text-gray-500 truncate">{entry.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
