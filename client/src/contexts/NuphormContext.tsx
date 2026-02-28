import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Global state context for Nuphorm document creator
 * Manages projects, sources, settings, and document generation state
 */

export interface Project {
  id: string;
  name: string;
  deviceName: string;
  deviceType: string;
  intendedUse: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'in_progress' | 'completed';
}

export interface SourceFile {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'txt' | 'url';
  url?: string;
  content?: string;
  uploadedAt: Date;
  size: number;
}

export interface DocumentSettings {
  repositoryOnly: boolean;
  aiConfidence: number; // 0-1
  includeReferences: boolean;
  citationStyle: 'apa' | 'mla' | 'chicago';
}

export interface NuphormContextType {
  // Projects
  projects: Project[];
  activeProjectId: string | null;
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  setActiveProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;

  // Sources
  sources: SourceFile[];
  addSource: (source: SourceFile) => void;
  removeSource: (sourceId: string) => void;
  updateSource: (sourceId: string, updates: Partial<SourceFile>) => void;

  // Settings
  settings: DocumentSettings;
  updateSettings: (settings: Partial<DocumentSettings>) => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Helpers
  getActiveProject: () => Project | undefined;
  getProjectSources: (projectId: string) => SourceFile[];
}

const NuphormContext = createContext<NuphormContextType | undefined>(undefined);

export const NuphormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: 'proj-1',
      name: 'Device XYZ 510(k)',
      deviceName: 'Device XYZ',
      deviceType: 'diagnostic',
      intendedUse: 'In vitro diagnostic device for rapid testing',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-02-10'),
      status: 'in_progress',
    },
  ]);

  const [sources, setSources] = useState<SourceFile[]>([
    {
      id: 'src-1',
      name: 'Predicate Device Specifications',
      type: 'pdf',
      uploadedAt: new Date('2024-02-01'),
      size: 2500000,
      content: 'Device specifications and performance characteristics...',
    },
    {
      id: 'src-2',
      name: 'Clinical Trial Results',
      type: 'pdf',
      uploadedAt: new Date('2024-02-05'),
      size: 4200000,
      content: 'Clinical trial data and statistical analysis...',
    },
  ]);

  const [activeProjectId, setActiveProjectIdState] = useState<string | null>('proj-1');
  const setActiveProject = setActiveProjectIdState;

  const [settings, setSettings] = useState<DocumentSettings>({
    repositoryOnly: true,
    aiConfidence: 0.85,
    includeReferences: true,
    citationStyle: 'apa',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project management
  const createProject = useCallback((project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProject: Project = {
      ...project,
      id: `proj-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectIdState(newProject.id);
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectIdState(projects[0]?.id || null);
    }
  }, [activeProjectId, projects]);

  // Source management
  const addSource = useCallback((source: SourceFile) => {
    setSources((prev) => [...prev, source]);
  }, []);

  const removeSource = useCallback((sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  }, []);

  const updateSource = useCallback((sourceId: string, updates: Partial<SourceFile>) => {
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, ...updates } : s))
    );
  }, []);

  // Settings management
  const updateSettings = useCallback((newSettings: Partial<DocumentSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Helpers
  const getActiveProject = useCallback(() => {
    return projects.find((p) => p.id === activeProjectId);
  }, [projects, activeProjectId]);

  const getProjectSources = useCallback((projectId: string) => {
    // In a real app, sources would be linked to projects
    // For now, return all sources
    return sources;
  }, [sources]);

  const value = useMemo<NuphormContextType>(
    () => ({
      projects,
      activeProjectId,
      createProject,
      setActiveProject: setActiveProjectIdState,
      deleteProject,
      sources,
      addSource,
      removeSource,
      updateSource,
      settings,
      updateSettings,
      isLoading,
      setIsLoading,
      error,
      setError,
      getActiveProject,
      getProjectSources,
    }),
    [
      projects,
      activeProjectId,
      createProject,
      deleteProject,
      sources,
      addSource,
      removeSource,
      updateSource,
      settings,
      updateSettings,
      isLoading,
      error,
      getActiveProject,
      getProjectSources,
    ]
  );

  return (
    <NuphormContext.Provider value={value}>
      {children}
    </NuphormContext.Provider>
  );
};

export const useNuphorm = () => {
  const context = useContext(NuphormContext);
  if (!context) {
    throw new Error('useNuphorm must be used within NuphormProvider');
  }
  return context;
};
