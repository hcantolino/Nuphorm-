import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Sparkles, GripVertical, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import RegulatorySidebar from '@/components/regulatory/RegulatorySidebar';
import type { SourceFile } from '@/components/regulatory/RegulatorySidebar';
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
  const activeProjectId = useRegulatoryStore((s) => s.activeProjectId);
  const setActiveProject = useRegulatoryStore((s) => s.setActiveProject);
  const updateProjectContent = useRegulatoryStore((s) => s.updateProjectContent);
  const updateProjectAnnotations = useRegulatoryStore((s) => s.updateProjectAnnotations);
  const updateProjectReferences = useRegulatoryStore((s) => s.updateProjectReferences);
  const attachFile = useRegulatoryStore((s) => s.attachFile);
  const addConversationMessage = useRegulatoryStore((s) => s.addConversationMessage);
  const getConversationHistory = useRegulatoryStore((s) => s.getConversationHistory);
  const clearConversationHistory = useRegulatoryStore((s) => s.clearConversationHistory);
  const activeProject = useRegulatoryStore((s) => s.getActiveProject());

  // Use a ref so async callbacks always read the latest activeProjectId,
  // avoiding stale closures during the 40+ second LLM generation.
  const activeProjectIdRef = useRef(activeProjectId);
  useEffect(() => { activeProjectIdRef.current = activeProjectId; }, [activeProjectId]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<'idle' | 'preparing' | 'generating' | 'parsing' | 'done' | 'error'>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);
  const [pendingChatContent, setPendingChatContent] = useState<string | null>(null);
  const [sidebarSources, setSidebarSources] = useState<SourceFile[]>([]);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMessageRef = useRef<string>('');

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

  // ── Build source excerpts from sidebar uploads or fallback to DEMO_SOURCES ──
  const buildSourceExcerpts = useCallback(() => {
    // Use sidebar-uploaded sources if any have parsed content
    const readySources = sidebarSources.filter((s) => s.status === 'ready' && s.parsedContent);
    if (readySources.length > 0) {
      return readySources.map((s) => ({
        name: s.name,
        type: s.type.toUpperCase(),
        excerpt: s.parsedContent!,
      }));
    }
    // Fall back to DEMO_SOURCES
    return DEMO_SOURCES.map((s) => ({
      name: s.name,
      type: s.type,
      excerpt: s.excerpt,
    }));
  }, [sidebarSources]);

  // ── Cleanup safety timeout on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  // ── Helper: clear generation state ─────────────────────────────────────
  const clearGeneration = useCallback(() => {
    if (safetyTimeoutRef.current) { clearTimeout(safetyTimeoutRef.current); safetyTimeoutRef.current = null; }
    setIsGenerating(false);
    setGenerationStage('idle');
    setGenerationError(null);
  }, []);

  // ── API mutation ──────────────────────────────────────────────────────────
  const generateDoc = trpc.regulatory.generateRegulatoryDoc.useMutation({
    onSuccess: (data) => {
      if (safetyTimeoutRef.current) { clearTimeout(safetyTimeoutRef.current); safetyTimeoutRef.current = null; }

      // Read from ref to avoid stale closures (mutation takes 40+ seconds)
      const projId = activeProjectIdRef.current;
      console.log('[Regulatory] generateDoc onSuccess:', { projId, contentLen: data.content?.length, refs: data.references?.length });

      if (!projId) {
        console.error('[Regulatory] onSuccess: no activeProjectId — result dropped');
        clearGeneration();
        toast.error('No active project — document not saved. Select a project and try again.');
        return;
      }

      setGenerationStage('parsing');

      try {
        updateProjectContent(projId, data.content);
        updateProjectAnnotations(projId, data.annotations as any);
        updateProjectReferences(projId, (data as any).references as AIReference[]);
        data.usedFileNames.forEach((name) => attachFile(projId, name));

        // Record both user + assistant messages in conversation history
        if (lastUserMessageRef.current) {
          addConversationMessage(projId, { role: 'user', content: lastUserMessageRef.current });
        }
        addConversationMessage(projId, {
          role: 'assistant',
          content: `Generated ${data.usedFileNames?.length ?? 0}-source regulatory document (${data.content?.length ?? 0} chars). Sources: ${data.usedFileNames?.join(', ') || 'none'}`,
        });
      } catch (storeErr) {
        console.error('[Regulatory] Store update failed:', storeErr);
        clearGeneration();
        toast.error('Failed to save document to project.');
        return;
      }

      setGenerationStage('done');
      toast.success('Document generated successfully', {
        style: { background: T.successLight, color: '#065f46', borderColor: '#86efac' },
      });
      setTimeout(clearGeneration, 1500);
    },
    onError: (err) => {
      if (safetyTimeoutRef.current) { clearTimeout(safetyTimeoutRef.current); safetyTimeoutRef.current = null; }
      console.error('[Regulatory] generateDoc onError:', err.message);
      setGenerationStage('error');
      const errText = err.message;
      const msg = errText.includes('fetch') || errText.includes('network') || errText.includes('reach')
        ? 'Could not reach AI service. Check your network connection and try again.'
        : errText.includes('timed out') || errText.includes('timeout')
        ? 'Generation timed out. Try with fewer sources or a simpler document type.'
        : errText.includes('API') || errText.includes('key')
        ? 'AI service unavailable. Check your API key in .env.'
        : `Generation failed: ${errText}`;
      setGenerationError(msg);
      toast.error(msg, {
        style: { background: T.bg, color: T.text, borderColor: T.border },
      });
      setTimeout(clearGeneration, 5000);
    },
  });

  const handleSendMessage = useCallback((message: string, documentType?: string) => {
    if (!activeProjectId) {
      toast.error('No active project selected. Create or select a project first.');
      console.error('[Regulatory] handleSendMessage: no activeProjectId');
      return;
    }

    const sourceExcerpts = buildSourceExcerpts();
    const history = getConversationHistory(activeProjectId);
    lastUserMessageRef.current = message;

    console.log('[Regulatory] handleSendMessage fired:', {
      message: message.slice(0, 80),
      documentType,
      activeProjectId,
      sourceCount: sourceExcerpts.length,
      sourceNames: sourceExcerpts.map((s) => s.name),
      historyLength: history.length,
    });

    setIsGenerating(true);
    setGenerationStage('preparing');
    setGenerationError(null);

    // Safety timeout: if neither onSuccess nor onError fires within 130s
    // (server has 120s LLM timeout), force-clear the spinner so it never
    // spins forever. Shows an actionable error toast.
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      console.error('[Regulatory] Safety timeout: generation did not complete in 130s');
      setGenerationStage('error');
      setGenerationError('Generation took too long. The AI may be overloaded — try again.');
      toast.error('Generation timed out after 2 minutes. Please try again.', {
        style: { background: T.dangerLight, color: '#991b1b', borderColor: '#fecaca' },
      });
      setTimeout(clearGeneration, 5000);
    }, 130_000);

    // Brief delay so user sees "Preparing sources..." before API call
    setTimeout(() => {
      setGenerationStage('generating');
      generateDoc.mutate({
        message,
        documentType,
        attachedFileNames: activeProject?.attachedFiles ?? [],
        sourceExcerpts,
        conversationHistory: history,
      });
    }, 400);
  }, [activeProjectId, activeProject?.attachedFiles, buildSourceExcerpts, generateDoc, clearGeneration, getConversationHistory]);

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
  }, [isGenerating, handleSendMessage]);

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
          onProjectSelect={(projectId) => {
            console.log('[Regulatory] Selected project:', projectId);
            setActiveProject(projectId);
          }}
          onSourcesChange={(sources) => setSidebarSources(sources)}
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
              pendingContent={pendingChatContent}
              onPendingContentConsumed={() => setPendingChatContent(null)}
            />
          </div>

          {/* Conversation memory indicator + Clear History */}
          {activeProjectId && getConversationHistory(activeProjectId).length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 16px',
                background: T.accentLight,
                borderBottom: `1px solid ${T.accent}20`,
                fontSize: 12,
                color: T.textSub,
              }}
            >
              <span>
                AI memory active — {Math.floor(getConversationHistory(activeProjectId).length / 2)} prior exchange{Math.floor(getConversationHistory(activeProjectId).length / 2) !== 1 ? 's' : ''} in this project
              </span>
              <button
                onClick={() => {
                  clearConversationHistory(activeProjectId);
                  toast.success('Conversation history cleared');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  background: '#a0aec0',
                  color: '#1a202c',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#a0aec0'; }}
              >
                <Trash2 size={12} />
                Clear History
              </button>
            </div>
          )}

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

            {/* Multi-stage progress indicator */}
            {isGenerating && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  background: generationStage === 'error' ? '#fef2f2' : generationStage === 'done' ? T.successLight : T.accentLight,
                  borderBottom: `1px solid ${generationStage === 'error' ? '#fecaca' : generationStage === 'done' ? '#86efac' : T.accent + '40'}`,
                  transition: 'all 0.3s ease',
                }}
              >
                {generationStage === 'error' ? (
                  <AlertCircle size={16} style={{ color: '#dc2626' }} />
                ) : generationStage === 'done' ? (
                  <CheckCircle2 size={16} style={{ color: '#059669' }} />
                ) : (
                  <Loader2 size={16} className="animate-spin" style={{ color: T.accent }} />
                )}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: generationStage === 'error' ? '#dc2626' : generationStage === 'done' ? '#059669' : T.accent,
                  }}
                >
                  {generationStage === 'preparing' && 'Preparing source materials...'}
                  {generationStage === 'generating' && 'Generating regulatory document from source materials...'}
                  {generationStage === 'parsing' && 'Processing AI response...'}
                  {generationStage === 'done' && 'Document generated successfully!'}
                  {generationStage === 'error' && (generationError || 'Generation failed. Try again.')}
                </span>

                {/* Progress dots + Cancel button */}
                {generationStage !== 'error' && generationStage !== 'done' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['preparing', 'generating', 'parsing'].map((stage, i) => {
                        const stages = ['preparing', 'generating', 'parsing'];
                        const currentIdx = stages.indexOf(generationStage);
                        return (
                          <div
                            key={stage}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: i <= currentIdx ? T.accent : '#cbd5e1',
                              transition: 'background 0.3s',
                            }}
                          />
                        );
                      })}
                    </div>
                    <button
                      onClick={clearGeneration}
                      style={{
                        fontSize: 11,
                        color: T.textMuted,
                        background: 'transparent',
                        border: `1px solid ${T.border}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        marginLeft: 4,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
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
                  <DocumentContentPanel onCitationClick={handleCitationClick} onAddToChat={(c) => { setPendingChatContent(c); toast.success('Added to chat input', { style: { background: '#f7fafc', color: '#1a202c', border: '1px solid #e2e8f0' }, duration: 1500 }); }} />
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
                  <DocumentContentPanel onCitationClick={handleCitationClick} onAddToChat={(c) => { setPendingChatContent(c); toast.success('Added to chat input', { style: { background: '#f7fafc', color: '#1a202c', border: '1px solid #e2e8f0' }, duration: 1500 }); }} />
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
