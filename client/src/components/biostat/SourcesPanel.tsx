import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  ChevronDown,
  CheckCircle2,
  FolderOpen,
  Layers,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentDatasetStore } from '@/stores/currentDatasetStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SourceFile {
  id: string;
  name: string;
  size?: string;
  type?: string;
}

interface SourcesPanelProps {
  /** Files that apply to all project tabs */
  projectFiles?: SourceFile[];
  /** Files attached to just this analysis tab */
  tabFiles?: SourceFile[];
  className?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  count,
  open,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 text-left"
    >
      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium">{title}</span>
        {subtitle && (
          <span className="block text-[10px] text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {count > 0 && (
        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
      <ChevronDown
        className={cn('w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform', open && 'rotate-180')}
      />
    </button>
  );
}

function FileRow({ file, badge }: { file: SourceFile; badge?: React.ReactNode }) {
  const Icon = file.name.endsWith('.csv') || file.name.endsWith('.tsv')
    ? FileSpreadsheet
    : FileText;
  return (
    <div className="flex items-center gap-2 px-3 py-1 ml-2 rounded hover:bg-accent/30">
      <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <span className="text-xs truncate flex-1 min-w-0">{file.name}</span>
      {file.size && (
        <span className="text-[10px] text-muted-foreground flex-shrink-0">{file.size}</span>
      )}
      {badge}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SourcesPanel({ projectFiles = [], tabFiles = [], className }: SourcesPanelProps) {
  const [projectOpen, setProjectOpen] = useState(true);
  const [tabOpen, setTabOpen] = useState(true);
  const [cleanedOpen, setCleanedOpen] = useState(true);

  const cleanedSources = useCurrentDatasetStore((s) => s.cleanedSources);

  return (
    <div className={cn('flex flex-col h-full bg-background border-t border-border overflow-y-auto', className)}>
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sources Attached</span>
      </div>

      {/* Project Sources */}
      <div className="flex-shrink-0">
        <SectionHeader
          icon={FolderOpen}
          title="Project Sources"
          subtitle="Apply to all tabs"
          count={projectFiles.length}
          open={projectOpen}
          onToggle={() => setProjectOpen((o) => !o)}
        />
        {projectOpen && (
          <div className="pb-1">
            {projectFiles.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-3 py-1 ml-2 italic">No project files yet</p>
            ) : (
              projectFiles.map((f) => <FileRow key={f.id} file={f} />)
            )}
          </div>
        )}
      </div>

      {/* Tab Sources */}
      <div className="flex-shrink-0 border-t border-border/60">
        <SectionHeader
          icon={FileText}
          title="Sources for This Tab"
          subtitle="Current analysis tab only"
          count={tabFiles.length}
          open={tabOpen}
          onToggle={() => setTabOpen((o) => !o)}
        />
        {tabOpen && (
          <div className="pb-1">
            {tabFiles.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-3 py-1 ml-2 italic">No tab-specific files</p>
            ) : (
              tabFiles.map((f) => <FileRow key={f.id} file={f} />)
            )}
          </div>
        )}
      </div>

      {/* Cleaned Sources */}
      <div className="flex-shrink-0 border-t border-border/60">
        <SectionHeader
          icon={Sparkles}
          title="Sources Cleaned in This Tab"
          subtitle="AI-processed outputs"
          count={cleanedSources.length}
          open={cleanedOpen}
          onToggle={() => setCleanedOpen((o) => !o)}
        />
        {cleanedOpen && (
          <div className="pb-1">
            {cleanedSources.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-3 py-1 ml-2 italic">No cleaned data yet — use Clean Dataset</p>
            ) : (
              cleanedSources.map((cs) => (
                <FileRow
                  key={cs.id}
                  file={{ id: cs.id, name: cs.filename, size: `${cs.rowCount} rows` }}
                  badge={
                    <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Cleaned
                    </span>
                  }
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
