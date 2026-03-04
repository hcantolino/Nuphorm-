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
// NEW: scope-picker dropdown when attaching files (project vs tab level)
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Wand2,
  ShieldCheck,
  BarChart2,
  Download,
  CheckCircle2,
  RefreshCw,
  WifiOff,
  FolderOpen,   // NEW: project-scope indicator icon in attach dropdown + chips
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
}

type PreviewEntry =
  | { type: "loading" }
  | { type: "error"; content: string }
  | { type: "text"; content: string }
  | { type: "table"; headers: string[]; rows: Array<Record<string, any>> };

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseCSVData(csvContent: string): Array<Record<string, any>> {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Auto-detect delimiter: compare tab vs comma count in the header row
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

function FileIcon({ type, className: cls }: { type: string; className?: string }) {
  const ext = type?.toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    return <FileSpreadsheet className={cn("w-5 h-5 text-emerald-600 flex-shrink-0", cls)} />;
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
          const parsed = parseCSVData(result.content);
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
              className="text-[10px] h-5 px-1.5 border-emerald-300 text-emerald-700 bg-emerald-50"
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
                        className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50 transition-all"
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
                        className="rounded-xl border border-emerald-100 overflow-hidden bg-emerald-50/20"
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
                          <div className="border-t border-emerald-100/60 bg-emerald-50/10 px-4 py-3">
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-28 overflow-y-auto">
                              {src.preview}
                              {src.preview.length >= 600 && (
                                <span className="text-primary/60"> …(truncated)</span>
                              )}
                            </pre>
                          </div>
                        ) : (
                          <div className="border-t border-emerald-100/60 px-4 py-2">
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
      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      <span className="text-xs font-medium truncate max-w-[180px]">
        {currentDataset.filename}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        · {currentDataset.rowCount.toLocaleString()} rows
      </span>
      {currentDataset.cleaned && (
        <span className="flex items-center gap-0.5 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0">
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
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [fullData, setFullData] = useState<Array<Record<string, any>>>([]);
  const [columnClassifications, setColumnClassifications] = useState<
    Record<string, any>
  >({});
  const setPanelResult = useAIPanelStore((s) => s.setPanelResult);

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
          const parsed = parseCSVData(result.content);
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

          // CHANGED: route to project-level store or tab-level list based on attachScope.
          // BEFORE: always called setAttachedFiles (tab-level only).
          if (attachScope === 'project' && activeProjectId) {
            // NEW: project-scoped upload — read full text as preview, store in projectStore
            addProjectSource(activeProjectId, {
              id: tempId,
              name: file.name,
              size: file.size,              // bytes available from the real File object
              type: (file.name.split('.').pop()?.toLowerCase()) ?? 'file',
              uploadedAt: Date.now(),
              preview: text.slice(0, 2 * 1024 * 1024), // up to 2 MB preview for AI context
            });
            toast.success(`"${file.name}" added to project sources (all tabs)`);
          } else {
            setAttachedFiles((prev) => [...prev, newFile]);
          }

          // Auto-parse spreadsheet/text files for in-memory analysis
          const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
          if (["csv", "tsv", "txt"].includes(ext)) {
            const parsed = parseCSVData(text);
            if (parsed.length > 0) {
              setColumnClassifications(deriveColumnTypes(parsed));
              setUploadedData({ filename: file.name, size: newFile.size });
              setFullData(parsed);
              onDataLoaded?.(parsed);

              // Set global current dataset so all components see it
              useCurrentDatasetStore.getState().setCurrentDataset({
                filename: file.name,
                rowCount: parsed.length,
                columns: Object.keys(parsed[0] ?? {}),
                rows: parsed as Record<string, unknown>[],
                cleaned: false,
              });

              // Auto-message in chat
              addChatMessage({
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: `✅ **${file.name}** attached — ${parsed.length.toLocaleString()} rows · ${Object.keys(parsed[0] ?? {}).length} columns. Would you like me to clean it first?`,
                timestamp: Date.now(),
              });
            } else {
              toast.success(`${file.name} attached`);
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
    // CHANGED: added attachScope, activeProjectId, addProjectSource to deps so the
    // handler always reads the current scope when the OS file picker resolves.
    [uploadFileMutation, onDataLoaded, attachScope, activeProjectId, addProjectSource]
  );

  // ── Send message ───────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (explicitText?: string) => {
    const userMessage = (explicitText ?? inputValue).trim();
    if (!userMessage) return;

    if (!explicitText) setInputValue("");
    lastUserQueryRef.current = userMessage;

    addChatMessage({
      id: `msg-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
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

      // Third fallback: parse project source preview (stored as full CSV text up to 2MB).
      // This covers files uploaded via ProjectContextPanel that never hit handleComputerUpload.
      // Falls back gracefully to column-names-only when the stored preview is too short to
      // produce data rows (e.g., legacy 600-char previews from before the 2MB limit was set).
      let projectSourceColumnsOnly: string[] = [];
      let projectSourcePreviewText = '';
      if (effectiveData.length === 0) {
        const csvSource = projectSettings.sources.find(
          (s) => ['csv', 'tsv', 'txt'].includes(s.type) && s.preview && s.preview.length > 0
        );
        if (csvSource?.preview) {
          const parsed = parseCSVData(csvSource.preview);
          if (parsed.length > 0) {
            effectiveData = parsed;
            // Warm up both component state and global store for subsequent queries
            setFullData(parsed);
            useCurrentDatasetStore.getState().setCurrentDataset({
              filename: csvSource.name,
              rowCount: parsed.length,
              columns: Object.keys(parsed[0] ?? {}),
              rows: parsed as Record<string, unknown>[],
              cleaned: false,
            });
          } else {
            // Preview too short for full rows — extract column names from header at minimum
            const firstLine = csvSource.preview.split('\n')[0] ?? '';
            if (firstLine) {
              const tabs = (firstLine.match(/\t/g) ?? []).length;
              const commas = (firstLine.match(/,/g) ?? []).length;
              const sep = tabs > commas ? '\t' : ',';
              projectSourceColumnsOnly = firstLine
                .split(sep)
                .map((h) => h.trim().replace(/^"|"$/g, ''))
                .filter(Boolean);
              // Use whatever partial text we have so the LLM has context
              projectSourcePreviewText = csvSource.preview.slice(0, 600);
            }
          }
        }
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

      // 2. Project sources — include short text previews where available so the
      //    AI can reason about the actual data content, not just file names.
      const projectSourceLines = projectSettings.sources.map((s) => {
        if (s.preview) {
          const snippet = s.preview.slice(0, 250);
          return `- ${s.name} (excerpt: ${snippet}${s.preview.length > 250 ? "…" : ""})`;
        }
        return `- ${s.name}`;
      });
      const projectSourceContext =
        projectSourceLines.length > 0
          ? `[Project Sources (Applied to All Tabs):\n${projectSourceLines.join("\n")}]\n\n`
          : "";

      // 3. Tab-specific attached files (uploaded via the chat paperclip/upload
      //    in this tab — not shared with other tabs).
      const tabSourceLines = attachedFiles.map(
        (f) => `- ${f.name} (${f.type})`
      );
      const tabSourceContext =
        tabSourceLines.length > 0
          ? `[Tab-Specific Sources (This Tab Only):\n${tabSourceLines.join("\n")}]\n\n`
          : "";

      // Prepend current dataset summary so the AI always knows what data is loaded.
      // Use effectiveData length for accuracy (may differ from stored rowCount if
      // the store was set via a different path than the component state).
      const datasetLine = cdStore
        ? `[Current Dataset: ${cdStore.filename}, ${effectiveData.length || cdStore.rowCount} rows, ${cdStore.columns.length} cols${cdStore.cleaned ? ", ✓ cleaned" : ""}]\n\n`
        : effectiveData.length > 0
        ? `[Current Dataset: in-memory data, ${effectiveData.length} rows, ${dataColumns.length} cols]\n\n`
        : "";

      const augmentedQuery =
        datasetLine + instructionsPrefix + projectSourceContext + tabSourceContext + userMessage;

      const response = await analyzeMutation.mutateAsync({
        userQuery: augmentedQuery,
        dataPreview,
        dataColumns,
        classifications: effectiveClassifications,
        conversationHistory: [
          ...conversationHistory,
          { role: "user", content: userMessage },
        ],
        fullData: effectiveData,
      });

      const responseObj = response as any;
      // Track LLM availability for the status indicator
      if (responseObj.llmUnavailable) setLlmStatus('offline');
      else if (responseObj.llmUsed) setLlmStatus('online');
      // else: local-only path (shouldn't happen now, leave as-is)

      const content =
        typeof response === "string"
          ? response
          : responseObj.analysis ?? "No analysis result";

      const assistantMsgId = `msg-${Date.now()}`;
      const isLLMUnavailable = !!responseObj.llmUnavailable;
      const hasStructuredData = !!responseObj.analysisResults;
      // Detect markdown table syntax: a separator row like |---|---| or | :--- |
      const hasMarkdownTable = /\|\s*[-:]+[-|\s:]*\|/.test(content);
      // Route to Results panel for analytical responses (structured data OR markdown table)
      const routeToPanel = !!activeTabIdMemo && (hasStructuredData || hasMarkdownTable);

      addChatMessage({
        id: assistantMsgId,
        role: "assistant",
        // LLM offline: show full content in chat (has retry instructions)
        // Analytical LLM response: show brief stub in chat; full results go to Results panel
        // Conversational: show full content in chat
        content: (routeToPanel && !isLLMUnavailable)
          ? "Analysis complete — results are in the **Results panel** on the right."
          : content,
        timestamp: Date.now(),
        ...(isLLMUnavailable && {
          metadata: {
            llmUnavailable: true,
            llmError: responseObj.llmError,
            retryQuery: userMessage,
          },
        }),
      });

      // Push analysis results (charts + tables) to this tab's Graph & Table panel
      if (routeToPanel) {
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
      toast.error("Failed to analyze data. Please try again.");
      addChatMessage({
        id: `msg-${Date.now()}`,
        role: "assistant",
        content:
          "Sorry, I encountered an error while analyzing your data. Please try again.",
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
  ]);

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
          {selectedMeasurements.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap justify-end">
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
            </div>
          )}
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
            {uploadedData ? (
              <p className="text-xs opacity-50">
                📊 {uploadedData.filename} · {fullData.length} rows loaded
              </p>
            ) : (
              <p className="text-xs opacity-40 text-center max-w-[220px]">
                Attach a CSV or XLSX file using the paperclip icon below to
                enable data analysis
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

      {/* ── Dataset pill ─────────────────────────────────────────────── */}
      <DatasetPill />

      {/* ── Dataset Tools accordion (hidden in compact mode — dropdowns serve this) */}
      {!compact && <DatasetToolsPanel />}

      {/* ── Pinned input bar ──────────────────────────────────────────── */}
      <div className={cn(
        "flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-border/50 z-10",
        !compact && "shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.35)]"
      )}>
        <div className={cn("mx-auto", compact ? "px-3 py-2" : "max-w-5xl px-5 py-6")}>

          {/* ── Attached file chips — shown above the input when any sources are active.
              NEW: visible chip strip replaces the hidden badge-only approach.
              Project sources = teal chips (FolderOpen icon, shared across tabs).
              Tab sources    = blue chips (FileText icon, this tab only).
              Each chip has an accessible X button to remove it.
              BEFORE: only a count badge on the Files button; chips lived inside the SourcesPanel drawer. */}
          {(projectSettings.sources.length > 0 || attachedFiles.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-3 px-0.5" role="list" aria-label="Attached sources">
              {/* Project-level sources (teal) */}
              {projectSettings.sources.map((src) => (
                <span
                  key={src.id}
                  role="listitem"
                  className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full px-3 py-1 text-sm font-medium max-w-[220px] group"
                >
                  <FolderOpen className="w-3 h-3 flex-shrink-0 text-teal-600" aria-hidden />
                  <span className="truncate">{src.name}</span>
                  <button
                    type="button"
                    onClick={() => activeProjectId && removeProjectSource(activeProjectId, src.id)}
                    className="flex-shrink-0 ml-0.5 text-teal-400 hover:text-red-500 transition-colors rounded-full focus:outline-none focus:ring-1 focus:ring-red-400"
                    aria-label={`Remove ${src.name} from project sources`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {/* Tab-level sources (blue) */}
              {attachedFiles.map((f) => (
                <span
                  key={f.id}
                  role="listitem"
                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-3 py-1 text-sm font-medium max-w-[220px] group"
                >
                  <FileText className="w-3 h-3 flex-shrink-0 text-blue-500" aria-hidden />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.id !== f.id))}
                    className="flex-shrink-0 ml-0.5 text-blue-300 hover:text-red-500 transition-colors rounded-full focus:outline-none focus:ring-1 focus:ring-red-400"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

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
          {/* Card-style input container */}
          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background shadow-lg px-3 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">

            {/* Left: Paperclip (repo files) + Upload (computer) — each with a scope picker.
                CHANGED: both buttons now open a small dropdown asking "Attach to: Tab / Project"
                before opening the file picker or upload dialog.
                BEFORE: buttons called setPickerOpen(true) / computerUploadRef.click() directly
                with no scope choice; all files went to tab-level only. */}
            <div className="flex items-center gap-1 flex-shrink-0">

              {/* ── Paperclip: attach from file library ──────────────────── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                    title="Attach from file library — choose scope"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={6} className="w-60">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                    Attach to…
                  </div>
                  {/* NEW: tab-level option (default) */}
                  <DropdownMenuItem
                    onSelect={() => { setAttachScope('tab'); setPickerOpen(true); }}
                    className="flex items-start gap-2.5 py-2.5 cursor-pointer"
                    aria-label="Attach to current tab only"
                  >
                    <FileText className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-tight">Current Tab only</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Not shared with other tabs</p>
                    </div>
                  </DropdownMenuItem>
                  {/* NEW: project-level option */}
                  <DropdownMenuItem
                    onSelect={() => { setAttachScope('project'); setPickerOpen(true); }}
                    className="flex items-start gap-2.5 py-2.5 cursor-pointer"
                    aria-label="Attach to project — visible in all tabs"
                  >
                    <FolderOpen className="w-4 h-4 mt-0.5 text-[#14b8a6] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-tight">Project (all tabs)</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Shared across every tab in this project</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* ── Upload: from computer ─────────────────────────────────── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={uploadFileMutation.isPending}
                    className="h-8 w-8 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                    title="Upload from computer — choose scope"
                  >
                    {uploadFileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={6} className="w-60">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                    Upload to…
                  </div>
                  {/* NEW: tab-level upload (default) */}
                  <DropdownMenuItem
                    onSelect={() => { setAttachScope('tab'); computerUploadRef.current?.click(); }}
                    className="flex items-start gap-2.5 py-2.5 cursor-pointer"
                    aria-label="Upload to current tab only"
                  >
                    <FileText className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-tight">Current Tab only</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Not shared with other tabs</p>
                    </div>
                  </DropdownMenuItem>
                  {/* NEW: project-level upload */}
                  <DropdownMenuItem
                    onSelect={() => { setAttachScope('project'); computerUploadRef.current?.click(); }}
                    className="flex items-start gap-2.5 py-2.5 cursor-pointer"
                    aria-label="Upload to project — visible in all tabs"
                  >
                    <FolderOpen className="w-4 h-4 mt-0.5 text-[#14b8a6] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-tight">Project (all tabs)</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Shared across every tab in this project</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>

            {/* Divider */}
            <div className="w-px h-7 bg-border/60 flex-shrink-0 mx-1" />

            {/* Text input — transparent, fills remaining space */}
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  handleSendMessage();
                }
              }}
              placeholder={
                isLoading
                  ? "Thinking…"
                  : uploadedData
                  ? "Ask a question about your data…"
                  : "Attach a file, then ask a question…"
              }
              disabled={isLoading}
              className="flex-1 min-w-0 h-10 text-base bg-transparent outline-none placeholder:text-muted-foreground/55 caret-primary disabled:cursor-not-allowed"
            />

            {/* Right: Sources badge + Send */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Sources panel trigger — always visible, badge when files attached */}
              {/* CHANGED: badge now counts project + tab sources combined.
                  BEFORE: only counted attachedFiles (tab-level); project sources were invisible here. */}
              {(() => {
                const totalCount = attachedFiles.length + projectSettings.sources.length;
                return (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSourcesOpen(true)}
                    className="relative h-10 w-10 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                    title={
                      totalCount > 0
                        ? `${totalCount} source${totalCount !== 1 ? "s" : ""} attached (${projectSettings.sources.length} project, ${attachedFiles.length} tab)`
                        : "View attached sources"
                    }
                  >
                    <Files className="h-5 w-5" />
                    {totalCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none pointer-events-none">
                        {totalCount > 9 ? "9+" : totalCount}
                      </span>
                    )}
                  </Button>
                );
              })()}

              {/* Send */}
              <Button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputValue.trim()}
                className={cn(
                  "rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all p-0 flex-shrink-0",
                  compact ? "h-8 w-8" : "h-14 w-14 shadow-lg hover:shadow-xl"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
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
      <FilePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAttach={(files) => handleAttachedFiles(files, attachScope)}
      />

      <SourcesPanel
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        files={attachedFiles}
        onRemove={(id) =>
          setAttachedFiles((prev) => prev.filter((f) => f.id !== id))
        }
        onClearAll={() => setAttachedFiles([])}
        onAddMore={() => {
          setSourcesOpen(false);
          setPickerOpen(true);
        }}
        projectSources={projectSettings.sources}
        onRemoveProjectSource={(id) =>
          activeProjectId && removeProjectSource(activeProjectId, id)
        }
        tabName={activeTabName}
      />

      {/* Hidden input for computer file upload */}
      <input
        ref={computerUploadRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.json,.txt,.pdf"
        className="hidden"
        onChange={handleComputerUpload}
      />
    </div>
  );
};
