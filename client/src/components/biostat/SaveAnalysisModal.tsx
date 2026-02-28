/**
 * SaveAnalysisModal — redesigned "native-style" save dialog
 *
 * Features:
 *  • Save As input (auto-filled, editable)
 *  • Tags multi-select (sourced from existing technical files)
 *  • Where folder dropdown (sourced from existing files) + inline new-folder creator
 *  • Master toggles: "Save all in project" / "Save all in tab"
 *  • Granular checkboxes: graph / table / AI query (shows current page N/T)
 *  • Custom quantity steppers (how many of the T queries to include)
 *  • Dark-blue Save button, gray Cancel
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Save,
  X,
  ChevronDown,
  Plus,
  Minus,
  FolderOpen,
  Tag,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { PanelResult } from "@/stores/aiPanelStore";

// ── helpers ───────────────────────────────────────────────────────────────────

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function buildCSV(table: Array<{ metric: string; value: any }>): string {
  const rows = [
    ["Metric", "Value"],
    ...table.map((r) => [String(r.metric), String(r.value)]),
  ];
  return rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function buildHTML(
  title: string,
  table: Array<{ metric: string; value: any }>,
  analysis: string
): string {
  const rows = table
    .map(
      (r, i) =>
        `<tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a">${r.metric}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;text-align:right">${r.value}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;padding:32px}
h1{font-size:1.4rem;font-weight:700;color:#0f172a;margin-bottom:8px}
.sub{font-size:.85rem;color:#64748b;margin-bottom:24px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:.8rem;font-weight:600;color:#334155;border-bottom:1px solid #e2e8f0}
th:last-child{text-align:right}
.ai{margin-top:24px;background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
pre{white-space:pre-wrap;font-size:.85rem;line-height:1.6;color:#334155}
</style></head><body>
<h1>${title}</h1>
<div class="sub">Generated ${new Date().toLocaleString()} · NuPhorm Biostatistics Platform</div>
<table><thead><tr><th>Metric</th><th style="text-align:right">Value</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="ai"><h2 style="font-size:1rem;font-weight:600;margin-bottom:12px">AI Interpretation</h2>
<pre>${analysis.replace(/</g, "&lt;")}</pre></div>
</body></html>`;
}

function buildMeta(
  title: string,
  folder: string,
  tags: string[],
  tabName: string,
  result: PanelResult
): string {
  return JSON.stringify(
    {
      title,
      folder,
      tags,
      tabName,
      generatedAt: new Date().toISOString(),
      query: result.query,
      analysisType: result.analysisResults?.analysis_type ?? null,
      rowCount: (result.editedTable ?? result.analysisResults?.results_table ?? []).length,
    },
    null,
    2
  );
}

// ── small reusable pieces ─────────────────────────────────────────────────────

function Divider() {
  return <hr className="border-t border-[#e2e8f0] my-1" />;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-semibold text-[#334155] uppercase tracking-wide mb-1.5">
      {children}
    </span>
  );
}

interface CounterProps {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}
function Counter({ value, max, onChange, disabled }: CounterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || value <= 1}
        className="w-6 h-6 flex items-center justify-center rounded border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] disabled:opacity-30 transition-colors"
        aria-label="Decrease"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className="text-sm tabular-nums text-[#0f172a] w-10 text-center">
        {value} / {max}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="w-6 h-6 flex items-center justify-center rounded border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] disabled:opacity-30 transition-colors"
        aria-label="Increase"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

interface CBProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  disabled?: boolean;
}
function CB({ id, checked, onChange, label, disabled }: CBProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 py-1.5 cursor-pointer group ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <div
        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
          checked
            ? "bg-blue-600 border-blue-600"
            : "bg-white border-[#cbd5e1] group-hover:border-blue-400"
        }`}
      >
        {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-sm text-[#0f172a]">{label}</span>
    </label>
  );
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  result: PanelResult | null;
  allResults: PanelResult[];   // all results in the active tab (for pagination context)
  activeIndex: number;         // 0-based index of the active result
  tabName?: string;
  graphTitle?: string;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function SaveAnalysisModal({
  open,
  onClose,
  result,
  allResults,
  activeIndex,
  tabName,
  graphTitle,
}: Props) {
  const total = allResults.length;
  const currentPage = activeIndex + 1; // 1-based for display

  // ── derived title default ──────────────────────────────────────────────────
  const derivedTitle = [
    tabName ?? "Analysis",
    graphTitle ?? "Results",
    todayDDMMYYYY(),
  ]
    .filter(Boolean)
    .join(" – ");

  // ── state ──────────────────────────────────────────────────────────────────
  const [saveAs, setSaveAs] = useState(derivedTitle);

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const tagRef = useRef<HTMLDivElement>(null);

  // Folder / Where
  const [folder, setFolder] = useState(""); // "" = root (no folder)
  const [folderDropOpen, setFolderDropOpen] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);

  // Master toggles
  const [saveAllProject, setSaveAllProject] = useState(false);
  const [saveAllTab, setSaveAllTab] = useState(false);

  // Granular checkboxes
  const [saveGraph, setSaveGraph] = useState(true);
  const [saveTable, setSaveTable] = useState(true);
  const [saveAIQuery, setSaveAIQuery] = useState(true);

  // Custom quantities
  const [graphCount, setGraphCount] = useState(currentPage);
  const [tableCount, setTableCount] = useState(currentPage);
  const [aiQueryCount, setAiQueryCount] = useState(currentPage);

  // Reset when modal opens with new data
  useEffect(() => {
    if (open) {
      setSaveAs(derivedTitle);
      setSelectedTags([]);
      setNewTagInput("");
      setFolder("");
      setSaveAllProject(false);
      setSaveAllTab(false);
      setSaveGraph(true);
      setSaveTable(true);
      setSaveAIQuery(true);
      setGraphCount(currentPage);
      setTableCount(currentPage);
      setAiQueryCount(currentPage);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Master toggle side-effects
  useEffect(() => {
    if (saveAllProject || saveAllTab) {
      setSaveGraph(true);
      setSaveTable(true);
      setSaveAIQuery(true);
      setGraphCount(total || 1);
      setTableCount(total || 1);
      setAiQueryCount(total || 1);
    }
  }, [saveAllProject, saveAllTab, total]);

  // Click-outside to close dropdowns
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) setTagDropOpen(false);
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) {
        setFolderDropOpen(false);
        setCreatingFolder(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── fetch existing technical files for tags + folders ──────────────────────
  const { data: existingFiles = [] } = trpc.technical.getFiles.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });

  // Extract unique folder names (stored as "Folder / Title" pattern)
  const existingFolders = Array.from(
    new Set(
      (existingFiles as any[])
        .map((f) => {
          const parts = (f.title ?? "").split(" / ");
          return parts.length > 1 ? parts[0].trim() : null;
        })
        .filter(Boolean) as string[]
    )
  );

  // Extract unique tags (stored with "tag:" prefix in measurements)
  const existingTags = Array.from(
    new Set(
      (existingFiles as any[])
        .flatMap((f) =>
          (f.measurements ?? [])
            .filter((m: string) => m.startsWith("tag:"))
            .map((m: string) => m.slice(4))
        )
    )
  ) as string[];

  // All available tags = existing + any typed but not yet committed
  const allAvailableTags = Array.from(new Set([...existingTags]));

  // ── save mutation ──────────────────────────────────────────────────────────
  const saveReportMutation = trpc.technical.saveReport.useMutation({
    onSuccess: () => {
      const dest = folder ? `${folder} / ${saveAs}` : saveAs;
      toast.success(`Saved → "${dest}"`, {
        description: "View it under Saved Technical Files in the sidebar.",
        duration: 5000,
      });
      onClose();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  // ── build & send payload ───────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!result) return;

    // Decide which results to include
    const indicesToInclude = (() => {
      if (saveAllProject || saveAllTab) return allResults.map((_, i) => i);
      // Use the max of graph/table/aiQuery counts to determine range
      const maxCount = Math.max(
        saveGraph ? graphCount : 0,
        saveTable ? tableCount : 0,
        saveAIQuery ? aiQueryCount : 0
      );
      // Take the most-recent `maxCount` results
      return Array.from({ length: Math.min(maxCount, allResults.length) }, (_, i) =>
        allResults.length - maxCount + i
      ).filter((i) => i >= 0);
    })();

    const title = (folder ? `${folder} / ${saveAs}` : saveAs) || derivedTitle;
    const tagMeasurements = selectedTags.map((t) => `tag:${t}`);

    // Build combined HTML for all selected results
    const sections = indicesToInclude.map((idx) => {
      const r = allResults[idx];
      const tbl =
        r.editedTable ?? r.analysisResults?.results_table ?? [];
      return buildHTML(
        `${title} (${idx + 1}/${allResults.length})`,
        tbl,
        r.analysis
      );
    });

    // Build supplemental
    const extras: string[] = [];
    if (saveTable) {
      indicesToInclude.forEach((idx) => {
        const tbl =
          allResults[idx].editedTable ??
          allResults[idx].analysisResults?.results_table ??
          [];
        if (tbl.length > 0)
          extras.push(`\n\n<!-- CSV_DATA result_${idx + 1}\n${buildCSV(tbl)}\nEND_CSV_DATA -->`);
      });
    }
    if (saveAIQuery) {
      extras.push(
        `\n\n<!-- AI_SCRIPT\n${buildMeta(title, folder, selectedTags, tabName ?? "Unknown Tab", result)}\nEND_AI_SCRIPT -->`
      );
    }

    saveReportMutation.mutate({
      title,
      content: sections.join("\n\n<hr/>\n\n") + extras.join(""),
      dataFiles: [],
      measurements: [
        ...tagMeasurements,
        ...(result.query ? [result.query.slice(0, 80)] : []),
      ],
      generatedAt: new Date().toISOString(),
    });
  }, [
    result,
    allResults,
    saveAs,
    folder,
    selectedTags,
    derivedTitle,
    tabName,
    saveAllProject,
    saveAllTab,
    saveGraph,
    saveTable,
    saveAIQuery,
    graphCount,
    tableCount,
    aiQueryCount,
    saveReportMutation,
  ]);

  if (!open || !result) return null;
  const isSaving = saveReportMutation.isPending;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sam-title"
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#e2e8f0]">
          <div>
            <h2
              id="sam-title"
              className="text-lg font-semibold text-[#0f172a] flex items-center gap-2"
            >
              <Save className="w-4 h-4 text-blue-700 flex-shrink-0" />
              Save to Technical Files
            </h2>
            <p className="text-xs text-[#64748b] mt-0.5">
              Choose what to save from this analysis result.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[65vh]">

          {/* Save As */}
          <div>
            <FieldLabel>Save As</FieldLabel>
            <input
              type="text"
              value={saveAs}
              onChange={(e) => setSaveAs(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-lg text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors"
              aria-label="File name"
            />
          </div>

          {/* Tags */}
          <div ref={tagRef} className="relative">
            <FieldLabel>Tags</FieldLabel>
            <button
              type="button"
              onClick={() => setTagDropOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-[#cbd5e1] rounded-lg bg-white text-left hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors"
            >
              <span className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                <Tag className="w-3.5 h-3.5 text-[#94a3b8] flex-shrink-0" />
                {selectedTags.length === 0 ? (
                  <span className="text-[#94a3b8]">
                    {allAvailableTags.length === 0
                      ? "No tags created yet"
                      : "Add tags…"}
                  </span>
                ) : (
                  selectedTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-[11px] font-medium"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTags((prev) => prev.filter((x) => x !== t));
                        }}
                        className="hover:text-blue-900"
                        aria-label={`Remove tag ${t}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))
                )}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#94a3b8] flex-shrink-0 transition-transform ${tagDropOpen ? "rotate-180" : ""}`}
              />
            </button>

            {tagDropOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-[#e2e8f0] rounded-lg shadow-lg overflow-hidden">
                {/* New tag input */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[#e2e8f0]">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTagInput.trim()) {
                        const t = newTagInput.trim();
                        setSelectedTags((prev) =>
                          prev.includes(t) ? prev : [...prev, t]
                        );
                        setNewTagInput("");
                      }
                    }}
                    placeholder="Type to create tag, press Enter…"
                    className="flex-1 text-xs focus:outline-none text-[#0f172a] placeholder:text-[#94a3b8]"
                    aria-label="New tag"
                  />
                </div>
                {/* Existing tags */}
                {allAvailableTags.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-[#94a3b8]">
                    No existing tags — type above to create one.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto">
                    {allAvailableTags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setSelectedTags((prev) =>
                            prev.includes(t)
                              ? prev.filter((x) => x !== t)
                              : [...prev, t]
                          )
                        }
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 transition-colors text-left"
                      >
                        <span className="text-[#0f172a]">{t}</span>
                        {selectedTags.includes(t) && (
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Where (folder) */}
          <div ref={folderRef} className="relative">
            <FieldLabel>Where</FieldLabel>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFolderDropOpen((v) => !v)}
                className="flex-1 flex items-center justify-between px-3 py-2 text-sm border border-[#cbd5e1] rounded-lg bg-white text-left hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors"
              >
                <span className="flex items-center gap-1.5 text-[#0f172a]">
                  <FolderOpen className="w-3.5 h-3.5 text-[#94a3b8] flex-shrink-0" />
                  {folder || (
                    <span className="text-[#94a3b8]">Root (no folder)</span>
                  )}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#94a3b8] flex-shrink-0 transition-transform ${folderDropOpen ? "rotate-180" : ""}`}
                />
              </button>
              {/* Create new folder button */}
              <button
                type="button"
                onClick={() => {
                  setFolderDropOpen(true);
                  setCreatingFolder(true);
                }}
                title="Create new folder"
                className="w-9 h-9 flex items-center justify-center border border-[#e2e8f0] rounded-lg text-[#64748b] hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors flex-shrink-0"
                aria-label="Create new folder"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {folderDropOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-[#e2e8f0] rounded-lg shadow-lg overflow-hidden">
                {/* New folder input */}
                {creatingFolder && (
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[#e2e8f0] bg-blue-50">
                    <FolderOpen className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={newFolderInput}
                      onChange={(e) => setNewFolderInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newFolderInput.trim()) {
                          setFolder(newFolderInput.trim());
                          setNewFolderInput("");
                          setCreatingFolder(false);
                          setFolderDropOpen(false);
                        }
                        if (e.key === "Escape") {
                          setCreatingFolder(false);
                          setNewFolderInput("");
                        }
                      }}
                      placeholder="New folder name, press Enter…"
                      className="flex-1 text-xs focus:outline-none text-[#0f172a] placeholder:text-[#94a3b8] bg-transparent"
                      aria-label="New folder name"
                    />
                  </div>
                )}
                {/* Root option */}
                <button
                  type="button"
                  onClick={() => { setFolder(""); setFolderDropOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#f8fafc] transition-colors text-left"
                >
                  <span className="text-[#64748b] italic">Root (no folder)</span>
                  {folder === "" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                {/* Existing folders */}
                {existingFolders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setFolder(f); setFolderDropOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-[#0f172a]">
                      <FolderOpen className="w-3.5 h-3.5 text-[#94a3b8]" />
                      {f}
                    </span>
                    {folder === f && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Divider />

          {/* Master toggles */}
          <div className="space-y-0.5">
            <CB
              id="cb-all-project"
              checked={saveAllProject}
              onChange={(v) => { setSaveAllProject(v); if (v) setSaveAllTab(false); }}
              label={<span className="font-medium">Save all data in project</span>}
            />
            <CB
              id="cb-all-tab"
              checked={saveAllTab}
              onChange={(v) => { setSaveAllTab(v); if (v) setSaveAllProject(false); }}
              label={<span className="font-medium">Save all data in tab</span>}
            />
          </div>

          <Divider />

          {/* Granular checkboxes — show current page context */}
          <div className="space-y-0.5">
            <CB
              id="cb-graph"
              checked={saveGraph}
              onChange={setSaveGraph}
              label={
                <span>
                  Save graph{" "}
                  <span className="text-[#94a3b8] text-xs">
                    ({currentPage}/{total})
                  </span>
                </span>
              }
            />
            <CB
              id="cb-table"
              checked={saveTable}
              onChange={setSaveTable}
              label={
                <span>
                  Save table{" "}
                  <span className="text-[#94a3b8] text-xs">
                    ({currentPage}/{total})
                  </span>
                </span>
              }
            />
            <CB
              id="cb-ai"
              checked={saveAIQuery}
              onChange={setSaveAIQuery}
              label={
                <span>
                  Save AI query{" "}
                  <span className="text-[#94a3b8] text-xs">
                    ({currentPage}/{total})
                  </span>
                </span>
              }
            />
          </div>

          <Divider />

          {/* Custom quantity section */}
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">
              Custom — how many to include
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#0f172a]">Save Graphs</span>
                <Counter
                  value={graphCount}
                  max={total || 1}
                  onChange={setGraphCount}
                  disabled={!saveGraph || saveAllProject || saveAllTab}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#0f172a]">Save Tables</span>
                <Counter
                  value={tableCount}
                  max={total || 1}
                  onChange={setTableCount}
                  disabled={!saveTable || saveAllProject || saveAllTab}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#0f172a]">Save AI Queries</span>
                <Counter
                  value={aiQueryCount}
                  max={total || 1}
                  onChange={setAiQueryCount}
                  disabled={!saveAIQuery || saveAllProject || saveAllTab}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !saveAs.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5 text-white" />
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
