/**
 * SmartDataUpload
 *
 * GxP-compliant AI-assisted data cleaning UI.
 *
 * Flow:
 *   1. Drag-drop or click to upload CSV / XLSX / TSV
 *   2. POST /api/v1/clean/analyze  → issues[] + stats
 *   3. Issues accordion grouped by severity with approve/reject checkboxes
 *   4. Before/After diff grid (changed cells highlighted amber)
 *   5. "Apply Selected Fixes" → POST /api/v1/clean/apply
 *   6. "Use Cleaned Data in Analysis" → dispatches to parent via onDataReady()
 *   7. Export cleaned CSV / audit trail CSV
 */

import { useState, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Download,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────────

const API = '/api/v1/clean';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SuggestedFix {
  action: string;
  value?: string | number | null;
  confidence: number;       // 0-1
  method_note: string;
}

interface Issue {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  column: string;
  rows_affected: number[];
  count: number;
  description: string;
  explanation: string;
  suggested_fix: SuggestedFix;
  is_critical: boolean;
  requires_confirm: boolean;
  gcp_note?: string;
}

interface ColumnStat {
  count: number;
  missing: number;
  missing_pct: number;
  unique?: number;
  dtype: string;
  min?: number | string;
  max?: number | string;
  mean?: number;
}

interface AnalyzeResponse {
  session_id: string;
  file_name: string;
  shape: [number, number];
  column_stats: Record<string, ColumnStat>;
  issues: Issue[];
  preview_rows: Record<string, unknown>[];
  columns: string[];
}

interface AuditEntry {
  ts: string;
  session_id: string;
  version: number;
  user: string;
  action: string;
  column: string;
  row?: number;
  before?: unknown;
  after?: unknown;
  method?: string;
  confidence?: number;
  gcp_note?: string;
}

// ── Severity helpers ───────────────────────────────────────────────────────────

const SEV_COLOR: Record<Issue['severity'], string> = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high:     'text-orange-600 bg-orange-50 border-orange-200',
  medium:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  low:      'text-blue-600 bg-blue-50 border-blue-200',
};
const SEV_ICON: Record<Issue['severity'], React.ReactNode> = {
  critical: <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />,
  high:     <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />,
  medium:   <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />,
  low:      <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
};

// ── Sub-component: IssueCard ───────────────────────────────────────────────────

function IssueCard({
  issue,
  checked,
  onToggle,
}: {
  issue: Issue;
  checked: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const conf = Math.round(issue.suggested_fix.confidence * 100);

  return (
    <div className={cn('rounded-lg border text-[11px]', SEV_COLOR[issue.severity])}>
      <div className="flex items-start gap-2 px-3 py-2">
        {/* Checkbox — disabled for critical issues (require individual confirm) */}
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={issue.requires_confirm && !checked}
          className="mt-0.5 rounded accent-blue-600 flex-shrink-0"
          aria-label={`Select fix: ${issue.description}`}
        />
        {SEV_ICON[issue.severity]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold capitalize">{issue.severity}</span>
            <span className="font-mono bg-white/60 px-1 rounded text-[10px]">{issue.column}</span>
            <span className="text-gray-500">{issue.count} row{issue.count !== 1 ? 's' : ''}</span>
            {issue.requires_confirm && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded-full font-medium">
                Confirm required
              </span>
            )}
          </div>
          <p className="mt-0.5 leading-snug">{issue.description}</p>
          {/* Suggested fix summary */}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-500">Fix:</span>
            <span className="font-medium">{issue.suggested_fix.action.replace(/_/g, ' ')}</span>
            {issue.suggested_fix.value !== undefined && issue.suggested_fix.value !== null && (
              <span className="font-mono text-[10px] bg-white/70 px-1 rounded">
                → {String(issue.suggested_fix.value)}
              </span>
            )}
            {/* Confidence bar */}
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', conf >= 80 ? 'bg-emerald-500' : conf >= 60 ? 'bg-yellow-400' : 'bg-red-400')}
                  style={{ width: `${conf}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500">{conf}%</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-0.5 rounded hover:bg-black/10 transition-colors flex-shrink-0 mt-0.5"
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-current/10 px-3 py-2 space-y-1.5 bg-white/40">
          <p className="leading-relaxed text-gray-700">{issue.explanation}</p>
          {issue.suggested_fix.method_note && (
            <p className="text-[10px] text-gray-500 italic">{issue.suggested_fix.method_note}</p>
          )}
          {issue.gcp_note && (
            <div className="flex items-start gap-1.5 mt-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-emerald-700">{issue.gcp_note}</p>
            </div>
          )}
          {issue.rows_affected.length > 0 && (
            <p className="text-[10px] text-gray-400">
              Affected rows: {issue.rows_affected.slice(0, 8).join(', ')}
              {issue.rows_affected.length > 8 ? ` + ${issue.rows_affected.length - 8} more` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-component: DiffGrid ────────────────────────────────────────────────────

function DiffGrid({
  before,
  after,
  columns,
}: {
  before: Record<string, unknown>[];
  after: Record<string, unknown>[];
  columns: string[];
}) {
  const changedCells = new Set<string>();
  before.forEach((row, ri) => {
    columns.forEach((col) => {
      if (String(row[col] ?? '') !== String((after[ri] ?? {})[col] ?? '')) {
        changedCells.add(`${ri}-${col}`);
      }
    });
  });

  const visibleCols = columns.slice(0, 8);

  return (
    <div className="overflow-x-auto rounded-lg border border-border text-[10px]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-muted/60">
            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border w-8">#</th>
            {visibleCols.map((col) => (
              <th key={col} className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {before.slice(0, 10).map((row, ri) => (
            <tr key={ri} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              <td className="px-2 py-1 text-muted-foreground">{ri + 1}</td>
              {visibleCols.map((col) => {
                const key = `${ri}-${col}`;
                const changed = changedCells.has(key);
                const beforeVal = String(row[col] ?? '—');
                const afterVal = String((after[ri] ?? {})[col] ?? '—');
                return (
                  <td key={col} className={cn('px-2 py-1', changed && 'bg-amber-50')}>
                    {changed ? (
                      <div className="space-y-0.5">
                        <span className="line-through text-red-400">{beforeVal}</span>
                        <span className="text-emerald-700 font-medium block">{afterVal}</span>
                      </div>
                    ) : (
                      <span>{beforeVal}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {columns.length > 8 && (
        <p className="text-center text-[10px] text-muted-foreground py-1">
          +{columns.length - 8} more columns not shown
        </p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface SmartDataUploadProps {
  onDataReady?: (rows: Record<string, unknown>[], columns: string[], fileName: string) => void;
}

export default function SmartDataUpload({ onDataReady }: SmartDataUploadProps) {
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'analyzed' | 'applying' | 'done'>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [cleanedPreview, setCleanedPreview] = useState<Record<string, unknown>[] | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [expandedSev, setExpandedSev] = useState<Set<Issue['severity']>>(
    new Set<Issue['severity']>(['critical', 'high'])
  );
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload + Analyze ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    const allowed = ['.csv', '.tsv', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error(`Unsupported file type. Use: ${allowed.join(', ')}`);
      return;
    }

    setPhase('uploading');
    setProgress(10);

    // Fake progress ticks while request is in flight
    const ticker = setInterval(() => setProgress((p) => Math.min(p + 12, 85)), 600);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('user_id', 'local_user');

      const uploadUrl = `${API}/analyze`;
      console.log('[SmartDataUpload] Attempting upload to:', uploadUrl, '| file:', file.name, file.size, 'bytes');
      const res = await fetch(uploadUrl, { method: 'POST', body: fd });
      clearInterval(ticker);
      console.log('[SmartDataUpload] Response status:', res.status, res.statusText);

      if (!res.ok) {
        const raw = await res.text();
        console.error('[SmartDataUpload] Error response body:', raw);
        let errMsg = `Server error ${res.status}: ${raw.slice(0, 200)}`;
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.detail === 'string') {
            errMsg = parsed.detail;
          } else if (Array.isArray(parsed.detail)) {
            // FastAPI 422 validation error: detail is [{loc, msg, type}, ...]
            errMsg = parsed.detail.map((e: { msg?: string }) => e.msg ?? String(e)).join('; ');
          }
        } catch { /* raw text already logged */ }
        throw new Error(errMsg);
      }

      const data: AnalyzeResponse = await res.json();
      setProgress(100);
      setAnalyzeResult(data);

      // Pre-approve non-critical issues
      const autoApproved = new Set<string>(
        data.issues.filter((i) => !i.requires_confirm).map((i) => i.id)
      );
      setApproved(autoApproved);

      setPhase('analyzed');
      toast.success(`Analysed ${file.name} — ${data.issues.length} issue${data.issues.length !== 1 ? 's' : ''} found`);
    } catch (err) {
      clearInterval(ticker);
      setProgress(0);
      setPhase('idle');
      toast.error(err instanceof Error ? err.message : 'Analysis failed — is the biostat-api running on port 8001?');
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ── Apply ───────────────────────────────────────────────────────────────────

  const handleApply = async () => {
    if (!analyzeResult || approved.size === 0) return;
    setPhase('applying');

    try {
      const res = await fetch(`${API}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: analyzeResult.session_id,
          approved_issue_ids: Array.from(approved),
          user_id: 'local_user',
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        console.error('[SmartDataUpload] Apply error response body:', raw);
        let errMsg = `Server error ${res.status}`;
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.detail === 'string') {
            errMsg = parsed.detail;
          } else if (Array.isArray(parsed.detail)) {
            errMsg = parsed.detail.map((e: { msg?: string }) => e.msg ?? String(e)).join('; ');
          }
        } catch { /* raw text already logged */ }
        throw new Error(errMsg);
      }
      const data = await res.json();

      setCleanedPreview(data.preview_rows ?? []);
      setAuditEntries(data.audit_entries ?? []);
      setShowDiff(true);
      setPhase('done');
      toast.success(`Applied ${data.fixes_applied} fix${data.fixes_applied !== 1 ? 'es' : ''}`);
    } catch (err) {
      setPhase('analyzed');
      toast.error(err instanceof Error ? err.message : 'Apply failed');
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const downloadCleaned = async () => {
    if (!analyzeResult) return;
    window.open(`${API}/export/${analyzeResult.session_id}`, '_blank');
  };

  const downloadAudit = async () => {
    if (!analyzeResult) return;
    window.open(`${API}/export-audit/${analyzeResult.session_id}`, '_blank');
  };

  // ── Revert ──────────────────────────────────────────────────────────────────

  const handleRevert = async () => {
    if (!analyzeResult) return;
    await fetch(`${API}/revert/${analyzeResult.session_id}`, { method: 'POST' });
    setCleanedPreview(null);
    setShowDiff(false);
    setPhase('analyzed');
    toast.info('Reverted to original data');
  };

  // ── Use in Analysis ─────────────────────────────────────────────────────────

  const handleUseInAnalysis = async () => {
    if (!analyzeResult) return;
    try {
      const res = await fetch(`${API}/export/${analyzeResult.session_id}`);
      const csv = await res.text();
      const lines = csv.split('\n').filter(Boolean);
      const cols = lines[0].split(',').map((c) => c.trim().replace(/"/g, ''));
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',');
        return Object.fromEntries(cols.map((c, i) => [c, vals[i]?.trim().replace(/"/g, '') ?? '']));
      });
      onDataReady?.(rows, cols, analyzeResult.file_name);
      toast.success('Cleaned data sent to analysis');
    } catch {
      toast.error('Failed to load cleaned data');
    }
  };

  // ── Group issues by severity ────────────────────────────────────────────────

  const issuesBySev = analyzeResult
    ? (['critical', 'high', 'medium', 'low'] as const).map((sev) => ({
        sev,
        issues: analyzeResult.issues
          .filter((i) => i.severity === sev)
          .sort((a, b) => b.count - a.count),
      })).filter((g) => g.issues.length > 0)
    : [];

  const toggleAll = (issues: Issue[], select: boolean) => {
    setApproved((prev) => {
      const next = new Set(prev);
      issues.forEach((i) => {
        if (select) next.add(i.id);
        else next.delete(i.id);
      });
      return next;
    });
  };

  // ── Render: Drop Zone ───────────────────────────────────────────────────────

  if (phase === 'idle' || phase === 'uploading') {
    return (
      <div className="space-y-3 p-1">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => phase === 'idle' && fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-all cursor-pointer',
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : phase === 'uploading'
              ? 'border-gray-200 bg-gray-50 cursor-wait'
              : 'border-blue-200 bg-blue-50/30 hover:border-blue-300 hover:bg-blue-50'
          )}
        >
          {phase === 'uploading' ? (
            <>
              <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
              <p className="text-xs text-blue-600 font-medium">Analysing with AI…</p>
              <div className="w-48 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400">Running 6 quality checks…</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-700">Drop file or click to upload</p>
                <p className="text-[10px] text-gray-400 mt-0.5">CSV, XLSX, TSV — AI will scan for quality issues</p>
              </div>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />

        {/* Feature badges */}
        {phase === 'idle' && (
          <div className="flex flex-wrap gap-1.5">
            {[
              '6 quality checks',
              'Pharma domain rules',
              'GxP audit trail',
              'Per-fix approval',
            ].map((b) => (
              <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Results ─────────────────────────────────────────────────────────

  const result = analyzeResult!;
  const totalIssues = result.issues.length;
  const critCount = result.issues.filter((i) => i.severity === 'critical').length;

  return (
    <div className="space-y-3 text-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800 truncate max-w-[200px]" title={result.file_name}>
            {result.file_name}
          </p>
          <p className="text-[10px] text-gray-400">
            {result.shape[0].toLocaleString()} rows × {result.shape[1]} cols
            {' · '}
            <span className={cn(totalIssues > 0 ? 'text-orange-600 font-medium' : 'text-emerald-600')}>
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
            </span>
            {critCount > 0 && <span className="text-red-600 font-semibold ml-1">({critCount} critical)</span>}
          </p>
        </div>
        <button
          onClick={() => { setPhase('idle'); setAnalyzeResult(null); setCleanedPreview(null); setShowDiff(false); }}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Upload new file"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* No issues */}
      {totalIssues === 0 && (
        <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-emerald-50 border border-emerald-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-emerald-700 font-medium">No data quality issues detected</p>
        </div>
      )}

      {/* Issues accordion */}
      {issuesBySev.map(({ sev, issues }) => {
        const open = expandedSev.has(sev);
        const approvedInGroup = issues.filter((i) => approved.has(i.id)).length;
        return (
          <div key={sev} className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setExpandedSev((prev) => {
                const next = new Set(prev);
                next.has(sev) ? next.delete(sev) : next.add(sev);
                return next;
              })}
              className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {SEV_ICON[sev]}
                <span className="font-semibold capitalize text-[11px]">{sev}</span>
                <span className="text-[10px] text-gray-400">({issues.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {open && (
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleAll(issues.filter((i) => !i.requires_confirm), true)}
                      className="text-[10px] text-blue-600 hover:underline"
                    >all</button>
                    <span className="text-gray-300">/</span>
                    <button
                      onClick={() => toggleAll(issues, false)}
                      className="text-[10px] text-gray-400 hover:underline"
                    >none</button>
                  </div>
                )}
                <span className="text-[10px] text-gray-400 tabular-nums">
                  {approvedInGroup}/{issues.length} selected
                </span>
                {open ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
              </div>
            </button>
            {open && (
              <div className="p-2 space-y-1.5">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    checked={approved.has(issue.id)}
                    onToggle={() => setApproved((prev) => {
                      const next = new Set(prev);
                      next.has(issue.id) ? next.delete(issue.id) : next.add(issue.id);
                      return next;
                    })}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Diff grid */}
      {showDiff && cleanedPreview && result.preview_rows && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Table2 className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-semibold text-[11px] text-gray-700">Before / After Preview</span>
            <span className="text-[10px] text-gray-400">(first 10 rows)</span>
          </div>
          <DiffGrid
            before={result.preview_rows}
            after={cleanedPreview}
            columns={result.columns}
          />
        </div>
      )}

      {/* Audit trail */}
      {auditEntries.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-[11px] text-gray-700">GxP Audit Trail</span>
            <span className="text-[10px] text-gray-400">({auditEntries.length} entries)</span>
          </div>
          <div className="max-h-24 overflow-y-auto space-y-0.5">
            {auditEntries.map((e, i) => (
              <div key={i} className="flex gap-1.5 text-[10px] leading-relaxed">
                <span className="text-gray-300 tabular-nums whitespace-nowrap">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
                <span className="font-medium text-primary">{e.action.replace(/_/g, ' ')}</span>
                <span className="text-gray-400 font-mono">{e.column}</span>
                {e.before !== undefined && (
                  <span className="text-gray-400">
                    <span className="line-through text-red-400">{String(e.before)}</span>
                    {' → '}
                    <span className="text-emerald-600">{String(e.after)}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
        {/* Apply — visible while analyzed (not yet applied) or while applying */}
        {(phase === 'analyzed' || phase === 'applying') && approved.size > 0 && (
          <button
            onClick={handleApply}
            disabled={phase === 'applying'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {phase === 'applying'
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
              : <><CheckCircle2 className="w-3 h-3" /> Apply {approved.size} Fix{approved.size !== 1 ? 'es' : ''}</>}
          </button>
        )}

        {/* Use in Analysis */}
        {phase === 'done' && (
          <button
            onClick={handleUseInAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Use in Analysis
          </button>
        )}

        {/* Download cleaned */}
        {phase === 'done' && (
          <button
            onClick={downloadCleaned}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-border hover:bg-muted/50 transition-colors"
          >
            <Download className="w-3 h-3" />
            Cleaned CSV
          </button>
        )}

        {/* Download audit */}
        {phase === 'done' && (
          <button
            onClick={downloadAudit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-border hover:bg-muted/50 transition-colors"
          >
            <ShieldCheck className="w-3 h-3" />
            Audit CSV
          </button>
        )}

        {/* Revert */}
        {phase === 'done' && (
          <button
            onClick={handleRevert}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:bg-muted/50 transition-colors ml-auto"
          >
            <RotateCcw className="w-3 h-3" />
            Revert
          </button>
        )}
      </div>
    </div>
  );
}
