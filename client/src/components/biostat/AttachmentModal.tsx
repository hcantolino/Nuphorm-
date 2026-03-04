/**
 * AttachmentModal — manages attached sources (project-level + tab-level).
 *
 * Opened by clicking the Paperclip icon in the chat input bar.
 * Replaces inline chip clutter in the chat flow with a clean, dedicated panel.
 *
 * Layout:
 *   • Header — "Attached Sources" + close (×)
 *   • Project Sources section (teal) — shared across all tabs in this project
 *   • Tab Sources section (blue)     — this analysis tab only
 *   • Footer — "Add from Library" + "Upload from Computer" action buttons
 */

import React, { useState } from "react";
import { X, FolderOpen, FileText, FileSpreadsheet, File, Paperclip, Upload, Plus, Eye } from "lucide-react";
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
}

// ── File icon helper ──────────────────────────────────────────────────────────

function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  const ext = (type ?? "").toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    return <FileSpreadsheet className={cn("w-4 h-4 text-emerald-600 flex-shrink-0", className)} />;
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

// ── Single source row ─────────────────────────────────────────────────────────

function SourceRow({
  name,
  size,
  type,
  accent,
  onRemove,
  onPreview,
  removeLabel,
}: {
  name: string;
  size?: string;
  type: string;
  accent: "teal" | "blue";
  onRemove: () => void;
  onPreview?: () => void;
  removeLabel: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm rounded-lg px-3 py-2.5 transition-colors",
        accent === "teal"
          ? "bg-teal-50 hover:bg-teal-100/70"
          : "bg-slate-50 hover:bg-slate-100"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <FileTypeIcon type={type} />
        <div className="min-w-0">
          <button
            type="button"
            onClick={onPreview}
            className={cn(
              "font-medium truncate max-w-[200px] text-left hover:underline cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 rounded",
              accent === "teal"
                ? "text-teal-900 hover:text-blue-600"
                : "text-slate-900 hover:text-blue-600"
            )}
            title={`Click to preview ${name}`}
          >
            {name}
          </button>
          {size && (
            <p className="text-[10px] text-slate-400 mt-0.5">{size}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-3">
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className={cn(
              "p-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300",
              accent === "teal"
                ? "text-teal-400 hover:text-blue-500 hover:bg-blue-50"
                : "text-slate-300 hover:text-blue-500 hover:bg-blue-50"
            )}
            aria-label={`Preview ${name}`}
            title={`Preview ${name}`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            "p-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-300",
            accent === "teal"
              ? "text-teal-400 hover:text-red-500 hover:bg-red-50"
              : "text-slate-300 hover:text-red-500 hover:bg-red-50"
          )}
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
            accent === "teal" ? "text-teal-700" : "text-blue-700"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
            accent === "teal"
              ? "bg-teal-100 text-teal-700"
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
}) => {
  const [previewFile, setPreviewFile] = useState<FilePreviewFile | null>(null);

  /** Open file preview — resolves type from extension */
  const openPreview = (name: string, size?: string, uploadedDate?: string) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const fileType: "txt" | "csv" | null =
      ext === "csv" ? "csv" : ["txt", "tsv", "dat"].includes(ext) ? "txt" : null;
    setPreviewFile({
      name,
      content: "", // FilePreviewModal will fall back to MOCK_FILE_CONTENTS
      type: fileType,
      size,
      uploadedDate,
    });
  };

  if (!open && !previewFile) return null;

  const totalCount = tabFiles.length + projectSources.length;

  return (
    <>
      {/* ── File Preview Modal (rendered via portal, above everything) ── */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {!open ? null : <>
      {/* Backdrop — click to dismiss */}
      {/* REMOVED: backdrop blur (per design requirement — no blur) */}
      <div
        className="fixed inset-0 z-[180]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      {/* NEW: centered floating modal, no background blur */}
      <div
        className="fixed z-[190] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-label="Manage attached files"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-[#14b8a6]" />
            <h2 className="text-sm font-semibold text-slate-900">Attached Sources</h2>
            {totalCount > 0 && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {totalCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14b8a6]"
            aria-label="Close attachment manager"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 space-y-5 max-h-[52vh] overflow-y-auto">

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

          {/* ── Project Sources (teal) ──────────────────────────────── */}
          {(projectSources.length > 0 || true) && (
            <div>
              <SectionHeader
                icon={<FolderOpen className="w-3.5 h-3.5 text-teal-600" />}
                label="Project Sources"
                count={projectSources.length}
                accent="teal"
              />
              <p className="text-[10px] text-slate-400 mb-2 -mt-1">
                Shared across all tabs in this project
              </p>
              {projectSources.length === 0 ? (
                <EmptyState label="No project-level sources attached" />
              ) : (
                <div className="space-y-1.5">
                  {projectSources.map((src) => (
                    <SourceRow
                      key={src.id}
                      name={src.name}
                      type={src.type ?? ""}
                      size={formatBytes(src.size)}
                      accent="teal"
                      onRemove={() => onRemoveProjectSource(src.id)}
                      onPreview={() => openPreview(src.name, formatBytes(src.size))}
                      removeLabel={`Remove ${src.name} from project sources`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab Sources (blue) ──────────────────────────────────── */}
          <div>
            <SectionHeader
              icon={<FileText className="w-3.5 h-3.5 text-blue-500" />}
              label={tabName ? `Tab: ${tabName}` : "Tab Sources"}
              count={tabFiles.length}
              accent="blue"
              onClearAll={onClearAllTabFiles}
            />
            <p className="text-[10px] text-slate-400 mb-2 -mt-1">
              Available only within this analysis tab
            </p>
            {tabFiles.length === 0 ? (
              <EmptyState label="No tab-level sources attached" />
            ) : (
              <div className="space-y-1.5">
                {tabFiles.map((f) => (
                  <SourceRow
                    key={f.id}
                    name={f.name}
                    type={f.type}
                    size={f.size}
                    accent="blue"
                    onRemove={() => onRemoveTabFile(f.id)}
                    onPreview={() => openPreview(f.name, f.size, f.uploadedDate)}
                    removeLabel={`Remove ${f.name}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ───────────────────────────────────────── */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2">
          {/* Add from library */}
          {/* NEW: single "Add from Library" button — no scope dropdown, attaches to tab by default */}
          <button
            type="button"
            onClick={() => { onAddFromLibrary(); onClose(); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#14b8a6] text-[#14b8a6] hover:bg-teal-50 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Add from Library
          </button>

          {/* Upload from computer */}
          {/* NEW: direct upload, no scope dropdown */}
          <button
            type="button"
            onClick={() => { onUploadFromComputer(); onClose(); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
        </div>
      </div>
      </>}
    </>
  );
};

export default AttachmentModal;
