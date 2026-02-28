/**
 * UnifiedDatasetManager
 *
 * Collapsible panel shown at the top of the left sidebar.
 * Replaces the old DataManagementPanel.
 *
 * File upload happens ONLY via the paperclip in the chat input below.
 * This panel shows the current dataset status + quick action chips.
 */

import { useState } from 'react';
import {
  ChevronDown,
  Database,
  CheckCircle2,
  Sparkles,
  BarChart2,
  ShieldCheck,
  Download,
  Wand2,
  RotateCcw,
  Loader2,
  GitCompare,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCurrentDatasetStore } from '@/stores/currentDatasetStore';
import { useMeasurementTriggerStore } from '@/stores/measurementTriggerStore';

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  prompt?: string;          // sent to chat via measurementTriggerStore
  onClick?: () => void;     // custom handler (e.g. "Clean Now", "Export")
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UnifiedDatasetManager() {
  const [expanded, setExpanded] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const { currentDataset, versions, markCleaned, switchToVersion } =
    useCurrentDatasetStore();
  const { setPendingMessage } = useMeasurementTriggerStore();

  // ── Clean Now ──────────────────────────────────────────────────────────────

  const handleCleanNow = async () => {
    if (!currentDataset) return;
    setCleaning(true);
    try {
      const fd = new FormData();
      // Build a CSV blob from the in-memory rows
      const cols = currentDataset.columns;
      const csvRows = [
        cols.join(','),
        ...currentDataset.rows.map((r) =>
          cols.map((c) => JSON.stringify(r[c] ?? '')).join(',')
        ),
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      fd.append('file', blob, currentDataset.filename);
      fd.append('user_id', 'local_user');

      const res = await fetch('/api/v1/clean/analyze', { method: 'POST', body: fd });
      if (!res.ok) {
        const raw = await res.text();
        let msg = `Clean failed (${res.status})`;
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.detail === 'string') msg = parsed.detail;
          else if (Array.isArray(parsed.detail))
            msg = parsed.detail.map((e: { msg?: string }) => e.msg ?? String(e)).join('; ');
        } catch { /* raw text */ }
        throw new Error(msg);
      }
      const data = await res.json();
      markCleaned(data.session_id);
      toast.success(`Dataset analysed — ${data.issues?.length ?? 0} issues found. Apply fixes in the AI chat.`);
      // Route user to chat to review + apply
      setPendingMessage(
        `I just ran the smart cleaner on ${currentDataset.filename}. Session ID: ${data.session_id}. ` +
        `Please summarise the ${data.issues?.length ?? 0} issues found and recommend which ones to apply.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Clean failed');
    } finally {
      setCleaning(false);
    }
  };

  // ── Quick Actions ──────────────────────────────────────────────────────────

  const quickActions: QuickAction[] = [
    {
      label: 'Clean Dataset',
      icon: <Wand2 className="w-3 h-3" />,
      onClick: handleCleanNow,
    },
    {
      label: 'Standardize to CDISC',
      icon: <ShieldCheck className="w-3 h-3" />,
      prompt: `Standardize the current dataset (${currentDataset?.filename ?? 'dataset'}) to CDISC SDTM format. Identify domain, required variables, and flag any compliance gaps.`,
    },
    {
      label: 'Run AE Summary',
      icon: <BarChart2 className="w-3 h-3" />,
      prompt: `Generate an Adverse Events (AE) incidence summary table for the current dataset (${currentDataset?.filename ?? 'dataset'}). Group by System Organ Class and preferred term.`,
    },
    {
      label: 'Generate KM Plot',
      icon: <Sparkles className="w-3 h-3" />,
      prompt: `Generate a Kaplan-Meier survival plot for the current dataset (${currentDataset?.filename ?? 'dataset'}). Identify the time and event columns and produce the curve.`,
    },
    {
      label: 'Export Cleaned',
      icon: <Download className="w-3 h-3" />,
      onClick: () => {
        if (!currentDataset?.cleanedSessionId) {
          toast.info('Clean the dataset first to enable export.');
          return;
        }
        window.open(`/api/v1/clean/export/${currentDataset.cleanedSessionId}`, '_blank');
      },
    },
  ];

  // ── Previous version in history (for Compare button) ───────────────────────

  const previousVersion = versions.find(
    (v) => v.id !== currentDataset?.id && !v.cleaned
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-shrink-0 border-b border-border">
      {/* ── Collapsed header ─────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Database className="w-3.5 h-3.5 flex-shrink-0" />
          {currentDataset ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate max-w-[120px] font-medium text-foreground">
                {currentDataset.filename}
              </span>
              <span className="text-muted-foreground font-normal whitespace-nowrap">
                {currentDataset.rowCount.toLocaleString()} rows
              </span>
              {currentDataset.cleaned && (
                <span className="flex items-center gap-0.5 bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap flex-shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Cleaned
                </span>
              )}
            </span>
          ) : (
            <span>Dataset</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* ── Expanded content ─────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/10">
          {/* No dataset yet */}
          {!currentDataset ? (
            <div className="px-3 py-4 text-center space-y-1.5">
              <Database className="w-6 h-6 text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">No dataset loaded</p>
              <p className="text-[10px] text-muted-foreground/60">
                Use the paperclip icon in the chat below to attach a CSV or XLSX file.
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {/* Dataset info card */}
              <div className="rounded-lg bg-background border border-border/60 px-3 py-2 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {currentDataset.filename}
                  </p>
                  {currentDataset.cleaned ? (
                    <span className="flex items-center gap-0.5 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Cleaned
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0">
                      Raw
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>{currentDataset.rowCount.toLocaleString()} rows</span>
                  <span>{currentDataset.columns.length} cols</span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 truncate">
                  {currentDataset.columns.slice(0, 5).join(', ')}
                  {currentDataset.columns.length > 5 && ` +${currentDataset.columns.length - 5} more`}
                </p>
              </div>

              {/* Compare button — only when a raw version exists */}
              {currentDataset.cleaned && previousVersion && (
                <button
                  onClick={() => setCompareOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md border border-dashed border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <GitCompare className="w-3 h-3" />
                  Compare original vs cleaned
                </button>
              )}

              {/* Quick action chips */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Quick Actions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => {
                        if (action.onClick) {
                          action.onClick();
                        } else if (action.prompt) {
                          setPendingMessage(action.prompt);
                          toast.info(`Sending to AI: "${action.label}"`);
                        }
                      }}
                      disabled={action.label === 'Clean Dataset' && cleaning}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-background border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors disabled:opacity-50"
                    >
                      {action.label === 'Clean Dataset' && cleaning ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        action.icon
                      )}
                      {action.label === 'Clean Dataset' && cleaning ? 'Cleaning…' : action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Version history */}
              {versions.length > 1 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Version History
                  </p>
                  <div className="space-y-1">
                    {versions.map((v) => {
                      const isActive = v.id === currentDataset.id;
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] border transition-colors',
                            isActive
                              ? 'bg-primary/5 border-primary/20 text-foreground'
                              : 'border-border/50 hover:bg-muted/30 text-muted-foreground'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{v.filename}</p>
                            <p className="text-[10px] text-muted-foreground/70">
                              {v.rowCount.toLocaleString()} rows
                              {v.cleaned && ' · Cleaned'}
                            </p>
                          </div>
                          {isActive ? (
                            <span className="text-[10px] text-primary font-semibold flex-shrink-0">
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                switchToVersion(v.id);
                                toast.success(`Switched to ${v.filename}`);
                              }}
                              className="text-[10px] font-medium text-primary hover:underline flex-shrink-0 flex items-center gap-0.5"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Use
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Compare dialog (simple inline modal) ─────────────────────── */}
      {compareOpen && currentDataset && previousVersion && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setCompareOpen(false)}
        >
          <div
            className="bg-background rounded-xl border border-border shadow-2xl max-w-2xl w-full p-5 space-y-3 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary" />
                Compare: Original vs Cleaned
              </p>
              <button
                onClick={() => setCompareOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {(['Original', 'Cleaned'] as const).map((label, idx) => {
                const v = idx === 0 ? previousVersion : currentDataset;
                return (
                  <div key={label} className="space-y-1">
                    <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                      {label}
                    </p>
                    <div className="rounded-lg border border-border overflow-auto max-h-48">
                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr className="bg-muted/50 sticky top-0">
                            {v.columns.slice(0, 5).map((c) => (
                              <th key={c} className="px-2 py-1 text-left font-medium text-muted-foreground whitespace-nowrap border-b border-border">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {v.rows.slice(0, 8).map((row, ri) => (
                            <tr key={ri} className="border-b border-border/40 last:border-0">
                              {v.columns.slice(0, 5).map((c) => (
                                <td key={c} className="px-2 py-1 text-muted-foreground whitespace-nowrap max-w-[80px] truncate">
                                  {String(row[c] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{v.rowCount} rows · {v.columns.length} cols</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
