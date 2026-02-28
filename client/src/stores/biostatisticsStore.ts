import { create } from 'zustand';

export interface BiostatisticsProject {
  id: string;
  name: string;
  description: string;
  uploadedDataFile?: string;
  uploadedDataName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisTabData {
  measurements: string[];
  files: string[];
  chatHistory: { role: string; content: string }[];
}

interface BiostatisticsStore {
  projects: BiostatisticsProject[];
  activeProjectId: string | null;
  // Per-analysis state: key = `${projectId}:${analysisType}`
  analysisData: Record<string, AnalysisTabData>;
  // Active analysis type per project: key = projectId
  activeAnalysisTypes: Record<string, string>;

  // Project management
  createProject: (name: string, description: string) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, newName: string) => void;
  setActiveProject: (id: string | null) => void;
  getActiveProject: () => BiostatisticsProject | null;
  updateProjectData: (id: string, dataFile: string, dataName: string) => void;

  // Per-analysis data
  getAnalysisData: (projectId: string, analysisType: string) => AnalysisTabData;
  setAnalysisMeasurements: (projectId: string, analysisType: string, measurements: string[]) => void;
  setAnalysisFiles: (projectId: string, analysisType: string, files: string[]) => void;
  addAnalysisChatMessage: (projectId: string, analysisType: string, message: { role: string; content: string }) => void;
  setActiveAnalysisType: (projectId: string, analysisType: string) => void;
  getActiveAnalysisType: (projectId: string) => string;
}

export const DEFAULT_ANALYSIS_TYPE = 'Descriptive Statistics';

export const useBiostatisticsStore = create<BiostatisticsStore>((set, get) => ({
  projects: [
    {
      id: 'default-1',
      name: 'Sample Biostatistics Project',
      description: 'Example project for clinical trial analysis',
      uploadedDataFile: 'Clinical_Trial_Data.csv',
      uploadedDataName: 'Clinical Trial Data',
      createdAt: '2026-01-28',
      updatedAt: '2026-01-28',
    },
  ],
  activeProjectId: 'default-1',
  analysisData: {},
  activeAnalysisTypes: {},

  createProject: (name: string, description: string) => {
    const newProject: BiostatisticsProject = {
      id: `project-${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    set((state) => ({
      projects: [...state.projects, newProject],
      activeProjectId: newProject.id,
    }));

    return newProject.id;
  },

  deleteProject: (id: string) => {
    set((state) => {
      const newProjects = state.projects.filter((p) => p.id !== id);
      return {
        projects: newProjects,
        activeProjectId:
          state.activeProjectId === id
            ? (newProjects[0]?.id || null)
            : state.activeProjectId,
      };
    });
  },

  renameProject: (id: string, newName: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              name: newName.trim() || p.name,
              updatedAt: new Date().toISOString().split('T')[0],
            }
          : p
      ),
    }));
  },

  setActiveProject: (id: string | null) => {
    set({ activeProjectId: id });
  },

  getActiveProject: () => {
    const state = get();
    return state.projects.find((p) => p.id === state.activeProjectId) || null;
  },

  updateProjectData: (id: string, dataFile: string, dataName: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              uploadedDataFile: dataFile,
              uploadedDataName: dataName,
              updatedAt: new Date().toISOString().split('T')[0],
            }
          : p
      ),
    }));
  },

  getAnalysisData: (projectId: string, analysisType: string) => {
    const key = `${projectId}:${analysisType}`;
    return get().analysisData[key] ?? { measurements: [], files: [], chatHistory: [] };
  },

  setAnalysisMeasurements: (projectId: string, analysisType: string, measurements: string[]) => {
    const key = `${projectId}:${analysisType}`;
    set((state) => ({
      analysisData: {
        ...state.analysisData,
        [key]: {
          ...(state.analysisData[key] ?? { files: [], chatHistory: [] }),
          measurements,
        },
      },
    }));
  },

  setAnalysisFiles: (projectId: string, analysisType: string, files: string[]) => {
    const key = `${projectId}:${analysisType}`;
    set((state) => ({
      analysisData: {
        ...state.analysisData,
        [key]: {
          ...(state.analysisData[key] ?? { measurements: [], chatHistory: [] }),
          files,
        },
      },
    }));
  },

  addAnalysisChatMessage: (
    projectId: string,
    analysisType: string,
    message: { role: string; content: string }
  ) => {
    const key = `${projectId}:${analysisType}`;
    set((state) => {
      const existing = state.analysisData[key] ?? {
        measurements: [],
        files: [],
        chatHistory: [],
      };
      return {
        analysisData: {
          ...state.analysisData,
          [key]: {
            ...existing,
            chatHistory: [...existing.chatHistory, message],
          },
        },
      };
    });
  },

  setActiveAnalysisType: (projectId: string, analysisType: string) => {
    set((state) => ({
      activeAnalysisTypes: {
        ...state.activeAnalysisTypes,
        [projectId]: analysisType,
      },
    }));
  },

  getActiveAnalysisType: (projectId: string) => {
    return get().activeAnalysisTypes[projectId] ?? DEFAULT_ANALYSIS_TYPE;
  },
}));
