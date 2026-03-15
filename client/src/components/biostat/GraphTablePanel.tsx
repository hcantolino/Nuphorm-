import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useAIPanelStore, DEFAULT_CUSTOMIZATIONS } from "@/stores/aiPanelStore";
// NEW: ControlChartType needed for preferredType prop + auto-sync effect
import type { TabCustomizations, ControlChartType } from "@/stores/aiPanelStore";
import { useTabStore } from "@/stores/tabStore";
import { useBiostatisticsStore } from "@/stores/biostatisticsStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BarChart2,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquarePlus,
  RefreshCw,
  Save,
  ShieldCheck,
  Table2,
  Trash2,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";
// BEFORE: import PharmaChartPanel, { type PharmaChartType } from "./PharmaChartPanel"
// AFTER:  Charts tab removed — PharmaChartPanel no longer rendered as a separate view
import PlotlyInteractiveChart, { isSurvivalChartData, isPlotlyChartData } from "./PlotlyInteractiveChart";
import type { PlotlyChartConfig } from "./PlotlyInteractiveChart";
import SaveAnalysisModal from "./SaveAnalysisModal";
import { PALETTES } from "./ControlPanel";
import { CustomizeSidebar } from "./CustomizeSidebar";
import { DataPointsTable } from "./DataPointsTable";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCurrentDatasetStore } from "@/stores/currentDatasetStore";
import { Settings2 } from "lucide-react";

// ─── Color resolution ────────────────────────────────────────────────────────

/** Default KM/survival colors: black for Experimental, pink for Control */
const KM_DEFAULT_COLORS = ["#0F172A", "#EC4899"];
/** Default trendline color: dashed gray */
const TRENDLINE_DEFAULT_COLOR = "#D1D5DB";

function resolveColors(customizations: TabCustomizations): string[] {
  const palette = PALETTES[customizations.palette];
  return Array.from({ length: 6 }, (_, i) =>
    customizations.customColors[i] || palette[i % palette.length]
  );
}

/** Resolve colors for KM/survival charts — uses black/pink defaults unless custom */
function resolveKMColors(customizations: TabCustomizations, seriesCount: number): string[] {
  return Array.from({ length: Math.max(seriesCount, 2) }, (_, i) =>
    customizations.customColors[i] || KM_DEFAULT_COLORS[i] || PALETTES[customizations.palette][i % PALETTES[customizations.palette].length]
  );
}

// ─── CSV download helpers ────────────────────────────────────────────────────

/** Convert a 2-column metric/value table to CSV and trigger browser download */
function downloadTableAsCSV(
  table: Array<{ metric: string; value: any }>,
  filename: string
) {
  const rows = [
    ["Metric", "Value"],
    ...table.map((r) => [String(r.metric ?? ""), String(r.value ?? "")]),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  triggerDownload(filename, csv, "text/csv");
}

/** Convert a multi-column dataset (headers + rows) to CSV and trigger download */
function downloadDatasetAsCSV(
  headers: string[],
  rows: any[][],
  filename: string
) {
  const csvRows = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","),
    ...rows.map((row) =>
      row
        .map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  triggerDownload(filename, csvRows.join("\n"), "text/csv");
}

/** Convert chart source data (labels + datasets) to CSV and trigger download */
function downloadChartDataAsCSV(
  labels: string[],
  datasets: Array<{ label: string; data: number[] }>,
  filename: string
) {
  const dsLabels = datasets.map((ds) => ds.label ?? "Value");
  const header = ["Label", ...dsLabels];
  const rows = labels.map((label, i) => [
    label,
    ...datasets.map((ds) => {
      const v = ds.data?.[i];
      return typeof v === "number"
        ? Number.isInteger(v) ? String(v) : v.toFixed(4)
        : String(v ?? "");
    }),
  ]);
  const csvRows = [
    header.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ];
  triggerDownload(filename, csvRows.join("\n"), "text/csv");
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build a sanitized filename from a query or title */
function buildCSVFilename(prefix: string, query?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = (query ?? "export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 40)
    .replace(/_+$/, "");
  return `${prefix}_${slug}_${date}.csv`;
}

// ─── Export helpers ──────────────────────────────────────────────────────────

/** Build a sanitized filename for any export format */
function buildExportFilename(
  title: string | undefined,
  suffix: string | undefined,
  ext: string
): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = (title || "export")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
  const parts = [slug, suffix, date].filter(Boolean);
  return `${parts.join("_")}.${ext}`;
}

/** html-to-image filter: hides the export dropdown button during capture */
const excludeExportBtn = (node: HTMLElement): boolean => {
  if (!(node instanceof HTMLElement)) return true;
  return !node.hasAttribute("data-export-btn");
};

/** Trigger a file download from a data-URL */
function triggerDataUrlDownload(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Render a DOM element to an off-screen canvas at the given scale */
async function elementToCanvas(
  el: HTMLElement,
  scale: number = 2
): Promise<HTMLCanvasElement> {
  const dataUrl = await toPng(el, {
    pixelRatio: scale,
    filter: excludeExportBtn as any,
    backgroundColor: "#ffffff",
  });
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Build an uncompressed TIFF blob from raw canvas pixel data (300 DPI) */
function createTiffBlob(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const rgbLen = w * h * 3;
  const rgb = new Uint8Array(rgbLen);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }

  const ifdEntryCount = 12;
  const ifdStart = 8;
  const ifdSize = 2 + ifdEntryCount * 12 + 4;
  const bpsOff = ifdStart + ifdSize;
  const xrOff = bpsOff + 6;
  const yrOff = xrOff + 8;
  const stripOff = yrOff + 8;
  const totalSize = stripOff + rgbLen;

  const buf = new ArrayBuffer(totalSize);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // TIFF header — little-endian
  dv.setUint16(0, 0x4949, false); // byte-order "II"
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdStart, true);

  let off = ifdStart;
  dv.setUint16(off, ifdEntryCount, true);
  off += 2;

  const writeTag = (tag: number, type: number, count: number, val: number) => {
    dv.setUint16(off, tag, true); off += 2;
    dv.setUint16(off, type, true); off += 2;
    dv.setUint32(off, count, true); off += 4;
    dv.setUint32(off, val, true); off += 4;
  };

  writeTag(256, 3, 1, w);            // ImageWidth
  writeTag(257, 3, 1, h);            // ImageLength
  writeTag(258, 3, 3, bpsOff);       // BitsPerSample → offset
  writeTag(259, 3, 1, 1);            // Compression (none)
  writeTag(262, 3, 1, 2);            // PhotometricInterpretation (RGB)
  writeTag(273, 4, 1, stripOff);     // StripOffsets
  writeTag(277, 3, 1, 3);            // SamplesPerPixel
  writeTag(278, 4, 1, h);            // RowsPerStrip
  writeTag(279, 4, 1, rgbLen);       // StripByteCounts
  writeTag(282, 5, 1, xrOff);       // XResolution → offset
  writeTag(283, 5, 1, yrOff);       // YResolution → offset
  writeTag(296, 3, 1, 2);           // ResolutionUnit (inch)

  dv.setUint32(off, 0, true);       // next IFD = 0 (none)

  // BitsPerSample: 8, 8, 8
  dv.setUint16(bpsOff, 8, true);
  dv.setUint16(bpsOff + 2, 8, true);
  dv.setUint16(bpsOff + 4, 8, true);

  // Resolution: 300/1 DPI
  dv.setUint32(xrOff, 300, true);
  dv.setUint32(xrOff + 4, 1, true);
  dv.setUint32(yrOff, 300, true);
  dv.setUint32(yrOff + 4, 1, true);

  u8.set(rgb, stripOff);
  return new Blob([buf], { type: "image/tiff" });
}

/** Export an element in the given image/document format */
async function exportElementAs(
  el: HTMLElement,
  format: string,
  filename: string
) {
  const opts = {
    pixelRatio: 2,
    filter: excludeExportBtn as any,
    backgroundColor: "#ffffff",
  };

  switch (format) {
    case "png": {
      const url = await toPng(el, opts);
      triggerDataUrlDownload(filename, url);
      break;
    }
    case "jpeg": {
      const url = await toJpeg(el, { ...opts, quality: 0.95 });
      triggerDataUrlDownload(filename, url);
      break;
    }
    case "jp2": {
      // Browsers cannot encode JPEG-2000; export as lossless PNG with .jp2 extension
      const url = await toPng(el, opts);
      triggerDataUrlDownload(filename, url);
      break;
    }
    case "tiff": {
      const canvas = await elementToCanvas(el, 2);
      const blob = createTiffBlob(canvas);
      const blobUrl = URL.createObjectURL(blob);
      triggerDataUrlDownload(filename, blobUrl);
      URL.revokeObjectURL(blobUrl);
      break;
    }
    case "pdf": {
      const canvas = await elementToCanvas(el, 2);
      const imgW = canvas.width;
      const imgH = canvas.height;
      const orientation = imgW > imgH ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [imgW, imgH] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
      pdf.save(filename);
      break;
    }
    case "svg": {
      const url = await toSvg(el, { filter: excludeExportBtn as any, backgroundColor: "#ffffff" });
      triggerDataUrlDownload(filename, url);
      break;
    }
  }
}

/** Copy a DOM element's rendered image to the clipboard */
async function copyElementToClipboard(el: HTMLElement) {
  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    filter: excludeExportBtn as any,
    backgroundColor: "#ffffff",
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

/** Download a 2-column metric/value table as tab-separated text */
function downloadTableAsTxt(
  table: Array<{ metric: string; value: any }>,
  filename: string
) {
  const rows = [
    "Metric\tValue",
    ...table.map((r) => `${r.metric ?? ""}\t${r.value ?? ""}`),
  ];
  triggerDownload(filename, rows.join("\n"), "text/plain");
}

// ─── ExportDropdown component ────────────────────────────────────────────────

type ExportMenuItem = { label: string; onClick: () => void } | "divider";

function ExportDropdown({
  type,
  title,
  query,
  tableData,
  cleanExportRef,
}: {
  type: "chart" | "table";
  title?: string;
  query?: string;
  tableData?: Array<{ metric: string; value: any }>;
  cleanExportRef?: React.RefObject<HTMLDivElement>;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const findTarget = useCallback(
    (): HTMLElement | null =>
      btnRef.current?.closest("[data-export-target]") as HTMLElement | null,
    []
  );

  const nameBase = title || query;

  const handleImageExport = async (
    format: string,
    ext: string,
    label: string
  ) => {
    setOpen(false);
    // For chart image exports, prefer the clean export element (no UI chrome)
    const el = (type === "chart" && cleanExportRef?.current)
      ? cleanExportRef.current
      : findTarget();
    if (!el) {
      toast.error("Nothing to export");
      return;
    }
    try {
      const suffix = type === "table" ? "statistics" : undefined;
      const filename = buildExportFilename(nameBase, suffix, ext);
      await exportElementAs(el, format, filename);
      toast.success(`Exported as ${label}`);
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
    }
  };

  const handleCopy = async () => {
    setOpen(false);
    const el = (type === "chart" && cleanExportRef?.current)
      ? cleanExportRef.current
      : findTarget();
    if (!el) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await copyElementToClipboard(el);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleCsv = () => {
    setOpen(false);
    if (!tableData) return;
    downloadTableAsCSV(
      tableData,
      buildExportFilename(nameBase, "statistics", "csv")
    );
    toast.success("Exported as CSV");
  };

  const handleTxt = () => {
    setOpen(false);
    if (!tableData) return;
    downloadTableAsTxt(
      tableData,
      buildExportFilename(nameBase, "statistics", "txt")
    );
    toast.success("Exported as TXT");
  };

  const chartItems: ExportMenuItem[] = [
    { label: "PNG", onClick: () => handleImageExport("png", "png", "PNG") },
    { label: "JPEG", onClick: () => handleImageExport("jpeg", "jpg", "JPEG") },
    { label: "JPEG-2000", onClick: () => handleImageExport("jp2", "jp2", "JPEG-2000") },
    { label: "TIFF", onClick: () => handleImageExport("tiff", "tiff", "TIFF") },
    { label: "PDF", onClick: () => handleImageExport("pdf", "pdf", "PDF") },
    { label: "SVG", onClick: () => handleImageExport("svg", "svg", "SVG") },
    "divider",
    { label: "Copy to Clipboard", onClick: handleCopy },
  ];

  const tableItems: ExportMenuItem[] = [
    { label: "PNG", onClick: () => handleImageExport("png", "png", "PNG") },
    { label: "JPEG", onClick: () => handleImageExport("jpeg", "jpg", "JPEG") },
    { label: "TIFF", onClick: () => handleImageExport("tiff", "tiff", "TIFF") },
    { label: "PDF", onClick: () => handleImageExport("pdf", "pdf", "PDF") },
    "divider",
    { label: "CSV", onClick: handleCsv },
    { label: "TXT", onClick: handleTxt },
    "divider",
    { label: "Copy to Clipboard", onClick: handleCopy },
  ];

  const items = type === "chart" ? chartItems : tableItems;

  return (
    <div className="relative" data-export-btn="">
      <Button
        ref={btnRef}
        variant="outline"
        size="sm"
        className="h-6 px-2.5 text-[10px] text-[#64748b] border-[#e2e8f0] hover:bg-[#f8fafc] hover:text-[#0f172a] gap-1 font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <Download className="w-3 h-3" />
        Export
        <ChevronDown className="w-2.5 h-2.5" />
      </Button>
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[#e2e8f0] py-1 z-50 min-w-[160px]"
        >
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={`d-${i}`} className="h-px bg-[#e2e8f0] my-1 mx-2" />
            ) : (
              <button
                key={item.label}
                className="w-full text-left px-3 py-1.5 text-xs text-[#374151] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
                onClick={item.onClick}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Legend props helper ──────────────────────────────────────────────────────

function buildLegendProps(pos: TabCustomizations["legendPosition"]) {
  if (pos === "none") return null;
  const wrapperStyle: React.CSSProperties = { position: "relative", paddingTop: 12 };
  if (pos === "left")  return { verticalAlign: "middle" as const, align: "left"   as const, layout: "vertical"   as const, wrapperStyle };
  if (pos === "right") return { verticalAlign: "middle" as const, align: "right"  as const, layout: "vertical"   as const, wrapperStyle };
  if (pos === "top")   return { verticalAlign: "top"    as const, align: "center" as const, layout: "horizontal" as const, wrapperStyle };
  return                      { verticalAlign: "bottom" as const, align: "center" as const, layout: "horizontal" as const, wrapperStyle };
}

// ─── Linear regression helper ────────────────────────────────────────────────

interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

function calcLinearRegression(points: { x: number; y: number }[]): RegressionResult | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

// ─── Markdown rendering helpers ──────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, '<code class="bg-[#f1f5f9] px-1 rounded font-mono text-xs">$1</code>');
}

function MarkdownTable({ source }: { source: string }) {
  const lines = source.split("\n").filter((l) => l.trim());
  const parseRow = (line: string) => {
    const parts = line.split("|");
    // Strip leading/trailing empty from | borders |
    if (parts[0].trim() === "") parts.shift();
    if (parts[parts.length - 1].trim() === "") parts.pop();
    return parts.map((c) => c.trim());
  };
  const sepIdx = lines.findIndex((l) => /^\|?[\s\-:|]+\|/.test(l));
  if (lines.length < 2 || sepIdx < 1) {
    return <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">{source}</pre>;
  }
  const headers = parseRow(lines[0]);
  const rows = lines.slice(sepIdx + 1).map(parseRow);
  return (
    <div className="overflow-x-auto rounded border border-[#e2e8f0]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left py-1.5 px-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap"
                dangerouslySetInnerHTML={{ __html: renderInline(h) }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#eff6ff] transition-colors">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="py-1.5 px-3 text-[#0f172a]"
                  dangerouslySetInnerHTML={{ __html: renderInline(cell) }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Headings
        if (trimmed.startsWith("### "))
          return <h5 key={i} className="font-semibold text-[#0f172a] text-sm mt-1" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(4)) }} />;
        if (trimmed.startsWith("## "))
          return <h4 key={i} className="font-semibold text-[#0f172a]" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(3)) }} />;
        if (trimmed.startsWith("# "))
          return <h3 key={i} className="font-bold text-[#0f172a] text-base" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(2)) }} />;

        // Markdown table
        if (/\|\s*[-:]+[-|\s:]*\|/.test(trimmed))
          return <MarkdownTable key={i} source={trimmed} />;

        // Bullet list
        const lines = trimmed.split("\n");
        const bulletLines = lines.filter((l) => /^[-*+]\s/.test(l.trim()));
        if (bulletLines.length > 0 && bulletLines.length === lines.filter((l) => l.trim()).length) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {bulletLines.map((l, j) => (
                <li key={j} className="text-sm text-[#0f172a]/80" dangerouslySetInnerHTML={{ __html: renderInline(l.trim().replace(/^[-*+]\s+/, "")) }} />
              ))}
            </ul>
          );
        }

        // Numbered list
        const numberedLines = lines.filter((l) => /^\d+\.\s/.test(l.trim()));
        if (numberedLines.length > 0 && numberedLines.length === lines.filter((l) => l.trim()).length) {
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1">
              {numberedLines.map((l, j) => (
                <li key={j} className="text-sm text-[#0f172a]/80" dangerouslySetInnerHTML={{ __html: renderInline(l.trim().replace(/^\d+\.\s+/, "")) }} />
              ))}
            </ol>
          );
        }

        // Regular paragraph
        return (
          <p key={i} className="text-sm text-[#0f172a]/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.replace(/\n/g, "<br>")) }} />
        );
      })}
    </div>
  );
}

// ─── Auto-fit title component ────────────────────────────────────────────────

function AutoFitTitle({ title, className }: { title: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(1.5); // rem

  useEffect(() => {
    if (!containerRef.current || !textRef.current || !title) return;
    const measure = () => {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text) return;
      let size = 1.5;
      text.style.fontSize = `${size}rem`;
      // Scale down if text wraps to more than 2 lines
      const lineH = parseFloat(getComputedStyle(text).lineHeight) || size * 16 * 1.3;
      while (text.scrollHeight > lineH * 2.2 && size > 1) {
        size -= 0.05;
        text.style.fontSize = `${size}rem`;
      }
      setFontSize(size);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [title]);

  return (
    <div ref={containerRef} className={className} style={{ overflow: "hidden" }}>
      <span
        ref={textRef}
        className="block font-bold leading-tight"
        style={{
          fontSize: `${fontSize}rem`,
          color: "#194CFF",
          wordBreak: "break-word",
        }}
      >
        {title}
      </span>
    </div>
  );
}

// ─── Data label formatter ────────────────────────────────────────────────────

function formatDataLabel(value: any, customizations: TabCustomizations): string {
  if (typeof value !== "number") return String(value ?? "");
  switch (customizations.dataLabelFormat) {
    case "percentage":
      return `${(value * 100).toFixed(customizations.dataLabelDecimals)}%`;
    case "integer":
      return Math.round(value).toString();
    case "decimal":
    default:
      return value.toFixed(customizations.dataLabelDecimals);
  }
}

// ─── Trendline dash array helper ─────────────────────────────────────────────

function getTrendlineDashArray(pattern: string): string | undefined {
  if (pattern === "dashed") return "5 5";
  if (pattern === "dotted") return "2 2";
  return undefined; // solid
}

// ─── Confidence band calculator ──────────────────────────────────────────────

function calcConfidenceBand(
  points: { x: number; y: number }[],
  reg: { slope: number; intercept: number }
): { x: number; upper: number; lower: number }[] {
  const n = points.length;
  if (n < 3) return [];
  const residuals = points.map((p) => p.y - (reg.slope * p.x + reg.intercept));
  const se = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / (n - 2));
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const ssX = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  const t = 1.96; // ~95% CI

  const xs = points.map((p) => p.x).sort((a, b) => a - b);
  return xs.map((x) => {
    const yHat = reg.slope * x + reg.intercept;
    const margin = t * se * Math.sqrt(1 / n + (x - meanX) ** 2 / ssX);
    return { x, upper: yHat + margin, lower: yHat - margin };
  });
}

// ─── Extended chart renderer ─────────────────────────────────────────────────

interface ChartProps {
  chartData: any;
  customizations: TabCustomizations;
  colors: string[];
  preferredType?: ControlChartType;
}

const VALID_CHART_TYPES = new Set<ControlChartType>(["bar", "line", "area", "scatter", "pie"]);

const ChartRenderer: React.FC<ChartProps> = ({ chartData, customizations, colors, preferredType }) => {
  if (!chartData) return null;

  let data: any[] = [];
  let datasetKeys: string[] = [];
  // NEW: prefer LLM-requested type; fall back to user customization
  // REMOVED: was `customizations.chartType` always — ignored chart_data.type from LLM
  const type: ControlChartType = preferredType ?? customizations.chartType;

  if (chartData.labels && chartData.datasets) {
    data = chartData.labels.map((label: any, idx: number) => {
      const point: any = { name: label };
      chartData.datasets.forEach((ds: any) => {
        if (ds.data?.[idx] !== undefined) point[ds.label] = ds.data[idx];
      });
      return point;
    });
    datasetKeys = chartData.datasets.map((ds: any) => ds.label);
  } else if (Array.isArray(chartData.points)) {
    data = chartData.points.map((p: any, i: number) => ({
      name: p.x ?? i,
      value: p.y,
    }));
    datasetKeys = ["value"];
  }

  if (data.length === 0) return null;

  const isDark = customizations.chartTheme === "dark";
  const bgColor = isDark ? "#1e293b" : "#ffffff";
  const textColor = isDark ? "#e2e8f0" : "#0F172A";
  const gridStroke = customizations.showGrid
    ? isDark ? "#334155" : "#e2e8f0"
    : "transparent";
  const legendProps = buildLegendProps(customizations.legendPosition);

  const xRotation = customizations.xAxisRotation || 0;
  const bottomMargin = customizations.xLabel ? 36 + (xRotation > 0 ? xRotation * 0.5 : 0) : 20 + (xRotation > 0 ? xRotation * 0.5 : 0);
  const leftMargin   = customizations.yLabel ? 20 : 0;
  const sharedMargin = { top: 8, right: 16, bottom: bottomMargin, left: leftMargin };

  const xAxisLabel = customizations.xLabel
    ? { value: customizations.xLabel, position: "insideBottom" as const, offset: -12, fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b" }
    : undefined;
  const yAxisLabel = customizations.yLabel
    ? { value: customizations.yLabel, angle: -90, position: "insideLeft" as const, fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b" }
    : undefined;

  const xTickProps: any = { fontSize: 11, fill: textColor };
  if (xRotation > 0) {
    xTickProps.angle = -xRotation;
    xTickProps.textAnchor = "end";
    xTickProps.dy = 5;
  }

  // Data label style with formatting
  const labelStyle = { fontSize: 9, fill: isDark ? "#94a3b8" : "#0F172A", fontWeight: 500 };
  const labelFormatter = (value: any) => formatDataLabel(value, customizations);

  // Y-axis domain: guard against 0/negative with log scale
  const yMin = customizations.yAxisMin;
  const yMax = customizations.yAxisMax;
  const yDomainMin: number | string =
    customizations.yAxisLog && (yMin === null || yMin <= 0) ? "auto" : (yMin ?? "auto");
  const yDomainMax: number | string = yMax ?? "auto";
  const yDomain: [number | string, number | string] = [yDomainMin, yDomainMax];
  const yScale = customizations.yAxisLog ? ("log" as const) : ("auto" as const);

  // X-axis domain for numeric axes
  const xDomain: [number | string, number | string] = [
    customizations.xAxisMin ?? "auto",
    customizations.xAxisMax ?? "auto",
  ];

  // ── Pie ─────────────────────────────────────────────────────────────────
  if (type === "pie") {
    const firstKey = datasetKeys[0] ?? "value";
    const pieData = data.map((d: any) => ({
      name: d.name,
      value: typeof d[firstKey] === "number" ? d[firstKey] : (d.value ?? 0),
    }));
    return (
      <ResponsiveContainer width="100%" height={320} minHeight={280}>
        <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={100}
            dataKey="value"
            isAnimationActive={false}
            label={customizations.showDataLabels
              ? ({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`
              : undefined}
            labelLine={customizations.showDataLabels}
          >
            {pieData.map((_: any, i: number) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val: any) => [typeof val === "number" ? val.toFixed(4) : val]} />
          {legendProps && <Legend {...legendProps} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // ── Scatter ──────────────────────────────────────────────────────────────
  if (type === "scatter" && chartData.points) {
    const scatterData = chartData.points.map((p: any) => ({ x: p.x, y: p.y }));
    const r = customizations.markerSize;
    const dotShape = (props: any) => (
      <circle cx={props.cx} cy={props.cy} r={r} fill={colors[0]} />
    );

    // Linear trendline
    const regression =
      customizations.trendlineType === "linear"
        ? calcLinearRegression(scatterData)
        : null;

    let trendlinePoints: { tx: number; ty: number }[] = [];
    let trendLabel = "";
    if (regression) {
      const xs = scatterData.map((p: any) => p.x as number);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      trendlinePoints = [
        { tx: minX, ty: regression.slope * minX + regression.intercept },
        { tx: maxX, ty: regression.slope * maxX + regression.intercept },
      ];
      const eqParts: string[] = [];
      if (customizations.showTrendlineEquation) {
        eqParts.push(
          `y = ${regression.slope.toFixed(3)}x ${regression.intercept >= 0 ? "+" : "−"} ${Math.abs(regression.intercept).toFixed(3)}`
        );
      }
      if (customizations.showTrendlineR2) {
        eqParts.push(`R² = ${regression.r2.toFixed(3)}`);
      }
      trendLabel = eqParts.length > 0 ? eqParts.join("  ") : "Trend";
    }

    // Confidence bands data
    const confidenceBand = customizations.showConfidenceBands && regression
      ? calcConfidenceBand(scatterData, regression)
      : [];

    // Use ComposedChart when trendline is active
    if (regression) {
      const trendColor = colors[1] ?? "#194CFF";
      const dashArray = getTrendlineDashArray(customizations.trendlineDashPattern);
      const glowFilter = customizations.trendlineGlow
        ? `drop-shadow(0 0 4px ${trendColor}40)`
        : undefined;

      // Merge all data: scatter points + trendline + confidence bands
      const composedData = scatterData.map((p: any) => ({ tx: p.x, ty: p.y }));

      return (
        <ResponsiveContainer width="100%" height={320} minHeight={280}>
          <ComposedChart margin={sharedMargin} style={{ backgroundColor: bgColor }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="tx"
              type="number"
              tick={xTickProps}
              label={xAxisLabel}
              domain={xDomain}
              name="x"
              allowDataOverflow
            />
            <YAxis
              type="number"
              tick={{ fontSize: 11, fill: textColor }}
              label={yAxisLabel}
              domain={yDomain}
              scale={yScale}
              reversed={customizations.yAxisReverse}
              allowDataOverflow
            />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            {legendProps && <Legend {...legendProps} />}
            {/* Confidence bands as area */}
            {confidenceBand.length > 0 && (
              <Area
                data={confidenceBand}
                dataKey="upper"
                type="monotone"
                stroke="none"
                fill={trendColor}
                fillOpacity={0.12}
                isAnimationActive={false}
                legendType="none"
                name="CI Upper"
              />
            )}
            {confidenceBand.length > 0 && (
              <Area
                data={confidenceBand}
                dataKey="lower"
                type="monotone"
                stroke="none"
                fill={bgColor}
                fillOpacity={1}
                isAnimationActive={false}
                legendType="none"
                name="CI Lower"
              />
            )}
            <Scatter
              name="Data"
              data={composedData}
              dataKey="ty"
              fill={colors[0]}
              isAnimationActive={false}
              shape={dotShape}
            />
            <Line
              name={trendLabel || "Trend"}
              data={trendlinePoints}
              dataKey="ty"
              dot={false}
              stroke={trendColor}
              strokeWidth={customizations.trendlineThickness}
              strokeDasharray={dashArray}
              strokeOpacity={customizations.trendlineOpacity}
              isAnimationActive={false}
              type="linear"
              legendType="line"
              style={glowFilter ? { filter: glowFilter } : undefined}
            />
            {customizations.showDropLines &&
              scatterData.map((p: any, i: number) => (
                <ReferenceLine
                  key={i}
                  x={p.x}
                  stroke={colors[0]}
                  strokeOpacity={0.25}
                  strokeDasharray="2 2"
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // Regular scatter (no trendline)
    return (
      <ResponsiveContainer width="100%" height={320} minHeight={280}>
        <ScatterChart margin={sharedMargin} style={{ backgroundColor: bgColor }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="x"
            type="number"
            tick={xTickProps}
            label={xAxisLabel}
            domain={xDomain}
            allowDataOverflow
          />
          <YAxis
            dataKey="y"
            type="number"
            tick={{ fontSize: 11, fill: textColor }}
            label={yAxisLabel}
            domain={yDomain}
            scale={yScale}
            reversed={customizations.yAxisReverse}
            allowDataOverflow
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          {legendProps && <Legend {...legendProps} />}
          <Scatter
            data={scatterData}
            fill={colors[0]}
            isAnimationActive={false}
            shape={dotShape}
          />
          {customizations.showDropLines &&
            scatterData.map((p: any, i: number) => (
              <ReferenceLine
                key={i}
                x={p.x}
                stroke={colors[0]}
                strokeOpacity={0.25}
                strokeDasharray="2 2"
              />
            ))}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  // ── Area ─────────────────────────────────────────────────────────────────
  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={320} minHeight={280}>
        <AreaChart data={data} margin={sharedMargin} style={{ backgroundColor: bgColor }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="name" tick={xTickProps} interval="preserveStartEnd" label={xAxisLabel} />
          <YAxis
            tick={{ fontSize: 11, fill: textColor }}
            label={yAxisLabel}
            domain={yDomain}
            scale={yScale}
            reversed={customizations.yAxisReverse}
            allowDataOverflow
          />
          <Tooltip />
          {legendProps && <Legend {...legendProps} />}
          {datasetKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              strokeWidth={customizations.strokeWidth}
              fill={colors[i % colors.length]}
              fillOpacity={customizations.fillOpacity}
              dot={false}
              isAnimationActive={false}
            >
              {customizations.showDataLabels && (
                <LabelList dataKey={key} position="top" style={labelStyle} formatter={labelFormatter} />
              )}
            </Area>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ── Line ─────────────────────────────────────────────────────────────────
  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={320} minHeight={280}>
        <LineChart data={data} margin={sharedMargin} style={{ backgroundColor: bgColor }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="name" tick={xTickProps} interval="preserveStartEnd" label={xAxisLabel} />
          <YAxis
            tick={{ fontSize: 11, fill: textColor }}
            label={yAxisLabel}
            domain={yDomain}
            scale={yScale}
            reversed={customizations.yAxisReverse}
            allowDataOverflow
          />
          <Tooltip />
          {legendProps && <Legend {...legendProps} />}
          {datasetKeys.map((key, i) => {
            const lineColor = colors[i % colors.length];
            const glowFilter = customizations.trendlineGlow && customizations.strokeWidth >= 2
              ? `drop-shadow(0 0 4px ${lineColor}4D)`
              : undefined;
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={lineColor}
                strokeWidth={customizations.strokeWidth}
                dot={false}
                isAnimationActive={false}
                style={glowFilter ? { filter: glowFilter } : undefined}
              >
                {customizations.showDataLabels && (
                  <LabelList dataKey={key} position="top" style={labelStyle} formatter={labelFormatter} />
                )}
              </Line>
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── Bar (default / scatter fallback) ─────────────────────────────────────
  const barRadius: [number, number, number, number] = [
    customizations.barBorderRadius,
    customizations.barBorderRadius,
    0,
    0,
  ];

  return (
    <ResponsiveContainer width="100%" height={320} minHeight={280}>
      <BarChart data={data} margin={sharedMargin} barGap={customizations.barGap} style={{ backgroundColor: bgColor }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="name" tick={xTickProps} label={xAxisLabel} />
        <YAxis
          tick={{ fontSize: 11, fill: textColor }}
          label={yAxisLabel}
          domain={yDomain}
          scale={yScale}
          reversed={customizations.yAxisReverse}
          allowDataOverflow
        />
        <Tooltip />
        {legendProps && <Legend {...legendProps} />}
        {datasetKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[i % colors.length]}
            radius={barRadius}
            isAnimationActive={false}
          >
            {customizations.showDataLabels && (
              <LabelList dataKey={key} position="top" style={labelStyle} formatter={labelFormatter} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// ─── Chart error boundary ─────────────────────────────────────────────────────
// NEW: React class-based boundary so a malformed chart_data doesn't crash the panel.
// The parent supplies an onError callback to show a fallback message in its own state.

interface ChartEBProps  { children: React.ReactNode; onError: () => void }
interface ChartEBState  { hasError: boolean }

class ChartErrorBoundary extends React.Component<ChartEBProps, ChartEBState> {
  constructor(props: ChartEBProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): ChartEBState { return { hasError: true }; }
  componentDidCatch(err: Error) {
    console.warn("[ChartRenderer] Rendering error — falling back to table view.", err.message);
    this.props.onError();
  }
  render() {
    // When hasError, the parent renders the fallback; we just render nothing here
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ─── Editable cell ────────────────────────────────────────────────────────────

interface EditableCellProps {
  value: string | number;
  resultId: string;
  rowIndex: number;
  field: "metric" | "value";
  align?: "left" | "right";
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  resultId,
  rowIndex,
  field,
  align = "left",
}) => {
  const editTableCell = useAIPanelStore((s) => s.editTableCell);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [validationError, setValidationError] = useState(false);

  // Keep draft in sync when value prop changes from outside (e.g. store reset)
  React.useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  // For "value" fields that were originally numeric, validate on commit
  const isNumericField = field === "value" && typeof value === "number";

  const commit = () => {
    if (isNumericField && draft.trim() !== "" && isNaN(Number(draft))) {
      // Non-numeric input in a numeric field — show orange error, revert after delay
      setValidationError(true);
      setTimeout(() => {
        setValidationError(false);
        setDraft(String(value));
        setEditing(false);
      }, 1200);
      return;
    }
    if (activeTabId) editTableCell(activeTabId, resultId, rowIndex, field, draft);
    setValidationError(false);
    setEditing(false);
  };

  const displayValue =
    typeof value === "number" ? value.toFixed(4) : String(value ?? "—");

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (validationError) setValidationError(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
        }}
        className={`h-6 text-sm py-0 px-1 ${align === "right" ? "text-right" : ""}`}
        style={validationError ? { borderColor: "#FD7E14", boxShadow: "0 0 0 2px rgba(253,126,20,0.2)" } : undefined}
        title={validationError ? "Please enter a valid number" : "Press Enter to confirm, Escape to cancel"}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:text-[#3b82f6] hover:underline transition-colors ${
        align === "right" ? "font-mono" : ""
      }`}
      title="Click to edit"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {displayValue}
    </span>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

export const GraphTablePanel: React.FC = () => {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const activeTabName = useMemo(
    () => tabs.find((t) => t.id === activeTabId)?.title,
    [tabs, activeTabId]
  );

  const {
    resultsByTab,
    activeResultIdByTab,
    setActiveResult,
    clearResults,
    setCustomization,
    resetCustomizations,
    getTabCustomizations,
    selectedGraphId,
    setSelectedGraph,
    addToChat,
  } = useAIPanelStore();

  const results = (activeTabId ? resultsByTab[activeTabId] : null) ?? [];
  const activeResultId = activeTabId
    ? (activeResultIdByTab[activeTabId] ?? null)
    : null;

  const activeResult =
    results.find((r) => r.id === activeResultId) ??
    results[results.length - 1] ??
    null;

  const activeIndex = activeResult ? results.indexOf(activeResult) : -1;

  const customizations = activeTabId
    ? getTabCustomizations(activeTabId)
    : { ...DEFAULT_CUSTOMIZATIONS };

  const activeColors = useMemo(() => resolveColors(customizations), [customizations]);

  // Project name for save modal folder hierarchy
  const projectName = useBiostatisticsStore((s) => {
    const proj = s.projects.find((p) => p.id === s.activeProjectId);
    return proj?.name ?? "Untitled Project";
  });

  // tabs + resultsByTab are passed directly to SaveAnalysisModal

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Customize sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Validate & Correct ──────────────────────────────────────────────────
  const currentDataset = useCurrentDatasetStore((s) => s.currentDataset);
  const [isValidating, setIsValidating] = useState(false);
  const validateMutation = trpc.biostatistics.validateAndCorrect.useMutation();
  const { updatePanelResult } = useAIPanelStore();

  const handleValidateAndCorrect = useCallback(async () => {
    if (!activeResult || !activeTabId || !currentDataset) {
      toast.error("No data available for validation", {
        style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
      });
      return;
    }
    setIsValidating(true);
    try {
      const result = await validateMutation.mutateAsync({
        originalQuery: activeResult.query ?? "",
        analysisResults: activeResult.analysisResults,
        fullData: currentDataset.rows as Record<string, any>[],
        dataColumns: currentDataset.columns,
        classifications: {},
        conversationHistory: [],
      });

      if (result.corrected || result.requeried) {
        updatePanelResult(activeTabId, activeResult.id, {
          analysisResults: result.analysisResults,
          ...(result.analysis ? { analysis: result.analysis } : {}),
        });
        toast.success(
          result.requeried
            ? `Re-queried AI with corrections — ${result.correctionsApplied} value(s) fixed`
            : `Validated — ${result.correctionsApplied} value(s) corrected`,
          {
            style: { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" },
            duration: 4000,
          }
        );
      } else {
        toast.success("All values verified — no corrections needed", {
          style: { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
          duration: 3000,
        });
      }
    } catch (err) {
      console.error("[validateAndCorrect] Error:", err);
      toast.error("Validation failed — try again", {
        style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
      });
    } finally {
      setIsValidating(false);
    }
  }, [activeResult, activeTabId, currentDataset, validateMutation, updatePanelResult]);

  // Clean export ref — hidden off-screen render for publication-quality exports
  const cleanExportRef = useRef<HTMLDivElement>(null);

  // Editable graph title
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const displayTitle = titleOverride ?? activeResult?.graphTitle ?? null;
  React.useEffect(() => { setTitleOverride(null); }, [activeResult?.id]);

  // ── "Add to Chat" helper ──────────────────────────────────────────────────
  const handleAddToChat = useCallback((content: string) => {
    addToChat(content);
    toast.success("Added to chat input", {
      style: { background: '#eff6ff', color: '#1e40af', borderColor: '#93c5fd' },
      duration: 1500,
    });
  }, [addToChat]);

  // Chart data
  const chartData = activeResult?.analysisResults?.chart_data;
  const analysisType = activeResult?.analysisResults?.analysis_type;

  // NEW: true when the LLM explicitly generated a chart (area/line/KM/box/etc.)
  // REMOVED: was no viz-result flag — table always rendered first regardless of request type
  const isVizResult = analysisType === "llm_chart" && !!chartData;

  // NEW: LLM-requested chart type extracted from chart_data so ChartRenderer uses it.
  // REMOVED: ChartRenderer always used customizations.chartType which defaults to "bar",
  //          causing every LLM chart (area, line, KM…) to silently render as a bar chart.
  const llmChartType: ControlChartType | undefined = (() => {
    const t = chartData?.type as string | undefined;
    if (t && VALID_CHART_TYPES.has(t as ControlChartType)) return t as ControlChartType;
    return undefined;
  })();

  // NEW: auto-sync customizations.chartType when an llm_chart result arrives so the
  //      Customize panel badge and any downstream logic reflect the correct type.
  React.useEffect(() => {
    if (!activeTabId || !llmChartType) return;
    setCustomization(activeTabId, "chartType", llmChartType);
  }, [activeResult?.id, llmChartType, activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // NEW: chart error state — set by ChartErrorBoundary when rendering throws
  const [chartError, setChartError] = useState(false);
  // Reset chart error whenever the active result changes
  React.useEffect(() => { setChartError(false); }, [activeResult?.id]);

  // Dataset table pagination
  const DATASET_PAGE_SIZE = 20;
  const [datasetPage, setDatasetPage] = useState(0);
  // Reset page when result changes
  React.useEffect(() => { setDatasetPage(0); }, [activeResult?.id]);

  // NEW: for llm_chart results the stats table is often just a "Note" row — suppress it
  //      so the chart is the primary visual and the note appears as a small italic caption.
  // REMOVED: was always showing the stats table even when it only contained a footnote
  const isNoteOnlyTable = useMemo(() => {
    if (!isVizResult) return false;
    const tbl: Array<{ metric: string; value: any }> =
      activeResult?.editedTable ??
      activeResult?.analysisResults?.results_table ??
      [];
    return tbl.length === 1 && String(tbl[0]?.metric ?? "").toLowerCase() === "note";
  }, [isVizResult, activeResult]);

  // NEW: detect when the user asked for a chart but the result has no chart_data.
  // Used to show the amber "chart not generated" warning so the user knows why they
  // see a table instead of a visualization.
  // REMOVED: there was no user-visible feedback when chart generation silently failed.
  const isVizQueryByKeywords = useMemo(() => {
    const q = (activeResult?.query ?? "").toLowerCase();
    return [
      "area chart", "area graph", "area plot",
      "line chart", "line graph", "line plot",
      "bar chart", "bar graph", "bar plot",
      "scatter plot", "scatter chart", "scatter graph", "scatterplot",
      "pie chart", "pie graph",
      "kaplan-meier", "kaplan meier", "km curve", "km plot",
      "survival curve", "survival plot",
      "box plot", "boxplot", "box-plot", "box and whisker",
      "violin plot", "violin chart",
      "volcano plot", "volcano chart",
      "forest plot", "forest chart",
      "heatmap", "heat map",
      "generate chart", "create chart", "show chart", "render chart",
      "draw chart", "visualize", "cumulative auc curve", "concentration-time",
    ].some((kw) => q.includes(kw));
  }, [activeResult?.query]);

  // Show warning when a viz was requested but no chart was produced
  const showChartFallbackWarning = isVizQueryByKeywords && !isVizResult && !!activeResult;

  const seriesCount = useMemo(() => {
    if (!chartData) return 1;
    if (chartData.datasets) return chartData.datasets.length;
    return 1;
  }, [chartData]);

  // Table with sort / filter / zebra
  const displayTable = useMemo(() => {
    let table: Array<{ metric: string; value: any }> =
      activeResult?.editedTable ??
      activeResult?.analysisResults?.results_table ??
      [];

    if (customizations.tableFilter) {
      const q = customizations.tableFilter.toLowerCase();
      table = table.filter((r) =>
        String(r.metric).toLowerCase().includes(q)
      );
    }

    if (customizations.tableSort) {
      const { column, direction } = customizations.tableSort;
      table = [...table].sort((a, b) => {
        const av = column === "metric" ? String(a.metric) : a.value;
        const bv = column === "metric" ? String(b.metric) : b.value;
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return direction === "asc" ? cmp : -cmp;
      });
    }

    return table;
  }, [activeResult, customizations.tableFilter, customizations.tableSort]);

  // ── Table → Chart live sync ──────────────────────────────────────────────
  // Rebuilds chartData from editedTable so Recharts auto-re-renders whenever
  // the user edits a VALUE cell in the Statistics Summary table.
  // Only syncs when the edited row count matches chart label count (1:1 mapping).
  const syncedChartData = useMemo(() => {
    if (!chartData) return null;
    const editedRows = activeResult?.editedTable;
    if (!editedRows || editedRows.length === 0) return chartData;
    if (!chartData.labels || !chartData.datasets) return chartData;
    if (editedRows.length !== chartData.labels.length) return chartData;
    return {
      ...chartData,
      labels: editedRows.map((r: any) => String(r.metric ?? "")),
      datasets: chartData.datasets.map((ds: any) => ({
        ...ds,
        data: editedRows.map((r: any) => {
          const v = Number(r.value);
          return isNaN(v) ? 0 : v;
        }),
      })),
    };
  }, [chartData, activeResult?.editedTable]);

  // True when editedTable has diverged from original chart_data — drives the "Live" badge
  const hasTableSync = useMemo(
    () => !!activeResult?.editedTable && syncedChartData !== chartData,
    [activeResult?.editedTable, syncedChartData, chartData]
  );

  // ── Auto-chart from stats table (no LLM chart_data) ─────────────────────
  // When there is no LLM-generated chart_data but the stats table has ≥2 numeric
  // rows, synthesise a bar chart so VALUE cell edits instantly update the preview.
  const autoChartFromTable = useMemo(() => {
    if (chartData) return null; // real chart_data takes precedence
    if (displayTable.length === 0) return null;
    const numRows = (displayTable as Array<{ metric: string; value: any }>).filter(
      (r) => r.value !== "" && !isNaN(Number(r.value))
    );
    if (numRows.length < 2) return null;
    return {
      labels: numRows.map((r) => String(r.metric ?? "")),
      datasets: [{ label: "Value", data: numRows.map((r) => Number(r.value)) }],
    };
  }, [chartData, displayTable]);

  // Customization handlers
  const handleSet = useCallback(
    <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => {
      if (!activeTabId) return;
      if (key === "chartType" && value === "scatter" && chartData && !chartData.points) {
        toast.warning("Data not suitable for Scatter — rendering as bar.", {
          description: "Try Line or Area for this label-based dataset.",
          duration: 4000,
        });
      }
      setCustomization(activeTabId, key, value);
    },
    [activeTabId, chartData, setCustomization]
  );

  const handleReset = useCallback(() => {
    if (activeTabId) resetCustomizations(activeTabId);
  }, [activeTabId, resetCustomizations]);



  // BEFORE: requestedChartType useMemo — used to detect pharma chart type for PharmaChartPanel
  // AFTER:  removed — Charts tab is gone; Recharts ChartRenderer handles all chart output inline

  // BEFORE: const [view, setView] = useState<"charts" | "results">("charts")
  //         React.useEffect(() => { if (results.length > 0) setView("results"); }, [results.length])
  // AFTER:  view state removed — single panel always shows results

  // ── BLANK STATE ─────────────────────────────────────────────────────────
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#f8fafc] select-none px-10">
        <div className="flex flex-col items-center gap-5 text-center max-w-sm">
          {/* Icon */}
          <Calculator
            className="text-[#94a3b8]"
            style={{ width: 52, height: 52, strokeWidth: 1.5 }}
          />

          {/* Primary heading */}
          <div className="space-y-1">
            <p className="text-base font-semibold text-[#334155] leading-snug">
              No results generated yet
            </p>
            <p className="text-sm text-[#64748b] leading-relaxed">
              Ask Nuphorm to calculate — and see your results appear here.
            </p>
          </div>

          {/* Capability list */}
          <div className="text-left w-full">
            <p className="text-xs text-[#64748b] mb-2 leading-relaxed">
              Enter a biostatistics query in the chat input below to produce:
            </p>
            <ul className="space-y-1.5">
              {[
                "Summary statistics and editable tables",
                "Inferential analyses (t-tests, ANOVA, non-parametric tests, etc.)",
                "Survival estimates (Kaplan-Meier curves)",
                "Pharmacokinetic parameters and visualizations",
                "Custom plots (scatter, box, volcano, forest, heatmaps, and more)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-[#64748b] leading-relaxed">
                  <span className="mt-[3px] shrink-0 w-1 h-1 rounded-full bg-[#94a3b8]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Body sentence */}
          <p className="text-xs text-[#64748b] leading-relaxed">
            All generated outputs — tables, charts, and interpretations — will populate this panel instantly.
          </p>

          {/* Footer */}
          <p className="text-xs text-[#94a3b8] leading-relaxed">
            Ready when you are. Upload clean data and begin your analysis.
          </p>
        </div>
      </div>
    );
  }

  // BEFORE: if (view === "charts") { return <PharmaChartPanel … /> }
  // AFTER:  Charts tab removed — single results view always rendered below

  // ── Series labels for sidebar ────────────────────────────────────────────
  const seriesLabels = useMemo(() => {
    if (!chartData?.datasets) return undefined;
    return chartData.datasets.map((ds: any) => ds.label ?? "Series");
  }, [chartData]);

  // ── DataPointsTable handler — updates chart_data in store ────────────
  const handleDataPointsChange = useCallback((updatedChartData: any) => {
    if (!activeTabId || !activeResult) return;
    updatePanelResult(activeTabId, activeResult.id, {
      analysisResults: {
        ...activeResult.analysisResults,
        chart_data: updatedChartData,
      },
    });
  }, [activeTabId, activeResult, updatePanelResult]);

  // ── RESULTS VIEW ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden bg-[#f8fafc]">
    {/* Main content area */}
    <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      {/* BEFORE: had Charts | Results view-toggle button group on the left   */}
      {/* AFTER:  single panel — title + inline pagination left, controls right */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#e2e8f0] bg-white">

        {/* Left: icon + title + pagination (when >1 result) */}
        <div className="flex items-center gap-2 min-w-0">
          <BarChart2 className="w-4 h-4 text-[#3b82f6] flex-shrink-0" />
          <span className="font-semibold text-sm text-[#0f172a] truncate">
            {results.length > 1
              ? `Results — ${activeIndex + 1} / ${results.length}`
              : "Analysis Results"}
          </span>

          {/* Inline pagination — shown only when multiple results exist */}
          {results.length > 1 && (
            <div className="flex items-center gap-0.5 ml-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-[#64748b] hover:text-[#0f172a]"
                disabled={activeIndex <= 0}
                onClick={() =>
                  activeTabId &&
                  setActiveResult(activeTabId, results[activeIndex - 1].id)
                }
                title="Previous result"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-[#64748b] hover:text-[#0f172a]"
                disabled={activeIndex >= results.length - 1}
                onClick={() =>
                  activeTabId &&
                  setActiveResult(activeTabId, results[activeIndex + 1].id)
                }
                title="Next result"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Right: Customize · Validate & Correct · Save · Clear */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Customize — deep blue button that toggles the right sidebar */}
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="inline-flex items-center gap-1.5 h-7 px-4 text-xs font-medium text-white shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-1"
            style={{
              backgroundColor: '#194CFF',
              borderRadius: '0.75rem',
              padding: '0.5rem 1rem',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#3B82F6'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#194CFF'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            aria-label="Toggle customization sidebar"
            aria-expanded={sidebarOpen}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Customize
          </button>

          {/* Validate & Correct — deep blue */}
          <button
            onClick={handleValidateAndCorrect}
            disabled={!activeResult || !currentDataset || isValidating}
            className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium text-white shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#194CFF',
              borderRadius: '0.75rem',
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) { (e.currentTarget as HTMLElement).style.backgroundColor = '#3B82F6'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#194CFF'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            title="Validate output against original data and correct hallucinations"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {isValidating ? "Validating\u2026" : "Validate & Correct"}
          </button>

          {/* Save — green */}
          <button
            onClick={() => setSaveModalOpen(true)}
            disabled={!activeResult}
            className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium text-white shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#22C55E',
              borderRadius: '0.75rem',
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) { (e.currentTarget as HTMLElement).style.backgroundColor = '#16A34A'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#22C55E'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            title="Save analysis to Technical Files"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>

          {/* Clear — red */}
          <button
            onClick={() => activeTabId && clearResults(activeTabId)}
            className="inline-flex items-center gap-1.5 h-7 px-2 text-xs font-medium shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1"
            style={{
              backgroundColor: '#EF4444',
              color: '#ffffff',
              borderRadius: '0.75rem',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#DC2626'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EF4444'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            title="Clear all results for this tab"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Auto-fit title — dynamically resizes to prevent cutoff */}
        {(customizations.chartTitle || displayTitle) && (
          <div className="relative group">
            <AutoFitTitle
              title={customizations.chartTitle || displayTitle || ""}
              className="px-2 py-1 -mx-2 rounded-lg hover:bg-[#eff6ff] transition-colors cursor-text"
            />
            {/* Editable overlay on click */}
            <div
              className="absolute inset-0 px-2 py-1 -mx-2"
              contentEditable
              suppressContentEditableWarning
              title="Click to edit title"
              style={{ color: "transparent", caretColor: "#194CFF" }}
              onFocus={(e) => {
                e.currentTarget.style.color = "#194CFF";
                e.currentTarget.style.backgroundColor = "#eff6ff";
                e.currentTarget.style.borderRadius = "0.5rem";
              }}
              onBlur={(e) => {
                const val = e.currentTarget.textContent?.trim() ?? "";
                e.currentTarget.style.color = "transparent";
                e.currentTarget.style.backgroundColor = "transparent";
                if (val) {
                  setTitleOverride(val);
                  if (activeTabId) setCustomization(activeTabId, "chartTitle", val);
                }
              }}
            >
              {customizations.chartTitle || displayTitle}
            </div>
          </div>
        )}

        {/* Subtitle — shown for dataset_generation and any result with a subtitle */}
        {activeResult?.analysisResults?.subtitle && (
          <p className="text-sm text-[#64748b] leading-relaxed -mt-2">
            {activeResult.analysisResults.subtitle}
          </p>
        )}

        {/* Query caption */}
        {activeResult?.query && (
          <p className="text-xs text-[#64748b]">
            <span className="font-medium text-[#0f172a]/70">Query: </span>
            <em>{activeResult.query}</em>
            {analysisType && (
              <Badge
                variant="outline"
                className="ml-2 text-xs capitalize border-[#e2e8f0] text-[#64748b]"
              >
                {analysisType.replace(/_/g, " ")}
              </Badge>
            )}
          </p>
        )}

        {/* ── NEW: chart-requested-but-table-returned warning ──────────────── */}
        {/* RESTORED: previously there was no user-facing signal when chart gen failed —  */}
        {/*           users just saw a silent table with no explanation.                  */}
        {/* showChartFallbackWarning = isVizQueryByKeywords && !isVizResult && !!activeResult */}
        {showChartFallbackWarning && (
          <div
            className="flex items-start gap-3 text-amber-700 bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm"
            role="alert"
            aria-label="Chart generation notice"
          >
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold">Chart generation failed — showing table instead</p>
              <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
                The AI did not return chart data for this request. Try rephrasing:{" "}
                <em>"Generate an area chart of…"</em> or{" "}
                <em>"Show a bar chart comparing…"</em>. Check the browser console for{" "}
                <code className="font-mono text-[11px] bg-amber-100 px-1 rounded">[ChartDetect]</code>{" "}
                logs to diagnose why chart detection fired or was skipped.
              </p>
            </div>
          </div>
        )}

        {/* ── Blocked analysis error card ──────────────────────────────────── */}
        {/* When the backend blocks a synthetic/fabricated chart, it returns an     */}
        {/* "Error" row in results_table. Show a red error card instead of chart.   */}
        {activeResult?.analysisResults?.results_table?.[0]?.metric === "Error" && (() => {
          const errorValue = activeResult.analysisResults.results_table[0].value ?? "";
          const isSubjectMismatch = errorValue.includes("subject mismatch");
          return (
            <div
              className="flex items-start gap-3 text-red-800 bg-red-50 border border-red-300 p-4 rounded-xl text-sm"
              role="alert"
              aria-label="Analysis blocked"
            >
              <TriangleAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold">
                  {isSubjectMismatch ? "Analysis blocked — subject mismatch" : "Analysis blocked"}
                </p>
                <p className="text-red-700 text-xs mt-1 leading-relaxed">
                  {isSubjectMismatch
                    ? "The AI reported subjects not found in the uploaded file. No fabricated data will be shown. Please re-run the analysis."
                    : "The AI did not return verifiable data from the uploaded file. Please rephrase your query or re-upload your data."}
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── Chart card (shared JSX — rendered above or below stats table) ── */}
        {/* NEW: extracted so we can render it first for llm_chart (viz) results.   */}
        {/* REMOVED: chart was always below the stats table even for chart requests. */}
        {chartData && activeResult?.analysisResults?.results_table?.[0]?.metric !== "Error" && (() => {
          const chartLabel = (llmChartType ?? customizations.chartType);
          const headerLabel = isVizResult ? "Chart" : (
            analysisType
              ? `${analysisType.charAt(0).toUpperCase()}${analysisType.slice(1).replace(/_/g, " ")} Chart`
              : "Chart"
          );

          const isGraphSelected = selectedGraphId === activeResult?.id;

          return (
            // NEW: for viz results, chart is the primary output — render it first.
            // Container uses the exact Tailwind classes requested for production readiness.
            // Clickable for graph-edit mode: click to highlight, click again to deselect.
            <Card
              className={`w-full bg-white rounded-xl shadow-sm overflow-hidden flex flex-col cursor-pointer transition-all duration-200 ${
                isGraphSelected
                  ? 'border-2 ring-2 ring-[#60a5fa]/40'
                  : 'border border-slate-200 hover:border-slate-300'
              }`}
              style={isGraphSelected ? { borderColor: '#1a202c' } : undefined}
              onClick={() => {
                if (!activeResult?.id) return;
                setSelectedGraph(isGraphSelected ? null : activeResult.id);
              }}
              aria-label={`${headerLabel} — ${activeResult?.graphTitle ?? activeResult?.query ?? "analysis"}${isGraphSelected ? ' (selected for editing)' : ''}`}
              role="img"
              data-chart-capture={activeResult?.id ?? ""}
              data-export-target=""
            >
              <CardHeader className="flex-shrink-0 py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
                <CardTitle className="text-sm flex items-center justify-between text-[#0f172a]">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
                    {headerLabel}
                    <Badge className="text-[10px] h-4 bg-[#f1f5f9] text-[#64748b] border-0 capitalize font-normal">
                      {chartLabel}
                    </Badge>
                    {hasTableSync && (
                      <Badge className="text-[10px] h-4 bg-blue-50 text-[#3b82f6] border border-[#3b82f6]/30 font-normal ml-0.5">
                        Live
                      </Badge>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const cd = activeResult?.analysisResults?.chart_data;
                        const title = displayTitle || activeResult?.graphTitle || "Chart";
                        const content = cd
                          ? `**${title}**\n\`\`\`json\n${JSON.stringify(cd, null, 2)}\n\`\`\``
                          : `Chart: ${title}`;
                        handleAddToChat(content);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#3b82f6] bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#3b82f6]/40 transition-colors"
                      title="Add chart data to chat input"
                    >
                      <MessageSquarePlus className="w-3 h-3 text-[#94a3b8]" />
                      Add to Chat
                    </button>
                    <ExportDropdown
                      type="chart"
                      title={displayTitle || activeResult?.graphTitle}
                      query={activeResult?.query}
                      cleanExportRef={cleanExportRef}
                    />
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 pt-3" data-chart-export={activeResult?.id}>
                {chartError ? (
                  // NEW: error fallback — replaces ChartRenderer output when boundary catches
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                    <p className="text-sm text-[#64748b]">
                      Chart rendering error — data may be malformed.
                    </p>
                    <div className="flex gap-3">
                      <button
                        className="text-xs text-[#3b82f6] underline underline-offset-2 hover:text-[#1d4ed8] transition-colors"
                        onClick={() => setChartError(false)}
                        aria-label="Retry chart render"
                      >
                        Retry
                      </button>
                      <span className="text-xs text-[#94a3b8]">or</span>
                      <button
                        className="text-xs text-[#64748b] underline underline-offset-2 hover:text-[#0f172a] transition-colors"
                        onClick={() => {
                          // Scroll to the stats table below
                          document.querySelector("[data-stats-table]")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        aria-label="View data as table"
                      >
                        View as table ↓
                      </button>
                    </div>
                  </div>
                ) : (
                  // Conditionally render Plotly for survival/pharma data, Recharts for standard
                  <ChartErrorBoundary onError={() => setChartError(true)}>
                    {isPlotlyChartData(syncedChartData ?? chartData) ? (
                      <PlotlyInteractiveChart
                        config={{
                          mode: (syncedChartData ?? chartData)?.pharma_type ?? 'auto',
                          chartData: syncedChartData ?? chartData,
                          title: activeResult?.graphTitle ?? undefined,
                        }}
                        onPointClick={(pt) => {
                          console.log('[PlotlyChart] Point clicked:', pt);
                        }}
                        onEditAction={(action, ctx) => {
                          if (!activeResult?.id) return;
                          const actionDescriptions: Record<string, string> = {
                            add_labels: 'Add data labels to all data points on the chart',
                            bar_at_month_12: 'Add a vertical reference bar or annotation at Month 12',
                            pairwise_table: 'Add a pairwise comparison table showing statistical differences between groups',
                            percent_improvement: 'Calculate and annotate percent improvement between treatment groups',
                            add_trendline: 'Add a linear trendline to each data series',
                          };
                          const editText = actionDescriptions[action] ?? action.replace(/_/g, ' ');
                          const pointCtx = ctx ? ` (context: point at x=${ctx.x}, y=${ctx.y}, trace=${ctx.trace})` : '';
                          useAIPanelStore.getState().queueGraphEdit(activeResult.id, editText + pointCtx);
                        }}
                        height={380}
                      />
                    ) : (
                      <ChartRenderer
                        // Use syncedChartData when table edits exist; falls back to original
                        chartData={syncedChartData ?? chartData}
                        customizations={customizations}
                        colors={activeColors}
                        preferredType={llmChartType}
                      />
                    )}
                  </ChartErrorBoundary>
                )}
              </CardContent>
              {/* NEW: show the "Note" row as a small italic caption beneath the chart */}
              {isNoteOnlyTable && (
                <p className="flex-shrink-0 text-xs italic text-[#94a3b8] px-4 pb-2.5 border-t border-[#e2e8f0] pt-2">
                  {String(activeResult?.analysisResults?.results_table?.[0]?.value ?? "")}
                </p>
              )}
              {/* Graph-edit hint — visible when this chart is selected */}
              {isGraphSelected && (
                <div className="flex-shrink-0 px-4 py-2 border-t border-[#e2e8f0] bg-[#f0fdf4]">
                  <p className="text-xs text-emerald-700 font-medium">
                    Graph selected — type your edit in the chat below (e.g. "change to bar chart" or "add error bars")
                  </p>
                </div>
              )}
            </Card>
          );
        })()}

        {/* ── Fallback: chart source data table ─────────────────────────────────── */}
        {/* When the AI returns a chart (isVizResult) but the results_table is only a  */}
        {/* "Note" row or empty, auto-render the chart's underlying data as a table.   */}
        {isVizResult && isNoteOnlyTable && chartData && (() => {
          // Extract tabular data from chartData (labels + datasets format)
          const labels: string[] = chartData.labels ?? [];
          const datasets: Array<{ label: string; data: number[] }> = chartData.datasets ?? [];
          if (labels.length === 0 || datasets.length === 0) return null;

          const dsLabels = datasets.map((ds: any) => ds.label ?? "Value");

          return (
            <Card className="border border-[#e2e8f0] shadow-sm rounded-xl overflow-hidden" data-stats-table="">
              <CardHeader className="py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
                <CardTitle className="text-sm flex items-center justify-between text-[#0f172a]">
                  <span className="flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-[#3b82f6]" />
                    Chart Source Data
                    <Badge className="text-[10px] h-4 bg-blue-50 text-[#3b82f6] border border-[#3b82f6]/30 font-normal">
                      auto-generated
                    </Badge>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-[#64748b] border-[#e2e8f0] hover:bg-[#f8fafc] hover:text-[#0f172a] gap-1"
                    onClick={() =>
                      downloadChartDataAsCSV(
                        labels,
                        datasets,
                        buildCSVFilename("chart_data", activeResult?.query)
                      )
                    }
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                        <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                          Label
                        </th>
                        {dsLabels.map((dl: string, i: number) => (
                          <th key={i} className="text-right py-2 px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap">
                            {dl}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {labels.map((label: string, rowIdx: number) => (
                        <tr
                          key={rowIdx}
                          className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#eff6ff] transition-colors"
                          style={
                            customizations.zebraStriping && rowIdx % 2 === 0
                              ? { backgroundColor: "#f1f5f9" }
                              : undefined
                          }
                        >
                          <td className="py-1.5 px-4 font-medium text-[#0f172a]">{label}</td>
                          {datasets.map((ds: any, dsIdx: number) => (
                            <td key={dsIdx} className="py-1.5 px-4 text-right font-mono text-xs text-[#0f172a]">
                              {typeof ds.data?.[rowIdx] === "number"
                                ? Number.isInteger(ds.data[rowIdx])
                                  ? ds.data[rowIdx]
                                  : ds.data[rowIdx].toFixed(2)
                                : String(ds.data?.[rowIdx] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Auto-chart from table — rendered when no LLM chart_data exists but stats table  */}
        {/* has ≥2 numeric rows. Editing any VALUE cell instantly updates this chart because  */}
        {/* autoChartFromTable is derived from displayTable which reads from editedTable.      */}
        {autoChartFromTable && !isNoteOnlyTable && !isVizResult && (() => {
          const autoChartId = activeResult?.id ? `auto-${activeResult.id}` : null;
          const isAutoSelected = selectedGraphId === autoChartId;
          return (
            <Card
              className={`cursor-pointer transition-all duration-200 rounded-xl overflow-hidden ${
                isAutoSelected
                  ? 'border-2 ring-2 ring-[#60a5fa]/40'
                  : 'border border-[#e2e8f0] shadow-sm hover:border-slate-300'
              }`}
              style={isAutoSelected ? { borderColor: '#1a202c' } : undefined}
              onClick={() => {
                if (!autoChartId) return;
                setSelectedGraph(isAutoSelected ? null : autoChartId);
              }}
            >
              <CardHeader className="py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
                <CardTitle className="text-sm flex items-center gap-2 text-[#0f172a]">
                  <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
                  Live Preview
                  <Badge className="text-[10px] h-4 bg-blue-50 text-[#3b82f6] border border-[#3b82f6]/30 font-normal">
                    synced from table
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 pt-3" data-chart-export={activeResult?.id}>
                <ChartErrorBoundary onError={() => {}}>
                  <ChartRenderer
                    chartData={autoChartFromTable}
                    customizations={customizations}
                    colors={activeColors}
                  />
                </ChartErrorBoundary>
              </CardContent>
              {isAutoSelected && (
                <div className="flex-shrink-0 px-4 py-2 border-t border-[#e2e8f0] bg-[#f0fdf4]">
                  <p className="text-xs text-emerald-700 font-medium">
                    Graph selected — type your edit in the chat below
                  </p>
                </div>
              )}
            </Card>
          );
        })()}

        {/* Stats table */}
        {/* Shown when there are real data rows (not just a "Note" row).                       */}
        {/* Now also shown alongside charts (isVizResult) so users always get both              */}
        {/* a visual and tabular representation of the data.                                    */}
        {displayTable.length > 0 && !isNoteOnlyTable && (
          <Card className="border border-[#e2e8f0] shadow-sm rounded-xl overflow-hidden" data-stats-table="" data-export-target="">
            <CardHeader className="py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
              <CardTitle className="text-sm flex items-center justify-between text-[#0f172a]">
                <span className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-[#3b82f6]" />
                  Statistics Summary
                  <span className="text-xs font-normal text-[#64748b]">
                    — click any cell to edit
                  </span>
                  {customizations.tableFilter && (
                    <Badge className="text-[10px] h-4 bg-blue-50 text-[#3b82f6] border border-[#3b82f6]/20 ml-1">
                      filtered
                    </Badge>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const rows = displayTable.map((r: any) => `| ${r.metric} | ${r.value} |`).join('\n');
                      const md = `| Metric | Value |\n|--------|-------|\n${rows}`;
                      handleAddToChat(md);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#3b82f6] bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#3b82f6]/40 transition-colors"
                    title="Add table data to chat input"
                  >
                    <MessageSquarePlus className="w-3 h-3 text-[#94a3b8]" />
                    Add to Chat
                  </button>
                  <ExportDropdown
                    type="table"
                    title={displayTitle || activeResult?.graphTitle}
                    query={activeResult?.query}
                    tableData={displayTable}
                  />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0]" style={{ background: "linear-gradient(180deg, #E0F2FE 0%, #F8FAFC 100%)" }}>
                    <th className="text-left py-2 px-4 text-xs font-bold text-[#0f172a] uppercase tracking-wide">
                      Metric
                    </th>
                    <th className="text-right py-2 px-4 text-xs font-bold text-[#0f172a] uppercase tracking-wide">
                      Value
                    </th>
                    {activeResult?.analysisResults?._dataValidation?.validated && (
                      <th className="text-center py-2 px-4 text-xs font-bold text-[#0f172a] uppercase tracking-wide" style={{ width: 100 }}>
                        Validation
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayTable.map((row: any, rowIdx: number) => {
                    const validation = row._validation as string | undefined;
                    const isValidated = activeResult?.analysisResults?._dataValidation?.validated;
                    return (
                    <tr
                      key={rowIdx}
                      className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#eff6ff] transition-colors"
                      style={
                        customizations.zebraStriping && rowIdx % 2 === 0
                          ? { backgroundColor: "#f1f5f9" }
                          : undefined
                      }
                    >
                      <td className="py-1.5 px-4">
                        <EditableCell
                          value={row.metric}
                          resultId={activeResult!.id}
                          rowIndex={rowIdx}
                          field="metric"
                          align="left"
                        />
                      </td>
                      <td
                        className="py-1.5 px-4 text-right"
                        style={validation === "corrected" ? { color: "#f59e0b" } : undefined}
                        title={validation === "corrected" ? `Original AI value: ${row._originalLLMValue ?? "?"} — corrected` : undefined}
                      >
                        <EditableCell
                          value={row.value}
                          resultId={activeResult!.id}
                          rowIndex={rowIdx}
                          field="value"
                          align="right"
                        />
                      </td>
                      {isValidated && (
                        <td className="py-1.5 px-4 text-center">
                          {validation === "exact_match" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#22c55e" }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#22c55e" }} />
                              Verified
                            </span>
                          )}
                          {validation === "corrected" && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium cursor-help"
                              style={{ color: "#f59e0b" }}
                              title={`Original AI value: ${row._originalLLMValue ?? "?"} — corrected to match source data`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                              Corrected
                            </span>
                          )}
                          {validation === "unmatched" && (
                            <span className="text-xs text-[#94a3b8]">—</span>
                          )}
                          {!validation && (
                            <span className="text-xs text-[#94a3b8]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Validation footer — shown when data was cross-verified against original CSV */}
              {activeResult?.analysisResults?._dataValidation?.validated && (
                <div
                  className="flex items-center gap-2 px-4 py-2 border-t border-[#e2e8f0]"
                  style={{ backgroundColor: "#f0fdf4" }}
                >
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#22c55e" }} />
                  <span className="text-xs" style={{ color: "#15803d" }}>
                    Data validated against original CSV to prevent inaccuracies.
                    {(activeResult.analysisResults._dataValidation.correctionsApplied ?? 0) > 0 && (
                      <span className="font-medium" style={{ color: "#f59e0b" }}>
                        {" "}{activeResult.analysisResults._dataValidation.correctionsApplied} value(s) corrected.
                      </span>
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Data Points Table — editable, updates chart in real-time ─── */}
        {chartData && chartData.labels && chartData.datasets && !isNoteOnlyTable && (
          <DataPointsTable
            chartData={syncedChartData ?? chartData}
            onDataChange={handleDataPointsChange}
            xAxisLabel={customizations.xLabel || undefined}
          />
        )}

        {/* Legacy inline data points table removed — replaced by DataPointsTable component above */}

        {/* Diff viewer: side-by-side original vs. generated — shown when corrections detected */}
        {activeResult?.analysisResults?._dataValidation?.validated &&
          (activeResult.analysisResults._dataValidation.correctionsApplied ?? 0) > 0 &&
          activeResult.analysisResults._dataValidation.originalGroupData?.length > 0 && (() => {
            const validation = activeResult.analysisResults._dataValidation;
            const table = activeResult.analysisResults.results_table ?? [];
            const groupData = validation.originalGroupData as Array<{ group: string; values: Record<string, number> }>;
            // Pick the first numeric column for display
            const displayCol = (validation.numericColumns as string[])?.[0] ?? "";

            // Log mismatches to console for VS Code debugging
            if (process.env.NODE_ENV !== "production") {
              table.forEach((row: any) => {
                if (row._validation === "corrected") {
                  console.warn(
                    `[DataValidation] Mismatch: "${row.metric}" — LLM: ${row._originalLLMValue}, Original: ${row.value}`,
                    { displayCol, originalGroupData: groupData }
                  );
                }
              });
            }

            return (
              <Card className="border border-[#e2e8f0] shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
                  <CardTitle className="text-sm flex items-center gap-2 text-[#0f172a]">
                    <ShieldCheck className="w-4 h-4" style={{ color: "#f59e0b" }} />
                    Data Integrity — Original vs. Generated
                    <span className="text-xs font-normal text-[#64748b]">
                      — {validation.correctionsApplied} correction(s)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: "#1a202c", color: "#ffffff" }}>
                        <th className="text-left py-2 px-4 text-xs font-semibold uppercase tracking-wide">
                          {validation.groupColumn ?? "Group"} (Original)
                        </th>
                        <th className="text-right py-2 px-4 text-xs font-semibold uppercase tracking-wide">
                          Value (Original)
                        </th>
                        <th className="text-right py-2 px-4 text-xs font-semibold uppercase tracking-wide">
                          Generated
                        </th>
                        <th className="text-center py-2 px-4 text-xs font-semibold uppercase tracking-wide">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupData.map((origRow: any, idx: number) => {
                        const matchedRow = table.find(
                          (r: any) => String(r.metric ?? "").trim().toLowerCase() === origRow.group.trim().toLowerCase()
                        );
                        const originalVal = displayCol ? origRow.values[displayCol] : null;
                        const generatedVal = matchedRow?._validation === "corrected"
                          ? matchedRow._originalLLMValue
                          : matchedRow?.value;
                        const isMatch = matchedRow?._validation === "exact_match";
                        const isCorrected = matchedRow?._validation === "corrected";

                        return (
                          <tr
                            key={idx}
                            className="border-b border-[#e2e8f0] last:border-0"
                            style={{ backgroundColor: "#f1f5f9" }}
                          >
                            <td className="py-1.5 px-4 text-[#0f172a] font-medium">{origRow.group}</td>
                            <td className="py-1.5 px-4 text-right font-mono text-xs text-[#0f172a]">
                              {originalVal != null ? String(originalVal) : "—"}
                            </td>
                            <td className="py-1.5 px-4 text-right font-mono text-xs text-[#0f172a]">
                              {generatedVal != null ? String(generatedVal) : "—"}
                            </td>
                            <td className="py-1.5 px-4 text-center">
                              {isMatch && (
                                <span className="text-xs font-medium" style={{ color: "#3b82f6" }}>Match</span>
                              )}
                              {isCorrected && (
                                <span className="text-xs font-medium" style={{ color: "#f59e0b" }}>Corrected</span>
                              )}
                              {!isMatch && !isCorrected && (
                                <span className="text-xs text-[#94a3b8]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })()}

        {/* Retry Analysis button — shown when hallucinations were corrected */}
        {activeResult?.analysisResults?._dataValidation?.validated &&
          (activeResult.analysisResults._dataValidation.correctionsApplied ?? 0) > 0 && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="gap-2 text-sm font-medium border-[#e2e8f0] hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a]"
                onClick={() => {
                  const query = activeResult?.query;
                  if (query) {
                    // Dispatch a custom event for the chat component to pick up
                    document.dispatchEvent(
                      new CustomEvent("nuphorm-retry-analysis", { detail: { query } })
                    );
                    toast("Retrying analysis with stricter validation…", {
                      style: { backgroundColor: "#64748b", color: "#fff", border: "none" },
                    });
                  }
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Analysis
              </Button>
            </div>
          )}

        {/* Clean Dataset download — shown for data_cleaning results with a dataset */}
        {activeResult?.analysisResults?.analysis_type === "data_cleaning" &&
          activeResult?.tableData?.rows?.length > 0 && (
            <div className="flex justify-center">
              <Button
                className="bg-[#3b82f6] hover:bg-[#1d4ed8] text-white shadow-sm gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
                onClick={() => {
                  const headers = activeResult!.tableData.headers as string[];
                  const rows = activeResult!.tableData.rows as any[][];
                  const date = new Date().toISOString().slice(0, 10);
                  const origName = (activeResult!.query ?? "dataset")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "_")
                    .slice(0, 30)
                    .replace(/_+$/, "");
                  downloadDatasetAsCSV(
                    headers,
                    rows,
                    `nuphorm_clean_${origName}_${date}.csv`
                  );
                }}
              >
                <Download className="w-4 h-4" />
                Download Clean Dataset (.csv)
              </Button>
            </div>
          )}

        {/* Raw data table */}
        {activeResult?.tableData?.rows?.length > 0 && (() => {
          const allRows: any[][] = activeResult.tableData.rows;
          const totalRows = allRows.length;
          const totalPages = Math.ceil(totalRows / DATASET_PAGE_SIZE);
          const startIdx = datasetPage * DATASET_PAGE_SIZE;
          const endIdx = Math.min(startIdx + DATASET_PAGE_SIZE, totalRows);
          const pageRows = allRows.slice(startIdx, endIdx);

          return (
            <Card className="border border-[#e2e8f0] shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
                <CardTitle className="text-sm flex items-center justify-between text-[#0f172a]">
                  <span className="flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-[#3b82f6]" />
                    Dataset
                    <span className="text-xs font-normal text-[#64748b]">
                      — {totalRows} observation{totalRows !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-[#64748b] border-[#e2e8f0] hover:bg-[#f8fafc] hover:text-[#0f172a] gap-1"
                    onClick={() =>
                      downloadDatasetAsCSV(
                        activeResult!.tableData.headers,
                        activeResult!.tableData.rows,
                        buildCSVFilename("dataset", activeResult?.query)
                      )
                    }
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto" style={{ maxWidth: "100%" }}>
                  <table className="text-sm" style={{ minWidth: `${activeResult.tableData.headers.length * 100}px` }}>
                    <thead className="sticky top-0 bg-[#f8fafc] z-10">
                      <tr className="border-b border-[#e2e8f0]">
                        {activeResult.tableData.headers.map((h: string, i: number) => (
                          <th
                            key={i}
                            className="text-left py-2 px-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap"
                            style={{ minWidth: "100px" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row: any[], rowIdx: number) => (
                        <tr
                          key={startIdx + rowIdx}
                          className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#eff6ff] transition-colors"
                          style={
                            customizations.zebraStriping && rowIdx % 2 === 0
                              ? { backgroundColor: "#f1f5f9" }
                              : undefined
                          }
                        >
                          {row.map((cell: any, cellIdx: number) => (
                            <td
                              key={cellIdx}
                              className="py-1.5 px-3 font-mono text-xs text-[#0f172a] whitespace-nowrap"
                              style={{ minWidth: "100px" }}
                            >
                              {typeof cell === "number" && !Number.isInteger(cell)
                                ? cell.toFixed(4)
                                : String(cell ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination footer */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t border-[#e2e8f0] bg-[#f8fafc]">
                    <span className="text-xs text-[#64748b]">
                      Showing rows {startIdx + 1}–{endIdx} of {totalRows}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDatasetPage((p) => Math.max(0, p - 1))}
                        disabled={datasetPage === 0}
                        className="text-xs px-2.5 py-1 rounded border border-[#e2e8f0] text-[#374151] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-[#64748b] tabular-nums">
                        {datasetPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setDatasetPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={datasetPage >= totalPages - 1}
                        className="text-xs px-2.5 py-1 rounded border border-[#e2e8f0] text-[#374151] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
                {/* Table note (synthetic data disclaimer, etc.) */}
                {activeResult.analysisResults?.tableNote && (
                  <p className="text-xs italic text-[#94a3b8] px-4 py-2.5 border-t border-[#e2e8f0]">
                    {activeResult.analysisResults.tableNote}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* AI interpretation / analysis text.
            Show when: no structured table/chart (fallback), OR analysis is pure narrative
            alongside a structured table. Hide only when analysis IS a raw markdown table
            and a structured table is already shown (avoids duplicate display). */}
        {activeResult?.analysis &&
          (displayTable.length === 0 && !chartData
            ? true  // always show if there's nothing else
            : !/\|\s*[-:]+[-|\s:]*\|/.test(activeResult.analysis)  // hide only if analysis IS a raw table
          ) && (
            <Card className="border border-[#e2e8f0] shadow-sm rounded-xl">
              <CardHeader className="py-2 px-4 border-b border-[#e2e8f0] bg-white">
                <CardTitle className="text-sm flex items-center justify-between text-[#0f172a]">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
                    Interpretation
                  </span>
                  <button
                    onClick={() => handleAddToChat(activeResult.analysis)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#3b82f6] bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#3b82f6]/40 transition-colors"
                    title="Add interpretation to chat input"
                  >
                    <MessageSquarePlus className="w-3 h-3 text-[#94a3b8]" />
                    Add to Chat
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 pb-4">
                <MarkdownContent content={activeResult.analysis} />
              </CardContent>
            </Card>
          )}
      </div>

      {/* Hidden clean export render — off-screen, used as source for publication-quality exports */}
      {chartData && activeResult?.analysisResults?.results_table?.[0]?.metric !== "Error" && (
        <div
          ref={cleanExportRef}
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-9999px",
            top: "-9999px",
            width: 800,
            backgroundColor: "#ffffff",
            padding: 24,
            zIndex: -1,
          }}
        >
          {(displayTitle || activeResult?.graphTitle) && (
            <h2 style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 12px 0",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}>
              {displayTitle || activeResult?.graphTitle}
            </h2>
          )}
          <ChartRenderer
            chartData={syncedChartData ?? chartData}
            customizations={customizations}
            colors={activeColors}
            preferredType={llmChartType}
          />
        </div>
      )}

      {/* Save modal */}
      <SaveAnalysisModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        result={activeResult}
        allResults={results}
        activeIndex={activeIndex}
        tabName={activeTabName}
        graphTitle={titleOverride ?? activeResult?.graphTitle}
        tabs={tabs}
        resultsByTab={resultsByTab}
        projectName={projectName}
      />
    </div>
    {/* End of main content div */}

    {/* Customize sidebar — slides in from right */}
    <CustomizeSidebar
      open={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      customizations={customizations}
      onSet={handleSet}
      onReset={handleReset}
      seriesCount={seriesCount}
      seriesLabels={seriesLabels}
    />
    </div>
  );
};

export default GraphTablePanel;
