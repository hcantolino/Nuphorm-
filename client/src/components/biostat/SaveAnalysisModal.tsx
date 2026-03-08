/**
 * SaveAnalysisModal — redesigned "native-style" save dialog
 *
 * Features:
 *  • Save As input (auto-filled, editable)
 *  • Save Format selector (CSV / XLSX / PDF / JSON / SAS / DTA) — REQUIRED
 *  • Tags multi-select (sourced from existing technical files)
 *  • Where folder dropdown (sourced from existing files) + inline new-folder creator
 *  • Dynamic "Tabs to Include" section — one collapsible row per tab
 *  • Per-item chip selection: graphs, tables, queries
 *  • Include All Tabs master button
 *  • Live summary footer
 *  • Generates the file in the chosen format, triggers immediate download,
 *    AND stores a retrievable copy in Technical Files
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Draggable from "react-draggable";
import {
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  FolderOpen,
  Tag,
  Check,
  GripHorizontal,
  BarChart2,
  Table2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import html2canvas from "html2canvas";
import type { PanelResult } from "@/stores/aiPanelStore";
import type { Tab } from "@/stores/tabStore";

/**
 * Capture a chart from the live DOM by result ID.
 * Returns a base64 PNG data URL, or null if no chart element is found.
 */
async function captureChartImage(resultId: string): Promise<string | null> {
  const el = document.querySelector<HTMLElement>(`[data-chart-capture="${resultId}"]`);
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("[SaveAnalysisModal] Chart capture failed:", err);
    return null;
  }
}

/**
 * Pre-capture chart images for a batch of results.
 * Returns a map of resultId → base64 PNG data URL.
 */
async function captureChartImages(results: PanelResult[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const r of results) {
    if (r.analysisResults?.chart_data && r.id) {
      const img = await captureChartImage(r.id);
      if (img) map[r.id] = img;
    }
  }
  return map;
}

// ── types ─────────────────────────────────────────────────────────────────────

type SaveFormat = "csv" | "xlsx" | "pdf" | "png" | "json" | "sas" | "dta";

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
    id: "png",
    label: "PNG",
    ext: ".png",
    description: "Image export of chart",
    bg: "#faf5ff",
    textColor: "#7c3aed",
    borderColor: "#e9d5ff",
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
    textColor: "#3b82f6",
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
function buildPDFExport(
  title: string,
  resultsToSave: PanelResult[],
  chartImages: Record<string, string> = {}
): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const pageW = 210;
  const contentW = pageW - margin * 2;
  const colMetric = margin;
  const colValue = margin + 110;
  let y = 28;

  const checkPage = (needed = 0) => {
    if (y + needed > 272) {
      doc.addPage();
      y = 20;
    }
  };

  // ── Teal header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  (doc as any).setTextColor(255, 255, 255);
  doc.text("NuPhorm Biostatistics Platform", margin, 13);

  // ── Title
  (doc as any).setTextColor(15, 23, 42);
  doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(title, contentW) as string[];
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
      contentW
    ) as string[];
    doc.text(qLines, margin, y);
    y += qLines.length * 5 + 4;

    // ── Chart image (above the stats table)
    const chartImg = r.id ? chartImages[r.id] : undefined;
    if (chartImg) {
      const imgW = contentW;
      const imgH = imgW * 0.55; // ~16:9 aspect ratio
      checkPage(imgH + 4);
      try {
        doc.addImage(chartImg, "PNG", margin, y, imgW, imgH);
        y += imgH + 4;
      } catch (imgErr) {
        console.warn("[buildPDFExport] addImage failed:", imgErr);
      }
    }

    if (tbl.length > 0) {
      // Table header row
      checkPage();
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y - 4, contentW, 7, "F");
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
          doc.rect(margin, y - 4, contentW, 7, "F");
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
    (doc as any).setTextColor(37, 99, 235);
    doc.text("AI Interpretation", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    (doc as any).setTextColor(51, 65, 85);
    doc.setFontSize(8.5);
    const analysisLines = doc.splitTextToSize(
      r.analysis.slice(0, 1200),
      contentW
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

/** Build a single-result PDF (graph OR table OR query) — returns base64 */
function buildSingleResultPDF(
  resultTitle: string,
  itemType: "Graph" | "Table" | "Query",
  r: PanelResult,
  chartImages: Record<string, string> = {}
): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const pageW = 210;
  const contentW = pageW - margin * 2;
  let y = 28;

  const checkPage = (needed = 0) => { if (y + needed > 272) { doc.addPage(); y = 20; } };

  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  (doc as any).setTextColor(255, 255, 255);
  doc.text("NuPhorm Biostatistics Platform", margin, 13);

  // Title
  (doc as any).setTextColor(15, 23, 42);
  doc.setFontSize(13);
  const titleLines = doc.splitTextToSize(resultTitle, contentW) as string[];
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6 + 3;

  // Item type badge
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  (doc as any).setTextColor(100, 116, 139);
  doc.text(`Type: ${itemType}  |  Generated: ${new Date().toLocaleDateString("en-US")}`, margin, y);
  y += 8;

  // Query
  if (r.query) {
    checkPage();
    doc.setFont("helvetica", "bold");
    (doc as any).setTextColor(15, 23, 42);
    doc.setFontSize(10);
    const qLines = doc.splitTextToSize(`Query: ${r.query.slice(0, 200)}`, contentW) as string[];
    doc.text(qLines, margin, y);
    y += qLines.length * 5 + 4;
  }

  // ── Chart image (above the stats table)
  const chartImg = r.id ? chartImages[r.id] : undefined;
  if (chartImg && (itemType === "Graph" || itemType === "Table")) {
    const imgW = contentW;
    const imgH = imgW * 0.55;
    checkPage(imgH + 4);
    try {
      doc.addImage(chartImg, "PNG", margin, y, imgW, imgH);
      y += imgH + 4;
    } catch (imgErr) {
      console.warn("[buildSingleResultPDF] addImage failed:", imgErr);
    }
  }

  const tbl = r.editedTable ?? r.analysisResults?.results_table ?? [];

  // Table data (for Table and Graph items)
  if ((itemType === "Table" || itemType === "Graph") && tbl.length > 0) {
    checkPage();
    const colMetric = margin;
    const colValue = margin + 110;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, contentW, 7, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    (doc as any).setTextColor(51, 65, 85);
    doc.text("Metric", colMetric + 2, y);
    doc.text("Value", colValue + 2, y);
    y += 5;

    tbl.forEach((row: { metric: any; value: any }, idx: number) => {
      checkPage();
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 4, contentW, 7, "F");
      }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      (doc as any).setTextColor(15, 23, 42);
      doc.text(String(row.metric ?? "").slice(0, 55), colMetric + 2, y);
      doc.text(formatValue(row.value).slice(0, 28), colValue + 2, y);
      y += 6.5;
    });
    y += 3;
  }

  // AI Interpretation
  if (r.analysis) {
    checkPage();
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    (doc as any).setTextColor(37, 99, 235);
    doc.text("AI Interpretation", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    (doc as any).setTextColor(51, 65, 85);
    doc.setFontSize(8.5);
    const aLines = doc.splitTextToSize(r.analysis.slice(0, 1200), pageW - margin * 2) as string[];
    aLines.forEach((line) => { checkPage(); doc.text(line, margin, y); y += 4.8; });
  }

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
  png: "image/png",
  json: "application/json",
  sas: "text/csv",
  dta: "text/csv",
};

const FORMAT_EXT: Record<SaveFormat, string> = {
  csv: "csv",
  xlsx: "xlsx",
  pdf: "pdf",
  png: "png",
  json: "json",
  sas: "sas7bdat",
  dta: "dta",
};

// ── existing helpers (kept) ────────────────────────────────────────────────────

/** Returns today's date as MM/DD/YYYY — used in filenames and titles */
function todayMMDDYYYY(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
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

/**
 * Capture the active chart from the DOM as a 2x PNG with title + watermark.
 * Returns a base64-encoded PNG string (no data URI prefix).
 */
async function captureChartAsPNG(
  resultId: string,
  chartTitle: string
): Promise<string> {
  // Find the chart container in the DOM by data attribute
  const chartEl = document.querySelector(
    `[data-chart-export="${resultId}"]`
  ) as HTMLElement | null;
  if (!chartEl) throw new Error("Chart element not found in DOM");

  // Create a temporary wrapper with white background, title, and watermark
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:fixed;left:-9999px;top:0;background:#fff;padding:32px 24px 20px;font-family:system-ui,-apple-system,sans-serif;";

  // Title
  const titleEl = document.createElement("div");
  titleEl.style.cssText = "font-size:16px;font-weight:600;color:#1f2937;margin-bottom:16px;text-align:center;";
  titleEl.textContent = chartTitle;
  wrapper.appendChild(titleEl);

  // Clone chart content
  const clone = chartEl.cloneNode(true) as HTMLElement;
  clone.style.cssText = "background:#fff;";
  wrapper.appendChild(clone);

  // Watermark
  const watermark = document.createElement("div");
  watermark.style.cssText = "font-size:10px;color:#9ca3af;text-align:center;margin-top:12px;";
  watermark.textContent = "Generated by NuPhorm Biostatistics Platform";
  wrapper.appendChild(watermark);

  document.body.appendChild(wrapper);

  try {
    const dataUrl = await toPng(wrapper, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    // Strip the data URI prefix → return raw base64
    return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  } finally {
    document.body.removeChild(wrapper);
  }
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

// ── Per-result item categorisation ────────────────────────────────────────────

/** Unique key for a selectable item across all tabs */
type ItemKey = string; // `${tabId}::${category}::${resultId}`

interface TabItemInfo {
  tabId: string;
  tabTitle: string;
  graphs: PanelResult[];  // results that have chart_data
  tables: PanelResult[];  // results that have results_table
  queries: PanelResult[]; // all results (every result has a query)
}

function categoriseTabResults(
  tabs: Tab[],
  resultsByTab: Record<string, PanelResult[]>
): TabItemInfo[] {
  return tabs.map((tab) => {
    const results = resultsByTab[tab.id] ?? [];
    return {
      tabId: tab.id,
      tabTitle: tab.title,
      graphs: results.filter((r) => {
        // Explicit LLM-generated chart
        if (r.analysisResults?.chart_data) return true;
        // Auto-chart: no chart_data but results_table has ≥2 numeric rows
        const table = r.editedTable ?? r.analysisResults?.results_table;
        if (!Array.isArray(table) || table.length < 2) return false;
        return table.filter((row: any) => row.value !== "" && !isNaN(Number(row.value))).length >= 2;
      }),
      tables: results.filter(
        (r) =>
          (r.editedTable && r.editedTable.length > 0) ||
          (r.analysisResults?.results_table && r.analysisResults.results_table.length > 0)
      ),
      queries: results,
    };
  });
}

function makeKey(tabId: string, category: string, resultId: string): ItemKey {
  return `${tabId}::${category}::${resultId}`;
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
  /** All tabs in the project (from useTabStore) */
  tabs: Tab[];
  /** Per-tab results map (from useAIPanelStore) */
  resultsByTab: Record<string, PanelResult[]>;
  /** Active project name — auto-creates project subfolder */
  projectName?: string;
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
  tabs,
  resultsByTab,
  projectName,
}: Props) {
  const derivedTitle = [tabName ?? "Analysis", graphTitle ?? "Results", todayMMDDYYYY()]
    .filter(Boolean)
    .join(" – ");

  // ── Categorise results per tab ────────────────────────────────────────────
  const tabItems = useMemo(
    () => categoriseTabResults(tabs, resultsByTab),
    [tabs, resultsByTab]
  );

  // Build the set of ALL possible item keys across every tab
  const allItemKeys = useMemo(() => {
    const keys = new Set<ItemKey>();
    for (const ti of tabItems) {
      for (const r of ti.graphs) keys.add(makeKey(ti.tabId, "graph", r.id));
      for (const r of ti.tables) keys.add(makeKey(ti.tabId, "table", r.id));
      for (const r of ti.queries) keys.add(makeKey(ti.tabId, "query", r.id));
    }
    return keys;
  }, [tabItems]);

  // Check if any chart/graph results exist (for PNG availability)
  const hasAnyCharts = useMemo(
    () => tabItems.some(ti => ti.graphs.length > 0),
    [tabItems]
  );

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

  const [includeMetadata, setIncludeMetadata] = useState(true);

  // ── Tabs to Include — item selection state ────────────────────────────────
  const [selectedItems, setSelectedItems] = useState<Set<ItemKey>>(new Set());
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());

  // Derived selection counts
  const selectionSummary = useMemo(() => {
    let graphs = 0, tables = 0, queries = 0;
    const tabsWithSelection = new Set<string>();
    Array.from(selectedItems).forEach((key) => {
      const [tabId, category] = key.split("::");
      tabsWithSelection.add(tabId);
      if (category === "graph") graphs++;
      else if (category === "table") tables++;
      else if (category === "query") queries++;
    });
    return { graphs, tables, queries, tabCount: tabsWithSelection.size };
  }, [selectedItems]);

  const isAllSelected = allItemKeys.size > 0 && allItemKeys.size === selectedItems.size
    && Array.from(allItemKeys).every((k) => selectedItems.has(k));

  // Toggle a single item
  const toggleItem = useCallback((key: ItemKey) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Select / deselect all items in a single tab
  const toggleTabAll = useCallback((ti: TabItemInfo, forceSelect?: boolean) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      const tabKeys: ItemKey[] = [
        ...ti.graphs.map((r) => makeKey(ti.tabId, "graph", r.id)),
        ...ti.tables.map((r) => makeKey(ti.tabId, "table", r.id)),
        ...ti.queries.map((r) => makeKey(ti.tabId, "query", r.id)),
      ];
      const allSelected = forceSelect !== undefined
        ? !forceSelect
        : tabKeys.every((k) => next.has(k));
      if (allSelected) {
        for (const k of tabKeys) next.delete(k);
      } else {
        for (const k of tabKeys) next.add(k);
      }
      return next;
    });
  }, []);

  // Include All Tabs
  const toggleIncludeAll = useCallback(() => {
    setSelectedItems((prev) => {
      if (prev.size === allItemKeys.size && Array.from(allItemKeys).every((k) => prev.has(k))) {
        return new Set<ItemKey>();
      }
      return new Set(allItemKeys);
    });
  }, [allItemKeys]);

  // Toggle expanded state for a tab row
  const toggleExpanded = useCallback((tabId: string) => {
    setExpandedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId); else next.add(tabId);
      return next;
    });
  }, []);

  // ── floating panel drag / resize ──────────────────────────────────────────
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [savePanelWidth, setSavePanelWidth] = useState(600);
  const [savePanelHeight, setSavePanelHeight] = useState<number | null>(null);

  type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  const resizeRef = useRef<{
    dir: ResizeDir;
    startX: number; startY: number;
    startW: number; startH: number;
    startPosX: number; startPosY: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { dir, startX, startY, startW, startH, startPosX, startPosY } = resizeRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const maxH = window.innerHeight * 0.92;
      const goesN = dir === "n" || dir === "ne" || dir === "nw";
      const goesS = dir === "s" || dir === "se" || dir === "sw";
      const goesE = dir === "e" || dir === "ne" || dir === "se";
      const goesW = dir === "w" || dir === "nw" || dir === "sw";
      let nW = startW, nH = startH, nX = startPosX, nY = startPosY;
      if (goesE) nW = Math.max(280, Math.min(800, startW + dx));
      if (goesW) { nW = Math.max(280, Math.min(800, startW - dx)); nX = startPosX + (startW - nW); }
      if (goesS) nH = Math.max(300, Math.min(maxH, startH + dy));
      if (goesN) { nH = Math.max(300, Math.min(maxH, startH - dy)); nY = startPosY + (startH - nH); }
      setSavePanelWidth(nW);
      setSavePanelHeight(nH);
      if (goesW || goesN) setDragPos({ x: nX, y: nY });
    };
    const onUp = () => { resizeRef.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  const startResize = useCallback(
    (dir: ResizeDir, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        dir, startX: e.clientX, startY: e.clientY,
        startW: savePanelWidth,
        startH: savePanelHeight ?? panelRef.current?.offsetHeight ?? 500,
        startPosX: dragPos.x, startPosY: dragPos.y,
      };
    },
    [savePanelWidth, savePanelHeight, dragPos]
  );

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
      setIncludeMetadata(true);
      setSelectedItems(new Set());
      setExpandedTabs(new Set());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
    onError: (err) => {
      setIsGenerating(false);
      toast.error(`Save failed: ${err.message}`);
    },
  });

  // ── handle save ────────────────────────────────────────────────────────────
  //
  // NEW FOLDER HIERARCHY:
  //   [folder] / [projectName] / [tabName] / Full Results.pdf   (always)
  //   [folder] / [projectName] / [tabName] / [individual files or subfolders]
  //
  // Subfolders (Graphs/, Tables/, Queries/) only created when >2 items of that type.
  // Otherwise individual files sit directly in the tab folder.
  //
  const handleSave = useCallback(async () => {
    if (!saveFormat) {
      setSaveAttempted(true);
      return;
    }
    if (!result) return;

    setIsGenerating(true);

    try {
      const dateStr = new Date().toLocaleDateString("en-US", {
        month: "2-digit", day: "2-digit", year: "numeric",
      });
      const tagMeasurements = selectedTags.map((t) => `tag:${t}`);
      const projFolder = projectName || "Untitled Project";

      // Build base path: [user-chosen folder] / [project] or just [project]
      const basePath = folder ? `${folder} / ${projFolder}` : projFolder;

      // ── Collect selected items per tab ──────────────────────────────────────
      type PerTabSelection = {
        ti: TabItemInfo;
        graphs: PanelResult[];
        tables: PanelResult[];
        queries: PanelResult[];
        allResults: PanelResult[];
      };

      const perTab: PerTabSelection[] = [];

      for (const ti of tabItems) {
        const graphs = ti.graphs.filter((r) =>
          selectedItems.has(makeKey(ti.tabId, "graph", r.id))
        );
        const tables = ti.tables.filter((r) =>
          selectedItems.has(makeKey(ti.tabId, "table", r.id))
        );
        const queries = ti.queries.filter((r) =>
          selectedItems.has(makeKey(ti.tabId, "query", r.id))
        );

        // Collect unique results for this tab
        const seenIds = new Set<string>();
        const allTabResults: PanelResult[] = [];
        for (const r of [...graphs, ...tables, ...queries]) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            allTabResults.push(r);
          }
        }

        if (allTabResults.length > 0) {
          perTab.push({ ti, graphs, tables, queries, allResults: allTabResults });
        }
      }

      if (perTab.length === 0) {
        toast.error("No items selected — select at least one graph, table, or query.");
        setIsGenerating(false);
        return;
      }

      // ── Helper: save a single file to Technical Files ───────────────────────
      const saveFile = (filePath: string, content: string, extraMeasurements: string[] = []) => {
        saveReportMutation.mutate({
          title: filePath,
          content,
          dataFiles: [],
          measurements: [
            "foldertype:tab",
            `format:${saveFormat}`,
            ...tagMeasurements,
            ...extraMeasurements,
          ],
          generatedAt: new Date().toISOString(),
        });
      };

      // ── Helper: safe filename ───────────────────────────────────────────────
      const safe = (s: string) => s.replace(/[\s/\\:*?"<>|]+/g, "_").slice(0, 60);

      // ── Helper: build filename for individual items ─────────────────────────
      const itemFilename = (tabTitle: string, resultTitle: string, type: string) =>
        `${safe(tabTitle)} – ${safe(resultTitle)} – ${type} – ${dateStr}.pdf`;

      // ── PNG export: chart images only ─────────────────────────────────────
      if (saveFormat === "png") {
        let pngCount = 0;
        let firstDownloaded = false;
        for (const { ti, graphs } of perTab) {
          const tabPath = `${basePath} / ${ti.tabTitle}`;
          for (let idx = 0; idx < graphs.length; idx++) {
            const r = graphs[idx];
            const rTitle = r.graphTitle || r.query?.slice(0, 40) || `Chart ${idx + 1}`;
            try {
              const pngBase64 = await captureChartAsPNG(r.id, rTitle);
              const fileName = `${tabPath} / ${safe(ti.tabTitle)} – ${safe(rTitle)} – ${dateStr}.png`;
              const htmlPreview = `<p style="text-align:center;color:#6B7280;font-size:13px;">PNG chart image — open the downloaded file to view.</p>`;
              const content = buildStorageContent("png", pngBase64, true, htmlPreview);
              saveFile(fileName, content, ["filetype:graph", "filetype:png"]);
              if (!firstDownloaded) {
                triggerDownload(
                  `${safe(ti.tabTitle)}_${safe(rTitle)}.png`,
                  pngBase64,
                  true,
                  "image/png"
                );
                firstDownloaded = true;
              }
              pngCount++;
            } catch (err) {
              console.warn(`[PNG] Failed to capture chart "${rTitle}":`, err);
              toast.error(`Could not export "${rTitle}" as PNG`);
            }
          }
        }
        if (pngCount === 0) {
          toast.error("No charts could be exported as PNG");
          setIsGenerating(false);
          return;
        }
        toast.success(`Saved ${pngCount} PNG chart${pngCount !== 1 ? "s" : ""} → "${basePath}"`, {
          description: "View under Saved Technical Files.",
          duration: 5000,
        });
        onClose();
        return;
      }

      // Track first download (only trigger browser download for the first combined PDF)
      let firstDownloadDone = false;

      // ── Pre-capture chart images from the live DOM ──────────────────────────
      const allSelectedResults = perTab.flatMap((pt) => pt.allResults);
      const chartImages = await captureChartImages(allSelectedResults);
      console.log(`[SaveAnalysisModal] Captured ${Object.keys(chartImages).length} chart image(s) for PDF`);

      // ── Process each tab ────────────────────────────────────────────────────
      for (const { ti, graphs, tables, queries, allResults: tabAllResults } of perTab) {
        const tabPath = `${basePath} / ${ti.tabTitle}`;

        // 1. ALWAYS: Combined "Full Results" PDF for this tab
        const fullResultsPDF = buildPDFExport(
          `${ti.tabTitle} – Full Results`,
          tabAllResults,
          chartImages
        );
        const fullResultsHTML = tabAllResults
          .map((r) => buildHTML(
            `${ti.tabTitle} – Full Results`,
            r.editedTable ?? r.analysisResults?.results_table ?? [],
            r.analysis
          ))
          .join("\n\n<hr/>\n\n");

        const fullResultsContent = buildStorageContent(
          "pdf", fullResultsPDF, true, fullResultsHTML
        );
        saveFile(
          `${tabPath} / ${safe(ti.tabTitle)} – Full Results.pdf`,
          fullResultsContent,
          ["filetype:full-results"]
        );

        // Trigger browser download for the first tab's full results
        if (!firstDownloadDone) {
          triggerDownload(
            `${safe(ti.tabTitle)}_Full_Results.pdf`,
            fullResultsPDF,
            true,
            "application/pdf"
          );
          firstDownloadDone = true;
        }

        // 2. Individual Graph files
        if (graphs.length > 0) {
          const useSubfolder = graphs.length > 2;
          graphs.forEach((r, idx) => {
            const rTitle = r.graphTitle || r.query?.slice(0, 40) || `Graph ${idx + 1}`;
            const pdf = buildSingleResultPDF(rTitle, "Graph", r, chartImages);
            const html = buildHTML(rTitle, r.editedTable ?? r.analysisResults?.results_table ?? [], r.analysis);
            const content = buildStorageContent("pdf", pdf, true, html);
            const fileName = useSubfolder
              ? `${tabPath} / Graphs / Graph ${idx + 1} – ${safe(rTitle)}.pdf`
              : `${tabPath} / ${itemFilename(ti.tabTitle, rTitle, "Graph")}`;
            saveFile(fileName, content, ["filetype:graph"]);
          });
        }

        // 3. Individual Table files
        if (tables.length > 0) {
          const useSubfolder = tables.length > 2;
          tables.forEach((r, idx) => {
            const rTitle = r.graphTitle || r.query?.slice(0, 40) || `Table ${idx + 1}`;
            const pdf = buildSingleResultPDF(rTitle, "Table", r, chartImages);
            const html = buildHTML(rTitle, r.editedTable ?? r.analysisResults?.results_table ?? [], r.analysis);
            const content = buildStorageContent("pdf", pdf, true, html);
            const fileName = useSubfolder
              ? `${tabPath} / Tables / Table ${idx + 1} – ${safe(rTitle)}.pdf`
              : `${tabPath} / ${itemFilename(ti.tabTitle, rTitle, "Table")}`;
            saveFile(fileName, content, ["filetype:table"]);
          });
        }

        // 4. Individual Query files
        if (queries.length > 0) {
          const useSubfolder = queries.length > 2;
          queries.forEach((r, idx) => {
            const rTitle = r.query?.slice(0, 40) || `Query ${idx + 1}`;
            const pdf = buildSingleResultPDF(rTitle, "Query", r);
            const html = buildHTML(rTitle, r.editedTable ?? r.analysisResults?.results_table ?? [], r.analysis);
            const content = buildStorageContent("pdf", pdf, true, html);
            const fileName = useSubfolder
              ? `${tabPath} / Queries / Query ${idx + 1} – ${safe(rTitle)}.pdf`
              : `${tabPath} / ${itemFilename(ti.tabTitle, rTitle, "Query")}`;
            saveFile(fileName, content, ["filetype:query"]);
          });
        }
      }

      // Summary toast
      const totalFiles = perTab.reduce(
        (sum, { graphs, tables, queries }) => sum + 1 + graphs.length + tables.length + queries.length,
        0
      );
      toast.success(`Saved ${totalFiles} files → "${basePath}"`, {
        description: `${perTab.length} tab(s) saved. View under Saved Technical Files.`,
        duration: 5000,
      });
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      setIsGenerating(false);
      toast.error("Export failed — check console for details.");
    }
  }, [
    saveFormat,
    result,
    tabItems,
    resultsByTab,
    selectedItems,
    saveAs,
    folder,
    selectedTags,
    projectName,
    includeMetadata,
    saveReportMutation,
    onClose,
  ]);

  if (!open || !result) return null;

  const isBusy = isGenerating || saveReportMutation.isPending;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Draggable nodeRef={panelRef} handle=".save-drag-handle" position={dragPos} onDrag={(_, data) => setDragPos({ x: data.x, y: data.y })}>
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby="sam-title"
        className="fixed z-[200] top-16 right-8 bg-white border border-[#e5e7eb] rounded-xl flex flex-col"
        style={{
          width: savePanelWidth,
          height: savePanelHeight ?? "auto",
          maxHeight: savePanelHeight ? "none" : "85vh",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* ── Header / drag handle ──────────────────────────────────────────── */}
        <div className="save-drag-handle flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#e5e7eb] bg-[#f8fafc] rounded-t-xl cursor-grab active:cursor-grabbing select-none">
          <div className="flex items-center gap-2.5">
            <GripHorizontal className="w-4 h-4 text-[#94a3b8]" />
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#EFF6FF" }}
            >
              <Save className="w-4 h-4" style={{ color: "#2563eb" }} />
            </div>
            <div>
              <h2
                id="sam-title"
                className="text-sm font-semibold"
                style={{ color: "#0f172a" }}
              >
                Save to Technical Files
              </h2>
              <p className="text-[11px]" style={{ color: "#6B7280" }}>
                Choose what to save from this analysis result
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#94a3b8] hover:text-[#0f172a] transition-colors"
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
              onFocus={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
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
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
                onBlur={(e) => (e.currentTarget.style.borderColor = saveAttempted && !saveFormat ? "#FD7E14" : "#DEE2E6")}
                aria-required="true"
              >
                <option value="" disabled>Choose a format…</option>
                {FORMAT_OPTIONS.map((fmt) => {
                  const pngDisabled = fmt.id === "png" && !hasAnyCharts;
                  return (
                    <option
                      key={fmt.id}
                      value={fmt.id}
                      disabled={pngDisabled}
                      title={pngDisabled ? "PNG export requires a chart — this result contains tables only" : undefined}
                    >
                      {fmt.label} ({fmt.ext}) — {fmt.description}{pngDisabled ? " (no charts)" : ""}
                    </option>
                  );
                })}
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
                {saveFormat === "png" && "2x retina chart image — suitable for publications and presentations."}
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
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
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
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#DEE2E6")}
              >
                <span className="flex items-center gap-1.5" style={{ color: "#0f172a" }}>
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#2563eb" }} />
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
                    style={{ borderBottom: "1px solid #e2e8f0", background: "#EFF6FF" }}
                  >
                    <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#2563eb" }} />
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

          {/* ── Tabs to Include ────────────────────────────────────────────── */}
          <div>
            <FieldLabel>Tabs to Include</FieldLabel>

            {/* Include All Tabs button */}
            <button
              type="button"
              onClick={toggleIncludeAll}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors mb-3"
              style={{
                background: isAllSelected ? "#2563eb" : "white",
                color: isAllSelected ? "white" : "#2563eb",
                border: `1px solid ${isAllSelected ? "#2563eb" : "#2563eb"}`,
              }}
            >
              {isAllSelected && <Check className="w-3.5 h-3.5" />}
              Include All Tabs
            </button>

            {/* Per-tab collapsible rows */}
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid #e2e8f0" }}
            >
              {tabItems.length === 0 && (
                <p className="px-3 py-4 text-xs text-center" style={{ color: "#94a3b8" }}>
                  No tabs in this project yet.
                </p>
              )}
              {tabItems.map((ti, tabIdx) => {
                const isExpanded = expandedTabs.has(ti.tabId);
                const tabKeys = [
                  ...ti.graphs.map((r) => makeKey(ti.tabId, "graph", r.id)),
                  ...ti.tables.map((r) => makeKey(ti.tabId, "table", r.id)),
                  ...ti.queries.map((r) => makeKey(ti.tabId, "query", r.id)),
                ];
                const tabAllSelected = tabKeys.length > 0 && tabKeys.every((k) => selectedItems.has(k));
                const tabSomeSelected = tabKeys.some((k) => selectedItems.has(k));
                const itemTotal = tabKeys.length;

                return (
                  <div key={ti.tabId}>
                    {tabIdx > 0 && <hr className="border-t border-[#e2e8f0]" />}

                    {/* Tab header row */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors hover:bg-[#f8fafc]"
                      onClick={() => toggleExpanded(ti.tabId)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#64748b" }} />
                          : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#64748b" }} />
                        }
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: tabSomeSelected ? "#0f172a" : "#64748b" }}
                        >
                          {ti.tabTitle}
                        </span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: tabSomeSelected ? "#EFF6FF" : "#f1f5f9",
                            color: tabSomeSelected ? "#2563eb" : "#94a3b8",
                          }}
                        >
                          {itemTotal}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTabAll(ti);
                        }}
                        className="text-[11px] font-medium transition-colors flex-shrink-0 ml-2"
                        style={{ color: tabAllSelected ? "#dc2626" : "#2563eb" }}
                      >
                        {tabAllSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    {/* Expanded content: Graphs, Tables, Queries */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2.5" style={{ background: "#f8fafc" }}>
                        {/* Graphs */}
                        {ti.graphs.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <BarChart2 className="w-3 h-3" style={{ color: "#2563eb" }} />
                              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#2563eb" }}>
                                Graphs ({ti.graphs.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {ti.graphs.map((r) => {
                                const key = makeKey(ti.tabId, "graph", r.id);
                                const sel = selectedItems.has(key);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleItem(key)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                                    style={{
                                      background: sel ? "#2563eb" : "white",
                                      color: sel ? "white" : "#334155",
                                      border: `1px solid ${sel ? "#2563eb" : "#e5e7eb"}`,
                                    }}
                                    title={r.graphTitle || r.query.slice(0, 60)}
                                  >
                                    {sel && <Check className="w-2.5 h-2.5" />}
                                    {(r.graphTitle || r.query).slice(0, 28)}
                                    {(r.graphTitle || r.query).length > 28 ? "…" : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tables */}
                        {ti.tables.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Table2 className="w-3 h-3" style={{ color: "#2563eb" }} />
                              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#2563eb" }}>
                                Tables ({ti.tables.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {ti.tables.map((r) => {
                                const key = makeKey(ti.tabId, "table", r.id);
                                const sel = selectedItems.has(key);
                                const rowCount = (r.editedTable ?? r.analysisResults?.results_table ?? []).length;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleItem(key)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                                    style={{
                                      background: sel ? "#2563eb" : "white",
                                      color: sel ? "white" : "#334155",
                                      border: `1px solid ${sel ? "#2563eb" : "#e5e7eb"}`,
                                    }}
                                    title={`${r.query.slice(0, 60)} (${rowCount} rows)`}
                                  >
                                    {sel && <Check className="w-2.5 h-2.5" />}
                                    {r.query.slice(0, 24)}{r.query.length > 24 ? "…" : ""} ({rowCount})
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Queries */}
                        {ti.queries.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <MessageSquare className="w-3 h-3" style={{ color: "#3b82f6" }} />
                              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#3b82f6" }}>
                                Queries ({ti.queries.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {ti.queries.map((r) => {
                                const key = makeKey(ti.tabId, "query", r.id);
                                const sel = selectedItems.has(key);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleItem(key)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                                    style={{
                                      background: sel ? "#2563eb" : "white",
                                      color: sel ? "white" : "#334155",
                                      border: `1px solid ${sel ? "#2563eb" : "#e5e7eb"}`,
                                    }}
                                    title={r.query.slice(0, 80)}
                                  >
                                    {sel && <Check className="w-2.5 h-2.5" />}
                                    {r.query.slice(0, 28)}{r.query.length > 28 ? "…" : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Empty tab */}
                        {ti.graphs.length === 0 && ti.tables.length === 0 && ti.queries.length === 0 && (
                          <p className="text-[11px] italic py-1" style={{ color: "#94a3b8" }}>
                            No results in this tab yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live selection summary */}
            {selectedItems.size > 0 && (
              <p className="text-[11px] mt-2 pl-0.5" style={{ color: "#64748b" }}>
                {selectionSummary.graphs} graph{selectionSummary.graphs !== 1 ? "s" : ""},{" "}
                {selectionSummary.tables} table{selectionSummary.tables !== 1 ? "s" : ""},{" "}
                {selectionSummary.queries} quer{selectionSummary.queries !== 1 ? "ies" : "y"}{" "}
                selected across {selectionSummary.tabCount} tab{selectionSummary.tabCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <Divider />

          {/* ── Include metadata toggle ─────────────────────────────────────── */}
          <div
            className="rounded-lg px-3 py-1"
            style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
          >
            <Toggle
              id="tgl-metadata"
              checked={includeMetadata}
              onChange={setIncludeMetadata}
              label="Include metadata"
              sublabel="Study context, analysis type, row count"
            />
          </div>
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
              e.currentTarget.style.background = "#2563eb";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.borderColor = "#2563eb";
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

        {/* Invisible resize handles — edges */}
        <div onMouseDown={(e) => startResize("n", e)} className="absolute -top-[3px] left-3 right-3 h-1.5 cursor-ns-resize" />
        <div onMouseDown={(e) => startResize("s", e)} className="absolute -bottom-[3px] left-3 right-3 h-1.5 cursor-ns-resize" />
        <div onMouseDown={(e) => startResize("e", e)} className="absolute top-3 -right-[3px] bottom-3 w-1.5 cursor-ew-resize" />
        <div onMouseDown={(e) => startResize("w", e)} className="absolute top-3 -left-[3px] bottom-3 w-1.5 cursor-ew-resize" />
        {/* Invisible resize handles — corners */}
        <div onMouseDown={(e) => startResize("nw", e)} className="absolute -top-[3px] -left-[3px] w-3 h-3 cursor-nwse-resize" />
        <div onMouseDown={(e) => startResize("ne", e)} className="absolute -top-[3px] -right-[3px] w-3 h-3 cursor-nesw-resize" />
        <div onMouseDown={(e) => startResize("sw", e)} className="absolute -bottom-[3px] -left-[3px] w-3 h-3 cursor-nesw-resize" />
        <div onMouseDown={(e) => startResize("se", e)} className="absolute -bottom-[3px] -right-[3px] w-3 h-3 cursor-nwse-resize" />
      </div>
    </Draggable>
  );
}
