/**
 * Biostatistics File Manager Service
 * Handles saving charts and data to organized project folders
 */

export interface SavedChart {
  id: string;
  projectId: string;
  projectName: string;
  chartSetId: string;
  chartSetName: string;
  chartTitle: string;
  chartType: string;
  data: Record<string, any>[];
  selectedVariables: Array<{ name: string; type: string; color: string }>;
  dataFiles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFolder {
  projectId: string;
  projectName: string;
  createdAt: string;
  chartSets: ChartSet[];
}

export interface ChartSet {
  id: string;
  name: string;
  charts: SavedChart[];
  createdAt: string;
}

// In-memory storage for saved biostatistics files
let savedProjects: Map<string, ProjectFolder> = new Map();
let savedCharts: SavedChart[] = [];

/**
 * Create or get a project folder
 */
export const getOrCreateProjectFolder = (projectId: string, projectName: string): ProjectFolder => {
  if (!savedProjects.has(projectId)) {
    const newProject: ProjectFolder = {
      projectId,
      projectName,
      createdAt: new Date().toISOString(),
      chartSets: [],
    };
    savedProjects.set(projectId, newProject);
  }
  return savedProjects.get(projectId)!;
};

/**
 * Create a new chart set within a project
 */
export const createChartSet = (projectId: string, chartSetName: string): ChartSet => {
  const project = getOrCreateProjectFolder(projectId, '');
  
  const chartSet: ChartSet = {
    id: `chartset-${Date.now()}`,
    name: chartSetName,
    charts: [],
    createdAt: new Date().toISOString(),
  };
  
  project.chartSets.push(chartSet);
  return chartSet;
};

/**
 * Save a chart to a project folder
 */
export const saveChartToProject = (
  projectId: string,
  projectName: string,
  chartSetId: string,
  chartSetName: string,
  chartData: {
    title: string;
    chartType: string;
    data: Record<string, any>[];
    selectedVariables: Array<{ name: string; type: string; color: string }>;
    dataFiles: string[];
  }
): SavedChart => {
  const project = getOrCreateProjectFolder(projectId, projectName);
  
  // Find or create chart set
  let chartSet = project.chartSets.find((cs) => cs.id === chartSetId);
  if (!chartSet) {
    chartSet = createChartSet(projectId, chartSetName);
  }
  
  // Create new chart
  const savedChart: SavedChart = {
    id: `chart-${Date.now()}`,
    projectId,
    projectName,
    chartSetId: chartSet.id,
    chartSetName: chartSet.name,
    chartTitle: chartData.title,
    chartType: chartData.chartType,
    data: chartData.data,
    selectedVariables: chartData.selectedVariables,
    dataFiles: chartData.dataFiles,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  chartSet.charts.push(savedChart);
  savedCharts.push(savedChart);
  
  return savedChart;
};

/**
 * Get all saved charts for a project
 */
export const getProjectCharts = (projectId: string): SavedChart[] => {
  return savedCharts.filter((chart) => chart.projectId === projectId);
};

/**
 * Get all saved projects
 */
export const getAllProjects = (): ProjectFolder[] => {
  return Array.from(savedProjects.values());
};

/**
 * Delete a chart
 */
export const deleteChart = (chartId: string): boolean => {
  const index = savedCharts.findIndex((c) => c.id === chartId);
  if (index !== -1) {
    const chart = savedCharts[index];
    savedCharts.splice(index, 1);
    
    // Also remove from project structure
    const project = savedProjects.get(chart.projectId);
    if (project) {
      const chartSet = project.chartSets.find((cs) => cs.id === chart.chartSetId);
      if (chartSet) {
        chartSet.charts = chartSet.charts.filter((c) => c.id !== chartId);
      }
    }
    
    return true;
  }
  return false;
};

/**
 * Delete a chart set and all its charts
 */
export const deleteChartSet = (projectId: string, chartSetId: string): boolean => {
  const project = savedProjects.get(projectId);
  if (project) {
    const chartSetIndex = project.chartSets.findIndex((cs) => cs.id === chartSetId);
    if (chartSetIndex !== -1) {
      const chartSet = project.chartSets[chartSetIndex];
      
      // Remove all charts in this set from savedCharts
      chartSet.charts.forEach((chart) => {
        const index = savedCharts.findIndex((c) => c.id === chart.id);
        if (index !== -1) {
          savedCharts.splice(index, 1);
        }
      });
      
      // Remove chart set from project
      project.chartSets.splice(chartSetIndex, 1);
      return true;
    }
  }
  return false;
};

/**
 * Export chart data as JSON
 */
export const exportChartAsJSON = (chartId: string): string | null => {
  const chart = savedCharts.find((c) => c.id === chartId);
  if (!chart) return null;
  
  return JSON.stringify(chart, null, 2);
};

/**
 * Export chart data as CSV
 */
export const exportChartAsCSV = (chartId: string): string | null => {
  const chart = savedCharts.find((c) => c.id === chartId);
  if (!chart || chart.data.length === 0) return null;
  
  const headers = Object.keys(chart.data[0]);
  const rows = chart.data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
};
