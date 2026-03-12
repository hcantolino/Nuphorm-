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

interface RegulatoryProject {
  id: string;
  name: string;
  createdAt: Date;
}

export interface SourceFile {
  id: string;
  name: string;
  type: 'csv' | 'pdf' | 'xlsx';
  size: number;
  uploadedAt: Date;
  /** Parsed text content — available once client-side parsing completes */
  parsedContent?: string;
  /** 'uploading' → 'parsing' → 'ready' → 'error' */
  status: 'uploading' | 'parsing' | 'ready' | 'error';
}

interface RegulatorySidebarProps {
  onProjectSelect?: (projectId: string) => void;
  onSourcesChange?: (sources: SourceFile[]) => void;
  /** Optionally control collapsed state from outside */
  isCollapsed?: boolean;
}

const STORAGE_KEY = 'reg-sidebar-collapsed';

// Pure Tailwind tooltip — rendered only when sidebar is collapsed
function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-gray-950 border border-gray-700 text-white text-xs rounded shadow-xl whitespace-nowrap z-50 hidden group-hover:block">
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
        <div className="pointer-events-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[520px] max-h-[75vh] flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
            <h4 className="text-white font-semibold text-sm">Select Source Documents</h4>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files..."
                className="pl-8 h-9 text-xs bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-800 rounded-md p-0.5">
              <button
                onClick={() => setView('list')}
                className={`p-1.5 rounded ${view === 'list' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 rounded ${view === 'grid' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {isLoading ? (
              <div className="text-center text-gray-500 text-sm py-8">Loading files…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">No files found</div>
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
                          ? 'bg-blue-600/20 border border-blue-500/40'
                          : 'bg-gray-800 hover:bg-gray-750 border border-transparent'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{file.size} · {file.uploadDate}</p>
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
                          ? 'bg-blue-600/20 border-blue-500/40'
                          : 'bg-gray-800 border-transparent hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-600'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{file.size}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-gray-500">
              {localSelected.size} file{localSelected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAttach}
                disabled={localSelected.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
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

  // ── Project state ──────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<RegulatoryProject[]>([
    { id: '1', name: '510k Submission', createdAt: new Date() },
    { id: '2', name: 'PMA Application', createdAt: new Date() },
  ]);
  const [selectedProject, setSelectedProject] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

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
      projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [projects, searchQuery]
  );

  const handleProjectSelect = useCallback(
    (projectId: string) => {
      setSelectedProject(projectId);
      onProjectSelect?.(projectId);
    },
    [onProjectSelect]
  );

  const handleCreateProject = useCallback(() => {
    const newProject: RegulatoryProject = {
      id: Date.now().toString(),
      name: `Project ${projects.length + 1}`,
      createdAt: new Date(),
    };
    setProjects((prev) => [...prev, newProject]);
  }, [projects.length]);

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== projectId);
        if (selectedProject === projectId && remaining.length > 0) {
          handleProjectSelect(remaining[0].id);
        }
        return remaining;
      });
    },
    [selectedProject, handleProjectSelect]
  );

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
      const fileArray = Array.from(files);
      // Create source entries immediately with 'uploading' status
      const newSources: SourceFile[] = fileArray.map((file) => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: file.name,
        type:
          (file.name.split('.').pop()?.toLowerCase() as 'csv' | 'pdf' | 'xlsx') ||
          'pdf',
        size: file.size,
        uploadedAt: new Date(),
        status: 'uploading' as const,
      }));

      setSources((prev) => {
        const updated = [...prev, ...newSources];
        onSourcesChange?.(updated);
        return updated;
      });

      // Auto-parse each file in background
      fileArray.forEach(async (file, i) => {
        const sourceId = newSources[i].id;

        // Mark as parsing
        setSources((prev) => {
          const updated = prev.map((s) =>
            s.id === sourceId ? { ...s, status: 'parsing' as const } : s
          );
          onSourcesChange?.(updated);
          return updated;
        });

        try {
          const parsedContent = await parseFileContent(file);
          setSources((prev) => {
            const updated = prev.map((s) =>
              s.id === sourceId
                ? { ...s, parsedContent, status: 'ready' as const }
                : s
            );
            onSourcesChange?.(updated);
            return updated;
          });
        } catch {
          setSources((prev) => {
            const updated = prev.map((s) =>
              s.id === sourceId ? { ...s, status: 'error' as const } : s
            );
            onSourcesChange?.(updated);
            return updated;
          });
        }
      });
    },
    [onSourcesChange, parseFileContent]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  const handleDeleteSource = useCallback(
    (sourceId: string) => {
      setSources((prev) => {
        const updated = prev.filter((s) => s.id !== sourceId);
        onSourcesChange?.(updated);
        return updated;
      });
    },
    [onSourcesChange]
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
          flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-64'}
        `}
      >
        {/* COLLAPSED: icon-only rows */}
        {collapsed && (
          <div className="flex flex-col">
            <div className="group relative border-b border-gray-800">
              <button
                onClick={toggle}
                aria-label="Expand sidebar"
                className="flex items-center justify-center w-full h-11 hover:bg-gray-800 transition-colors"
              >
                <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </button>
              <Tooltip label="Projects  (Ctrl+B)" />
            </div>

            <div className="group relative border-b border-gray-800">
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Document Settings"
                className="flex items-center justify-center w-full h-11 hover:bg-gray-800 transition-colors"
              >
                <Settings className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </button>
              <Tooltip label="Document Settings" />
            </div>

            <div className="group relative">
              <label
                htmlFor="source-upload-collapsed"
                className="flex items-center justify-center w-full h-11 hover:bg-gray-800 transition-colors cursor-pointer"
                aria-label="Upload sources"
              >
                <Upload className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <input
                  id="source-upload-collapsed"
                  type="file"
                  multiple
                  accept=".csv,.pdf,.xlsx"
                  onChange={(e) =>
                    e.target.files && handleFileUpload(e.target.files)
                  }
                  className="hidden"
                />
              </label>
              <Tooltip label="Sources" />
            </div>
          </div>
        )}

        {/* EXPANDED: full content */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            <button
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="w-full flex items-center gap-2 px-4 h-11 hover:bg-gray-800 transition-colors border-b border-gray-800 flex-shrink-0"
            >
              <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-300 tracking-wide whitespace-nowrap flex-1">
                Regulatory
              </span>
              <ChevronLeft className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </button>

            {/* Projects section */}
            <div className="p-4 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Projects
                </h3>
                <button
                  onClick={handleCreateProject}
                  className="p-1 hover:bg-gray-800 rounded transition flex-shrink-0"
                  title="New project"
                >
                  <Plus className="w-4 h-4 text-blue-400" />
                </button>
              </div>

              <div className="mb-3 relative">
                <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-1 overflow-y-auto max-h-40">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleProjectSelect(project.id)}
                    className={`group/item p-2 rounded cursor-pointer transition flex items-center justify-between ${
                      selectedProject === project.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
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
                      className="p-0.5 hover:bg-gray-600 rounded transition opacity-0 group-hover/item:opacity-100 flex-shrink-0 ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Settings button */}
            <div className="p-4 border-b border-gray-800 flex-shrink-0">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full flex items-center gap-2 p-2 bg-gray-800 hover:bg-gray-700 rounded transition text-xs font-medium text-white whitespace-nowrap"
              >
                <Settings className="w-4 h-4 text-blue-400 flex-shrink-0" />
                Document Settings
              </button>
            </div>

            {/* Sources */}
            <div className="p-4 flex flex-col flex-1 min-h-0">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex-shrink-0">
                Sources
              </h3>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition flex-shrink-0 ${
                  dragActive
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Upload className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-400">
                  Drag files or{' '}
                  <label
                    htmlFor="source-upload"
                    className="text-blue-400 cursor-pointer"
                  >
                    click
                  </label>
                </p>
                <input
                  type="file"
                  multiple
                  accept=".csv,.pdf,.xlsx"
                  onChange={(e) =>
                    e.target.files && handleFileUpload(e.target.files)
                  }
                  className="hidden"
                  id="source-upload"
                />
              </div>

              <div className="mt-3 space-y-2 overflow-y-auto flex-1 min-h-0">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="group/src p-2 bg-gray-800 rounded flex items-center justify-between hover:bg-gray-700 transition flex-shrink-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-white">
                        {source.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-gray-500">
                          {(source.size / 1024).toFixed(1)} KB
                        </p>
                        {source.status === 'uploading' && (
                          <span className="text-[10px] text-blue-400">Uploading...</span>
                        )}
                        {source.status === 'parsing' && (
                          <span className="text-[10px] text-amber-400">Parsing...</span>
                        )}
                        {source.status === 'ready' && (
                          <span className="text-[10px] text-emerald-400">Ready</span>
                        )}
                        {source.status === 'error' && (
                          <span className="text-[10px] text-red-400">Error</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSource(source.id)}
                      className="p-0.5 hover:bg-red-600 rounded transition opacity-0 group-hover/src:opacity-100 flex-shrink-0"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
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

      {/* ── Draggable Settings Dialog ──────────────────────────────────────── */}
      {showSettings && (
        <>
          {/* Dim overlay — click outside to close */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowSettings(false)}
          />

          {/* Centering container — pointer-events-none so overlay clicks reach backdrop */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <Draggable
              nodeRef={draggableNodeRef}
              handle=".drag-handle"
              cancel="button,input,select,label,textarea"
            >
              <div
                ref={draggableNodeRef}
                className="pointer-events-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[500px] max-h-[85vh] flex flex-col"
              >
                {/* Drag handle / header */}
                <div className="drag-handle cursor-move px-5 py-4 border-b border-gray-800 flex items-center justify-between rounded-t-xl flex-shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-white text-sm">
                      Document Settings
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-white transition p-0.5 rounded hover:bg-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">

                  {/* ── Source Documents ───────────────────────────────────── */}
                  <section>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                      Source Documents
                    </label>
                    {/* Selected chips */}
                    {sourceFileNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {sourceFileNames.map((name, i) => (
                          <Badge
                            key={sourceFileIds[i]}
                            variant="secondary"
                            className="flex items-center gap-1 bg-gray-800 text-gray-200 text-xs"
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            <span className="max-w-[120px] truncate">{name}</span>
                            <button
                              onClick={() => {
                                setSourceFileIds((prev) =>
                                  prev.filter((_, idx) => idx !== i)
                                );
                                setSourceFileNames((prev) =>
                                  prev.filter((_, idx) => idx !== i)
                                );
                              }}
                              className="ml-0.5 hover:text-red-400 transition"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFileRepo(true)}
                      className="w-full border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white text-xs"
                    >
                      <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                      {sourceFileIds.length > 0
                        ? `${sourceFileIds.length} file${sourceFileIds.length !== 1 ? 's' : ''} selected — change`
                        : 'Select from Repository'}
                    </Button>
                  </section>

                  {/* ── Document Template ──────────────────────────────────── */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
                      <Input
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        placeholder="Search templates..."
                        className="pl-8 h-8 text-xs bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                    </div>

                    {/* Template list */}
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {/* "None" option */}
                      <div
                        onClick={() => setSelectedTemplateId(null)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-xs ${
                          selectedTemplateId === null
                            ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-750 border border-transparent'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                            selectedTemplateId === null
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-600'
                          }`}
                        />
                        None (default)
                      </div>

                      {filteredTemplates.length === 0 && templateSearch === '' && (
                        <p className="text-xs text-gray-600 text-center py-2">
                          No templates yet — upload one above
                        </p>
                      )}

                      {filteredTemplates.map((template: any) => (
                        <div
                          key={template.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-xs group/tmpl ${
                            selectedTemplateId === template.id
                              ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-750 border border-transparent'
                          }`}
                          onClick={() => setSelectedTemplateId(template.id)}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                              selectedTemplateId === template.id
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-600'
                            }`}
                          />
                          <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="flex-1 truncate">{template.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplateMutation.mutate({
                                templateId: template.id,
                              });
                              if (selectedTemplateId === template.id)
                                setSelectedTemplateId(null);
                            }}
                            className="opacity-0 group-hover/tmpl:opacity-100 hover:text-red-400 transition p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* ── Formatting ─────────────────────────────────────────── */}
                  <section className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                      Formatting
                    </label>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        Citation Format
                      </label>
                      <select
                        value={settings.format}
                        onChange={(e) =>
                          handleSettingChange('format', e.target.value)
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                      >
                        <option>MLA</option>
                        <option>APA</option>
                        <option>Chicago</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Font Size
                        </label>
                        <select
                          value={settings.fontSize}
                          onChange={(e) =>
                            handleSettingChange('fontSize', e.target.value)
                          }
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                        >
                          {['10', '11', '12', '13', '14'].map((size) => (
                            <option key={size}>{size}pt</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Font Family
                        </label>
                        <select
                          value={settings.fontFamily}
                          onChange={(e) =>
                            handleSettingChange('fontFamily', e.target.value)
                          }
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                        >
                          <option>Arial</option>
                          <option>Times New Roman</option>
                          <option>Calibri</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        Line Spacing
                      </label>
                      <select
                        value={settings.lineSpacing}
                        onChange={(e) =>
                          handleSettingChange('lineSpacing', e.target.value)
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                      >
                        <option value="1">Single</option>
                        <option value="1.5">1.5</option>
                        <option value="2">Double</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        Annotation Style
                      </label>
                      <select
                        value={settings.annotationStyle}
                        onChange={(e) =>
                          handleSettingChange('annotationStyle', e.target.value)
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                      >
                        <option>MLA</option>
                        <option>APA</option>
                        <option>Chicago</option>
                        <option>Custom</option>
                      </select>
                    </div>
                  </section>

                  {/* ── AI Settings ───────────────────────────────────────── */}
                  <section className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                      AI Settings
                    </label>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        Source Restriction
                      </label>
                      <select
                        value={settings.sourceRestriction}
                        onChange={(e) =>
                          handleSettingChange('sourceRestriction', e.target.value)
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                      >
                        <option value="repository-only">Repository Only</option>
                        <option value="repository-plus">
                          Repository + Scientific Literature
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        AI Confidence Threshold: {settings.confidenceThreshold}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.confidenceThreshold}
                        onChange={(e) =>
                          handleSettingChange(
                            'confidenceThreshold',
                            parseInt(e.target.value)
                          )
                        }
                        className="w-full accent-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="auto-annotate"
                        checked={settings.autoAnnotate}
                        onChange={(e) =>
                          handleSettingChange('autoAnnotate', e.target.checked)
                        }
                        className="rounded accent-blue-500"
                      />
                      <label
                        htmlFor="auto-annotate"
                        className="text-xs text-gray-400 cursor-pointer"
                      >
                        Auto-Annotate References
                      </label>
                    </div>
                  </section>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-800 flex-shrink-0">
                  <Button
                    onClick={() => setShowSettings(false)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Save Settings
                  </Button>
                </div>
              </div>
            </Draggable>
          </div>
        </>
      )}
    </>
  );
}
