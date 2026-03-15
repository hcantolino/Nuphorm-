import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Settings,
  Upload,
  Search,
  X,
  FolderOpen,
  GripVertical,
  FileText,
  LayoutGrid,
  List,
  Check,
  Paperclip,
} from 'lucide-react';
import Draggable from 'react-draggable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import type { SourceFile } from '@/stores/regulatoryStore';

// Re-export so existing imports of SourceFile from this file keep working
export type { SourceFile };

/** Stable empty array — avoids `?? []` creating new refs on every render */
const EMPTY_SOURCES: SourceFile[] = [];

interface RegulatorySidebarProps {
  onProjectSelect?: (projectId: string) => void;
  /** Called whenever sources change — passes the current project's sources */
  onSourcesChange?: (sources: SourceFile[]) => void;
  /** Optionally control collapsed state from outside */
  isCollapsed?: boolean;
}

const STORAGE_KEY = 'reg-sidebar-collapsed';

// Pure Tailwind tooltip — rendered only when sidebar is collapsed
function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-[#0f172a] border border-[#1e293b] text-white text-xs rounded shadow-xl whitespace-nowrap z-50 hidden group-hover:block">
      {label}
    </span>
  );
}

// ── File Repository Dialog (inline) ──────────────────────────────────────────
interface FileRepoDialogProps {
  open: boolean;
  onClose: () => void;
  selectedIds: number[];
  onAttach: (ids: number[], names: string[]) => void;
}

function FileRepositoryDialog({ open, onClose, selectedIds, onAttach }: FileRepoDialogProps) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [localSelected, setLocalSelected] = useState<Set<number>>(new Set(selectedIds));

  const { data, isLoading } = trpc.files.list.useQuery(
    { limit: 100, page: 1 },
    { enabled: open }
  );
  const files = data?.data ?? [];

  const filtered = useMemo(
    () =>
      files.filter((f: any) =>
        f.name.toLowerCase().includes(search.toLowerCase())
      ),
    [files, search]
  );

  const toggleFile = (id: number) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAttach = () => {
    const ids = Array.from(localSelected);
    const names = files
      .filter((f: any) => localSelected.has(f.id))
      .map((f: any) => f.name);
    onAttach(ids, names);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto bg-white border border-[#e2e8f0] rounded-xl shadow-2xl w-[520px] max-h-[75vh] flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
            <h4 className="text-[#0f172a] font-semibold text-sm">Select Source Documents</h4>
            <button onClick={onClose} className="text-[#64748b] hover:text-[#0f172a] transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-3 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#9ca3af]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files..."
                className="pl-8 h-9 text-xs bg-white border-[#cbd5e1] text-[#0f172a] placeholder:text-[#9ca3af]"
              />
            </div>
            <div className="flex items-center gap-1 bg-[#f1f5f9] rounded-md p-0.5">
              <button
                onClick={() => setView('list')}
                className={`p-1.5 rounded ${view === 'list' ? 'bg-white text-[#3b82f6] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 rounded ${view === 'grid' ? 'bg-white text-[#3b82f6] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {isLoading ? (
              <div className="text-center text-[#64748b] text-sm py-8">Loading files…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-[#64748b] text-sm py-8">No files found</div>
            ) : view === 'list' ? (
              <div className="space-y-1">
                {filtered.map((file: any) => {
                  const isSelected = localSelected.has(file.id);
                  return (
                    <div
                      key={file.id}
                      onClick={() => toggleFile(file.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#eff6ff] border border-[#bfdbfe]'
                          : 'bg-[#f8fafc] hover:bg-[#eff6ff] border border-transparent'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition ${
                          isSelected ? 'bg-[#3b82f6] border-[#3b82f6]' : 'border-[#cbd5e1]'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-[#0f172a]" />}
                      </div>
                      <FileText className="w-4 h-4 text-[#3b82f6] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#0f172a] truncate">{file.name}</p>
                        <p className="text-xs text-[#64748b]">{file.size} · {file.uploadDate}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filtered.map((file: any) => {
                  const isSelected = localSelected.has(file.id);
                  return (
                    <div
                      key={file.id}
                      onClick={() => toggleFile(file.id)}
                      className={`p-3 rounded-lg cursor-pointer transition border ${
                        isSelected
                          ? 'bg-[#eff6ff] border-[#bfdbfe]'
                          : 'bg-[#f8fafc] border-transparent hover:border-[#e2e8f0]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <FileText className="w-5 h-5 text-[#3b82f6]" />
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-[#3b82f6] border-[#3b82f6]' : 'border-[#cbd5e1]'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-[#0f172a]" />}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-[#0f172a] truncate">{file.name}</p>
                      <p className="text-xs text-[#64748b] mt-0.5">{file.size}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-[#64748b]">
              {localSelected.size} file{localSelected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-[#64748b] hover:text-[#0f172a]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAttach}
                disabled={localSelected.size === 0}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                Attach Selected ({localSelected.size})
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RegulatorySidebar({
  onProjectSelect,
  onSourcesChange,
  isCollapsed: isCollapsedProp,
}: RegulatorySidebarProps) {
  // ── Collapsed state ────────────────────────────────────────────────────────
  const [collapsedInternal, setCollapsedInternal] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  // If the parent controls collapsed state, use that; otherwise use internal state
  const collapsed = isCollapsedProp !== undefined ? isCollapsedProp : collapsedInternal;

  const toggle = useCallback(() => {
    setCollapsedInternal((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  // ── Zustand store — projects, active selection, and per-project sources ──
  const storeProjects = useRegulatoryStore((s) => s.projects);
  const storeActiveId = useRegulatoryStore((s) => s.activeProjectId) ?? '1';
  const storeCreateProject = useRegulatoryStore((s) => s.createProject);
  const storeDeleteProject = useRegulatoryStore((s) => s.deleteProject);
  const storeSetActive = useRegulatoryStore((s) => s.setActiveProject);
  const getProjectSources = useRegulatoryStore((s) => s.getProjectSources);
  const setProjectSources = useRegulatoryStore((s) => s.setProjectSources);
  const updateProjectSource = useRegulatoryStore((s) => s.updateProjectSource);
  const removeProjectSource = useRegulatoryStore((s) => s.removeProjectSource);

  // Derive current sources from the store (re-renders automatically)
  const sources = useRegulatoryStore((s) => s.sourcesByProject[storeActiveId] ?? EMPTY_SOURCES);

  // ── Project state (backed by store, no local state needed) ────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [modalDragActive, setModalDragActive] = useState(false);

  // ── Settings dialog state ─────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [showFileRepo, setShowFileRepo] = useState(false);
  const [settings, setSettings] = useState({
    format: 'MLA',
    fontSize: '12',
    fontFamily: 'Arial',
    lineSpacing: '1.5',
    annotationStyle: 'MLA',
    saveOption: 'repository',
    sourceRestriction: 'repository-only',
    confidenceThreshold: 75,
    autoAnnotate: true,
  });
  const [sourceFileIds, setSourceFileIds] = useState<number[]>([]);
  const [sourceFileNames, setSourceFileNames] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');

  // ── tRPC ──────────────────────────────────────────────────────────────────
  const { data: templatesData, refetch: refetchTemplates } =
    trpc.regulatory.getTemplates.useQuery(undefined, { enabled: showSettings });
  const templates = templatesData ?? [];

  const uploadFileMutation = trpc.files.upload.useMutation();
  const uploadTemplateMutation = trpc.regulatory.uploadTemplate.useMutation({
    onSuccess: () => refetchTemplates(),
  });
  const deleteTemplateMutation = trpc.regulatory.deleteTemplate.useMutation({
    onSuccess: () => refetchTemplates(),
  });

  const templateInputRef = useRef<HTMLInputElement>(null);

  const handleTemplateUpload = useCallback(
    async (files: FileList) => {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        try {
          const result = await uploadFileMutation.mutateAsync({
            fileName: file.name,
            fileData: base64,
            mimeType: file.type,
            fileSizeBytes: file.size,
          });
          await uploadTemplateMutation.mutateAsync({
            name: file.name,
            fileKey: result.fileKey,
            fileUrl: result.fileUrl,
            mimeType: file.type,
            fileSizeBytes: file.size,
          });
        } catch {}
      };
      reader.readAsDataURL(file);
    },
    [uploadFileMutation, uploadTemplateMutation]
  );

  const filteredTemplates = useMemo(
    () =>
      templates.filter((t: any) =>
        t.name.toLowerCase().includes(templateSearch.toLowerCase())
      ),
    [templates, templateSearch]
  );

  // ── Source docs file upload (sidebar drop zone) ────────────────────────────
  const filteredProjects = useMemo(
    () =>
      storeProjects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [storeProjects, searchQuery]
  );

  const handleProjectSelect = useCallback(
    (projectId: string) => {
      storeSetActive(projectId);
      onProjectSelect?.(projectId);
      // Notify parent of this project's sources immediately
      onSourcesChange?.(getProjectSources(projectId));
    },
    [storeSetActive, onProjectSelect, onSourcesChange, getProjectSources]
  );

  const handleCreateProject = useCallback(() => {
    storeCreateProject(`Project ${storeProjects.length + 1}`, '');
  }, [storeCreateProject, storeProjects.length]);

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      storeDeleteProject(projectId);
    },
    [storeDeleteProject]
  );

  // Notify parent whenever the active project's sources change
  useEffect(() => {
    onSourcesChange?.(sources);
  }, [sources, onSourcesChange]);

  /** Read file text content client-side (CSV/TXT as text, others as truncated base64 summary) */
  const parseFileContent = useCallback(async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    // CSV and text files: read as text directly
    if (['csv', 'txt', 'tsv', 'json'].includes(ext)) {
      const text = await file.text();
      // Truncate to ~2000 chars for LLM context
      return text.length > 2000 ? text.slice(0, 2000) + '\n... [truncated]' : text;
    }
    // XLSX: read sheet as CSV text using the browser FileReader
    if (['xlsx', 'xls'].includes(ext)) {
      try {
        const arrayBuf = await file.arrayBuffer();
        // Dynamic import of xlsx if available, otherwise fall back
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuf, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(firstSheet);
        return csv.length > 2000 ? csv.slice(0, 2000) + '\n... [truncated]' : csv;
      } catch {
        return `[Excel file: ${file.name}, ${(file.size / 1024).toFixed(1)} KB — content extraction unavailable]`;
      }
    }
    // PDF and others: return metadata placeholder (full parsing requires server-side)
    return `[${ext.toUpperCase()} file: ${file.name}, ${(file.size / 1024).toFixed(1)} KB — upload to server for full content extraction]`;
  }, []);

  const handleFileUpload = useCallback(
    (files: FileList) => {
      const projectId = storeActiveId;
      const fileArray = Array.from(files);

      // Add new source entries immediately with 'uploading' status
      const newSources: SourceFile[] = fileArray.map((file) => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: file.name,
        type: (file.name.split('.').pop()?.toLowerCase() as 'csv' | 'pdf' | 'xlsx') || 'pdf',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'uploading' as const,
      }));

      setProjectSources(projectId, [...getProjectSources(projectId), ...newSources]);

      // Parse each file in the background and update the store
      fileArray.forEach(async (file, i) => {
        const sourceId = newSources[i].id;

        updateProjectSource(projectId, sourceId, { status: 'parsing' });

        try {
          const parsedContent = await parseFileContent(file);
          updateProjectSource(projectId, sourceId, { parsedContent, status: 'ready' });
        } catch {
          updateProjectSource(projectId, sourceId, { status: 'error' });
        }
      });
    },
    [storeActiveId, getProjectSources, setProjectSources, updateProjectSource, parseFileContent]
  );

  const handleModalDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleModalDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setModalDragActive(false);
      if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  const handleDeleteSource = useCallback(
    (sourceId: string) => {
      removeProjectSource(storeActiveId, sourceId);
    },
    [removeProjectSource, storeActiveId]
  );

  const handleSettingChange = useCallback((key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const draggableNodeRef = useRef<HTMLDivElement>(null);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`
          flex-shrink-0 bg-[#f8fafc] border-r border-[#e2e8f0] flex flex-col
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-64'}
        `}
      >
        {/* COLLAPSED: icon-only rows */}
        {collapsed && (
          <div className="flex flex-col">
            <div className="group relative border-b border-[#e2e8f0]">
              <button
                onClick={toggle}
                aria-label="Expand sidebar"
                className="flex items-center justify-center w-full h-11 hover:bg-[#e2e8f0] transition-colors"
              >
                <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </button>
              <Tooltip label="Projects  (Ctrl+B)" />
            </div>

            <div className="group relative border-b border-[#e2e8f0]">
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Document Settings"
                className="flex items-center justify-center w-full h-11 hover:bg-[#e2e8f0] transition-colors"
              >
                <Settings className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </button>
              <Tooltip label="Document Settings" />
            </div>

            <div className="group relative">
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Manage Sources"
                className="flex items-center justify-center w-full h-11 hover:bg-[#e2e8f0] transition-colors"
              >
                <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </button>
              <Tooltip label="Manage Sources" />
            </div>
          </div>
        )}

        {/* EXPANDED: full content */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            <button
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="w-full flex items-center gap-2 px-4 h-11 hover:bg-[#e2e8f0] transition-colors border-b border-[#e2e8f0] flex-shrink-0"
            >
              <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-[#475569] tracking-wide whitespace-nowrap flex-1">
                Regulatory
              </span>
              <ChevronLeft className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
            </button>

            {/* Projects section */}
            <div className="p-4 border-b border-[#e2e8f0] flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">
                  Projects
                </h3>
                <button
                  onClick={handleCreateProject}
                  className="p-1 hover:bg-[#e2e8f0] rounded transition flex-shrink-0"
                  title="New project"
                >
                  <Plus className="w-4 h-4 text-blue-400" />
                </button>
              </div>

              <div className="mb-3 relative">
                <Search className="w-4 h-4 absolute left-2 top-2.5 text-[#94a3b8]" />
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-[#f1f5f9] border-[#e2e8f0] text-[#0f172a] placeholder:text-[#94a3b8]"
                />
              </div>

              <div className="space-y-1 overflow-y-auto max-h-40">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleProjectSelect(project.id)}
                    className={`group/item p-2 rounded cursor-pointer transition flex items-center justify-between ${
                      storeActiveId === project.id
                        ? 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]'
                        : 'bg-white hover:bg-[#f1f5f9] text-[#475569] border border-transparent'
                    }`}
                  >
                    <span className="text-xs font-medium truncate flex-1">
                      {project.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="p-0.5 hover:bg-[#e2e8f0] rounded transition opacity-0 group-hover/item:opacity-100 flex-shrink-0 ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Settings button */}
            <div className="p-4 border-b border-[#e2e8f0] flex-shrink-0">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full flex items-center gap-2 p-2 bg-[#f1f5f9] hover:bg-[#dbeafe] rounded transition text-xs font-medium text-[#0f172a] whitespace-nowrap"
              >
                <Settings className="w-4 h-4 text-blue-400 flex-shrink-0" />
                Document Settings
              </button>
            </div>

            {/* Sources */}
            <div className="p-4 flex flex-col flex-1 min-h-0">
              <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex-shrink-0">
                Sources
              </h3>

              {/* Read-only source list */}
              <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0">
                {sources.length === 0 ? (
                  <p className="text-xs text-[#94a3b8] text-center py-4">
                    No sources attached.<br />Use "Manage Sources" to upload.
                  </p>
                ) : (
                  sources.map((source) => (
                    <div
                      key={source.id}
                      className="group/src px-2.5 py-2 bg-[#f1f5f9]/60 rounded-lg flex items-center gap-2 hover:bg-[#e2e8f0] transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate text-[#1e293b]">
                          {source.name}
                        </p>
                        <p className="text-[10px] text-[#94a3b8]">
                          {(source.size / 1024).toFixed(1)} KB ·{' '}
                          {source.status === 'uploading' && <span className="text-blue-400">Uploading…</span>}
                          {source.status === 'parsing' && <span className="text-amber-400">Parsing…</span>}
                          {source.status === 'ready' && <span className="text-emerald-400">Ready</span>}
                          {source.status === 'error' && <span className="text-red-400">Error</span>}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Manage Sources link */}
              <button
                onClick={() => setShowSettings(true)}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium flex-shrink-0 group/mgr"
                style={{ color: '#007bff' }}
              >
                <Upload className="w-3 h-3" />
                <span className="group-hover/mgr:underline">Manage Sources →</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── File Repository Dialog ─────────────────────────────────────────── */}
      <FileRepositoryDialog
        open={showFileRepo}
        onClose={() => setShowFileRepo(false)}
        selectedIds={sourceFileIds}
        onAttach={(ids, names) => {
          setSourceFileIds(ids);
          setSourceFileNames(names);
        }}
      />

      {/* ── Settings Dialog (large, centered) ────────────────────────────── */}
      {showSettings && (
        <>
          {/* Dim overlay */}
          <div
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => setShowSettings(false)}
          />

          {/* Centering container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div
              className="pointer-events-auto rounded-2xl shadow-2xl flex flex-col"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                width: '75vw',
                maxWidth: '960px',
                maxHeight: '85vh',
              }}
            >
                {/* Header */}
                <div
                  className="px-6 py-5 flex items-center justify-between rounded-t-2xl flex-shrink-0"
                  style={{ borderBottom: '1px solid #e2e8f0' }}
                >
                  <h3 className="font-bold text-[#0f172a] text-base tracking-tight">
                    Document Settings
                  </h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-[#64748b] hover:text-[#0f172a] transition p-1.5 rounded-lg hover:bg-[#f1f5f9]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable body — two-column layout */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0]">

                  {/* Left column: Source Documents */}
                  <div className="p-6 space-y-4">

                  {/* ── Source Documents ───────────────────────────────────── */}
                  <section>
                    <label className="text-xs font-semibold uppercase tracking-widest block mb-3" style={{ color: '#9ab0d0' }}>
                      Source Documents
                    </label>

                    {/* Repository button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFileRepo(true)}
                      className="w-full mb-4 text-xs font-medium"
                      style={{
                        background: 'transparent',
                        border: '1px solid #007bff',
                        color: '#007bff',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,123,255,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
                    >
                      <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                      {sourceFileIds.length > 0
                        ? `${sourceFileIds.length} file${sourceFileIds.length !== 1 ? 's' : ''} selected from repository`
                        : 'Select from Repository'}
                    </Button>

                    {/* Drag-and-drop upload zone */}
                    <label
                      htmlFor="modal-source-upload"
                      onDragEnter={handleModalDrag}
                      onDragLeave={handleModalDrag}
                      onDragOver={handleModalDrag}
                      onDrop={handleModalDrop}
                      className="flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all"
                      style={{
                        border: `2px dashed ${modalDragActive ? '#00cc99' : '#007bff'}`,
                        background: modalDragActive ? 'rgba(0,204,153,0.07)' : 'rgba(0,123,255,0.05)',
                        minHeight: '180px',
                        padding: '28px 20px',
                      }}
                    >
                      <Upload
                        className="w-8 h-8 mb-3"
                        style={{ color: modalDragActive ? '#00cc99' : '#007bff' }}
                      />
                      <p className="text-sm font-medium text-[#0f172a] mb-1">
                        Drag files here or click to upload
                      </p>
                      <p className="text-xs text-center" style={{ color: '#9ab0d0' }}>
                        CSV, PDF, XLSX · up to 100 MB<br />
                        Clinical data, test reports, device specs
                      </p>
                      <input
                        id="modal-source-upload"
                        type="file"
                        multiple
                        accept=".csv,.pdf,.xlsx,.docx"
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                        className="hidden"
                      />
                    </label>

                    {/* Uploaded source file list */}
                    {sources.length > 0 && (
                      <div
                        className="mt-4 rounded-xl overflow-hidden"
                        style={{ border: '1px solid #e2e8f0' }}
                      >
                        {sources.map((source, idx) => (
                          <div
                            key={source.id}
                            className="flex items-center gap-3 px-4 py-3 group/srow transition"
                            style={{
                              background: idx % 2 === 0 ? '#f8fafc' : 'transparent',
                              borderBottom: idx < sources.length - 1 ? '1px solid #f1f5f9' : 'none',
                            }}
                          >
                            <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '#007bff' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate text-[#0f172a]">{source.name}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: '#9ab0d0' }}>
                                {(source.size / 1024).toFixed(1)} KB ·{' '}
                                {new Date(source.uploadedAt).toLocaleDateString()} ·{' '}
                                {source.status === 'uploading' && <span className="text-blue-400">Uploading…</span>}
                                {source.status === 'parsing' && <span className="text-amber-400">Parsing…</span>}
                                {source.status === 'ready' && <span style={{ color: '#00cc99' }}>Ready</span>}
                                {source.status === 'error' && <span className="text-red-400">Error</span>}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteSource(source.id)}
                              className="flex-shrink-0 p-1 rounded transition opacity-0 group-hover/srow:opacity-100"
                              style={{ color: '#9ab0d0' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#9ab0d0'; }}
                              title="Remove source"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  </div>

                  {/* Right column: all other settings */}
                  <div className="p-6 space-y-5">

                  {/* ── Document Template ──────────────────────────────────── */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9ab0d0' }}>
                        Document Template
                      </label>
                      <button
                        onClick={() => templateInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                        disabled={uploadFileMutation.isPending || uploadTemplateMutation.isPending}
                      >
                        <Upload className="w-3 h-3" />
                        {uploadFileMutation.isPending || uploadTemplateMutation.isPending
                          ? 'Uploading…'
                          : 'Upload Template'}
                      </button>
                      <input
                        ref={templateInputRef}
                        type="file"
                        accept=".pdf,.docx,.md"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files && handleTemplateUpload(e.target.files)
                        }
                      />
                    </div>

                    {/* Template search */}
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: '#4a6480' }} />
                      <Input
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        placeholder="Search templates..."
                        className="pl-8 h-8 text-xs"
                        style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a' }}
                      />
                    </div>

                    {/* Template list */}
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      <div
                        onClick={() => setSelectedTemplateId(null)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-xs"
                        style={{
                          background: selectedTemplateId === null ? '#eff6ff' : '#f8fafc',
                          border: selectedTemplateId === null ? '1px solid rgba(0,123,255,0.35)' : '1px solid transparent',
                          color: selectedTemplateId === null ? '#fff' : '#9ab0d0',
                        }}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                          style={{
                            borderColor: selectedTemplateId === null ? '#007bff' : '#cbd5e1',
                            background: selectedTemplateId === null ? '#007bff' : 'transparent',
                          }}
                        />
                        None (default)
                      </div>

                      {filteredTemplates.length === 0 && templateSearch === '' && (
                        <p className="text-xs text-center py-2" style={{ color: '#4a6480' }}>
                          No templates yet — upload one above
                        </p>
                      )}

                      {filteredTemplates.map((template: any) => (
                        <div
                          key={template.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-xs group/tmpl"
                          style={{
                            background: selectedTemplateId === template.id ? '#eff6ff' : '#f8fafc',
                            border: selectedTemplateId === template.id ? '1px solid rgba(0,123,255,0.35)' : '1px solid transparent',
                            color: selectedTemplateId === template.id ? '#fff' : '#9ab0d0',
                          }}
                          onClick={() => setSelectedTemplateId(template.id)}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                            style={{
                              borderColor: selectedTemplateId === template.id ? '#007bff' : '#cbd5e1',
                              background: selectedTemplateId === template.id ? '#007bff' : 'transparent',
                            }}
                          />
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#007bff' }} />
                          <span className="flex-1 truncate">{template.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplateMutation.mutate({ templateId: template.id });
                              if (selectedTemplateId === template.id) setSelectedTemplateId(null);
                            }}
                            className="opacity-0 group-hover/tmpl:opacity-100 transition p-0.5 hover:text-red-400"
                            style={{ color: '#9ab0d0' }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* ── Formatting ─────────────────────────────────────────── */}
                  <section className="space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-widest block" style={{ color: '#9ab0d0' }}>
                      Formatting
                    </label>

                    {[
                      { label: 'Citation Format', key: 'format', options: ['MLA', 'APA', 'Chicago'] },
                    ].map(({ label, key, options }) => (
                      <div key={key}>
                        <label className="text-xs block mb-1" style={{ color: '#9ab0d0' }}>{label}</label>
                        <select
                          value={(settings as any)[key]}
                          onChange={(e) => handleSettingChange(key, e.target.value)}
                          className="w-full rounded px-2 py-1.5 text-sm text-[#0f172a]"
                          style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}
                        >
                          {options.map((o) => <option key={o} style={{ background: '#ffffff' }}>{o}</option>)}
                        </select>
                      </div>
                    ))}

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Font Size', key: 'fontSize', options: ['10', '11', '12', '13', '14'].map(s => `${s}pt`) },
                        { label: 'Font Family', key: 'fontFamily', options: ['Arial', 'Times New Roman', 'Calibri'] },
                      ].map(({ label, key, options }) => (
                        <div key={key}>
                          <label className="text-xs block mb-1" style={{ color: '#9ab0d0' }}>{label}</label>
                          <select
                            value={(settings as any)[key]}
                            onChange={(e) => handleSettingChange(key, e.target.value)}
                            className="w-full rounded px-2 py-1.5 text-sm text-[#0f172a]"
                            style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}
                          >
                            {options.map((o) => <option key={o} style={{ background: '#ffffff' }}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>

                    {[
                      { label: 'Line Spacing', key: 'lineSpacing', options: [{ v: '1', l: 'Single' }, { v: '1.5', l: '1.5' }, { v: '2', l: 'Double' }] },
                      { label: 'Annotation Style', key: 'annotationStyle', options: [{ v: 'MLA', l: 'MLA' }, { v: 'APA', l: 'APA' }, { v: 'Chicago', l: 'Chicago' }, { v: 'Custom', l: 'Custom' }] },
                    ].map(({ label, key, options }) => (
                      <div key={key}>
                        <label className="text-xs block mb-1" style={{ color: '#9ab0d0' }}>{label}</label>
                        <select
                          value={(settings as any)[key]}
                          onChange={(e) => handleSettingChange(key, e.target.value)}
                          className="w-full rounded px-2 py-1.5 text-sm text-[#0f172a]"
                          style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}
                        >
                          {options.map((o) => <option key={o.v} value={o.v} style={{ background: '#ffffff' }}>{o.l}</option>)}
                        </select>
                      </div>
                    ))}
                  </section>

                  {/* ── AI Settings ───────────────────────────────────────── */}
                  <section className="space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-widest block" style={{ color: '#9ab0d0' }}>
                      AI Settings
                    </label>

                    <div>
                      <label className="text-xs block mb-1" style={{ color: '#9ab0d0' }}>Source Restriction</label>
                      <select
                        value={settings.sourceRestriction}
                        onChange={(e) => handleSettingChange('sourceRestriction', e.target.value)}
                        className="w-full rounded px-2 py-1.5 text-sm text-[#0f172a]"
                        style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}
                      >
                        <option value="repository-only" style={{ background: '#ffffff' }}>Repository Only</option>
                        <option value="repository-plus" style={{ background: '#ffffff' }}>Repository + Scientific Literature</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs block mb-1" style={{ color: '#9ab0d0' }}>
                        AI Confidence Threshold: <span className="text-[#0f172a] font-medium">{settings.confidenceThreshold}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.confidenceThreshold}
                        onChange={(e) => handleSettingChange('confidenceThreshold', parseInt(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="auto-annotate"
                        checked={settings.autoAnnotate}
                        onChange={(e) => handleSettingChange('autoAnnotate', e.target.checked)}
                        className="rounded accent-blue-500"
                      />
                      <label htmlFor="auto-annotate" className="text-xs cursor-pointer" style={{ color: '#9ab0d0' }}>
                        Auto-Annotate References
                      </label>
                    </div>
                  </section>
                  </div>{/* end right column */}
                  </div>{/* end two-column grid */}
                </div>{/* end scrollable body */}

                {/* Footer */}
                <div
                  className="px-6 py-4 flex-shrink-0 rounded-b-2xl"
                  style={{ borderTop: '1px solid #e2e8f0' }}
                >
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-[#0f172a] transition-colors"
                    style={{ background: '#007bff' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#3399ff'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#007bff'; }}
                  >
                    Save Settings
                  </button>
                </div>
              </div>
          </div>
        </>
      )}
    </>
  );
}
