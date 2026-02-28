import { create } from 'zustand';

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
  generatedDocuments: GeneratedDocument[];
  createdAt: Date;
  updatedAt: Date;
}

interface RegulatoryStore {
  projects: RegulatoryProject[];
  activeProjectId: string | null;
  
  // Project management
  createProject: (name: string, description: string) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string) => void;
  getActiveProject: () => RegulatoryProject | undefined;
  
  // Project updates
  updateProjectName: (id: string, name: string) => void;
  updateProjectContent: (id: string, content: string) => void;
  updateRegulatoryStandard: (id: string, standard: 'US' | 'EU') => void;
  updatePaperLayout: (id: string, layout: 'eSTAR' | 'document') => void;
  updateReferenceFormat: (id: string, format: 'mla' | 'chicago' | 'apa') => void;
  attachFile: (projectId: string, fileName: string) => void;
  detachFile: (projectId: string, fileName: string) => void;
  
  // Annotations
  updateProjectAnnotations: (id: string, annotations: Annotation[]) => void;

  // Generated documents
  addGeneratedDocuments: (documents: GeneratedDocument[]) => void;
  getGeneratedDocuments: (projectId: string) => GeneratedDocument[];
  updateGeneratedDocument: (projectId: string, documentId: number, content: string) => void;
}

export const useRegulatoryStore = create<RegulatoryStore>((set, get) => ({
  projects: [
    {
      id: '1',
      name: 'Sample FDA Submission',
      description: 'Initial regulatory submission for clinical trial',
      regulatoryStandard: 'US',
      paperLayout: 'eSTAR',
      referenceFormat: 'apa',
      content: 'This is a sample regulatory document...',
      attachedFiles: ['Clinical_Trial_Data.csv', 'Statistical_Analysis.xlsx'],
      annotations: [],
      generatedDocuments: [],
      createdAt: new Date('2026-01-15'),
      updatedAt: new Date('2026-01-28'),
    },
  ],
  activeProjectId: '1',

  createProject: (name: string, description: string) => {
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
      generatedDocuments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => ({
      projects: [...state.projects, newProject],
      activeProjectId: newProject.id,
    }));
  },

  deleteProject: (id: string) => {
    set((state) => {
      const filtered = state.projects.filter((p) => p.id !== id);
      return {
        projects: filtered,
        activeProjectId: filtered.length > 0 ? filtered[0].id : null,
      };
    });
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id });
  },

  getActiveProject: () => {
    const state = get();
    return state.projects.find((p) => p.id === state.activeProjectId);
  },

  updateProjectName: (id: string, name: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: new Date() } : p
      ),
    }));
  },

  updateProjectContent: (id: string, content: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, content, updatedAt: new Date() } : p
      ),
    }));
  },

  updateRegulatoryStandard: (id: string, standard: 'US' | 'EU') => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, regulatoryStandard: standard, updatedAt: new Date() } : p
      ),
    }));
  },

  updatePaperLayout: (id: string, layout: 'eSTAR' | 'document') => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, paperLayout: layout, updatedAt: new Date() } : p
      ),
    }));
  },

  updateReferenceFormat: (id: string, format: 'mla' | 'chicago' | 'apa') => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, referenceFormat: format, updatedAt: new Date() } : p
      ),
    }));
  },

  attachFile: (projectId: string, fileName: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId && !p.attachedFiles.includes(fileName)
          ? { ...p, attachedFiles: [...p.attachedFiles, fileName], updatedAt: new Date() }
          : p
      ),
    }));
  },

  detachFile: (projectId: string, fileName: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              attachedFiles: p.attachedFiles.filter((f) => f !== fileName),
              updatedAt: new Date(),
            }
          : p
      ),
    }));
  },

  updateProjectAnnotations: (id: string, annotations: Annotation[]) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, annotations, updatedAt: new Date() } : p
      ),
    }));
  },

  addGeneratedDocuments: (documents: GeneratedDocument[]) => {
    set((state) => {
      const activeProject = state.projects.find(p => p.id === state.activeProjectId);
      if (!activeProject) return state;

      return {
        projects: state.projects.map((p) =>
          p.id === state.activeProjectId
            ? {
                ...p,
                generatedDocuments: [...p.generatedDocuments, ...documents],
                updatedAt: new Date(),
              }
            : p
        ),
      };
    });
  },

  getGeneratedDocuments: (projectId: string) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    return project?.generatedDocuments || [];
  },

  updateGeneratedDocument: (projectId: string, documentId: number, content: string) => {
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
    }));
  },
}));
