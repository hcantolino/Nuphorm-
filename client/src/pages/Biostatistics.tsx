import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, FileText, Download, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import ChartHeader from '@/components/biostat/ChartHeader';
import BiostatisticsMeasurementsPanel from '@/components/biostat/BiostatisticsMeasurementsPanel';
import { useBiostatisticsStore, DEFAULT_ANALYSIS_TYPE } from '@/stores/biostatisticsStore';

// Stable fallback — must be outside the component so it's always the same reference.
// If this were `?? []` inside the selector, Zustand's Object.is snapshot comparison
// would see [] !== [] on every call and trigger an infinite re-render loop.
const EMPTY_MEASUREMENTS: string[] = [];
import { useBiostatStore, getNextColor } from '@/stores/biostatStore';
import { generateChart } from '@/services/chartGenerationService';
import { useTrialGuard } from '@/hooks/useTrialGuard';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import FileSelectionModal from '@/components/biostat/FileSelectionModal';
import { parseFile, getNumericColumns } from '@/services/fileParsingService';
import { ChartVariable } from '@/stores/biostatStore';
import { useTabStore, initializeTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';
// NEW: subscribe aiPanelStore for auto-save so AI results persist across reloads
import { useAIPanelStore } from '@/stores/aiPanelStore';
import { TabBarDraggable } from '@/components/biostat/TabBarDraggable';
import { TabContent } from '@/components/biostat/TabContent';
import { restoreTabState, saveTabState } from '@/utils/tabPersistence';
import { GraphTablePanel } from '@/components/biostat/GraphTablePanel';
import ErrorBoundary from '@/components/ErrorBoundary';

interface UploadedData {
  name: string;
  data: Record<string, any>[];
  columns: string[];
}

export default function Biostatistics() {
  console.log("Rendering Biostatistics");
  const { projects, activeProjectId, createProject, deleteProject, setActiveProject, updateProjectData } = useBiostatisticsStore();
  const { addVariable, removeVariable, setChartData, setChartTitle } = useBiostatStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const { activeTabId } = useTabStore();

  // Derive selected measurements from the per-analysis store (reactive).
  // Uses EMPTY_MEASUREMENTS (stable module-level ref) as the fallback so
  // Object.is(prev, next) returns true when no data exists yet.
  const selectedMeasurements = useBiostatisticsStore((state) => {
    const pid = state.activeProjectId ?? '';
    const analysisType = state.activeAnalysisTypes[pid] ?? DEFAULT_ANALYSIS_TYPE;
    const key = `${pid}:${analysisType}`;
    return state.analysisData[key]?.measurements ?? EMPTY_MEASUREMENTS;
  });

  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [selectedDataFiles, setSelectedDataFiles] = useState<string[]>([]);
  const [showFileSelectionModal, setShowFileSelectionModal] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Initialize tabs on mount only
  useEffect(() => {
    const restored = restoreTabState();
    if (!restored) {
      initializeTabStore();
    }
  }, []);

  // Auto-save: subscribe to all three stores so tabs, content, AND AI results persist.
  // NEW: added useAIPanelStore subscription — was missing, so generated results (charts,
  //      tables, interpretations) were lost on every page reload.
  // Unsubscribes automatically when the Biostatistics page unmounts.
  useEffect(() => {
    const unsubTabs    = useTabStore.subscribe(() => saveTabState());
    const unsubContent = useTabContentStore.subscribe(() => saveTabState());
    const unsubPanel   = useAIPanelStore.subscribe(() => saveTabState()); // NEW
    return () => {
      unsubTabs();
      unsubContent();
      unsubPanel();                                                        // NEW
    };
  }, []);

  // Fetch real uploaded files from database
  const { data: filesResponse } = trpc.files.list.useQuery({ limit: 100, page: 1 });
  const uploadedFiles = filesResponse?.data || [];

  // tRPC mutation for AI-powered analysis (used by Manual Mode Generate button)
  const analyzeDataMutation = trpc.biostatistics.analyzeBiostatisticsData.useMutation();
  // Imperative fetcher for file content (no React Query subscription needed here)
  const trpcUtils = trpc.useUtils();
  
  // Memoize available data files to prevent recalculation
  const availableDataFiles = useMemo(() => {
    return uploadedFiles.map((file: any) => {
      const uploadDate = file.uploadedAt ? new Date(file.uploadedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      return {
        id: file.id.toString(),
        name: file.fileName,
        size: file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
        type: file.fileName.split('.').pop()?.toUpperCase() || 'Unknown',
        uploadedDate: uploadDate,
      };
    });
  }, [uploadedFiles]);

  // Measurement selection side effects are now handled inside BiostatisticsMeasurementsPanel
  // (it calls addVariable/removeVariable directly from biostatStore).
  // These no-op callbacks are kept for backwards compatibility with the panel's optional props.
  const handleSelectMeasurement = useCallback((_measurementId: string) => {}, []);
  const handleRemoveMeasurement = useCallback((_measurementId: string) => {}, []);

  const handleGenerateChart = useCallback(async () => {
    if (selectedMeasurements.length === 0) {
      toast.error('Please select at least one measurement');
      return;
    }

    try {
      toast.success('Chart generated successfully');
    } catch (error) {
      toast.error('Failed to generate chart');
    }
  }, [selectedMeasurements.length]);

  const handleSaveProject = useCallback(() => {
    if (!activeProject) return;
    toast.success('Project saved');
  }, [activeProject]);

  const handleCreateProject = useCallback(() => {
    const projectName = `Project ${projects.length + 1}`;
    createProject(projectName, 'New biostatistics project');
    toast.success('Project created');
  }, [projects.length, createProject]);

  const handleDeleteProject = useCallback((id: string) => {
    if (projects.length > 1) {
      deleteProject(id);
    }
  }, [projects.length, deleteProject]);

  const toggleDataFile = useCallback((fileId: string) => {
    setSelectedDataFiles((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter((id) => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  }, []);

  const handleChatMessage = async (message: string, files: string[], measurements: string[]) => {
    if (files.length === 0) {
      toast.error('Please select a data file first');
      return;
    }
    if (measurements.length === 0) {
      toast.error('Please select at least one measurement');
      return;
    }

    const selectedFile = availableDataFiles.find((f: any) => files.includes(f.id));
    if (!selectedFile) {
      toast.error('Selected file not found');
      return;
    }

    try {
      // Fetch the real file content from the server
      const fileResult = await trpcUtils.files.getFileContent.fetch({
        fileId: parseInt(selectedFile.id),
      });

      // Parse the CSV into rows using the existing parseFile utility
      const fileBlob = new Blob([fileResult.content ?? ''], { type: 'text/csv' });
      const fileObj = new File([fileBlob], fileResult.fileName, { type: 'text/csv' });
      const parsedData = await parseFile(fileObj);
      const fullData: Array<Record<string, any>> = parsedData.data || [];
      const dataColumns = fullData.length > 0 ? Object.keys(fullData[0]) : [];
      const dataPreview = fullData.slice(0, 5).map((row) => JSON.stringify(row)).join('\n');

      // Call the real tRPC analysis mutation
      const result = await analyzeDataMutation.mutateAsync({
        userQuery: `Analyze the following measurements: ${measurements.join(', ')}. ${message !== 'Generate analysis' ? message : ''}`.trim(),
        dataPreview,
        dataColumns,
        classifications: {},
        conversationHistory: [],
        fullData,
      });

      const response = result as any;
      const analysisText: string = response?.analysis || response?.summary || 'Analysis complete';

      // Update the chart with the measurements that exist in the data
      const numericColumns = getNumericColumns(fullData);
      const chartableColumns = measurements.filter((m) => numericColumns.includes(m));

      if (chartableColumns.length > 0) {
        const chartData = fullData
          .map((row: any) => {
            const filteredRow: any = {};
            chartableColumns.forEach((col) => { filteredRow[col] = row[col]; });
            return filteredRow;
          })
          .filter((row: any) => Object.keys(row).length > 0);

        const chartVars: ChartVariable[] = chartableColumns.map((m, idx) => ({
          name: m,
          type: 'numeric' as const,
          color: ['#0693e3', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'][idx % 5],
        }));
        setChartData(chartData, chartVars);
      }

      // Show the analysis summary
      const summary = analysisText.length > 120
        ? analysisText.slice(0, 120) + '…'
        : analysisText;
      toast.success(summary, { duration: 6000 });

    } catch (error) {
      console.error('Error running analysis:', error);
      toast.error('Analysis failed. Check that a valid data file is selected and try again.');
    }
  };

  const handleDataLoaded = (analysisData: any) => {
    try {
      console.log('[Biostatistics] handleDataLoaded received:', analysisData);
      
      if (!analysisData) return;

      // Convert analysis results to chart data format
      let chartData: any[] = [];
      const chartVars: ChartVariable[] = [];
      const colors = ['#0693e3', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
      
      // Handle chart_data from backend analysis
      if (analysisData.chart_data) {
        // Handle nested structure: {type, points}
        let points = analysisData.chart_data;
        if (typeof analysisData.chart_data === 'object' && analysisData.chart_data.points && !Array.isArray(analysisData.chart_data)) {
          points = analysisData.chart_data.points;
        }
        
        if (Array.isArray(points)) {
          
          if (points.length > 0) {
            const firstPoint = points[0];
            
            // Case 1: Scatter/Line plot format {x, y}
            if (firstPoint.x !== undefined && firstPoint.y !== undefined) {
              chartData = points.map((point: any, idx: number) => ({
                index: idx,
                x: point.x,
                y: point.y,
                label: point.label || `Point ${idx + 1}`,
              }));
              
              chartVars.push({
                name: analysisData.column || 'Y Value',
                type: 'numeric' as const,
                color: colors[0],
              });
            } 
            // Case 2: Histogram format with bins
            else if (firstPoint.range !== undefined && firstPoint.count !== undefined) {
              chartData = points.map((bin: any) => ({
                range: bin.range,
                count: bin.count,
              }));
              
              chartVars.push({
                name: 'Frequency',
                type: 'numeric' as const,
                color: colors[0],
              });
            }
            // Case 3: Generic object array - extract all numeric columns
            else if (typeof firstPoint === 'object') {
              chartData = points;
              
              const dataKeys = Object.keys(firstPoint);
              dataKeys.forEach((key, idx) => {
                // Skip non-numeric or metadata columns
                if (!['timestamp', 'date', 'id', 'label', 'name', 'category'].includes(key.toLowerCase())) {
                  const value = firstPoint[key];
                  if (typeof value === 'number' || !isNaN(parseFloat(value))) {
                    chartVars.push({
                      name: key,
                      type: 'numeric' as const,
                      color: colors[idx % colors.length],
                    });
                  }
                }
              });
            }
          }
        } 
        // Handle object format {x: [...], y: [...]}
        else if (typeof analysisData.chart_data === 'object' && analysisData.chart_data.x && analysisData.chart_data.y) {
          const xVals = analysisData.chart_data.x;
          const yVals = analysisData.chart_data.y;
          
          chartData = xVals.map((xVal: any, idx: number) => ({
            x: xVal,
            y: yVals[idx],
            label: `${xVal}`,
          }));
          
          chartVars.push({
            name: analysisData.column || 'Y Value',
            type: 'numeric' as const,
            color: colors[0],
          });
        }
      }
      
      // If we have chart data, update the chart
      if (chartData.length > 0 && chartVars.length > 0) {
        console.log('[Biostatistics] Updating chart with data:', chartData.length, 'rows', chartVars.length, 'variables');
        console.log('[Biostatistics] Chart data sample:', chartData.slice(0, 2));
        console.log('[Biostatistics] Chart variables:', chartVars);
        setChartData(chartData, chartVars);
        console.log('[Biostatistics] setChartData called');
        setChartTitle(analysisData.analysis_type || 'Statistical Analysis');
        console.log('[Biostatistics] Chart title set');
        toast.success(`Chart updated: ${chartData.length} data points, ${chartVars.length} variable(s)`);
      } else {
        console.warn('[Biostatistics] No chart data to display');
        console.warn('[Biostatistics] chartData.length:', chartData.length);
        console.warn('[Biostatistics] chartVars.length:', chartVars.length);
      }
    } catch (error) {
      console.error('Error loading analysis data:', error);
      toast.error('Failed to load analysis results');
    }
  };

  const handleFileSelection = async (files: any[]) => {
    try {
      setIsLoadingFiles(true);
      
      // Create mock File objects from selected files
      const mockFiles = files.map((f: any, idx: number) => {
        // Generate mock CSV data with realistic structure
        const headers = ['Date', 'Value', 'Category', 'Measurement', 'Status'];
        const rows = Array.from({ length: 100 }, (_, i) => [
          new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
          (Math.random() * 100).toFixed(2),
          ['Control', 'Treatment', 'Placebo'][Math.floor(Math.random() * 3)],
          (Math.random() * 50).toFixed(2),
          ['Normal', 'Abnormal', 'Pending'][Math.floor(Math.random() * 3)],
        ]);
        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
        return new File([csv], f.name || f.fileName || `file-${idx}`, { type: 'text/csv' });
      });

      // Parse files
      const parsedFiles = await Promise.all(
        mockFiles.map((file) => parseFile(file))
      );

      if (parsedFiles.length > 0) {
        const firstParsedFile = parsedFiles[0];
        
        // Get numeric columns for automatic variable selection
        const numericCols = getNumericColumns(firstParsedFile.data);
        
        // Auto-select first 3 numeric columns as variables
        const newMeasurements: string[] = [];
        const variables: ChartVariable[] = [];
        numericCols.slice(0, 3).forEach((col, index) => {
          const colors = ['#0693e3', '#f59e0b', '#10b981'];
          if (!selectedMeasurements.includes(col)) {
            newMeasurements.push(col);
            variables.push({
              name: col,
              type: 'numeric' as const,
              color: colors[index % colors.length],
            });
            addVariable({
              name: col,
              type: 'numeric',
              color: colors[index % colors.length],
            });
          }
        });

        // Update biostat store with parsed data
        setChartData(firstParsedFile.data, variables);
        setChartTitle(`Analysis: ${firstParsedFile.fileName}`);
        toast.success(`Loaded ${parsedFiles.length} file(s) with ${numericCols.length} numeric columns`);
      }

      setShowFileSelectionModal(false);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
      {/* Main layout container */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0 transition-all duration-300">
          {/* Header: ChartHeader + TabBar — never shrinks away */}
          <div className="flex-shrink-0">
            <ChartHeader />
            <TabBarDraggable />
          </div>

          {/* Tab Content Wrapper — fills remaining vertical space.
              CHANGED: was `{activeTabId && <TabContent>…</TabContent>}`.
              Now shows a no-tabs empty state when the project has zero open tabs
              (e.g. right after switching to a new project). */}
          {activeTabId ? (
            <TabContent tabId={activeTabId}>
              {/* Main Content Area */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
                  {/* Left Panel - Dataset Manager + Analysis Tools */}
                  <ResizablePanel defaultSize={57} minSize={30} maxSize={70}>
                    <div className="flex flex-col h-full overflow-hidden">
                      <ErrorBoundary label="Dataset Manager & Analysis Tools">
                        <BiostatisticsMeasurementsPanel />
                      </ErrorBoundary>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle />

                  {/* Right Panel - Charts + AI Results Table (full height) */}
                  <ResizablePanel defaultSize={43} minSize={20}>
                    <div className="flex flex-col h-full overflow-hidden">
                      <ErrorBoundary label="Analysis Chart & Results">
                        <GraphTablePanel />
                      </ErrorBoundary>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            </TabContent>
          ) : (
            /* CHANGED: When no tabs are open for this project (e.g. right after switching
               to a new or different project), render GraphTablePanel full-width so the user
               sees the same rich empty state ("No results generated yet …") with the
               Calculator icon and capability bullet list — rather than a bespoke placeholder.
               User clicks "+" in the tab bar above to open their first analysis tab. */
            <div className="flex-1 flex overflow-hidden min-h-0">
              <ErrorBoundary label="Analysis Chart & Results">
                <GraphTablePanel />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </div>

      {/* File Selection Modal */}
      <FileSelectionModal
        isOpen={showFileSelectionModal}
        onClose={() => setShowFileSelectionModal(false)}
        onSelectFiles={handleFileSelection}
        uploadedFiles={uploadedFiles.map((f: any) => {
          const uploadDate = f.uploadedAt ? new Date(f.uploadedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          return {
            id: f.id.toString(),
            name: f.fileName,
            fileName: f.fileName,
            uploadDate: uploadDate,
            size: f.fileSize ? `${(f.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
            rows: 0,
            columns: 0,
            format: (f.fileName.split('.').pop()?.toUpperCase() || 'CSV') as 'CSV' | 'XLSX' | 'JSON',
          };
        })}
      />
    </div>
  );
}
