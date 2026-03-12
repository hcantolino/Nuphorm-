/**
 * AttachmentModal — manages attached sources (project-level + tab-level).
 *
 * Opened by clicking the Paperclip icon in the chat input bar.
 * Replaces inline chip clutter in the chat flow with a clean, dedicated panel.
 *
 * Layout:
 *   • Header — "Attached Sources" + "All Sources" toggle + close (×)
 *   • Search bar
 *   • Project Sources section — shared across all tabs in this project
 *   • Tab Sources section     — this analysis tab only
 *   • Quick Actions bar — Select All / None / Tab Only / Project Only
 *   • Footer — "Add from Library" + "Upload from Computer" action buttons
 */

import React, { useState, useMemo } from "react";
import {
  X,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  File,
  Paperclip,
  Upload,
  Plus,
  Eye,
  Search,
  Check,
  Lock,
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
  /** Open the file library picker (will attach to the scope the user last selected) */
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
}

// ── File icon helper ──────────────────────────────────────────────────────────

function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  const ext = (type ?? "").toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    return <FileSpreadsheet className={cn("w-4 h-4 text-blue-600 flex-shrink-0", className)} />;
  }
  if (ext === "pdf") {
    return <FileText className={cn("w-4 h-4 text-rose-500 flex-shrink-0", className)} />;
  }
  return <File className={cn("w-4 h-4 text-blue-500 flex-shrink-0", className)} />;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-xs text-slate-400 italic py-2 px-1">{label}</p>
  );
}

// ── Single source row with checkbox ──────────────────────────────────────────

function SourceRow({
  name,
  size,
  type,
  checked,
  onToggle,
  onRemove,
  onPreview,
  removeLabel,
  isLocked,
}: {
  name: string;
  size?: string;
  type: string;
  checked: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onPreview?: () => void;
  removeLabel: string;
  isLocked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center text-sm rounded-lg px-3 py-2.5 transition-all",
        checked
          ? "bg-[#eff6ff] border-l-[3px] border-l-[#2563eb]"
          : "opacity-50 border-l-[3px] border-l-transparent"
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="flex-shrink-0 w-4 h-4 rounded border mr-2.5 flex items-center justify-center transition-colors"
        style={
          checked
            ? { backgroundColor: "#3b82f6", borderColor: "#3b82f6" }
            : { backgroundColor: "#fff", borderColor: "#a0aec0" }
        }
        aria-label={`${checked ? "Deselect" : "Select"} ${name}`}
      >
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* File info */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <FileTypeIcon type={type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPreview}
              className={cn(
                "font-medium truncate max-w-[180px] text-left hover:underline cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 rounded",
                checked ? "text-slate-900" : "text-slate-500"
              )}
              title={`Click to preview ${name}`}
            >
              {name}
            </button>
            {isLocked && (
              <span title="Used in queries — cannot be deleted">
                <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
              </span>
            )}
          </div>
          {size && (
            <p className="text-[10px] text-slate-400 mt-0.5">{size}</p>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mr-2"
        style={
          checked
            ? { backgroundColor: "#dbeafe", color: "#1d4ed8" }
            : { backgroundColor: "#fed7d7", color: "#f56565" }
        }
      >
        {checked ? "Active" : "Inactive"}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="p-1 rounded-full transition-colors text-slate-300 hover:text-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label={`Preview ${name}`}
            title={`Preview ${name}`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded-full transition-colors text-slate-300 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
          aria-label={removeLabel}
          title={removeLabel}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  count,
  accent,
  onClearAll,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  accent: "teal" | "blue";
  onClearAll?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            accent === "teal" ? "text-blue-700" : "text-blue-700"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
            accent === "teal"
              ? "bg-blue-100 text-blue-700"
              : "bg-blue-100 text-blue-700"
          )}
        >
          {count}
        </span>
      </div>
      {onClearAll && count > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[10px] text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// ── Quick action button ──────────────────────────────────────────────────────

function QuickActionBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors",
        active
          ? "bg-[#2563eb] text-white border-[#2563eb]"
          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
      )}
    >
      {label}
    </button>
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
}) => {
  const [previewFile, setPreviewFile] = useState<FilePreviewFile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Deletion guard: blocks removal of project sources used in queries
  const [deleteGuard, setDeleteGuard] = useState<{ source: ProjectSource; isUsed: boolean } | null>(null);

  /** Open file preview — resolves type from extension */
  const openPreview = (name: string, size?: string, uploadedDate?: string, previewText?: string) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    let fileType: "txt" | "csv" | "pdf" | "xlsx" | null = null;
    if (ext === "csv") fileType = "csv";
    else if (["txt", "tsv", "dat"].includes(ext)) fileType = "txt";
    else if (ext === "pdf") fileType = previewText ? "txt" : "pdf"; // show extracted text as plaintext if available
    else if (["xlsx", "xls"].includes(ext)) fileType = "xlsx";

    setPreviewFile({
      name,
      content: previewText ?? "",
      type: fileType,
      size,
      uploadedDate,
    });
  };

  /** Intercept project source removal — check if used in queries first */
  const handleRemoveProjectSource = (src: ProjectSource) => {
    const used = isSourceUsedInQueries?.(src.id) ?? false;
    setDeleteGuard({ source: src, isUsed: used });
  };

  const totalCount = tabFiles.length + projectSources.length;
  const allChecked = totalCount > 0 && [...projectSources.map(s => s.id), ...tabFiles.map(f => f.id)].every(id => sourceSelection[id] !== false);
  const checkedCount = [...projectSources, ...tabFiles].filter(s => sourceSelection[s.id] !== false).length;

  // Filter by search
  const sq = searchQuery.toLowerCase().trim();
  const filteredProjectSources = useMemo(
    () => sq ? projectSources.filter(s => s.name.toLowerCase().includes(sq)) : projectSources,
    [projectSources, sq]
  );
  const filteredTabFiles = useMemo(
    () => sq ? tabFiles.filter(f => f.name.toLowerCase().includes(sq)) : tabFiles,
    [tabFiles, sq]
  );

  if (!open && !previewFile) return null;

  return (
    <>
      {/* ── File Preview Modal (rendered via portal, above everything) ── */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {!open ? null : <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[180]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className="fixed z-[190] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl w-full max-w-md"
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 8px 30px rgba(26, 32, 44, 0.12), 0 2px 8px rgba(26, 32, 44, 0.06)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Manage attached files"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4" style={{ color: "#3b82f6" }} />
            <h2 className="text-sm font-semibold" style={{ color: "#1a202c" }}>Attached Sources</h2>
            {totalCount > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={
                  checkedCount === totalCount
                    ? { backgroundColor: "#dbeafe", color: "#1d4ed8" }
                    : checkedCount > 0
                    ? { backgroundColor: "#e0edff", color: "#2563eb" }
                    : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
                }
              >
                {checkedCount}/{totalCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* All Sources toggle */}
            {totalCount > 0 && (
              <button
                type="button"
                onClick={allChecked ? onSelectNone : onSelectAll}
                className={cn(
                  "text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors",
                  allChecked
                    ? "bg-[#2563eb] text-white border-[#2563eb]"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
                title={allChecked ? "Deselect all sources" : "Select all sources"}
              >
                All Sources
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              aria-label="Close attachment manager"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Search ──────────────────────────────────────────────────── */}
        {totalCount > 0 && (
          <div className="px-5 pt-3 pb-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus-within:border-[#2563eb] focus-within:bg-white transition-colors">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sources..."
                className="flex-1 text-xs bg-transparent outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 space-y-5 max-h-[48vh] overflow-y-auto">

          {/* Empty state when nothing is attached */}
          {totalCount === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Paperclip className="w-8 h-8 text-slate-200" />
              <div>
                <p className="text-sm font-medium text-slate-500">No files attached yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Use the buttons below to attach data files for analysis.
                </p>
              </div>
            </div>
          )}

          {/* ── Project Sources ──────────────────────────────────────── */}
          {(projectSources.length > 0 || true) && (
            <div>
              <SectionHeader
                icon={<FolderOpen className="w-3.5 h-3.5 text-blue-600" />}
                label="Project Sources"
                count={filteredProjectSources.length}
                accent="teal"
              />
              <p className="text-[10px] text-slate-400 mb-2 -mt-1">
                Shared across all tabs in this project
              </p>
              {filteredProjectSources.length === 0 ? (
                <EmptyState label={sq ? "No matching project sources" : "No project-level sources attached"} />
              ) : (
                <div className="space-y-1.5">
                  {filteredProjectSources.map((src) => (
                    <SourceRow
                      key={src.id}
                      name={src.name}
                      type={src.type ?? ""}
                      size={formatBytes(src.size)}
                      checked={sourceSelection[src.id] !== false}
                      onToggle={() => onToggleSource(src.id)}
                      onRemove={() => handleRemoveProjectSource(src)}
                      onPreview={() => openPreview(src.name, formatBytes(src.size), undefined, src.preview)}
                      removeLabel={`Remove ${src.name} from project sources`}
                      isLocked={isSourceUsedInQueries?.(src.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab Sources ──────────────────────────────────────────── */}
          <div>
            <SectionHeader
              icon={<FileText className="w-3.5 h-3.5 text-blue-500" />}
              label={tabName ? `Tab: ${tabName}` : "Tab Sources"}
              count={filteredTabFiles.length}
              accent="blue"
              onClearAll={onClearAllTabFiles}
            />
            <p className="text-[10px] text-slate-400 mb-2 -mt-1">
              Available only within this analysis tab
            </p>
            {filteredTabFiles.length === 0 ? (
              <EmptyState label={sq ? "No matching tab sources" : "No tab-level sources attached"} />
            ) : (
              <div className="space-y-1.5">
                {filteredTabFiles.map((f) => (
                  <SourceRow
                    key={f.id}
                    name={f.name}
                    type={f.type}
                    size={f.size}
                    checked={sourceSelection[f.id] !== false}
                    onToggle={() => onToggleSource(f.id)}
                    onRemove={() => onRemoveTabFile(f.id)}
                    onPreview={() => openPreview(f.name, f.size, f.uploadedDate)}
                    removeLabel={`Remove ${f.name}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions ──────────────────────────────────────────── */}
        {totalCount > 0 && (
          <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 font-medium mr-1">Quick:</span>
            <QuickActionBtn label="Select All" active={allChecked} onClick={onSelectAll} />
            <QuickActionBtn label="Select None" active={checkedCount === 0} onClick={onSelectNone} />
            {tabFiles.length > 0 && projectSources.length > 0 && (
              <>
                <QuickActionBtn label="Tab Only" onClick={onSelectTabOnly} />
                <QuickActionBtn label="Project Only" onClick={onSelectProjectOnly} />
              </>
            )}
          </div>
        )}

        {/* ── Secondary actions ─────────────────────────────────── */}
        <div className="px-5 pt-3 pb-2 border-t" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { onAddFromLibrary(); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
              style={{ borderColor: "#3b82f6", color: "#3b82f6" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#eff6ff")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
            >
              <Plus className="w-3.5 h-3.5" />
              Add from Library
            </button>
            <button
              type="button"
              onClick={() => { onUploadFromComputer(); onClose(); }}
              className="flex items-center justify-center gap-1 px-3 py-2 text-[10px] font-medium rounded-lg transition-colors focus:outline-none"
              style={{ color: "#a0aec0" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#a0aec0"; e.currentTarget.style.backgroundColor = ""; }}
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
          </div>
        </div>

        {/* ── Load to Query (primary action) ─────────────────────── */}
        {totalCount > 0 && (
          <div className="px-5 pb-4 pt-1">
            <button
              type="button"
              onClick={() => {
                onLoadToQuery?.();
                onClose();
              }}
              disabled={checkedCount === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: checkedCount > 0 ? "#3b82f6" : "#cbd5e1",
                color: "#ffffff",
              }}
              onMouseEnter={(e) => { if (checkedCount > 0) e.currentTarget.style.backgroundColor = "#2563eb"; }}
              onMouseLeave={(e) => { if (checkedCount > 0) e.currentTarget.style.backgroundColor = "#3b82f6"; }}
            >
              <Check className="w-3.5 h-3.5" />
              Load {checkedCount} Source{checkedCount !== 1 ? "s" : ""} to Query
            </button>
          </div>
        )}
      </div>
      </>}

      {/* ── Deletion guard modal ─────────────────────────────────── */}
      {deleteGuard && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/30" onClick={() => setDeleteGuard(null)} />
          <div
            className="fixed z-[210] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteGuard.isUsed ? (
              /* Source IS used in queries — block deletion */
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">Cannot Remove Source</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  <span className="font-medium">{deleteGuard.source.name}</span> has already been used in one or more queries in this project. Project-wide sources cannot be removed once they have been referenced in an analysis, as this would break the audit trail for existing results.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mb-5">
                  If you no longer want this file applied to new queries, you can deselect it in the source selection panel instead.
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteGuard(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleSource(deleteGuard.source.id);
                      setDeleteGuard(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors"
                  >
                    Deselect Instead
                  </button>
                </div>
              </>
            ) : (
              /* Source NOT used — simple confirmation */
              <>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Remove Source</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-5">
                  Remove <span className="font-medium">{deleteGuard.source.name}</span> from this project? This will remove it from all tabs.
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteGuard(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveProjectSource(deleteGuard.source.id);
                      setDeleteGuard(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
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
