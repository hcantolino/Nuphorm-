/**
 * AttachmentModal — universal file management modal.
 *
 * Opened by clicking the single Paperclip icon immediately left of the Send button.
 * Large dark-navy modal (~70% viewport width, ~80% height) with two tabs:
 *   1. "Project-Level Sources" — shared across all tabs
 *   2. "Tab-Level Sources"     — this analysis tab only
 *
 * Footer: "Upload from Computer" (solid blue) + "Add from Repository" (outline blue).
 * After upload, user picks scope via radio toggle before confirming.
 */

import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  X,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  File,
  Paperclip,
  Upload,
  Eye,
  Search,
  Check,
  Lock,
  Trash2,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes, type ProjectSource } from "@/stores/projectStore";
import FilePreviewModal, { type FilePreviewFile } from "@/components/FilePreviewModal";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttachmentFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedDate: string;
}

/** Source selection state: Record<sourceId, boolean> */
export type SourceSelectionMap = Record<string, boolean>;

export interface AttachmentModalProps {
  open: boolean;
  onClose: () => void;
  /** Tab-level sources (this analysis tab only) */
  tabFiles: AttachmentFile[];
  onRemoveTabFile: (id: string) => void;
  onClearAllTabFiles: () => void;
  /** Project-level sources (shared across all tabs) */
  projectSources: ProjectSource[];
  onRemoveProjectSource: (id: string) => void;
  /** Open the file library picker */
  onAddFromLibrary: () => void;
  /** Trigger the computer upload dialog */
  onUploadFromComputer: () => void;
  /** Display name for the current tab */
  tabName?: string;
  /** Per-source checked/unchecked state */
  sourceSelection: SourceSelectionMap;
  /** Update source selection (sourceId → checked) */
  onToggleSource: (sourceId: string) => void;
  /** Bulk selection helpers */
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSelectTabOnly: () => void;
  onSelectProjectOnly: () => void;
  /** Whether a project source has been used in queries (for lock icon) */
  isSourceUsedInQueries?: (sourceId: string) => boolean;
  /** Called when user clicks "Load to Query" — confirms selections and closes */
  onLoadToQuery?: () => void;
  /** Upload scope setter — called before triggering upload */
  onSetScope?: (scope: "project" | "tab") => void;
}

// ── Palette ──────────────────────────────────────────────────────────────────

const COLORS = {
  modalBg: "#ffffff",
  headerBg: "#f8fafc",
  footerBg: "#f1f5f9",
  rowEven: "#ffffff",
  rowOdd: "#f8fafc",
  rowHover: "#eff6ff",
  textWhite: "#0f172a",
  textLight: "#1e293b",
  textMuted: "#64748b",
  accent: "#3b82f6",
  accentHover: "#2563eb",
  fileIcon: "#3b82f6",
  trashIcon: "#9ca3af",
  trashHover: "#ef4444",
  success: "#10b981",
  tabActive: "#3b82f6",
  tabInactive: "#e2e8f0",
  border: "#e2e8f0",
  badgeBg: "#3b82f6",
} as const;

// ── File icon helper ──────────────────────────────────────────────────────────

function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  const ext = (type ?? "").toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    return <FileSpreadsheet className={cn("w-4 h-4 flex-shrink-0", className)} style={{ color: COLORS.fileIcon }} />;
  }
  if (ext === "pdf") {
    return <FileText className={cn("w-4 h-4 flex-shrink-0", className)} style={{ color: "#ef4444" }} />;
  }
  return <File className={cn("w-4 h-4 flex-shrink-0", className)} style={{ color: COLORS.fileIcon }} />;
}

// ── File row ──────────────────────────────────────────────────────────────────

function SourceRow({
  name,
  size,
  type,
  dateAdded,
  onRemove,
  onPreview,
  isLocked,
  striped,
}: {
  name: string;
  size?: string;
  type: string;
  dateAdded?: string;
  onRemove: () => void;
  onPreview?: () => void;
  isLocked?: boolean;
  striped: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 transition-colors group"
      style={{
        backgroundColor: striped ? COLORS.rowOdd : COLORS.rowEven,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.rowHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = striped ? COLORS.rowOdd : COLORS.rowEven)}
    >
      <FileTypeIcon type={type} />
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onPreview}
          className="text-sm font-medium truncate max-w-[300px] text-left hover:underline cursor-pointer transition-colors block"
          style={{ color: COLORS.textWhite }}
          title={`Preview ${name}`}
        >
          {name}
        </button>
        <div className="flex items-center gap-2 mt-0.5">
          {size && <span className="text-xs" style={{ color: COLORS.textMuted }}>{size}</span>}
          {dateAdded && (
            <>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>·</span>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>{dateAdded}</span>
            </>
          )}
        </div>
      </div>

      {/* Preview eye */}
      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: COLORS.textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.fileIcon)}
          onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
          aria-label={`Preview ${name}`}
        >
          <Eye className="w-4 h-4" />
        </button>
      )}

      {/* Lock or trash */}
      {isLocked ? (
        <span title="Used in queries — cannot be removed" className="p-1.5">
          <Lock className="w-4 h-4" style={{ color: "#f59e0b" }} />
        </span>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: COLORS.trashIcon }}
          onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.trashHover)}
          onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.trashIcon)}
          aria-label={`Remove ${name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const AttachmentModal: React.FC<AttachmentModalProps> = ({
  open,
  onClose,
  tabFiles,
  onRemoveTabFile,
  onClearAllTabFiles,
  projectSources,
  onRemoveProjectSource,
  onAddFromLibrary,
  onUploadFromComputer,
  tabName,
  sourceSelection,
  onToggleSource,
  onSelectAll,
  onSelectNone,
  onSelectTabOnly,
  onSelectProjectOnly,
  isSourceUsedInQueries,
  onLoadToQuery,
  onSetScope,
}) => {
  const [previewFile, setPreviewFile] = useState<FilePreviewFile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"project" | "tab">("project");
  const [deleteGuard, setDeleteGuard] = useState<{ source: ProjectSource; isUsed: boolean } | null>(null);
  // Scope picker state — shown after user selects files to upload
  const [showScopePicker, setShowScopePicker] = useState(false);
  const [pendingUploadScope, setPendingUploadScope] = useState<"project" | "tab">("project");

  const openPreview = (name: string, size?: string, uploadedDate?: string, previewText?: string) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    let fileType: "txt" | "csv" | "pdf" | "xlsx" | null = null;
    if (ext === "csv") fileType = "csv";
    else if (["txt", "tsv", "dat"].includes(ext)) fileType = "txt";
    else if (ext === "pdf") fileType = previewText ? "txt" : "pdf";
    else if (["xlsx", "xls"].includes(ext)) fileType = "xlsx";
    setPreviewFile({ name, content: previewText ?? "", type: fileType, size, uploadedDate });
  };

  const handleRemoveProjectSource = (src: ProjectSource) => {
    const used = isSourceUsedInQueries?.(src.id) ?? false;
    setDeleteGuard({ source: src, isUsed: used });
  };

  // Filtered lists
  const sq = searchQuery.toLowerCase().trim();
  const filteredProjectSources = useMemo(
    () => sq ? projectSources.filter(s => s.name.toLowerCase().includes(sq)) : projectSources,
    [projectSources, sq]
  );
  const filteredTabFiles = useMemo(
    () => sq ? tabFiles.filter(f => f.name.toLowerCase().includes(sq)) : tabFiles,
    [tabFiles, sq]
  );

  const totalCount = projectSources.length + tabFiles.length;

  if (!open && !previewFile) return null;

  return (
    <>
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      {!open ? null : (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[180] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            className="fixed z-[190] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl overflow-hidden flex flex-col"
            style={{
              width: "min(70vw, 900px)",
              height: "min(80vh, 720px)",
              backgroundColor: COLORS.modalBg,
              boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Manage attached files"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ────────────────────────────────────────────────── */}
            <div
              className="flex items-center justify-between px-6 py-5 flex-shrink-0"
              style={{ borderBottom: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center gap-3">
                <Paperclip className="w-5 h-5" style={{ color: COLORS.fileIcon }} />
                <h2 className="text-lg font-bold" style={{ color: COLORS.textWhite }}>
                  Attached Sources
                </h2>
                {totalCount > 0 && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: COLORS.badgeBg, color: COLORS.textWhite }}
                  >
                    {totalCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg transition-colors"
                style={{ color: COLORS.textMuted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.textWhite)}
                onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Tab bar ───────────────────────────────────────────────── */}
            <div
              className="flex items-center gap-1 px-6 pt-4 pb-0 flex-shrink-0"
            >
              <button
                type="button"
                onClick={() => setActiveTab("project")}
                className="px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors"
                style={{
                  backgroundColor: activeTab === "project" ? COLORS.tabActive : "transparent",
                  color: activeTab === "project" ? COLORS.textWhite : COLORS.textMuted,
                }}
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Project-Level Sources
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: activeTab === "project" ? "rgba(255,255,255,0.2)" : COLORS.tabInactive,
                      color: COLORS.textWhite,
                    }}
                  >
                    {projectSources.length}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tab")}
                className="px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors"
                style={{
                  backgroundColor: activeTab === "tab" ? COLORS.tabActive : "transparent",
                  color: activeTab === "tab" ? COLORS.textWhite : COLORS.textMuted,
                }}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {tabName ? `Tab: ${tabName}` : "Tab-Level Sources"}
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: activeTab === "tab" ? "rgba(255,255,255,0.2)" : COLORS.tabInactive,
                      color: COLORS.textWhite,
                    }}
                  >
                    {tabFiles.length}
                  </span>
                </span>
              </button>
            </div>

            {/* ── Search bar ────────────────────────────────────────────── */}
            <div className="px-6 pt-3 pb-2 flex-shrink-0">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: COLORS.rowOdd, border: `1px solid ${COLORS.border}` }}
              >
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: COLORS.textMuted }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sources..."
                  className="flex-1 text-sm bg-transparent outline-none"
                  style={{ color: COLORS.textLight }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{ color: COLORS.textMuted }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Body (scrollable file list) ───────────────────────────── */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-2">
              {activeTab === "project" ? (
                /* ── Project Sources ── */
                filteredProjectSources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <FolderOpen className="w-10 h-10" style={{ color: COLORS.textMuted, opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: COLORS.textMuted }}>
                      {sq ? "No matching project sources" : "No project-level sources yet"}
                    </p>
                    {!sq && (
                      <button
                        type="button"
                        onClick={() => {
                          onSetScope?.("project");
                          onUploadFromComputer();
                        }}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        style={{ backgroundColor: COLORS.accent, color: COLORS.textWhite }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.accentHover)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.accent)}
                      >
                        Add Files
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                    {filteredProjectSources.map((src, i) => (
                      <SourceRow
                        key={src.id}
                        name={src.name}
                        type={src.type ?? ""}
                        size={formatBytes(src.size)}
                        dateAdded={src.uploadedAt ? new Date(src.uploadedAt).toLocaleDateString() : undefined}
                        onRemove={() => handleRemoveProjectSource(src)}
                        onPreview={() => openPreview(src.name, formatBytes(src.size), undefined, src.preview)}
                        isLocked={isSourceUsedInQueries?.(src.id)}
                        striped={i % 2 === 1}
                      />
                    ))}
                  </div>
                )
              ) : (
                /* ── Tab Sources ── */
                filteredTabFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <FileText className="w-10 h-10" style={{ color: COLORS.textMuted, opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: COLORS.textMuted }}>
                      {sq
                        ? "No matching tab sources"
                        : "No tab-specific sources attached — add below"}
                    </p>
                    {!sq && (
                      <button
                        type="button"
                        onClick={() => {
                          onSetScope?.("tab");
                          onUploadFromComputer();
                        }}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        style={{ backgroundColor: COLORS.accent, color: COLORS.textWhite }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.accentHover)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.accent)}
                      >
                        Add Files
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                    {filteredTabFiles.map((f, i) => (
                      <SourceRow
                        key={f.id}
                        name={f.name}
                        type={f.type}
                        size={f.size}
                        dateAdded={f.uploadedDate}
                        onRemove={() => onRemoveTabFile(f.id)}
                        onPreview={() => openPreview(f.name, f.size, f.uploadedDate)}
                        striped={i % 2 === 1}
                      />
                    ))}
                  </div>
                )
              )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div
              className="flex items-center justify-center gap-4 px-6 py-4 flex-shrink-0"
              style={{ backgroundColor: COLORS.footerBg, borderTop: `1px solid ${COLORS.border}` }}
            >
              {/* Upload from Computer — solid blue */}
              <button
                type="button"
                onClick={() => {
                  // Set scope based on active tab then trigger upload
                  onSetScope?.(activeTab);
                  onUploadFromComputer();
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors"
                style={{ backgroundColor: COLORS.accent, color: COLORS.textWhite }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.accentHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.accent)}
              >
                <Paperclip className="w-4 h-4" />
                Upload from Computer
              </button>

              {/* Add from Repository — outline blue */}
              <button
                type="button"
                onClick={() => {
                  onSetScope?.(activeTab);
                  onAddFromLibrary();
                  onClose();
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors"
                style={{
                  border: `2px solid ${COLORS.accent}`,
                  color: COLORS.accent,
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.accent;
                  e.currentTarget.style.color = COLORS.textWhite;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = COLORS.accent;
                }}
              >
                <Folder className="w-4 h-4" />
                Add from Repository
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Deletion guard modal ─────────────────────────────────── */}
      {deleteGuard && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/40" onClick={() => setDeleteGuard(null)} />
          <div
            className="fixed z-[210] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl w-full max-w-sm p-6"
            style={{ backgroundColor: COLORS.modalBg, border: `1px solid ${COLORS.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {deleteGuard.isUsed ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(245,158,11,0.15)" }}>
                    <Lock className="w-5 h-5" style={{ color: "#f59e0b" }} />
                  </div>
                  <h3 className="text-sm font-semibold" style={{ color: COLORS.textWhite }}>Cannot Remove Source</h3>
                </div>
                <p className="text-xs leading-relaxed mb-4" style={{ color: COLORS.textLight }}>
                  <span className="font-medium">{deleteGuard.source.name}</span> has already been used in one or more queries. Project-wide sources cannot be removed once referenced in an analysis to preserve the audit trail.
                </p>
                <p className="text-xs leading-relaxed mb-5" style={{ color: COLORS.textMuted }}>
                  You can deselect it from the source selection panel to exclude it from future queries.
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteGuard(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textLight }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleSource(deleteGuard.source.id);
                      setDeleteGuard(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: COLORS.accent, color: COLORS.textWhite }}
                  >
                    Deselect Instead
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textWhite }}>Remove Source</h3>
                <p className="text-xs leading-relaxed mb-5" style={{ color: COLORS.textLight }}>
                  Remove <span className="font-medium">{deleteGuard.source.name}</span> from this project? This will remove it from all tabs.
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteGuard(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textLight }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveProjectSource(deleteGuard.source.id);
                      setDeleteGuard(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: "#ef4444", color: COLORS.textWhite }}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default AttachmentModal;
