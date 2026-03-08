import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Sparkles, GripVertical, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import RegulatorySidebar from '@/components/regulatory/RegulatorySidebar';
import BottomChatBar from '@/components/regulatory/BottomChatBar';
import ReferencesPanel from '@/components/regulatory/ReferencesPanel';
import DocumentContentPanel from '@/components/regulatory/DocumentContentPanel';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import type { AIReference } from '@/stores/regulatoryStore';
import { trpc } from '@/lib/trpc';

// ── Light-theme design tokens ────────────────────────────────────────────────
const T = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  textMuted: '#94a3b8',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  accentLight: '#eff6ff',
  success: '#10b981',
  successLight: '#ecfdf5',
  danger: '#ef4444',
  dangerLight: '#fef2f2',
  divider: '#e2e8f0',
  shadow: '0 1px 3px rgba(0,0,0,0.1)',
  shadowLg: '0 4px 16px rgba(0,0,0,0.08)',
} as const;

// ── Fake demo sources for showcase ──────────────────────────────────────────
const DEMO_SOURCES = [
  {
    name: 'Clinical_Trial_Results.csv',
    type: 'CSV',
    excerpt:
      'N=240 patients enrolled across 12 sites. Primary endpoint: mean blood glucose reduction of 38.2 mg/dL (p<0.001). Device accuracy MARD 8.9%, meeting ISO 15197:2013 criteria. No serious device-related adverse events reported. 95% CI [35.1, 41.3]. Secondary endpoint: 94.2% of readings within Zone A of Clarke Error Grid.',
  },
  {
    name: 'GlucoSense_Device_Specifications.pdf',
    type: 'PDF',
    excerpt:
      'GlucoSense Pro continuous glucose monitor. Sensor: electrochemical GOx-based, 14-day wear. Range 40-500 mg/dL. Operating temp 10-45C. Bluetooth 5.0 connectivity. Biocompatible adhesive per ISO 10993-5/-10. IP27 water resistance rating. Polycarbonate housing, IR sensor array. Accuracy +/-15% vs. lab reference (n=150). Sensitivity 92%, Specificity 88%.',
  },
  {
    name: 'FDA_eStar_Template_510k.docx',
    type: 'DOCX',
    excerpt:
      'Section 4: Substantial Equivalence. The subject device shares the same intended use, technological characteristics, and performance specifications as the predicate device (K201234). Differences in sensor chemistry do not raise new questions of safety or effectiveness. Section 2: Indications for Use - Continuous glucose monitoring for Type 2 diabetes management.',
  },
];

export default function Regulatory() {
  const { activeProjectId } = useRegulatoryStore();
  const updateProjectContent = useRegulatoryStore((s) => s.updateProjectContent);
  const updateProjectAnnotations = useRegulatoryStore((s) => s.updateProjectAnnotations);
  const updateProjectReferences = useRegulatoryStore((s) => s.updateProjectReferences);
  const attachFile = useRegulatoryStore((s) => s.attachFile);
  const activeProject = useRegulatoryStore((s) => s.getActiveProject());

  const [isGenerating, setIsGenerating] = useState(false);
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);

  // ── Resizable panel state ──────────────────────────────────────────────────
  const [leftPanelPct, setLeftPanelPct] = useState(68); // percentage
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPanelPct(Math.max(40, Math.min(75, pct)));
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ── API mutation ──────────────────────────────────────────────────────────
  const generateDoc = trpc.regulatory.generateRegulatoryDoc.useMutation({
    onSuccess: (data) => {
      if (!activeProjectId) return;
      updateProjectContent(activeProjectId, data.content);
      updateProjectAnnotations(activeProjectId, data.annotations as any);
      updateProjectReferences(activeProjectId, (data as any).references as AIReference[]);
      data.usedFileNames.forEach((name) => attachFile(activeProjectId, name));
      toast.success('Document generated successfully', {
        style: { background: T.successLight, color: '#065f46', borderColor: '#86efac' },
      });
      setIsGenerating(false);
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
      setIsGenerating(false);
    },
  });

  const handleSendMessage = (message: string, documentType?: string) => {
    setIsGenerating(true);
    generateDoc.mutate({
      message,
      documentType,
      attachedFileNames: activeProject?.attachedFiles ?? [],
      sourceExcerpts: DEMO_SOURCES.map((s) => ({
        name: s.name,
        type: s.type,
        excerpt: s.excerpt,
      })),
    });
  };

  // ── Demo showcase ──────────────────────────────────────────────────────────
  const handleDemo = useCallback(() => {
    if (isGenerating) return;
    const sourceSummary = DEMO_SOURCES.map(
      (s, i) => `Source ${i + 1} (${s.name}):\n${s.excerpt}`
    ).join('\n\n');

    handleSendMessage(
      `Generate an FDA eStar 510(k) submission document for a fictional continuous glucose monitor called "GlucoSense Pro". Use ONLY the following source documents. Structure with numbered sections, cite sources inline using [SourceName:Section] format, and list all references with annotations.\n\nSource Materials:\n${sourceSummary}`,
      '510k'
    );
  }, [isGenerating]);

  // ── Citation click ────────────────────────────────────────────────────────
  const handleCitationClick = useCallback((citationKey: string) => {
    setHighlightedCitation(citationKey);
    setTimeout(() => setHighlightedCitation(null), 3000);
  }, []);

  const showEmptyState = activeProject && !activeProject.content.trim() && !isGenerating;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", background: T.bg }}
    >
      <div className="flex flex-1 relative">
        {/* Dark sidebar — stays dark */}
        <RegulatorySidebar
          onProjectSelect={(projectId) => console.log('Selected project:', projectId)}
          onSourcesChange={(sources) => console.log('Sources updated:', sources)}
        />

        {/* Main content — light theme */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: T.bg }}>
          {/* Top chat bar */}
          <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <BottomChatBar
              inline
              onSendMessage={handleSendMessage}
              selectedProject={activeProjectId?.toString()}
              isLoading={isGenerating}
            />
          </div>

          {/* Main content area */}
          <div className="flex-1 overflow-hidden">
            {/* Empty state with demo button */}
            {showEmptyState && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '16px 0 0',
                  background: T.bg,
                }}
              >
                <button
                  onClick={handleDemo}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    background: T.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = T.accentHover;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = T.accent;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Sparkles size={16} />
                  Generate Sample eStar Document (Demo)
                </button>
              </div>
            )}

            {/* Loading overlay */}
            {isGenerating && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: 16,
                  background: T.accentLight,
                  borderBottom: `1px solid ${T.accent}40`,
                }}
              >
                <Loader2 size={16} className="animate-spin" style={{ color: T.accent }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: T.accent }}>
                  Generating regulatory document from source materials...
                </span>
              </div>
            )}

            {/* Resizable panels — Document + References */}
            <div
              ref={containerRef}
              className="flex flex-col md:flex-row"
              style={{ height: 'calc(100vh - 140px)', padding: '16px', gap: 0 }}
            >
              {/* Left: Document Content */}
              <div
                style={{
                  width: `${leftPanelPct}%`,
                  minWidth: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                className="hidden md:flex"
              >
                <div
                  style={{
                    flex: 1,
                    background: T.card,
                    borderRadius: 12,
                    border: `1px solid ${T.border}`,
                    boxShadow: T.shadow,
                    overflow: 'hidden',
                  }}
                >
                  <DocumentContentPanel onCitationClick={handleCitationClick} />
                </div>
              </div>

              {/* Mobile: show Document Content full width */}
              <div className="flex md:hidden flex-col" style={{ flex: 1, minHeight: 0 }}>
                <div
                  style={{
                    flex: 1,
                    background: T.card,
                    borderRadius: 12,
                    border: `1px solid ${T.border}`,
                    boxShadow: T.shadow,
                    overflow: 'hidden',
                    marginBottom: 16,
                  }}
                >
                  <DocumentContentPanel onCitationClick={handleCitationClick} />
                </div>
                <div
                  style={{
                    flex: 1,
                    background: T.card,
                    borderRadius: 12,
                    border: `1px solid ${T.border}`,
                    boxShadow: T.shadow,
                    overflow: 'hidden',
                  }}
                >
                  <ReferencesPanel highlightedCitation={highlightedCitation} />
                </div>
              </div>

              {/* Resizable divider (desktop only) */}
              <div
                onMouseDown={handleMouseDown}
                className="hidden md:flex"
                style={{
                  width: 8,
                  cursor: 'col-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  zIndex: 10,
                  userSelect: 'none',
                  margin: '0 2px',
                }}
                title="Drag to resize panels"
              >
                <div
                  style={{
                    width: 4,
                    height: 48,
                    borderRadius: 4,
                    background: T.divider,
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = T.accent;
                    e.currentTarget.style.width = '6px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = T.divider;
                    e.currentTarget.style.width = '4px';
                  }}
                >
                  <GripVertical size={12} style={{ color: T.textMuted }} />
                </div>
              </div>

              {/* Right: References (desktop) */}
              <div
                className="hidden md:flex"
                style={{
                  width: `${100 - leftPanelPct}%`,
                  minWidth: 0,
                  overflow: 'hidden',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: T.card,
                    borderRadius: 12,
                    border: `1px solid ${T.border}`,
                    boxShadow: T.shadow,
                    overflow: 'hidden',
                  }}
                >
                  <ReferencesPanel highlightedCitation={highlightedCitation} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
