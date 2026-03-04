import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Upload, FileText, DownloadCloud, Trash2, Eye, Calendar, HardDrive,
  Search, X, LayoutGrid, List, Folder, Tag, ChevronDown, Plus,
  FileSpreadsheet, CheckSquare, Square, Braces, Loader2, CheckCircle2,
  AlertCircle, MoreHorizontal, Zap, Database,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { type FileFolder, type FileTag } from "@/components/FileOrganization";
import FilePreviewModal from "@/components/FilePreviewModal";
import DocumentViewer from "@/components/DocumentViewer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadedDataset {
  id: string;
  name: string;
  fileName: string;
  uploadDate: string;
  size: string;
  rows: number;
  columns: number;
  format: "CSV" | "XLSX" | "JSON";
  description?: string;
  folderId?: string;
  tags?: string[];
  fileUrl?: string;
}

interface UploadFileItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

// ── Sample data ───────────────────────────────────────────────────────────────

const sampleDatasets: UploadedDataset[] = [
  {
    id: "1", name: "Clinical Trial Phase 2", fileName: "trial_phase2_data.csv",
    uploadDate: "Jan 28, 2026", size: "2.4 MB", rows: 1250, columns: 24, format: "CSV",
    description: "Patient demographics and lab results from Phase 2 trial",
    folderId: "folder-1", tags: ["tag-1"],
  },
  {
    id: "2", name: "Patient Safety Database", fileName: "safety_data_2025.xlsx",
    uploadDate: "Jan 27, 2026", size: "5.8 MB", rows: 3450, columns: 18, format: "XLSX",
    description: "Adverse events and safety monitoring data",
    folderId: "folder-1", tags: ["tag-2"],
  },
  {
    id: "3", name: "Biomarker Analysis", fileName: "biomarkers_q4_2025.csv",
    uploadDate: "Jan 25, 2026", size: "1.2 MB", rows: 890, columns: 15, format: "CSV",
    description: "Serum biomarker measurements and correlations",
    folderId: "folder-2", tags: ["tag-1", "tag-3"],
  },
  {
    id: "4", name: "Efficacy Outcomes", fileName: "efficacy_outcomes.xlsx",
    uploadDate: "Jan 20, 2026", size: "3.1 MB", rows: 2100, columns: 22, format: "XLSX",
    description: "Primary and secondary efficacy endpoints",
    folderId: "folder-2",
  },
  {
    id: "5", name: "Pharmacokinetics Study", fileName: "pk_study_data.csv",
    uploadDate: "Jan 15, 2026", size: "1.9 MB", rows: 450, columns: 12, format: "CSV",
    description: "PK parameters and concentration-time data",
  },
];

const sampleFolders: FileFolder[] = [
  { id: "folder-1", name: "Clinical Trials", description: "Phase 1 & 2 trial data", fileCount: 2 },
  { id: "folder-2", name: "Analysis Data", description: "Biomarker and efficacy data", fileCount: 2 },
];

const sampleTags: FileTag[] = [
  { id: "tag-1", name: "Clinical",  color: "teal",   fileCount: 2 },
  { id: "tag-2", name: "Safety",    color: "orange",  fileCount: 1 },
  { id: "tag-3", name: "Analysis",  color: "green",   fileCount: 1 },
];

// ── Tag palette (Finbox) ───────────────────────────────────────────────────────

const TAG_COLORS: Record<string, { pill: string; sidebar: string }> = {
  teal:   { pill: "bg-[#DBEAFE] text-[#1D4ED8]",       sidebar: "bg-[#EFF6FF] text-[#3B82F6]" },
  blue:   { pill: "bg-[#DBEAFE] text-[#1D4ED8]",       sidebar: "bg-[#EFF6FF] text-[#3B82F6]" },
  purple: { pill: "bg-[#ede9fe] text-[#6d28d9]",       sidebar: "bg-[#F3E8FF] text-[#7C3AED]" },
  orange: { pill: "bg-[#FEF3C7] text-[#B45309]",       sidebar: "bg-[#FFFBEB] text-[#F59E0B]" },
  green:  { pill: "bg-[#D1FAE5] text-[#065F46]",       sidebar: "bg-[#ECFDF5] text-[#10B981]" },
  red:    { pill: "bg-red-100 text-red-700",            sidebar: "bg-red-50 text-red-500" },
  gray:   { pill: "bg-gray-100 text-gray-600",          sidebar: "bg-gray-100 text-gray-500" },
};

function tagPillClass(color: string) {
  return TAG_COLORS[color]?.pill ?? TAG_COLORS.gray.pill;
}
function tagSidebarClass(color: string) {
  return TAG_COLORS[color]?.sidebar ?? TAG_COLORS.gray.sidebar;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-100" />
        <div className="w-6 h-6 bg-gray-100 rounded-md" />
      </div>
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-1/2 bg-gray-100 rounded mb-3" />
      <div className="h-3 w-2/3 bg-gray-100 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-5 w-14 bg-gray-100 rounded-full" />
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

// ── File-type icon ─────────────────────────────────────────────────────────────

function FileIcon({ format, size = 24 }: { format: string; size?: number }) {
  if (format === "XLSX") return <FileSpreadsheet style={{ width: size, height: size }} className="text-[#3B82F6]" />;
  if (format === "JSON") return <Braces style={{ width: size, height: size }} className="text-[#3B82F6]" />;
  return <FileText style={{ width: size, height: size }} className="text-[#3B82F6]" />;
}

// ── Three-dot card menu ───────────────────────────────────────────────────────

function CardMenu({
  onPreview, onDownload, onDelete,
}: {
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      onClick={(e) => { e.stopPropagation(); onClick(); setOpen(false); }}
      className={cn(
        "w-full text-left px-3 py-2 text-[13px] rounded-md transition-colors",
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-[#374151] hover:bg-[#f3f4f6]"
      )}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#3B82F6] hover:bg-[#EFF6FF] transition-colors"
        title="More options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e2e8f0] rounded-xl shadow-lg z-30 p-1">
          {item("Preview", onPreview)}
          {item("Analyze with AI", onPreview)}
          {item("Download", onDownload)}
          {item("Move to folder", () => {})}
          {item("Add tags", () => {})}
          <div className="h-px bg-[#f3f4f6] my-1" />
          {item("Delete", onDelete, true)}
        </div>
      )}
    </div>
  );
}

// ── Dataset card ──────────────────────────────────────────────────────────────

function DatasetCard({
  dataset, selected, viewMode, allTags,
  onSelect, onPreview, onDownload, onDelete, onClick,
}: {
  dataset: UploadedDataset;
  selected: boolean;
  viewMode: "grid" | "list";
  allTags: FileTag[];
  onSelect: (id: string, sel: boolean) => void;
  onPreview: (d: UploadedDataset) => void;
  onDownload: (d: UploadedDataset) => void;
  onDelete: (id: string) => void;
  onClick: (d: UploadedDataset) => void;
}) {
  const cardTags = allTags.filter((t) => dataset.tags?.includes(t.id));

  const metaLine = [
    dataset.size,
    dataset.uploadDate,
    dataset.rows > 0 && dataset.columns > 0
      ? `${dataset.rows.toLocaleString()} rows × ${dataset.columns} cols`
      : null,
  ].filter(Boolean).join("  •  ");

  // ── List row ─────────────────────────────────────────────────────────────
  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "group flex items-center gap-4 bg-white border rounded-md px-5 py-4 cursor-pointer",
          "transition-colors duration-150",
          selected
            ? "border-[#3B82F6] bg-[#EFF6FF]"
            : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
        )}
        onClick={() => onClick(dataset)}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(dataset.id, !selected); }}
          className="flex-shrink-0 text-gray-300 hover:text-[#3B82F6] transition-colors"
        >
          {selected
            ? <CheckSquare className="w-4 h-4 text-[#3B82F6]" />
            : <Square className="w-4 h-4" />}
        </button>

        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
          <FileIcon format={dataset.format} size={18} />
        </div>

        {/* Name + filename */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#111827] truncate">{dataset.name}</p>
          <p className="text-xs text-[#6b7280] truncate">{dataset.fileName}</p>
        </div>

        {/* Tags */}
        {cardTags.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
            {cardTags.slice(0, 3).map((t) => (
              <span key={t.id} className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", tagPillClass(t.color))}>
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="hidden sm:flex items-center gap-5 text-xs text-[#6b7280] flex-shrink-0">
          {dataset.rows > 0 && <span>{dataset.rows.toLocaleString()} rows</span>}
          {dataset.columns > 0 && <span>{dataset.columns} cols</span>}
          <span>{dataset.size}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />{dataset.uploadDate}
          </span>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(dataset); }}
            title="Preview" className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#3B82F6] hover:bg-[#EFF6FF] transition-colors"
          ><Eye className="w-3.5 h-3.5" /></button>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(dataset); }}
            title="Download" className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
          ><DownloadCloud className="w-3.5 h-3.5" /></button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(dataset.id); }}
            title="Delete" className="p-1.5 rounded-md text-[#9ca3af] hover:text-red-500 hover:bg-red-50 transition-colors"
          ><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  }

  // ── Grid card ─────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "group relative bg-white rounded-md overflow-hidden cursor-pointer",
        "border transition-colors duration-150",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        "hover:bg-[#F9FAFB]",
        selected
          ? "border-[#3B82F6] ring-1 ring-[#3B82F6]/20"
          : "border-[#E5E7EB] hover:border-[#93C5FD]"
      )}
      onClick={() => onClick(dataset)}
    >
      <div className="p-6">
        {/* Top row: icon + checkbox + menu */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Checkbox (hover/selected) */}
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(dataset.id, !selected); }}
              className={cn(
                "absolute top-4 left-4 text-gray-300 hover:text-[#3B82F6] transition-all",
                selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              {selected
                ? <CheckSquare className="w-4 h-4 text-[#3B82F6]" />
                : <Square className="w-4 h-4" />}
            </button>

            {/* File type icon */}
            <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <FileIcon format={dataset.format} size={24} />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* "New" badge — hardcoded on first two for demo */}
            {(dataset.id === "1" || dataset.id === "2") && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#3B82F6] text-white tracking-wide">
                NEW
              </span>
            )}
            <CardMenu
              onPreview={() => onPreview(dataset)}
              onDownload={() => onDownload(dataset)}
              onDelete={() => onDelete(dataset.id)}
            />
          </div>
        </div>

        {/* Dataset name */}
        <h3 className="font-bold text-[17px] text-[#111827] truncate leading-snug mb-0.5">
          {dataset.name}
        </h3>
        {/* Filename */}
        <p className="text-[12px] text-[#6b7280] truncate mb-3">{dataset.fileName}</p>

        {/* Meta line */}
        <p className="text-[12px] text-[#6b7280] mb-4 leading-relaxed">{metaLine}</p>

        {/* Tags */}
        {cardTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {cardTags.map((t) => (
              <span key={t.id} className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-medium", tagPillClass(t.color))}>
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Hover quick actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(dataset); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-[#3B82F6] text-[#3B82F6] text-[12px] font-semibold hover:bg-[#EFF6FF] transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Analyze with AI
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(dataset); }}
            title="Preview"
            className="p-2 rounded-md bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb] transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(dataset); }}
            title="Download"
            className="p-2 rounded-md bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb] transition-colors"
          >
            <DownloadCloud className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Left sidebar ──────────────────────────────────────────────────────────────

function LibrarySidebar({
  folders, tags, datasets, selectedFolderId, selectedTagId, onFolderSelect, onTagSelect,
}: {
  folders: FileFolder[];
  tags: FileTag[];
  datasets: UploadedDataset[];
  selectedFolderId: string | null;
  selectedTagId: string | null;
  onFolderSelect: (id: string | null) => void;
  onTagSelect: (id: string | null) => void;
}) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const isAllActive = !selectedFolderId && !selectedTagId;

  return (
    <div className="space-y-1">
      {/* All Files */}
      <button
        onClick={() => { onFolderSelect(null); onTagSelect(null); }}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left",
          isAllActive
            ? "bg-[#EFF6FF] text-[#3B82F6] border-l-[3px] border-[#3B82F6]"
            : "text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
        )}
      >
        <Database className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">All Files</span>
        <span className={cn(
          "text-xs font-normal px-1.5 py-0.5 rounded-full",
          isAllActive ? "bg-[#DBEAFE] text-[#3B82F6]" : "text-[#9CA3AF]"
        )}>
          {datasets.length}
        </span>
      </button>

      {/* ── Folders ─────────────────────────────────────────────────────── */}
      <div className="pt-4">
        <button
          onClick={() => setFoldersOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest hover:text-[#6B7280] transition-colors"
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", !foldersOpen && "-rotate-90")} />
          Folders
          <span className="ml-auto normal-case font-normal text-[#D1D5DB]">{folders.length}</span>
        </button>

        {foldersOpen && (
          <div className="mt-1 space-y-0.5">
            {folders.map((folder) => {
              const active = selectedFolderId === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => onFolderSelect(active ? null : folder.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors text-left",
                    active
                      ? "bg-[#EFF6FF] text-[#3B82F6] font-medium border-l-[3px] border-[#3B82F6]"
                      : "text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
                  )}
                >
                  <Folder className={cn("w-3.5 h-3.5 flex-shrink-0", active ? "text-[#3B82F6]" : "text-[#9CA3AF]")} />
                  <span className="flex-1 truncate">{folder.name}</span>
                  <span className={cn(
                    "text-xs flex-shrink-0 px-1.5 py-0.5 rounded-full",
                    active ? "bg-[#DBEAFE] text-[#3B82F6]" : "text-[#D1D5DB]"
                  )}>
                    {folder.fileCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tags ────────────────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <div className="pt-4">
          <button
            onClick={() => setTagsOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest hover:text-[#6B7280] transition-colors"
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", !tagsOpen && "-rotate-90")} />
            Tags
            <span className="ml-auto normal-case font-normal text-[#D1D5DB]">{tags.length}</span>
          </button>

          {tagsOpen && (
            <div className="mt-2 px-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = selectedTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => onTagSelect(active ? null : tag.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
                      tagSidebarClass(tag.color),
                      active && "ring-2 ring-offset-1 ring-offset-white ring-[#3B82F6]"
                    )}
                  >
                    {tag.name}
                    <span className="opacity-50 ml-1">·</span>
                    <span className="opacity-50 ml-0.5">{tag.fileCount}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────

const UPLOAD_ACCEPT = [".csv", ".xlsx", ".xls", ".json", ".pdf"];
const UPLOAD_MAX_MB = 100;

function UploadModal({
  open, onClose, onUploadComplete,
}: {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}) {
  const [items, setItems] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.files.upload.useMutation();

  useEffect(() => {
    if (!open) { setItems([]); setIsUploading(false); }
  }, [open]);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const exts = UPLOAD_ACCEPT.map((a) => a.slice(1));
    Array.from(fileList).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!exts.includes(ext)) { toast.error(`${file.name}: unsupported format`); return; }
      if (file.size > UPLOAD_MAX_MB * 1024 * 1024) { toast.error(`${file.name}: exceeds ${UPLOAD_MAX_MB} MB limit`); return; }
      setItems((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, status: "pending", progress: 0 }]);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1] ?? "";
        if (!b64) reject(new Error("Empty file data after base64 encoding"));
        else resolve(b64);
      };
      reader.readAsDataURL(file);
    });

  const uploadOne = async (item: UploadFileItem): Promise<void> => {
    const fileData = await readFileAsBase64(item.file);
    let pct = 0;
    const ticker = setInterval(() => {
      pct = Math.min(90, pct + 12);
      setItems((prev) => prev.map((f) => (f.id === item.id ? { ...f, progress: pct } : f)));
    }, 120);
    try {
      await uploadMutation.mutateAsync({ fileName: item.file.name, fileData, mimeType: item.file.type || "application/octet-stream", fileSizeBytes: item.file.size });
    } finally {
      clearInterval(ticker);
    }
  };

  const handleUpload = async () => {
    const pending = items.filter((f) => f.status === "pending");
    if (!pending.length) return;
    setIsUploading(true);
    setItems((prev) => prev.map((f) => f.status === "pending" ? { ...f, status: "uploading", progress: 0 } : f));
    let anySuccess = false;
    for (const item of pending) {
      try {
        await uploadOne(item);
        anySuccess = true;
        setItems((prev) => prev.map((f) => f.id === item.id ? { ...f, status: "success", progress: 100 } : f));
        toast.success(`${item.file.name} uploaded`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setItems((prev) => prev.map((f) => f.id === item.id ? { ...f, status: "error", progress: 0, error: msg } : f));
        toast.error(`${item.file.name}: ${msg}`);
      }
    }
    setIsUploading(false);
    if (anySuccess) { onUploadComplete(); setTimeout(() => { setItems([]); onClose(); }, 1200); }
  };

  const pendingCount = items.filter((f) => f.status === "pending").length;
  const uploadingCount = items.filter((f) => f.status === "uploading").length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8f0]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#3B82F6] flex items-center justify-center">
              <Upload className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111827]">Upload Datasets</h2>
              <p className="text-xs text-[#6b7280]">
                {UPLOAD_ACCEPT.join(", ").toUpperCase().replace(/\./g, "")} · Max {UPLOAD_MAX_MB} MB
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Dropzone */}
          <div
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all select-none",
              isDragging ? "border-[#3B82F6] bg-[#EFF6FF]" : "border-[#E5E7EB] bg-[#FAFAFC] hover:border-[#93C5FD] hover:bg-[#EFF6FF]/40"
            )}
          >
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors", isDragging ? "bg-[#DBEAFE]" : "bg-[#f3f4f6]")}>
              <Upload className={cn("w-6 h-6", isDragging ? "text-[#3B82F6]" : "text-[#9ca3af]")} />
            </div>
            <p className="text-sm font-semibold text-[#111827] mb-1">
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-xs text-[#6b7280]">or click to browse your computer</p>
            <p className="text-[11px] text-[#9ca3af] mt-2">CSV · XLSX · XLS · JSON · PDF</p>
            <input ref={inputRef} type="file" multiple accept={UPLOAD_ACCEPT.join(",")} onChange={(e) => addFiles(e.target.files)} className="hidden" />
          </div>

          {/* File list */}
          {items.length > 0 && (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className={cn(
                  "border rounded-xl px-3 py-2.5 transition-colors",
                  item.status === "success" ? "bg-[#f0fdf4] border-[#86efac]" :
                  item.status === "error"   ? "bg-red-50 border-red-200" : "bg-[#f8fafc] border-[#e2e8f0]"
                )}>
                  <div className="flex items-center gap-2.5">
                    {item.status === "success"  && <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />}
                    {item.status === "error"    && <AlertCircle  className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    {item.status === "uploading"&& <Loader2      className="w-4 h-4 text-[#3B82F6] animate-spin flex-shrink-0" />}
                    {item.status === "pending"  && <div className="w-4 h-4 rounded-full border-2 border-[#d1d5db] flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium truncate",
                        item.status === "success" ? "text-[#065f46]" :
                        item.status === "error"   ? "text-red-600" : "text-[#111827]"
                      )}>{item.file.name}</p>
                      {item.status === "error" ? (
                        <p className="text-[11px] text-red-400 truncate">{item.error}</p>
                      ) : (
                        <p className="text-[11px] text-[#6b7280]">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                          {item.status === "uploading" && ` · ${item.progress}%`}
                          {item.status === "success" && " · uploaded"}
                        </p>
                      )}
                    </div>
                    {item.status !== "uploading" && (
                      <button onClick={() => setItems((p) => p.filter((f) => f.id !== item.id))} className="p-0.5 text-[#9ca3af] hover:text-[#6b7280] transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {item.status === "uploading" && (
                    <div className="mt-2 h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-150" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  {item.status === "success" && <div className="mt-2 h-1.5 bg-[#10B981] rounded-full" />}
                </div>
              ))}
            </div>
          )}

          {(pendingCount > 0 || uploadingCount > 0) && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className={cn(
                "w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                isUploading ? "bg-[#3B82F6]/60 text-white cursor-not-allowed" : "bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-sm"
              )}
            >
              {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : <><Upload className="w-4 h-4" />Upload {pendingCount} file{pendingCount !== 1 ? "s" : ""}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear, onUpload }: { hasFilters: boolean; onClear: () => void; onUpload: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-28 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#EFF6FF] border-2 border-[#DBEAFE] flex items-center justify-center mb-6">
        {hasFilters
          ? <Search className="w-9 h-9 text-[#3B82F6]/60" />
          : <Database className="w-9 h-9 text-[#3B82F6]" />
        }
      </div>
      <h3 className="text-[#111827] font-bold text-xl mb-2">
        {hasFilters ? "No matching datasets" : "No datasets uploaded yet"}
      </h3>
      <p className="text-[#6b7280] text-sm max-w-xs leading-relaxed mb-6">
        {hasFilters
          ? "Try a different search term or clear the active filters."
          : "Upload your first clinical trial or analysis CSV to begin running biostatistical analyses."}
      </p>
      {hasFilters ? (
        <button onClick={onClear} className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-semibold transition-colors">
          Clear filters
        </button>
      ) : (
        <button
          onClick={onUpload}
          className="flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-semibold rounded-md px-5 py-2.5 transition-colors shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Upload Data
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DataUploaded() {
  const [datasets, setDatasets] = useState<UploadedDataset[]>(sampleDatasets);
  const [currentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [folders] = useState<FileFolder[]>(sampleFolders);
  const [tags] = useState<FileTag[]>(sampleTags);
  const [selectedDataset, setSelectedDataset] = useState<UploadedDataset | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<UploadedDataset | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: filesData, isLoading, refetch } = trpc.files.list.useQuery(
    { page: currentPage, limit: itemsPerPage },
    { enabled: true }
  );
  const deleteFilesMutation = trpc.files.delete.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (filesData?.data && Array.isArray(filesData.data)) {
      setDatasets((prev) => {
        const newData = filesData.data as UploadedDataset[];
        if (JSON.stringify(prev) !== JSON.stringify(newData)) return newData;
        return prev;
      });
    }
  }, [filesData?.data]);

  const filteredDatasets = useMemo(() => datasets.filter((d) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = d.name.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q);
    const matchFolder = !selectedFolderId || d.folderId === selectedFolderId;
    const matchTag = !selectedTagId || (d.tags?.includes(selectedTagId) ?? false);
    return matchSearch && matchFolder && matchTag;
  }), [datasets, searchTerm, selectedFolderId, selectedTagId]);

  const handleDelete = useCallback((id: string | number) => {
    const sid = String(id);
    setDatasets((p) => p.filter((d) => d.id !== sid));
    setSelectedDataset((p) => (p?.id === sid ? null : p));
    setSelectedFileIds((p) => { const s = new Set(p); s.delete(sid); return s; });
  }, []);

  const handleUploadComplete = useCallback(async () => {
    await utils.files.list.invalidate();
    refetch();
  }, [utils.files.list, refetch]);

  const handleDownload = useCallback((d: UploadedDataset) => {
    if (!d.fileUrl) return;
    const a = document.createElement("a"); a.href = d.fileUrl; a.download = d.fileName; a.click();
  }, []);

  const handlePreview = useCallback((d: UploadedDataset) => setPreviewFile(d), []);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedFileIds).map((id) => parseInt(id, 10));
    try {
      await deleteFilesMutation.mutateAsync({ fileIds: ids });
      ids.forEach(handleDelete);
      setSelectedFileIds(new Set());
    } catch (e) { console.error(e); }
  }, [selectedFileIds, deleteFilesMutation, handleDelete]);

  const handleSelectFile = useCallback((id: string, sel: boolean) => {
    setSelectedFileIds((p) => { const s = new Set(p); sel ? s.add(id) : s.delete(id); return s; });
  }, []);

  const clearAll = useCallback(() => {
    setSearchTerm(""); setSelectedFolderId(null); setSelectedTagId(null);
  }, []);

  const hasActiveFilters = !!(searchTerm || selectedFolderId || selectedTagId);
  const activeFolder = folders.find((f) => f.id === selectedFolderId);
  const activeTag = tags.find((t) => t.id === selectedTagId);

  // "/" shortcut → focus search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName ?? "")) {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">

      {/* ── Sticky top bar ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#E5E7EB]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-4 flex items-center gap-4">

          {/* Title */}
          <div className="flex-shrink-0 hidden sm:block mr-2">
            <h1 className="text-[22px] font-bold text-[#111827] leading-none tracking-tight">Data Library</h1>
            <p className="text-[12px] text-[#6b7280] mt-0.5">
              {datasets.length} dataset{datasets.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-[520px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder='Search by name or filename… ("/" to focus)'
              className="w-full bg-white border border-[#D1D5DB] rounded-md pl-10 pr-9 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6] transition"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex-shrink-0 flex items-center bg-[#f3f4f6] rounded-md p-0.5 gap-0.5">
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={mode === "grid" ? "Grid view" : "List view"}
                className={cn(
                  "p-2 rounded transition-all",
                  viewMode === mode
                    ? "bg-white text-[#3B82F6] shadow-sm"
                    : "text-[#6b7280] hover:text-[#374151]"
                )}
              >
                {mode === "grid" ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>

          {/* Upload button */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex-shrink-0 flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] active:bg-[#1d4ed8] text-white text-sm font-semibold rounded-md px-4 py-2.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8">
        <div className="flex gap-7">

          {/* ── Light sidebar panel ──────────────────────────────────────── */}
          <aside className="hidden md:block w-52 lg:w-56 flex-shrink-0">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 sticky top-[73px]">
              <LibrarySidebar
                folders={folders}
                tags={tags}
                datasets={datasets}
                selectedFolderId={selectedFolderId}
                selectedTagId={selectedTagId}
                onFolderSelect={setSelectedFolderId}
                onTagSelect={setSelectedTagId}
              />
            </div>
          </aside>

          {/* ── Main area ──────────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-5">

            {/* Active filter strip */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[#6b7280] font-medium">Filtering by:</span>
                {activeFolder && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-medium text-[#3B82F6]">
                    <Folder className="w-3 h-3" />
                    {activeFolder.name}
                    <button onClick={() => setSelectedFolderId(null)} className="ml-0.5 hover:text-[#1D4ED8] transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {activeTag && (
                  <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium", tagPillClass(activeTag.color), "border-current/20")}>
                    <Tag className="w-3 h-3" />
                    {activeTag.name}
                    <button onClick={() => setSelectedTagId(null)} className="ml-0.5 transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f3f4f6] border border-[#e5e7eb] text-xs font-medium text-[#374151]">
                    <Search className="w-3 h-3" />
                    "{searchTerm}"
                    <button onClick={() => setSearchTerm("")} className="ml-0.5 hover:text-[#111827] transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                )}
                <button onClick={clearAll} className="text-xs text-[#6b7280] hover:text-[#374151] font-medium transition-colors ml-1">Clear all</button>
                <span className="ml-auto text-xs text-[#6b7280]">{filteredDatasets.length} of {datasets.length}</span>
              </div>
            )}

            {/* Bulk actions bar */}
            {selectedFileIds.size > 0 && (
              <div className="flex items-center gap-3 px-5 py-3.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-md">
                <span className="text-sm font-semibold text-[#3B82F6]">{selectedFileIds.size} selected</span>
                <div className="flex-1" />
                <button onClick={() => setSelectedFileIds(new Set())} className="text-xs text-[#3B82F6] hover:text-[#1D4ED8] font-medium transition-colors">Deselect all</button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleteFilesMutation.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {selectedFileIds.size}
                </button>
              </div>
            )}

            {/* Grid / list */}
            <div className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-3"
            )}>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                : filteredDatasets.length === 0
                ? <EmptyState hasFilters={hasActiveFilters} onClear={clearAll} onUpload={() => setShowUpload(true)} />
                : filteredDatasets.map((d) => (
                    <DatasetCard
                      key={d.id}
                      dataset={d}
                      selected={selectedFileIds.has(d.id)}
                      viewMode={viewMode}
                      allTags={tags}
                      onSelect={handleSelectFile}
                      onPreview={handlePreview}
                      onDownload={handleDownload}
                      onDelete={handleDelete}
                      onClick={setSelectedDataset}
                    />
                  ))
              }
            </div>
          </main>
        </div>
      </div>

      {/* Modals */}
      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} onUploadComplete={handleUploadComplete} />

      {previewFile && (
        <FilePreviewModal
          file={{
            name: previewFile.fileName,
            content: "",
            type:
              previewFile.format === "CSV"
                ? "csv"
                : previewFile.format === "JSON"
                ? "txt"
                : null,
            size: previewFile.size,
          }}
          onClose={() => setPreviewFile(null)}
        />
      )}
      {selectedDataset && (
        <DocumentViewer document={selectedDataset} onClose={() => setSelectedDataset(null)} />
      )}
    </div>
  );
}
