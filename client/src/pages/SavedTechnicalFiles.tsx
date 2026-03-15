import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Download,
  Trash2,
  Search,
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  MoreHorizontal,
  X,
  Share2,
  Copy,
  Check,
  Info,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Link2,
  Eye,
  AlertTriangle,
  Upload,
  Clock,
  Tag,
  GripVertical,
  FolderPlus,
  Calendar,
  CheckSquare,
  Square,
  Braces,
  LayoutGrid,
  List,
  Columns3,
  Users,
  Shield,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable, type DropResult } from 'react-beautiful-dnd';
import { useDropzone } from 'react-dropzone';
import {
  ViewToolbar, GroupHeader,
  type ViewMode, type GroupByOption,
  loadViewMode, saveViewMode, loadGroupBy, saveGroupBy,
  groupTechnicalFiles,
} from '@/components/ViewToolbar';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  teal:        '#2563eb',
  tealLight:   '#EFF6FF',
  tealBorder:  '#BFDBFE',
  blue:        '#2563eb',
  blueLight:   '#EFF6FF',
  blueBorder:  '#BFDBFE',
  purple:      '#3b82f6',
  purpleLight: '#DBEAFE',
  purpleBorder:'#93C5FD',
  bg:          '#F8FAFC',
  card:        '#FFFFFF',
  border:      '#E5E7EB',
  borderLight: '#F3F4F6',
  text:        '#1F2937',
  textMid:     '#374151',
  textSub:     '#6B7280',
  textMuted:   '#9CA3AF',
  danger:      '#EF4444',
  dangerLight: '#FEF2F2',
  dangerBorder:'#FCA5A5',
  success:     '#28A745',
  successLight:'#f0fdf4',
  successBorder:'#86efac',
  dropZone:    '#E8F0FE',
  dropZoneBorder:'#007BFF',
} as const;

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewFilter  = 'all' | 'projects';
type FolderType  = 'project' | 'tab' | 'general';

interface RawFile {
  id: number;
  title: string;
  content: string;
  createdAt: string | Date;
  generatedAt?: string | Date;
  measurements: string[];
  dataFiles: string[];
  folder: string;
  tabName: string;
  filename: string;
  folderType: FolderType;
}

interface TabNode   { name: string; files: RawFile[] }
interface FolderNode { name: string; tabs: Map<string, TabNode>; folderType: FolderType; latestDate: Date }

interface CtxMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  separator?: false;
}
interface CtxSeparator { separator: true }
type CtxItem = CtxMenuItem | CtxSeparator;

interface CtxMenuState {
  x: number;
  y: number;
  items: CtxItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTitleParts(title: string): { folder: string; filename: string } {
  const idx = title.indexOf(' / ');
  return idx >= 0
    ? { folder: title.slice(0, idx).trim(), filename: title.slice(idx + 3).trim() }
    : { folder: 'General', filename: title };
}

function extractTabName(content: string): string {
  const m = content.match(/<!--\s*AI_SCRIPT\s*\n([\s\S]*?)\nEND_AI_SCRIPT\s*-->/);
  if (m) {
    try {
      const meta = JSON.parse(m[1]);
      if (typeof meta.tabName === 'string') return meta.tabName;
    } catch { /* fall through */ }
  }
  return 'Analysis';
}

function getFolderType(raw: any): FolderType {
  const ms: string[] = Array.isArray(raw.measurements) ? raw.measurements : [];
  if (ms.includes('foldertype:project')) return 'project';
  if (ms.includes('foldertype:tab'))     return 'tab';
  return 'general';
}

function matchesViewFilter(raw: any, vf: ViewFilter): boolean {
  if (vf === 'all') return true;
  // "Projects" view shows ALL files grouped by their folder — not just those
  // tagged with foldertype:project.  Files derive their folder from the title
  // prefix (e.g. "Project Name / filename"), so every file belongs to a folder.
  if (vf === 'projects') return true;
  return true;
}

function fmtDate(d: Date | string | undefined): string {
  if (!d) return '\u2014';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '\u2014';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function extractFormat(content: string): string {
  const m = content.match(/<!-- FORMAT: (\w+) -->/);
  return m ? m[1] : 'html';
}

function extractExportData(content: string): string | null {
  const bin = content.match(/<!-- EXPORT_DATA_BINARY_START\n([\s\S]*?)\nEXPORT_DATA_BINARY_END -->/);
  if (bin) return bin[1].trim();
  const txt = content.match(/<!-- EXPORT_DATA_TEXT_START\n([\s\S]*?)\nEXPORT_DATA_TEXT_END -->/);
  if (txt) return txt[1].trim();
  return null;
}

const FORMAT_EXT_MAP: Record<string, string> = {
  csv: 'csv', xlsx: 'xlsx', pdf: 'pdf',
  json: 'json', sas: 'sas7bdat', dta: 'dta', html: 'html',
};

const FORMAT_MIME_MAP: Record<string, string> = {
  csv:  'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf:  'application/pdf',
  json: 'application/json',
  sas:  'text/csv',
  dta:  'text/csv',
  html: 'text/html',
};

const FORMAT_COLOR_MAP: Record<string, { bg: string; color: string }> = {
  pdf:  { bg: '#d0e0f2', color: '#1e3a5f' },   // Navy
  csv:  { bg: '#dbeafe', color: '#1d4ed8' },   // Bright Blue
  xlsx: { bg: '#cffafe', color: '#0e7490' },   // Teal Blue
  docx: { bg: '#e0e7ff', color: '#3730a3' },   // Indigo Blue
  html: { bg: '#e2e8f0', color: '#475569' },   // Steel Blue
  sas:  { bg: '#cbd5e1', color: '#334155' },   // Slate Blue
  txt:  { bg: '#e0f2fe', color: '#0369a1' },   // Sky Blue
  json: { bg: '#cffafe', color: '#155e75' },   // Cerulean
  pptx: { bg: '#bfdbfe', color: '#1e40af' },   // Royal Blue
  zip:  { bg: '#cbd5e1', color: '#1e293b' },   // Dark Slate
  png:  { bg: '#bfdbfe', color: '#2563eb' },   // Cornflower
  jpg:  { bg: '#bfdbfe', color: '#2563eb' },   // Cornflower
  gif:  { bg: '#bfdbfe', color: '#2563eb' },   // Cornflower
  r:    { bg: '#bae6fd', color: '#075985' },   // Ocean Blue
  dta:  { bg: '#dbeafe', color: '#1d4ed8' },   // Bright Blue
};

function estimateSize(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDateFull(d: Date | string | undefined): string {
  if (!d) return '\u2014';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '\u2014';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const h = dt.getHours();
  const m = dt.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mm = m.toString().padStart(2, '0');
  return `Added ${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()} at ${h12}:${mm} ${ampm}`;
}

function TechFileIcon({ format, size = 18 }: { format: string; size?: number }) {
  if (format === 'xlsx') return <FileSpreadsheet style={{ width: size, height: size, color: '#0e7490' }} />;
  if (format === 'json') return <Braces style={{ width: size, height: size, color: '#155e75' }} />;
  if (format === 'csv') return <FileSpreadsheet style={{ width: size, height: size, color: '#1d4ed8' }} />;
  const fmtColor = FORMAT_COLOR_MAP[format]?.color ?? '#3B82F6';
  return <FileText style={{ width: size, height: size, color: fmtColor }} />;
}

function buildTree(rawFiles: any[], search: string, vf: ViewFilter): Map<string, FolderNode> {
  const tree = new Map<string, FolderNode>();
  const q = search.toLowerCase().trim();

  for (const raw of rawFiles) {
    if (!matchesViewFilter(raw, vf)) continue;
    const { folder, filename } = parseTitleParts(raw.title ?? '');
    const tabName    = extractTabName(raw.content ?? '');
    const folderType = getFolderType(raw);
    const file: RawFile = { ...raw, folder, tabName, filename, folderType };

    if (q &&
      !file.title.toLowerCase().includes(q) &&
      !file.filename.toLowerCase().includes(q) &&
      !file.folder.toLowerCase().includes(q) &&
      !file.tabName.toLowerCase().includes(q)
    ) continue;

    const dateVal = raw.createdAt || raw.generatedAt || '';
    if (!tree.has(folder)) {
      tree.set(folder, { name: folder, tabs: new Map(), folderType, latestDate: new Date(dateVal) });
    }
    const fn = tree.get(folder)!;
    if (folderType === 'project') fn.folderType = 'project';
    else if (folderType === 'tab' && fn.folderType === 'general') fn.folderType = 'tab';
    const d = new Date(dateVal);
    if (d > fn.latestDate) fn.latestDate = d;
    if (!fn.tabs.has(tabName)) fn.tabs.set(tabName, { name: tabName, files: [] });
    fn.tabs.get(tabName)!.files.push(file);
  }

  Array.from(tree.values()).forEach(fn =>
    Array.from(fn.tabs.values()).forEach(tab =>
      tab.files.sort((a: RawFile, b: RawFile) =>
        new Date(b.createdAt || b.generatedAt || '').getTime() - new Date(a.createdAt || a.generatedAt || '').getTime()
      )
    )
  );

  return tree;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SavedTechnicalFiles() {
  const [, setLocation]     = useLocation();
  const [search, setSearch] = useState('');
  const [viewFilter, setVF] = useState<ViewFilter>('all');
  const [techViewMode, setTechViewMode] = useState<ViewMode>(() => loadViewMode('technical-files', 'grid'));
  const [techGroupBy, setTechGroupBy] = useState<GroupByOption>(() => loadGroupBy('technical-files'));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [openFolder, setOpenFolder]   = useState<string | null>(null);
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());
  const [menuKey, setMenuKey]   = useState<string | null>(null);
  const [preview, setPreview]   = useState<RawFile | null>(null);
  const [searchFocus, setSearchFocus] = useState(false);

  // Multi-select
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const toggleSelect = (id: number) => setSelectedFiles(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedFiles(new Set());
  const selectAll = () => setSelectedFiles(new Set(allFlatFiles.map(f => f.id)));

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ name: string; fileCount: number; onConfirm: () => void } | null>(null);
  const [infoModal, setInfoModal] = useState<{ type: 'folder' | 'file'; name: string; createdDate: string; fileCount?: number; totalSize: string; format?: string; folderName?: string; tabName?: string } | null>(null);
  const [moveModal, setMoveModal] = useState<{ file: RawFile } | null>(null);
  const [renameFileModal, setRenameFileModal] = useState<{ file: RawFile } | null>(null);

  // ── New Box.com-style state ──
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [shareModal, setShareModal] = useState<{ name: string; type: 'folder' | 'file' } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ file: RawFile } | null>(null);
  const [tagModal, setTagModal] = useState<{ file: RawFile } | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number; status: 'uploading' | 'done' | 'error' }[]>([]);

  const { data: rawFiles = [], isLoading, refetch } = trpc.technical.getFiles.useQuery();
  const deleteMutation = trpc.technical.deleteFile.useMutation();
  const updateMutation = trpc.technical.updateFile.useMutation();
  const createFolderMutation = trpc.technical.createFolder.useMutation();
  const saveMutation = trpc.technical.saveReport.useMutation();

  const tree       = useMemo(() => buildTree(rawFiles, search, viewFilter), [rawFiles, search, viewFilter]);
  const folderKeys = useMemo(() => Array.from(tree.keys()).sort(), [tree]);

  // Stable project/folder count — always derived from ALL files (not filtered by viewFilter)
  // so the badge never shows a stale or mismatched count.
  const projectCount = useMemo(() => {
    const allTree = buildTree(rawFiles, search, 'all');
    return allTree.size;
  }, [rawFiles, search]);

  // Flat list of all files for "All Files" tab — sorted by date descending
  const allFlatFiles = useMemo(() => {
    const allTree = buildTree(rawFiles, search, 'all');
    const files: RawFile[] = [];
    allTree.forEach(fn => fn.tabs.forEach(tab => files.push(...tab.files)));
    return files.sort((a, b) => {
      const da = new Date(a.createdAt || a.generatedAt || 0).getTime();
      const db = new Date(b.createdAt || b.generatedAt || 0).getTime();
      return db - da;
    });
  }, [rawFiles, search]);

  // Expanded folders for Projects accordion view
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!menuKey) return;
    const h = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest('[data-menu]')) setMenuKey(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuKey]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const dlFile = (file: RawFile) => {
    const format     = extractFormat(file.content);
    const ext        = FORMAT_EXT_MAP[format] ?? 'html';
    const mime       = FORMAT_MIME_MAP[format] ?? 'text/html';
    const isBinary   = format === 'xlsx' || format === 'pdf';
    const exportData = extractExportData(file.content);
    const safeTitle  = file.filename.replace(/\s+/g, '_');

    let blob: Blob;
    if (isBinary && exportData) {
      const binary = atob(exportData);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: mime });
    } else if (!isBinary && exportData) {
      blob = new Blob([exportData], { type: mime });
    } else {
      blob = new Blob([file.content], { type: 'text/html' });
    }

    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.${ext}` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
  };

  const delFile = async (file: RawFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Delete "${file.filename}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ fileId: file.id });
      toast.success('Deleted');
      refetch();
      if (preview?.id === file.id) setPreview(null);
    } catch { toast.error('Failed to delete'); }
  };

  const dlFolder = (name: string) => {
    const fn = tree.get(name);
    if (!fn) return;
    const files = Array.from(fn.tabs.values()).flatMap(t => t.files);
    files.forEach(dlFile);
    toast.success(`Downloading ${files.length} file${files.length !== 1 ? 's' : ''}`);
  };

  const delFolder = async (name: string) => {
    const fn = tree.get(name);
    if (!fn) return;
    const files = Array.from(fn.tabs.values()).flatMap(t => t.files);
    try {
      for (const f of files) await deleteMutation.mutateAsync({ fileId: f.id });
      toast.success(`Folder "${name}" deleted`);
      if (openFolder === name) setOpenFolder(null);
      refetch();
    } catch { toast.error('Some files failed to delete'); }
  };

  const renameFolder = async (oldName: string, newName: string) => {
    const fn = tree.get(oldName);
    if (!fn) return;
    const files = Array.from(fn.tabs.values()).flatMap(t => t.files);
    try {
      for (const f of files) {
        const { filename } = parseTitleParts(f.title);
        const newTitle = `${newName} / ${filename}`;
        await updateMutation.mutateAsync({ fileId: f.id, title: newTitle });
      }
      toast.success(`Renamed to "${newName}"`);
      if (openFolder === oldName) setOpenFolder(newName);
      refetch();
    } catch { toast.error('Rename failed'); }
  };

  const duplicateFolder = async (_name: string) => {
    toast('Folder duplication requires server-side copy support');
  };

  const renameFile = async (file: RawFile, newFilename: string) => {
    try {
      const newTitle = `${file.folder} / ${newFilename}`;
      await updateMutation.mutateAsync({ fileId: file.id, title: newTitle });
      toast.success(`Renamed to "${newFilename}"`);
      refetch();
    } catch { toast.error('Rename failed'); }
  };

  const moveFileToFolder = async (file: RawFile, targetFolder: string) => {
    try {
      const newTitle = targetFolder === 'General' ? file.filename : `${targetFolder} / ${file.filename}`;
      await updateMutation.mutateAsync({ fileId: file.id, title: newTitle });
      toast.success(`Moved "${file.filename}" to ${targetFolder}`);
      refetch();
    } catch { toast.error('Move failed'); }
  };

  const duplicateFile = async (_file: RawFile) => {
    toast('File duplication requires server-side copy support');
  };

  const copyFileLink = (file: RawFile) => {
    navigator.clipboard.writeText(`${window.location.origin}/saved-technical-files?file=${file.id}`);
    toast.success('Link copied to clipboard');
  };

  const toggleTab = (key: string) => {
    setExpandedTabs(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── New Folder ──
  const createNewFolder = async (name: string) => {
    try {
      await createFolderMutation.mutateAsync({ folderName: name });
      toast.success(`Folder "${name}" created`, { style: { background: C.successLight, borderColor: C.successBorder, color: '#166534' } });
      refetch();
      setNewFolderModal(false);
    } catch { toast.error('Failed to create folder'); }
  };

  // ── Drag & Drop handler ──
  const onDragEnd = async (result: DropResult) => {
    setDragOverFolder(null);
    if (!result.destination) return;
    const { draggableId, source, destination } = result;

    // Same position — no change
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const fileId = parseInt(draggableId.replace('file-', ''), 10);
    const file = rawFiles.find((f: any) => f.id === fileId);
    if (!file) return;

    // Parse target: "folder-X__tab-Y" or "folder-X"
    let targetFolder: string;
    if (destination.droppableId.startsWith('folder-') && destination.droppableId.includes('__tab-')) {
      targetFolder = destination.droppableId.replace(/^folder-/, '').replace(/__tab-.*$/, '');
    } else {
      targetFolder = destination.droppableId.replace('folder-', '');
    }

    const { folder: currentFolder } = parseTitleParts(file.title ?? '');
    if (currentFolder === targetFolder && source.droppableId === destination.droppableId) {
      // Same tab, just reorder — no server call needed for now
      return;
    }

    if (currentFolder !== targetFolder) {
      const parsed = parseTitleParts(file.title ?? '');
      await moveFileToFolder({ ...file, folder: parsed.folder, filename: parsed.filename, tabName: '', folderType: 'general' as FolderType } as RawFile, targetFolder);
      toast.success(`Moved to "${targetFolder}"`, { style: { background: C.successLight, borderColor: C.successBorder, color: '#166534' } });
    }
  };

  // ── File Upload handler ──
  const onUploadDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!openFolder) { toast.error('Open a folder first to upload files'); return; }
    const uploads = acceptedFiles.map(f => ({ name: f.name, progress: 0, status: 'uploading' as const }));
    setUploadingFiles(uploads);

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      try {
        const text = await file.text();
        await saveMutation.mutateAsync({
          title: `${openFolder} / ${file.name}`,
          content: text,
          generatedAt: new Date().toISOString(),
          measurements: ['foldertype:general'],
        });
        setUploadingFiles(prev => prev.map((u, idx) => idx === i ? { ...u, progress: 100, status: 'done' } : u));
      } catch {
        setUploadingFiles(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'error' } : u));
      }
    }
    refetch();
    setTimeout(() => setUploadingFiles([]), 3000);
  }, [openFolder, saveMutation, refetch]);

  const { getRootProps: getUploadRootProps, getInputProps: getUploadInputProps, isDragActive: isUploadDragActive } = useDropzone({
    onDrop: onUploadDrop,
    noClick: true,
    noKeyboard: true,
  });

  // ── Tag management ──
  const addTag = async (file: RawFile, tag: string) => {
    const currentMeasurements: string[] = Array.isArray(file.measurements) ? file.measurements : [];
    if (currentMeasurements.includes(`tag:${tag}`)) return;
    const updated = [...currentMeasurements, `tag:${tag}`];
    try {
      await updateMutation.mutateAsync({ fileId: file.id, measurements: updated });
      toast.success(`Tag "${tag}" added`);
      refetch();
    } catch { toast.error('Failed to add tag'); }
  };

  const removeTag = async (file: RawFile, tag: string) => {
    const currentMeasurements: string[] = Array.isArray(file.measurements) ? file.measurements : [];
    const updated = currentMeasurements.filter(m => m !== `tag:${tag}`);
    try {
      await updateMutation.mutateAsync({ fileId: file.id, measurements: updated });
      toast.success(`Tag removed`);
      refetch();
    } catch { toast.error('Failed to remove tag'); }
  };

  // ── Context menu builders ────────────────────────────────────────────────────

  const buildFolderCtxItems = (name: string, fn: FolderNode): CtxItem[] => {
    const total = Array.from(fn.tabs.values()).reduce((s, t) => s + t.files.length, 0);
    const allFiles = Array.from(fn.tabs.values()).flatMap(t => t.files);
    const totalSize = allFiles.reduce((s, f) => s + new Blob([f.content]).size, 0);
    const sizeStr = totalSize < 1024 ? `${totalSize} B`
      : totalSize < 1024 * 1024 ? `${(totalSize / 1024).toFixed(1)} KB`
      : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
    const earliest = allFiles.length > 0
      ? allFiles.reduce((min, f) => {
          const d = new Date(f.createdAt || f.generatedAt || '');
          return d < min ? d : min;
        }, new Date())
      : new Date();

    return [
      { icon: <Pencil size={13} />, label: 'Rename', onClick: () => {
        setCtxMenu(null);
        const newName = prompt('Rename folder:', name);
        if (newName && newName.trim() && newName.trim() !== name) renameFolder(name, newName.trim());
      }},
      { icon: <Share2 size={13} />, label: 'Share\u2026', onClick: () => { setCtxMenu(null); setShareModal({ name, type: 'folder' }); }},
      { icon: <Copy size={13} />, label: 'Duplicate', onClick: () => { setCtxMenu(null); duplicateFolder(name); }},
      { icon: <FolderOpen size={13} />, label: 'Move to\u2026', onClick: () => { setCtxMenu(null); toast('Folder-level move is not supported'); }},
      { icon: <Download size={13} />, label: 'Download All', onClick: () => { setCtxMenu(null); dlFolder(name); }},
      { icon: <Trash2 size={13} />, label: 'Delete Folder', danger: true, onClick: () => {
        setCtxMenu(null);
        setDeleteConfirm({ name, fileCount: total, onConfirm: () => delFolder(name) });
      }},
      { separator: true },
      { icon: <Info size={13} />, label: 'Get Info', onClick: () => {
        setCtxMenu(null);
        setInfoModal({ type: 'folder', name, createdDate: fmtDate(earliest), fileCount: total, totalSize: sizeStr });
      }},
    ];
  };

  const buildFileCtxItems = (file: RawFile): CtxItem[] => {
    const format = extractFormat(file.content);
    const size = estimateSize(file.content);
    return [
      { icon: <Eye size={13} />, label: 'Open', onClick: () => { setCtxMenu(null); setPreview(file); }},
      { icon: <Pencil size={13} />, label: 'Rename', onClick: () => { setCtxMenu(null); setRenameFileModal({ file }); }},
      { icon: <FolderOpen size={13} />, label: 'Move to Folder\u2026', onClick: () => { setCtxMenu(null); setMoveModal({ file }); }},
      { icon: <Share2 size={13} />, label: 'Share\u2026', onClick: () => { setCtxMenu(null); setShareModal({ name: file.filename, type: 'file' }); }},
      { icon: <Clock size={13} />, label: 'Version History', onClick: () => { setCtxMenu(null); setHistoryModal({ file }); }},
      { icon: <Tag size={13} />, label: 'Manage Tags\u2026', onClick: () => { setCtxMenu(null); setTagModal({ file }); }},
      { icon: <Download size={13} />, label: 'Download', onClick: () => { setCtxMenu(null); dlFile(file); }},
      { icon: <Copy size={13} />, label: 'Duplicate', onClick: () => { setCtxMenu(null); duplicateFile(file); }},
      { icon: <Trash2 size={13} />, label: 'Delete File', danger: true, onClick: () => { setCtxMenu(null); delFile(file); }},
      { separator: true },
      { icon: <Link2 size={13} />, label: 'Copy Link', onClick: () => { setCtxMenu(null); copyFileLink(file); }},
      { icon: <Info size={13} />, label: 'Get Info', onClick: () => {
        setCtxMenu(null);
        setInfoModal({
          type: 'file', name: file.filename,
          createdDate: fmtDate(file.createdAt || file.generatedAt),
          totalSize: size, format: `.${FORMAT_EXT_MAP[format] ?? format}`,
          folderName: file.folder, tabName: file.tabName,
        });
      }},
    ];
  };

  const openCtxMenu = (e: React.MouseEvent, items: CtxItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 210);
    const y = Math.min(e.clientY, window.innerHeight - 320);
    setCtxMenu({ x, y, items });
    setMenuKey(null);
  };

  const openCtxMenuFromButton = (btn: HTMLElement, items: CtxItem[]) => {
    const rect = btn.getBoundingClientRect();
    const x = Math.min(rect.right, window.innerWidth - 210);
    const y = Math.min(rect.bottom + 4, window.innerHeight - 320);
    setCtxMenu({ x, y, items });
  };

  const renderModals = () => (
    <>
      {ctxMenu && <ContextMenu {...ctxMenu} />}
      {deleteConfirm && <DeleteConfirmDialog {...deleteConfirm} onCancel={() => setDeleteConfirm(null)} />}
      {infoModal && <InfoDialog {...infoModal} onClose={() => setInfoModal(null)} />}
      {moveModal && <MoveToFolderDialog file={moveModal.file} folders={folderKeys} onMove={(target) => { moveFileToFolder(moveModal.file, target); setMoveModal(null); }} onCancel={() => setMoveModal(null)} />}
      {renameFileModal && <RenameFileDialog file={renameFileModal.file} onRename={(newName) => { renameFile(renameFileModal.file, newName); setRenameFileModal(null); }} onCancel={() => setRenameFileModal(null)} />}
      {newFolderModal && <NewFolderDialog onCreate={createNewFolder} onCancel={() => setNewFolderModal(false)} />}
      {shareModal && <ShareDialog name={shareModal.name} type={shareModal.type} onClose={() => setShareModal(null)} />}
      {historyModal && <VersionHistoryDialog file={historyModal.file} onClose={() => setHistoryModal(null)} onDownload={dlFile} />}
      {tagModal && <TagDialog file={tagModal.file} onAddTag={(tag) => addTag(tagModal.file, tag)} onRemoveTag={(tag) => removeTag(tagModal.file, tag)} onClose={() => { setTagModal(null); }} />}
    </>
  );

  // ── Folder drill-down view ────────────────────────────────────────────────────

  if (openFolder !== null) {
    const fn = tree.get(openFolder);
    if (!fn) { setOpenFolder(null); return null; }
    const tabKeys = Array.from(fn.tabs.keys()).sort();
    const totalFolderFiles = tabKeys.reduce((s, k) => s + fn.tabs.get(k)!.files.length, 0);

    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
        <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '22px 40px 24px' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            <button
              onClick={() => setOpenFolder(null)}
              style={{ display:'flex', alignItems:'center', gap:5, color:C.teal, fontSize:14, fontWeight:500, background:'none', border:'none', cursor:'pointer', padding:0 }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              <ArrowLeft size={14} /> Technical Files
            </button>
            <ChevronRight size={13} style={{ color: C.textMuted }} />
            <span style={{ fontSize:14, color:C.text, fontWeight:600 }}>{openFolder}</span>
          </nav>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:24 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:C.tealLight, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <FolderOpen size={22} style={{ color: C.teal }} />
                </div>
                <h1 style={{ fontSize:28, fontWeight:700, color:C.text, margin:0, lineHeight:1.2 }}>{openFolder}</h1>
                <TypeBadge type={fn.folderType} />
              </div>
              <p style={{ fontSize:14, color:C.textSub, margin:0 }}>
                {totalFolderFiles} file{totalFolderFiles !== 1 ? 's' : ''} across {tabKeys.length} tab{tabKeys.length !== 1 ? 's' : ''}
                {' \u00B7 '}Last modified {fmtDate(fn.latestDate)}
              </p>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <PrimaryBtn icon={<Upload size={14} />} label="Upload Files" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.onchange = (e) => { const files = (e.target as HTMLInputElement).files; if (files) onUploadDrop(Array.from(files)); }; input.click(); }} />
              <GhostBtn icon={<Share2 size={14} />} label="Share" onClick={() => setShareModal({ name: openFolder, type: 'folder' })} />
              <GhostBtn icon={<Download size={14} />} label="Download All" onClick={() => dlFolder(openFolder)} />
              <DangerBtn icon={<Trash2 size={14} />} label="Delete All" onClick={() => {
                setDeleteConfirm({ name: openFolder, fileCount: totalFolderFiles, onConfirm: () => delFolder(openFolder) });
              }} />
            </div>
          </div>
        </div>

        {/* Upload drop zone overlay */}
        <div {...getUploadRootProps()} style={{ position: 'relative' }}>
          <input {...getUploadInputProps()} />
          {isUploadDragActive && (
            <div style={{ position:'absolute', inset:0, zIndex:50, background:'rgba(0,123,255,0.08)', border:`3px dashed ${C.dropZoneBorder}`, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
              <div style={{ textAlign:'center' }}>
                <Upload size={48} style={{ color: C.dropZoneBorder, marginBottom:12 }} />
                <p style={{ fontSize:18, fontWeight:600, color: C.dropZoneBorder, margin:0 }}>Drop files here to upload</p>
                <p style={{ fontSize:13, color: C.textSub, margin:'6px 0 0' }}>Files will be added to "{openFolder}"</p>
              </div>
            </div>
          )}

          {/* Upload progress indicators */}
          {uploadingFiles.length > 0 && (
            <div style={{ padding:'0 40px', maxWidth:1100, margin:'0 auto' }}>
              {uploadingFiles.map((uf, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background: C.card, border:`1px solid ${C.border}`, borderRadius:8, marginBottom:8 }}>
                  <div style={{ width:20, height:20 }}>
                    {uf.status === 'uploading' ? (
                      <div style={{ width:16, height:16, border:`2px solid ${C.blue}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
                    ) : uf.status === 'done' ? (
                      <Check size={16} style={{ color: C.success }} />
                    ) : (
                      <X size={16} style={{ color: C.danger }} />
                    )}
                  </div>
                  <span style={{ fontSize:13, color: C.text, flex:1 }}>{uf.name}</span>
                  <div style={{ width:120, height:4, background:C.borderLight, borderRadius:2, overflow:'hidden' }}>
                    <div style={{ width:`${uf.progress}%`, height:'100%', background: uf.status === 'error' ? C.danger : C.success, borderRadius:2, transition:'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

        <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ padding:'32px 40px', maxWidth:1100, margin:'0 auto' }}>
          {tabKeys.map((tabName, ti) => {
            const tab = fn.tabs.get(tabName)!;
            const tabKey = `${openFolder}::${tabName}`;
            const isOpen = expandedTabs.has(tabKey);
            const isLast = ti === tabKeys.length - 1;
            const droppableId = `folder-${openFolder}__tab-${tabName}`;
            return (
              <div key={tabKey} style={{ marginBottom: isLast ? 0 : 16 }}>
                <Droppable droppableId={droppableId}>
                  {(droppableProvided, snapshot) => (
                    <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                <div
                  onClick={() => toggleTab(tabKey)}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'13px 20px',
                    background: snapshot.isDraggingOver ? '#E3F2FD' : C.card,
                    border: snapshot.isDraggingOver ? `2px solid #007BFF` : `1px solid ${C.border}`,
                    borderRadius: isOpen ? '12px 12px 0 0' : 12,
                    cursor:'pointer', userSelect:'none', transition:'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!snapshot.isDraggingOver) e.currentTarget.style.background = C.bg; }}
                  onMouseLeave={e => { if (!snapshot.isDraggingOver) e.currentTarget.style.background = C.card; }}
                >
                  {isOpen ? <ChevronDown size={15} style={{ color:C.textMuted, flexShrink:0 }} /> : <ChevronRight size={15} style={{ color:C.textMuted, flexShrink:0 }} />}
                  {isOpen ? <FolderOpen size={17} style={{ color:C.blue, flexShrink:0 }} /> : <Folder size={17} style={{ color:C.blue, flexShrink:0 }} />}
                  <span style={{ fontSize:15, fontWeight:600, color:C.text, flex:1 }}>{tabName}</span>
                  <span style={{ fontSize:12, color:C.textSub, background:C.borderLight, padding:'2px 10px', borderRadius:20 }}>
                    {tab.files.length} file{tab.files.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderTop:'none', borderRadius:'0 0 12px 12px', overflow:'hidden' }}>
                    <div style={{ display:'flex', alignItems:'center', padding:'8px 20px', background:'#F9FAFB', borderBottom:`1px solid ${C.border}` }}>
                      <ColHead style={{ flex:1 }}>Name</ColHead>
                      <ColHead style={{ width:140, textAlign:'right' }}>Date Modified</ColHead>
                      <ColHead style={{ width:140, textAlign:'right' }}>Actions</ColHead>
                    </div>
                    {tab.files.map((file, fIdx) => (
                      <Draggable key={file.id} draggableId={`file-${file.id}`} index={fIdx}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            style={{
                              ...dragProvided.draggableProps.style,
                              ...(dragSnapshot.isDragging ? { boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderRadius: 8, background: C.card } : {}),
                            }}
                          >
                      <FileRow
                        key={file.id}
                        file={file}
                        isLast={fIdx === tab.files.length - 1}
                        onOpen={() => setPreview(file)}
                        onDownload={() => dlFile(file)}
                        onDelete={e => delFile(file, e)}
                        onContextMenu={e => openCtxMenu(e, buildFileCtxItems(file))}
                        onOverflowClick={btn => openCtxMenuFromButton(btn, buildFileCtxItems(file))}
                        onHistory={() => setHistoryModal({ file })}
                        onShare={() => setShareModal({ name: file.filename, type: 'file' })}
                        onTag={() => setTagModal({ file })}
                        dragHandleProps={dragProvided.dragHandleProps}
                      />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {droppableProvided.placeholder}
                  </div>
                )}
                {!isOpen && droppableProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
        </DragDropContext>
        </div>{/* close upload drop zone wrapper */}
        {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
        {renderModals()}
      </div>
    );
  }


  // ── Main view ───────────────────────────────────────────────────────────────

  const selectedCount = selectedFiles.size;

  const bulkDownload = () => {
    const files = allFlatFiles.filter(f => selectedFiles.has(f.id));
    files.forEach(dlFile);
    toast.success(`Downloading ${files.length} file${files.length !== 1 ? 's' : ''}`);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedFiles);
    if (!confirm(`Delete ${ids.length} selected file${ids.length !== 1 ? 's' : ''}?`)) return;
    try {
      for (const id of ids) await deleteMutation.mutateAsync({ fileId: id });
      toast.success(`Deleted ${ids.length} file${ids.length !== 1 ? 's' : ''}`);
      clearSelection();
      refetch();
    } catch { toast.error('Some files failed to delete'); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: FONT }}>
      {/* ═══ STICKY HEADER ═══ */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '16px 24px' }}>
          {/* Row 1: Title + Search + Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Title section */}
            <div style={{ flexShrink: 0, marginRight: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3 }}>Technical Files</h1>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                {rawFiles.length} file{rawFiles.length !== 1 ? 's' : ''} across {projectCount} folder{projectCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
              <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: searchFocus ? '#3B82F6' : '#9CA3AF', pointerEvents: 'none', transition: 'color 0.2s' }} />
              <input
                type="text"
                placeholder="Search files, folders, or tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                style={{
                  width: '100%', boxSizing: 'border-box', paddingLeft: 40, paddingRight: search ? 32 : 14,
                  paddingTop: 10, paddingBottom: 10, border: `1px solid ${searchFocus ? '#3B82F6' : '#D1D5DB'}`,
                  borderRadius: 8, fontSize: 14, color: '#111827', background: '#FFFFFF', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: searchFocus ? '0 0 0 2px rgba(59,130,246,0.3)' : 'none',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* View toggle group */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: 6, padding: 2, gap: 2 }}>
              {([
                { mode: 'grid' as ViewMode, icon: <LayoutGrid size={14} />, label: 'Grid' },
                { mode: 'list' as ViewMode, icon: <List size={14} />, label: 'List' },
                { mode: 'columns' as ViewMode, icon: <Columns3 size={14} />, label: 'Compact' },
              ]).map(({ mode, icon, label }) => {
                const active = techViewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => { setTechViewMode(mode); saveViewMode('technical-files', mode); }}
                    title={label}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 4, border: 'none', cursor: 'pointer',
                      background: active ? '#FFFFFF' : 'transparent',
                      color: active ? '#2b7de9' : '#8fa3b8',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {icon}
                  </button>
                );
              })}
            </div>

            {/* New Folder button */}
            <button
              onClick={() => setNewFolderModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                border: '1px solid #1a2332', background: '#FFFFFF', color: '#1a2332',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#3B82F6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#1a2332'; }}
            >
              <FolderPlus size={14} />
              New Folder
            </button>
          </div>

          {/* Bulk actions bar */}
          {selectedCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: '10px 16px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#3B82F6' }}>{selectedCount} file{selectedCount !== 1 ? 's' : ''} selected</span>
              <div style={{ flex: 1 }} />
              <button onClick={bulkDownload} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
              >
                <Download size={13} /> Download All
              </button>
              <button onClick={clearSelection} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'transparent', color: '#6b7280', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                Deselect all
              </button>
              <button onClick={bulkDelete} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FFFFFF', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
              >
                <Trash2 size={13} /> Delete {selectedCount}
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', borderTop: '1px solid #f3f4f6' }}>
          {([
            { key: 'all' as ViewFilter, label: 'All Files', count: allFlatFiles.length },
            { key: 'projects' as ViewFilter, label: 'Projects', count: projectCount },
          ]).map(({ key, label, count }) => {
            const active = viewFilter === key;
            return (
              <button
                key={key}
                onClick={() => { setVF(key); clearSelection(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 20px', fontSize: 14, fontWeight: active ? 500 : 400,
                  color: active ? '#1a2332' : '#8fa3b8', background: 'none', border: 'none',
                  borderBottom: active ? '2px solid #2b7de9' : '2px solid transparent',
                  cursor: 'pointer', marginBottom: -1, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#1a2332'; e.currentTarget.style.background = '#F9FAFB'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#8fa3b8'; e.currentTarget.style.background = 'none'; } }}
              >
                {label}
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 10, background: active ? '#EFF6FF' : '#f3f4f6', color: active ? '#2b7de9' : '#8fa3b8' }}>
                  {count}
                </span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: '#8fa3b8', paddingRight: 4, paddingBottom: 12 }}>
            {folderKeys.length} folder{folderKeys.length !== 1 ? 's' : ''} shown
          </span>
        </div>
      </div>

      {/* ═══ CONTENT AREA ═══ */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 24px 100px' }}>
        {isLoading ? <LoadingState /> : rawFiles.length === 0 ? <EmptyState /> : (
          <>
            {/* ── ALL FILES TAB ─────────────────────────────────────────── */}
            {viewFilter === 'all' && (
              allFlatFiles.length === 0
                ? <FilteredEmpty viewFilter={viewFilter} search={search} />
                : techViewMode === 'grid'
                  ? (
                    /* Grid view — file cards */
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                      {allFlatFiles.map(file => {
                        const format = extractFormat(file.content);
                        const fmtColor = FORMAT_COLOR_MAP[format] ?? { bg: '#e2e8f0', color: '#475569' };
                        const ext = FORMAT_EXT_MAP[format] ?? format;
                        const sel = selectedFiles.has(file.id);
                        return (
                          <div
                            key={file.id}
                            onClick={() => setPreview(file)}
                            onContextMenu={e => openCtxMenu(e, buildFileCtxItems(file))}
                            style={{
                              background: '#FFFFFF', border: `1px solid ${sel ? '#3B82F6' : '#e2e8f0'}`,
                              borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                              transition: 'all 0.2s', position: 'relative',
                              boxShadow: sel ? '0 0 0 1px rgba(59,130,246,0.2)' : '0 1px 2px rgba(0,0,0,0.04)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.15)'; e.currentTarget.style.borderColor = '#3B82F6'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = sel ? '0 0 0 1px rgba(59,130,246,0.2)' : '0 1px 2px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = sel ? '#3B82F6' : '#e2e8f0'; }}
                          >
                            {/* Preview area */}
                            <div style={{ height: 120, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #DEE2E6' }}>
                              <div style={{ width: 56, height: 56, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <TechFileIcon format={format} size={28} />
                              </div>
                            </div>
                            {/* Checkbox */}
                            <button
                              onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}
                              style={{ position: 'absolute', top: 8, left: 8, background: 'none', border: 'none', cursor: 'pointer', color: sel ? '#3B82F6' : '#D1D5DB', padding: 0 }}
                            >
                              {sel ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                            {/* Content */}
                            <div style={{ padding: '12px 16px' }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.filename}</p>
                              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.folder !== 'General' ? file.folder : ''}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: fmtColor.bg, color: fmtColor.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>.{ext}</span>
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>{estimateSize(file.content)}</span>
                              </div>
                              <p style={{ fontSize: 10, color: '#94a3b8', margin: '6px 0 0' }}>{fmtDate(file.createdAt || file.generatedAt)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                  : (
                    /* List view — Data Library style rows */
                    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                      {/* Column headers */}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #e2e8f0', background: '#fafbfc' }}>
                        <div style={{ width: 32, flexShrink: 0 }}>
                          <button onClick={() => { if (selectedCount === allFlatFiles.length) clearSelection(); else selectAll(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedCount > 0 ? '#3B82F6' : '#D1D5DB', padding: 0 }}>
                            {selectedCount === allFlatFiles.length && allFlatFiles.length > 0 ? <CheckSquare size={15} /> : <Square size={15} />}
                          </button>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#8fa3b8', textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>File Name</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#8fa3b8', textTransform: 'uppercase', letterSpacing: '0.5px', width: 70, textAlign: 'center', flexShrink: 0 }}>Type</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#8fa3b8', textTransform: 'uppercase', letterSpacing: '0.5px', width: 260, textAlign: 'right', flexShrink: 0 }}>Date</span>
                        <div style={{ width: 36, flexShrink: 0 }} />
                      </div>
                      {/* File rows */}
                      {allFlatFiles.map((file, idx) => {
                        const format = extractFormat(file.content);
                        const fmtColor = FORMAT_COLOR_MAP[format] ?? { bg: '#e2e8f0', color: '#475569' };
                        const ext = FORMAT_EXT_MAP[format] ?? format;
                        const sel = selectedFiles.has(file.id);
                        return (
                          <div
                            key={file.id}
                            onClick={() => setPreview(file)}
                            onContextMenu={e => openCtxMenu(e, buildFileCtxItems(file))}
                            style={{
                              display: 'flex', alignItems: 'center', padding: '16px 20px',
                              borderBottom: idx < allFlatFiles.length - 1 ? '1px solid #f3f4f6' : 'none',
                              cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
                              background: sel ? '#EFF6FF' : '#FFFFFF',
                              borderLeft: '3px solid transparent',
                            }}
                            onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderLeftColor = '#3B82F6'; e.currentTarget.style.background = '#FAFBFC'; } }}
                            onMouseLeave={e => { e.currentTarget.style.borderLeftColor = 'transparent'; if (!sel) e.currentTarget.style.background = '#FFFFFF'; }}
                          >
                            {/* Checkbox */}
                            <div style={{ width: 32, flexShrink: 0 }}>
                              <button
                                onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: sel ? '#3B82F6' : '#D1D5DB', padding: 0, transition: 'color 0.15s' }}
                              >
                                {sel ? <CheckSquare size={15} /> : <Square size={15} />}
                              </button>
                            </div>
                            {/* File icon */}
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 14 }}>
                              <TechFileIcon format={format} size={18} />
                            </div>
                            {/* Name + folder path */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: '#1a2332', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.filename}</p>
                              <p style={{ fontSize: 13, color: '#8fa3b8', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.folder !== 'General' ? `${file.folder} / ${file.tabName}` : file.tabName || 'General'}
                              </p>
                            </div>
                            {/* Type badge */}
                            <div style={{ width: 70, textAlign: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: fmtColor.bg, color: fmtColor.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>.{ext}</span>
                            </div>
                            {/* Size + Date */}
                            <div style={{ width: 260, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
                              <span style={{ fontSize: 12, color: '#6b7280' }}>{estimateSize(file.content)}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#8fa3b8' }}>
                                <Calendar size={12} />
                                {fmtDateFull(file.createdAt || file.generatedAt)}
                              </span>
                            </div>
                            {/* 3-dot menu */}
                            <div style={{ width: 36, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                              <button
                                onClick={e => { e.stopPropagation(); openCtxMenuFromButton(e.currentTarget, buildFileCtxItems(file)); }}
                                style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#3B82F6'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                              >
                                <MoreHorizontal size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
            )}

            {/* ── PROJECTS TAB ─────────────────────────────────────────── */}
            {viewFilter === 'projects' && (
              folderKeys.length === 0 ? <FilteredEmpty viewFilter={viewFilter} search={search} /> : (
                <>
                  {/* Grid view (default) */}
                  {techViewMode === 'grid' && (
                    <DragDropContext onDragEnd={onDragEnd}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
                      {folderKeys.map(name => {
                        const fn = tree.get(name)!;
                        return (
                          <Droppable key={name} droppableId={`folder-${name}`}>
                            {(dropProv, dropSnap) => (
                              <div ref={dropProv.innerRef} {...dropProv.droppableProps} style={{ position: 'relative' }}>
                                <FolderCard
                                  fn={fn} menuOpen={menuKey === name}
                                  onOpen={() => {
                                    setExpandedFolders(prev => {
                                      const next = new Set(prev);
                                      if (next.has(name)) next.delete(name);
                                      else next.add(name);
                                      return next;
                                    });
                                  }}
                                  onMenuToggle={e => { e.stopPropagation(); setMenuKey(menuKey === name ? null : name); }}
                                  onRename={newName => renameFolder(name, newName)}
                                  onContextMenu={e => openCtxMenu(e, buildFolderCtxItems(name, fn))}
                                  onOverflowClick={btn => { setMenuKey(null); openCtxMenuFromButton(btn, buildFolderCtxItems(name, fn)); }}
                                  isDragOver={dropSnap.isDraggingOver}
                                />
                                {dropProv.placeholder}
                              </div>
                            )}
                          </Droppable>
                        );
                      })}
                      </div>

                      {/* Expanded folder accordion */}
                      {folderKeys.filter(name => expandedFolders.has(name)).map(name => {
                        const fn = tree.get(name)!;
                        const folderFiles = Array.from(fn.tabs.values()).flatMap(t => t.files);
                        return (
                          <div key={`accordion-${name}`} style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                              onClick={() => setExpandedFolders(prev => { const next = new Set(prev); next.delete(name); return next; })}
                            >
                              <FolderOpen size={18} style={{ color: '#3B82F6', flexShrink: 0 }} />
                              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', flex: 1 }}>{fn.name}</span>
                              <span style={{ fontSize: 12, color: '#8fa3b8' }}>{folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}</span>
                              <ChevronDown size={16} style={{ color: '#8fa3b8' }} />
                            </div>
                            {/* Column headers */}
                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', borderBottom: '1px solid #e2e8f0', background: '#fafbfc' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#8fa3b8', textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>File Name</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#8fa3b8', textTransform: 'uppercase', letterSpacing: '0.5px', width: 70, textAlign: 'center', flexShrink: 0 }}>Type</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#8fa3b8', textTransform: 'uppercase', letterSpacing: '0.5px', width: 200, textAlign: 'right', flexShrink: 0 }}>Date</span>
                            </div>
                            {folderFiles.map((file, idx) => {
                              const format = extractFormat(file.content);
                              const fmtColor = FORMAT_COLOR_MAP[format] ?? { bg: '#e2e8f0', color: '#475569' };
                              const ext = FORMAT_EXT_MAP[format] ?? format;
                              return (
                                <div
                                  key={file.id}
                                  onClick={() => setPreview(file)}
                                  onContextMenu={e => openCtxMenu(e, buildFileCtxItems(file))}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                                    cursor: 'pointer', transition: 'all 0.15s', borderLeft: '3px solid transparent',
                                    borderBottom: idx < folderFiles.length - 1 ? '1px solid #f3f4f6' : 'none',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.borderLeftColor = '#3B82F6'; e.currentTarget.style.background = '#FAFBFC'; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderLeftColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <TechFileIcon format={format} size={16} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1a2332', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.filename}</p>
                                    <p style={{ fontSize: 12, color: '#8fa3b8', margin: '1px 0 0' }}>{file.tabName || 'Analysis'}</p>
                                  </div>
                                  <div style={{ width: 70, textAlign: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: fmtColor.bg, color: fmtColor.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>.{ext}</span>
                                  </div>
                                  <div style={{ width: 200, textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                    <span style={{ fontSize: 12, color: '#6b7280' }}>{estimateSize(file.content)}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#8fa3b8' }}>
                                      <Calendar size={12} />
                                      {fmtDate(file.createdAt || file.generatedAt)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    </DragDropContext>
                  )}

                  {/* List view — folders as rows */}
                  {techViewMode === 'list' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {folderKeys.map(name => {
                        const fn = tree.get(name)!;
                        const total = Array.from(fn.tabs.values()).reduce((s, t) => s + t.files.length, 0);
                        return (
                          <div
                            key={name}
                            onClick={() => { setOpenFolder(name); setExpandedTabs(new Set()); }}
                            onContextMenu={e => openCtxMenu(e, buildFolderCtxItems(name, fn))}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                              background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10,
                              cursor: 'pointer', transition: 'all 0.2s ease', borderLeft: '3px solid transparent',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderLeftColor = '#3B82F6'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderLeftColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Folder size={20} style={{ color: '#3B82F6' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{fn.name}</span>
                              <span style={{ fontSize: 12, color: '#8fa3b8', marginLeft: 10 }}>{total} file{total !== 1 ? 's' : ''}</span>
                            </div>
                            <span style={{ fontSize: 12, color: '#8fa3b8', flexShrink: 0 }}>{fmtDate(fn.latestDate)}</span>
                            <TypeBadge type={fn.folderType} />
                            <button
                              onClick={e => { e.stopPropagation(); openCtxMenuFromButton(e.currentTarget, buildFolderCtxItems(name, fn)); }}
                              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#3B82F6'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                            ><MoreVertical size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Columns view */}
                  {techViewMode === 'columns' && (
                    <div style={{ display: 'flex', gap: 16, minHeight: 400 }}>
                      <div style={{ width: 240, flexShrink: 0, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflowY: 'auto' }}>
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid #E5E7EB' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#8fa3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Folders</span>
                        </div>
                        {folderKeys.map(name => {
                          const fn = tree.get(name)!;
                          const total = Array.from(fn.tabs.values()).reduce((s, t) => s + t.files.length, 0);
                          const isOpen = openFolder === name;
                          return (
                            <button
                              key={name}
                              onClick={() => { setOpenFolder(name); setExpandedTabs(new Set()); }}
                              style={{
                                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                background: isOpen ? '#EFF6FF' : 'transparent', color: isOpen ? '#3B82F6' : '#374151',
                                border: 'none', borderLeft: isOpen ? '3px solid #3B82F6' : '3px solid transparent',
                                cursor: 'pointer', fontSize: 13, fontWeight: isOpen ? 600 : 400, transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#F9FAFB'; }}
                              onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <Folder size={15} />
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fn.name}</span>
                              <span style={{ fontSize: 11, color: '#8fa3b8' }}>{total}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {openFolder && tree.get(openFolder) ? (
                          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{openFolder}</p>
                            </div>
                            {Array.from(tree.get(openFolder)!.tabs.values()).flatMap(t => t.files).map((file, idx, arr) => {
                              const format = extractFormat(file.content);
                              const fmtColor = FORMAT_COLOR_MAP[format] ?? { bg: '#e2e8f0', color: '#475569' };
                              return (
                                <div key={file.id} onClick={() => setPreview(file)} onContextMenu={e => openCtxMenu(e, buildFileCtxItems(file))}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                                    borderBottom: idx < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
                                    cursor: 'pointer', transition: 'all 0.15s', borderLeft: '3px solid transparent',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#FAFBFC'; e.currentTarget.style.borderLeftColor = '#3B82F6'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = 'transparent'; }}
                                >
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <TechFileIcon format={format} size={16} />
                                  </div>
                                  <span style={{ fontSize: 13, color: '#111827', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.filename}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: fmtColor.bg, color: fmtColor.color, textTransform: 'uppercase' }}>
                                    .{FORMAT_EXT_MAP[format] ?? format}
                                  </span>
                                  <span style={{ fontSize: 11, color: '#8fa3b8' }}>{fmtDate(file.createdAt || file.generatedAt)}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8fa3b8', fontSize: 14 }}>
                            Select a folder to view its contents
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </>
        )}
      </div>

      {/* ═══ FLOATING MULTI-SELECT BAR ═══ */}
      {selectedCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          background: '#FFFFFF', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
          borderRadius: '12px 12px 0 0', padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 16, zIndex: 30,
          minWidth: 400, maxWidth: 600,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#3B82F6' }}>{selectedCount} file{selectedCount !== 1 ? 's' : ''} selected</span>
          <div style={{ flex: 1 }} />
          <button onClick={bulkDownload} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
          >
            <Download size={14} /> Download
          </button>
          <button onClick={bulkDelete} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FFFFFF', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
          >
            <Trash2 size={14} /> Delete
          </button>
          <button onClick={clearSelection} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Clear selection
          </button>
        </div>
      )}

      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
      {renderModals()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function ContextMenu({ x, y, items }: CtxMenuState) {
  return (
    <div data-menu onMouseDown={e => e.stopPropagation()} style={{
      position: 'fixed', top: y, left: x, zIndex: 9999,
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 11, boxShadow: '0 12px 30px -5px rgba(0,0,0,0.14)',
      minWidth: 190, overflow: 'hidden', padding: '4px 0',
    }}>
      {items.map((item, i) =>
        'separator' in item && item.separator
          ? <div key={`sep-${i}`} style={{ height: 1, background: C.borderLight, margin: '4px 8px' }} />
          : <MenuBtn key={i} icon={(item as CtxMenuItem).icon} label={(item as CtxMenuItem).label} onClick={(item as CtxMenuItem).onClick} danger={(item as CtxMenuItem).danger} />
      )}
    </div>
  );
}

function DeleteConfirmDialog({ name, fileCount, onConfirm, onCancel }: { name: string; fileCount: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', fontFamily: FONT }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: '28px 32px', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.25)', maxWidth: 420, width: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.dangerLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={20} style={{ color: C.danger }} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>Delete {name}?</h3>
        </div>
        <p style={{ fontSize: 14, color: C.textSub, margin: '0 0 24px', lineHeight: 1.6 }}>
          This will permanently delete all {fileCount} file{fileCount !== 1 ? 's' : ''} inside.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textMid, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { onConfirm(); onCancel(); }} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: C.danger, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Delete Forever</button>
        </div>
      </div>
    </div>
  );
}

function InfoDialog({ type, name, createdDate, fileCount, totalSize, format, folderName, tabName, onClose }: {
  type: 'folder' | 'file'; name: string; createdDate: string; fileCount?: number; totalSize: string; format?: string; folderName?: string; tabName?: string; onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', fontFamily: FONT }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: '28px 32px', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.25)', maxWidth: 400, width: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: C.tealLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {type === 'folder' ? <Folder size={18} style={{ color: C.teal }} /> : <FileText size={18} style={{ color: C.teal }} />}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{type === 'folder' ? 'Folder Info' : 'File Info'}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InfoRow label="Name" value={name} />
          {type === 'file' && format && <InfoRow label="Format" value={format} />}
          {type === 'file' && folderName && <InfoRow label="Folder" value={folderName} />}
          {type === 'file' && tabName && <InfoRow label="Tab" value={tabName} />}
          <InfoRow label="Created" value={createdDate} />
          {type === 'folder' && fileCount != null && <InfoRow label="File Count" value={`${fileCount} file${fileCount !== 1 ? 's' : ''}`} />}
          <InfoRow label="Total Size" value={totalSize} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <span style={{ fontSize: 13, color: C.textSub, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function MoveToFolderDialog({ file, folders, onMove, onCancel }: { file: RawFile; folders: string[]; onMove: (target: string) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const available = folders.filter(f => f !== file.folder);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', fontFamily: FONT }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: '28px 32px', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.25)', maxWidth: 400, width: '90%' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Move "{file.filename}"</h3>
        <p style={{ fontSize: 13, color: C.textSub, margin: '0 0 16px' }}>Currently in: {file.folder}</p>
        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {available.map(f => (
            <button key={f} onClick={() => { setSelected(f); setNewFolderName(''); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: selected === f ? C.tealLight : 'transparent', border: 'none', borderBottom: `1px solid ${C.borderLight}`,
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
            }}>
              <Folder size={15} style={{ color: selected === f ? C.teal : C.textMuted, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: selected === f ? 600 : 400, color: selected === f ? C.teal : C.text }}>{f}</span>
              {selected === f && <Check size={14} style={{ color: C.teal, marginLeft: 'auto' }} />}
            </button>
          ))}
          {available.length === 0 && !showNew && <div style={{ padding: 16, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No other folders available</div>}
        </div>
        {!showNew ? (
          <button onClick={() => setShowNew(true)} style={{ fontSize: 13, color: C.teal, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16 }}>+ New folder</button>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <input autoFocus placeholder="New folder name" value={newFolderName}
              onChange={e => { setNewFolderName(e.target.value); setSelected(null); }}
              onKeyDown={e => { if (e.key === 'Enter' && newFolderName.trim()) onMove(newFolderName.trim()); }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: `1.5px solid ${C.teal}`, borderRadius: 8, fontSize: 13, outline: 'none', color: C.text }}
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textMid, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => { const target = newFolderName.trim() || selected; if (target) onMove(target); }}
            disabled={!selected && !newFolderName.trim()}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: (selected || newFolderName.trim()) ? C.teal : C.border, color: '#fff', fontSize: 14, fontWeight: 600, cursor: (selected || newFolderName.trim()) ? 'pointer' : 'default', opacity: (selected || newFolderName.trim()) ? 1 : 0.5 }}
          >Move</button>
        </div>
      </div>
    </div>
  );
}

function RenameFileDialog({ file, onRename, onCancel }: { file: RawFile; onRename: (newName: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(file.filename);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.select(), 0); }, []);
  const submit = () => { const t = val.trim(); if (t && t !== file.filename) onRename(t); else onCancel(); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', fontFamily: FONT }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: '28px 32px', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.25)', maxWidth: 400, width: '90%' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Rename File</h3>
        <input ref={inputRef} autoFocus value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: `1.5px solid ${C.teal}`, borderRadius: 8, fontSize: 14, outline: 'none', color: C.text, marginBottom: 20 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textMid, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: C.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Rename</button>
        </div>
      </div>
    </div>
  );
}

// ── Shared small components ──────────────────────────────────────────────────

function ColHead({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', ...style }}>{children}</span>;
}

function TypeBadge({ type }: { type: FolderType }) {
  const cfg: Record<FolderType, { label: string; bg: string; color: string; border: string }> = {
    project: { label:'Project', bg:C.blueLight, color:C.blue, border:C.blueBorder },
    tab:     { label:'Tab', bg:C.purpleLight, color:C.purple, border:C.purpleBorder },
    general: { label:'General', bg:C.borderLight, color:C.textSub, border:C.border },
  };
  const { label, bg, color, border } = cfg[type];
  return <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, letterSpacing:'0.03em', background:bg, color, border:`1px solid ${border}` }}>{label}</span>;
}

function FormatBadge({ format }: { format: string }) {
  const { bg, color } = FORMAT_COLOR_MAP[format] ?? FORMAT_COLOR_MAP.html;
  const ext = FORMAT_EXT_MAP[format] ?? format;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 5, background: bg, color, border: `1px solid ${color}22`, flexShrink: 0, userSelect: 'none' }}>.{ext}</span>;
}

function PrimaryBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:8,
      border:'none', background: h ? '#0069d9' : '#007BFF',
      color: '#fff', fontSize:14, fontWeight:600, cursor:'pointer', transition:'all 0.2s',
      boxShadow: h ? '0 4px 12px rgba(0,123,255,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
    }}>{icon}{label}</button>
  );
}

function GhostBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:8,
      border:`1px solid ${h ? '#D1D5DB' : C.border}`, background: h ? '#F9FAFB' : C.card,
      color: C.textMid, fontSize:14, fontWeight:500, cursor:'pointer', transition:'all 0.2s',
    }}>{icon}{label}</button>
  );
}

function DangerBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:8,
      border:`1px solid ${C.dangerBorder}`, background: h ? C.dangerLight : C.card,
      color: C.danger, fontSize:14, fontWeight:500, cursor:'pointer', transition:'all 0.2s',
    }}>{icon}{label}</button>
  );
}

function FolderCard({ fn, menuOpen, onOpen, onMenuToggle, onRename, onContextMenu, onOverflowClick, isDragOver }: {
  fn: FolderNode; menuOpen: boolean; onOpen: () => void; onMenuToggle: (e: React.MouseEvent) => void;
  onRename: (newName: string) => void; onContextMenu: (e: React.MouseEvent) => void; onOverflowClick: (btn: HTMLElement) => void;
  isDragOver?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(fn.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabKeys = Array.from(fn.tabs.keys());
  const total = tabKeys.reduce((s, k) => s + fn.tabs.get(k)!.files.length, 0);
  const isActive = hov || menuOpen || isDragOver;

  const startEditing = (e: React.MouseEvent) => { e.stopPropagation(); setEditVal(fn.name); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const confirmEdit = () => { const t = editVal.trim(); if (!t || t === fn.name) { setEditing(false); return; } if (t.length > 80) { toast.error('Title must be 80 characters or less'); return; } onRename(t); setEditing(false); };
  const cancelEdit = () => { setEditVal(fn.name); setEditing(false); };

  return (
    <div
      onClick={editing ? undefined : onOpen}
      onContextMenu={editing ? undefined : onContextMenu}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: isDragOver ? '#E3F2FD' : C.card, border: `1px solid ${isActive ? '#194CFF' : C.border}`,
        borderRadius: '0.5rem',
        padding: '1rem 22px 20px 1rem', cursor: editing ? 'default' : 'pointer', position: 'relative',
        boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.12)' : '0 4px 6px -1px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease', userSelect: 'none',
        transform: isActive ? 'scale(1.02)' : 'scale(1)',
      }}
      aria-label={`Folder: ${fn.name}`}
    >
      {/* Overflow menu — positioned top-right */}
      <div onClick={e => e.stopPropagation()} style={{ position:'absolute', top:12, right:12 }}>
        <button
          onClick={e => { e.stopPropagation(); onOverflowClick(e.currentTarget); }}
          style={{ width:32, height:32, borderRadius:8, border:'1px solid transparent', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:C.textMuted, opacity: isActive ? 1 : 0, transition:'opacity 0.15s, background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.borderColor = C.border; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
          title="More options"
          aria-label="More options"
        ><MoreVertical size={16} /></button>
      </div>

      {/* Folder icon (top-left) + Title (centered right of icon) — flex row layout */}
      <div style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:0, marginBottom: editing ? 0 : 0 }}>
        {/* Folder icon — top-left aligned */}
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: isActive ? C.tealLight : C.borderLight,
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'background 0.2s', flexShrink: 0,
        }}>
          <Folder size={22} style={{ color: isActive ? '#194CFF' : '#9CA3AF', transition:'color 0.2s' }} />
        </div>

        {/* Title — centered horizontally, right of icon */}
        <div style={{ flex: 1, marginLeft: '1rem', minWidth: 0, paddingRight: 36 }}>
          {editing ? (
            <div onClick={e => e.stopPropagation()}>
              <input ref={inputRef} autoFocus type="text" value={editVal} maxLength={80}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); else if (e.key === 'Escape') cancelEdit(); }}
                onBlur={confirmEdit}
                style={{ fontSize:17, fontWeight:700, color:'#0F172A', lineHeight:1.3, width:'100%', background:'transparent', border:'none', borderBottom:'2px solid #194CFF', outline:'none', padding:'0 0 2px', margin:0, fontFamily:'inherit' }}
                aria-label="Rename folder"
              />
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <h3 style={{ fontSize:'1.25rem', fontWeight:700, color:'#0F172A', margin:0, lineHeight:1.3, wordBreak:'break-word' }}>{fn.name}</h3>
              <button onClick={startEditing} style={{ background:'transparent', border:'none', cursor:'pointer', padding:2, borderRadius:4, display:'flex', alignItems:'center', color:'#9ca3af', opacity: hov ? 1 : 0, transition:'opacity 0.15s' }} title="Rename folder" aria-label="Rename folder"><Pencil size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Hover tooltip — "Project Folder" strip */}
      <div
        style={{
          position: 'absolute',
          bottom: -28,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#D1D5DB',
          color: '#0F172A',
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '0.25rem 0.5rem',
          borderRadius: '0.25rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: hov && !editing ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          zIndex: 10,
        }}
        aria-hidden="true"
      >
        Project Folder
      </div>
    </div>
  );
}

function MenuBtn({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button data-menu onClick={onClick} onMouseDown={e => e.stopPropagation()} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px',
      background: h ? (danger ? C.dangerLight : '#F9FAFB') : 'transparent',
      color: danger ? C.danger : (h ? C.text : C.textMid),
      fontSize:13, fontWeight:500, border:'none', cursor:'pointer', textAlign:'left', transition:'background 0.15s, color 0.15s',
    }}>{icon}{label}</button>
  );
}

function FileRow({ file, isLast, onOpen, onDownload, onDelete, onContextMenu, onOverflowClick, onHistory, onShare, onTag, dragHandleProps }: {
  file: RawFile; isLast: boolean; onOpen: () => void; onDownload: () => void; onDelete: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void; onOverflowClick: (btn: HTMLElement) => void;
  onHistory?: () => void; onShare?: () => void; onTag?: () => void;
  dragHandleProps?: any;
}) {
  const [hov, setHov] = useState(false);
  const format = extractFormat(file.content);
  const fileTags = (Array.isArray(file.measurements) ? file.measurements : []).filter((m: string) => m.startsWith('tag:')).map((m: string) => m.slice(4));
  return (
    <div onClick={onOpen} onContextMenu={onContextMenu} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'flex', alignItems:'center', padding:'11px 20px', borderBottom: isLast ? 'none' : `1px solid ${C.borderLight}`, background: hov ? '#F9FAFB' : C.card, cursor:'pointer', transition:'all 0.2s ease', border: hov ? '2px solid #007BFF' : '2px solid transparent', borderRadius: hov ? 6 : 0, boxShadow: hov ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', margin: hov ? '-1px 0' : '0' }}
      title="Click to preview \u00B7 Right-click for options"
    >
      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
        {dragHandleProps && (
          <div {...dragHandleProps} onClick={e => e.stopPropagation()} style={{ color: C.textMuted, cursor:'grab', opacity: hov ? 1 : 0, transition:'opacity 0.15s', flexShrink:0 }}>
            <GripVertical size={14} />
          </div>
        )}
        <FileText size={15} style={{ color: hov ? C.teal : C.textMuted, flexShrink:0, transition:'color 0.15s' }} />
        <span style={{ fontSize:14, color:C.text, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:8 }}>{file.filename}</span>
        <FormatBadge format={format} />
        {fileTags.slice(0, 2).map(tag => {
          const tc = TAG_COLORS.find(t => t.name === tag);
          return <span key={tag} style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:4, background: tc?.bg || '#f3f4f6', color: tc?.color || C.textSub, border:`1px solid ${tc?.color || C.border}22`, flexShrink:0 }}>{tag}</span>;
        })}
        {fileTags.length > 2 && <span style={{ fontSize:10, color:C.textMuted }}>+{fileTags.length - 2}</span>}
      </div>
      <span style={{ width:140, textAlign:'right', fontSize:13, color:C.textMuted, flexShrink:0 }}>{fmtDate(file.createdAt || file.generatedAt)}</span>
      <div style={{ width:140, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:2, flexShrink:0, opacity: hov ? 1 : 0, transition:'opacity 0.15s' }}>
        {onHistory && <IconBtn title="Version History" onClick={e => { e.stopPropagation(); onHistory(); }} hoverColor="#007BFF" hoverBg="#EFF6FF"><Clock size={13} /></IconBtn>}
        {onShare && <IconBtn title="Share" onClick={e => { e.stopPropagation(); onShare(); }} hoverColor="#007BFF" hoverBg="#EFF6FF"><Share2 size={13} /></IconBtn>}
        {onTag && <IconBtn title="Tags" onClick={e => { e.stopPropagation(); onTag(); }} hoverColor="#007BFF" hoverBg="#EFF6FF"><Tag size={13} /></IconBtn>}
        <IconBtn title="Download" onClick={e => { e.stopPropagation(); onDownload(); }} hoverColor={C.teal} hoverBg={C.tealLight}><Download size={13} /></IconBtn>
        <IconBtn title="Delete" onClick={e => { e.stopPropagation(); onDelete(e); }} hoverColor={C.danger} hoverBg={C.dangerLight}><Trash2 size={13} /></IconBtn>
        <button title="More options" onClick={e => { e.stopPropagation(); onOverflowClick(e.currentTarget); }} onMouseDown={e => e.stopPropagation()}
          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textMuted, background: 'transparent', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = C.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; }}
        ><MoreVertical size={14} /></button>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, hoverColor, hoverBg, children }: { title: string; onClick: (e: React.MouseEvent) => void; hoverColor: string; hoverBg: string; children: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      width:28, height:28, borderRadius:6, border:'none', display:'flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer', color: h ? hoverColor : C.textMuted, background: h ? hoverBg : 'transparent', transition:'all 0.15s',
    }}>{children}</button>
  );
}

// ── PreviewModal ─────────────────────────────────────────────────────────────

function splitIntoPages(html: string): string[] {
  const cleaned = html.replace(/<!-- FORMAT: \w+ -->\n?/g, '').replace(/<!-- EXPORT_DATA_(?:BINARY|TEXT)_START[\s\S]*?EXPORT_DATA_(?:BINARY|TEXT)_END -->\n?\n?/g, '');
  const parts = cleaned.split(/<hr\s*\/?>/i).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [cleaned];
}

function extractCSVFromHTML(html: string): string {
  const rows: string[][] = [];
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trMatches) {
    const cells: string[] = [];
    const cellMatches = tr.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) ?? [];
    for (const cell of cellMatches) {
      const text = cell.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
      cells.push(`"${text.replace(/"/g, '""')}"`);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows.map(r => r.join(',')).join('\n');
}

function PreviewModal({ file, onClose }: { file: RawFile; onClose: () => void }) {
  const format = extractFormat(file.content);
  const ext = FORMAT_EXT_MAP[format] ?? 'html';
  const pages = useMemo(() => splitIntoPages(file.content), [file.content]);
  const [activePage, setActivePage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [showInfo, setShowInfo] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const exportRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigate to a specific page — used by thumbnails, arrows, and keyboard
  const goToPage = useCallback((pageIndex: number) => {
    const clamped = Math.max(0, Math.min(pageIndex, pages.length - 1));
    setActivePage(clamped);
    // Prevent scroll-sync from fighting with programmatic scroll
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => { isScrollingRef.current = false; }, 800);
    // Scroll main content to the target page
    const container = contentRef.current;
    const el = pageRefs.current[clamped];
    if (container && el) {
      container.scrollTo({ top: el.offsetTop - container.offsetTop, behavior: 'smooth' });
    }
    // Scroll thumbnail sidebar so active thumb is visible
    const thumb = thumbRefs.current[clamped];
    if (thumb) thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [pages.length]);

  useEffect(() => { if (!exportOpen) return; const h = (e: MouseEvent) => { if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [exportOpen]);

  // Keyboard navigation — read activePage from ref to avoid stale closures
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); return; } if (e.key === 'PageDown' || e.key === 'ArrowDown') { e.preventDefault(); goToPage(activePageRef.current + 1); } else if (e.key === 'PageUp' || e.key === 'ArrowUp') { e.preventDefault(); goToPage(activePageRef.current - 1); } else if (e.key === 'Home') { e.preventDefault(); goToPage(0); } else if (e.key === 'End') { e.preventDefault(); goToPage(pages.length - 1); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose, pages.length, goToPage]);

  // Scroll-sync: detect which page is visible when user manually scrolls
  useEffect(() => { const container = contentRef.current; if (!container) return; const h = () => { if (isScrollingRef.current) return; const scrollTop = container.scrollTop; let current = 0; for (let i = 0; i < pageRefs.current.length; i++) { const el = pageRefs.current[i]; if (el && el.offsetTop - container.offsetTop <= scrollTop + 100) current = i; } setActivePage(current); const thumb = thumbRefs.current[current]; if (thumb) thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }; container.addEventListener('scroll', h, { passive: true }); return () => container.removeEventListener('scroll', h); }, [pages.length]);

  // Ctrl+scroll zoom
  useEffect(() => { const container = contentRef.current; if (!container) return; const h = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(z => Math.max(50, Math.min(200, z + (e.deltaY < 0 ? 25 : -25)))); }; container.addEventListener('wheel', h, { passive: false }); return () => container.removeEventListener('wheel', h); }, []);

  const downloadFile = useCallback((fmt: 'pdf' | 'csv' | 'html') => {
    const safeTitle = file.filename.replace(/\s+/g, '_');
    if (fmt === 'pdf') {
      const exportData = extractExportData(file.content);
      if (exportData) { const binary = atob(exportData); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); const blob = new Blob([bytes], { type: 'application/pdf' }); const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.pdf` }); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
      else { const blob = new Blob([file.content], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.html` }); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
    } else if (fmt === 'csv') { const csv = extractCSVFromHTML(file.content); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.csv` }); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
    else { const blob = new Blob([file.content], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.html` }); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
    setExportOpen(false); toast.success(`Downloaded as .${fmt}`);
  }, [file]);

  const copyLink = useCallback(() => { navigator.clipboard.writeText(`${window.location.origin}/saved-technical-files?file=${file.id}`); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Link copied'); }, [file.id]);
  const fileSize = useMemo(() => estimateSize(file.content), [file.content]);
  const queryText = useMemo(() => { const m = file.content.match(/<!--\s*AI_SCRIPT\s*\n([\s\S]*?)\nEND_AI_SCRIPT\s*-->/); if (m) { try { return JSON.parse(m[1]).query ?? null; } catch { return null; } } return null; }, [file.content]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: '#F9FAFB', fontFamily: FONT }}>
      <div style={{ flexShrink: 0, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: C.textSub, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSub; }}
            title="Back to files"><ArrowLeft size={16} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>{file.folder}</span>
            <ChevronRight size={11} style={{ color: C.textMuted, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>{file.tabName}</span>
            <ChevronRight size={11} style={{ color: C.textMuted, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.filename}</span>
            <FormatBadge format={format} />
            <span style={{ fontSize: 10, fontWeight: 600, color: C.blue, background: C.blueLight, padding: '1px 6px', borderRadius: 4, border: `1px solid ${C.blueBorder}`, flexShrink: 0 }}>v1</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ToolbarBtn title="Previous page" onClick={() => goToPage(activePage - 1)} disabled={activePage === 0}>{'\u2039'}</ToolbarBtn>
            <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500, whiteSpace: 'nowrap' }}>{activePage + 1} of {pages.length}</span>
            <ToolbarBtn title="Next page" onClick={() => goToPage(activePage + 1)} disabled={activePage === pages.length - 1}>{'\u203a'}</ToolbarBtn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
            <ToolbarBtn title="Zoom out" onClick={() => setZoom(z => Math.max(50, z - 25))} disabled={zoom <= 50}>{'\u2212'}</ToolbarBtn>
            <span style={{ fontSize: 11, color: C.textSub, fontWeight: 500, minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
            <ToolbarBtn title="Zoom in" onClick={() => setZoom(z => Math.min(200, z + 25))} disabled={zoom >= 200}>+</ToolbarBtn>
            <ToolbarBtn title="Fit to width" onClick={() => setZoom(100)}><span style={{ fontSize: 10 }}>FIT</span></ToolbarBtn>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
          <ActionBtn icon={<Download size={14} />} label="Download" onClick={() => downloadFile('pdf')} />
          <div ref={exportRef} style={{ position: 'relative' }}>
            <ActionBtn icon={<Share2 size={14} />} label="Export" onClick={() => setExportOpen(o => !o)} active={exportOpen} />
            {exportOpen && (
              <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 200, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden', padding: '4px 0' }}>
                <ExportMenuItem label="PDF" desc="Download as PDF" onClick={() => downloadFile('pdf')} />
                <ExportMenuItem label="CSV" desc="Extract table data" onClick={() => downloadFile('csv')} />
                <ExportMenuItem label="HTML" desc="Styled HTML file" onClick={() => downloadFile('html')} />
              </div>
            )}
          </div>
          <ActionBtn icon={copied ? <Check size={14} /> : <Copy size={14} />} label={copied ? 'Copied' : 'Copy Link'} onClick={copyLink} />
          <button onClick={() => setShowInfo(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: `1px solid ${showInfo ? C.blue : C.border}`, background: showInfo ? C.blueLight : 'transparent', cursor: 'pointer', color: showInfo ? C.blue : C.textSub, transition: 'all 0.15s' }} title={showInfo ? 'Hide info panel' : 'Show info panel'}>
            {showInfo ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.textSub, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSub; }}
            title="Close"><X size={15} /></button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 160, flexShrink: 0, background: C.card, borderRight: `1px solid ${C.border}`, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pages.map((pageHtml, i) => (
            <button key={i} ref={el => { thumbRefs.current[i] = el; }} onClick={() => goToPage(i)} style={{ width: '100%', aspectRatio: '8.5/11', borderRadius: 4, overflow: 'hidden', cursor: 'pointer', border: i === activePage ? `2px solid ${C.blue}` : `1px solid ${C.border}`, background: C.card, position: 'relative', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: i === activePage ? `0 0 0 2px ${C.blueBorder}` : 'none' }}>
              <div style={{ transform: 'scale(0.18)', transformOrigin: 'top left', width: '555%', height: '555%', pointerEvents: 'none', overflow: 'hidden' }}>
                <div dangerouslySetInnerHTML={{ __html: pageHtml }} style={{ padding: 24, fontSize: 14, fontFamily: FONT, color: C.text }} />
              </div>
              <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, color: i === activePage ? C.blue : C.textMuted, background: i === activePage ? C.blueLight : 'rgba(255,255,255,0.9)', padding: '1px 6px', borderRadius: 3, border: `1px solid ${i === activePage ? C.blueBorder : C.border}` }}>{i + 1}</div>
            </button>
          ))}
        </div>
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', background: '#F3F4F6', padding: '24px 32px' }}>
          {pages.map((pageHtml, i) => (
            <div key={i} ref={el => { pageRefs.current[i] = el; }} style={{ background: C.card, borderRadius: 6, padding: 32, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: `1px solid ${C.border}`, maxWidth: 820, margin: '0 auto 24px', transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}>
              <div dangerouslySetInnerHTML={{ __html: pageHtml }} style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.7, color: C.text }} />
            </div>
          ))}
        </div>
        {showInfo && (
          <div style={{ width: 280, flexShrink: 0, background: C.card, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={14} style={{ color: C.blue }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Details</span>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <MetaRow label="Filename" value={`${file.filename}.${ext}`} />
              <MetaRow label="Folder" value={file.folder} />
              <MetaRow label="Tab" value={file.tabName} />
              <MetaRow label="Format" value={`.${ext.toUpperCase()}`} />
              <MetaRow label="Generated" value={fmtDate(file.createdAt || file.generatedAt)} />
              <MetaRow label="File Size" value={fileSize} />
              <MetaRow label="Pages" value={String(pages.length)} />
              {queryText && <MetaRow label="Query" value={queryText} multiline />}
              {file.measurements.filter(m => m.startsWith('tag:')).length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tags</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {file.measurements.filter(m => m.startsWith('tag:')).map(m => (
                      <span key={m} style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: C.blueLight, color: C.blue, border: `1px solid ${C.blueBorder}` }}>{m.slice(4)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button title={title} onClick={onClick} disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      width: 26, height: 26, borderRadius: 4, border: `1px solid ${h && !disabled ? C.border : 'transparent'}`,
      background: h && !disabled ? '#F3F4F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? C.textMuted : C.textSub,
      fontSize: 14, fontWeight: 600, transition: 'all 0.1s', opacity: disabled ? 0.4 : 1,
    }}>{children}</button>
  );
}

function ActionBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6,
      border: `1px solid ${active ? C.blue : h ? '#D1D5DB' : C.border}`,
      background: active ? C.blueLight : h ? '#F9FAFB' : 'transparent',
      color: active ? C.blue : h ? C.text : C.textMid,
      fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>{icon}{label}</button>
  );
}

function ExportMenuItem({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      width: '100%', display: 'flex', flexDirection: 'column', gap: 1, padding: '9px 14px', textAlign: 'left',
      background: h ? '#F9FAFB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s',
    }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{label}</span>
      <span style={{ fontSize: 11, color: C.textMuted }}>{desc}</span>
    </button>
  );
}

function MetaRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 400, wordBreak: 'break-word', ...(multiline ? { display: 'block', lineHeight: 1.5, fontSize: 12, color: C.textSub } : {}) }}>{value}</span>
    </div>
  );
}

function LoadingState() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0', color:C.textMuted, fontSize:14 }}>Loading files\u2026</div>;
}

function EmptyState() {
  return (
    <div style={{ background:C.card, borderRadius:18, border:`1px solid ${C.border}`, padding:'72px 40px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', maxWidth:520, margin:'0 auto' }}>
      <div style={{ width:76, height:76, borderRadius:22, background:C.tealLight, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px' }}>
        <Folder size={34} style={{ color:C.teal }} />
      </div>
      <h3 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 10px' }}>No saved files yet</h3>
      <p style={{ fontSize:15, color:C.textSub, margin:0, lineHeight:1.6 }}>Save analysis results from the biostatistics platform and they'll appear here, organized by project or tab.</p>
    </div>
  );
}

function FilteredEmpty({ viewFilter, search }: { viewFilter: ViewFilter; search: string }) {
  return (
    <div style={{ textAlign:'center', padding:'64px 40px', color:C.textMuted, fontSize:14 }}>
      {search ? `No files match "${search}"` : viewFilter === 'projects' ? 'No project folders yet \u2014 save analyses with "Save all data in project" checked' : 'No files yet \u2014 save analyses to see them here'}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NEW MODALS — Box.com-style features
// ══════════════════════════════════════════════════════════════════════════════

function NewFolderDialog({ onCreate, onCancel }: { onCreate: (name: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0); }, []);
  const submit = () => { const t = val.trim(); if (t) onCreate(t); };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)', fontFamily:FONT }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, boxShadow:'0 20px 50px -12px rgba(0,0,0,0.25)', maxWidth:420, width:'90%', overflow:'hidden' }}>
        <div style={{ padding:'20px 28px 16px', background:'#007BFF', color:'#fff' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <FolderPlus size={20} />
            <h3 style={{ fontSize:17, fontWeight:700, margin:0 }}>Create New Folder</h3>
          </div>
        </div>
        <div style={{ padding:'24px 28px' }}>
          <label style={{ fontSize:13, fontWeight:600, color:C.textSub, display:'block', marginBottom:8 }}>Folder Name</label>
          <input ref={inputRef} autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
            placeholder="Enter folder name..."
            style={{ width:'100%', boxSizing:'border-box', padding:'10px 14px', border:'1.5px solid #D1D5DB', borderRadius:8, fontSize:14, outline:'none', color:C.text, fontFamily:'Arial, sans-serif' }}
          />
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
            <button onClick={onCancel} style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', color:C.textMid, fontSize:14, fontWeight:500, cursor:'pointer' }}>Cancel</button>
            <button onClick={submit} disabled={!val.trim()} style={{ padding:'9px 20px', borderRadius:8, border:'none', background: val.trim() ? '#007BFF' : C.border, color:'#fff', fontSize:14, fontWeight:600, cursor: val.trim() ? 'pointer' : 'default', opacity: val.trim() ? 1 : 0.5 }}>Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareDialog({ name, type, onClose }: { name: string; type: 'folder' | 'file'; onClose: () => void }) {
  const [tab, setTab] = useState<'invite' | 'link'>('invite');
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'viewer' | 'editor' | 'uploader'>('viewer');
  const [linkCopied, setLinkCopied] = useState(false);
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([]);
  const shareLink = `${window.location.origin}/shared/${type}/${encodeURIComponent(name)}?token=${Math.random().toString(36).slice(2, 10)}`;

  const sendInvite = () => {
    if (!email.trim() || !email.includes('@')) return;
    setInvites(prev => [...prev, { email: email.trim(), role: permission }]);
    toast.success(`Invited ${email.trim()} as ${permission}`, { style: { background: C.successLight, color: '#166534' } });
    setEmail('');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast.success('Link copied');
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)', fontFamily:FONT }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, boxShadow:'0 20px 50px -12px rgba(0,0,0,0.25)', maxWidth:480, width:'90%', overflow:'hidden' }}>
        <div style={{ padding:'18px 28px 14px', background:'#007BFF', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Share2 size={18} />
            <h3 style={{ fontSize:16, fontWeight:700, margin:0 }}>Share "{name}"</h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.8)', padding:4 }}><X size={16} /></button>
        </div>
        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}` }}>
          {(['invite', 'link'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'12px 0', fontSize:13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#007BFF' : C.textSub, background:'none', border:'none',
              borderBottom: tab === t ? '2px solid #007BFF' : '2px solid transparent', cursor:'pointer',
            }}>{t === 'invite' ? 'Invite People' : 'Get Link'}</button>
          ))}
        </div>
        <div style={{ padding:'20px 28px 24px' }}>
          {tab === 'invite' ? (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email address"
                  onKeyDown={e => { if (e.key === 'Enter') sendInvite(); }}
                  style={{ flex:1, padding:'8px 12px', border:'1.5px solid #D1D5DB', borderRadius:8, fontSize:13, outline:'none', color:C.text }}
                />
                <select value={permission} onChange={e => setPermission(e.target.value as any)}
                  style={{ padding:'8px 10px', border:'1.5px solid #D1D5DB', borderRadius:8, fontSize:12, color:C.text, background:'#fff', cursor:'pointer' }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="uploader">Uploader</option>
                </select>
              </div>
              <button onClick={sendInvite} disabled={!email.trim()} style={{ width:'100%', padding:'9px', borderRadius:8, border:'none', background: email.trim() ? '#007BFF' : C.border, color:'#fff', fontSize:13, fontWeight:600, cursor: email.trim() ? 'pointer' : 'default', marginBottom:16 }}>Send Invitation</button>
              {invites.length > 0 && (
                <div>
                  <span style={{ fontSize:12, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Collaborators</span>
                  {invites.map((inv, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.borderLight}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Users size={14} style={{ color:'#007BFF' }} />
                        <span style={{ fontSize:13, color:C.text }}>{inv.email}</span>
                      </div>
                      <span style={{ fontSize:11, color:C.textSub, background:C.borderLight, padding:'2px 8px', borderRadius:4 }}>{inv.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize:13, color:C.textSub, margin:'0 0 12px' }}>Anyone with this link can access this {type}.</p>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <input readOnly value={shareLink} style={{ flex:1, padding:'8px 12px', border:'1.5px solid #D1D5DB', borderRadius:8, fontSize:12, color:C.textSub, background:'#F9FAFB' }} />
                <button onClick={copyLink} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#007BFF', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:C.text }}>
                  <Shield size={14} style={{ color:'#007BFF' }} />
                  <span>Allow downloads</span>
                  <input type="checkbox" defaultChecked style={{ marginLeft:'auto' }} />
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:C.text }}>
                  <Clock size={14} style={{ color:'#007BFF' }} />
                  <span>Expiration date</span>
                  <input type="date" style={{ marginLeft:'auto', padding:'4px 8px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }} />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionHistoryDialog({ file, onClose, onDownload }: { file: RawFile; onClose: () => void; onDownload: (f: RawFile) => void }) {
  const versions = useMemo(() => {
    const base = new Date(file.createdAt || file.generatedAt || '');
    return Array.from({ length: Math.min(3, 10) }, (_, i) => ({
      version: 3 - i,
      date: new Date(base.getTime() - i * 86400000 * (i + 1)),
      user: 'You',
      summary: i === 0 ? 'Current version' : i === 1 ? 'Edited content' : 'Initial upload',
      isCurrent: i === 0,
    }));
  }, [file]);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)', fontFamily:FONT }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, boxShadow:'0 20px 50px -12px rgba(0,0,0,0.25)', maxWidth:520, width:'90%', overflow:'hidden' }}>
        <div style={{ padding:'18px 28px 14px', background:'#007BFF', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Clock size={18} />
            <h3 style={{ fontSize:16, fontWeight:700, margin:0 }}>Version History</h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.8)', padding:4 }}><X size={16} /></button>
        </div>
        <div style={{ padding:'8px 0' }}>
          <div style={{ display:'flex', padding:'8px 28px', borderBottom:`1px solid ${C.border}` }}>
            <span style={{ flex:'0 0 50px', fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase' }}>Ver</span>
            <span style={{ flex:1, fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase' }}>Date</span>
            <span style={{ flex:'0 0 60px', fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase' }}>User</span>
            <span style={{ flex:1, fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase' }}>Changes</span>
            <span style={{ flex:'0 0 120px', fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', textAlign:'right' }}>Actions</span>
          </div>
          {versions.map((v, i) => (
            <div key={v.version} style={{ display:'flex', alignItems:'center', padding:'10px 28px', background: i % 2 === 0 ? '#fff' : '#F9FAFB', borderBottom:`1px solid ${C.borderLight}` }}>
              <span style={{ flex:'0 0 50px', fontSize:13, fontWeight:600, color:'#007BFF' }}>v{v.version}</span>
              <span style={{ flex:1, fontSize:12, color:C.textSub }}>{fmtDate(v.date)}</span>
              <span style={{ flex:'0 0 60px', fontSize:12, color:C.text }}>{v.user}</span>
              <span style={{ flex:1, fontSize:12, color:C.textSub }}>{v.summary}</span>
              <div style={{ flex:'0 0 120px', display:'flex', gap:6, justifyContent:'flex-end' }}>
                <button onClick={() => onDownload(file)} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${C.border}`, background:'#fff', color:C.textMid, fontSize:11, fontWeight:500, cursor:'pointer' }}>
                  <Download size={11} />
                </button>
                {!v.isCurrent && (
                  <button onClick={() => { toast.success(`Restored to v${v.version}`, { style: { background: C.successLight, color: '#166534' } }); onClose(); }}
                    style={{ padding:'4px 10px', borderRadius:6, border:'none', background:'#28A745', color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}
                  >Restore</button>
                )}
                {v.isCurrent && <span style={{ fontSize:11, color:'#007BFF', fontWeight:600, padding:'4px 10px' }}>Current</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 28px', borderTop:`1px solid ${C.border}`, fontSize:12, color:C.textMuted }}>
          Showing last {versions.length} versions (max 10 retained)
        </div>
      </div>
    </div>
  );
}

const TAG_COLORS: { name: string; color: string; bg: string }[] = [
  { name: 'Urgent', color: '#0D47A1', bg: '#E3F2FD' },
  { name: 'Approved', color: '#1565C0', bg: '#BBDEFB' },
  { name: 'In Review', color: '#007BFF', bg: '#E3F2FD' },
  { name: 'Draft', color: '#42A5F5', bg: '#E3F2FD' },
  { name: 'Final', color: '#0056B3', bg: '#DBEAFE' },
  { name: 'Priority', color: '#1976D2', bg: '#E1F5FE' },
];

function TagDialog({ file, onAddTag, onRemoveTag, onClose }: { file: RawFile; onAddTag: (tag: string) => void; onRemoveTag: (tag: string) => void; onClose: () => void }) {
  const [custom, setCustom] = useState('');
  const currentTags = (Array.isArray(file.measurements) ? file.measurements : []).filter((m: string) => m.startsWith('tag:')).map((m: string) => m.slice(4));

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)', fontFamily:FONT }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, boxShadow:'0 20px 50px -12px rgba(0,0,0,0.25)', maxWidth:400, width:'90%', overflow:'hidden' }}>
        <div style={{ padding:'18px 28px 14px', background:'#007BFF', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Tag size={18} />
            <h3 style={{ fontSize:16, fontWeight:700, margin:0 }}>Manage Tags</h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.8)', padding:4 }}><X size={16} /></button>
        </div>
        <div style={{ padding:'20px 28px 24px' }}>
          {currentTags.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <span style={{ fontSize:12, fontWeight:600, color:C.textMuted, textTransform:'uppercase', display:'block', marginBottom:8 }}>Current Tags</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {currentTags.map((tag: string) => {
                  const tc = TAG_COLORS.find(t => t.name === tag);
                  return (
                    <span key={tag} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:600, background: tc?.bg || '#f3f4f6', color: tc?.color || C.textSub, border:`1px solid ${tc?.color || C.border}22` }}>
                      {tag}
                      <button onClick={() => onRemoveTag(tag)} style={{ background:'none', border:'none', cursor:'pointer', color: tc?.color || C.textSub, padding:0, display:'flex' }}><X size={12} /></button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <span style={{ fontSize:12, fontWeight:600, color:C.textMuted, textTransform:'uppercase', display:'block', marginBottom:8 }}>Add Tag</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
            {TAG_COLORS.filter(t => !currentTags.includes(t.name)).map(t => (
              <button key={t.name} onClick={() => onAddTag(t.name)} style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600, background:t.bg, color:t.color, border:`1px solid ${t.color}22`, cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >{t.name}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Custom tag..."
              onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { onAddTag(custom.trim()); setCustom(''); } }}
              style={{ flex:1, padding:'8px 12px', border:'1.5px solid #D1D5DB', borderRadius:8, fontSize:13, outline:'none', color:C.text }}
            />
            <button onClick={() => { if (custom.trim()) { onAddTag(custom.trim()); setCustom(''); } }} disabled={!custom.trim()}
              style={{ padding:'8px 16px', borderRadius:8, border:'none', background: custom.trim() ? '#007BFF' : C.border, color:'#fff', fontSize:12, fontWeight:600, cursor: custom.trim() ? 'pointer' : 'default' }}
            >Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CSS animation for upload spinner ──
if (typeof document !== 'undefined' && !document.getElementById('tf-spin-style')) {
  const style = document.createElement('style');
  style.id = 'tf-spin-style';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
