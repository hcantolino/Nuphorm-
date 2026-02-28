/**
 * ProjectContextPanel
 *
 * A right-side slide-in drawer for editing a project's AI context:
 *   - Instructions (textarea) — prepended to every AI query
 *   - Sources        (upload + list) — shared across all tabs
 *
 * Replaces the always-visible Row 2 in ChartHeader, keeping the main
 * header clean. Opened via "Edit Project Context" in the project dropdown
 * or by clicking the ⚙ icon button.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  BookOpen,
  FolderOpen,
  Paperclip,
  FileText,
  FileSpreadsheet,
  File,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useProjectStore, buildProjectSource, formatBytes } from '@/stores/projectStore';
import { useCurrentDatasetStore } from '@/stores/currentDatasetStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── File icon ─────────────────────────────────────────────────────────────────

function SourceFileIcon({ type }: { type: string }) {
  const ext = type?.toLowerCase();
  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls')
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
  if (ext === 'pdf')
    return <FileText className="w-4 h-4 text-rose-500 flex-shrink-0" />;
  return <File className="w-4 h-4 text-blue-500 flex-shrink-0" />;
}

// ── CSV parse helper (mirrors AIBiostatisticsChatTabIntegrated) ──────────────

function parseCSVRows(text: string): Array<Record<string, unknown>> {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const sep = tabCount > commaCount ? '\t' : ',';
  const headers = firstLine.split(sep).map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const v = values[i] ?? '';
      row[h] = v !== '' && !isNaN(Number(v)) ? Number(v) : v;
    });
    return row;
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProjectContextPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectContextPanel({
  open,
  onClose,
  projectId,
  projectName,
}: ProjectContextPanelProps) {
  const { getSettings, setInstructions, addSource, removeSource } = useProjectStore();
  const setCurrentDataset = useCurrentDatasetStore((s) => s.setCurrentDataset);

  // Local draft — avoids writing to the store on every keystroke
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settings = projectId ? getSettings(projectId) : { instructions: '', sources: [] };

  // Sync draft when panel opens or active project changes
  useEffect(() => {
    if (open && projectId) {
      setInstructionsDraft(getSettings(projectId).instructions);
    }
  }, [open, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on blur
  const handleInstructionsBlur = useCallback(() => {
    if (!projectId) return;
    setInstructions(projectId, instructionsDraft);
  }, [projectId, instructionsDraft, setInstructions]);

  // Source file upload
  const handleSourceUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length || !projectId) return;
      setIsUploading(true);
      try {
        for (const file of files) {
          const source = await buildProjectSource(file);
          addSource(projectId, source);

          // If it's a CSV/TSV, also load the full rows into currentDatasetStore so
          // the AI chat can immediately use it without the user needing to re-upload.
          const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
          if (['csv', 'tsv', 'txt'].includes(ext) && source.preview) {
            const rows = parseCSVRows(source.preview);
            if (rows.length > 0) {
              setCurrentDataset({
                filename: file.name,
                rowCount: rows.length,
                columns: Object.keys(rows[0] ?? {}),
                rows,
                cleaned: false,
              });
              toast.success(`Source added: ${file.name} (${rows.length.toLocaleString()} rows loaded)`);
            } else {
              toast.success(`Source added: ${file.name}`);
            }
          } else {
            toast.success(`Source added: ${file.name}`);
          }
        }
        setSourcesExpanded(true);
      } catch {
        toast.error('Failed to attach source');
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    },
    [projectId, addSource, setCurrentDataset]
  );

  if (!open) return null;

  const sourceCount = settings.sources.length;
  const hasInstructions = instructionsDraft.trim().length > 0;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Project Context Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Project Context</h2>
              {projectName && (
                <p className="text-xs text-gray-400 truncate max-w-[200px]">{projectName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── Instructions section ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                AI Instructions
              </span>
              {hasInstructions && (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-700 border-0 ml-auto"
                >
                  Active
                </Badge>
              )}
            </div>
            <textarea
              value={instructionsDraft}
              onChange={(e) => setInstructionsDraft(e.target.value)}
              onBlur={handleInstructionsBlur}
              placeholder={
                'Project-wide rules applied to every tab\'s AI…\n\nExamples:\n• Always use 95% confidence intervals\n• Report p-values to 4 decimal places\n• Use APA 7th edition formatting\n• Flag results that exceed regulatory thresholds'
              }
              rows={7}
              className="w-full text-sm resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent leading-relaxed transition-colors"
            />
            <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-green-400 inline-block" />
              Saved automatically · Prepended to every AI query in this project
            </p>
          </section>

          {/* Divider */}
          <div className="h-px bg-gray-100" />

          {/* ── Sources section ───────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Shared Sources
              </span>
              <span className="text-[10px] text-gray-400 normal-case">
                shared across all tabs
              </span>
              {sourceCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-700 border-0 ml-auto"
                >
                  {sourceCount} file{sourceCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !projectId}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl border-2 border-dashed font-medium transition-colors',
                'border-blue-200 text-blue-600 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-300',
                (isUploading || !projectId) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Paperclip className="w-4 h-4" />
              {isUploading ? 'Uploading…' : 'Attach Sources (CSV, XLSX, PDF)'}
            </button>

            <p className="text-[11px] text-gray-400 mt-1.5 mb-3">
              Uploaded files are included as context in every tab's AI queries for this project.
            </p>

            {/* File list */}
            {sourceCount > 0 && (
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                {/* List header / toggle */}
                <button
                  onClick={() => setSourcesExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-600">
                    Attached Files ({sourceCount})
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-gray-400 transition-transform',
                      sourcesExpanded && 'rotate-180'
                    )}
                  />
                </button>

                {sourcesExpanded && (
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                    {settings.sources.map((src) => (
                      <div
                        key={src.id}
                        className="group flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <SourceFileIcon type={src.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {src.name}
                          </p>
                          <p className="text-xs text-gray-400 tabular-nums">
                            {src.type.toUpperCase()} · {formatBytes(src.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => projectId && removeSource(projectId, src.id)}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Remove source"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sourceCount === 0 && (
              <div className="text-center py-6 text-gray-400">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No sources attached yet</p>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/60 flex-shrink-0">
          <p className="text-[11px] text-gray-400 text-center">
            Changes save automatically and apply to all open tabs
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.pdf,.txt,.tsv"
        className="hidden"
        onChange={handleSourceUpload}
      />
    </>
  );
}
