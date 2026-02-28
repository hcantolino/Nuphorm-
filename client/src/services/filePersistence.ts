/**
 * File Persistence Service
 * Handles persistent storage of biostatistics projects and charts using localStorage
 */

import { SavedChart, ProjectFolder, ChartSet } from './biostatFileManager';

const STORAGE_KEY = 'medreg_biostat_projects';
const CHART_STORAGE_KEY = 'medreg_biostat_charts';

/**
 * Initialize storage with default values if not present
 */
export const initializeStorage = () => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(CHART_STORAGE_KEY)) {
    localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify([]));
  }
};

/**
 * Load all projects from storage
 */
export const loadProjectsFromStorage = (): ProjectFolder[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load projects from storage:', error);
    return [];
  }
};

/**
 * Load all charts from storage
 */
export const loadChartsFromStorage = (): SavedChart[] => {
  try {
    const data = localStorage.getItem(CHART_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load charts from storage:', error);
    return [];
  }
};

/**
 * Save projects to storage
 */
export const saveProjectsToStorage = (projects: ProjectFolder[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    console.error('Failed to save projects to storage:', error);
  }
};

/**
 * Save charts to storage
 */
export const saveChartsToStorage = (charts: SavedChart[]) => {
  try {
    localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(charts));
  } catch (error) {
    console.error('Failed to save charts to storage:', error);
  }
};

/**
 * Add a new project to storage
 */
export const addProjectToStorage = (project: ProjectFolder) => {
  const projects = loadProjectsFromStorage();
  const existingIndex = projects.findIndex((p) => p.projectId === project.projectId);
  
  if (existingIndex >= 0) {
    projects[existingIndex] = project;
  } else {
    projects.push(project);
  }
  
  saveProjectsToStorage(projects);
  return projects;
};

/**
 * Add a chart to storage
 */
export const addChartToStorage = (chart: SavedChart) => {
  const charts = loadChartsFromStorage();
  charts.push(chart);
  saveChartsToStorage(charts);
  return charts;
};

/**
 * Get a specific project from storage
 */
export const getProjectFromStorage = (projectId: string): ProjectFolder | null => {
  const projects = loadProjectsFromStorage();
  return projects.find((p) => p.projectId === projectId) || null;
};

/**
 * Get all charts for a project from storage
 */
export const getProjectChartsFromStorage = (projectId: string): SavedChart[] => {
  const charts = loadChartsFromStorage();
  return charts.filter((c) => c.projectId === projectId);
};

/**
 * Delete a chart from storage
 */
export const deleteChartFromStorage = (chartId: string): boolean => {
  const charts = loadChartsFromStorage();
  const index = charts.findIndex((c) => c.id === chartId);
  
  if (index >= 0) {
    charts.splice(index, 1);
    saveChartsToStorage(charts);
    return true;
  }
  
  return false;
};

/**
 * Delete a chart set from storage
 */
export const deleteChartSetFromStorage = (projectId: string, chartSetId: string): boolean => {
  const projects = loadProjectsFromStorage();
  const project = projects.find((p) => p.projectId === projectId);
  
  if (!project) return false;
  
  const chartSetIndex = project.chartSets.findIndex((cs) => cs.id === chartSetId);
  if (chartSetIndex >= 0) {
    const chartSet = project.chartSets[chartSetIndex];
    
    // Remove all charts in this set
    const charts = loadChartsFromStorage();
    const filteredCharts = charts.filter(
      (c) => !chartSet.charts.some((sc) => sc.id === c.id)
    );
    saveChartsToStorage(filteredCharts);
    
    // Remove chart set from project
    project.chartSets.splice(chartSetIndex, 1);
    saveProjectsToStorage(projects);
    
    return true;
  }
  
  return false;
};

/**
 * Delete a project from storage
 */
export const deleteProjectFromStorage = (projectId: string): boolean => {
  const projects = loadProjectsFromStorage();
  const index = projects.findIndex((p) => p.projectId === projectId);
  
  if (index >= 0) {
    // Remove all charts for this project
    const charts = loadChartsFromStorage();
    const filteredCharts = charts.filter((c) => c.projectId !== projectId);
    saveChartsToStorage(filteredCharts);
    
    // Remove project
    projects.splice(index, 1);
    saveProjectsToStorage(projects);
    
    return true;
  }
  
  return false;
};

/**
 * Export chart data as JSON file content
 */
export const exportChartAsJSON = (chartId: string): string | null => {
  const charts = loadChartsFromStorage();
  const chart = charts.find((c) => c.id === chartId);
  
  if (!chart) return null;
  
  return JSON.stringify(chart, null, 2);
};

/**
 * Export chart data as CSV file content
 */
export const exportChartAsCSV = (chartId: string): string | null => {
  const charts = loadChartsFromStorage();
  const chart = charts.find((c) => c.id === chartId);
  
  if (!chart || chart.data.length === 0) return null;
  
  const headers = Object.keys(chart.data[0]);
  const rows = chart.data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
};

/**
 * Clear all storage (for testing/reset)
 */
export const clearAllStorage = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CHART_STORAGE_KEY);
};
