import { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  teal:        '#00B8A9',
  tealLight:   '#E6FFFA',
  tealBorder:  '#99E6DF',
  blue:        '#0D6EFD',
  blueLight:   '#EFF6FF',
  blueBorder:  '#BFDBFE',
  purple:      '#6F42C1',
  purpleLight: '#F3E8FF',
  purpleBorder:'#DDD6FE',
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
  dta:  { bg: '#faf5ff', color: '#7c3aed' },
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
                boxShadow: searchFocus ? `0 0 0 3px rgba(0,184,169,0.12)` : 'none',
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
          ? `0 12px 28px -6px rgba(0,184,169,0.18), 0 4px 8px -2px rgba(0,0,0,0.07)`
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

// ── PreviewModal ──────────────────────────────────────────────────────────────

function PreviewModal({ file, onClose }: { file: RawFile; onClose: () => void }) {
  const format = extractFormat(file.content);
  const ext    = FORMAT_EXT_MAP[format] ?? 'html';
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', flexDirection:'column', background:'rgba(17,24,39,0.72)', backdropFilter:'blur(4px)' }}>
      {/* Header bar */}
      <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:12, padding:'13px 20px', background:C.card, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ width:32, height:32, borderRadius:8, background:C.tealLight, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <FileText size={15} style={{ color:C.teal }} />
        </div>
        <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14, fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {file.folder} / {file.tabName} / {file.filename}.{ext}
          </span>
          <FormatBadge format={format} />
        </div>
        <button
          onClick={onClose}
          style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:C.card, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:C.textSub, transition:'all 0.15s', flexShrink:0 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = C.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.card;    e.currentTarget.style.color = C.textSub; }}
          title="Close"
        >
          <X size={15} />
        </button>
      </div>
      <div style={{ flex:1, overflow:'hidden', background:C.card }}>
        <iframe srcDoc={file.content} style={{ width:'100%', height:'100%', border:'none' }} sandbox="allow-scripts allow-same-origin" title={file.filename} />
      </div>
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
