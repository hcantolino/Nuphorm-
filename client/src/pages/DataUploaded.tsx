import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Upload, FileText, DownloadCloud, Trash2, Eye, Calendar, HardDrive,
  Search, X, LayoutGrid, List, Folder, FolderOpen, Tag, ChevronDown, ChevronRight, Plus,
  FileSpreadsheet, CheckSquare, Square, Braces, Loader2, CheckCircle2,
  AlertCircle, MoreHorizontal, Zap, Database, GripVertical, Copy, Pencil,
  Share2, FolderPlus, ArrowRight, Check, Move,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { type FileFolder, type FileTag } from "@/components/FileOrganization";
import FilePreviewModal from "@/components/FilePreviewModal";
import DocumentViewer from "@/components/DocumentViewer";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvided,
  type DroppableProvided,
} from "react-beautiful-dnd";
import {
  ViewToolbar, GroupHeader,
  type ViewMode, type GroupByOption, type GroupedSection,
  loadViewMode, saveViewMode, loadGroupBy, saveGroupBy,
  groupDatasets,
} from "@/components/ViewToolbar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadedDataset {
  id: string;
  name: string;
  fileName: string;
  uploadDate: string;
  size: string;
  rows: number;
  columns: number;
  format: "CSV" | "XLSX" | "JSON" | "HTML";
  description?: string;
  folderId?: string;
  tags?: string[];
  fileUrl?: string;
  contentType?: string;
  /** Which table the file came from — used for routing delete/update calls */
  source?: "uploaded" | "technical";
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
    uploadDate: "2026-03-14T10:01:00", size: "2.4 MB", rows: 1250, columns: 24, format: "CSV",
    description: "Patient demographics and lab results from Phase 2 trial",
    folderId: "folder-1", tags: ["tag-1"],
  },
  {
    id: "2", name: "Patient Safety Database", fileName: "safety_data_2025.xlsx",
    uploadDate: "2026-03-12T14:30:00", size: "5.8 MB", rows: 3450, columns: 18, format: "XLSX",
    description: "Adverse events and safety monitoring data",
    folderId: "folder-1", tags: ["tag-2"],
  },
  {
    id: "3", name: "Biomarker Analysis", fileName: "biomarkers_q4_2025.csv",
    uploadDate: "2026-03-05T09:15:00", size: "1.2 MB", rows: 890, columns: 15, format: "CSV",
    description: "Serum biomarker measurements and correlations",
    folderId: "folder-2", tags: ["tag-1", "tag-3"],
  },
  {
    id: "4", name: "Efficacy Outcomes", fileName: "efficacy_outcomes.xlsx",
    uploadDate: "2026-02-20T16:45:00", size: "3.1 MB", rows: 2100, columns: 22, format: "XLSX",
    description: "Primary and secondary efficacy endpoints",
    folderId: "folder-2",
  },
  {
    id: "5", name: "Pharmacokinetics Study", fileName: "pk_study_data.csv",
    uploadDate: "2026-01-15T11:00:00", size: "1.9 MB", rows: 450, columns: 12, format: "CSV",
    description: "PK parameters and concentration-time data",
  },
];

const sampleFolders: FileFolder[] = [
  { id: "folder-1", name: "Clinical Trials", description: "Phase 1 & 2 trial data", fileCount: 2, parentId: null },
  { id: "folder-2", name: "Analysis Data", description: "Biomarker and efficacy data", fileCount: 2, parentId: null },
];

const sampleTags: FileTag[] = [
  { id: "tag-1", name: "Clinical",  color: "teal",   fileCount: 2 },
  { id: "tag-2", name: "Safety",    color: "orange",  fileCount: 1 },
  { id: "tag-3", name: "Analysis",  color: "green",   fileCount: 1 },
];

// ── Tag palette (Finbox) ───────────────────────────────────────────────────────

const TAG_COLORS: Record<string, { pill: string; sidebar: string }> = {
  teal:   { pill: "bg-[#dbeafe] text-[#3b82f6]",       sidebar: "bg-[#eff6ff] text-[#3b82f6]" },
  blue:   { pill: "bg-[#dbeafe] text-[#3b82f6]",       sidebar: "bg-[#eff6ff] text-[#3b82f6]" },
  purple: { pill: "bg-[#ede9fe] text-[#7c3aed]",       sidebar: "bg-[#f5f3ff] text-[#7c3aed]" },
  orange: { pill: "bg-[#ffedd5] text-[#ea580c]",       sidebar: "bg-[#fff7ed] text-[#ea580c]" },
  green:  { pill: "bg-[#d1fae5] text-[#10b981]",       sidebar: "bg-[#ecfdf5] text-[#10b981]" },
  red:    { pill: "bg-[#fee2e2] text-[#ef4444]",       sidebar: "bg-[#fef2f2] text-[#ef4444]" },
  gray:   { pill: "bg-[#f1f5f9] text-[#64748b]",       sidebar: "bg-[#f8fafc] text-[#64748b]" },
};

function tagPillClass(color: string) {
  return TAG_COLORS[color]?.pill ?? TAG_COLORS.gray.pill;
}
function tagSidebarClass(color: string) {
  return TAG_COLORS[color]?.sidebar ?? TAG_COLORS.gray.sidebar;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDescendantFolderIds(folderId: string, folders: FileFolder[]): Set<string> {
  const ids = new Set<string>();
  const collect = (parentId: string) => {
    for (const f of folders) {
      if (f.parentId === parentId) {
        ids.add(f.id);
        collect(f.id);
      }
    }
  };
  collect(folderId);
  return ids;
}

function getBreadcrumbPath(folderId: string | null, folders: FileFolder[]): FileFolder[] {
  if (!folderId) return [];
  const path: FileFolder[] = [];
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined;
  }
  return path;
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
  if (format === "HTML") return <FileText style={{ width: size, height: size }} className="text-[#7c3aed]" />;
  return <FileText style={{ width: size, height: size }} className="text-[#3B82F6]" />;
}

// ── Context menu (Box-style) ─────────────────────────────────────────────────

interface ContextMenuProps {
  onPreview: () => void;
  onDownload: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onAddTag: () => void;
  onDelete: () => void;
  onShare?: () => void;
}

function CardContextMenu(props: ContextMenuProps) {
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

  const item = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      onClick={(e) => { e.stopPropagation(); onClick(); setOpen(false); }}
      className={cn(
        "w-full text-left px-3 py-2 text-[13px] rounded-md transition-colors flex items-center gap-2.5",
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-[#374151] hover:bg-[#f3f4f6]"
      )}
    >
      {icon}
      {label}
    </button>
  );

  const sep = () => <div className="h-px bg-[#f3f4f6] my-1" />;

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#3B82F6] hover:bg-[#EFF6FF] transition-colors opacity-0 group-hover:opacity-100"
        title="More options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#e2e8f0] rounded-xl shadow-lg z-30 p-1">
          {item(<Eye className="w-3.5 h-3.5" />, "Preview", props.onPreview)}
          {item(<DownloadCloud className="w-3.5 h-3.5" />, "Download", props.onDownload)}
          {sep()}
          {item(<Pencil className="w-3.5 h-3.5" />, "Rename", props.onRename)}
          {item(<ArrowRight className="w-3.5 h-3.5" />, "Move to...", props.onMove)}
          {item(<Copy className="w-3.5 h-3.5" />, "Copy", props.onCopy)}
          {item(<Tag className="w-3.5 h-3.5" />, "Add/Remove Tags", props.onAddTag)}
          {props.onShare && item(<Share2 className="w-3.5 h-3.5" />, "Share", props.onShare)}
          {sep()}
          {item(<Trash2 className="w-3.5 h-3.5" />, "Delete", props.onDelete, true)}
        </div>
      )}
    </div>
  );
}

// ── Folder context menu ───────────────────────────────────────────────────────

function FolderContextMenu({
  onRename, onDelete, onNewSubfolder, onMove,
}: {
  onRename: () => void;
  onDelete: () => void;
  onNewSubfolder: () => void;
  onMove: () => void;
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

  const item = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      onClick={(e) => { e.stopPropagation(); onClick(); setOpen(false); }}
      className={cn(
        "w-full text-left px-3 py-2 text-[13px] rounded-md transition-colors flex items-center gap-2.5",
        danger ? "text-red-600 hover:bg-red-50" : "text-[#374151] hover:bg-[#f3f4f6]"
      )}
    >
      {icon}{label}
    </button>
  );

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-0.5 rounded text-[#9ca3af] hover:text-[#3B82F6] opacity-0 group-hover:opacity-100 transition-all"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e2e8f0] rounded-xl shadow-lg z-30 p-1">
          {item(<Pencil className="w-3.5 h-3.5" />, "Rename", onRename)}
          {item(<FolderPlus className="w-3.5 h-3.5" />, "New Subfolder", onNewSubfolder)}
          {item(<ArrowRight className="w-3.5 h-3.5" />, "Move", onMove)}
          <div className="h-px bg-[#f3f4f6] my-1" />
          {item(<Trash2 className="w-3.5 h-3.5" />, "Delete", onDelete, true)}
        </div>
      )}
    </div>
  );
}

// ── Right-click context menu button ───────────────────────────────────────────

function CtxBtn({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2 text-[13px] rounded-md transition-colors flex items-center gap-2.5",
        danger ? "text-red-600 hover:bg-red-50" : "text-[#374151] hover:bg-[#f3f4f6]"
      )}
    >
      {icon}{label}
    </button>
  );
}

// ── Inline rename input ───────────────────────────────────────────────────────

function InlineRename({
  value, onSave, onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const save = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else onCancel();
  };

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
        onBlur={save}
        className="flex-1 min-w-0 px-2 py-1 text-sm border-2 border-[#3B82F6] rounded-md bg-white focus:outline-none"
      />
      <button onClick={save} className="p-1 text-[#3B82F6] hover:bg-[#EFF6FF] rounded transition-colors">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="p-1 text-[#9ca3af] hover:bg-[#f3f4f6] rounded transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Delete confirmation modal ──────────────────────────────────────────────────

function DeleteConfirmModal({
  name, count, onConfirm, onCancel,
}: {
  name: string;
  count?: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8f0]">
        <div className="px-6 py-4 border-b border-[#f3f4f6] bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <h2 className="text-sm font-bold text-[#111827]">Confirm Delete</h2>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-[#374151] leading-relaxed">
            {count && count > 1
              ? `Delete ${count} selected items? This cannot be undone unless in trash.`
              : <>Delete <span className="font-semibold">{name}</span>? This cannot be undone unless in trash.</>
            }
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f3f4f6]">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-[#374151] bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Folder picker modal ──────────────────────────────────────────────────────

function FolderPickerModal({
  folders, currentFolderId, onSelect, onCancel, title,
}: {
  folders: FileFolder[];
  currentFolderId?: string;
  onSelect: (folderId: string | null) => void;
  onCancel: () => void;
  title?: string;
}) {
  const rootFolders = folders.filter((f) => !f.parentId);

  const renderFolder = (folder: FileFolder, depth: number): React.ReactNode => {
    const children = folders.filter((f) => f.parentId === folder.id);
    const isCurrent = folder.id === currentFolderId;
    return (
      <div key={folder.id}>
        <button
          onClick={() => !isCurrent && onSelect(folder.id)}
          disabled={isCurrent}
          className={cn(
            "w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors",
            isCurrent
              ? "text-[#9CA3AF] cursor-not-allowed bg-[#f3f4f6]"
              : "text-[#374151] hover:bg-[#EFF6FF] hover:text-[#3B82F6]"
          )}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          <Folder className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{folder.name}</span>
          <span className="ml-auto text-xs text-[#9CA3AF]">{folder.fileCount}</span>
        </button>
        {children.map((c) => renderFolder(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8f0]">
        <div className="px-6 py-4 border-b border-[#f3f4f6]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Move className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <h2 className="text-sm font-bold text-[#111827]">{title || "Move to Folder"}</h2>
          </div>
        </div>
        <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-0.5">
          <button
            onClick={() => onSelect(null)}
            className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-[#374151] hover:bg-[#EFF6FF] hover:text-[#3B82F6] transition-colors"
          >
            <Database className="w-4 h-4 flex-shrink-0" />
            <span>Root (No folder)</span>
          </button>
          {rootFolders.map((f) => renderFolder(f, 0))}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f3f4f6]">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-[#374151] bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New folder modal ──────────────────────────────────────────────────────────

function NewFolderModal({
  parentId, onClose, onCreate,
}: {
  parentId?: string | null;
  onClose: () => void;
  onCreate: (name: string, parentId?: string | null) => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, parentId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8f0]">
        <div className="px-6 py-4 border-b border-[#f3f4f6]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <FolderPlus className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <h2 className="text-sm font-bold text-[#111827]">New Folder</h2>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <label className="block text-xs font-medium text-[#374151]">Folder name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder="e.g., Phase 3 Data"
            className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6] transition"
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f3f4f6]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tag picker dropdown ───────────────────────────────────────────────────────

const TAG_COLOR_OPTIONS = [
  { key: "teal", label: "Clinical", hex: "#007BFF" },
  { key: "orange", label: "Safety", hex: "#FD7E14" },
  { key: "green", label: "Analysis", hex: "#28A745" },
  { key: "purple", label: "Research", hex: "#7C3AED" },
  { key: "red", label: "Urgent", hex: "#EF4444" },
];

function TagPickerModal({
  tags, currentTags, onToggle, onClose,
}: {
  tags: FileTag[];
  currentTags: string[];
  onToggle: (tagId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8f0]">
        <div className="px-5 py-4 border-b border-[#f3f4f6]">
          <h2 className="text-sm font-bold text-[#111827]">Add/Remove Tags</h2>
        </div>
        <div className="px-4 py-3 space-y-1 max-h-60 overflow-y-auto">
          {tags.map((tag) => {
            const active = currentTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => onToggle(tag.id)}
                className={cn(
                  "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-[#EFF6FF] text-[#3B82F6]" : "text-[#374151] hover:bg-[#f3f4f6]"
                )}
              >
                {active ? <CheckSquare className="w-4 h-4 text-[#3B82F6]" /> : <Square className="w-4 h-4 text-[#D1D5DB]" />}
                <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", tagPillClass(tag.color))}>
                  {tag.name}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-end px-5 py-3 border-t border-[#f3f4f6]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dataset card ──────────────────────────────────────────────────────────────

function DatasetCard({
  dataset, selected, viewMode, allTags,
  onSelect, onPreview, onDownload, onDelete, onClick,
  onRename, onMove, onAddTag, onContextMenu,
  renamingId, onRenameSubmit, onRenameCancel,
  provided,
}: {
  dataset: UploadedDataset;
  selected: boolean;
  viewMode: ViewMode;
  allTags: FileTag[];
  onSelect: (id: string, sel: boolean) => void;
  onPreview: (d: UploadedDataset) => void;
  onDownload: (d: UploadedDataset) => void;
  onDelete: (id: string) => void;
  onClick: (d: UploadedDataset) => void;
  onRename: (id: string) => void;
  onMove: (id: string) => void;
  onAddTag: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, d: UploadedDataset) => void;
  renamingId: string | null;
  onRenameSubmit: (id: string, name: string) => void;
  onRenameCancel: () => void;
  provided?: DraggableProvided;
}) {
  const cardTags = allTags.filter((t) => dataset.tags?.includes(t.id));
  const isRenaming = renamingId === dataset.id;

  // Format date as "Added Mar 14, 2026 at 10:01 AM"
  const formatUploadDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mm = m.toString().padStart(2, "0");
    return `Added ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${h12}:${mm} ${ampm}`;
  };

  const dateDisplay = formatUploadDate(dataset.uploadDate);
  const metaLine = [
    dataset.size,
    dataset.rows > 0 && dataset.columns > 0
      ? `${dataset.rows.toLocaleString()} rows x ${dataset.columns} cols`
      : null,
  ].filter(Boolean).join("  \u00B7  ");

  const dragProps = provided ? {
    ref: provided.innerRef,
    ...provided.draggableProps,
  } : {};

  const dragHandleProps = provided?.dragHandleProps ?? {};

  // ── Gallery card ─────────────────────────────────────────────────────────
  if (viewMode === "gallery") {
    return (
      <div
        {...dragProps}
        className={cn(
          "group relative bg-white rounded-lg overflow-hidden cursor-pointer",
          "border transition-all duration-200",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          "hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(59,130,246,0.15)]",
          "hover:border-[#007BFF]",
          selected
            ? "border-[#007BFF] ring-1 ring-[#007BFF]/20"
            : "border-[#e2e8f0]"
        )}
        style={provided?.draggableProps?.style}
        onClick={() => onClick(dataset)}
        onContextMenu={e => { if (onContextMenu) { e.preventDefault(); onContextMenu(e, dataset); } }}
      >
        {/* Large preview area */}
        <div className="h-44 bg-[#F8FAFC] flex items-center justify-center border-b border-[#DEE2E6]">
          <div className="w-16 h-16 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
            <FileIcon format={dataset.format} size={36} />
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <InlineRename value={dataset.name} onSave={(v) => onRenameSubmit(dataset.id, v)} onCancel={onRenameCancel} />
              ) : (
                <h3 className="font-bold text-[15px] text-[#111827] truncate">{dataset.name}</h3>
              )}
              <p className="text-[11px] text-[#6C757D] truncate mt-0.5">{dataset.fileName}</p>
              {dataset.source === "technical" && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-[#7c3aed] bg-[#f5f3ff] px-1.5 py-0.5 rounded">
                  <Zap className="w-2.5 h-2.5" /> Generated
                </span>
              )}
            </div>
            <CardContextMenu
              onPreview={() => onPreview(dataset)}
              onDownload={() => onDownload(dataset)}
              onRename={() => onRename(dataset.id)}
              onMove={() => onMove(dataset.id)}
              onCopy={() => toast.info("Copy not yet implemented")}
              onAddTag={() => onAddTag(dataset.id)}
              onDelete={() => onDelete(dataset.id)}
            />
          </div>
          <p className="text-[11px] text-[#6C757D] mb-1">{metaLine}</p>
          <p className="text-[10px] text-[#94a3b8] mb-2">{dateDisplay}</p>
          {cardTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cardTags.map((t) => (
                <span key={t.id} className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", tagPillClass(t.color))}>{t.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List row ────────────────────────────────────────────────────────────
  if (viewMode === "list") {
    return (
      <div
        {...dragProps}
        className={cn(
          "group flex items-center gap-4 bg-white border rounded-lg px-5 py-4 cursor-pointer",
          "transition-all duration-200",
          "hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(59,130,246,0.15)]",
          selected
            ? "border-[#007BFF] bg-[#E3F2FD]"
            : "border-[#e2e8f0] hover:border-[#007BFF]"
        )}
        onClick={() => onClick(dataset)}
        onContextMenu={e => { if (onContextMenu) { e.preventDefault(); onContextMenu(e, dataset); } }}
      >
        {/* Drag handle */}
        <div {...dragHandleProps} className="flex-shrink-0 text-[#D1D5DB] hover:text-[#9CA3AF] cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4" />
        </div>

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
          {isRenaming ? (
            <InlineRename
              value={dataset.name}
              onSave={(v) => onRenameSubmit(dataset.id, v)}
              onCancel={onRenameCancel}
            />
          ) : (
            <>
              <p className="text-sm font-semibold text-[#111827] truncate">{dataset.name}</p>
              <p className="text-xs text-[#6b7280] truncate">{dataset.fileName}</p>
            </>
          )}
        </div>

        {dataset.source === "technical" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#7c3aed] bg-[#f5f3ff] px-1.5 py-0.5 rounded flex-shrink-0">
            <Zap className="w-2.5 h-2.5" /> Generated
          </span>
        )}

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
          <span className="flex items-center gap-1 text-[#94a3b8]">
            <Calendar className="w-3 h-3" />{dateDisplay}
          </span>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          <CardContextMenu
            onPreview={() => onPreview(dataset)}
            onDownload={() => onDownload(dataset)}
            onRename={() => onRename(dataset.id)}
            onMove={() => onMove(dataset.id)}
            onCopy={() => toast.info("Copy not yet implemented")}
            onAddTag={() => onAddTag(dataset.id)}
            onDelete={() => onDelete(dataset.id)}
          />
        </div>
      </div>
    );
  }

  // ── Grid card ─────────────────────────────────────────────────────────────
  return (
    <div
      {...dragProps}
      className={cn(
        "group relative bg-white rounded-lg overflow-hidden cursor-pointer",
        "border transition-all duration-200",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        "hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(59,130,246,0.15)]",
        selected
          ? "border-[#007BFF] bg-[#E3F2FD]"
          : "border-[#e2e8f0] hover:border-[#007BFF]"
      )}
      style={provided?.draggableProps?.style}
      onClick={() => onClick(dataset)}
      onContextMenu={e => { if (onContextMenu) { e.preventDefault(); onContextMenu(e, dataset); } }}
    >
      <div className="p-6">
        {/* Top row: drag handle + icon + checkbox + menu */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            <div {...dragHandleProps} className="absolute top-4 left-2 text-[#D1D5DB] hover:text-[#9CA3AF] cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Checkbox (hover/selected) */}
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(dataset.id, !selected); }}
              className={cn(
                "absolute top-4 left-7 text-gray-300 hover:text-[#3B82F6] transition-all",
                selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              {selected
                ? <CheckSquare className="w-4 h-4 text-[#3B82F6]" />
                : <Square className="w-4 h-4" />}
            </button>

            {/* File type icon */}
            <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center ml-8">
              <FileIcon format={dataset.format} size={24} />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {(dataset.id === "1" || dataset.id === "2") && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#3B82F6] text-white tracking-wide">
                NEW
              </span>
            )}
            <CardContextMenu
              onPreview={() => onPreview(dataset)}
              onDownload={() => onDownload(dataset)}
              onRename={() => onRename(dataset.id)}
              onMove={() => onMove(dataset.id)}
              onCopy={() => toast.info("Copy not yet implemented")}
              onAddTag={() => onAddTag(dataset.id)}
              onDelete={() => onDelete(dataset.id)}
            />
          </div>
        </div>

        {/* Dataset name */}
        {isRenaming ? (
          <div className="mb-3">
            <InlineRename
              value={dataset.name}
              onSave={(v) => onRenameSubmit(dataset.id, v)}
              onCancel={onRenameCancel}
            />
          </div>
        ) : (
          <>
            <h3 className="font-bold text-[17px] text-[#111827] truncate leading-snug mb-0.5">
              {dataset.name}
            </h3>
            <p className="text-[12px] text-[#6b7280] truncate mb-3">{dataset.fileName}</p>
          </>
        )}

        {/* Meta line */}
        <p className="text-[12px] text-[#6b7280] mb-1 leading-relaxed">{metaLine}</p>
        <p className="text-[11px] text-[#94a3b8] mb-4">{dateDisplay}</p>

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
  dragOverFolderId, onRenameFolder, onDeleteFolder, onNewSubfolder, onMoveFolder,
}: {
  folders: FileFolder[];
  tags: FileTag[];
  datasets: UploadedDataset[];
  selectedFolderId: string | null;
  selectedTagId: string | null;
  onFolderSelect: (id: string | null) => void;
  onTagSelect: (id: string | null) => void;
  dragOverFolderId: string | null;
  onRenameFolder: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onNewSubfolder: (parentId: string) => void;
  onMoveFolder: (id: string) => void;
}) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const isAllActive = !selectedFolderId && !selectedTagId;

  const rootFolders = folders.filter((f) => !f.parentId);

  const renderFolderItem = (folder: FileFolder, depth: number) => {
    const active = selectedFolderId === folder.id;
    const isDragOver = dragOverFolderId === folder.id;
    const children = folders.filter((f) => f.parentId === folder.id);

    return (
      <Droppable droppableId={`folder-${folder.id}`} key={folder.id}>
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <div
              className={cn(
                "group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-all text-left cursor-pointer",
                active
                  ? "bg-[#EFF6FF] text-[#3B82F6] font-medium border-l-[3px] border-[#3B82F6]"
                  : "text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]",
                (isDragOver || snapshot.isDraggingOver) && "bg-[#E3F2FD] border-2 border-[#3B82F6] ring-2 ring-[#3B82F6]/20"
              )}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              onClick={() => onFolderSelect(active ? null : folder.id)}
            >
              {active
                ? <FolderOpen className={cn("w-3.5 h-3.5 flex-shrink-0", "text-[#3B82F6]")} />
                : <Folder className={cn("w-3.5 h-3.5 flex-shrink-0", "text-[#9CA3AF]")} />
              }
              <span className="flex-1 truncate">{folder.name}</span>
              <span className={cn(
                "text-xs flex-shrink-0 px-1.5 py-0.5 rounded-full",
                active ? "bg-[#DBEAFE] text-[#3B82F6]" : "text-[#D1D5DB]"
              )}>
                {folder.fileCount}
              </span>
              <FolderContextMenu
                onRename={() => onRenameFolder(folder.id)}
                onDelete={() => onDeleteFolder(folder.id)}
                onNewSubfolder={() => onNewSubfolder(folder.id)}
                onMove={() => onMoveFolder(folder.id)}
              />
            </div>
            {provided.placeholder}
            {children.map((c) => renderFolderItem(c, depth + 1))}
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <div className="space-y-1">
      {/* All Files */}
      <Droppable droppableId="folder-root">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <button
              onClick={() => { onFolderSelect(null); onTagSelect(null); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all text-left",
                isAllActive
                  ? "bg-[#EFF6FF] text-[#3B82F6] border-l-[3px] border-[#3B82F6]"
                  : "text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]",
                snapshot.isDraggingOver && "bg-[#E3F2FD] border-2 border-[#3B82F6]"
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
            {provided.placeholder}
          </div>
        )}
      </Droppable>

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
            {rootFolders.map((folder) => renderFolderItem(folder, 0))}
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
                      "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all hover:ring-2 hover:ring-[#3B82F6]/20",
                      tagSidebarClass(tag.color),
                      active && "ring-2 ring-offset-1 ring-offset-white ring-[#3B82F6]"
                    )}
                  >
                    {tag.name}
                    <span className="opacity-50 ml-1">&middot;</span>
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
                {UPLOAD_ACCEPT.join(", ").toUpperCase().replace(/\./g, "")} &middot; Max {UPLOAD_MAX_MB} MB
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
            <p className="text-[11px] text-[#9ca3af] mt-2">CSV &middot; XLSX &middot; XLS &middot; JSON &middot; PDF</p>
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
                          {item.status === "uploading" && ` \u00B7 ${item.progress}%`}
                          {item.status === "success" && " \u00B7 uploaded"}
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
              {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading&hellip;</> : <><Upload className="w-4 h-4" />Upload {pendingCount} file{pendingCount !== 1 ? "s" : ""}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear, onUpload, isDragOver }: { hasFilters: boolean; onClear: () => void; onUpload: () => void; isDragOver?: boolean }) {
  return (
    <div className={cn(
      "col-span-full flex flex-col items-center justify-center py-28 text-center rounded-xl transition-all",
      isDragOver && "border-2 border-dashed border-[#3B82F6] bg-[#EFF6FF]"
    )}>
      <div className="w-20 h-20 rounded-2xl bg-[#EFF6FF] border-2 border-[#DBEAFE] flex items-center justify-center mb-6">
        {isDragOver
          ? <Upload className="w-9 h-9 text-[#3B82F6] animate-bounce" />
          : hasFilters
          ? <Search className="w-9 h-9 text-[#3B82F6]/60" />
          : <Database className="w-9 h-9 text-[#3B82F6]" />
        }
      </div>
      <h3 className="text-[#111827] font-bold text-xl mb-2">
        {isDragOver ? "Drop files to upload" : hasFilters ? "No matching datasets" : "No datasets yet"}
      </h3>
      <p className="text-[#6b7280] text-sm max-w-xs leading-relaxed mb-6">
        {isDragOver
          ? "Drop files to upload to the current folder"
          : hasFilters
          ? "Try a different search term or clear the active filters."
          : "Upload or drag files here to begin running biostatistical analyses."}
      </p>
      {!isDragOver && (hasFilters ? (
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
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DataUploaded() {
  const [datasets, setDatasets] = useState<UploadedDataset[]>(sampleDatasets);
  const [currentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [folders, setFolders] = useState<FileFolder[]>(sampleFolders);
  const [tags] = useState<FileTag[]>(sampleTags);
  const [selectedDataset, setSelectedDataset] = useState<UploadedDataset | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode("data-library", "grid"));
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => loadGroupBy("data-library", "dateAdded"));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<UploadedDataset | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // DnD state
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  // Desktop file drag-to-upload
  const [desktopDragOver, setDesktopDragOver] = useState(false);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Right-click context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; dataset?: UploadedDataset; folderId?: string } | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);

  // Folder picker
  const [movingFileId, setMovingFileId] = useState<string | null>(null);
  const [showBulkMove, setShowBulkMove] = useState(false);

  // New folder modal
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  // Tag picker
  const [tagPickerFileId, setTagPickerFileId] = useState<string | null>(null);

  // File content for preview modal
  const [previewContent, setPreviewContent] = useState<{
    content: string;
    fileUrl?: string;
    hasGraphs?: boolean;
    error?: string;
    contentType?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch file content when preview opens
  useEffect(() => {
    if (!previewFile) {
      setPreviewContent(null);
      return;
    }
    const numericId = Number(previewFile.id);
    if (!Number.isNaN(numericId) && numericId > 0) {
      // Real file from backend — fetch content
      setPreviewLoading(true);
      fetch(`/api/trpc/files.getFileContent?input=${encodeURIComponent(JSON.stringify({ fileId: numericId }))}`)
        .then(res => res.json())
        .then(json => {
          const data = json?.result?.data;
          if (data) {
            console.log('[FilePreview] Loaded content:', { fileName: data.fileName, contentType: data.contentType, hasGraphs: data.hasGraphs, contentLength: data.content?.length ?? 0 });
            setPreviewContent({
              content: data.content ?? "",
              fileUrl: data.fileUrl,
              hasGraphs: data.hasGraphs ?? false,
              contentType: data.contentType,
            });
          } else {
            console.warn('[FilePreview] No data in response:', json);
            setPreviewContent({ content: "", error: "Could not load file content" });
          }
        })
        .catch(err => {
          console.error('[FilePreview] Fetch error:', err);
          setPreviewContent({ content: "", error: "Failed to fetch file content" });
        })
        .finally(() => setPreviewLoading(false));
    } else {
      // Sample data — content will come from mock data inside FilePreviewModal
      setPreviewContent({ content: "" });
    }
  }, [previewFile]);

  const { data: filesData, isLoading, refetch } = trpc.files.list.useQuery(
    { page: currentPage, limit: itemsPerPage },
    { enabled: true }
  );
  // Also fetch technical files so Data Library shows everything
  const { data: techFilesRaw = [] } = trpc.technical.getFiles.useQuery();
  const deleteFilesMutation = trpc.files.delete.useMutation();
  const deleteTechMutation = trpc.technical.deleteFile.useMutation();
  const updateFileMutation = trpc.files.update.useMutation();
  const bulkMoveMutation = trpc.files.bulkMove.useMutation();
  const utils = trpc.useUtils();

  // Convert technical files into the UploadedDataset shape
  const technicalAsDatasets: UploadedDataset[] = useMemo(() => {
    return (techFilesRaw as any[]).map((tf: any) => {
      // Extract folder and filename from title (format: "Folder / Tab / filename")
      const parts = (tf.title ?? "").split(" / ");
      const fileName = parts[parts.length - 1] || tf.title || "Untitled";
      const folderName = parts.length > 1 ? parts[0] : undefined;
      const sizeEstimate = tf.content ? `${Math.round(tf.content.length / 1024)} KB` : "—";
      return {
        id: `tech-${tf.id}`,
        name: fileName,
        fileName,
        uploadDate: tf.createdAt ? new Date(tf.createdAt).toISOString() : new Date().toISOString(),
        size: sizeEstimate,
        rows: 0,
        columns: 0,
        format: "HTML" as const,
        description: folderName ? `Generated analysis · ${folderName}` : "Generated analysis",
        folderId: undefined,
        tags: [],
        source: "technical" as const,
      };
    });
  }, [techFilesRaw]);

  useEffect(() => {
    if (filesData?.data && Array.isArray(filesData.data) && filesData.data.length > 0) {
      setDatasets((prev) => {
        const apiData = (filesData.data as UploadedDataset[]).map(f => ({ ...f, source: "uploaded" as const }));
        const apiIds = new Set(apiData.map((f) => String(f.id)));
        // Keep sample data that doesn't collide with real API data
        const kept = prev.filter((d) => d.source === "technical" || !apiIds.has(String(d.id)));
        const merged = [...apiData, ...kept];
        if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
        return merged;
      });
    }
  }, [filesData?.data]);

  // Merge technical files into datasets whenever they change
  useEffect(() => {
    if (technicalAsDatasets.length === 0) return;
    setDatasets((prev) => {
      const techIds = new Set(technicalAsDatasets.map(t => t.id));
      const withoutOldTech = prev.filter(d => !techIds.has(d.id) && d.source !== "technical");
      const merged = [...withoutOldTech, ...technicalAsDatasets];
      merged.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
      return merged;
    });
  }, [technicalAsDatasets]);

  // ── Compute live folder & tag counts from actual datasets ─────────────
  const liveFolders = useMemo(() =>
    folders.map((f) => ({
      ...f,
      fileCount: datasets.filter((d) => d.folderId === f.id).length,
    })),
    [folders, datasets]
  );

  const liveTags = useMemo(() =>
    tags.map((t) => ({
      ...t,
      fileCount: datasets.filter((d) => d.tags?.includes(t.id)).length,
    })),
    [tags, datasets]
  );

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      const q = searchTerm.toLowerCase();
      const matchSearch = d.name.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q)
        || (d.tags?.some(tid => {
          const tag = tags.find(t => t.id === tid);
          return tag?.name.toLowerCase().includes(q);
        }) ?? false);
      const matchFolder = !selectedFolderId || d.folderId === selectedFolderId;
      const matchTag = !selectedTagId || (d.tags?.includes(selectedTagId) ?? false);
      return matchSearch && matchFolder && matchTag;
    });
  }, [datasets, searchTerm, selectedFolderId, selectedTagId, tags]);

  // Grouped datasets
  const tagNameMap = useMemo(() => {
    const m = new Map<string, string>();
    tags.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tags]);

  const groupedDatasets = useMemo(() =>
    groupDatasets(filteredDatasets, groupBy, tagNameMap),
    [filteredDatasets, groupBy, tagNameMap]
  );

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    saveViewMode("data-library", mode);
  }, []);

  const handleGroupByChange = useCallback((group: GroupByOption) => {
    setGroupBy(group);
    saveGroupBy("data-library", group);
    setCollapsedGroups(new Set());
  }, []);

  const toggleGroupCollapse = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }, []);

  // Subfolders of current view
  const childFolders = useMemo(() =>
    selectedFolderId
      ? liveFolders.filter((f) => f.parentId === selectedFolderId)
      : [],
    [selectedFolderId, liveFolders]
  );

  // Breadcrumbs
  const breadcrumbs = useMemo(() =>
    getBreadcrumbPath(selectedFolderId, liveFolders),
    [selectedFolderId, liveFolders]
  );

  // ── Handlers ──────────────────────────────────────────────────────────

  const removeFromUI = useCallback((id: string | number) => {
    const sid = String(id);
    setDatasets((p) => p.filter((d) => d.id !== sid));
    setSelectedDataset((p) => (p?.id === sid ? null : p));
    setSelectedFileIds((p) => { const s = new Set(p); s.delete(sid); return s; });
  }, []);

  const handleDelete = useCallback(async (id: string | number) => {
    const sid = String(id);
    const dataset = datasets.find(d => d.id === sid);
    setDeleteTarget(null);

    // Technical file — id looks like "tech-123"
    if (sid.startsWith("tech-")) {
      const techId = parseInt(sid.replace("tech-", ""), 10);
      if (!Number.isNaN(techId)) {
        try {
          await deleteTechMutation.mutateAsync({ fileId: techId });
          removeFromUI(sid);
          toast.success("File deleted");
          utils.technical.getFiles.invalidate();
        } catch (e) {
          console.error("[Delete Technical Error]", e);
          toast.error("Failed to delete file. Please try again.");
        }
        return;
      }
    }

    // Uploaded file — numeric id
    const numericId = Number(id);
    if (!Number.isNaN(numericId) && numericId > 0) {
      try {
        await deleteFilesMutation.mutateAsync({ fileIds: [numericId] });
        removeFromUI(id);
        toast.success("File deleted");
        utils.files.list.invalidate();
      } catch (e) {
        console.error("[Delete Error]", e);
        toast.error("Failed to delete file. Please try again.");
      }
    } else {
      // Sample/demo data — just remove from local state
      removeFromUI(id);
      toast.success("File deleted");
    }
  }, [datasets, deleteFilesMutation, deleteTechMutation, removeFromUI, utils.files.list, utils.technical.getFiles]);

  const handleDeleteConfirm = useCallback((id: string) => {
    const dataset = datasets.find((d) => d.id === id);
    setDeleteTarget({ id, name: dataset?.name ?? "this file" });
  }, [datasets]);

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
    const stringIds = Array.from(selectedFileIds);
    // Separate into uploaded IDs, technical IDs, and sample IDs
    const uploadedIds: number[] = [];
    const techIds: number[] = [];
    const sampleIds: string[] = [];
    for (const sid of stringIds) {
      if (sid.startsWith("tech-")) {
        const n = parseInt(sid.replace("tech-", ""), 10);
        if (!Number.isNaN(n)) techIds.push(n);
        else sampleIds.push(sid);
      } else {
        const n = parseInt(sid, 10);
        if (!Number.isNaN(n) && n > 0) uploadedIds.push(n);
        else sampleIds.push(sid);
      }
    }
    setBulkDeleteConfirm(false);
    try {
      const promises: Promise<any>[] = [];
      if (uploadedIds.length > 0) {
        promises.push(deleteFilesMutation.mutateAsync({ fileIds: uploadedIds }));
      }
      // Technical files must be deleted one at a time (API takes single fileId)
      for (const tid of techIds) {
        promises.push(deleteTechMutation.mutateAsync({ fileId: tid }));
      }
      await Promise.all(promises);
      // Remove all from UI
      stringIds.forEach(removeFromUI);
      setSelectedFileIds(new Set());
      toast.success(`Deleted ${stringIds.length} file(s)`);
      utils.files.list.invalidate();
      if (techIds.length > 0) utils.technical.getFiles.invalidate();
    } catch (e) {
      console.error("[Bulk Delete Error]", e);
      sampleIds.forEach(removeFromUI);
      if (sampleIds.length > 0 && (uploadedIds.length > 0 || techIds.length > 0)) {
        toast.error(`Deleted ${sampleIds.length} of ${stringIds.length} files. Some files could not be deleted.`);
      } else {
        toast.error("Failed to delete files. Please try again.");
      }
    }
  }, [selectedFileIds, deleteFilesMutation, deleteTechMutation, removeFromUI, utils.files.list, utils.technical.getFiles]);

  const handleSelectFile = useCallback((id: string, sel: boolean) => {
    setSelectedFileIds((p) => { const s = new Set(p); sel ? s.add(id) : s.delete(id); return s; });
  }, []);

  const handleCtrlClick = useCallback((dataset: UploadedDataset, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      handleSelectFile(dataset.id, !selectedFileIds.has(dataset.id));
    } else {
      // Open in file preview modal (not the PDF DocumentViewer)
      setPreviewFile(dataset);
    }
  }, [handleSelectFile, selectedFileIds]);

  const clearAll = useCallback(() => {
    setSearchTerm(""); setSelectedFolderId(null); setSelectedTagId(null);
  }, []);

  const handleFileContextMenu = useCallback((e: React.MouseEvent, dataset: UploadedDataset) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, dataset });
  }, []);

  // Rename
  const handleRenameSubmit = useCallback((id: string, newName: string) => {
    setDatasets((prev) => prev.map((d) => d.id === id ? { ...d, name: newName } : d));
    setRenamingId(null);
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      updateFileMutation.mutate({ fileId: numId, fileName: newName });
    }
    toast.success("Renamed successfully");
  }, [updateFileMutation]);

  // Move single file
  const handleMoveFile = useCallback((fileId: string, folderId: string | null) => {
    const folder = liveFolders.find((f) => f.id === folderId);
    setDatasets((prev) => prev.map((d) => d.id === fileId ? { ...d, folderId: folderId ?? undefined } : d));
    setMovingFileId(null);
    const numId = parseInt(fileId, 10);
    if (!isNaN(numId)) {
      updateFileMutation.mutate({ fileId: numId, folderId: folderId ?? null });
    }
    toast.success(`Moved to ${folder?.name ?? "Root"}`);
  }, [liveFolders, updateFileMutation]);

  // Bulk move
  const handleBulkMove = useCallback((folderId: string | null) => {
    const folder = liveFolders.find((f) => f.id === folderId);
    const ids = Array.from(selectedFileIds);
    setDatasets((prev) => prev.map((d) => ids.includes(d.id) ? { ...d, folderId: folderId ?? undefined } : d));
    setShowBulkMove(false);
    const numIds = ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));
    if (numIds.length) {
      bulkMoveMutation.mutate({ fileIds: numIds, folderId: folderId ?? null });
    }
    toast.success(`Moved ${ids.length} file(s) to ${folder?.name ?? "Root"}`);
    setSelectedFileIds(new Set());
  }, [selectedFileIds, liveFolders, bulkMoveMutation]);

  // Tag toggle
  const handleTagToggle = useCallback((tagId: string) => {
    if (!tagPickerFileId) return;
    setDatasets((prev) => prev.map((d) => {
      if (d.id !== tagPickerFileId) return d;
      const curTags = d.tags ?? [];
      const newTags = curTags.includes(tagId)
        ? curTags.filter((t) => t !== tagId)
        : [...curTags, tagId];
      return { ...d, tags: newTags };
    }));
  }, [tagPickerFileId]);

  // Create folder
  const handleCreateFolder = useCallback((name: string, parentId?: string | null) => {
    const id = `folder-${Date.now()}`;
    setFolders((prev) => [...prev, { id, name, fileCount: 0, parentId: parentId ?? null }]);
    toast.success(`Folder "${name}" created`);
  }, []);

  // Delete folder
  const handleDeleteFolder = useCallback((id: string) => {
    // Move files in this folder to root
    setDatasets((prev) => prev.map((d) => d.folderId === id ? { ...d, folderId: undefined } : d));
    // Remove folder and children
    const descendants = getDescendantFolderIds(id, folders);
    descendants.add(id);
    setFolders((prev) => prev.filter((f) => !descendants.has(f.id)));
    if (selectedFolderId === id) setSelectedFolderId(null);
    toast.success("Folder deleted");
  }, [folders, selectedFolderId]);

  // Rename folder
  const handleRenameFolder = useCallback((id: string) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const newName = prompt("Rename folder:", folder.name);
    if (newName && newName.trim()) {
      setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name: newName.trim() } : f));
      toast.success("Folder renamed");
    }
  }, [folders]);

  // ── Drag & Drop handler (react-beautiful-dnd) ──────────────────────────

  const onDragEnd = useCallback((result: DropResult) => {
    setDragOverFolderId(null);
    setIsDraggingFiles(false);

    if (!result.destination) {
      // Dropped outside valid area
      return;
    }

    const { source, destination, draggableId } = result;

    // Moving file to a folder (sidebar drop)
    if (destination.droppableId.startsWith("folder-")) {
      const targetFolderId = destination.droppableId === "folder-root"
        ? null
        : destination.droppableId.replace("folder-", "");
      const fileId = draggableId.replace("file-", "");

      // If multiple selected, move all
      if (selectedFileIds.has(fileId) && selectedFileIds.size > 1) {
        handleBulkMove(targetFolderId);
      } else {
        handleMoveFile(fileId, targetFolderId);
      }
      return;
    }

    // Reorder within grid
    if (source.droppableId === destination.droppableId && source.droppableId === "main-grid") {
      setDatasets((prev) => {
        const filtered = filteredDatasets.map((d) => d.id);
        const allIds = prev.map((d) => d.id);
        const fromIdx = allIds.indexOf(filtered[source.index]);
        const toIdx = allIds.indexOf(filtered[destination.index]);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const copy = [...prev];
        const [removed] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, removed);
        return copy;
      });
    }
  }, [selectedFileIds, handleBulkMove, handleMoveFile, filteredDatasets]);

  const onDragStart = useCallback(() => {
    setIsDraggingFiles(true);
  }, []);

  const onDragUpdate = useCallback((update: any) => {
    if (update.destination?.droppableId?.startsWith("folder-")) {
      const fid = update.destination.droppableId.replace("folder-", "");
      setDragOverFolderId(fid === "root" ? null : fid);
    } else {
      setDragOverFolderId(null);
    }
  }, []);

  // Desktop drag-to-upload on main grid
  const handleDesktopDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDesktopDragOver(false);
    if (e.dataTransfer.files?.length) {
      setShowUpload(true);
    }
  }, []);

  const hasActiveFilters = !!(searchTerm || selectedFolderId || selectedTagId);
  const activeFolder = liveFolders.find((f) => f.id === selectedFolderId);
  const activeTag = liveTags.find((t) => t.id === selectedTagId);

  // "/" shortcut -> focus search
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
    <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart} onDragUpdate={onDragUpdate}>
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
                placeholder='Search by name, filename, or tag... ("/" to focus)'
                className="w-full bg-white border border-[#D1D5DB] rounded-md pl-10 pr-9 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6] transition"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View toggle + Group By */}
            <ViewToolbar
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              groupBy={groupBy}
              onGroupByChange={handleGroupByChange}
            />

            {/* New folder button */}
            <button
              onClick={() => { setNewFolderParentId(selectedFolderId); setShowNewFolder(true); }}
              className="flex-shrink-0 flex items-center gap-2 bg-white hover:bg-[#EFF6FF] border border-[#D1D5DB] hover:border-[#3B82F6] text-[#374151] hover:text-[#3B82F6] text-sm font-medium rounded-md px-3 py-2.5 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden lg:inline">New Folder</span>
            </button>

            {/* Upload button */}
            <button
              onClick={() => setShowUpload(true)}
              className="flex-shrink-0 flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] active:bg-[#1d4ed8] text-white text-sm font-semibold rounded-md px-4 py-2.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Upload
            </button>
          </div>

          {/* Bulk actions toolbar */}
          {selectedFileIds.size > 0 && (
            <div className="bg-[#EFF6FF] border-t border-[#BFDBFE]">
              <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-[#3B82F6]">{selectedFileIds.size} selected</span>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    selectedFileIds.forEach((id) => {
                      const d = datasets.find((ds) => ds.id === id);
                      if (d) handleDownload(d);
                    });
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-[#f3f4f6] border border-[#D1D5DB] text-[#374151] rounded-md text-xs font-semibold transition-colors"
                >
                  <DownloadCloud className="w-3 h-3" />
                  Download All
                </button>
                <button
                  onClick={() => setShowBulkMove(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-[#EFF6FF] border border-[#BFDBFE] text-[#3B82F6] rounded-md text-xs font-semibold transition-colors"
                >
                  <ArrowRight className="w-3 h-3" />
                  Move Selected
                </button>
                <button onClick={() => setSelectedFileIds(new Set())} className="text-xs text-[#3B82F6] hover:text-[#1D4ED8] font-medium transition-colors">
                  Deselect all
                </button>
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  disabled={deleteFilesMutation.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {selectedFileIds.size}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Body ────────────────────────────────────────────────────────────── */}
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8">
          <div className="flex gap-7">

            {/* ── Light sidebar panel ──────────────────────────────────────── */}
            <aside className="hidden md:block w-52 lg:w-56 flex-shrink-0">
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 sticky top-[73px]">
                <LibrarySidebar
                  folders={liveFolders}
                  tags={liveTags}
                  datasets={datasets}
                  selectedFolderId={selectedFolderId}
                  selectedTagId={selectedTagId}
                  onFolderSelect={setSelectedFolderId}
                  onTagSelect={setSelectedTagId}
                  dragOverFolderId={dragOverFolderId}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onNewSubfolder={(parentId) => { setNewFolderParentId(parentId); setShowNewFolder(true); }}
                  onMoveFolder={() => toast.info("Folder move not yet implemented")}
                />
              </div>
            </aside>

            {/* ── Main area ──────────────────────────────────────────────────── */}
            <main
              className="flex-1 min-w-0 space-y-5"
              onDragOver={(e) => {
                // Desktop file drag
                if (e.dataTransfer.types.includes("Files")) {
                  e.preventDefault();
                  setDesktopDragOver(true);
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDesktopDragOver(false);
              }}
              onDrop={handleDesktopDrop}
            >
              {/* Breadcrumbs */}
              {breadcrumbs.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <button onClick={() => setSelectedFolderId(null)} className="text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors">
                    Data Library
                  </button>
                  {breadcrumbs.map((bc) => (
                    <span key={bc.id} className="flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      <button
                        onClick={() => setSelectedFolderId(bc.id)}
                        className={cn(
                          "font-medium transition-colors",
                          bc.id === selectedFolderId ? "text-[#111827]" : "text-[#3B82F6] hover:text-[#2563EB]"
                        )}
                      >
                        {bc.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Desktop drag overlay */}
              {desktopDragOver && (
                <div className="border-2 border-dashed border-[#3B82F6] bg-[#EFF6FF] rounded-xl p-8 flex flex-col items-center justify-center text-center">
                  <Upload className="w-8 h-8 text-[#3B82F6] mb-3 animate-bounce" />
                  <p className="text-sm font-semibold text-[#3B82F6]">Drop files to upload to {activeFolder?.name ?? "current folder"}</p>
                </div>
              )}

              {/* Active filter strip */}
              {hasActiveFilters && !breadcrumbs.length && (
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

              {/* Subfolder cards (when inside a folder) */}
              {childFolders.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {childFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="group flex items-center gap-3 bg-white border border-[#E5E7EB] hover:border-[#93C5FD] rounded-lg px-4 py-3 transition-all hover:bg-[#F9FAFB] text-left"
                    >
                      <Folder className="w-5 h-5 text-[#3B82F6] flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#111827] truncate">{folder.name}</p>
                        <p className="text-xs text-[#9CA3AF]">{folder.fileCount} files</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Grid / List / Gallery views with grouping */}
              {(
                <Droppable droppableId="main-grid" direction={viewMode === "grid" || viewMode === "gallery" ? "horizontal" : "vertical"}>
                  {(provided: DroppableProvided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {isLoading
                        ? <div className={cn(
                            viewMode === "list" ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                          )}>{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>
                        : filteredDatasets.length === 0
                        ? <EmptyState hasFilters={hasActiveFilters} onClear={clearAll} onUpload={() => setShowUpload(true)} isDragOver={desktopDragOver} />
                        : groupedDatasets.map((group) => {
                            const isCollapsed = collapsedGroups.has(group.label);
                            let globalIndex = 0;
                            // Compute global index offset
                            for (const g of groupedDatasets) {
                              if (g === group) break;
                              globalIndex += g.items.length;
                            }
                            return (
                              <div key={group.label || "all"}>
                                {group.label && (
                                  <GroupHeader
                                    label={group.label}
                                    count={group.items.length}
                                    collapsed={isCollapsed}
                                    onToggle={() => toggleGroupCollapse(group.label)}
                                  />
                                )}
                                {!isCollapsed && (
                                  <div className={cn(
                                    viewMode === "list" ? "space-y-3 mb-4" :
                                    viewMode === "gallery" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-4" :
                                    "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-4"
                                  )}>
                                    {group.items.map((d, i) => (
                                      <Draggable key={d.id} draggableId={`file-${d.id}`} index={globalIndex + i}>
                                        {(dragProvided: DraggableProvided) => (
                                          <DatasetCard dataset={d} selected={selectedFileIds.has(d.id)} viewMode={viewMode} allTags={tags}
                                            onSelect={handleSelectFile} onPreview={handlePreview} onDownload={handleDownload}
                                            onDelete={handleDeleteConfirm} onClick={(ds) => handleCtrlClick(ds, { ctrlKey: false, metaKey: false, preventDefault: () => {} } as any)}
                                            onRename={setRenamingId} onMove={setMovingFileId} onAddTag={setTagPickerFileId} onContextMenu={handleFileContextMenu}
                                            renamingId={renamingId} onRenameSubmit={handleRenameSubmit} onRenameCancel={() => setRenamingId(null)} provided={dragProvided} />
                                        )}
                                      </Draggable>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                      }
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </main>
          </div>
        </div>

        {/* Modals */}
        <UploadModal open={showUpload} onClose={() => setShowUpload(false)} onUploadComplete={handleUploadComplete} />

        {previewFile && (
          <FilePreviewModal
            file={{
              name: previewFile.fileName,
              content: previewContent?.content ?? "",
              type:
                previewFile.format === "CSV"
                  ? "csv"
                  : previewFile.format === "JSON"
                  ? "txt"
                  : previewFile.format === "XLSX"
                  ? "csv"
                  : null,
              size: previewFile.size,
              uploadedDate: previewFile.uploadDate,
              fileUrl: previewContent?.fileUrl,
              hasGraphs: previewContent?.hasGraphs,
              error: previewContent?.error,
            }}
            onClose={() => setPreviewFile(null)}
          />
        )}
        {selectedDataset && (
          <DocumentViewer document={selectedDataset} onClose={() => setSelectedDataset(null)} />
        )}

        {/* Right-click context menu */}
        {ctxMenu && (
          <div
            onMouseDown={e => e.stopPropagation()}
            className="fixed z-[9999] bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-1 min-w-[190px]"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            {ctxMenu.dataset && (
              <>
                <CtxBtn icon={<Eye className="w-3.5 h-3.5" />} label="Preview" onClick={() => { setPreviewFile(ctxMenu.dataset!); setCtxMenu(null); }} />
                <CtxBtn icon={<DownloadCloud className="w-3.5 h-3.5" />} label="Download" onClick={() => { handleDownload(ctxMenu.dataset!); setCtxMenu(null); }} />
                <div className="h-px bg-[#f3f4f6] my-1" />
                <CtxBtn icon={<Pencil className="w-3.5 h-3.5" />} label="Rename" onClick={() => { setRenamingId(ctxMenu.dataset!.id); setCtxMenu(null); }} />
                <CtxBtn icon={<ArrowRight className="w-3.5 h-3.5" />} label="Move to..." onClick={() => { setMovingFileId(ctxMenu.dataset!.id); setCtxMenu(null); }} />
                <CtxBtn icon={<Copy className="w-3.5 h-3.5" />} label="Copy" onClick={() => { toast.info("Copy not yet implemented"); setCtxMenu(null); }} />
                <CtxBtn icon={<Tag className="w-3.5 h-3.5" />} label="Add/Remove Tags" onClick={() => { setTagPickerFileId(ctxMenu.dataset!.id); setCtxMenu(null); }} />
                <div className="h-px bg-[#f3f4f6] my-1" />
                <CtxBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" danger onClick={() => { handleDeleteConfirm(ctxMenu.dataset!.id); setCtxMenu(null); }} />
              </>
            )}
          </div>
        )}

        {/* Delete confirmation */}
        {deleteTarget && (
          <DeleteConfirmModal
            name={deleteTarget.name}
            onConfirm={() => handleDelete(deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
        {bulkDeleteConfirm && (
          <DeleteConfirmModal
            name=""
            count={selectedFileIds.size}
            onConfirm={handleBulkDelete}
            onCancel={() => setBulkDeleteConfirm(false)}
          />
        )}

        {/* Folder picker for move */}
        {movingFileId && (
          <FolderPickerModal
            folders={liveFolders}
            currentFolderId={datasets.find((d) => d.id === movingFileId)?.folderId}
            onSelect={(fid) => handleMoveFile(movingFileId, fid)}
            onCancel={() => setMovingFileId(null)}
          />
        )}
        {showBulkMove && (
          <FolderPickerModal
            folders={liveFolders}
            title={`Move ${selectedFileIds.size} file(s)`}
            onSelect={handleBulkMove}
            onCancel={() => setShowBulkMove(false)}
          />
        )}

        {/* New folder modal */}
        {showNewFolder && (
          <NewFolderModal
            parentId={newFolderParentId}
            onClose={() => setShowNewFolder(false)}
            onCreate={handleCreateFolder}
          />
        )}

        {/* Tag picker */}
        {tagPickerFileId && (
          <TagPickerModal
            tags={tags}
            currentTags={datasets.find((d) => d.id === tagPickerFileId)?.tags ?? []}
            onToggle={handleTagToggle}
            onClose={() => setTagPickerFileId(null)}
          />
        )}
      </div>
    </DragDropContext>
  );
}
