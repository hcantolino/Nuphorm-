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
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
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

// ── Demo pre-loaded sources (locked for demo) ───────────────────────────────
const DEMO_REGULATORY_SOURCES = [
  {
    id: 'demo-reg-1',
    shortTitle: 'InsuFlow Pro 510(k) Support Package',
    title: 'Source 1_ Fake Regulatory Source Package – InsuFlow Pro Insulin Pump 510(k) Support Files.pdf',
  },
  {
    id: 'demo-reg-2',
    shortTitle: 'Bench Testing & Non-Clinical Report',
    title: 'Source 2_ Bench Testing and Non-Clinical Performance Report.pdf',
  },
  {
    id: 'demo-reg-3',
    shortTitle: 'Predicate Comparison & Equivalence',
    title: 'Source 3_ Predicate Device Comparison Table & Substantial Equivalence.pdf',
  },
];

/** Show a demo-lock toast when the user tries to upload */
function showDemoUploadToast() {
  toast.custom(
    (id) => (
      <div
        onClick={() => toast.dismiss(id)}
        style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          maxWidth: 420,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}
      >
        <Info style={{ width: 16, height: 16, color: '#d97706', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: '#92400e', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
            Demo sources only — This demo includes 3 pre-loaded source documents. Sign up for a full account to upload your own files.
          </p>
          <a
            href="/signup"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12, color: '#2b7de9', fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}
          >
            Sign up →
          </a>
        </div>
      </div>
    ),
    { duration: 5000, position: 'top-center' }
  );
}

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
  const storeUpdateProjectName = useRegulatoryStore((s) => s.updateProjectName);
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

  // ── Inline project rename state ─────────────────────────────────────────
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Context menu state ──────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ projectId: string; x: number; y: number } | null>(null);

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
    storeCreateProject('Untitled Project', '');
    // The store sets the new project as active and returns void.
    // We need the new project's id to enter edit mode — it's Date.now().toString().
    // Grab it after the store update on next tick.
    setTimeout(() => {
      const latest = useRegulatoryStore.getState().projects;
      const newest = latest[latest.length - 1];
      if (newest) {
        setEditingProjectId(newest.id);
        setEditDraft(newest.name);
      }
    }, 0);
  }, [storeCreateProject]);

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      storeDeleteProject(projectId);
      if (editingProjectId === projectId) setEditingProjectId(null);
    },
    [storeDeleteProject, editingProjectId]
  );

  const startRename = useCallback((projectId: string, currentName: string) => {
    setEditingProjectId(projectId);
    setEditDraft(currentName);
  }, []);

  const commitRename = useCallback(() => {
    if (!editingProjectId) return;
    const trimmed = editDraft.trim();
    if (trimmed) {
      storeUpdateProjectName(editingProjectId, trimmed);
      toast.success('Renamed', { duration: 1500 });
    }
    setEditingProjectId(null);
  }, [editingProjectId, editDraft, storeUpdateProjectName]);

  const cancelRename = useCallback(() => {
    setEditingProjectId(null);
  }, []);

  const handleDuplicateProject = useCallback((projectId: string) => {
    const project = storeProjects.find((p) => p.id === projectId);
    if (!project) return;
    storeCreateProject(`Copy of ${project.name}`, project.description);
    toast.success(`Duplicated "${project.name}"`, { duration: 2000 });
  }, [storeProjects, storeCreateProject]);

  // Auto-focus the rename input when entering edit mode
  useEffect(() => {
    if (editingProjectId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingProjectId]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = () => setCtxMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [ctxMenu]);

  // Notify parent whenever the active project's sources change
  // Note: onSourcesChange intentionally excluded from deps to prevent infinite loops
  // (parent memoizes it with useCallback, but this is a safety guard)
  const onSourcesChangeRef = useRef(onSourcesChange);
  onSourcesChangeRef.current = onSourcesChange;
  useEffect(() => {
    onSourcesChangeRef.current?.(sources);
  }, [sources]);

  /** Read file text content client-side (CSV/TXT as text, others as truncated base64 summary) */
  const parseFileContent = useCallback(async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    // CSV and text files: read as text directly
    if (['csv', 'txt', 'tsv', 'json'].includes(ext)) {
      // Binary guard: catch mislabeled files (e.g. xlsx saved as .csv)
      const probe = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if ((probe[0] === 0x50 && probe[1] === 0x4B) || (probe[0] === 0xD0 && probe[1] === 0xCF)) {
        return '[Binary file detected — cannot read as text. Please re-save as CSV.]';
      }
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
    (_files: FileList) => {
      // Demo mode: block all uploads
      showDemoUploadToast();
    },
    []
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

            {/* Manage Sources tab removed for demo */}
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

              <div className="space-y-1 overflow-y-auto max-h-40 relative">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => {
                      if (editingProjectId !== project.id) handleProjectSelect(project.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename(project.id, project.name);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenu({ projectId: project.id, x: e.clientX, y: e.clientY });
                    }}
                    className={`group/item p-2 rounded cursor-pointer transition flex items-center justify-between ${
                      storeActiveId === project.id
                        ? 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]'
                        : 'bg-white hover:bg-[#f1f5f9] text-[#475569] border border-transparent'
                    }`}
                  >
                    {editingProjectId === project.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                          if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                        }}
                        onBlur={commitRename}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium flex-1 bg-[#f8fafc] border border-[#3b82f6] rounded px-2 py-1 outline-none text-[#0f172a]"
                        style={{ minWidth: 0 }}
                      />
                    ) : (
                      <span className="text-xs font-medium truncate flex-1">
                        {project.name}
                      </span>
                    )}
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

                {/* Right-click context menu */}
                {ctxMenu && (
                  <div
                    className="fixed z-50 bg-white rounded-lg shadow-lg border border-[#e2e8f0] py-1 min-w-[160px]"
                    style={{
                      left: ctxMenu.x,
                      top: ctxMenu.y,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full text-left px-4 py-2 text-xs text-[#0f172a] hover:bg-[#f0f4f8] transition"
                      onClick={() => {
                        const p = storeProjects.find((pr) => pr.id === ctxMenu.projectId);
                        if (p) startRename(p.id, p.name);
                        setCtxMenu(null);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-xs text-[#0f172a] hover:bg-[#f0f4f8] transition"
                      onClick={() => {
                        handleDuplicateProject(ctxMenu.projectId);
                        setCtxMenu(null);
                      }}
                    >
                      Duplicate
                    </button>
                    <div className="border-t border-[#e2e8f0] my-1" />
                    <button
                      className="w-full text-left px-4 py-2 text-xs text-[#ef4444] hover:bg-[#fef2f2] transition"
                      onClick={() => {
                        const p = storeProjects.find((pr) => pr.id === ctxMenu.projectId);
                        if (p && confirm(`Delete "${p.name}"? This will not delete the documents inside.`)) {
                          handleDeleteProject(p.id);
                        }
                        setCtxMenu(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
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

            {/* Sources — read-only demo list */}
            <div className="p-4 flex flex-col flex-1 min-h-0">
              <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex-shrink-0">
                Sources (3)
              </h3>

              <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0">
                {DEMO_REGULATORY_SOURCES.map((src) => (
                  <div
                    key={src.id}
                    className="px-2.5 py-2 bg-[#f1f5f9]/60 rounded-lg flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <p className="text-xs font-medium truncate text-[#1e293b] flex-1" title={src.title}>
                      {src.shortTitle}
                    </p>
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  </div>
                ))}
              </div>

              <p className="text-[11px] mt-2 flex-shrink-0" style={{ color: '#a0afc0' }}>
                Demo: 3 pre-loaded sources
              </p>
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

                  {/* Left column: Attached Sources (read-only demo) + disabled upload */}
                  <div className="p-6 space-y-4">

                  {/* ── Attached Sources (read-only) ─────────────────────── */}
                  <section>
                    <label className="text-xs font-semibold uppercase tracking-widest block mb-3" style={{ color: '#9ab0d0' }}>
                      Sources (3)
                    </label>

                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                      {DEMO_REGULATORY_SOURCES.map((src, idx) => (
                        <div
                          key={src.id}
                          className="flex items-center gap-3 px-4 py-3"
                          style={{
                            background: idx % 2 === 0 ? '#f8fafc' : 'transparent',
                            borderBottom: idx < DEMO_REGULATORY_SOURCES.length - 1 ? '1px solid #f1f5f9' : 'none',
                          }}
                        >
                          <FileText className="w-4 h-4 flex-shrink-0 text-red-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate text-[#0f172a]" title={src.title}>
                              {src.shortTitle}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#10b981' }}>✓ Loaded</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] mt-2" style={{ color: '#a0afc0' }}>
                      Demo: 3 pre-loaded sources
                    </p>
                  </section>

                  {/* ── Disabled Repository button ────────────────────────── */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showDemoUploadToast()}
                    className="w-full mb-2 text-xs font-medium"
                    style={{
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      color: '#94a3b8',
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    }}
                  >
                    <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                    Select from Repository
                  </Button>

                  {/* ── Disabled upload zone ──────────────────────────────── */}
                  <div
                    onClick={() => showDemoUploadToast()}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); showDemoUploadToast(); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); showDemoUploadToast(); }}
                    className="flex flex-col items-center justify-center rounded-xl"
                    style={{
                      border: '2px dashed #cbd5e1',
                      background: 'rgba(0,0,0,0.02)',
                      minHeight: '120px',
                      padding: '20px',
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    }}
                  >
                    <Upload className="w-7 h-7 mb-2" style={{ color: '#94a3b8' }} />
                    <p className="text-xs text-[#94a3b8] text-center">
                      Upload disabled in demo
                    </p>
                  </div>
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
                          background: selectedTemplateId === null ? '#dbeafe' : '#f8fafc',
                          border: selectedTemplateId === null ? '1px solid rgba(0,123,255,0.35)' : '1px solid transparent',
                          color: selectedTemplateId === null ? '#1a2332' : '#1a2332',
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
                            background: selectedTemplateId === template.id ? '#dbeafe' : '#f8fafc',
                            border: selectedTemplateId === template.id ? '1px solid rgba(0,123,255,0.35)' : '1px solid transparent',
                            color: selectedTemplateId === template.id ? '#1a2332' : '#1a2332',
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
                        <label className="text-xs block mb-1" style={{ color: '#1a2332' }}>{label}</label>
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
                          <label className="text-xs block mb-1" style={{ color: '#1a2332' }}>{label}</label>
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
                        <label className="text-xs block mb-1" style={{ color: '#1a2332' }}>{label}</label>
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
                      <label className="text-xs block mb-1" style={{ color: '#1a2332' }}>Source Restriction</label>
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
                      <label className="text-xs block mb-1" style={{ color: '#1a2332' }}>
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
                      <label htmlFor="auto-annotate" className="text-xs cursor-pointer" style={{ color: '#1a2332' }}>
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
                    className="w-full py-3 rounded-xl text-sm transition-colors"
                    style={{ background: '#5ba3f7', color: '#1a2332', fontWeight: 600 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#3d8ce6'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#5ba3f7'; }}
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
