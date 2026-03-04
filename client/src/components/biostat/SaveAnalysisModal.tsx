/**
 * SaveAnalysisModal — redesigned "native-style" save dialog
 *
 * Features:
 *  • Save As input (auto-filled, editable)
 *  • Save Format selector (CSV / XLSX / PDF / JSON / SAS / DTA) — REQUIRED
 *  • Tags multi-select (sourced from existing technical files)
 *  • Where folder dropdown (sourced from existing files) + inline new-folder creator
 *  • Master toggles: "Save all in project" / "Save all in tab"
 *  • Granular checkboxes: graph / table / AI query
 *  • Custom quantity steppers
 *  • Generates the file in the chosen format, triggers immediate download,
 *    AND stores a retrievable copy in Technical Files
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Save,
  X,
  ChevronDown,
  Plus,
  FolderOpen,
  Tag,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import type { PanelResult } from "@/stores/aiPanelStore";

// ── types ─────────────────────────────────────────────────────────────────────

type SaveFormat = "csv" | "xlsx" | "pdf" | "json" | "sas" | "dta";

interface FormatOption {
  id: SaveFormat;
  label: string;
  ext: string;
  description: string;
  bg: string;
  textColor: string;
  borderColor: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "csv",
    label: "CSV",
    ext: ".csv",
    description: "Import into R / SAS / Prism",
    bg: "#f0fdf4",
    textColor: "#16a34a",
    borderColor: "#bbf7d0",
  },
  {
    id: "xlsx",
    label: "Excel",
    ext: ".xlsx",
    description: "Multi-sheet workbook",
    bg: "#f0fdf4",
    textColor: "#15803d",
    borderColor: "#86efac",
  },
  {
    id: "pdf",
    label: "PDF",
    ext: ".pdf",
    description: "Publication-ready report",
    bg: "#fef2f2",
    textColor: "#dc2626",
    borderColor: "#fecaca",
  },
  {
    id: "json",
    label: "JSON",
    ext: ".json",
    description: "Structured data / API",
    bg: "#fff7ed",
    textColor: "#ea580c",
    borderColor: "#fed7aa",
  },
  {
    id: "sas",
    label: "SAS",
    ext: ".sas7bdat",
    description: "SAS-compatible CSV",
    bg: "#eff6ff",
    textColor: "#2563eb",
    borderColor: "#bfdbfe",
  },
  {
    id: "dta",
    label: "Stata",
    ext: ".dta",
    description: "Stata-compatible CSV",
    bg: "#faf5ff",
    textColor: "#7c3aed",
    borderColor: "#ddd6fe",
  },
];

// ── export helpers ────────────────────────────────────────────────────────────

function formatValue(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}

/** Plain CSV using PapaParse */
function buildCSVExport(
  title: string,
  table: Array<{ metric: string; value: any }>,
  analysis: string
): string {
  const header = `# ${title}\n# Generated: ${new Date().toLocaleString()} — NuPhorm Biostatistics Platform\n#\n`;
  const body = Papa.unparse({
    fields: ["Metric", "Value"],
    data: table.map((r) => [String(r.metric ?? ""), formatValue(r.value)]),
  });
  const aiSection = `\n\n# AI Interpretation\n# ${analysis.replace(/\n/g, "\n# ")}`;
  return header + body + aiSection;
}

/** SAS / DTA: CSV with compatible headers (uppercase, no special chars) */
function buildSASExport(
  title: string,
  table: Array<{ metric: string; value: any }>,
  analysis: string
): string {
  const safeHeader = `/* ${title} — exported for SAS/Stata compatibility */\n/* Generated: ${new Date().toLocaleString()} */\n\n`;
  const body = Papa.unparse({
    fields: ["METRIC", "VALUE"],
    data: table.map((r) => [
      String(r.metric ?? "")
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 32)
        .toUpperCase(),
      formatValue(r.value),
    ]),
  });
  const note = `\n\n/* AI Interpretation:\n${analysis.replace(/\*\//g, "* /")}\n*/`;
  return safeHeader + body + note;
}

/** Multi-sheet XLSX — returns base64 string */
function buildXLSXExport(
  title: string,
  resultsToSave: PanelResult[],
  tags: string[],
  folder: string
): string {
  const wb = XLSX.utils.book_new();

  // Metadata sheet
  const metaRows = [
    ["Title", title],
    ["Folder", folder || "(root)"],
    ["Tags", tags.join(", ")],
    ["Generated", new Date().toLocaleString()],
    ["Platform", "NuPhorm Biostatistics"],
    ["Result Count", resultsToSave.length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), "Metadata");

  // One sheet per result
  resultsToSave.forEach((r, i) => {
    const tbl = r.editedTable ?? r.analysisResults?.results_table ?? [];
    const rows: any[][] = [
      ["Query", r.query],
      ["Analysis Type", r.analysisResults?.analysis_type ?? ""],
      [],
      ["Metric", "Value"],
      ...tbl.map((row: { metric: any; value: any }) => [
        String(row.metric ?? ""),
        typeof row.value === "number" ? parseFloat(row.value.toFixed(4)) : row.value,
      ]),
      [],
      ["AI Interpretation"],
      [r.analysis],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Widen columns
    ws["!cols"] = [{ wch: 35 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, `Result ${i + 1}`.slice(0, 31));
  });

  return XLSX.write(wb, { bookType: "xlsx", type: "base64" }) as string;
}

/** JSON export */
function buildJSONExport(
  title: string,
  folder: string,
  tags: string[],
  tabName: string,
  resultsToSave: PanelResult[]
): string {
  return JSON.stringify(
    {
      title,
      folder: folder || null,
      tags,
      tabName,
      generatedAt: new Date().toISOString(),
      platform: "NuPhorm Biostatistics",
      results: resultsToSave.map((r) => ({
        query: r.query,
        analysisType: r.analysisResults?.analysis_type ?? null,
        table: (r.editedTable ?? r.analysisResults?.results_table ?? []).map(
          (row: { metric: any; value: any }) => ({ metric: row.metric, value: row.value })
        ),
        analysis: r.analysis,
      })),
    },
    null,
    2
  );
}

/** PDF using jsPDF v4 native drawing (no plugins required) — returns base64 */
function buildPDFExport(title: string, resultsToSave: PanelResult[]): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const pageW = 210;
  const colMetric = margin;
  const colValue = margin + 110;
  let y = 28;

  const checkPage = () => {
    if (y > 272) {
      doc.addPage();
      y = 20;
    }
  };

  // ── Teal header bar
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  (doc as any).setTextColor(255, 255, 255);
  doc.text("NuPhorm Biostatistics Platform", margin, 13);

  // ── Title
  (doc as any).setTextColor(15, 23, 42);
  doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(title, pageW - margin * 2) as string[];
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 3;

  // ── Date line
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  (doc as any).setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 9;

  resultsToSave.forEach((r, ri) => {
    checkPage();
    const tbl = r.editedTable ?? r.analysisResults?.results_table ?? [];

    // Section separator
    if (ri > 0) {
      (doc as any).setDrawColor(226, 232, 240);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }

    // Query header
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    (doc as any).setTextColor(15, 23, 42);
    const qLines = doc.splitTextToSize(
      `${ri + 1}. ${r.query.slice(0, 120)}`,
      pageW - margin * 2
    ) as string[];
    doc.text(qLines, margin, y);
    y += qLines.length * 5 + 4;

    if (tbl.length > 0) {
      // Table header row
      checkPage();
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      (doc as any).setTextColor(51, 65, 85);
      doc.text("Metric", colMetric + 2, y);
      doc.text("Value", colValue + 2, y);
      y += 5;

      // Data rows
      tbl.forEach((row: { metric: any; value: any }, idx: number) => {
        checkPage();
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
        }
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        (doc as any).setTextColor(15, 23, 42);
        const metricStr = String(row.metric ?? "").slice(0, 55);
        const valueStr = formatValue(row.value).slice(0, 28);
        doc.text(metricStr, colMetric + 2, y);
        doc.text(valueStr, colValue + 2, y);
        y += 6.5;
      });
      y += 3;
    }

    // AI Interpretation
    checkPage();
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    (doc as any).setTextColor(20, 184, 166);
    doc.text("AI Interpretation", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    (doc as any).setTextColor(51, 65, 85);
    doc.setFontSize(8.5);
    const analysisLines = doc.splitTextToSize(
      r.analysis.slice(0, 1200),
      pageW - margin * 2
    ) as string[];
    analysisLines.forEach((line) => {
      checkPage();
      doc.text(line, margin, y);
      y += 4.8;
    });
    y += 5;
  });

  // Return raw base64 (strip data URI prefix if present)
  const uri = doc.output("datauristring");
  return uri.includes(",") ? uri.split(",")[1] : uri;
}

/** Browser download trigger */
function triggerDownload(filename: string, data: string, isBinary: boolean, mimeType: string) {
  let blob: Blob;
  if (isBinary) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: mimeType });
  } else {
    blob = new Blob([data], { type: mimeType });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const FORMAT_MIME: Record<SaveFormat, string> = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  json: "application/json",
  sas: "text/csv",
  dta: "text/csv",
};

const FORMAT_EXT: Record<SaveFormat, string> = {
  csv: "csv",
  xlsx: "xlsx",
  pdf: "pdf",
  json: "json",
  sas: "sas7bdat",
  dta: "dta",
};

// ── existing helpers (kept) ────────────────────────────────────────────────────

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function buildCSV(table: Array<{ metric: string; value: any }>): string {
  const rows = [
    ["Metric", "Value"],
    ...table.map((r) => [String(r.metric), String(r.value)]),
  ];
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
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

/** Wrap export data + HTML preview into the storage envelope */
function buildStorageContent(
  format: SaveFormat,
  exportData: string,
  isBinary: boolean,
  htmlPreview: string
): string {
  const formatTag = `<!-- FORMAT: ${format} -->`;
  const dataTag = isBinary
    ? `<!-- EXPORT_DATA_BINARY_START\n${exportData}\nEXPORT_DATA_BINARY_END -->`
    : `<!-- EXPORT_DATA_TEXT_START\n${exportData}\nEXPORT_DATA_TEXT_END -->`;
  return `${formatTag}\n${dataTag}\n\n${htmlPreview}`;
}

// ── small reusable UI pieces ──────────────────────────────────────────────────

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

// ── Toggle switch ─────────────────────────────────────────────────────────────

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  sublabel?: string;
  disabled?: boolean;
  tooltip?: string;
}
function Toggle({ id, checked, onChange, label, sublabel, disabled, tooltip }: ToggleProps) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${disabled ? "opacity-40" : ""}`}
      title={tooltip}
    >
      <div>
        <label
          htmlFor={id}
          className={`text-sm font-medium text-[#0f172a] ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          {label}
        </label>
        {sublabel && (
          <p className="text-[11px] mt-0.5" style={{ color: "#94a3b8" }}>{sublabel}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0D6EFD] focus:ring-offset-1 transition-colors"
        style={{
          width: 40,
          height: 22,
          background: checked ? "#0D6EFD" : "#E5E7EB",
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span
          className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm"
          style={{
            left: checked ? 20 : 3,
            transition: "left 0.15s ease",
          }}
        />
      </button>
    </div>
  );
}

// ── Horizontal slider ─────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}
function Slider({ label, value, min = 1, max, onChange, disabled }: SliderProps) {
  const clampedMax = Math.max(min, max);
  const pct = clampedMax <= min ? 100 : ((value - min) / (clampedMax - min)) * 100;
  return (
    <div className={`space-y-1.5 ${disabled ? "opacity-40" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#0f172a]">{label}</span>
        <span
          className="text-xs tabular-nums font-semibold px-1.5 py-0.5 rounded"
          style={{ color: "#0D6EFD", background: "#EFF6FF" }}
        >
          {value} of {clampedMax}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={clampedMax}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, #00B8A9 ${pct}%, #E5E7EB ${pct}%)`,
          accentColor: "#0D6EFD",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  result: PanelResult | null;
  allResults: PanelResult[];
  activeIndex: number;
  tabName?: string;
  graphTitle?: string;
  allProjectResults: PanelResult[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SaveAnalysisModal({
  open,
  onClose,
  result,
  allResults,
  activeIndex,
  tabName,
  graphTitle,
  allProjectResults,
}: Props) {
  const total = allResults.length;
  const currentPage = activeIndex + 1;
  const projectTotal = allProjectResults.length;

  const derivedTitle = [tabName ?? "Analysis", graphTitle ?? "Results", todayDDMMYYYY()]
    .filter(Boolean)
    .join(" – ");

  // ── state ──────────────────────────────────────────────────────────────────
  const [saveAs, setSaveAs] = useState(derivedTitle);
  const [saveFormat, setSaveFormat] = useState<SaveFormat | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const tagRef = useRef<HTMLDivElement>(null);

  const [folder, setFolder] = useState("");
  const [folderDropOpen, setFolderDropOpen] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);

  const [saveAllProject, setSaveAllProject] = useState(false);
  const [saveAllTab, setSaveAllTab] = useState(false);
  const [saveGraph, setSaveGraph] = useState(true);
  const [saveTable, setSaveTable] = useState(true);
  const [saveAIQuery, setSaveAIQuery] = useState(true);

  const [graphCount, setGraphCount] = useState(currentPage);
  const [tableCount, setTableCount] = useState(currentPage);
  const [aiQueryCount, setAiQueryCount] = useState(currentPage);

  const [includeMetadata, setIncludeMetadata] = useState(true);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSaveAs(derivedTitle);
      setSaveFormat(null);
      setSaveAttempted(false);
      setIsGenerating(false);
      setSelectedTags([]);
      setNewTagInput("");
      setFolder("");
      setSaveAllProject(false);
      setSaveAllTab(false);
      setSaveGraph(true);
      setSaveTable(true);
      setSaveAIQuery(true);
      setIncludeMetadata(true);
      setGraphCount(currentPage);
      setTableCount(currentPage);
      setAiQueryCount(currentPage);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Master toggle side-effects
  useEffect(() => {
    if (saveAllProject) {
      setSaveGraph(true);
      setSaveTable(true);
      setSaveAIQuery(true);
      setGraphCount(projectTotal || 1);
      setTableCount(projectTotal || 1);
      setAiQueryCount(projectTotal || 1);
    } else if (saveAllTab) {
      setSaveGraph(true);
      setSaveTable(true);
      setSaveAIQuery(true);
      setGraphCount(total || 1);
      setTableCount(total || 1);
      setAiQueryCount(total || 1);
    }
  }, [saveAllProject, saveAllTab, total, projectTotal]);

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

  // ── fetch existing files for tags + folders ────────────────────────────────
  const { data: existingFiles = [] } = trpc.technical.getFiles.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });

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

  const existingTags = Array.from(
    new Set(
      (existingFiles as any[]).flatMap((f) =>
        (f.measurements ?? [])
          .filter((m: string) => m.startsWith("tag:"))
          .map((m: string) => m.slice(4))
      )
    )
  ) as string[];

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
    onError: (err) => {
      setIsGenerating(false);
      toast.error(`Save failed: ${err.message}`);
    },
  });

  // ── handle save ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!saveFormat) {
      setSaveAttempted(true);
      return;
    }
    if (!result) return;

    setIsGenerating(true);

    try {
      const resultsToSave = saveAllProject ? allProjectResults : allResults;

      const indicesToInclude = (() => {
        if (saveAllProject || saveAllTab) return resultsToSave.map((_, i) => i);
        const maxCount = Math.max(
          saveGraph ? graphCount : 0,
          saveTable ? tableCount : 0,
          saveAIQuery ? aiQueryCount : 0
        );
        return Array.from({ length: Math.min(maxCount, resultsToSave.length) }, (_, i) =>
          resultsToSave.length - maxCount + i
        ).filter((i) => i >= 0);
      })();

      const title = (folder ? `${folder} / ${saveAs}` : saveAs) || derivedTitle;
      const tagMeasurements = selectedTags.map((t) => `tag:${t}`);
      const selectedResults = indicesToInclude.map((i) => resultsToSave[i]);
      const activeTable =
        result.editedTable ?? result.analysisResults?.results_table ?? [];

      // ── Generate export in chosen format ───────────────────────────────────
      let exportData = "";
      let isBinary = false;

      switch (saveFormat) {
        case "csv":
          exportData = buildCSVExport(saveAs, activeTable, result.analysis);
          isBinary = false;
          break;
        case "sas":
        case "dta":
          exportData = buildSASExport(saveAs, activeTable, result.analysis);
          isBinary = false;
          break;
        case "xlsx":
          exportData = buildXLSXExport(title, selectedResults, selectedTags, folder);
          isBinary = true;
          break;
        case "pdf":
          exportData = buildPDFExport(title, selectedResults);
          isBinary = true;
          break;
        case "json":
          exportData = buildJSONExport(title, folder, selectedTags, tabName ?? "Unknown", selectedResults);
          isBinary = false;
          break;
      }

      // ── Trigger immediate browser download ─────────────────────────────────
      const safeTitle = saveAs.replace(/[\s/\\:*?"<>|]+/g, "_");
      triggerDownload(
        `${safeTitle}.${FORMAT_EXT[saveFormat]}`,
        exportData,
        isBinary,
        FORMAT_MIME[saveFormat]
      );

      // ── Build HTML preview sections (for iframe in Technical Files) ────────
      const htmlSections = indicesToInclude.map((idx) => {
        const r = resultsToSave[idx];
        const tbl = r.editedTable ?? r.analysisResults?.results_table ?? [];
        return buildHTML(title, tbl, r.analysis);
      });
      const htmlPreview = htmlSections.join("\n\n<hr/>\n\n");

      // ── Build storage content ──────────────────────────────────────────────
      const extras: string[] = [];
      if (saveTable) {
        indicesToInclude.forEach((idx) => {
          const tbl =
            resultsToSave[idx].editedTable ??
            resultsToSave[idx].analysisResults?.results_table ??
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
      if (includeMetadata) {
        extras.push(
          `\n\n<!-- METADATA\n${JSON.stringify({
            analysisType: result.analysisResults?.analysis_type ?? null,
            rowCount: (result.editedTable ?? result.analysisResults?.results_table ?? []).length,
            tabName: tabName ?? "Unknown Tab",
            savedAt: new Date().toISOString(),
          }, null, 2)}\nEND_METADATA -->`
        );
      }

      const storageContent =
        buildStorageContent(saveFormat, exportData, isBinary, htmlPreview) +
        extras.join("");

      // ── Store in Technical Files ───────────────────────────────────────────
      const folderTypeMeasurement = saveAllProject ? "foldertype:project" : "foldertype:tab";

      saveReportMutation.mutate({
        title,
        content: storageContent,
        dataFiles: [],
        measurements: [
          folderTypeMeasurement,
          `format:${saveFormat}`,
          ...tagMeasurements,
          ...(result.query ? [result.query.slice(0, 80)] : []),
        ],
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Save failed:", err);
      setIsGenerating(false);
      toast.error("Export failed — check console for details.");
    }
  }, [
    saveFormat,
    result,
    allResults,
    allProjectResults,
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
    includeMetadata,
    graphCount,
    tableCount,
    aiQueryCount,
    saveReportMutation,
  ]);

  if (!open || !result) return null;

  const isBusy = isGenerating || saveReportMutation.isPending;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal — wider than before to fit format grid */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sam-title"
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#e2e8f0]">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "#f0fdfa" }}
            >
              <Save className="w-4.5 h-4.5" style={{ color: "#00B8A9", width: 18, height: 18 }} />
            </div>
            <div>
              <h2
                id="sam-title"
                className="text-lg font-bold"
                style={{ color: "#343A40" }}
              >
                Save to Technical Files
              </h2>
              <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
                Choose what to save from this analysis result
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#6B7280" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#00B8A9")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6B7280")}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {/* ── Save As ─────────────────────────────────────────────────────── */}
          <div>
            <FieldLabel>Save As</FieldLabel>
            <input
              type="text"
              value={saveAs}
              onChange={(e) => setSaveAs(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 transition-colors"
              style={{
                border: "1px solid #DEE2E6",
                color: "#343A40",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#00B8A9")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#DEE2E6")}
              aria-label="File name"
            />
          </div>

          {/* ── Save Format (REQUIRED) ───────────────────────────────────────── */}
          <div>
            <FieldLabel>
              Save Format{" "}
              <span style={{ color: "#FD7E14", fontWeight: 700 }}>*</span>
            </FieldLabel>

            <div className="relative">
              <select
                value={saveFormat ?? ""}
                onChange={(e) => {
                  setSaveFormat((e.target.value as SaveFormat) || null);
                  setSaveAttempted(false);
                }}
                className="w-full appearance-none px-3 py-2.5 pr-9 text-sm rounded-lg focus:outline-none transition-colors"
                style={{
                  border: saveAttempted && !saveFormat
                    ? "1px solid #FD7E14"
                    : "1px solid #DEE2E6",
                  color: saveFormat ? "#343A40" : "#94a3b8",
                  background: "white",
                  boxShadow: saveAttempted && !saveFormat
                    ? "0 0 0 3px rgba(253,126,20,0.12)"
                    : "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#00B8A9")}
                onBlur={(e) => (e.currentTarget.style.borderColor = saveAttempted && !saveFormat ? "#FD7E14" : "#DEE2E6")}
                aria-required="true"
              >
                <option value="" disabled>Choose a format…</option>
                {FORMAT_OPTIONS.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.label} ({fmt.ext}) — {fmt.description}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "#94a3b8" }}
              />
            </div>

            {saveAttempted && !saveFormat && (
              <p
                className="text-xs mt-1.5 flex items-center gap-1"
                style={{ color: "#FD7E14" }}
                role="alert"
              >
                <span aria-hidden>⚠</span> Please select a format before saving
              </p>
            )}

            {saveFormat && (
              <p className="text-xs mt-1.5 pl-0.5" style={{ color: "#6B7280" }}>
                {saveFormat === "csv" && "Precision-formatted rows (4 d.p.) — import into R, SAS, or Prism."}
                {saveFormat === "xlsx" && "Multi-sheet workbook: metadata sheet + one sheet per result."}
                {saveFormat === "pdf" && "Teal-branded report with tabular results and full AI interpretation."}
                {saveFormat === "json" && "Structured JSON payload with full table and analysis — ideal for APIs."}
                {saveFormat === "sas" && "SAS-compatible CSV: uppercase column names, alphanumeric-only metrics."}
                {saveFormat === "dta" && "Stata-compatible CSV with same safe-header rules as SAS."}
              </p>
            )}
          </div>

          <Divider />

          {/* ── Tags ────────────────────────────────────────────────────────── */}
          <div ref={tagRef} className="relative">
            <FieldLabel>Tags</FieldLabel>
            <button
              type="button"
              onClick={() => setTagDropOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg bg-white text-left transition-colors"
              style={{ border: "1px solid #DEE2E6" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00B8A9")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#DEE2E6")}
            >
              <span className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#94a3b8" }} />
                {selectedTags.length === 0 ? (
                  <span style={{ color: "#94a3b8" }}>
                    {allAvailableTags.length === 0 ? "No tags yet" : "Add tags…"}
                  </span>
                ) : (
                  selectedTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{
                        background: "#f5f3ff",
                        border: "1px solid #ddd6fe",
                        color: "#6F42C1",
                      }}
                    >
                      {t}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTags((prev) => prev.filter((x) => x !== t));
                        }}
                        className="hover:opacity-70"
                        aria-label={`Remove tag ${t}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))
                )}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${tagDropOpen ? "rotate-180" : ""}`}
                style={{ color: "#94a3b8" }}
              />
            </button>

            {tagDropOpen && (
              <div
                className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg overflow-hidden"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ borderBottom: "1px solid #e2e8f0" }}
                >
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTagInput.trim()) {
                        const t = newTagInput.trim();
                        setSelectedTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
                        setNewTagInput("");
                      }
                    }}
                    placeholder="Type to create tag, press Enter…"
                    className="flex-1 text-xs focus:outline-none"
                    style={{ color: "#0f172a" }}
                    aria-label="New tag"
                  />
                </div>
                {allAvailableTags.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs" style={{ color: "#94a3b8" }}>
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
                            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                          )
                        }
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors hover:bg-blue-50"
                      >
                        <span style={{ color: "#0f172a" }}>{t}</span>
                        {selectedTags.includes(t) && (
                          <Check className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Where (folder) ──────────────────────────────────────────────── */}
          <div ref={folderRef} className="relative">
            <FieldLabel>Where</FieldLabel>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFolderDropOpen((v) => !v)}
                className="flex-1 flex items-center justify-between px-3 py-2 text-sm rounded-lg bg-white text-left transition-colors"
                style={{ border: "1px solid #DEE2E6" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00B8A9")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#DEE2E6")}
              >
                <span className="flex items-center gap-1.5" style={{ color: "#0f172a" }}>
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#00B8A9" }} />
                  {folder || <span style={{ color: "#94a3b8" }}>Root (no folder)</span>}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${folderDropOpen ? "rotate-180" : ""}`}
                  style={{ color: "#94a3b8" }}
                />
              </button>
              <button
                type="button"
                onClick={() => { setFolderDropOpen(true); setCreatingFolder(true); }}
                title="Create new folder"
                className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
                style={{
                  border: "1px solid #0D6EFD",
                  color: "#0D6EFD",
                  background: "white",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#0D6EFD";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.color = "#0D6EFD";
                }}
                aria-label="Create new folder"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {folderDropOpen && (
              <div
                className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg overflow-hidden"
                style={{ border: "1px solid #e2e8f0" }}
              >
                {creatingFolder && (
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ borderBottom: "1px solid #e2e8f0", background: "#f0fdfa" }}
                  >
                    <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#00B8A9" }} />
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
                      className="flex-1 text-xs focus:outline-none bg-transparent"
                      style={{ color: "#0f172a" }}
                      aria-label="New folder name"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setFolder(""); setFolderDropOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-[#f8fafc] transition-colors"
                >
                  <span className="italic" style={{ color: "#64748b" }}>Root (no folder)</span>
                  {folder === "" && <Check className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />}
                </button>
                {existingFolders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setFolder(f); setFolderDropOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors"
                  >
                    <span className="flex items-center gap-2" style={{ color: "#0f172a" }}>
                      <FolderOpen className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
                      {f}
                    </span>
                    {folder === f && <Check className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Divider />

          {/* ── Master toggles + granular toggles ───────────────────────────── */}
          {(() => {
            const masterLocked = saveAllProject || saveAllTab;
            const counterMax = saveAllProject ? projectTotal || 1 : total || 1;
            return (
              <>
                {/* Master scope toggles */}
                <div
                  className="rounded-lg px-3 py-1 space-y-0"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                  <Toggle
                    id="tgl-all-project"
                    checked={saveAllProject}
                    onChange={(v) => { setSaveAllProject(v); if (v) setSaveAllTab(false); }}
                    label="Save all data in project"
                    sublabel={`Includes all ${projectTotal} result(s) across the project`}
                  />
                  <hr className="border-t border-[#e2e8f0]" />
                  <Toggle
                    id="tgl-all-tab"
                    checked={saveAllTab}
                    onChange={(v) => { setSaveAllTab(v); if (v) setSaveAllProject(false); }}
                    label="Save all data in this tab"
                    sublabel={`Includes all ${total} result(s) in this tab`}
                  />
                </div>

                <Divider />

                {/* Granular content toggles */}
                <div
                  className="rounded-lg px-3 py-1 space-y-0"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                  <Toggle
                    id="tgl-graph"
                    checked={saveGraph}
                    onChange={setSaveGraph}
                    disabled={masterLocked}
                    label="Save graph"
                    tooltip={masterLocked ? "Controlled by master scope toggle above" : undefined}
                  />
                  <hr className="border-t border-[#e2e8f0]" />
                  <Toggle
                    id="tgl-table"
                    checked={saveTable}
                    onChange={setSaveTable}
                    disabled={masterLocked}
                    label="Save table"
                    tooltip={masterLocked ? "Controlled by master scope toggle above" : undefined}
                  />
                  <hr className="border-t border-[#e2e8f0]" />
                  <Toggle
                    id="tgl-ai"
                    checked={saveAIQuery}
                    onChange={setSaveAIQuery}
                    disabled={masterLocked}
                    label="Save AI query"
                    tooltip={masterLocked ? "Controlled by master scope toggle above" : undefined}
                  />
                  <hr className="border-t border-[#e2e8f0]" />
                  <Toggle
                    id="tgl-metadata"
                    checked={includeMetadata}
                    onChange={setIncludeMetadata}
                    label="Include metadata"
                    sublabel="Study context, analysis type, row count"
                  />
                </div>

                <Divider />

                {/* Quantity sliders */}
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide mb-3"
                    style={{ color: "#00B8A9" }}
                  >
                    How many results to include
                  </p>
                  <div className="space-y-4">
                    <Slider
                      label="Graphs"
                      value={graphCount}
                      max={counterMax}
                      onChange={setGraphCount}
                      disabled={!saveGraph || masterLocked}
                    />
                    <Slider
                      label="Tables"
                      value={tableCount}
                      max={counterMax}
                      onChange={setTableCount}
                      disabled={!saveTable || masterLocked}
                    />
                    <Slider
                      label="AI Queries"
                      value={aiQueryCount}
                      max={counterMax}
                      onChange={setAiQueryCount}
                      disabled={!saveAIQuery || masterLocked}
                    />
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <button
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 disabled:opacity-50"
            style={{
              border: "1px solid #DEE2E6",
              background: "white",
              color: "#6B7280",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#00B8A9";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.borderColor = "#00B8A9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.color = "#6B7280";
              e.currentTarget.style.borderColor = "#DEE2E6";
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isBusy || !saveAs.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: saveFormat ? "#0D6EFD" : "#94a3b8",
              cursor: saveFormat ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (saveFormat && !isBusy) e.currentTarget.style.background = "#0b5ed7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = saveFormat ? "#0D6EFD" : "#94a3b8";
            }}
            title={!saveFormat ? "Select a format first" : undefined}
          >
            {isBusy ? (
              <>
                <svg
                  className="animate-spin w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
