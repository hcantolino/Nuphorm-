import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
// REMOVED: DropdownMenu scope-picker (was used for attach-to: Tab / Project choice).
// Attachment management now happens inside AttachmentModal (paperclip button).
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import {
  Paperclip,
  Send,
  Search,
  Upload,
  LayoutGrid,
  List,
  FileText,
  FileSpreadsheet,
  X,
  File,
  Files,
  Sparkles,
  Eye,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2,
  ShieldCheck,
  BarChart2,
  Download,
  CheckCircle2,
  RefreshCw,
  WifiOff,
  Trash2,
  FolderOpen,
  Plus,
} from "lucide-react";
import { useCurrentDatasetStore } from "@/stores/currentDatasetStore";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useMeasurementTriggerStore } from "@/stores/measurementTriggerStore";
import { useAIPanelStore } from "@/stores/aiPanelStore";
import { useTabChat } from "@/hooks/useTabChat";
import { useTabStore } from "@/stores/tabStore";
import { useTabContentStore } from "@/stores/tabContentStore";
import { useAuth } from "@/_core/hooks/useAuth";
import { generateTitleFromQuery } from "@/utils/titleGeneration";
import { getSessionAwareStorageManager } from "@/lib/sessionAwareStorage";
import { useSessionEvents } from "@/lib/useSessionEvents";
import { useProjectStore, type ProjectSource, formatBytes } from "@/stores/projectStore";
import { useBiostatisticsStore } from "@/stores/biostatisticsStore";
// NEW: paperclip modal for managing attached sources (replaces inline chip strip)
import { AttachmentModal } from "./AttachmentModal";
import { VoiceDictationButton } from "./VoiceDictationButton";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface AIBiostatisticsChatProps {
  onMeasurementSelect?: (measurement: string) => void;
  onDataLoaded?: (data: any) => void;
  selectedFiles?: string[];
  onInsertMessage?: (message: string) => void;
  selectedMeasurements?: string[];
  selectedDataFiles?: string[];
  onChatMessage?: (
    message: string,
    files: string[],
    measurements: string[]
  ) => void;
  className?: string;
  /** When true: hides header strip + DatasetToolsPanel, reduces message padding.
   *  Used when the chat is embedded at the bottom of the left panel. */
  compact?: boolean;
}

interface RepoFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedDate: string;
  /** Extracted text content (CSV text, PDF text, etc.) for AI context */
  preview?: string;
}

type PreviewEntry =
  | { type: "loading" }
  | { type: "error"; content: string }
  | { type: "text"; content: string }
  | { type: "table"; headers: string[]; rows: Array<Record<string, any>> };

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Robust CSV/TSV parser using PapaParse.
 * Handles quoted fields, auto-detects delimiters, coerces numeric values.
 * Falls back to manual line splitting only if PapaParse returns no data.
 */
function parseCSVData(csvContent: string): Array<Record<string, any>> {
  if (!csvContent || csvContent.trim().length === 0) return [];

  try {
    const result = Papa.parse<Record<string, any>>(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,        // auto-coerces numbers, booleans
      transformHeader: (h) => h.trim(),
    });

    if (result.data && result.data.length > 0) {
      // Filter out rows that are entirely empty
      return result.data.filter((row) =>
        Object.values(row).some((v) => v !== null && v !== undefined && v !== "")
      );
    }
  } catch (e) {
    console.warn("PapaParse failed, attempting manual parse:", e);
  }

  // Fallback: manual delimiter detection + split (for edge cases)
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const sep = tabCount > commaCount ? "\t" : ",";

  const headers = firstLine.split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const data: Array<Record<string, any>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      const value = values[idx] ?? "";
      row[header] = value !== "" && !isNaN(Number(value)) ? Number(value) : value;
    });
    data.push(row);
  }
  return data;
}

// Returns the rich classification format expected by the backend
function deriveColumnTypes(data: Array<Record<string, any>>): Record<string, any> {
  if (!data.length) return {};
  const result: Record<string, any> = {};
  Object.keys(data[0]).forEach((col) => {
    const values = data
      .slice(0, 50)
      .map((r) => r[col])
      .filter((v) => v !== null && v !== undefined && v !== "");
    const numericValues = values.filter(
      (v) =>
        typeof v === "number" ||
        (!isNaN(Number(String(v))) && String(v).trim() !== "")
    );
    const isNumeric =
      values.length > 0 && numericValues.length / values.length > 0.7;
    const uniqueCount = new Set(values.map(String)).size;
    result[col] = {
      dataType: isNumeric ? "number" : "string",
      scale: isNumeric ? "continuous" : uniqueCount <= 10 ? "ordinal" : "nominal",
      uniqueValues: uniqueCount,
      suggestedAnalyses: isNumeric
        ? ["mean", "median", "std dev", "t-test", "correlation"]
        : ["frequency", "chi-square"],
    };
  });
  return result;
}

function formatTimestamp(ts: number | Date): string {
  try {
    return formatDistanceToNow(ts instanceof Date ? ts : new Date(ts), {
      addSuffix: true,
    });
  } catch {
    return "";
  }
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(f);
  });
}

function fileToText(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(f);
  });
}

/** Parse XLSX/XLS file to array of row objects using the first sheet */
function parseXLSXFile(file: File): Promise<Array<Record<string, any>>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) { resolve([]); return; }
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function FileIcon({ type, className: cls }: { type: string; className?: string }) {
  const ext = type?.toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    return <FileSpreadsheet className={cn("w-5 h-5 text-blue-600 flex-shrink-0", cls)} />;
  }
  if (ext === "pdf") {
    return <FileText className={cn("w-5 h-5 text-rose-500 flex-shrink-0", cls)} />;
  }
  return <File className={cn("w-5 h-5 text-blue-500 flex-shrink-0", cls)} />;
}

// ── Sources Panel (bottom drawer) ─────────────────────────────────────────────

interface SourcesPanelProps {
  open: boolean;
  onClose: () => void;
  files: RepoFile[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAddMore: () => void;
  /** Project-wide sources shown as a read-only section at the top */
  projectSources?: ProjectSource[];
  onRemoveProjectSource?: (id: string) => void;
  /** Name of the active tab, used as the label for the tab-specific section */
  tabName?: string;
}

function SourcesPanel({
  open,
  onClose,
  files,
  onRemove,
  onClearAll,
  onAddMore,
  projectSources = [],
  onRemoveProjectSource,
  tabName,
}: SourcesPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"sources" | "previews">("sources");
  const [previewData, setPreviewData] = useState<Record<string, PreviewEntry>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const trpcUtils = trpc.useUtils();

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProjectSources = projectSources.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setActiveTab("sources");
    }
  }, [open]);

  const togglePreview = useCallback(
    async (file: RepoFile) => {
      if (expandedId === file.id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(file.id);
      if (previewData[file.id]) return;

      // Temp-uploaded files don't have real DB IDs yet
      if (file.id.startsWith("local-")) {
        setPreviewData((prev) => ({
          ...prev,
          [file.id]: {
            type: "text",
            content:
              "Preview available after page refresh (file saved to repository).",
          },
        }));
        return;
      }

      setPreviewData((prev) => ({ ...prev, [file.id]: { type: "loading" } }));
      try {
        const result = await trpcUtils.files.getFileContent.fetch({
          fileId: parseInt(file.id),
        });
        const ext = file.type?.toLowerCase();
        if (["csv", "xlsx", "xls"].includes(ext)) {
          const parsed = parseCSVData(result.content ?? "");
          setPreviewData((prev) => ({
            ...prev,
            [file.id]: {
              type: "table",
              headers: parsed.length > 0 ? Object.keys(parsed[0]) : [],
              rows: parsed.slice(0, 6),
            },
          }));
        } else {
          setPreviewData((prev) => ({
            ...prev,
            [file.id]: {
              type: "text",
              content: (result.content ?? "").slice(0, 700),
            },
          }));
        }
      } catch {
        setPreviewData((prev) => ({
          ...prev,
          [file.id]: { type: "error", content: "Could not load preview." },
        }));
      }
    },
    [expandedId, previewData, trpcUtils]
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background border-t border-border/60 shadow-[0_-16px_48px_-8px_rgba(0,0,0,0.18)] animate-in slide-in-from-bottom duration-300"
        style={{ height: "58vh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/50 flex-shrink-0">
          <Files className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-semibold text-sm">Attached Sources</span>
          {(files.length + projectSources.length) > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 font-bold"
            >
              {files.length + projectSources.length}
            </Badge>
          )}
          {projectSources.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5 border-blue-300 text-blue-700 bg-blue-50"
            >
              {projectSources.length} project-wide
            </Badge>
          )}
          <div className="flex-1" />
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search sources…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-xs rounded-lg"
            />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted transition-colors ml-1 flex-shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "sources" | "previews")}
          className="flex-1 flex flex-col min-h-0 gap-0"
        >
          <div className="px-5 pt-3 pb-0 flex-shrink-0">
            <TabsList className="h-8 w-auto">
              <TabsTrigger value="sources" className="text-xs h-7 px-3">
                Added Sources
              </TabsTrigger>
              <TabsTrigger value="previews" className="text-xs h-7 px-3">
                Previews
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Sources Tab ── */}
          <TabsContent value="sources" className="flex-1 overflow-y-auto min-h-0 mt-0">
            <div className="px-5 py-3 space-y-2">

              {/* Project Sources section (search-filtered) */}
              {filteredProjectSources.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">
                      Project Sources (Applied to All Tabs)
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="space-y-1">
                    {filteredProjectSources.map((src) => (
                      <div
                        key={src.id}
                        className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/40 hover:bg-blue-50 transition-all"
                      >
                        <FileIcon type={src.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">{src.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                            {src.type.toUpperCase()} · {formatBytes(src.size)} · project-wide
                          </p>
                        </div>
                        {onRemoveProjectSource && (
                          <button
                            onClick={() => onRemoveProjectSource(src.id)}
                            className="flex-shrink-0 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                            title="Remove project source"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Sources divider — shown whenever project sources exist */}
              {projectSources.length > 0 && (
                <div className="flex items-center gap-2 mt-2 mb-0.5">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">
                    {tabName
                      ? `Sources for ${tabName} (This Tab Only)`
                      : "Tab Sources (This Tab Only)"}
                  </span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-muted-foreground gap-2">
                  <File className="w-8 h-8 opacity-20" />
                  <p className="text-xs">
                    {searchTerm
                      ? "No matches found"
                      : projectSources.length > 0
                      ? "No tab-specific files attached"
                      : "No files attached yet"}
                  </p>
                  {!searchTerm && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs mt-1 gap-1.5"
                      onClick={onAddMore}
                    >
                      <Paperclip className="w-3 h-3" />
                      Attach files
                    </Button>
                  )}
                </div>
              ) : (
                filtered.map((file) => (
                  <div
                    key={file.id}
                    className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 hover:border-border/80 hover:bg-muted/30 transition-all"
                  >
                    <FileIcon type={file.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {file.type} · {file.size} · {file.uploadedDate}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(file.id)}
                      className="flex-shrink-0 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                      title="Remove from sources"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── Previews Tab ── */}
          <TabsContent value="previews" className="flex-1 overflow-y-auto min-h-0 mt-0">
            <div className="px-5 py-3 space-y-2">

              {/* Project source previews — uses the stored text preview captured at upload */}
              {filteredProjectSources.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">
                      Project Sources (Applied to All Tabs)
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="space-y-2">
                    {filteredProjectSources.map((src) => (
                      <div
                        key={src.id}
                        className="rounded-xl border border-blue-100 overflow-hidden bg-blue-50/20"
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <FileIcon type={src.type} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{src.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {src.type.toUpperCase()} · {formatBytes(src.size)} · project-wide
                            </p>
                          </div>
                        </div>
                        {src.preview ? (
                          <div className="border-t border-blue-100/60 bg-blue-50/10 px-4 py-3">
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-28 overflow-y-auto">
                              {src.preview}
                              {src.preview.length >= 600 && (
                                <span className="text-primary/60"> …(truncated)</span>
                              )}
                            </pre>
                          </div>
                        ) : (
                          <div className="border-t border-blue-100/60 px-4 py-2">
                            <p className="text-xs text-muted-foreground italic">
                              No text preview for this file type.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab sources preview header — only shown when both sections have content */}
              {projectSources.length > 0 && filtered.length > 0 && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">
                    {tabName
                      ? `Sources for ${tabName} (This Tab Only)`
                      : "Tab Sources (This Tab Only)"}
                  </span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}

              {filtered.length === 0 && filteredProjectSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-muted-foreground gap-2">
                  <Eye className="w-8 h-8 opacity-20" />
                  <p className="text-xs">No files to preview</p>
                </div>
              ) : (
                filtered.map((file) => {
                  const preview = previewData[file.id];
                  const isExpanded = expandedId === file.id;
                  return (
                    <div
                      key={file.id}
                      className="rounded-xl border border-border/50 overflow-hidden transition-all"
                    >
                      {/* Toggle row */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                        onClick={() => togglePreview(file)}
                      >
                        <FileIcon type={file.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {file.type} · {file.size}
                          </p>
                        </div>
                        <Eye
                          className={cn(
                            "w-4 h-4 flex-shrink-0 transition-colors",
                            isExpanded
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                      </button>

                      {/* Preview area */}
                      {isExpanded && (
                        <div className="border-t border-border/40 bg-muted/20 px-4 py-3">
                          {!preview || preview.type === "loading" ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Loading preview…
                            </div>
                          ) : preview.type === "error" ? (
                            <p className="text-xs text-destructive py-1">
                              {preview.content}
                            </p>
                          ) : preview.type === "text" ? (
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-28 overflow-y-auto">
                              {preview.content}
                              {preview.content.length >= 700 && (
                                <span className="text-primary/60">
                                  {" "}
                                  …(truncated)
                                </span>
                              )}
                            </pre>
                          ) : preview.type === "table" ? (
                            <div className="overflow-x-auto">
                              <table className="text-xs w-full border-collapse min-w-max">
                                <thead>
                                  <tr className="border-b border-border/50">
                                    {preview.headers.slice(0, 7).map((h) => (
                                      <th
                                        key={h}
                                        className="text-left py-1 pr-4 font-semibold text-foreground/80 whitespace-nowrap"
                                      >
                                        {h}
                                      </th>
                                    ))}
                                    {preview.headers.length > 7 && (
                                      <th className="text-muted-foreground/60 text-xs font-normal">
                                        +{preview.headers.length - 7} more
                                      </th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {preview.rows.map((row, ri) => (
                                    <tr
                                      key={ri}
                                      className="border-b border-border/25 last:border-0"
                                    >
                                      {preview.headers
                                        .slice(0, 7)
                                        .map((h) => (
                                          <td
                                            key={h}
                                            className="py-1 pr-4 text-muted-foreground whitespace-nowrap max-w-[90px] truncate"
                                            title={String(row[h] ?? "")}
                                          >
                                            {String(row[h] ?? "—")}
                                          </td>
                                        ))}
                                      {preview.headers.length > 7 && <td />}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p className="text-[10px] text-muted-foreground mt-2 tabular-nums">
                                Showing {preview.rows.length} rows ·{" "}
                                {preview.headers.length} columns
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 flex-shrink-0 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            {files.length === 0
              ? "No files attached to this analysis"
              : `${files.length} file${files.length !== 1 ? "s" : ""} attached`}
          </p>
          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-destructive/70 hover:text-destructive transition-colors px-2 py-1 rounded"
              >
                Clear All
              </button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={onAddMore}
            >
              <Paperclip className="w-3 h-3" />
              Add More
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── File Repository Picker Dialog ─────────────────────────────────────────────

interface FilePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onAttach: (files: RepoFile[]) => void;
}

function FilePickerDialog({ open, onClose, onAttach }: FilePickerDialogProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const localUploadRef = useRef<HTMLInputElement>(null);

  const { data: filesResponse, refetch } = trpc.files.list.useQuery(
    { limit: 100, page: 1 },
    { enabled: open }
  );

  const uploadFileMutation = trpc.files.upload.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("File uploaded successfully");
    },
    onError: (err) => toast.error(`Upload failed: ${err.message}`),
  });

  const repoFiles: RepoFile[] = (filesResponse?.data ?? []).map((f: any) => ({
    id: f.id.toString(),
    name: f.fileName ?? f.name,
    size: f.fileSizeBytes
      ? `${(f.fileSizeBytes / 1024).toFixed(0)} KB`
      : f.size ?? "—",
    type: (f.fileName ?? f.name ?? "").split(".").pop()?.toUpperCase() ?? "FILE",
    uploadedDate: f.uploadedAt
      ? new Date(f.uploadedAt).toLocaleDateString()
      : f.uploadDate ?? "—",
  }));

  const filtered = repoFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAttach = () => {
    const files = filtered.filter((f) => selectedIds.has(f.id));
    onAttach(files);
    setSelectedIds(new Set());
    onClose();
  };

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.info("Uploading file…");
      const base64 = await fileToBase64(file);
      await uploadFileMutation.mutateAsync({
        fileName: file.name,
        fileData: base64,
        fileSizeBytes: file.size,
        mimeType: file.type || "text/csv",
      });
    } catch (err) {
      console.error("Upload error:", err);
    }
    e.target.value = "";
  };

  useEffect(() => {
    if (!open) setSelectedIds(new Set());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle>Attach Files from Repository</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files and folders…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File list / grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <File className="w-10 h-10 opacity-30" />
              <p className="text-sm">
                {search
                  ? "No files match your search"
                  : "No files in repository yet. Upload one below."}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-1">
              {filtered.map((f) => (
                <div
                  key={f.id}
                  onClick={() => toggleFile(f.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border",
                    selectedIds.has(f.id)
                      ? "bg-primary/10 border-primary/30"
                      : "hover:bg-muted border-transparent"
                  )}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedIds.has(f.id)}
                    className="accent-primary flex-shrink-0"
                  />
                  <FileIcon type={f.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.type} · {f.size} · {f.uploadedDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((f) => (
                <div
                  key={f.id}
                  onClick={() => toggleFile(f.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors border",
                    selectedIds.has(f.id)
                      ? "bg-primary/10 border-primary/40"
                      : "hover:bg-muted border-transparent"
                  )}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedIds.has(f.id)}
                    className="accent-primary self-end -mb-2"
                  />
                  <FileIcon type={f.type} />
                  <p className="text-xs font-medium text-center line-clamp-2 leading-tight">
                    {f.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{f.size}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0 bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={() => localUploadRef.current?.click()}
            disabled={uploadFileMutation.isPending}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploadFileMutation.isPending ? "Uploading…" : "Upload from Computer"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={handleAttach}
            >
              Attach{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
          </div>
        </div>

        <input
          ref={localUploadRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.json,.txt"
          className="hidden"
          onChange={handleLocalUpload}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Dataset Pill ───────────────────────────────────────────────────────────────

function DatasetPill() {
  const { currentDataset, clearCurrentDataset } = useCurrentDatasetStore();
  if (!currentDataset) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/40 border-t border-border/40 flex-shrink-0">
      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
      <span className="text-xs font-medium truncate max-w-[180px]">
        {currentDataset.filename}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        · {currentDataset.rowCount.toLocaleString()} rows
      </span>
      {currentDataset.cleaned && (
        <span className="flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Cleaned
        </span>
      )}
      <button
        onClick={clearCurrentDataset}
        className="ml-auto p-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
        title="Remove dataset"
      >
        <X className="w-3 h-3 text-muted-foreground" />
      </button>
    </div>
  );
}

// ── Dataset Tools Panel ────────────────────────────────────────────────────────

const DATASET_TOOL_ACTIONS = [
  {
    label: "Clean Dataset",
    icon: <Wand2 className="w-3 h-3" />,
    prompt: (filename: string) =>
      `Run smart data cleaning on ${filename}. Identify missing values, outliers, and type issues, then recommend fixes.`,
  },
  {
    label: "CDISC",
    icon: <ShieldCheck className="w-3 h-3" />,
    prompt: (filename: string) =>
      `Standardize ${filename} to CDISC SDTM format. Map variables to domains and flag compliance gaps.`,
  },
  {
    label: "AE Summary",
    icon: <BarChart2 className="w-3 h-3" />,
    prompt: (filename: string) =>
      `Generate an Adverse Events incidence summary for ${filename}. Group by System Organ Class and preferred term.`,
  },
  {
    label: "KM Plot",
    icon: <Sparkles className="w-3 h-3" />,
    prompt: (filename: string) =>
      `Generate a Kaplan-Meier survival plot for ${filename}. Identify the time and event columns automatically.`,
  },
  {
    label: "Export Cleaned",
    icon: <Download className="w-3 h-3" />,
    prompt: null as null,
    onClick: (dataset: ReturnType<typeof useCurrentDatasetStore.getState>["currentDataset"]) => {
      if (!dataset?.cleanedSessionId) {
        toast.info("Clean the dataset first before exporting.");
        return;
      }
      window.open(`/api/v1/clean/export/${dataset.cleanedSessionId}`, "_blank");
    },
  },
] as const;

function DatasetToolsPanel() {
  const [open, setOpen] = useState(false);
  const { currentDataset } = useCurrentDatasetStore();
  const { setPendingMessage } = useMeasurementTriggerStore();

  if (!currentDataset) return null;

  return (
    <div className="flex-shrink-0 border-t border-border/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Dataset Tools
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {DATASET_TOOL_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                if ("onClick" in action && action.onClick) {
                  action.onClick(currentDataset);
                } else if (action.prompt) {
                  setPendingMessage(action.prompt(currentDataset.filename));
                  setOpen(false);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-border bg-background hover:bg-muted/50 hover:border-primary/30 transition-colors"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main chat component ────────────────────────────────────────────────────────

export const AIBiostatisticsChatTabIntegrated: React.FC<
  AIBiostatisticsChatProps
> = ({
  onMeasurementSelect,
  onDataLoaded,
  selectedFiles,
  onInsertMessage,
  selectedMeasurements = [],
  selectedDataFiles = [],
  onChatMessage,
  className,
  compact = false,
}) => {
  const { user, isAuthenticated } = useAuth();
  const sessionId = useMemo(() => String(user?.id || "anonymous"), [user?.id]);

  const { chatMessages, addChatMessage, clearChatHistory, activeTabId } =
    useTabChat();
  const { activeTabId: currentTabId, renameTab, tabs } = useTabStore();
  const { setTabLastQuery } = useTabContentStore();

  // Project-level instructions + sources (shared across all tabs)
  const { activeProjectId } = useBiostatisticsStore();
  // NEW: addSource added so files can be routed to project-level sources when user picks "Project (all tabs)"
  // BEFORE: only getSettings + removeSource were destructured; project-scoped attach was not supported
  const { getSettings, removeSource: removeProjectSource, addSource: addProjectSource, sourcesPanelRequestedAt } = useProjectStore();
  const projectSettings = useMemo(
    () => getSettings(activeProjectId ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProjectId, getSettings]
  );

  // Derive the human-readable title of the currently active tab
  const activeTabName = useMemo(
    () => tabs.find((t) => t.id === currentTabId)?.title,
    [tabs, currentTabId]
  );

  const [inputValue, setInputValue] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [fullData, setFullData] = useState<Array<Record<string, any>>>([]);
  const [columnClassifications, setColumnClassifications] = useState<
    Record<string, any>
  >({});
  const setPanelResult = useAIPanelStore((s) => s.setPanelResult);
  const updatePanelResult = useAIPanelStore((s) => s.updatePanelResult);
  const selectedGraphId = useAIPanelStore((s) => s.selectedGraphId);
  const selectedTableType = useAIPanelStore((s) => s.selectedTableType);
  const clearSelectedGraph = useAIPanelStore((s) => s.clearSelectedGraph);
  const pendingEditAction = useAIPanelStore((s) => s.pendingEditAction);
  const pendingChatContent = useAIPanelStore((s) => s.pendingChatContent);

  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<RepoFile[]>([]);
  // NEW: tracks whether the next attach action should go to project-level or tab-level sources.
  // Set by the scope picker dropdown before opening the file picker or upload dialog.
  // BEFORE: all attached files silently went to tab-level only — no project scope option existed.
  const [attachScope, setAttachScope] = useState<'project' | 'tab'>('tab');
  // NEW: controls the AttachmentModal (paperclip) — replaces inline chip strip
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  // PDF warning modal — shown when sending with unparsable PDFs selected
  const [pdfWarningOpen, setPdfWarningOpen] = useState(false);
  const [pdfWarningPendingMessage, setPdfWarningPendingMessage] = useState<string | null>(null);
  // Per-source checked/unchecked state: Record<sourceId, boolean>
  // Default is true (checked) — only explicitly unchecked sources have `false`.
  const [sourceSelection, setSourceSelection] = useState<Record<string, boolean>>({});

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const computerUploadRef = useRef<HTMLInputElement>(null);
  const lastUserQueryRef = useRef<string>("");

  const [isFirstQuery, setIsFirstQuery] = useState(true);
  // 'unknown' until first response, 'online' on success, 'offline' when LLM fails
  const [llmStatus, setLlmStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

  const analyzeMutation =
    trpc.biostatistics.analyzeBiostatisticsData.useMutation();
  const uploadFileMutation = trpc.files.upload.useMutation({
    onError: (err) => toast.error(`Upload failed: ${err.message}`),
  });
  const parsePdfMutation = trpc.files.parsePdf.useMutation();

  const { pendingMessage, pendingAutoSend, setPendingMessage } = useMeasurementTriggerStore();
  const trpcUtils = trpc.useUtils();

  const storageManagerRef = useRef<any>(null);
  const isComponentMountedRef = useRef(true);

  const activeTabIdMemo = useMemo(() => activeTabId, [activeTabId]);
  const sessionIdMemo = useMemo(() => sessionId, [sessionId]);
  const isAuthenticatedMemo = useMemo(
    () => isAuthenticated,
    [isAuthenticated]
  );

  // ── Session restore ────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!isComponentMountedRef.current) return;
      if (!isAuthenticatedMemo || !activeTabIdMemo) {
        setIsRestoring(false);
        return;
      }
      try {
        const mgr = getSessionAwareStorageManager({
          sessionId: sessionIdMemo,
          tabId: String(activeTabIdMemo || "default"),
          debugMode: false,
        });
        storageManagerRef.current = mgr;
        const restored = await mgr.initialize();
        if (isComponentMountedRef.current && restored) {
          restored.chatMessages.forEach((msg: any) => addChatMessage(msg));
          setUploadedData(restored.uploadedData);
          setFullData(restored.fullData);
          setConversationHistory(restored.conversationHistory);
          toast.success("Chat history restored");
        }
      } catch (err) {
        console.error("Error restoring chat state:", err);
      } finally {
        if (isComponentMountedRef.current) setIsRestoring(false);
      }
    };
    init();
  }, [isAuthenticatedMemo, activeTabIdMemo, sessionIdMemo, addChatMessage]);

  useSessionEvents({
    sessionId: sessionIdMemo,
    tabId: activeTabIdMemo || "default",
    onLogout: useCallback(async () => {
      if (storageManagerRef.current) {
        await storageManagerRef.current
          .forceSave({
            chatMessages,
            uploadedData,
            fullData,
            conversationHistory,
          })
          .catch(console.error);
      }
    }, [chatMessages, uploadedData, fullData, conversationHistory]),
    onSessionRefresh: useCallback(async () => {
      if (storageManagerRef.current) {
        await storageManagerRef.current
          .onSessionRefresh()
          .catch(console.error);
        toast.info("Session refreshed - chat data saved");
      }
    }, []),
    onRemoteLogout: useCallback(() => {
      toast.info("Logged out from another tab");
    }, []),
    debugMode: false,
  });

  // ── Debounced auto-save ────────────────────────────────────────────────
  useEffect(() => {
    if (
      !storageManagerRef.current ||
      !isAuthenticatedMemo ||
      !activeTabIdMemo
    )
      return;
    const t = setTimeout(() => {
      if (isComponentMountedRef.current) {
        storageManagerRef.current.markDirty({
          chatMessages,
          uploadedData,
          fullData,
          conversationHistory,
        });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [
    chatMessages.length,
    uploadedData,
    fullData.length,
    conversationHistory.length,
    isAuthenticatedMemo,
    activeTabIdMemo,
  ]);

  // ── Pending measurement trigger ────────────────────────────────────────
  useEffect(() => {
    if (pendingMessage) {
      const msg = pendingMessage;
      const shouldAutoSend = pendingAutoSend;
      setPendingMessage(null);
      if (shouldAutoSend) {
        // Pass the text explicitly so we don't depend on inputValue state timing
        handleSendMessage(msg);
      } else {
        setInputValue(msg);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);

  // ── Open sources panel when triggered from the project section ────────
  useEffect(() => {
    if (sourcesPanelRequestedAt) {
      setSourcesOpen(true);
    }
  }, [sourcesPanelRequestedAt]);

  // ── Persist tab-specific attached files to localStorage ───────────────
  // Restore when the active tab changes (e.g. on page reload or tab switch)
  useEffect(() => {
    if (!activeTabIdMemo) return;
    const key = `biostat-tab-files-${activeTabIdMemo}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed: RepoFile[] = JSON.parse(saved);
        if (Array.isArray(parsed)) setAttachedFiles(parsed);
      } catch {
        // corrupt data — ignore
      }
    } else {
      // new tab: start with empty list
      setAttachedFiles([]);
    }
  // We intentionally only run this when activeTabIdMemo changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabIdMemo]);

  useEffect(() => {
    if (!activeTabIdMemo) return;
    try {
      localStorage.setItem(
        `biostat-tab-files-${activeTabIdMemo}`,
        JSON.stringify(attachedFiles)
      );
    } catch {
      // localStorage quota — silently skip
    }
  }, [attachedFiles, activeTabIdMemo]);

  // ── Persist source selection state per tab ──────────────────────────────
  useEffect(() => {
    if (!activeTabIdMemo) return;
    const key = `biostat-source-sel-${activeTabIdMemo}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) setSourceSelection(parsed);
      } catch { /* corrupt — ignore */ }
    } else {
      setSourceSelection({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabIdMemo]);

  useEffect(() => {
    if (!activeTabIdMemo) return;
    try {
      localStorage.setItem(
        `biostat-source-sel-${activeTabIdMemo}`,
        JSON.stringify(sourceSelection)
      );
    } catch { /* quota */ }
  }, [sourceSelection, activeTabIdMemo]);

  // ── Source selection helpers ────────────────────────────────────────────
  const toggleSource = useCallback((sourceId: string) => {
    setSourceSelection(prev => ({
      ...prev,
      [sourceId]: prev[sourceId] === false ? true : false,
    }));
  }, []);

  const selectAllSources = useCallback(() => {
    const next: Record<string, boolean> = {};
    [...projectSettings.sources.map(s => s.id), ...attachedFiles.map(f => f.id)].forEach(id => { next[id] = true; });
    setSourceSelection(next);
  }, [projectSettings.sources, attachedFiles]);

  const selectNoneSources = useCallback(() => {
    const next: Record<string, boolean> = {};
    [...projectSettings.sources.map(s => s.id), ...attachedFiles.map(f => f.id)].forEach(id => { next[id] = false; });
    setSourceSelection(next);
  }, [projectSettings.sources, attachedFiles]);

  const selectTabOnly = useCallback(() => {
    const next: Record<string, boolean> = {};
    projectSettings.sources.forEach(s => { next[s.id] = false; });
    attachedFiles.forEach(f => { next[f.id] = true; });
    setSourceSelection(next);
  }, [projectSettings.sources, attachedFiles]);

  const selectProjectOnly = useCallback(() => {
    const next: Record<string, boolean> = {};
    projectSettings.sources.forEach(s => { next[s.id] = true; });
    attachedFiles.forEach(f => { next[f.id] = false; });
    setSourceSelection(next);
  }, [projectSettings.sources, attachedFiles]);

  // Compute active sources for query injection
  const activeProjectSources = useMemo(
    () => projectSettings.sources.filter(s => sourceSelection[s.id] !== false),
    [projectSettings.sources, sourceSelection]
  );
  const activeTabFiles = useMemo(
    () => attachedFiles.filter(f => sourceSelection[f.id] !== false),
    [attachedFiles, sourceSelection]
  );
  const allActiveSourceNames = useMemo(
    () => [...activeProjectSources.map(s => s.name), ...activeTabFiles.map(f => f.name)],
    [activeProjectSources, activeTabFiles]
  );
  const hasAnySources = projectSettings.sources.length > 0 || attachedFiles.length > 0;
  const hasActiveSource = allActiveSourceNames.length > 0;

  // Check if a project source has been referenced in any tab's chat messages
  const tabContentStore = useTabContentStore();
  const isSourceUsedInQueries = useCallback((sourceId: string) => {
    const src = projectSettings.sources.find(s => s.id === sourceId);
    if (!src) return false;
    const allContent = tabContentStore.tabContent;
    for (const tabId of Object.keys(allContent)) {
      const msgs = allContent[tabId]?.chatMessages ?? [];
      for (const msg of msgs) {
        if (msg.role === 'user' && msg.metadata?.usedSources?.includes(src.name)) {
          return true;
        }
      }
    }
    return false;
  }, [projectSettings.sources, tabContentStore.tabContent]);

  // ── Smart auto-scroll ──────────────────────────────────────────────────
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceToBottom < 300 || chatMessages.length <= 1 || isLoading) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [chatMessages.length, isLoading]);

  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  // ── File attach from picker ────────────────────────────────────────────
  // CHANGED: now accepts an optional `scope` param so files can be routed to
  // either the project-level store (shared across all tabs) or the current tab's
  // local attachedFiles list.
  // BEFORE: always pushed to setAttachedFiles (tab-level only); no project option.
  const handleAttachedFiles = useCallback(
    async (files: RepoFile[], scope: 'project' | 'tab' = 'tab') => {
      if (scope === 'project' && activeProjectId) {
        // NEW: route to project store — files become visible in all tabs
        files.forEach((f) => {
          addProjectSource(activeProjectId, {
            id: f.id,
            name: f.name,
            size: 0,                        // bytes unknown from RepoFile (server-side file)
            type: f.type.toLowerCase(),
            uploadedAt: Date.now(),
            preview: '',
          });
        });
        toast.success(
          files.length === 1
            ? `"${files[0].name}" added to project sources (all tabs)`
            : `${files.length} files added to project sources`
        );
        return;                             // project files need no CSV data parse here
      }

      // UNCHANGED path: tab-level attach
      setAttachedFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        return [...prev, ...files.filter((f) => !existingIds.has(f.id))];
      });

      const csvFile = files.find((f) =>
        ["CSV", "XLSX", "XLS"].includes(f.type)
      );
      if (csvFile) {
        try {
          const result = await trpcUtils.files.getFileContent.fetch({
            fileId: parseInt(csvFile.id),
          });
          const parsed = parseCSVData(result.content ?? "");
          if (parsed.length > 0) {
            const cols = Object.keys(parsed[0] ?? {});
            setColumnClassifications(deriveColumnTypes(parsed));
            setUploadedData({ filename: csvFile.name, size: csvFile.size });
            setFullData(parsed);
            onDataLoaded?.(parsed);
            // Sync to global store so other components (DatasetPill, BiostatsMeasurementsPanel)
            // see the loaded data and fullData fallback in handleSendMessage works
            useCurrentDatasetStore.getState().setCurrentDataset({
              filename: csvFile.name,
              rowCount: parsed.length,
              columns: cols,
              rows: parsed as Record<string, unknown>[],
              cleaned: false,
            });
            toast.success(`Loaded ${parsed.length} rows from ${csvFile.name}`);
          }
        } catch (err) {
          console.error("Error loading file content:", err);
          toast.error("Could not load file content — analysis may be limited");
        }
      }
    },
    [trpcUtils, onDataLoaded, activeProjectId, addProjectSource]
  );

  // ── Computer upload (input bar Upload button) ──────────────────────────
  const handleComputerUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      for (const file of files) {
        toast.info(`Uploading ${file.name}…`);
        try {
          const [base64, text] = await Promise.all([
            fileToBase64(file),
            fileToText(file),
          ]);

          // Fire upload to server (don't block UI on the result)
          uploadFileMutation.mutate({
            fileName: file.name,
            fileData: base64,
            fileSizeBytes: file.size,
            mimeType: file.type || "application/octet-stream",
          });

          // Add immediately with a local temp ID so the user can see it in Sources
          const tempId = `local-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;
          const newFile: RepoFile = {
            id: tempId,
            name: file.name,
            size: `${(file.size / 1024).toFixed(0)} KB`,
            type: file.name.split(".").pop()?.toUpperCase() ?? "FILE",
            uploadedDate: new Date().toLocaleDateString(),
          };

          const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

          // Route to project-level store or tab-level list based on attachScope.
          if (attachScope === 'project' && activeProjectId) {
            addProjectSource(activeProjectId, {
              id: tempId,
              name: file.name,
              size: file.size,
              type: ext || 'file',
              uploadedAt: Date.now(),
              preview: text.slice(0, 2 * 1024 * 1024),
            });
            toast.success(`"${file.name}" added to project sources (all tabs)`);
          } else {
            setAttachedFiles((prev) => [...prev, newFile]);
          }

          // ── Auto-select the newly uploaded file ──
          setSourceSelection((prev) => ({ ...prev, [tempId]: true }));

          // ── Auto-parse by file type ──
          if (["csv", "tsv", "txt"].includes(ext)) {
            // CSV / TSV / TXT — robust parsing via PapaParse
            try {
              const parsed = parseCSVData(text);
              if (parsed.length > 0) {
                setColumnClassifications(deriveColumnTypes(parsed));
                setUploadedData({ filename: file.name, size: newFile.size });
                setFullData(parsed);
                onDataLoaded?.(parsed);
                useCurrentDatasetStore.getState().setCurrentDataset({
                  filename: file.name,
                  rowCount: parsed.length,
                  columns: Object.keys(parsed[0] ?? {}),
                  rows: parsed as Record<string, unknown>[],
                  cleaned: false,
                });
                addChatMessage({
                  id: `msg-${Date.now()}`,
                  role: "assistant",
                  content: `✅ **${file.name}** attached — ${parsed.length.toLocaleString()} rows · ${Object.keys(parsed[0] ?? {}).length} columns. Would you like me to clean it first?`,
                  timestamp: Date.now(),
                });
              } else {
                toast.success(`${file.name} attached (no data rows detected)`);
              }
            } catch (csvErr) {
              console.error("CSV parse error:", csvErr);
              toast(`Parsing issue for ${file.name}: using metadata only.`, {
                style: { backgroundColor: "#a0aec0", color: "#1a202c" },
              });
              toast.success(`${file.name} attached`);
            }
          } else if (["xlsx", "xls"].includes(ext)) {
            // XLSX / XLS — parse with xlsx.js
            try {
              const parsed = await parseXLSXFile(file);
              if (parsed.length > 0) {
                setColumnClassifications(deriveColumnTypes(parsed));
                setUploadedData({ filename: file.name, size: newFile.size });
                setFullData(parsed);
                onDataLoaded?.(parsed);
                useCurrentDatasetStore.getState().setCurrentDataset({
                  filename: file.name,
                  rowCount: parsed.length,
                  columns: Object.keys(parsed[0] ?? {}),
                  rows: parsed as Record<string, unknown>[],
                  cleaned: false,
                });
                addChatMessage({
                  id: `msg-${Date.now()}`,
                  role: "assistant",
                  content: `✅ **${file.name}** attached — ${parsed.length.toLocaleString()} rows · ${Object.keys(parsed[0] ?? {}).length} columns. Would you like me to clean it first?`,
                  timestamp: Date.now(),
                });
              } else {
                toast.success(`${file.name} attached (no rows found in first sheet)`);
              }
            } catch (xlsxErr) {
              console.error("XLSX parse error:", xlsxErr);
              toast.error(`Content extraction failed for ${file.name}. Please ensure it's a valid XLSX file.`, { style: { backgroundColor: "#f56565", color: "#fff" } });
            }
          } else if (ext === "pdf") {
            // PDF — extract text via server-side pdf-parse, then attempt table extraction
            try {
              const result = await parsePdfMutation.mutateAsync({
                fileData: base64,
                fileName: file.name,
              });
              if (result.success && result.text) {
                const pdfText = result.text.slice(0, 2 * 1024 * 1024);

                // Store extracted text as preview for AI context
                if (attachScope === 'project' && activeProjectId) {
                  removeProjectSource(activeProjectId, tempId);
                  addProjectSource(activeProjectId, {
                    id: tempId,
                    name: file.name,
                    size: file.size,
                    type: ext,
                    uploadedAt: Date.now(),
                    preview: pdfText,
                  });
                } else {
                  // Tab-level: update the attachedFiles entry with extracted text
                  setAttachedFiles((prev) =>
                    prev.map((f) => f.id === tempId ? { ...f, preview: pdfText } : f)
                  );
                }

                // Attempt to extract structured tabular data from the PDF text.
                // Many PDF tables are rendered as lines with consistent delimiters
                // (tabs, pipes, or multiple spaces) — try parsing as CSV/TSV first.
                let pdfTableParsed = false;
                const pdfLines = pdfText.split('\n').filter((l) => l.trim());
                if (pdfLines.length >= 3) {
                  // Try pipe-delimited (common in PDF table extraction)
                  const pipeLines = pdfLines.filter((l) => l.includes('|'));
                  if (pipeLines.length >= 3) {
                    // Convert pipe-delimited to CSV
                    const csvText = pipeLines
                      .filter((l) => !l.match(/^[\s|:-]+$/)) // skip separator rows
                      .map((l) => l.split('|').map((c) => c.trim()).filter(Boolean).join(','))
                      .join('\n');
                    const parsed = parseCSVData(csvText);
                    if (parsed.length >= 1 && Object.keys(parsed[0]).length >= 2) {
                      setColumnClassifications(deriveColumnTypes(parsed));
                      setUploadedData({ filename: file.name, size: newFile.size });
                      setFullData(parsed);
                      onDataLoaded?.(parsed);
                      useCurrentDatasetStore.getState().setCurrentDataset({
                        filename: file.name,
                        rowCount: parsed.length,
                        columns: Object.keys(parsed[0] ?? {}),
                        rows: parsed as Record<string, unknown>[],
                        cleaned: false,
                      });
                      pdfTableParsed = true;
                    }
                  }
                  // Try tab-delimited or comma-delimited within PDF text
                  if (!pdfTableParsed) {
                    const parsed = parseCSVData(pdfText);
                    if (parsed.length >= 2 && Object.keys(parsed[0]).length >= 2) {
                      setColumnClassifications(deriveColumnTypes(parsed));
                      setUploadedData({ filename: file.name, size: newFile.size });
                      setFullData(parsed);
                      onDataLoaded?.(parsed);
                      useCurrentDatasetStore.getState().setCurrentDataset({
                        filename: file.name,
                        rowCount: parsed.length,
                        columns: Object.keys(parsed[0] ?? {}),
                        rows: parsed as Record<string, unknown>[],
                        cleaned: false,
                      });
                      pdfTableParsed = true;
                    }
                  }
                }

                if (pdfTableParsed) {
                  const cols = Object.keys(useCurrentDatasetStore.getState().currentDataset?.rows?.[0] ?? {});
                  addChatMessage({
                    id: `msg-${Date.now()}`,
                    role: "assistant",
                    content: `✅ **${file.name}** attached — PDF with ${result.pages} page${result.pages === 1 ? "" : "s"}. Extracted **${useCurrentDatasetStore.getState().currentDataset?.rowCount ?? 0} rows** · ${cols.length} columns (${cols.slice(0, 5).join(', ')}${cols.length > 5 ? '...' : ''}). Ready for analysis.`,
                    timestamp: Date.now(),
                  });
                  toast.success("Table extracted from PDF — structured data ready for analysis", {
                    style: { background: '#f0fdf4', color: '#166534', borderColor: '#86efac' },
                  });
                } else {
                  addChatMessage({
                    id: `msg-${Date.now()}`,
                    role: "assistant",
                    content: `✅ **${file.name}** attached — PDF with ${result.pages} page${result.pages === 1 ? "" : "s"}, ${result.text.length.toLocaleString()} characters extracted. No structured table detected — AI will analyze the full text content.`,
                    timestamp: Date.now(),
                  });
                }
              } else {
                toast.error(`Content extraction failed for ${file.name}. Please ensure it's a valid PDF with readable text/tables.`, { style: { backgroundColor: "#f56565", color: "#fff" } });
                toast.success(`${file.name} attached (metadata only)`);
              }
            } catch (pdfErr) {
              console.error("PDF extraction error:", pdfErr);
              toast.error(`Content extraction failed for ${file.name}. Please ensure it's a valid PDF with readable text/tables.`, { style: { backgroundColor: "#f56565", color: "#fff" } });
            }
          } else {
            toast.success(`${file.name} attached`);
          }
        } catch (err) {
          console.error("Upload error:", err);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      e.target.value = "";
    },
    [uploadFileMutation, onDataLoaded, attachScope, activeProjectId, addProjectSource, removeProjectSource, parsePdfMutation]
  );

  // ── Send message ───────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (explicitText?: string) => {
    const userMessage = (explicitText ?? inputValue).trim();
    if (!userMessage) return;

    // Snapshot graph/table edit state before clearing input
    const graphEditTargetId = selectedGraphId;
    const isGraphEdit = !!graphEditTargetId;
    const tableEditType = selectedTableType;

    if (!explicitText) setInputValue("");
    lastUserQueryRef.current = userMessage;

    // Snapshot active source names at query time for the "Using:" tag
    const snapshotSourceNames = [...activeProjectSources.map(s => s.name), ...activeTabFiles.map(f => f.name)];
    addChatMessage({
      id: `msg-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
      metadata: snapshotSourceNames.length > 0 ? { usedSources: snapshotSourceNames } : undefined,
    });
    setConversationHistory((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

    if (isFirstQuery && activeTabIdMemo) {
      setIsFirstQuery(false);
      renameTab(activeTabIdMemo, generateTitleFromQuery(userMessage));
      setTabLastQuery(activeTabIdMemo, userMessage);
    }

    setIsLoading(true);
    try {
      // Use component-local fullData first; fall back to the global currentDatasetStore
      // rows so uploads that went through the store (e.g. useDataUpload hook) are
      // also picked up without requiring a re-upload through this component.
      const cdStore = useCurrentDatasetStore.getState().currentDataset;
      let effectiveData: Array<Record<string, any>> =
        fullData.length > 0
          ? fullData
          : ((cdStore?.rows as Array<Record<string, any>>) ?? []);

      // ── Text-CSV auto-detection ──────────────────────────────────────────────
      // When no data is loaded and the user pastes CSV-like text directly into the
      // chat, auto-parse it so the backend gets structured fullData instead of a raw
      // string.  Detect by: (a) 2+ lines, (b) consistent comma/tab delimiters,
      // (c) first line looks like a header (non-numeric tokens).
      let pastedDataDetected = false;
      if (effectiveData.length === 0) {
        const lines = userMessage.split('\n').filter((l) => l.trim());
        if (lines.length >= 2) {
          const firstLine = lines[0];
          const tabCount = (firstLine.match(/\t/g) ?? []).length;
          const commaCount = (firstLine.match(/,/g) ?? []).length;
          const delimCount = Math.max(tabCount, commaCount);
          // At least 1 delimiter and row count > 1 → likely tabular data
          if (delimCount >= 1) {
            const sep = tabCount > commaCount ? '\t' : ',';
            const headerTokens = firstLine.split(sep).map((h) => h.trim());
            // Header check: at least 2 tokens, and at least half are non-numeric
            const nonNumericHeaders = headerTokens.filter((t) => isNaN(Number(t)) && t.length > 0);
            if (headerTokens.length >= 2 && nonNumericHeaders.length >= headerTokens.length * 0.5) {
              // Looks like a CSV header — try parsing
              const parsed = parseCSVData(userMessage);
              if (parsed.length >= 1 && Object.keys(parsed[0]).length >= 2) {
                effectiveData = parsed;
                setFullData(parsed);
                pastedDataDetected = true;
                useCurrentDatasetStore.getState().setCurrentDataset({
                  filename: 'pasted-data.csv',
                  rowCount: parsed.length,
                  columns: Object.keys(parsed[0]),
                  rows: parsed as Record<string, unknown>[],
                  cleaned: false,
                });
                console.log(`[TextCSV] Auto-detected pasted CSV: ${parsed.length} rows, ${Object.keys(parsed[0]).length} cols`);
                // Store a structured data summary in conversation history so follow-up
                // queries (including viz requests that normally clear history) can still
                // reference the pasted data.  The [PASTED_DATA] marker is detected by
                // the backend to re-inject the data context.
                const cols = Object.keys(parsed[0]);
                const previewRows = parsed.slice(0, 10).map((r) => JSON.stringify(r)).join("\n");
                setConversationHistory((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: `[PASTED_DATA columns=${cols.join(",")} rows=${parsed.length}]\n${previewRows}${parsed.length > 10 ? "\n...[" + (parsed.length - 10) + " more rows]" : ""}`,
                  },
                ]);
              }
            }
          }
        }
      }

      // Third fallback: parse project source preview (stored as full CSV text up to 2MB).
      // This covers files uploaded via ProjectContextPanel that never hit handleComputerUpload.
      // Falls back gracefully to column-names-only when the stored preview is too short to
      // produce data rows (e.g., legacy 600-char previews from before the 2MB limit was set).
      let projectSourceColumnsOnly: string[] = [];
      let projectSourcePreviewText = '';
      if (effectiveData.length === 0) {
        // Try CSV/TSV sources first, then fall back to PDF text previews
        const csvSource = projectSettings.sources.find(
          (s) => ['csv', 'tsv', 'txt'].includes(s.type) && s.preview && s.preview.length > 0
        );
        // Also check for PDF sources with extracted text
        const pdfSource = !csvSource
          ? projectSettings.sources.find(
              (s) => s.type === 'pdf' && s.preview && s.preview.length > 0
            )
          : null;

        const textSource = csvSource ?? pdfSource;

        if (textSource?.preview) {
          try {
            if (csvSource) {
              // Parse CSV/TSV preview into structured data
              const parsed = parseCSVData(textSource.preview);
              if (parsed.length > 0) {
                effectiveData = parsed;
                setFullData(parsed);
                useCurrentDatasetStore.getState().setCurrentDataset({
                  filename: textSource.name,
                  rowCount: parsed.length,
                  columns: Object.keys(parsed[0] ?? {}),
                  rows: parsed as Record<string, unknown>[],
                  cleaned: false,
                });
              } else {
                // Preview too short for full rows — extract column names from header at minimum
                const firstLine = textSource.preview.split('\n')[0] ?? '';
                if (firstLine) {
                  const tabs = (firstLine.match(/\t/g) ?? []).length;
                  const commas = (firstLine.match(/,/g) ?? []).length;
                  const sep = tabs > commas ? '\t' : ',';
                  projectSourceColumnsOnly = firstLine
                    .split(sep)
                    .map((h) => h.trim().replace(/^"|"$/g, ''))
                    .filter(Boolean);
                  projectSourcePreviewText = textSource.preview.slice(0, 600);
                }
              }
            } else {
              // PDF text — pass as-is for LLM context (not structured tabular data)
              projectSourcePreviewText = textSource.preview.slice(0, 4000);
            }
          } catch (parseErr) {
            console.error("Source preview parse error:", parseErr);
            // Graceful fallback — send raw preview text so the LLM has some context
            projectSourcePreviewText = textSource.preview.slice(0, 600);
          }
        }
      }

      // ── Last-resort fallback: fetch content from attached tab files ──────────
      // If effectiveData is STILL empty but the user has CSV/XLSX files attached,
      // try to fetch and parse their content so the AI gets actual data.
      if (effectiveData.length === 0 && attachedFiles.length > 0) {
        const csvAttachment = attachedFiles.find((f) =>
          ["CSV", "XLSX", "XLS", "TSV", "TXT"].includes(f.type)
        );
        if (csvAttachment) {
          try {
            const fileId = parseInt(csvAttachment.id);
            if (!isNaN(fileId)) {
              console.log("[AIChat] Last-resort: fetching content for attached file:", csvAttachment.name);
              const result = await trpcUtils.files.getFileContent.fetch({ fileId });
              if (result?.content) {
                const parsed = parseCSVData(result.content);
                if (parsed.length > 0) {
                  effectiveData = parsed;
                  setFullData(parsed);
                  useCurrentDatasetStore.getState().setCurrentDataset({
                    filename: csvAttachment.name,
                    rowCount: parsed.length,
                    columns: Object.keys(parsed[0] ?? {}),
                    rows: parsed as Record<string, unknown>[],
                    cleaned: false,
                  });
                  console.log(`[AIChat] Last-resort succeeded: ${parsed.length} rows from ${csvAttachment.name}`);
                }
              }
            }
          } catch (err) {
            console.warn("[AIChat] Last-resort file fetch failed:", err);
          }
        }

        // ── PDF fallback: if no CSV found, check for PDF attachments with preview text ──
        if (effectiveData.length === 0) {
          const pdfAttachment = attachedFiles.find(
            (f) => f.type === "PDF" && f.preview && f.preview.length > 0
          );
          if (pdfAttachment?.preview) {
            // Try to parse tabular data from extracted PDF text
            const parsed = parseCSVData(pdfAttachment.preview);
            if (parsed.length >= 2 && Object.keys(parsed[0]).length >= 2) {
              effectiveData = parsed;
              setFullData(parsed);
              useCurrentDatasetStore.getState().setCurrentDataset({
                filename: pdfAttachment.name,
                rowCount: parsed.length,
                columns: Object.keys(parsed[0] ?? {}),
                rows: parsed as Record<string, unknown>[],
                cleaned: false,
              });
              console.log(`[AIChat] PDF fallback succeeded: ${parsed.length} rows from ${pdfAttachment.name}`);
            } else {
              // No structured table — pass raw PDF text as preview context
              projectSourcePreviewText = pdfAttachment.preview.slice(0, 8000);
              console.log(`[AIChat] PDF fallback: sending ${projectSourcePreviewText.length} chars of raw text for ${pdfAttachment.name}`);
            }
          }

          // Also try fetching PDF content from server if no preview is stored locally
          if (effectiveData.length === 0 && !projectSourcePreviewText) {
            const pdfServerAttachment = attachedFiles.find(
              (f) => f.type === "PDF"
            );
            if (pdfServerAttachment) {
              try {
                const fileId = parseInt(pdfServerAttachment.id);
                if (!isNaN(fileId)) {
                  console.log("[AIChat] PDF last-resort: fetching content from server:", pdfServerAttachment.name);
                  const result = await trpcUtils.files.getFileContent.fetch({ fileId });
                  if (result?.content) {
                    // Try parsing as structured data first
                    const parsed = parseCSVData(result.content);
                    if (parsed.length >= 2 && Object.keys(parsed[0]).length >= 2) {
                      effectiveData = parsed;
                      setFullData(parsed);
                      useCurrentDatasetStore.getState().setCurrentDataset({
                        filename: pdfServerAttachment.name,
                        rowCount: parsed.length,
                        columns: Object.keys(parsed[0] ?? {}),
                        rows: parsed as Record<string, unknown>[],
                        cleaned: false,
                      });
                    } else {
                      // Raw text context
                      projectSourcePreviewText = result.content.slice(0, 8000);
                    }
                  }
                }
              } catch (err) {
                console.warn("[AIChat] PDF server fetch failed:", err);
              }
            }
          }
        }
      }

      // Log effective data state for debugging
      if (process.env.NODE_ENV !== "production") {
        console.log(`[AIChat] effectiveData: ${effectiveData.length} rows, fullData: ${fullData.length} rows, cdStore: ${cdStore?.rows?.length ?? 0} rows, attachedFiles: ${attachedFiles.length}`);
      }

      const effectiveClassifications =
        fullData.length > 0
          ? columnClassifications
          : effectiveData.length > 0
          ? deriveColumnTypes(effectiveData)
          : columnClassifications;

      const dataPreview =
        effectiveData.length > 0
          ? effectiveData.slice(0, 5).map((r) => JSON.stringify(r)).join("\n")
          : projectSourcePreviewText;
      const dataColumns =
        effectiveData.length > 0
          ? Object.keys(effectiveData[0])
          : projectSourceColumnsOnly;

      // ── Build augmented query: project context + tab context + message ──
      //
      // 1. Project-wide instructions (saved in Project Settings panel)
      const instructionsPrefix = projectSettings.instructions.trim()
        ? `[Project Instructions: ${projectSettings.instructions.trim()}]\n\n`
        : "";

      // 2. Project sources — only include CHECKED sources (per source selection).
      //    Include short text previews where available so the AI can reason about
      //    the actual data content, not just file names.
      const checkedProjectSources = activeProjectSources;
      const projectSourceLines = checkedProjectSources.map((s) => {
        if (s.preview) {
          // Send up to 4000 chars of preview so the AI has enough context for
          // tables extracted from PDFs (250 chars was too short for tabular data).
          const snippet = s.preview.slice(0, 4000);
          return `- ${s.name} (content:\n${snippet}${s.preview.length > 4000 ? "\n…[truncated]" : ""})`;
        }
        return `- ${s.name}`;
      });
      const projectSourceContext =
        projectSourceLines.length > 0
          ? `[Project Sources (Applied to All Tabs):\n${projectSourceLines.join("\n")}]\n\n`
          : "";

      // 3. Tab-specific attached files — only include CHECKED sources.
      //    Include preview content so the AI can see PDF/text data.
      const checkedTabFiles = activeTabFiles;
      const tabSourceLines = checkedTabFiles.map((f) => {
        if (f.preview) {
          const snippet = f.preview.slice(0, 4000);
          return `- ${f.name} (content:\n${snippet}${f.preview.length > 4000 ? "\n…[truncated]" : ""})`;
        }
        return `- ${f.name} (${f.type})`;
      });
      const tabSourceContext =
        tabSourceLines.length > 0
          ? `[Tab-Specific Sources (This Tab Only):\n${tabSourceLines.join("\n")}]\n\n`
          : "";

      // Capture active source names for the chat message metadata
      const querySourceNames = [...checkedProjectSources.map(s => s.name), ...checkedTabFiles.map(f => f.name)];

      // Prepend current dataset summary so the AI always knows what data is loaded.
      // Use effectiveData length for accuracy (may differ from stored rowCount if
      // the store was set via a different path than the component state).
      const datasetLine = cdStore
        ? `[Current Dataset: ${cdStore.filename}, ${effectiveData.length || cdStore.rowCount} rows, ${cdStore.columns.length} cols${cdStore.cleaned ? ", ✓ cleaned" : ""}]\n\n`
        : effectiveData.length > 0
        ? `[Current Dataset: in-memory data, ${effectiveData.length} rows, ${dataColumns.length} cols]\n\n`
        : "";

      // Anti-hallucination guardrail: append strict data-use clause when sources are loaded
      const hasDataContext = effectiveData.length > 0 || projectSourceColumnsOnly.length > 0;
      const antiHallucinationClause = hasDataContext
        ? `\n\n[STRICT: Use ONLY the uploaded data. Do not invent, fabricate, or extrapolate values, treatments, or groups beyond what exists in the attached sources. If data is insufficient, state what is missing rather than approximating.]`
        : "";

      // When pasted CSV was auto-detected, replace the raw CSV text in the query
      // with a clean analysis instruction — the actual data goes via fullData/CSV block
      const effectiveUserMessage = pastedDataDetected
        ? `Analyze this pasted data (${effectiveData.length} rows, ${Object.keys(effectiveData[0] ?? {}).length} columns: ${Object.keys(effectiveData[0] ?? {}).join(', ')}). Provide summary statistics, key findings, and any significant patterns.`
        : userMessage;

      if (pastedDataDetected) {
        toast.success(`Data parsed from paste and saved to history — ${effectiveData.length} rows, ${Object.keys(effectiveData[0] ?? {}).length} columns`, {
          style: { background: '#f7fafc', color: '#1a202c', border: '1px solid #e2e8f0' },
          duration: 3000,
        });
      }

      // When a graph is selected for editing, prepend context so the AI modifies
      // the chart configuration rather than creating a brand new analysis.
      // Include the current chart_data so the AI knows exactly what to modify.
      let graphEditPrefix = "";
      if (isGraphEdit) {
        let currentChartSnippet = "";
        try {
          const store = useAIPanelStore.getState();
          const tabResults = activeTabIdMemo ? (store.resultsByTab[activeTabIdMemo] ?? []) : [];
          const targetResult = tabResults.find((r) => r.id === graphEditTargetId || r.id === graphEditTargetId?.replace('auto-', ''));
          if (targetResult?.analysisResults?.chart_data) {
            currentChartSnippet = `\nCurrent chart_data:\n${JSON.stringify(targetResult.analysisResults.chart_data)}\n`;
          }
        } catch { /* ignore — best-effort */ }
        graphEditPrefix = `[GRAPH EDIT MODE: The user has selected an existing graph and wants to modify it. Apply the following change to the CURRENT chart. Return the COMPLETE updated chart_data (labels, datasets, type, pharma_type) in analysisResults. Keep the same data source — only change the visualization as requested. Do NOT create a new analysis from scratch.

IMPORTANT FOR ERROR BARS: If the user asks to add error bars:
- You MUST include "error_y" arrays in each dataset with actual numeric values (e.g. SD or SEM computed from the data)
- Format: each dataset must have "error_y": [number, number, ...] with one value per data point
- If you cannot compute exact SD/SEM because the raw data is unavailable, use 10% of each mean value as an approximation and note this in your response
- NEVER claim error bars were added without including error_y values in the datasets
- Example: { "label": "Treatment A", "data": [25.3, 18.7], "error_y": [3.2, 2.1] }

IMPORTANT: Return the FULL chart_data object with ALL fields. Do not return only the changed fields — return the complete object so no data is lost during merge.]${currentChartSnippet}\n\n`;
      } else if (tableEditType) {
        // Table edit mode — prepend context about which table and its current data
        let currentTableSnippet = "";
        try {
          const store = useAIPanelStore.getState();
          const tabResults = activeTabIdMemo ? (store.resultsByTab[activeTabIdMemo] ?? []) : [];
          const activeResId = activeTabIdMemo ? store.activeResultIdByTab[activeTabIdMemo] : null;
          const targetResult = activeResId ? tabResults.find((r) => r.id === activeResId) : tabResults[tabResults.length - 1];
          if (tableEditType === 'statistics' && targetResult?.analysisResults?.results_table) {
            currentTableSnippet = `\nCurrent results_table:\n${JSON.stringify(targetResult.analysisResults.results_table)}\n`;
          } else if (tableEditType === 'data-points' && targetResult?.analysisResults?.chart_data) {
            currentTableSnippet = `\nCurrent chart_data (labels + datasets):\n${JSON.stringify({ labels: targetResult.analysisResults.chart_data.labels, datasets: targetResult.analysisResults.chart_data.datasets })}\n`;
          }
        } catch { /* ignore — best-effort */ }
        const tableLabel = tableEditType === 'statistics' ? 'Statistics Summary' : 'Data Points';
        graphEditPrefix = `[TABLE EDIT MODE: The user has selected the ${tableLabel} table and wants to modify it. Apply the following change to the CURRENT table data. Return updated results_table (for Statistics Summary) or updated chart_data with labels+datasets (for Data Points) in analysisResults. Keep the same data source — only modify the table as requested. Do NOT create a new analysis from scratch.]${currentTableSnippet}\n\n`;
      }

      const augmentedQuery =
        datasetLine + instructionsPrefix + projectSourceContext + tabSourceContext + graphEditPrefix + effectiveUserMessage + antiHallucinationClause;

      // NOTE: do NOT append the current user message here.
      // The server already adds the current turn (augmented with data context) as the
      // final message in the messages array.  Appending it here too would produce two
      // consecutive user-role messages at the end of the context, which causes the
      // model to treat the new request as a continuation of the previous one instead
      // of a fresh task — the root cause of the "same chart reused" bug.
      const response = await analyzeMutation.mutateAsync({
        userQuery: augmentedQuery,
        dataPreview,
        dataColumns,
        classifications: effectiveClassifications,
        conversationHistory,
        fullData: effectiveData,
      });

      const responseObj = response as any;

      // Debug: log response shape to diagnose parsing issues
      if (process.env.NODE_ENV !== "production") {
        console.log("[AIChat] Response keys:", Object.keys(responseObj ?? {}));
        console.log("[AIChat] chatResponse:", responseObj.chatResponse ? "present" : "missing");
        console.log("[AIChat] analysis type:", typeof responseObj.analysis, "length:", String(responseObj.analysis ?? "").length);
        console.log("[AIChat] analysisResults:", responseObj.analysisResults ? "present" : "null");
        if (responseObj.analysisResults) {
          console.log("[AIChat] results_table:", Array.isArray(responseObj.analysisResults.results_table) ? `${responseObj.analysisResults.results_table.length} rows` : typeof responseObj.analysisResults.results_table);
          console.log("[AIChat] chart_data:", responseObj.analysisResults.chart_data ? "present" : "null");
        }
      }

      // Track LLM availability for the status indicator
      if (responseObj.llmUnavailable) setLlmStatus('offline');
      else if (responseObj.llmUsed) setLlmStatus('online');
      // else: local-only path (shouldn't happen now, leave as-is)

      // Strip raw JSON dumps and code fences that the LLM sometimes leaks into
      // the analysis field before storing or displaying it.
      let rawContent: string;
      if (typeof response === "string") {
        rawContent = response;
      } else {
        // Prefer the analysis text; if it looks like JSON, try extracting the actual text
        const analysis = responseObj.analysis;
        if (typeof analysis === "string" && analysis.trimStart().startsWith("{")) {
          try {
            const inner = JSON.parse(analysis);
            rawContent = inner?.analysis ?? inner?.chat_response?.message ?? analysis;
          } catch {
            rawContent = analysis;
          }
        } else {
          rawContent = analysis ?? "No analysis result";
        }
      }
      const content = rawContent
        .replace(/```[\s\S]*?```/g, "")   // remove full code blocks
        .replace(/^```.*$/gm, "")          // remove dangling fence lines
        .trim();

      const assistantMsgId = `msg-${Date.now()}`;
      const isLLMUnavailable = !!responseObj.llmUnavailable;

      // RESTORED: detect chart result — check for chart_data presence first,
      // then fall back to analysis_type === "llm_chart".
      // REMOVED: was only checking analysis_type === "llm_chart" which missed the
      //          case where the LLM returned chart_data with analysis_type set to
      //          "dataset_generation" or another non-standard value — causing every
      //          chart response to be silently treated as a table and never rendered.
      const chartData = responseObj.analysisResults?.chart_data;
      const analysisType = responseObj.analysisResults?.analysis_type as string | undefined;
      const isChartResult = !!chartData && (
        analysisType === "llm_chart" ||
        // Defensive: accept chart_data regardless of analysis_type label
        (!!chartData.labels && !!chartData.datasets) ||
        !!chartData.type
      );

      const hasStructuredData = !!responseObj.analysisResults;
      // Detect markdown table syntax: a separator row like |---|---| or | :--- |
      const hasMarkdownTable = /\|\s*[-:]+[-|\s:]*\|/.test(content);
      // Belt-and-suspenders: if the LLM actually processed the query (llmUsed=true) and
      // returned substantial content, always push to the Results panel.  This catches any
      // remaining cases where the server didn't synthesize analysisResults (e.g. an older
      // server build) so free-form data queries never leave stale panel content.
      const hasLLMAnalysis = !!responseObj.llmUsed && content.length > 100;
      const routeToPanel = !!activeTabIdMemo && (isChartResult || hasStructuredData || hasMarkdownTable || hasLLMAnalysis);

      // NEW: dev-mode diagnostics — log chart detection outcome every time
      if (process.env.NODE_ENV !== "production") {
        const q = userMessage.toLowerCase();
        // RESTORED: expanded keyword list (bar chart, scatter, pie were missing)
        const vizKeywords = [
          "area chart","area graph","bar chart","bar graph","scatter plot","scatter chart",
          "line chart","line graph","pie chart","kaplan-meier","km curve","km plot",
          "box plot","boxplot","violin plot","volcano","forest plot","heatmap","heat map",
        ];
        const isVizRequest = vizKeywords.some((k) => q.includes(k));
        if (isVizRequest) {
          if (isChartResult) {
            console.log("[ChartRequest] ✓ Chart detected — routing to Results panel.",
              { analysisType, hasChartData: !!chartData });
          } else {
            // RESTORED: warn when chart requested but neither chart_data nor llm_chart type present
            console.warn("[ChartRequest] ✗ Chart request — no chart_data in response. Showing table fallback.",
              { analysisType, hasChartData: false, query: userMessage.slice(0, 120) });
          }
          // RESTORED: catch case where chart_data exists but analysis_type is wrong
          if (chartData && analysisType !== "llm_chart") {
            console.warn("[ChartRequest] chart_data present but analysis_type is not 'llm_chart'.",
              { analysisType, chartDataType: chartData?.type });
          }
        }
      }

      // Use chat_response.message from the LLM if available, otherwise fall back.
      // Guard: never render raw JSON in the chat bubble — detect JSON blobs and extract
      // the human-readable message from them.
      const chatResp = responseObj.chatResponse as { message?: string; suggestions?: string[] } | undefined;
      let chatBubbleContent: string;
      if (chatResp?.message) {
        chatBubbleContent = chatResp.message;
      } else if (routeToPanel && !isLLMUnavailable) {
        chatBubbleContent = "Analysis complete — results are in the **Results panel** on the right.";
      } else {
        // Check if content looks like raw JSON (starts with { or contains JSON structure)
        const trimmed = content.trimStart();
        const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[") ||
          (trimmed.includes('"chat_response"') && trimmed.includes('"analysisResults"')) ||
          (trimmed.includes('"analysis"') && trimmed.includes('"results_table"'));

        if (looksLikeJson) {
          // Raw JSON leaked into content — try to extract chat_response.message
          try {
            const parsed = JSON.parse(trimmed);
            chatBubbleContent = parsed?.chat_response?.message
              || parsed?.analysis
              || "Analysis complete — results are in the **Results panel** on the right.";
          } catch {
            // Not valid JSON but looks like it — use fallback
            chatBubbleContent = hasStructuredData
              ? "Analysis complete — results are in the **Results panel** on the right."
              : content;
          }
        } else {
          chatBubbleContent = content;
        }
      }

      addChatMessage({
        id: assistantMsgId,
        role: "assistant",
        content: chatBubbleContent,
        timestamp: Date.now(),
        metadata: {
          ...(isLLMUnavailable && {
            llmUnavailable: true,
            llmError: responseObj.llmError,
            retryQuery: userMessage,
          }),
          ...(chatResp?.suggestions && chatResp.suggestions.length > 0 && {
            chatSuggestions: chatResp.suggestions,
          }),
        },
      });

      // Push analysis results (charts + tables) to this tab's Graph & Table panel
      // Graph-edit mode: update the existing result in-place instead of creating a new one
      const realGraphResultId = graphEditTargetId?.startsWith('auto-')
        ? graphEditTargetId.slice(5) // strip "auto-" prefix for auto-charts
        : graphEditTargetId;

      if (isGraphEdit && realGraphResultId && activeTabIdMemo) {
        // Always run graph edit update — even if routeToPanel is false (partial AI response).
        // The deep-merge in updatePanelResult preserves existing chart_data/results_table.
        const editPatch: Record<string, any> = { analysis: content };
        if (responseObj.analysisResults) editPatch.analysisResults = responseObj.analysisResults;
        if (responseObj.graphTitle) editPatch.graphTitle = responseObj.graphTitle;
        if (responseObj.chartConfig) editPatch.chartConfig = responseObj.chartConfig;

        // ── Validate that chart_data actually changed before confirming ──
        const store = useAIPanelStore.getState();
        const tabResults = store.resultsByTab[activeTabIdMemo] ?? [];
        const prevResult = tabResults.find((r) => r.id === realGraphResultId);
        const prevChartData = prevResult?.analysisResults?.chart_data;
        const newChartData = responseObj.analysisResults?.chart_data;

        // Check if the new chart_data is meaningfully different from the old
        const prevJson = prevChartData ? JSON.stringify(prevChartData) : '';
        const newJson = newChartData ? JSON.stringify(newChartData) : '';
        const chartActuallyChanged = newJson.length > 0 && newJson !== prevJson;

        updatePanelResult(activeTabIdMemo, realGraphResultId, editPatch);
        clearSelectedGraph();

        if (chartActuallyChanged) {
          toast.success("Graph updated successfully", {
            style: { background: '#f0fdf4', color: '#166534', borderColor: '#86efac' },
          });
        } else if (!newChartData) {
          toast("Graph edit processed — chart data unchanged. The AI may not have been able to apply this modification.", {
            style: { background: '#fefce8', color: '#854d0e', borderColor: '#fde047' },
            duration: 5000,
          });
        } else {
          toast("No visible changes detected in chart config. Try rephrasing your edit request.", {
            style: { background: '#fefce8', color: '#854d0e', borderColor: '#fde047' },
            duration: 5000,
          });
        }
      } else if (tableEditType && activeTabIdMemo) {
        // Table edit mode: update the active result in-place with new table data
        const store = useAIPanelStore.getState();
        const tabResults = store.resultsByTab[activeTabIdMemo] ?? [];
        const activeResId = store.activeResultIdByTab[activeTabIdMemo];
        const targetResult = activeResId ? tabResults.find((r) => r.id === activeResId) : tabResults[tabResults.length - 1];
        if (targetResult && responseObj.analysisResults) {
          const editPatch: Record<string, any> = { analysis: content };
          editPatch.analysisResults = responseObj.analysisResults;
          if (responseObj.graphTitle) editPatch.graphTitle = responseObj.graphTitle;
          updatePanelResult(activeTabIdMemo, targetResult.id, editPatch);
          toast.success("Table updated successfully", {
            style: { background: '#eef6ff', color: '#1e40af', borderColor: '#93c5fd' },
          });
        } else if (routeToPanel) {
          setPanelResult(activeTabIdMemo, {
            query: userMessage,
            analysis: content,
            analysisResults: responseObj.analysisResults ?? undefined,
            graphTitle: responseObj.graphTitle ?? undefined,
            tableData:  responseObj.tableData  ?? undefined,
          });
        }
        // Keep table selected so user can make multiple edits
      } else if (routeToPanel) {
        setPanelResult(activeTabIdMemo, {
          query: userMessage,
          analysis: content,
          analysisResults: responseObj.analysisResults ?? undefined,
          graphTitle: responseObj.graphTitle ?? undefined,
          tableData:  responseObj.tableData  ?? undefined,
        });
      }

      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content },
      ]);
    } catch (err) {
      console.error("Error analyzing data:", err);
      if (isGraphEdit) {
        toast.error("Failed to update graph. Please try again.", {
          style: { background: '#fef2f2', color: '#991b1b', borderColor: '#fca5a5' },
        });
      } else if (tableEditType) {
        toast.error("Failed to update table. Please try again.", {
          style: { background: '#fef2f2', color: '#991b1b', borderColor: '#fca5a5' },
        });
      } else {
        toast.error("Failed to analyze data. Please try again.");
      }
      addChatMessage({
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: isGraphEdit
          ? "Sorry, I couldn't update the graph. Please try a different edit or re-run the analysis."
          : tableEditType
            ? "Sorry, I couldn't update the table. Please try a different edit or re-run the analysis."
            : "Sorry, I encountered an error while analyzing your data. Please try again.",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    inputValue,
    addChatMessage,
    activeTabIdMemo,
    isFirstQuery,
    renameTab,
    setTabLastQuery,
    fullData,
    conversationHistory,
    analyzeMutation,
    columnClassifications,
    attachedFiles,
    projectSettings,
    activeProjectSources,
    activeTabFiles,
    selectedGraphId,
    selectedTableType,
    updatePanelResult,
    clearSelectedGraph,
  ]);

  // ── Guard: check for unparsable PDF sources before sending ──
  const trySendMessage = useCallback((explicitText?: string) => {
    const msg = (explicitText ?? inputValue).trim();
    if (!msg) return;

    // Auto-select first source if sources exist but none are selected
    const anySources = projectSettings.sources.length > 0 || attachedFiles.length > 0;
    const anyActive = allActiveSourceNames.length > 0;
    if (anySources && !anyActive) {
      // Pick the first available source and select it
      const firstSource = projectSettings.sources[0] ?? attachedFiles[0];
      if (firstSource) {
        const id = firstSource.id;
        setSourceSelection(prev => ({ ...prev, [id]: true }));
        toast.success("Auto-selected uploaded file for analysis", {
          style: { backgroundColor: "#3b82f6", color: "#fff", border: "none" },
        });
      }
    }

    // Check if any active source is a PDF without extractable content
    const unparsablePdfs = [
      ...activeProjectSources.filter(s => s.type === 'pdf' && !s.preview),
      ...activeTabFiles.filter(f => f.type === 'PDF' && !f.size), // tab files don't have preview but PDFs are at risk
    ];
    // For project sources, we can check preview; for tab PDFs, assume they went through parsePdf on upload
    const projectPdfNoPreview = activeProjectSources.filter(
      s => s.type === 'pdf' && (!s.preview || s.preview.trim().length === 0)
    );

    if (projectPdfNoPreview.length > 0) {
      setPdfWarningPendingMessage(msg);
      setPdfWarningOpen(true);
      return;
    }

    handleSendMessage(explicitText);
  }, [inputValue, activeProjectSources, activeTabFiles, handleSendMessage, projectSettings.sources, attachedFiles, allActiveSourceNames]);

  // ── Listen for retry-analysis events dispatched from the Results panel ──
  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent).detail?.query;
      if (query && typeof query === "string") {
        handleSendMessage(query);
      }
    };
    document.addEventListener("nuphorm-retry-analysis", handler);
    return () => document.removeEventListener("nuphorm-retry-analysis", handler);
  }, [handleSendMessage]);

  // ── Auto-send pending graph edit actions from quick-action buttons ─────
  useEffect(() => {
    if (pendingEditAction && !isLoading) {
      const action = useAIPanelStore.getState().consumePendingEdit();
      if (action) {
        handleSendMessage(action);
      }
    }
  }, [pendingEditAction, isLoading, handleSendMessage]);

  // ── Pre-fill chat input from "Add to Chat" buttons in results panel ───
  useEffect(() => {
    if (pendingChatContent) {
      const content = useAIPanelStore.getState().consumePendingChat();
      if (content) {
        setInputValue(content);
        // Focus and auto-resize the textarea
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
          }
        });
      }
    }
  }, [pendingChatContent]);

  // ── Restoring state ────────────────────────────────────────────────────
  if (isRestoring) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        Restoring chat history…
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background overflow-hidden",
        className
      )}
    >
      {/* ── Header strip (hidden in compact/embedded mode) ─────────────── */}
      {!compact && (
        <div className="flex-shrink-0 border-b border-border px-4 py-3 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary opacity-70" />
            <h3 className="text-sm font-semibold text-foreground">
              AI Biostatistics Assistant
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {selectedMeasurements.length > 0 && (
              <>
                {selectedMeasurements.slice(0, 4).map((id) => (
                  <Badge key={id} variant="secondary" className="text-xs py-0 h-5">
                    {id}
                  </Badge>
                ))}
                {selectedMeasurements.length > 4 && (
                  <Badge variant="secondary" className="text-xs py-0 h-5">
                    +{selectedMeasurements.length - 4}
                  </Badge>
                )}
              </>
            )}
            {conversationHistory.length > 0 && (
              <button
                onClick={() => {
                  setConversationHistory([]);
                  clearChatHistory();
                  toast.success('Conversation history cleared');
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                style={{
                  background: '#a0aec0',
                  color: '#1a202c',
                  border: 'none',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#a0aec0'; }}
                title="Clear conversation memory so AI starts fresh"
              >
                <Trash2 size={12} />
                Clear History
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Messages area ──────────────────────────────────────────────── */}
      <div
        ref={chatContainerRef}
        className={cn(
          "flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden",
          compact ? "px-3 py-3 space-y-3 pb-4" : "px-4 py-6 space-y-6 pb-48"
        )}
        style={{ scrollbarWidth: "none" }}
      >
        {/* Empty state */}
        {chatMessages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground select-none">
            <Sparkles className="w-10 h-10 opacity-20" />
            <p className="text-sm text-center max-w-xs leading-relaxed">
              Ask me anything about your biostatistics data
            </p>
            {uploadedData && (
              <p className="text-xs opacity-50">
                📊 {uploadedData.filename} · {fullData.length} rows loaded
              </p>
            )}
          </div>
        )}

        {/* Message bubbles */}
        {chatMessages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const msgId = msg.id || `idx-${idx}`;
          return (
            <div
              key={msgId}
              className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl shadow-sm",
                  compact ? "px-3 py-2" : "px-5 py-3.5",
                  isUser
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-foreground"
                )}
              >
                {isUser ? (
                  <p className={cn("whitespace-pre-wrap break-words leading-relaxed", compact && "text-xs")}>
                    {msg.content}
                  </p>
                ) : (
                  <div className={cn("prose dark:prose-invert max-w-none break-words leading-relaxed", compact ? "prose-xs text-xs" : "prose-sm")}>
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                )}
                {msg.timestamp && (
                  <p
                    className={cn(
                      "text-xs mt-1.5 opacity-70",
                      isUser ? "text-right" : "text-left"
                    )}
                  >
                    {formatTimestamp(msg.timestamp)}
                  </p>
                )}
                {/* "Using:" source tags — shown beneath user messages when sources were active */}
                {isUser && msg.metadata?.usedSources && msg.metadata.usedSources.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                    <span className="text-[10px] text-blue-200 opacity-80">Using:</span>
                    {msg.metadata.usedSources.map((name: string, si: number) => (
                      <span
                        key={si}
                        className="text-[10px] bg-blue-500/30 text-blue-100 px-1.5 py-0.5 rounded"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                {/* Retry button — shown only when AI interpretation failed */}
                {!isUser && msg.metadata?.llmUnavailable && (
                  <div className="mt-3 pt-2.5 border-t border-amber-200 dark:border-amber-800/50 space-y-1.5">
                    {msg.metadata.llmError && (
                      <p className="text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/20 rounded px-2 py-1 break-all leading-relaxed">
                        {msg.metadata.llmError.slice(0, 200)}
                      </p>
                    )}
                    <button
                      onClick={() => handleSendMessage(msg.metadata?.retryQuery ?? lastUserQueryRef.current)}
                      disabled={isLoading}
                      className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-1.5 disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                      Retry AI interpretation
                    </button>
                  </div>
                )}
              </div>

              {/* Suggestion chips — shown below assistant messages with chatSuggestions */}
              {!isUser && msg.metadata?.chatSuggestions && msg.metadata.chatSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[82%]">
                  {msg.metadata.chatSuggestions.map((suggestion, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => {
                        handleSendMessage(suggestion);
                      }}
                      disabled={isLoading}
                      className="text-left text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-700 border border-[#e2e8f0] dark:border-gray-600 text-[#374151] dark:text-gray-200 hover:bg-blue-50 hover:border-[#3b82f6] hover:text-[#1d4ed8] transition-colors disabled:opacity-40 shadow-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading dots */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-5 py-3.5 bg-gray-100 dark:bg-gray-800 shadow-sm">
              <div className="flex gap-1.5 items-center">
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]" />
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]" />
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Dataset pill removed — all source info lives in the foldable Sources Attached drawer */}

      {/* ── Dataset Tools accordion (hidden in compact mode — dropdowns serve this) */}
      {!compact && <DatasetToolsPanel />}

      {/* Sources panel removed — now accessible via paperclip icon in input bar */}

      {/* ── Pinned input bar ──────────────────────────────────────────── */}
      <div className={cn(
        "flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-border/50 z-10",
        !compact && "shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.35)]"
      )}>
        <div className={cn("mx-auto", compact ? "px-3 py-2" : "max-w-5xl px-6 py-4")}>

          {/* REMOVED: inline attachment chip strip — file attachments are now managed
              exclusively through the AttachmentModal (paperclip button).
              No file names, row counts, or X-buttons appear in the chat flow. */}

          {/* LLM offline status banner — visible only while status is known-offline */}
          {llmStatus === 'offline' && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-[11px] text-amber-700 dark:text-amber-300 flex-1 leading-tight">
                Offline stats mode — AI interpretation unavailable
              </span>
              <button
                onClick={() => handleSendMessage(lastUserQueryRef.current)}
                disabled={!lastUserQueryRef.current || isLoading}
                className="text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-40 flex-shrink-0 transition-opacity"
              >
                Retry
              </button>
              <button
                onClick={() => setLlmStatus('unknown')}
                className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-1"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {/* Gray banner removed — single paperclip entry point in input bar */}
          {/* Graph/table edit mode banner */}
          {(selectedGraphId || selectedTableType) && (
            <div className={cn(
              "flex items-center justify-between px-4 py-2 rounded-t-2xl border border-b-0",
              selectedGraphId ? "bg-[#f0fdf4] border-emerald-200" : "bg-[#eef6ff] border-[#c7dbf1]"
            )}>
              <span className={cn("text-xs font-medium", selectedGraphId ? "text-emerald-700" : "text-[#2b7de9]")}>
                {selectedGraphId
                  ? "Editing selected graph — your next message will modify the chart"
                  : selectedTableType === 'statistics'
                    ? "Editing selected table — your next message will modify the table"
                    : "Editing selected data table — your next message will modify the data table"}
              </span>
              <button
                type="button"
                onClick={clearSelectedGraph}
                className={cn(
                  "text-xs font-medium underline underline-offset-2",
                  selectedGraphId ? "text-emerald-600 hover:text-emerald-800" : "text-[#2b7de9] hover:text-[#1a5fb4]"
                )}
              >
                Cancel
              </button>
            </div>
          )}
          {/* Card-style input container */}
          <div className={cn(
            "flex gap-3 bg-background shadow-md px-4 transition-all duration-200",
            (selectedGraphId || selectedTableType) ? "rounded-b-2xl border-2" : "rounded-2xl border-2",
            (selectedGraphId || selectedTableType)
              ? selectedGraphId
                ? "border-emerald-300"
                : "border-[#93bbea]"
              : "",
            compact
              ? "items-end py-3 border-border/70 bg-[#f8fafc] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 focus-within:bg-white"
              : selectedGraphId
                ? "items-end py-3 border-emerald-300 focus-within:border-emerald-500 focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                : selectedTableType
                  ? "items-end py-3 border-[#93bbea] focus-within:border-[#2b7de9] focus-within:shadow-[0_0_0_3px_rgba(43,125,233,0.14)]"
                  : "items-end py-3 border-[#E5E7EB] focus-within:border-[#3b82f6] focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
          )}>

            {/* Paperclip — Source Documents toggle */}
            <div className="relative flex-shrink-0 self-end pb-1.5">
              <button
                type="button"
                onClick={() => setSourcesOpen((v) => !v)}
                title="Manage Source Documents"
                className={cn(
                  "p-2 rounded-full transition-colors",
                  sourcesOpen
                    ? "text-[#194CFF] bg-[#eff6ff]"
                    : "text-[#194CFF] hover:text-[#3b82f6] hover:bg-[#f1f5f9]"
                )}
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Source Documents popup — positioned above the input bar */}
              {sourcesOpen && (
                <div
                  className="absolute bottom-full left-0 mb-3 w-[300px] bg-[#f9fafb] border border-[#e2e8f0] rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] z-50 overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
                    <h3 className="text-lg font-bold text-[#0f172a]">Source Documents</h3>
                    <button
                      type="button"
                      onClick={() => setSourcesOpen(false)}
                      className="p-1 rounded text-[#64748b] hover:text-[#111827] hover:bg-[#f1f5f9] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrollable content */}
                  <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
                    {/* Project Files */}
                    <div className="px-4 py-3">
                      <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-[#2563eb]" />
                        Project Files
                      </h4>
                      <p className="text-[10px] text-[#94a3b8] mb-2 pl-5">Shared across all analysis tabs</p>
                      <div className="h-px bg-[#e2e8f0] mb-2" />
                      {projectSettings.sources.length === 0 ? (
                        <p className="text-xs text-[#94a3b8] italic pl-5">No project-level files</p>
                      ) : (
                        <div className="space-y-0.5">
                          {projectSettings.sources.map((src) => {
                            const ext = src.name.split(".").pop()?.toLowerCase() ?? "";
                            const SrcIcon = ["csv", "xlsx", "xls", "tsv"].includes(ext) ? FileSpreadsheet : FileText;
                            return (
                              <div
                                key={src.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white group transition-colors"
                              >
                                <SrcIcon className="w-4 h-4 text-[#2563eb] flex-shrink-0" />
                                <span className="text-xs font-medium text-[#0f172a] truncate flex-1 min-w-0">
                                  {src.name}
                                </span>
                                {src.size && <span className="text-[10px] text-[#94a3b8] flex-shrink-0">{formatBytes(src.size)}</span>}
                                <button
                                  type="button"
                                  onClick={() => {
                                    activeProjectId && removeProjectSource(activeProjectId, src.id);
                                    toast.success("Project file removed");
                                  }}
                                  className="text-[10px] text-[#ef4444] font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:underline flex-shrink-0"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Tab Files */}
                    <div className="px-4 py-3 border-t border-[#e2e8f0]">
                      <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#2563eb]" />
                        Tab Files
                      </h4>
                      <p className="text-[10px] text-[#94a3b8] mb-2 pl-5">Files uploaded here are associated with this analysis tab</p>
                      <div className="h-px bg-[#e2e8f0] mb-2" />
                      {attachedFiles.length === 0 ? (
                        <p className="text-xs text-[#94a3b8] italic pl-5">No tab files yet — add below</p>
                      ) : (
                        <div className="space-y-0.5">
                          {attachedFiles.map((file) => {
                            const ext = file.type?.toLowerCase() ?? "";
                            const FIcon = ["csv", "xlsx", "xls"].includes(ext) ? FileSpreadsheet : FileText;
                            return (
                              <div
                                key={file.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white group transition-colors"
                              >
                                <FIcon className="w-4 h-4 text-[#2563eb] flex-shrink-0" />
                                <span className="text-xs font-medium text-[#0f172a] truncate flex-1 min-w-0">
                                  {file.name}
                                </span>
                                {file.size && <span className="text-[10px] text-[#94a3b8] flex-shrink-0">{file.size}</span>}
                                <button
                                  type="button"
                                  onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                                  className="text-[10px] text-[#ef4444] font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:underline flex-shrink-0"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: Add File + Upload from Computer */}
                  <div className="px-4 py-3 border-t border-[#e2e8f0] space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setPickerOpen(true); setSourcesOpen(false); }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#194CFF] rounded-lg hover:bg-[#3b82f6] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add from Repository
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAttachScope('tab'); computerUploadRef.current?.click(); setSourcesOpen(false); }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#194CFF] border border-[#194CFF] rounded-lg hover:bg-[#eff6ff] transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload File
                      </button>
                    </div>
                    <p className="text-[10px] text-[#94a3b8] text-center">Drag files into the chat area or click to browse</p>
                  </div>
                </div>
              )}
            </div>

            {/* Voice dictation */}
            <div className="relative flex-shrink-0 self-end pb-1.5">
              <VoiceDictationButton
                inputValue={inputValue}
                setInputValue={setInputValue}
                textareaRef={textareaRef}
                onSubmit={() => trySendMessage()}
              />
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-border/60 flex-shrink-0 mx-0.5 self-end mb-2.5" />

            {/* Auto-grow textarea — transparent, fills remaining space */}
            <textarea
              ref={textareaRef}
              data-chat-input=""
              value={inputValue}
              rows={1}
              onChange={(e) => {
                setInputValue(e.target.value);
                const ta = e.target;
                ta.style.height = "auto";
                const sh = ta.scrollHeight;
                ta.style.height = Math.min(sh, 200) + "px";
                ta.style.overflowY = sh > 200 ? "auto" : "hidden";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  trySendMessage();
                  requestAnimationFrame(() => {
                    if (textareaRef.current) {
                      textareaRef.current.style.height = "80px";
                      textareaRef.current.style.overflowY = "hidden";
                    }
                  });
                }
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={
                isLoading
                  ? "Thinking…"
                  : selectedGraphId
                    ? "Describe how to edit the selected graph (e.g. 'change to bar chart', 'add error bars')…"
                    : selectedTableType === 'statistics'
                      ? "Describe how to edit the selected table (e.g. 'add a column', 'compute median')…"
                      : selectedTableType === 'data-points'
                        ? "Describe how to edit the data table (e.g. 'add a row', 'sort ascending')…"
                        : "Paste your data or ask a question — no code needed"
              }
              disabled={isLoading}
              className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/55 caret-primary disabled:cursor-not-allowed resize-none overflow-hidden leading-6"
              style={{ minHeight: "80px", maxHeight: "200px", padding: "16px 16px", fontSize: "15px" }}
            />

            {/* Right: Send button only — no file badges in input bar */}
            <div className="flex items-center gap-2 flex-shrink-0 self-end pb-1.5">
              {/* Send */}
              <Button
                onClick={() => {
                  trySendMessage();
                  requestAnimationFrame(() => {
                    if (textareaRef.current) {
                      textareaRef.current.style.height = "80px";
                      textareaRef.current.style.overflowY = "hidden";
                    }
                  });
                }}
                disabled={isLoading || !inputValue.trim()}
                aria-label="Send message"
                title="Send message"
                className={cn(
                  "rounded-full bg-[#0f172a] text-white transition-all p-0 flex-shrink-0",
                  "hover:bg-[#1e293b] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                  compact
                    ? "h-11 w-11"
                    : "h-12 w-12 shadow-[0_2px_6px_rgba(15,23,42,0.30)] hover:shadow-[0_4px_14px_rgba(15,23,42,0.42)] hover:scale-110"
                )}
              >
                {isLoading ? (
                  <Loader2 className={compact ? "h-4 w-4 animate-spin" : "h-5 w-5 animate-spin"} />
                ) : (
                  <Send className={compact ? "h-4 w-4" : "h-6 w-6"} />
                )}
              </Button>
            </div>
          </div>

          {/* "Enter to send" hint — fades in when textarea is focused (non-compact only) */}
          {!compact && inputFocused && (
            <div className="flex items-center justify-center mt-1.5 animate-in fade-in duration-200">
              <span className="text-[11px] select-none" style={{ color: "#3b82f6", opacity: 0.75 }}>
                ↵ Enter to send · Shift+Enter for new line
              </span>
            </div>
          )}

          {/* "Powered by Claude" footnote — shown only after a successful LLM response */}
          {llmStatus === 'online' && (
            <div className="flex items-center gap-1 mt-1.5 px-1">
              <Sparkles className="w-2.5 h-2.5 text-primary/50 flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground/60 select-none">
                Powered by Claude
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialogs & panels ───────────────────────────────────────────── */}

      {/* NEW: AttachmentModal — opened by paperclip button.
          Shows project-level + tab-level sources with remove/clear actions.
          Also provides "Add from Library" and "Upload File" action buttons.
          REMOVED: inline chip strip above input bar (no more chat clutter). */}
      <AttachmentModal
        open={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        tabFiles={attachedFiles}
        onRemoveTabFile={(id) => {
          setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
          toast.success("File removed", {
            style: { backgroundColor: "#00cc99", color: "#ffffff", border: "none" },
            duration: 2000,
          });
        }}
        onClearAllTabFiles={() => setAttachedFiles([])}
        projectSources={projectSettings.sources}
        onRemoveProjectSource={(id) => {
          activeProjectId && removeProjectSource(activeProjectId, id);
          toast.success("File removed", {
            style: { backgroundColor: "#00cc99", color: "#ffffff", border: "none" },
            duration: 2000,
          });
        }}
        onAddFromLibrary={() => { setPickerOpen(true); }}
        onUploadFromComputer={() => { computerUploadRef.current?.click(); }}
        tabName={activeTabName}
        sourceSelection={sourceSelection}
        onToggleSource={toggleSource}
        onSelectAll={selectAllSources}
        onSelectNone={selectNoneSources}
        onSelectTabOnly={selectTabOnly}
        onSelectProjectOnly={selectProjectOnly}
        isSourceUsedInQueries={isSourceUsedInQueries}
        onSetScope={(scope) => setAttachScope(scope)}
        onLoadToQuery={() => {
          toast.success("Sources loaded and associated with your query.", {
            style: { backgroundColor: "#00cc99", color: "#ffffff", border: "none" },
            duration: 2500,
          });
        }}
      />

      <FilePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAttach={(files) => handleAttachedFiles(files, attachScope)}
      />

      {/* SourcesPanel bottom sheet removed — all file management via AttachmentModal */}

      {/* Hidden input for computer file upload */}
      <input
        ref={computerUploadRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.json,.txt,.pdf"
        className="hidden"
        onChange={handleComputerUpload}
      />

      {/* ── PDF unparsable warning modal ─────────────────────────────── */}
      {pdfWarningOpen && (
        <>
          <div
            className="fixed inset-0 z-[200] bg-black/30"
            onClick={() => { setPdfWarningOpen(false); setPdfWarningPendingMessage(null); }}
          />
          <div
            className="fixed z-[210] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl border w-full max-w-sm p-6"
            style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: "#111827" }}>
              PDF Content Not Fully Extractable
            </h3>
            <p className="text-xs leading-relaxed mb-5" style={{ color: "#475569" }}>
              One or more selected PDF sources could not be fully parsed for text content.
              The AI will only have access to the file name and basic metadata.
              Proceed with basic metadata?
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setPdfWarningOpen(false); setPdfWarningPendingMessage(null); }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                style={{ borderColor: "#e2e8f0", color: "#64748b" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setPdfWarningOpen(false);
                  if (pdfWarningPendingMessage) {
                    handleSendMessage(pdfWarningPendingMessage);
                  }
                  setPdfWarningPendingMessage(null);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={{ backgroundColor: "#3b82f6", color: "#ffffff" }}
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
