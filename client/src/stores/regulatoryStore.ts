import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GeneratedDocument {
  id: number;
  type: string;
  title: string;
  content: string;
  citations: Array<{ text: string; source: string }>;
}

export interface Annotation {
  id: string;
  sentenceIndex: number;
  text: string;
  sourceName: string;
  color: 'yellow' | 'blue' | 'green' | 'purple' | 'orange';
}

export interface AIReference {
  id: string;
  sourceName: string;
  sourceType: string;
  excerpt: string;
  annotation: string;
  citationKey: string;
  color: 'yellow' | 'blue' | 'green' | 'purple' | 'orange';
}

export interface RegulatoryProject {
  id: string;
  name: string;
  description: string;
  regulatoryStandard: 'US' | 'EU';
  paperLayout: 'eSTAR' | 'document';
  referenceFormat: 'mla' | 'chicago' | 'apa';
  content: string;
  attachedFiles: string[];
  annotations: Annotation[];
  references: AIReference[];
  generatedDocuments: GeneratedDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Serialisable metadata for an uploaded source file (no File/Blob objects). */
export interface SourceFile {
  id: string;
  name: string;
  type: 'csv' | 'pdf' | 'xlsx';
  size: number;
  uploadedAt: string; // ISO string — safe for JSON serialisation
  parsedContent?: string;
  status: 'uploading' | 'parsing' | 'ready' | 'error';
}

interface RegulatoryStore {
  projects: RegulatoryProject[];
  activeProjectId: string | null;

  /** Per-project uploaded source files — persisted across navigation & refresh */
  sourcesByProject: Record<string, SourceFile[]>;

  /** Per-project LLM conversation history */
  conversationsByProject: Record<string, ConversationMessage[]>;

  // ── Project management ────────────────────────────────────────────────────
  createProject: (name: string, description: string) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string) => void;
  getActiveProject: () => RegulatoryProject | undefined;

  // ── Source file management ────────────────────────────────────────────────
  getProjectSources: (projectId: string) => SourceFile[];
  setProjectSources: (projectId: string, sources: SourceFile[]) => void;
  updateProjectSource: (projectId: string, sourceId: string, patch: Partial<SourceFile>) => void;
  removeProjectSource: (projectId: string, sourceId: string) => void;

  // ── Conversation history ──────────────────────────────────────────────────
  addConversationMessage: (projectId: string, message: ConversationMessage) => void;
  getConversationHistory: (projectId: string) => ConversationMessage[];
  clearConversationHistory: (projectId: string) => void;

  // ── Project content updates ───────────────────────────────────────────────
  updateProjectName: (id: string, name: string) => void;
  updateProjectContent: (id: string, content: string) => void;
  updateRegulatoryStandard: (id: string, standard: 'US' | 'EU') => void;
  updatePaperLayout: (id: string, layout: 'eSTAR' | 'document') => void;
  updateReferenceFormat: (id: string, format: 'mla' | 'chicago' | 'apa') => void;
  attachFile: (projectId: string, fileName: string) => void;
  detachFile: (projectId: string, fileName: string) => void;

  // ── Annotations & References ──────────────────────────────────────────────
  updateProjectAnnotations: (id: string, annotations: Annotation[]) => void;
  updateProjectReferences: (id: string, references: AIReference[]) => void;

  // ── Generated documents ───────────────────────────────────────────────────
  addGeneratedDocuments: (documents: GeneratedDocument[]) => void;
  getGeneratedDocuments: (projectId: string) => GeneratedDocument[];
  updateGeneratedDocument: (projectId: string, documentId: number, content: string) => void;
}

/** Revive Date strings → Date objects after JSON rehydration from localStorage. */
function reviveDates(projects: RegulatoryProject[]): RegulatoryProject[] {
  return projects.map((p) => ({
    ...p,
    createdAt: p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt),
  }));
}

const DEFAULT_PROJECTS: RegulatoryProject[] = [
  {
    id: '1',
    name: '510k Submission',
    description: 'Premarket notification for substantially equivalent devices',
    regulatoryStandard: 'US',
    paperLayout: 'eSTAR',
    referenceFormat: 'apa',
    content: '',
    attachedFiles: [],
    annotations: [],
    references: [],
    generatedDocuments: [],
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  },
  {
    id: '2',
    name: 'PMA Application',
    description: 'Premarket approval application for high-risk devices',
    regulatoryStandard: 'US',
    paperLayout: 'document',
    referenceFormat: 'apa',
    content: '',
    attachedFiles: [],
    annotations: [],
    references: [],
    generatedDocuments: [],
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-01-20'),
  },
];

export const useRegulatoryStore = create<RegulatoryStore>()(
  persist(
    (set, get) => ({
      projects: DEFAULT_PROJECTS,
      activeProjectId: '1',
      sourcesByProject: {},
      conversationsByProject: {},

      // ── Source file management ──────────────────────────────────────────
      getProjectSources: (projectId) => get().sourcesByProject[projectId] ?? [],

      setProjectSources: (projectId, sources) =>
        set((state) => ({
          sourcesByProject: { ...state.sourcesByProject, [projectId]: sources },
        })),

      updateProjectSource: (projectId, sourceId, patch) =>
        set((state) => ({
          sourcesByProject: {
            ...state.sourcesByProject,
            [projectId]: (state.sourcesByProject[projectId] ?? []).map((s) =>
              s.id === sourceId ? { ...s, ...patch } : s
            ),
          },
        })),

      removeProjectSource: (projectId, sourceId) =>
        set((state) => ({
          sourcesByProject: {
            ...state.sourcesByProject,
            [projectId]: (state.sourcesByProject[projectId] ?? []).filter(
              (s) => s.id !== sourceId
            ),
          },
        })),

      // ── Conversation history ────────────────────────────────────────────
      addConversationMessage: (projectId, message) =>
        set((state) => ({
          conversationsByProject: {
            ...state.conversationsByProject,
            [projectId]: [
              ...(state.conversationsByProject[projectId] ?? []),
              message,
            ],
          },
        })),

      getConversationHistory: (projectId) =>
        get().conversationsByProject[projectId] ?? [],

      clearConversationHistory: (projectId) =>
        set((state) => ({
          conversationsByProject: {
            ...state.conversationsByProject,
            [projectId]: [],
          },
        })),

      // ── Project management ──────────────────────────────────────────────
      createProject: (name, description) => {
        const newProject: RegulatoryProject = {
          id: Date.now().toString(),
          name,
          description,
          regulatoryStandard: 'US',
          paperLayout: 'eSTAR',
          referenceFormat: 'apa',
          content: '',
          attachedFiles: [],
          annotations: [],
          references: [],
          generatedDocuments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({
          projects: [...state.projects, newProject],
          activeProjectId: newProject.id,
        }));
      },

      deleteProject: (id) =>
        set((state) => {
          const filtered = state.projects.filter((p) => p.id !== id);
          const { [id]: _rC, ...restConvos } = state.conversationsByProject;
          const { [id]: _rS, ...restSources } = state.sourcesByProject;
          return {
            projects: filtered,
            activeProjectId: filtered.length > 0 ? filtered[0].id : null,
            conversationsByProject: restConvos,
            sourcesByProject: restSources,
          };
        }),

      setActiveProject: (id) => set({ activeProjectId: id }),

      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find((p) => p.id === activeProjectId);
      },

      // ── Project content ─────────────────────────────────────────────────
      updateProjectName: (id, name) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: new Date() } : p
          ),
        })),

      updateProjectContent: (id, content) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, content, updatedAt: new Date() } : p
          ),
        })),

      updateRegulatoryStandard: (id, standard) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, regulatoryStandard: standard, updatedAt: new Date() } : p
          ),
        })),

      updatePaperLayout: (id, layout) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, paperLayout: layout, updatedAt: new Date() } : p
          ),
        })),

      updateReferenceFormat: (id, format) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, referenceFormat: format, updatedAt: new Date() } : p
          ),
        })),

      attachFile: (projectId, fileName) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId && !p.attachedFiles.includes(fileName)
              ? { ...p, attachedFiles: [...p.attachedFiles, fileName], updatedAt: new Date() }
              : p
          ),
        })),

      detachFile: (projectId, fileName) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, attachedFiles: p.attachedFiles.filter((f) => f !== fileName), updatedAt: new Date() }
              : p
          ),
        })),

      // ── Annotations & References ────────────────────────────────────────
      updateProjectAnnotations: (id, annotations) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, annotations, updatedAt: new Date() } : p
          ),
        })),

      updateProjectReferences: (id, references) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, references, updatedAt: new Date() } : p
          ),
        })),

      // ── Generated documents ─────────────────────────────────────────────
      addGeneratedDocuments: (documents) =>
        set((state) => {
          const active = state.projects.find((p) => p.id === state.activeProjectId);
          if (!active) return state;
          return {
            projects: state.projects.map((p) =>
              p.id === state.activeProjectId
                ? { ...p, generatedDocuments: [...p.generatedDocuments, ...documents], updatedAt: new Date() }
                : p
            ),
          };
        }),

      getGeneratedDocuments: (projectId) =>
        get().projects.find((p) => p.id === projectId)?.generatedDocuments ?? [],

      updateGeneratedDocument: (projectId, documentId, content) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  generatedDocuments: p.generatedDocuments.map((d) =>
                    d.id === documentId ? { ...d, content } : d
                  ),
                  updatedAt: new Date(),
                }
              : p
          ),
        })),
    }),
    {
      name: 'nuphorm-regulatory-v1',
      // Revive Date strings back to Date objects after localStorage rehydration
      onRehydrateStorage: () => (state) => {
        if (state?.projects) {
          state.projects = reviveDates(state.projects);
        }
      },
      // Don't persist computed/getter functions — Zustand handles this automatically
      // but we explicitly skip very large parsedContent over 50 KB per project
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        conversationsByProject: state.conversationsByProject,
        sourcesByProject: Object.fromEntries(
          Object.entries(state.sourcesByProject).map(([pid, sources]) => [
            pid,
            sources.map((s) => ({
              ...s,
              // Cap stored parsedContent at 4 KB to keep localStorage healthy
              parsedContent: s.parsedContent && s.parsedContent.length > 4096
                ? s.parsedContent.slice(0, 4096) + '\n...[truncated]'
                : s.parsedContent,
            })),
          ])
        ),
      }),
    }
  )
);
