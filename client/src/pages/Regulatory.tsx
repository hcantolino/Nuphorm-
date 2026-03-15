import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Sparkles, GripVertical, Loader2, CheckCircle2, AlertCircle, Trash2, Check, Settings2 } from 'lucide-react';
import RegulatorySidebar from '@/components/regulatory/RegulatorySidebar';
import type { SourceFile } from '@/components/regulatory/RegulatorySidebar';
import BottomChatBar from '@/components/regulatory/BottomChatBar';
import ReferencesPanel from '@/components/regulatory/ReferencesPanel';
import DocumentContentPanel from '@/components/regulatory/DocumentContentPanel';
import DocumentSettingsModal from '@/components/regulatory/DocumentSettingsModal';
import type { DocumentSettingsValues } from '@/components/regulatory/DocumentSettingsModal';
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
  shadow: '0 1px 3px rgba(0,0,0,0.08)',
  shadowLg: '0 4px 16px rgba(0,0,0,0.08)',
} as const;

/** Stable empty array — avoids `?? []` creating new refs on every render */
const EMPTY_SOURCES: import('@/stores/regulatoryStore').SourceFile[] = [];
const EMPTY_CONVERSATION: import('@/stores/regulatoryStore').ConversationMessage[] = [];

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
  // Stable selector for conversation array — avoids calling getter in render body
  const conversationMessages = useRegulatoryStore((s) =>
    s.conversationsByProject[s.activeProjectId ?? ''] ?? EMPTY_CONVERSATION
  );
  const conversationCount = conversationMessages.length;
  const projects = useRegulatoryStore((s) => s.projects);
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId]
  );

  // Use a ref so async callbacks always read the latest activeProjectId,
  // avoiding stale closures during the 40+ second LLM generation.
  const activeProjectIdRef = useRef(activeProjectId);
  useEffect(() => { activeProjectIdRef.current = activeProjectId; }, [activeProjectId]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<'idle' | 'preparing' | 'generating' | 'parsing' | 'done' | 'error'>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);
  const [pendingChatContent, setPendingChatContent] = useState<string | null>(null);
  // Sources come from the persisted store — no local state needed
  const sidebarSources = useRegulatoryStore((s) =>
    s.sourcesByProject[s.activeProjectId ?? ''] ?? EMPTY_SOURCES
  );
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMessageRef = useRef<string>('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pendingSaveRef = useRef(false);

  // ── Auto-save mutation ──────────────────────────────────────────────────────
  const saveStateMutation = trpc.regulatory.saveProjectState.useMutation();

  const saveProjectState = useCallback(async () => {
    const projId = activeProjectIdRef.current;
    if (!projId) return;

    const store = useRegulatoryStore.getState();
    const project = store.projects.find((p) => p.id === projId);
    if (!project) return;

    const conversationHistory = store.conversationsByProject[projId] ?? [];

    // Serialize sidebar sources from store (already serializable — uploadedAt is ISO string)
    const sourcesSnapshot = (store.sourcesByProject[projId] ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      size: s.size,
      uploadedAt: s.uploadedAt,
      parsedContent: s.parsedContent ?? null,
      status: s.status,
    }));

    setSaveStatus('saving');
    try {
      await saveStateMutation.mutateAsync({
        projectId: projId,
        state: {
          name: project.name,
          description: project.description,
          regulatoryStandard: project.regulatoryStandard,
          paperLayout: project.paperLayout,
          referenceFormat: project.referenceFormat,
          content: project.content,
          attachedFiles: project.attachedFiles,
          annotations: project.annotations as any[],
          references: project.references as any[],
          conversationHistory: conversationHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          sidebarSources: sourcesSnapshot,
          updatedAt: new Date().toISOString(),
        },
      });
      setSaveStatus('saved');
      pendingSaveRef.current = false;
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('[Regulatory] Auto-save failed:', err);
      setSaveStatus('idle');
    }
  }, [saveStateMutation]);

  // Debounced save: triggers 500ms after last call to avoid rapid-fire saves
  const triggerAutoSave = useCallback(() => {
    pendingSaveRef.current = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveProjectState();
    }, 500);
  }, [saveProjectState]);

  // ── Restore project state on project switch ──────────────────────────────
  const loadStateQuery = trpc.regulatory.loadProjectState.useQuery(
    { projectId: activeProjectId ?? '' },
    { enabled: !!activeProjectId, refetchOnWindowFocus: false }
  );

  // Track which project we last restored to avoid re-applying on every render
  const lastRestoredProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !loadStateQuery.data?.found ||
      !loadStateQuery.data.state ||
      !activeProjectId ||
      lastRestoredProjectRef.current === activeProjectId
    ) return;

    const saved = loadStateQuery.data.state as any;
    lastRestoredProjectRef.current = activeProjectId;

    // Restore project fields into the Zustand store
    const store = useRegulatoryStore.getState();
    if (saved.content) store.updateProjectContent(activeProjectId, saved.content);
    if (saved.annotations?.length) store.updateProjectAnnotations(activeProjectId, saved.annotations);
    if (saved.references?.length) store.updateProjectReferences(activeProjectId, saved.references);
    if (saved.attachedFiles?.length) {
      saved.attachedFiles.forEach((f: string) => store.attachFile(activeProjectId, f));
    }
    // Restore conversation history
    if (saved.conversationHistory?.length) {
      store.clearConversationHistory(activeProjectId);
      saved.conversationHistory.forEach((msg: any) => {
        store.addConversationMessage(activeProjectId, { role: msg.role, content: msg.content });
      });
    }
    // Restore sidebar sources into the persisted store
    if (saved.sidebarSources?.length) {
      const restored: SourceFile[] = saved.sidebarSources.map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        size: s.size,
        uploadedAt: typeof s.uploadedAt === 'string' ? s.uploadedAt : new Date(s.uploadedAt).toISOString(),
        parsedContent: s.parsedContent ?? undefined,
        status: s.status ?? 'ready',
      }));
      store.setProjectSources(activeProjectId, restored);
    }

    console.log(`[Regulatory] Restored project state for "${activeProjectId}"`);
  }, [loadStateQuery.data, activeProjectId]);

  // ── beforeunload: flush pending save ──────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!pendingSaveRef.current) return;
      // Use sendBeacon for reliable last-chance save (fire-and-forget)
      const projId = activeProjectIdRef.current;
      if (!projId) return;
      const store = useRegulatoryStore.getState();
      const project = store.projects.find((p) => p.id === projId);
      if (!project) return;
      const payload = JSON.stringify({
        projectId: projId,
        state: {
          name: project.name,
          description: project.description,
          regulatoryStandard: project.regulatoryStandard,
          paperLayout: project.paperLayout,
          referenceFormat: project.referenceFormat,
          content: project.content,
          attachedFiles: project.attachedFiles,
          annotations: project.annotations,
          references: project.references,
          conversationHistory: store.conversationsByProject[projId] ?? [],
          sidebarSources: (store.sourcesByProject[projId] ?? []).map((s) => ({
            id: s.id, name: s.name, type: s.type, size: s.size,
            uploadedAt: s.uploadedAt,
            parsedContent: s.parsedContent ?? null,
            status: s.status,
          })),
          updatedAt: new Date().toISOString(),
        },
      });
      // sendBeacon is the most reliable way to send data during page unload
      navigator.sendBeacon('/api/regulatory-save-beacon', payload);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

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
        style: { background: T.successLight, color: T.success, borderColor: T.success + '40' },
      });
      // Auto-save after successful generation
      triggerAutoSave();
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
        style: { background: T.dangerLight, color: T.danger, borderColor: T.danger + '40' },
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

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const handleSaveSettings = useCallback((vals: DocumentSettingsValues) => {
    console.log('[Regulatory] Document settings saved:', vals);
    toast.success('Document settings saved');
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
            // Save current project state before switching
            if (activeProjectId && activeProjectId !== projectId) {
              saveProjectState();
            }
            setActiveProject(projectId);
            lastRestoredProjectRef.current = null; // Allow restore for new project
          }}
          onSourcesChange={(sources) => {
            // Sidebar writes to store directly; auto-save when sources are ready
            if (sources.some((s) => s.status === 'ready')) {
              triggerAutoSave();
            }
          }}
        />

        {/* Main content — light theme */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: T.bg }}>
          {/* Top chat bar */}
          <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, boxShadow: T.shadow, display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: 1 }}>
              <BottomChatBar
                inline
                onSendMessage={handleSendMessage}
                selectedProject={activeProjectId?.toString()}
                isLoading={isGenerating}
                pendingContent={pendingChatContent}
                onPendingContentConsumed={() => setPendingChatContent(null)}
              />
            </div>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-1.5 px-4 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors border-l border-[#E2E8F0]"
              title="Document Settings"
              aria-label="Open document settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>

          {/* Save status indicator */}
          {saveStatus !== 'idle' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '5px 12px',
                background: saveStatus === 'saved' ? T.successLight : T.accentLight,
                borderBottom: `1px solid ${saveStatus === 'saved' ? '#86efac40' : T.accent + '20'}`,
                fontSize: 12,
                fontWeight: 500,
                color: saveStatus === 'saved' ? T.success : T.accent,
                transition: 'all 0.3s ease',
              }}
            >
              {saveStatus === 'saving' && (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Saving…
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check size={12} />
                  Saved
                </>
              )}
            </div>
          )}

          {/* Conversation memory indicator + Clear History */}
          {activeProjectId && conversationCount > 0 && (
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
                AI memory active — {Math.floor(conversationCount / 2)} prior exchange{Math.floor(conversationCount / 2) !== 1 ? 's' : ''} in this project
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
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#cbd5e1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
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
                    boxShadow: '0 2px 8px rgba(8,145,178,0.4)',
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
                  background: generationStage === 'error' ? T.dangerLight : generationStage === 'done' ? T.successLight : T.accentLight,
                  borderBottom: `1px solid ${generationStage === 'error' ? T.danger + '40' : generationStage === 'done' ? T.success + '40' : T.accent + '40'}`,
                  transition: 'all 0.3s ease',
                }}
              >
                {generationStage === 'error' ? (
                  <AlertCircle size={16} style={{ color: T.danger }} />
                ) : generationStage === 'done' ? (
                  <CheckCircle2 size={16} style={{ color: T.success }} />
                ) : (
                  <Loader2 size={16} className="animate-spin" style={{ color: T.accent }} />
                )}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: generationStage === 'error' ? T.danger : generationStage === 'done' ? T.success : T.accent,
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
                        color: T.textSub,
                        background: T.card,
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
                  <DocumentContentPanel onCitationClick={handleCitationClick} onAddToChat={(c) => { setPendingChatContent(c); toast.success('Added to chat input', { style: { background: T.card, color: T.text, border: `1px solid ${T.border}` }, duration: 1500 }); }} />
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
                  <DocumentContentPanel onCitationClick={handleCitationClick} onAddToChat={(c) => { setPendingChatContent(c); toast.success('Added to chat input', { style: { background: T.card, color: T.text, border: `1px solid ${T.border}` }, duration: 1500 }); }} />
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

      {/* Document Settings Modal */}
      <DocumentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
