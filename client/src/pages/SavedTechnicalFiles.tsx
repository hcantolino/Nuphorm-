import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Download,
  Trash2,
  Search,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  X,
  Share2,
  Copy,
  Check,
  Info,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

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
} as const;

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewFilter  = 'all' | 'projects' | 'tabs';
type FolderType  = 'project' | 'tab' | 'general';

interface RawFile {
  id: number;
  title: string;
  content: string;
  generatedAt: string | Date;
  measurements: string[];
  dataFiles: string[];
  // Derived
  folder: string;
  tabName: string;
  filename: string;
  folderType: FolderType;
}

interface TabNode   { name: string; files: RawFile[] }
interface FolderNode { name: string; tabs: Map<string, TabNode>; folderType: FolderType; latestDate: Date }

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
  const ms: string[] = Array.isArray(raw.measurements) ? raw.measurements : [];
  const isProj = ms.includes('foldertype:project');
  const isTab  = ms.includes('foldertype:tab');
  if (vf === 'projects') return isProj;
  return isTab || (!isProj && !isTab);
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Format extraction helpers ─────────────────────────────────────────────────

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
  csv:  { bg: '#f0fdf4', color: '#16a34a' },
  xlsx: { bg: '#f0fdf4', color: '#15803d' },
  pdf:  { bg: '#fef2f2', color: '#dc2626' },
  json: { bg: '#fff7ed', color: '#ea580c' },
  sas:  { bg: '#eff6ff', color: '#2563eb' },
  dta:  { bg: '#EFF6FF', color: '#3b82f6' },
  html: { bg: '#f8fafc', color: '#64748b' },
};

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

    if (!tree.has(folder)) {
      tree.set(folder, { name: folder, tabs: new Map(), folderType, latestDate: new Date(raw.generatedAt) });
    }
    const fn = tree.get(folder)!;
    if (folderType === 'project') fn.folderType = 'project';
    else if (folderType === 'tab' && fn.folderType === 'general') fn.folderType = 'tab';
    const d = new Date(raw.generatedAt);
    if (d > fn.latestDate) fn.latestDate = d;
    if (!fn.tabs.has(tabName)) fn.tabs.set(tabName, { name: tabName, files: [] });
    fn.tabs.get(tabName)!.files.push(file);
  }

  Array.from(tree.values()).forEach(fn =>
    Array.from(fn.tabs.values()).forEach(tab =>
      tab.files.sort((a: RawFile, b: RawFile) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
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
  const [openFolder, setOpenFolder]   = useState<string | null>(null); // drill-down
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());
  const [menuKey, setMenuKey]   = useState<string | null>(null);
  const [preview, setPreview]   = useState<RawFile | null>(null);
  const [searchFocus, setSearchFocus] = useState(false);

  const { data: rawFiles = [], isLoading, refetch } = trpc.technical.getFiles.useQuery();
  const deleteMutation = trpc.technical.deleteFile.useMutation();

  const tree       = useMemo(() => buildTree(rawFiles, search, viewFilter), [rawFiles, search, viewFilter]);
  const folderKeys = useMemo(() => Array.from(tree.keys()).sort(), [tree]);

  // Close three-dot menu on outside click
  useEffect(() => {
    if (!menuKey) return;
    const h = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest('[data-menu]')) setMenuKey(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuKey]);

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
      // Legacy / HTML fallback
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
    if (!confirm(`Delete all ${files.length} file(s) in "${name}"?`)) return;
    try {
      for (const f of files) await deleteMutation.mutateAsync({ fileId: f.id });
      toast.success(`Folder "${name}" deleted`);
      if (openFolder === name) setOpenFolder(null);
      refetch();
    } catch { toast.error('Some files failed to delete'); }
  };

  const toggleTab = (key: string) => {
    setExpandedTabs(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Folder drill-down view ────────────────────────────────────────────────────

  if (openFolder !== null) {
    const fn = tree.get(openFolder);
    if (!fn) { setOpenFolder(null); return null; }
    const tabKeys       = Array.from(fn.tabs.keys()).sort();
    const totalFolderFiles = tabKeys.reduce((s, k) => s + fn.tabs.get(k)!.files.length, 0);

    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
        {/* Header */}
        <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '22px 40px 24px' }}>
          {/* Breadcrumb */}
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
                {' · '}Last modified {fmtDate(fn.latestDate)}
              </p>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <GhostBtn icon={<Download size={14} />} label="Download All" onClick={() => dlFolder(openFolder)} />
              <DangerBtn icon={<Trash2 size={14} />}  label="Delete All"   onClick={() => delFolder(openFolder)} />
            </div>
          </div>
        </div>

        {/* File tree */}
        <div style={{ padding:'32px 40px', maxWidth:1100, margin:'0 auto' }}>
          {tabKeys.map((tabName, ti) => {
            const tab    = fn.tabs.get(tabName)!;
            const tabKey = `${openFolder}::${tabName}`;
            const isOpen = expandedTabs.has(tabKey);
            const isLast = ti === tabKeys.length - 1;
            return (
              <div key={tabKey} style={{ marginBottom: isLast ? 0 : 16 }}>
                {/* Tab header */}
                <div
                  onClick={() => toggleTab(tabKey)}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'13px 20px',
                    background: C.card, border:`1px solid ${C.border}`,
                    borderRadius: isOpen ? '12px 12px 0 0' : 12,
                    cursor:'pointer', userSelect:'none', transition:'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.card)}
                >
                  {isOpen
                    ? <ChevronDown  size={15} style={{ color:C.textMuted, flexShrink:0 }} />
                    : <ChevronRight size={15} style={{ color:C.textMuted, flexShrink:0 }} />}
                  {isOpen
                    ? <FolderOpen size={17} style={{ color:C.blue, flexShrink:0 }} />
                    : <Folder     size={17} style={{ color:C.blue, flexShrink:0 }} />}
                  <span style={{ fontSize:15, fontWeight:600, color:C.text, flex:1 }}>{tabName}</span>
                  <span style={{ fontSize:12, color:C.textSub, background:C.borderLight, padding:'2px 10px', borderRadius:20 }}>
                    {tab.files.length} file{tab.files.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Files */}
                {isOpen && (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderTop:'none', borderRadius:'0 0 12px 12px', overflow:'hidden' }}>
                    {/* Column headers */}
                    <div style={{ display:'flex', alignItems:'center', padding:'8px 20px', background:'#F9FAFB', borderBottom:`1px solid ${C.border}` }}>
                      <ColHead style={{ flex:1 }}>Name</ColHead>
                      <ColHead style={{ width:140, textAlign:'right' }}>Date Modified</ColHead>
                      <ColHead style={{ width:88, textAlign:'right' }}>Actions</ColHead>
                    </div>
                    {tab.files.map((file, fIdx) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        isLast={fIdx === tab.files.length - 1}
                        onOpen={() => setPreview(file)}
                        onDownload={() => dlFile(file)}
                        onDelete={e => delFile(file, e)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
      </div>
    );
  }

  // ── Grid view ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:FONT }}>
      {/* ── Header ── */}
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:'22px 40px 0' }}>
        {/* Back link */}
        <div style={{ marginBottom:18 }}>
          <button
            onClick={() => setLocation('/')}
            style={{ display:'flex', alignItems:'center', gap:5, color:C.teal, fontSize:14, fontWeight:500, background:'none', border:'none', cursor:'pointer', padding:0 }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        {/* Title + search */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:24, marginBottom:22 }}>
          <div>
            <h1 style={{ fontSize:30, fontWeight:700, color:C.text, margin:'0 0 6px', lineHeight:1.2 }}>
              Technical Files
            </h1>
            <p style={{ fontSize:15, color:C.textSub, margin:0 }}>
              {rawFiles.length} file{rawFiles.length !== 1 ? 's' : ''} across {folderKeys.length} folder{folderKeys.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Search */}
          <div style={{ position:'relative', width:380 }}>
            <Search
              size={15}
              style={{
                position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
                color: searchFocus ? C.teal : C.textMuted,
                pointerEvents:'none', transition:'color 0.2s', flexShrink:0,
              }}
            />
            <input
              type="text"
              placeholder="Search files, folders, or tabs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              style={{
                width:'100%', boxSizing:'border-box',
                paddingLeft:40, paddingRight:16, paddingTop:10, paddingBottom:10,
                border:`1.5px solid ${searchFocus ? C.teal : '#D1D5DB'}`,
                borderRadius:10, fontSize:14, color:C.text, background:C.card,
                outline:'none', transition:'border-color 0.2s, box-shadow 0.2s',
                boxShadow: searchFocus ? `0 0 0 3px rgba(37,99,235,0.12)` : 'none',
              }}
            />
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display:'flex', alignItems:'center', borderTop:`1px solid ${C.borderLight}` }}>
          {([
            { key:'all'      as ViewFilter, label:'All Files' },
            { key:'projects' as ViewFilter, label:'Projects'  },
            { key:'tabs'     as ViewFilter, label:'Tabs'      },
          ]).map(({ key, label }) => {
            const active = viewFilter === key;
            return (
              <button
                key={key}
                onClick={() => setVF(key)}
                style={{
                  padding:'14px 22px', fontSize:14,
                  fontWeight: active ? 600 : 400,
                  color: active ? C.text : C.textSub,
                  background:'none', border:'none',
                  borderBottom: active ? `2.5px solid ${C.teal}` : '2.5px solid transparent',
                  cursor:'pointer', marginBottom:-1, transition:'all 0.2s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = C.text; e.currentTarget.style.background = '#F9FAFB'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = C.textSub; e.currentTarget.style.background = 'none'; } }}
              >
                {label}
              </button>
            );
          })}
          <div style={{ flex:1 }} />
          <span style={{ fontSize:13, color:C.textMuted, paddingRight:4, paddingBottom:14 }}>
            {folderKeys.length} folder{folderKeys.length !== 1 ? 's' : ''} shown
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding:'36px 40px', maxWidth:1360, margin:'0 auto' }}>
        {isLoading ? (
          <LoadingState />
        ) : rawFiles.length === 0 ? (
          <EmptyState />
        ) : folderKeys.length === 0 ? (
          <FilteredEmpty viewFilter={viewFilter} search={search} />
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:24 }}>
            {folderKeys.map(name => {
              const fn = tree.get(name)!;
              return (
                <FolderCard
                  key={name}
                  fn={fn}
                  menuOpen={menuKey === name}
                  onOpen={() => { setOpenFolder(name); setExpandedTabs(new Set()); }}
                  onMenuToggle={e => { e.stopPropagation(); setMenuKey(menuKey === name ? null : name); }}
                  onDownloadAll={() => { setMenuKey(null); dlFolder(name); }}
                  onDeleteAll={() => { setMenuKey(null); delFolder(name); }}
                />
              );
            })}
          </div>
        )}
      </div>

      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColHead({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', ...style }}>
      {children}
    </span>
  );
}

function TypeBadge({ type }: { type: FolderType }) {
  const cfg: Record<FolderType, { label: string; bg: string; color: string; border: string }> = {
    project: { label:'Project', bg:C.blueLight,   color:C.blue,   border:C.blueBorder   },
    tab:     { label:'Tab',     bg:C.purpleLight,  color:C.purple, border:C.purpleBorder },
    general: { label:'General', bg:C.borderLight,  color:C.textSub,border:C.border       },
  };
  const { label, bg, color, border } = cfg[type];
  return (
    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, letterSpacing:'0.03em', background:bg, color, border:`1px solid ${border}` }}>
      {label}
    </span>
  );
}

function FormatBadge({ format }: { format: string }) {
  const { bg, color } = FORMAT_COLOR_MAP[format] ?? FORMAT_COLOR_MAP.html;
  const ext = FORMAT_EXT_MAP[format] ?? format;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      padding: '2px 7px', borderRadius: 5,
      background: bg, color,
      border: `1px solid ${color}22`,
      flexShrink: 0, userSelect: 'none',
    }}>
      .{ext}
    </span>
  );
}

function GhostBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:8,
        border:`1px solid ${h ? '#D1D5DB' : C.border}`, background: h ? '#F9FAFB' : C.card,
        color: C.textMid, fontSize:14, fontWeight:500, cursor:'pointer', transition:'all 0.2s',
      }}
    >
      {icon}{label}
    </button>
  );
}

function DangerBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:8,
        border:`1px solid ${h ? C.dangerBorder : C.dangerBorder}`, background: h ? C.dangerLight : C.card,
        color: C.danger, fontSize:14, fontWeight:500, cursor:'pointer', transition:'all 0.2s',
      }}
    >
      {icon}{label}
    </button>
  );
}

// ── FolderCard ────────────────────────────────────────────────────────────────

function FolderCard({
  fn, menuOpen,
  onOpen, onMenuToggle, onDownloadAll, onDeleteAll,
}: {
  fn: FolderNode;
  menuOpen: boolean;
  onOpen: () => void;
  onMenuToggle: (e: React.MouseEvent) => void;
  onDownloadAll: () => void;
  onDeleteAll: () => void;
}) {
  const [hov, setHov] = useState(false);
  const tabKeys  = Array.from(fn.tabs.keys());
  const total    = tabKeys.reduce((s, k) => s + fn.tabs.get(k)!.files.length, 0);
  const isActive = hov || menuOpen;

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: C.card,
        border: `1px solid ${isActive ? C.teal : C.border}`,
        borderLeft: `4px solid ${isActive ? C.teal : C.border}`,
        borderRadius: 14,
        padding: '24px 22px 20px',
        cursor: 'pointer',
        position: 'relative',
        transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: isActive
          ? `0 12px 28px -6px rgba(37,99,235,0.18), 0 4px 8px -2px rgba(0,0,0,0.07)`
          : '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
        userSelect: 'none',
      }}
    >
      {/* Top: icon + menu */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
        <div style={{
          width:50, height:50, borderRadius:13,
          background: isActive ? C.tealLight : C.borderLight,
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'background 0.2s', flexShrink:0,
        }}>
          <Folder size={24} style={{ color: isActive ? C.teal : C.textSub, transition:'color 0.2s' }} />
        </div>

        {/* Three-dot menu */}
        <div data-menu style={{ position:'relative' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={onMenuToggle}
            data-menu
            style={{
              width:32, height:32, borderRadius:8, border:`1px solid ${menuOpen ? C.border : 'transparent'}`,
              background: menuOpen ? '#F9FAFB' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', color:C.textMuted,
              opacity: isActive ? 1 : 0, transition:'opacity 0.15s, background 0.15s',
            }}
            title="More options"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div
              data-menu
              style={{
                position:'absolute', top:36, right:0, zIndex:200,
                background:C.card, border:`1px solid ${C.border}`,
                borderRadius:11, boxShadow:'0 12px 30px -5px rgba(0,0,0,0.14)',
                minWidth:170, overflow:'hidden', padding:'4px 0',
              }}
            >
              <MenuBtn icon={<FolderOpen size={13} />} label="Open"         onClick={onOpen}        />
              <MenuBtn icon={<Download   size={13} />} label="Download All" onClick={onDownloadAll} />
              <div style={{ height:1, background:C.borderLight, margin:'4px 8px' }} />
              <MenuBtn icon={<Trash2     size={13} />} label="Delete All"   onClick={onDeleteAll} danger />
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <h3 style={{ fontSize:17, fontWeight:700, color:C.text, margin:'0 0 5px', lineHeight:1.3, wordBreak:'break-word' }}>
        {fn.name}
      </h3>

      {/* Sub-info */}
      <p style={{ fontSize:13, color:C.textSub, margin:'0 0 10px', lineHeight:1.5 }}>
        {total} file{total !== 1 ? 's' : ''} · {tabKeys.length} tab{tabKeys.length !== 1 ? 's' : ''}
      </p>

      {/* Format breakdown badges */}
      {(() => {
        const allFiles = tabKeys.flatMap(k => fn.tabs.get(k)!.files);
        const counts = allFiles.reduce<Record<string, number>>((acc, f) => {
          const fmt = extractFormat(f.content);
          acc[fmt] = (acc[fmt] ?? 0) + 1;
          return acc;
        }, {});
        const fmts = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
        if (fmts.length === 0) return null;
        return (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:14 }}>
            {fmts.map(([fmt, count]) => (
              <span key={fmt} style={{
                fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5,
                background: (FORMAT_COLOR_MAP[fmt] ?? FORMAT_COLOR_MAP.html).bg,
                color:      (FORMAT_COLOR_MAP[fmt] ?? FORMAT_COLOR_MAP.html).color,
                border:     `1px solid ${(FORMAT_COLOR_MAP[fmt] ?? FORMAT_COLOR_MAP.html).color}22`,
              }}>
                .{FORMAT_EXT_MAP[fmt] ?? fmt} ×{count}
              </span>
            ))}
          </div>
        );
      })()}

      {/* Footer: badge + date */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <TypeBadge type={fn.folderType} />
        <span style={{ fontSize:12, color:C.textMuted }}>
          {fmtDate(fn.latestDate)}
        </span>
      </div>
    </div>
  );
}

function MenuBtn({ icon, label, onClick, danger = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      data-menu
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px',
        background: h ? (danger ? C.dangerLight : '#F9FAFB') : 'transparent',
        color: danger ? C.danger : (h ? C.text : C.textMid),
        fontSize:13, fontWeight:500, border:'none', cursor:'pointer',
        textAlign:'left', transition:'background 0.15s, color 0.15s',
      }}
    >
      {icon}{label}
    </button>
  );
}

// ── FileRow ───────────────────────────────────────────────────────────────────

function FileRow({ file, isLast, onOpen, onDownload, onDelete }: {
  file: RawFile; isLast: boolean;
  onOpen: () => void; onDownload: () => void; onDelete: (e: React.MouseEvent) => void;
}) {
  const [hov, setHov] = useState(false);
  const format = extractFormat(file.content);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:'flex', alignItems:'center', padding:'11px 20px',
        borderBottom: isLast ? 'none' : `1px solid ${C.borderLight}`,
        background: hov ? '#F9FAFB' : C.card,
        cursor:'pointer', transition:'background 0.15s',
      }}
      title="Click to preview"
    >
      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
        <FileText size={15} style={{ color: hov ? C.teal : C.textMuted, flexShrink:0, transition:'color 0.15s' }} />
        <span style={{ fontSize:14, color:C.text, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:8 }}>
          {file.filename}
        </span>
        <FormatBadge format={format} />
      </div>
      <span style={{ width:140, textAlign:'right', fontSize:13, color:C.textMuted, flexShrink:0 }}>
        {fmtDate(file.generatedAt)}
      </span>
      <div style={{ width:88, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4, flexShrink:0, opacity: hov ? 1 : 0, transition:'opacity 0.15s' }}>
        <IconBtn title="Download" onClick={e => { e.stopPropagation(); onDownload(); }} hoverColor={C.teal} hoverBg={C.tealLight}>
          <Download size={13} />
        </IconBtn>
        <IconBtn title="Delete"   onClick={e => { e.stopPropagation(); onDelete(e);   }} hoverColor={C.danger} hoverBg={C.dangerLight}>
          <Trash2 size={13} />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, hoverColor, hoverBg, children }: {
  title: string; onClick: (e: React.MouseEvent) => void;
  hoverColor: string; hoverBg: string; children: React.ReactNode;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      title={title} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width:28, height:28, borderRadius:6, border:'none',
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer', color: h ? hoverColor : C.textMuted,
        background: h ? hoverBg : 'transparent', transition:'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ── PreviewModal (Box-style document viewer) ─────────────────────────────────

/** Split HTML content into page sections for the thumbnail strip */
function splitIntoPages(html: string): string[] {
  // Strip comment tags (FORMAT, EXPORT_DATA blocks) for clean rendering
  const cleaned = html
    .replace(/<!-- FORMAT: \w+ -->\n?/g, '')
    .replace(/<!-- EXPORT_DATA_(?:BINARY|TEXT)_START[\s\S]*?EXPORT_DATA_(?:BINARY|TEXT)_END -->\n?\n?/g, '');
  // Split on <hr> / <hr/> tags as page breaks
  const parts = cleaned.split(/<hr\s*\/?>/i).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [cleaned];
}

/** Extract CSV data from HTML tables in the content */
function extractCSVFromHTML(html: string): string {
  const rows: string[][] = [];
  // Match all <tr>...</tr> blocks
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

/** Estimate readable size from content length */
function estimateSize(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const h = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [exportOpen]);

  // Keyboard: Escape to close, PageUp/PageDown navigation
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'PageDown' || (e.key === 'ArrowDown' && e.altKey)) {
        e.preventDefault();
        setActivePage(p => Math.min(p + 1, pages.length - 1));
      }
      if (e.key === 'PageUp' || (e.key === 'ArrowUp' && e.altKey)) {
        e.preventDefault();
        setActivePage(p => Math.max(p - 1, 0));
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, pages.length]);

  // Scroll to active page when thumbnail is clicked
  useEffect(() => {
    const el = pageRefs.current[activePage];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activePage]);

  // Track scroll position to update active page
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const h = () => {
      const scrollTop = container.scrollTop;
      let current = 0;
      for (let i = 0; i < pageRefs.current.length; i++) {
        const el = pageRefs.current[i];
        if (el && el.offsetTop - container.offsetTop <= scrollTop + 100) current = i;
      }
      setActivePage(current);
    };
    container.addEventListener('scroll', h, { passive: true });
    return () => container.removeEventListener('scroll', h);
  }, [pages.length]);

  // Ctrl+scroll to zoom
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const h = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(z => Math.max(50, Math.min(200, z + (e.deltaY < 0 ? 25 : -25))));
    };
    container.addEventListener('wheel', h, { passive: false });
    return () => container.removeEventListener('wheel', h);
  }, []);

  const downloadFile = useCallback((fmt: 'pdf' | 'csv' | 'html') => {
    const safeTitle = file.filename.replace(/\s+/g, '_');
    if (fmt === 'pdf') {
      const exportData = extractExportData(file.content);
      if (exportData) {
        const binary = atob(exportData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.pdf` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Fallback: download HTML
        const blob = new Blob([file.content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.html` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } else if (fmt === 'csv') {
      const csv = extractCSVFromHTML(file.content);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.csv` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([file.content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${safeTitle}.html` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setExportOpen(false);
    toast.success(`Downloaded as .${fmt}`);
  }, [file]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/saved-technical-files?file=${file.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied');
  }, [file.id]);

  const fileSize = useMemo(() => estimateSize(file.content), [file.content]);

  // Extract query from content metadata if available
  const queryText = useMemo(() => {
    const m = file.content.match(/<!--\s*AI_SCRIPT\s*\n([\s\S]*?)\nEND_AI_SCRIPT\s*-->/);
    if (m) {
      try { return JSON.parse(m[1]).query ?? null; } catch { return null; }
    }
    return null;
  }, [file.content]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: '#F9FAFB', fontFamily: FONT }}>
      {/* ── Top Toolbar ──────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: C.card, borderBottom: `1px solid ${C.border}`,
      }}>
        {/* Left: back + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: C.textSub, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSub; }}
            title="Back to files"
          >
            <ArrowLeft size={16} />
          </button>
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

        {/* Center: page counter + zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {activePage + 1} of {pages.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
            <ToolbarBtn title="Zoom out" onClick={() => setZoom(z => Math.max(50, z - 25))} disabled={zoom <= 50}>−</ToolbarBtn>
            <span style={{ fontSize: 11, color: C.textSub, fontWeight: 500, minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
            <ToolbarBtn title="Zoom in" onClick={() => setZoom(z => Math.min(200, z + 25))} disabled={zoom >= 200}>+</ToolbarBtn>
            <ToolbarBtn title="Fit to width" onClick={() => setZoom(100)}>
              <span style={{ fontSize: 10 }}>FIT</span>
            </ToolbarBtn>
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
          <ActionBtn icon={<Download size={14} />} label="Download" onClick={() => downloadFile('pdf')} />

          {/* Export dropdown */}
          <div ref={exportRef} style={{ position: 'relative' }}>
            <ActionBtn icon={<Share2 size={14} />} label="Export" onClick={() => setExportOpen(o => !o)} active={exportOpen} />
            {exportOpen && (
              <div style={{
                position: 'absolute', top: 38, right: 0, zIndex: 200, background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden', padding: '4px 0',
              }}>
                <ExportMenuItem label="PDF" desc="Download as PDF" onClick={() => downloadFile('pdf')} />
                <ExportMenuItem label="CSV" desc="Extract table data" onClick={() => downloadFile('csv')} />
                <ExportMenuItem label="HTML" desc="Styled HTML file" onClick={() => downloadFile('html')} />
              </div>
            )}
          </div>

          <ActionBtn
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
            label={copied ? 'Copied' : 'Copy Link'}
            onClick={copyLink}
          />

          <button
            onClick={() => setShowInfo(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6,
              border: `1px solid ${showInfo ? C.blue : C.border}`, background: showInfo ? C.blueLight : 'transparent',
              cursor: 'pointer', color: showInfo ? C.blue : C.textSub, transition: 'all 0.15s',
            }}
            title={showInfo ? 'Hide info panel' : 'Show info panel'}
          >
            {showInfo ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>

          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6,
              border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.textSub, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSub; }}
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Body: Left thumbnails + Center content + Right info ───────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: Page thumbnails */}
        <div style={{
          width: 160, flexShrink: 0, background: C.card, borderRight: `1px solid ${C.border}`,
          overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {pages.map((pageHtml, i) => (
            <button
              key={i}
              onClick={() => setActivePage(i)}
              style={{
                width: '100%', aspectRatio: '8.5/11', borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                border: i === activePage ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                background: C.card, position: 'relative', transition: 'border-color 0.15s',
                boxShadow: i === activePage ? `0 0 0 2px ${C.blueBorder}` : 'none',
              }}
            >
              {/* Scaled-down page preview */}
              <div style={{ transform: 'scale(0.18)', transformOrigin: 'top left', width: '555%', height: '555%', pointerEvents: 'none', overflow: 'hidden' }}>
                <div dangerouslySetInnerHTML={{ __html: pageHtml }} style={{ padding: 24, fontSize: 14, fontFamily: FONT, color: C.text }} />
              </div>
              {/* Page number label */}
              <div style={{
                position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                fontSize: 10, fontWeight: 600, color: i === activePage ? C.blue : C.textMuted,
                background: i === activePage ? C.blueLight : 'rgba(255,255,255,0.9)',
                padding: '1px 6px', borderRadius: 3, border: `1px solid ${i === activePage ? C.blueBorder : C.border}`,
              }}>
                {i + 1}
              </div>
            </button>
          ))}
        </div>

        {/* Center: Document content */}
        <div
          ref={contentRef}
          style={{ flex: 1, overflowY: 'auto', background: '#F3F4F6', padding: '24px 32px' }}
        >
          {pages.map((pageHtml, i) => (
            <div
              key={i}
              ref={el => { pageRefs.current[i] = el; }}
              style={{
                background: C.card, borderRadius: 6, padding: 32, marginBottom: 24,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: `1px solid ${C.border}`,
                maxWidth: 820, margin: '0 auto 24px',
                transform: `scale(${zoom / 100})`, transformOrigin: 'top center',
                transition: 'transform 0.15s ease',
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: pageHtml }}
                style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.7, color: C.text }}
              />
            </div>
          ))}
        </div>

        {/* Right: Info/Details panel */}
        {showInfo && (
          <div style={{
            width: 280, flexShrink: 0, background: C.card, borderLeft: `1px solid ${C.border}`,
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {/* Panel header */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={14} style={{ color: C.blue }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Details</span>
            </div>

            {/* Metadata rows */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <MetaRow label="Filename" value={`${file.filename}.${ext}`} />
              <MetaRow label="Folder" value={file.folder} />
              <MetaRow label="Tab" value={file.tabName} />
              <MetaRow label="Format" value={`.${ext.toUpperCase()}`} />
              <MetaRow label="Generated" value={fmtDate(file.generatedAt)} />
              <MetaRow label="File Size" value={fileSize} />
              <MetaRow label="Pages" value={String(pages.length)} />
              {queryText && <MetaRow label="Query" value={queryText} multiline />}

              {/* Tags */}
              {file.measurements.filter(m => m.startsWith('tag:')).length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tags</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {file.measurements.filter(m => m.startsWith('tag:')).map(m => (
                      <span key={m} style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: C.blueLight, color: C.blue, border: `1px solid ${C.blueBorder}` }}>
                        {m.slice(4)}
                      </span>
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
    <button
      title={title} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: 26, height: 26, borderRadius: 4, border: `1px solid ${h && !disabled ? C.border : 'transparent'}`,
        background: h && !disabled ? '#F3F4F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? C.textMuted : C.textSub,
        fontSize: 14, fontWeight: 600, transition: 'all 0.1s', opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ActionBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6,
        border: `1px solid ${active ? C.blue : h ? '#D1D5DB' : C.border}`,
        background: active ? C.blueLight : h ? '#F9FAFB' : 'transparent',
        color: active ? C.blue : h ? C.text : C.textMid,
        fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ExportMenuItem({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', flexDirection: 'column', gap: 1, padding: '9px 14px', textAlign: 'left',
        background: h ? '#F9FAFB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{label}</span>
      <span style={{ fontSize: 11, color: C.textMuted }}>{desc}</span>
    </button>
  );
}

function MetaRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>{label}</span>
      <span style={{
        fontSize: 13, color: C.text, fontWeight: 400, wordBreak: 'break-word',
        ...(multiline ? { display: 'block', lineHeight: 1.5, fontSize: 12, color: C.textSub } : {}),
      }}>{value}</span>
    </div>
  );
}

// ── Utility states ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0', color:C.textMuted, fontSize:14 }}>
      Loading files…
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ background:C.card, borderRadius:18, border:`1px solid ${C.border}`, padding:'72px 40px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', maxWidth:520, margin:'0 auto' }}>
      <div style={{ width:76, height:76, borderRadius:22, background:C.tealLight, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px' }}>
        <Folder size={34} style={{ color:C.teal }} />
      </div>
      <h3 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 10px' }}>No saved files yet</h3>
      <p style={{ fontSize:15, color:C.textSub, margin:0, lineHeight:1.6 }}>
        Save analysis results from the biostatistics platform and they'll appear here, organized by project or tab.
      </p>
    </div>
  );
}

function FilteredEmpty({ viewFilter, search }: { viewFilter: ViewFilter; search: string }) {
  return (
    <div style={{ textAlign:'center', padding:'64px 40px', color:C.textMuted, fontSize:14 }}>
      {search
        ? `No files match "${search}"`
        : viewFilter === 'projects'
        ? 'No project folders yet — save analyses with "Save all data in project" checked'
        : 'No tab folders yet — save analyses using "Save all data in tab"'}
    </div>
  );
}
