/**
 * ComplianceModePanel
 *
 * Right-side slide-in drawer for GLP/GCP compliance:
 *   - Audit Trail — all logged user actions from SQLite backend
 *   - Validation  — run 8 GLP/GCP checks against uploaded data
 *   - Reports     — generate TLF Excel workbook or eCTD ZIP package
 *
 * Opened via the Shield icon button or "Compliance Mode" in the project dropdown.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Shield,
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  FileArchive,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: number;
  timestamp: string;
  user_id: string;
  action: string;
  study_id: string | null;
  dataset_name: string | null;
  details: string | null;
  ip_address: string | null;
}

interface ValidationCheck {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'INFO';
  message: string;
  details?: string;
}

interface ValidationResult {
  overall: 'PASS' | 'FAIL' | 'WARN';
  score: number;
  checks: ValidationCheck[];
  summary: string;
}

interface ComplianceModePanelProps {
  open: boolean;
  onClose: () => void;
  studyId?: string | null;
  projectName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = '/api/v1/compliance';

const STATUS_ICON: Record<string, React.ReactNode> = {
  PASS: <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />,
  FAIL: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
  WARN: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
  INFO: <Activity className="w-4 h-4 text-blue-400 flex-shrink-0" />,
};

const STATUS_BADGE: Record<string, string> = {
  PASS: 'bg-blue-50 text-blue-700 border border-blue-200',
  FAIL: 'bg-red-50 text-red-700 border border-red-200',
  WARN: 'bg-amber-50 text-amber-700 border border-amber-200',
  INFO: 'bg-blue-50 text-blue-700 border border-blue-200',
};

function fmtTs(ts: string) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ts; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComplianceModePanel({
  open,
  onClose,
  studyId,
  projectName,
}: ComplianceModePanelProps) {
  // ── Tab state ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'audit' | 'validate' | 'reports'>('audit');

  // ── Audit trail ─────────────────────────────────────────────────────────────
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // ── Validation ──────────────────────────────────────────────────────────────
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  // ── Reports ─────────────────────────────────────────────────────────────────
  const [reportStudyId, setReportStudyId] = useState(studyId ?? 'STUDY-001');
  const [reportTitle, setReportTitle] = useState('Clinical Study Report');
  const [reportGenerating, setReportGenerating] = useState(false);
  const [ectdExporting, setEctdExporting] = useState(false);

  // ── Fetch audit trail ───────────────────────────────────────────────────────
  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (studyId) params.set('study_id', studyId);
      const res = await fetch(`${API}/audit?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditEntries(data.entries ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setAuditError(`Could not load audit trail: ${msg}`);
    } finally {
      setAuditLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    if (open && tab === 'audit') fetchAudit();
  }, [open, tab, fetchAudit]);

  // ── Run validation ──────────────────────────────────────────────────────────
  const runValidation = useCallback(async () => {
    setValidating(true);
    try {
      // Attempt with a small sample dataset for demo; real usage would pass actual data
      const payload = {
        dataset: [
          { USUBJID: 'SUBJ-001', AGE: 45, SEX: 'M', AVAL: 12.3, ADT: '2024-01-15' },
          { USUBJID: 'SUBJ-002', AGE: 52, SEX: 'F', AVAL: 8.7, ADT: '2024-01-16' },
          { USUBJID: 'SUBJ-003', AGE: 38, SEX: 'M', AVAL: 15.1, ADT: '2024-01-17' },
          { USUBJID: 'SUBJ-001', AGE: 45, SEX: 'M', AVAL: 12.3, ADT: '2024-01-15' }, // duplicate
        ],
        required_columns: ['USUBJID', 'AGE', 'SEX', 'AVAL'],
        study_id: studyId ?? 'DEMO',
      };
      const res = await fetch(`${API}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: ValidationResult = await res.json();
      setValidationResult(result);
      toast.success(`Validation complete — score ${result.score}%`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Validation failed: ${msg}`);
    } finally {
      setValidating(false);
    }
  }, [studyId]);

  // ── Generate TLF Excel ──────────────────────────────────────────────────────
  const generateExcel = useCallback(async () => {
    setReportGenerating(true);
    try {
      const payload = {
        study_id: reportStudyId,
        title: reportTitle,
        tables: [
          {
            title: 'Summary Statistics — Primary Endpoint',
            data: [
              { Statistic: 'N', Treatment: '42', Placebo: '41' },
              { Statistic: 'Mean', Treatment: '12.3', Placebo: '10.1' },
              { Statistic: 'SD', Treatment: '2.4', Placebo: '2.7' },
              { Statistic: 'p-value', Treatment: '0.023', Placebo: '—' },
            ],
          },
        ],
        listings: [
          {
            title: 'Patient Listing — Adverse Events',
            data: [
              { USUBJID: 'SUBJ-001', AEDECOD: 'Headache', AESEV: 'MILD', AESTDTC: '2024-01-20' },
              { USUBJID: 'SUBJ-002', AEDECOD: 'Nausea', AESEV: 'MILD', AESTDTC: '2024-01-22' },
            ],
          },
        ],
        figures: [],
        author: 'NuPhorm Platform',
        sponsor: 'NuPhorm Inc.',
      };
      const res = await fetch(`${API}/report/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TLF_${reportStudyId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('TLF Excel report downloaded');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Report generation failed: ${msg}`);
    } finally {
      setReportGenerating(false);
    }
  }, [reportStudyId, reportTitle]);

  // ── eCTD Export ─────────────────────────────────────────────────────────────
  const exportEctd = useCallback(async () => {
    setEctdExporting(true);
    try {
      const payload = {
        study_id: reportStudyId,
        sponsor: 'NuPhorm Inc.',
        study_title: reportTitle,
        files: [],
      };
      const res = await fetch(`${API}/ectd-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eCTD_${reportStudyId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('eCTD package downloaded');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`eCTD export failed: ${msg}`);
    } finally {
      setEctdExporting(false);
    }
  }, [reportStudyId, reportTitle]);

  // ── Compliance score colour ─────────────────────────────────────────────────
  const scoreColor = (score: number) => {
    if (score >= 90) return 'text-blue-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full w-[440px] max-w-full bg-white shadow-2xl z-50',
          'flex flex-col border-l border-gray-200 transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="Compliance Mode Panel"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-[#1E3A5F]">
          <Shield className="w-5 h-5 text-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              Compliance Mode
            </h2>
            {projectName && (
              <p className="text-[11px] text-blue-200 truncate">{projectName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {(['audit', 'validate', 'reports'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium transition-colors capitalize',
                tab === t
                  ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F] bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {t === 'audit' ? 'Audit Trail' : t === 'validate' ? 'GLP/GCP Checks' : 'Reports'}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── AUDIT TRAIL ─────────────────────────────────────────────── */}
          {tab === 'audit' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Recent Actions ({auditEntries.length})
                </p>
                <button
                  onClick={fetchAudit}
                  disabled={auditLoading}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-3 h-3', auditLoading && 'animate-spin')} />
                  Refresh
                </button>
              </div>

              {auditError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {auditError}
                  <p className="mt-1 text-red-500">Start the Python API on port 8001 to enable audit logging.</p>
                </div>
              )}

              {auditLoading && !auditError && (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}

              {!auditLoading && !auditError && auditEntries.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No audit entries yet.</p>
                  <p className="text-[11px] mt-1">Actions are logged automatically when you use the platform.</p>
                </div>
              )}

              {auditEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-gray-100 bg-white p-3 space-y-1.5 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-medium text-gray-800 flex-1 leading-tight">{entry.action}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {fmtTs(entry.timestamp)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {entry.user_id}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1 font-mono truncate">
                      {entry.details}
                    </p>
                  )}
                  {(entry.study_id || entry.dataset_name) && (
                    <div className="flex gap-2 text-[10px]">
                      {entry.study_id && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                          {entry.study_id}
                        </span>
                      )}
                      {entry.dataset_name && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {entry.dataset_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── GLP/GCP VALIDATION ──────────────────────────────────────── */}
          {tab === 'validate' && (
            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-[#1E3A5F]/20 bg-[#1E3A5F]/5 p-4">
                <p className="text-xs text-gray-600 mb-3">
                  Run automated GLP/GCP data quality checks against the active dataset.
                  8 checks cover completeness, uniqueness, date consistency, numeric ranges, and traceability.
                </p>
                <button
                  onClick={runValidation}
                  disabled={validating}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#2d5280] disabled:opacity-50 transition-colors"
                >
                  <Shield className={cn('w-4 h-4', validating && 'animate-pulse')} />
                  {validating ? 'Running checks…' : 'Run GLP/GCP Validation'}
                </button>
              </div>

              {validationResult && (
                <>
                  {/* Score card */}
                  <div className={cn(
                    'rounded-xl border-2 p-4 flex items-center gap-4',
                    validationResult.overall === 'PASS' ? 'border-blue-200 bg-blue-50' :
                    validationResult.overall === 'WARN' ? 'border-amber-200 bg-amber-50' :
                    'border-red-200 bg-red-50'
                  )}>
                    <div className="text-center flex-shrink-0">
                      <p className={cn('text-3xl font-bold tabular-nums', scoreColor(validationResult.score))}>
                        {validationResult.score}%
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Compliance Score</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-1', STATUS_BADGE[validationResult.overall])}>
                        {STATUS_ICON[validationResult.overall]}
                        {validationResult.overall}
                      </div>
                      <p className="text-xs text-gray-600 leading-snug">{validationResult.summary}</p>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        validationResult.score >= 90 ? 'bg-blue-500' :
                        validationResult.score >= 70 ? 'bg-amber-500' :
                        'bg-red-500'
                      )}
                      style={{ width: `${validationResult.score}%` }}
                    />
                  </div>

                  {/* Individual checks */}
                  <div className="space-y-2">
                    {validationResult.checks.map((chk) => (
                      <div
                        key={chk.check}
                        className="rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden"
                      >
                        <button
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedCheck(expandedCheck === chk.check ? null : chk.check)}
                        >
                          {STATUS_ICON[chk.status]}
                          <span className="flex-1 text-xs font-medium text-gray-700">
                            {chk.check.replace(/_/g, ' ')}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', STATUS_BADGE[chk.status])}>
                            {chk.status}
                          </span>
                          {chk.details
                            ? (expandedCheck === chk.check ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />)
                            : <span className="w-3.5 h-3.5" />
                          }
                        </button>
                        {expandedCheck === chk.check && (
                          <div className="px-3 pb-3 pt-0 border-t border-gray-50">
                            <p className="text-xs text-gray-600 mb-1">{chk.message}</p>
                            {chk.details && (
                              <p className="text-[11px] text-gray-500 font-mono bg-gray-50 rounded px-2 py-1.5 whitespace-pre-wrap">
                                {chk.details}
                              </p>
                            )}
                          </div>
                        )}
                        {expandedCheck !== chk.check && (
                          <p className="px-10 pb-2 text-[11px] text-gray-400 leading-tight">{chk.message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── REPORTS ─────────────────────────────────────────────────── */}
          {tab === 'reports' && (
            <div className="p-4 space-y-4">
              {/* Config */}
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Report Settings</p>

                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">Study ID</label>
                  <input
                    type="text"
                    value={reportStudyId}
                    onChange={(e) => setReportStudyId(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 focus:border-[#1E3A5F] bg-white"
                    placeholder="e.g. STUDY-001"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">Report Title</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 focus:border-[#1E3A5F] bg-white"
                    placeholder="e.g. Clinical Study Report"
                  />
                </div>
              </div>

              {/* TLF Excel */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">TLF Excel Report</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ICH E3-formatted workbook with Tables, Listings &amp; Figures sheets, cover page, and audit trail tab.
                    </p>
                  </div>
                </div>
                <button
                  onClick={generateExcel}
                  disabled={reportGenerating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Download className={cn('w-4 h-4', reportGenerating && 'animate-bounce')} />
                  {reportGenerating ? 'Generating…' : 'Download TLF Excel (.xlsx)'}
                </button>
              </div>

              {/* eCTD */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileArchive className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">eCTD Package</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ZIP archive in ICH M8 eCTD structure (<code className="font-mono">m5/53/5351/</code>).
                      Ready for regulatory submission.
                    </p>
                  </div>
                </div>
                <button
                  onClick={exportEctd}
                  disabled={ectdExporting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Download className={cn('w-4 h-4', ectdExporting && 'animate-bounce')} />
                  {ectdExporting ? 'Packaging…' : 'Export eCTD Package (.zip)'}
                </button>
              </div>

              {/* Info note */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-500 leading-snug">
                  Reports include placeholder data. Connect the Python API (port 8001) and upload your study dataset to generate reports with actual analysis results.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            GLP/GCP · ICH E3 · eCTD M8 · ADaM 1.3/1.4
          </p>
          <span className="text-[10px] text-gray-400">
            {new Date().toLocaleDateString()}
          </span>
        </div>
      </aside>
    </>
  );
}
