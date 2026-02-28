import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Upload, FileText, DownloadCloud, Trash2, Eye, Calendar, HardDrive,
  Search, X, LayoutGrid, List, Folder, Tag, ChevronDown, Plus,
  FileSpreadsheet, CheckSquare, Square, Braces, Loader2, CheckCircle2, AlertCircle,
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

/** Per-file state tracked inside UploadModal */
interface UploadFileItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number; // 0–100
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
  { id: "tag-1", name: "Clinical", color: "bg-blue-100 text-blue-800", fileCount: 2 },
  { id: "tag-2", name: "Safety", color: "bg-red-100 text-red-800", fileCount: 1 },
  { id: "tag-3", name: "Analysis", color: "bg-emerald-100 text-emerald-800", fileCount: 1 },
];

// ── Loading skeleton card ──────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 w-14 bg-gray-200 rounded-full" />
        <div className="h-4 w-20 bg-gray-100 rounded" />
      </div>
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-1/2 bg-gray-100 rounded mb-4" />
      <div className="h-px bg-gray-100 mb-3" />
      <div className="flex gap-3">
        <div className="h-3 w-20 bg-gray-100 rounded" />
        <div className="h-3 w-16 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

// ── Format badge ──────────────────────────────────────────────────────────────

function FormatBadge({ format }: { format: string }) {
  const styles: Record<string, string> = {
    CSV:  "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    XLSX: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    JSON: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
  const Icon = format === "XLSX" ? FileSpreadsheet : format === "JSON" ? Braces : FileText;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide",
      styles[format] ?? "bg-gray-100 text-gray-600"
    )}>
      <Icon className="w-2.5 h-2.5" />
      {format}
    </span>
  );
}

// ── Dataset card ──────────────────────────────────────────────────────────────

function DatasetCard({
  dataset, selected, viewMode,
  onSelect, onPreview, onDownload, onDelete, onClick,
}: {
  dataset: UploadedDataset;
  selected: boolean;
  viewMode: "grid" | "list";
  onSelect: (id: string, sel: boolean) => void;
  onPreview: (d: UploadedDataset) => void;
  onDownload: (d: UploadedDataset) => void;
  onDelete: (id: string) => void;
  onClick: (d: UploadedDataset) => void;
}) {
  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "group flex items-center gap-4 bg-white border rounded-xl px-5 py-4 cursor-pointer",
          "transition-all duration-150 hover:shadow-md hover:border-blue-300",
          selected ? "border-blue-400 bg-blue-50/40" : "border-gray-200"
        )}
        onClick={() => onClick(dataset)}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(dataset.id, !selected); }}
          className="flex-shrink-0 text-gray-300 hover:text-blue-500 transition-colors"
        >
          {selected
            ? <CheckSquare className="w-4 h-4 text-blue-500" />
            : <Square className="w-4 h-4" />}
        </button>

        <FormatBadge format={dataset.format} />

        {/* Name + filename */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{dataset.name}</p>
          <p className="text-xs text-gray-400 truncate">{dataset.fileName}</p>
        </div>

        {/* Meta */}
        <div className="hidden sm:flex items-center gap-6 text-xs text-gray-400 flex-shrink-0">
          {dataset.rows > 0 && <span>{dataset.rows.toLocaleString()} rows</span>}
          {dataset.columns > 0 && <span>{dataset.columns} cols</span>}
          <span>{dataset.size}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />{dataset.uploadDate}
          </span>
        </div>

        {/* Actions — hover only */}
        <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <CardAction icon={Eye} label="Preview" onClick={(e) => { e.stopPropagation(); onPreview(dataset); }} />
          <CardAction icon={DownloadCloud} label="Download" onClick={(e) => { e.stopPropagation(); onDownload(dataset); }} />
          <CardAction icon={Trash2} label="Delete" danger onClick={(e) => { e.stopPropagation(); onDelete(dataset.id); }} />
        </div>
      </div>
    );
  }

  // ── Grid card ──────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "group relative bg-white border rounded-xl p-5 cursor-pointer",
        "transition-all duration-200 hover:shadow-md hover:scale-[1.02] hover:border-blue-300",
        selected ? "border-blue-400 shadow-sm bg-blue-50/30" : "border-gray-200 shadow-sm"
      )}
      onClick={() => onClick(dataset)}
    >
      {/* Checkbox — visible on hover or when selected */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(dataset.id, !selected); }}
        className={cn(
          "absolute top-3.5 left-3.5 text-gray-300 hover:text-blue-500 transition-all",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        {selected
          ? <CheckSquare className="w-4 h-4 text-blue-500" />
          : <Square className="w-4 h-4" />}
      </button>

      {/* Format + date */}
      <div className="flex items-center justify-between mb-3">
        <FormatBadge format={dataset.format} />
        <span className="text-[11px] text-gray-400">{dataset.uploadDate}</span>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate mb-0.5">
        {dataset.name}
      </h3>
      <p className="text-[12px] text-gray-400 truncate mb-3">{dataset.fileName}</p>

      {/* Divider */}
      <div className="h-px bg-gray-100 mb-3" />

      {/* Stats + actions */}
      <div className="flex items-center justify-between min-h-[22px]">
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {dataset.rows > 0
            ? <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{dataset.rows.toLocaleString()} rows</span>
            : <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{dataset.size}</span>
          }
          {dataset.columns > 0 && <span>{dataset.columns} cols</span>}
        </div>

        {/* Actions: hidden until hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <CardAction icon={Eye} label="Preview" onClick={(e) => { e.stopPropagation(); onPreview(dataset); }} />
          <CardAction icon={DownloadCloud} label="Download" onClick={(e) => { e.stopPropagation(); onDownload(dataset); }} />
          <CardAction icon={Trash2} label="Delete" danger onClick={(e) => { e.stopPropagation(); onDelete(dataset.id); }} />
        </div>
      </div>
    </div>
  );
}

/** Compact icon action button inside cards */
function CardAction({
  icon: Icon, label, onClick, danger = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        danger
          ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
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

  const tagColorMap: Record<string, string> = {
    blue:    "bg-blue-100 text-blue-700 hover:bg-blue-200",
    red:     "bg-red-100 text-red-700 hover:bg-red-200",
    emerald: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    green:   "bg-green-100 text-green-700 hover:bg-green-200",
    orange:  "bg-orange-100 text-orange-700 hover:bg-orange-200",
    purple:  "bg-purple-100 text-purple-700 hover:bg-purple-200",
    yellow:  "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    pink:    "bg-pink-100 text-pink-700 hover:bg-pink-200",
    gray:    "bg-gray-100 text-gray-700 hover:bg-gray-200",
  };

  function getTagClasses(color: string) {
    const key = Object.keys(tagColorMap).find((k) => color.includes(k)) ?? "gray";
    return tagColorMap[key];
  }

  return (
    <div className="space-y-1">
      {/* All Files */}
      <button
        onClick={() => { onFolderSelect(null); onTagSelect(null); }}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
          !selectedFolderId && !selectedTagId
            ? "bg-blue-50 text-blue-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        <LayoutGrid className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">All Files</span>
        <span className="text-xs text-gray-400 font-normal">{datasets.length}</span>
      </button>

      {/* ── Folders ─────────────────────────────────────────────────────── */}
      <div className="pt-3">
        <button
          onClick={() => setFoldersOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", !foldersOpen && "-rotate-90")} />
          Folders
          <span className="ml-auto normal-case font-normal">{folders.length}</span>
        </button>

        {foldersOpen && (
          <div className="mt-1 space-y-0.5">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onFolderSelect(selectedFolderId === folder.id ? null : folder.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                  selectedFolderId === folder.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Folder className={cn(
                  "w-3.5 h-3.5 flex-shrink-0",
                  selectedFolderId === folder.id ? "text-blue-500" : "text-gray-400"
                )} />
                <span className="flex-1 truncate">{folder.name}</span>
                <span className="text-xs text-gray-400 font-normal flex-shrink-0">{folder.fileCount}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Tags ────────────────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <div className="pt-3">
          <button
            onClick={() => setTagsOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", !tagsOpen && "-rotate-90")} />
            Tags
            <span className="ml-auto normal-case font-normal">{tags.length}</span>
          </button>

          {tagsOpen && (
            <div className="mt-2 px-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onTagSelect(selectedTagId === tag.id ? null : tag.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                    getTagClasses(tag.color),
                    selectedTagId === tag.id && "ring-2 ring-offset-1 ring-blue-400"
                  )}
                >
                  {tag.name} <span className="opacity-60 ml-0.5">·</span> <span className="opacity-60">{tag.fileCount}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────

const UPLOAD_ACCEPT = ['.csv', '.xlsx', '.xls', '.json', '.pdf'];
const UPLOAD_MAX_MB = 100;

/**
 * Self-contained upload modal.
 * Uses XMLHttpRequest (not fetch) so we get real upload-progress events.
 * Posts to the existing tRPC endpoint: POST /api/trpc/files.upload
 * Payload: { json: { fileName, fileData (base64), mimeType, fileSizeBytes } }
 */
function UploadModal({
  open, onClose, onUploadComplete,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after at least one file uploads successfully — triggers list refetch */
  onUploadComplete: () => void;
}) {
  const [items, setItems] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.files.upload.useMutation();

  useEffect(() => {
    console.log('[UploadModal v3] mounted — using trpc.files.upload.useMutation()');
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) { setItems([]); setIsUploading(false); }
  }, [open]);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const exts = UPLOAD_ACCEPT.map((a) => a.slice(1)); // ['csv','xlsx',...]
    Array.from(fileList).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!exts.includes(ext)) {
        toast.error(`${file.name}: unsupported format`);
        return;
      }
      if (file.size > UPLOAD_MAX_MB * 1024 * 1024) {
        toast.error(`${file.name}: exceeds ${UPLOAD_MAX_MB} MB limit`);
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          status: 'pending',
          progress: 0,
        },
      ]);
    });
  };

  /** Read a File and return its raw base64 content (no data-url prefix). */
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1] ?? '';
        if (!b64) reject(new Error('Empty file data after base64 encoding'));
        else resolve(b64);
      };
      reader.readAsDataURL(file);
    });

  /** Upload a single file via tRPC mutation. Resolves on success, rejects with Error on failure. */
  const uploadOne = async (item: UploadFileItem): Promise<void> => {
    console.log('[UploadModal v3] Reading file:', item.file.name, 'size:', item.file.size);
    const fileData = await readFileAsBase64(item.file);

    // Simulate progress while the mutation is in-flight
    // (tRPC JSON mutations don't support streaming byte progress)
    let pct = 0;
    const ticker = setInterval(() => {
      pct = Math.min(90, pct + 12);
      setItems((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, progress: pct } : f))
      );
    }, 120);

    try {
      console.log('[UploadModal v3] Calling mutateAsync for:', item.file.name);
      await uploadMutation.mutateAsync({
        fileName: item.file.name,
        fileData,
        mimeType: item.file.type || 'application/octet-stream',
        fileSizeBytes: item.file.size,
      });
      console.log('[UploadModal v3] mutateAsync succeeded for:', item.file.name);
    } finally {
      clearInterval(ticker);
    }
  };

  const handleUpload = async () => {
    const pending = items.filter((f) => f.status === 'pending');
    if (!pending.length) return;

    setIsUploading(true);

    // Mark all pending → uploading before we start the loop
    setItems((prev) =>
      prev.map((f) =>
        f.status === 'pending' ? { ...f, status: 'uploading', progress: 0 } : f
      )
    );

    let anySuccess = false;
    for (const item of pending) {
      try {
        await uploadOne(item);
        anySuccess = true;
        setItems((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'success', progress: 100 } : f
          )
        );
        toast.success(`${item.file.name} uploaded`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setItems((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'error', progress: 0, error: msg }
              : f
          )
        );
        toast.error(`${item.file.name}: ${msg}`);
      }
    }

    setIsUploading(false);

    if (anySuccess) {
      onUploadComplete(); // trigger files.list refetch in parent
      setTimeout(() => { setItems([]); onClose(); }, 1200);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((f) => f.id !== id));
  };

  const pendingCount = items.filter((f) => f.status === 'pending').length;
  const uploadingCount = items.filter((f) => f.status === 'uploading').length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Upload className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Upload Datasets</h2>
              <p className="text-xs text-gray-400">
                {UPLOAD_ACCEPT.join(', ').toUpperCase().replace(/\./g, '')} · Max {UPLOAD_MAX_MB} MB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Dropzone */}
          <div
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all select-none",
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors",
              isDragging ? "bg-blue-100" : "bg-gray-100"
            )}>
              <Upload className={cn("w-6 h-6", isDragging ? "text-blue-600" : "text-gray-400")} />
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-xs text-gray-400">or click to browse your computer</p>
            <p className="text-[11px] text-gray-300 mt-2">
              CSV · XLSX · XLS · JSON · PDF
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT.join(',')}
              onChange={(e) => addFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* File list */}
          {items.length > 0 && (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "border rounded-lg px-3 py-2.5 transition-colors",
                    item.status === 'success' ? "bg-green-50 border-green-200" :
                    item.status === 'error'   ? "bg-red-50 border-red-200" :
                    "bg-gray-50 border-gray-100"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Status icon */}
                    {item.status === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                    {item.status === 'uploading' && (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                    )}
                    {item.status === 'pending' && (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-medium truncate",
                        item.status === 'success' ? "text-green-700" :
                        item.status === 'error'   ? "text-red-600"   : "text-gray-800"
                      )}>
                        {item.file.name}
                      </p>
                      {item.status === 'error' ? (
                        <p className="text-[11px] text-red-400 truncate">{item.error}</p>
                      ) : (
                        <p className="text-[11px] text-gray-400">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                          {item.status === 'uploading' && ` · ${item.progress}%`}
                          {item.status === 'success' && ' · uploaded'}
                        </p>
                      )}
                    </div>

                    {/* Remove button (not shown while uploading) */}
                    {item.status !== 'uploading' && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Progress bar */}
                  {item.status === 'uploading' && (
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-150"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === 'success' && (
                    <div className="mt-2 h-1.5 bg-green-400 rounded-full" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          {(pendingCount > 0 || uploadingCount > 0) && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className={cn(
                "w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                isUploading
                  ? "bg-blue-400 text-white cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm"
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-4">
        {hasFilters
          ? <Search className="w-7 h-7 text-gray-400" />
          : <FileText className="w-7 h-7 text-gray-300" />
        }
      </div>
      <h3 className="text-gray-900 font-semibold text-base mb-1.5">
        {hasFilters ? "No matching datasets" : "No datasets yet"}
      </h3>
      <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
        {hasFilters
          ? "Try a different search term or clear the active filters."
          : "Upload your first CSV, XLSX, or JSON file to get started."}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          Clear filters
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
    const a = document.createElement("a");
    a.href = d.fileUrl;
    a.download = d.fileName;
    a.click();
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
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="min-h-full bg-gray-50">

      {/* ── Sticky top bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-3.5 flex items-center gap-4">

          {/* Page title */}
          <div className="flex-shrink-0 hidden sm:block">
            <h1 className="text-[15px] font-bold text-gray-900 leading-none">Data Library</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {datasets.length} dataset{datasets.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Search — flex-1 */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder='Search by name or filename… ("/" to focus)'
              className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-9 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex-shrink-0 flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  viewMode === mode
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
                title={mode === "grid" ? "Grid view" : "List view"}
              >
                {mode === "grid"
                  ? <LayoutGrid className="w-3.5 h-3.5" />
                  : <List className="w-3.5 h-3.5" />
                }
              </button>
            ))}
          </div>

          {/* Upload button */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        <div className="flex gap-8">

          {/* ── Sidebar ────────────────────────────────────────────────────── */}
          <aside className="hidden md:block w-52 lg:w-56 flex-shrink-0">
            {/* Sidebar card */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
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
          <main className="flex-1 min-w-0 space-y-4">

            {/* Active filter strip */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-medium">Filtering by:</span>
                {activeFolder && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
                    <Folder className="w-3 h-3" />
                    {activeFolder.name}
                    <button onClick={() => setSelectedFolderId(null)} className="ml-0.5 hover:text-blue-900 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {activeTag && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
                    <Tag className="w-3 h-3" />
                    {activeTag.name}
                    <button onClick={() => setSelectedTagId(null)} className="ml-0.5 hover:text-blue-900 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-medium text-gray-600">
                    <Search className="w-3 h-3" />
                    "{searchTerm}"
                    <button onClick={() => setSearchTerm("")} className="ml-0.5 hover:text-gray-900 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors ml-1"
                >
                  Clear all
                </button>
                <span className="ml-auto text-xs text-gray-400">
                  {filteredDatasets.length} of {datasets.length}
                </span>
              </div>
            )}

            {/* Bulk actions bar */}
            {selectedFileIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-sm font-medium text-blue-800">
                  {selectedFileIds.size} selected
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => setSelectedFileIds(new Set())}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Deselect all
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleteFilesMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {selectedFileIds.size}
                </button>
              </div>
            )}

            {/* Grid / list */}
            <div className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                : "space-y-2.5"
            )}>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                : filteredDatasets.length === 0
                ? <EmptyState hasFilters={hasActiveFilters} onClear={clearAll} />
                : filteredDatasets.map((d) => (
                    <DatasetCard
                      key={d.id}
                      dataset={d}
                      selected={selectedFileIds.has(d.id)}
                      viewMode={viewMode}
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

      {/* ── Upload modal ───────────────────────────────────────────────────── */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* ── Existing modals — unchanged ─────────────────────────────────── */}
      {previewFile && (
        <FilePreviewModal
          file={{
            id: parseInt(previewFile.id, 10) || 0,
            fileName: previewFile.fileName,
            fileKey: previewFile.fileUrl ?? '',
            fileUrl: previewFile.fileUrl ?? '',
            mimeType:
              previewFile.format === 'XLSX'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : previewFile.format === 'JSON'
                ? 'application/json'
                : 'text/csv',
            fileSizeBytes: 0,
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
