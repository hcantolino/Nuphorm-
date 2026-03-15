// Requires: pnpm add re-resizable (react-draggable already installed)
import { useState, useCallback, useRef, useEffect } from "react";
import Draggable from "react-draggable";
import { Resizable } from "re-resizable";
import {
  X,
  Upload,
  FileText,
  Trash2,
  GripHorizontal,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface DocumentSettingsValues {
  template: string;
  formatting: {
    fontSize: string;
    lineSpacing: string;
    pageMargins: string;
  };
  aiConfidence: number;
  repositoryOnly: boolean;
  includeReferences: boolean;
  citationStyle: "apa" | "mla" | "chicago";
  sourceFiles: { id: string; name: string; size: number }[];
}

interface DocumentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: DocumentSettingsValues) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TEMPLATES = [
  { value: "", label: "None (default)" },
  { value: "510k", label: "510(k) Submission" },
  { value: "pma", label: "PMA Application" },
  { value: "de-novo", label: "De Novo Classification" },
  { value: "cer", label: "Clinical Evaluation Report" },
  { value: "custom", label: "Custom Template" },
];

const FONT_SIZES = ["10pt", "11pt", "12pt", "14pt"];
const LINE_SPACINGS = ["1.0", "1.15", "1.5", "2.0"];
const PAGE_MARGINS = ["Narrow", "Normal", "Wide"];

const DEFAULT_SETTINGS: DocumentSettingsValues = {
  template: "",
  formatting: { fontSize: "12pt", lineSpacing: "1.5", pageMargins: "Normal" },
  aiConfidence: 0.85,
  repositoryOnly: true,
  includeReferences: true,
  citationStyle: "apa",
  sourceFiles: [],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function DocumentSettingsModal({
  isOpen,
  onClose,
  onSave,
}: DocumentSettingsModalProps) {
  const [settings, setSettings] = useState<DocumentSettingsValues>(DEFAULT_SETTINGS);
  const [isMobile, setIsMobile] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Reset position when re-opened
  const [dragKey, setDragKey] = useState(0);
  useEffect(() => {
    if (isOpen) setDragKey((k) => k + 1);
  }, [isOpen]);

  const patch = useCallback(
    <K extends keyof DocumentSettingsValues>(
      key: K,
      value: DocumentSettingsValues[K]
    ) => setSettings((s) => ({ ...s, [key]: value })),
    []
  );

  const patchFormatting = useCallback(
    (key: string, value: string) =>
      setSettings((s) => ({
        ...s,
        formatting: { ...s.formatting, [key]: value },
      })),
    []
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      const newFiles = Array.from(files).map((f) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        size: f.size,
      }));
      setSettings((s) => ({
        ...s,
        sourceFiles: [...s.sourceFiles, ...newFiles],
      }));
      e.target.value = "";
    },
    []
  );

  const removeFile = useCallback((id: string) => {
    setSettings((s) => ({
      ...s,
      sourceFiles: s.sourceFiles.filter((f) => f.id !== id),
    }));
  }, []);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      ref={nodeRef}
      className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] flex flex-col overflow-hidden"
      style={{ height: "100%", width: "100%" }}
    >
      {/* ── Header / drag handle ── */}
      <div className="drag-handle flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] cursor-move select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <GripHorizontal className="w-5 h-5 text-[#94a3b8]" />
          <h2 className="text-lg font-bold text-[#111827]">
            Document Settings
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9] transition-colors"
          aria-label="Close settings"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ── LEFT COLUMN: Source Documents ── */}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-3">
                Source Documents
              </h3>

              {/* Drop zone */}
              <label
                className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl
                           border-2 border-dashed border-[#3B82F6] bg-[#F8FAFC]
                           cursor-pointer hover:bg-[#EFF6FF] transition-colors"
              >
                <Upload className="w-8 h-8 text-[#3B82F6]" />
                <span className="text-sm font-medium text-[#475569]">
                  Drop files here or click to upload
                </span>
                <span className="text-xs text-[#64748B]">
                  PDF, DOCX, TXT — max 25 MB each
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {/* File list */}
              {settings.sourceFiles.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {settings.sourceFiles.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white"
                    >
                      <FileText className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />
                      <span className="flex-1 text-sm text-[#111827] truncate">
                        {f.name}
                      </span>
                      <span className="text-xs text-[#64748B]">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        onClick={() => removeFile(f.id)}
                        className="p-1 rounded text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label={`Remove ${f.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Template + Formatting + AI ── */}
          <div className="space-y-6">
            {/* Document Template */}
            <div>
              <h3 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-3">
                Document Template
              </h3>
              <select
                value={settings.template}
                onChange={(e) => patch("template", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-[#111827]
                           focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] focus:outline-none transition-colors"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value} className="text-[#475569]">
                    {t.label}
                  </option>
                ))}
              </select>
              {settings.template === "" && (
                <p className="mt-1.5 text-sm text-[#475569]">
                  None (default) — no template applied
                </p>
              )}
            </div>

            {/* Formatting */}
            <div>
              <h3 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-3">
                Formatting
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Font Size
                  </label>
                  <select
                    value={settings.formatting.fontSize}
                    onChange={(e) => patchFormatting("fontSize", e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-gray-300 text-sm text-[#111827]
                               focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] focus:outline-none"
                  >
                    {FONT_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Line Spacing
                  </label>
                  <select
                    value={settings.formatting.lineSpacing}
                    onChange={(e) => patchFormatting("lineSpacing", e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-gray-300 text-sm text-[#111827]
                               focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] focus:outline-none"
                  >
                    {LINE_SPACINGS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Page Margins
                  </label>
                  <select
                    value={settings.formatting.pageMargins}
                    onChange={(e) => patchFormatting("pageMargins", e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-gray-300 text-sm text-[#111827]
                               focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] focus:outline-none"
                  >
                    {PAGE_MARGINS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* AI Settings */}
            <div>
              <h3 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-3">
                AI Settings
              </h3>

              {/* Confidence slider */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[#475569]">
                    AI Confidence Threshold
                  </label>
                  <span className="text-sm font-semibold text-[#2563EB]">
                    {Math.round(settings.aiConfidence * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(settings.aiConfidence * 100)}
                  onChange={(e) =>
                    patch("aiConfidence", Number(e.target.value) / 100)
                  }
                  className="w-full h-2 rounded-full appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2563EB]
                             [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                             [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #2563EB ${settings.aiConfidence * 100}%, #E2E8F0 ${settings.aiConfidence * 100}%)`,
                  }}
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.repositoryOnly}
                    onChange={(e) => patch("repositoryOnly", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span className="text-sm text-[#475569]">
                    Repository sources only
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeReferences}
                    onChange={(e) =>
                      patch("includeReferences", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span className="text-sm text-[#475569]">
                    Include references section
                  </span>
                </label>
              </div>

              {/* Citation style */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-[#475569] mb-2">
                  Citation Style
                </label>
                <div className="flex gap-3">
                  {(["apa", "mla", "chicago"] as const).map((style) => (
                    <label
                      key={style}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="citationStyle"
                        value={style}
                        checked={settings.citationStyle === style}
                        onChange={() => patch("citationStyle", style)}
                        className="w-4 h-4 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span className="text-sm text-[#475569] uppercase">
                        {style}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] flex-shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#475569] bg-[#F1F5F9]
                     hover:bg-[#E2E8F0] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-3 rounded-lg text-base font-semibold text-white bg-[#2563EB]
                     hover:bg-[#1D4ED8] shadow-sm hover:shadow-md transition-all duration-200
                     w-full sm:w-auto"
        >
          Save Settings
        </button>
      </div>
    </div>
  );

  /* ── Overlay + Draggable + Resizable wrapper ── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {isMobile ? (
        /* Mobile: full-width, no drag/resize */
        <div className="w-full max-w-[95vw] max-h-[90vh] mx-4">{modalContent}</div>
      ) : (
        /* Desktop: draggable + resizable */
        <Draggable
          key={dragKey}
          handle=".drag-handle"
          nodeRef={nodeRef as React.RefObject<HTMLElement>}
          bounds="parent"
        >
          <div ref={nodeRef} style={{ position: "absolute" }}>
            <Resizable
              defaultSize={{ width: 640, height: 720 }}
              minWidth={480}
              minHeight={520}
              maxWidth="90vw"
              maxHeight="90vh"
              enable={{
                top: false,
                right: true,
                bottom: true,
                left: false,
                topRight: false,
                bottomRight: true,
                bottomLeft: false,
                topLeft: false,
              }}
              style={{ display: "flex", flexDirection: "column" }}
            >
              {modalContent}
            </Resizable>
          </div>
        </Draggable>
      )}
    </div>
  );
}
