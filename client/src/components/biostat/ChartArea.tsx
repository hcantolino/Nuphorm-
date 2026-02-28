
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChevronUp, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBiostatStore } from '@/stores/biostatStore';
import { useChartStore } from '@/stores/chartStore';
import DataFilesModal, { DataFile } from './DataFilesModal';

import GlobalSettingsModal from './GlobalSettingsModal';
import ExportModal, { ExportFormat } from './ExportModal';
import { ReportPreview } from './ReportPreview';
import { exportChart } from '@/services/chartExportService';
import { useBiostatisticsStore } from '@/stores/biostatisticsStore';
import { trpc } from '@/lib/trpc';
import { useTabStore } from '@/stores/tabStore';
import PremiumPaywallPanel from '@/components/PremiumPaywallPanel';
import { useTrialGuard } from '@/hooks/useTrialGuard';
import { generateSimpleReport, getAIInterpretation } from '@/services/simpleReportGenerator';
import { generateReportPreview, ReportData } from '@/services/reportGenerationService';
import { addChartToStorage, addProjectToStorage, getProjectFromStorage } from '@/services/filePersistence';
import { transformData, getDateRange, getValueRange, getCategories } from '@/services/dataTransformationService';
import type { SavedChart, ChartSet } from '@/services/biostatFileManager';
import { TableDataDisplay } from './TableDataDisplay';
import { UnifiedChartToolbar } from './UnifiedChartToolbar';
import { useChartSettings } from '@/stores/chartSettingsStore';

export default function ChartArea() {
  const {
    data,
    chartType,
    setChartType,
    selectedVariables,
    yAxisStartAtZero,
    setYAxisStartAtZero,
    chartTitle,
    setChartTitle,
    gridVisible,
    setGridVisible,
    lineColor,
    setLineColor,
    barColor,
    setBarColor,
    gridColor,
    setGridColor,
    chartBackground,
    setChartBackground,
    axisTextColor,
    setAxisTextColor,
    legendPosition,
    showGlobalSettings,
    toggleGlobalSettings,
    loadGlobalSettings,
  } = useBiostatStore();
  const { chartConfig, tableData } = useChartStore();
  const { activeProjectId } = useBiostatisticsStore();
  const chartSettings = useChartSettings();

  const [showDataTable, setShowDataTable] = useState(true);
  const [yAxisUnit, setYAxisUnit] = useState('');
  const [xAxisLabel, setXAxisLabel] = useState('');
  const [yAxisLabel, setYAxisLabel] = useState('');
  const [selectedDataFiles, setSelectedDataFiles] = useState<string[]>([]);
  const [showDataFilesModal, setShowDataFilesModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [dataDateRange, setDataDateRange] = useState<{ min: string; max: string } | null>(null);
  const [dataValueRange, setDataValueRange] = useState<{ min: number; max: number } | null>(null);
  const [filteredData, setFilteredData] = useState<any[]>(data as any[]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [isGeneratingReportPreview, setIsGeneratingReportPreview] = useState(false);
  const { canGenerate, subscription } = useTrialGuard();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState('');

  // Apply data transformations when data changes
  useEffect(() => {
    const numericColumns = selectedVariables.map((v) => v.name);
    const transformed = transformData(data as any[], {}, numericColumns);
    setFilteredData(transformed);
    
    // Update data statistics
    const categories = getCategories(data as any[]);
    setAvailableCategories(categories);
    
    const dateRange = getDateRange(data as any[]);
    setDataDateRange(dateRange);
    
    const valueRange = getValueRange(data as any[], numericColumns);
    setDataValueRange(valueRange);
  }, [data, selectedVariables]);

  const handleAddDataFiles = (fileIds: string[]) => {
    setSelectedDataFiles(fileIds);
  };

  const handleRemoveDataFile = (fileId: string) => {
    setSelectedDataFiles((prev: string[]) => prev.filter((id: string) => id !== fileId));
  };

  const handleSaveAsFile = async () => {
    // Check if user can save (not on trial or hasn't used trial yet)
    if (!canGenerate()) {
      setPaywallMessage('Save your biostatistics analysis to access this feature');
      setShowPaywall(true);
      return;
    }

    if (!activeProjectId) {
      alert('Please select or create a project first.');
      return;
    }

    if (selectedVariables.length === 0) {
      alert('Please select at least one measurement before saving.');
      return;
    }

    setIsSavingFile(true);
    try {
      const projects = useBiostatisticsStore.getState().projects;
      const activeProject = projects.find((p) => p.id === activeProjectId);
      
      if (!activeProject) {
        alert('Project not found.');
        return;
      }

      const projectFolder = getProjectFromStorage(activeProjectId) || {
        projectId: activeProjectId,
        projectName: activeProject.name,
        createdAt: new Date().toISOString(),
        chartSets: [],
      };

      const chartSetId = `chartset-${Date.now()}`;
      const chartSetName = `Chart Set - ${new Date().toLocaleDateString()}`;
      
      const chartSet: ChartSet = {
        id: chartSetId,
        name: chartSetName,
        charts: [],
        createdAt: new Date().toISOString(),
      };

      const savedChart: SavedChart = {
        id: `chart-${Date.now()}`,
        projectId: activeProjectId,
        projectName: activeProject.name,
        chartSetId: chartSetId,
        chartSetName: chartSetName,
        chartTitle: chartTitle,
        chartType: 'line',
        data: data,
        selectedVariables: selectedVariables,
        dataFiles: activeProject.uploadedDataName ? [activeProject.uploadedDataName] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      chartSet.charts.push(savedChart);
      projectFolder.chartSets.push(chartSet);

      addProjectToStorage(projectFolder);
      addChartToStorage(savedChart);
      alert('Chart saved successfully!');
    } catch (error) {
      console.error('Failed to save chart:', error);
      alert('Failed to save chart. Please try again.');
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReportPreview(true);
    try {
      const measurementNames = selectedVariables.map((v) => v.name);
      const statistics: Record<string, number> = {};

      selectedVariables.forEach((variable) => {
        const values = (filteredData as any[]).map((row: any) => parseFloat(row[variable.name])).filter((v: number) => !isNaN(v));
        if (values.length > 0) {
          const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
          const variance = values.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / values.length;
          const stdDev = Math.sqrt(variance);
          statistics[`${variable.name}_mean`] = mean;
          statistics[`${variable.name}_stdDev`] = stdDev;
          statistics[`${variable.name}_min`] = Math.min(...values);
          statistics[`${variable.name}_max`] = Math.max(...values);
        }
      });

      const aiInterpretation = getAIInterpretation(measurementNames, statistics);
      const chartElement = document.querySelector('[data-chart-container]') as HTMLElement | undefined;

      const report = await generateReportPreview({
        id: `report-${Date.now()}`,
        title: chartTitle || `Analysis Report - ${new Date().toLocaleDateString()}`,
        measurements: measurementNames,
        dataFiles: selectedDataFiles,
        data: filteredData as any[],
        variables: selectedVariables,
        statistics,
        chartElement,
        aiInterpretation,
        generatedAt: new Date(),
        colorSettings: {
          lineColor,
          barColor,
          gridColor,
          backgroundColor: chartBackground,
          axisTextColor,
        },
      });

      setCurrentReport(report);
      setShowReportPreview(true);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingReportPreview(false);
    }
  };

  const handleGlobalSettingsSave = (settings: any) => {
    loadGlobalSettings();
  };

  const saveReportMutation = trpc.technical.saveReport.useMutation();

  const handleSaveReport = async (report: ReportData) => {
    // Check if user can save reports (not on trial or hasn't used trial yet)
    if (!canGenerate()) {
      setPaywallMessage('Save technical files to access this feature');
      setShowPaywall(true);
      return;
    }

    try {
      await saveReportMutation.mutateAsync({
        title: report.title,
        content: JSON.stringify(report),
        chartImage: report.chartImage,
        dataFiles: report.dataFiles,
        measurements: report.measurements,
        generatedAt: report.generatedAt.toISOString(),
      });
      alert('Report saved successfully to Technical Files!');
    } catch (error) {
      console.error('Failed to save report:', error);
      throw error;
    }
  };

  const handleExport = async (format: ExportFormat) => {
    // Check if user can export (not on trial or hasn't used trial yet)
    if (!canGenerate()) {
      setPaywallMessage('Export charts to access this feature');
      setShowPaywall(true);
      return;
    }

    setIsExporting(true);
    try {
      const chartElement = document.querySelector('[data-chart-container]') as HTMLElement | null;
      const filename = chartTitle || `chart-${new Date().toISOString().split('T')[0]}`;

      await exportChart({
        filename,
        format,
        chartElement: chartElement || undefined,
        data: filteredData,
        columns: selectedVariables.map((v) => v.name),
        colorScheme: {
          lineColor,
          barColor,
          gridColor,
          chartBackground,
          axisTextColor,
        },
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Check if we have chart data from the store (from AI analysis)
  const hasStoreChartData = chartConfig || tableData;
  const hasLocalData = data.length > 0 && selectedVariables.length > 0;

  if (!hasLocalData && !hasStoreChartData) {
    return (
      <div className="flex-1 bg-white overflow-y-auto flex flex-col">
        <GlobalSettingsModal
          isOpen={showGlobalSettings}
          onClose={toggleGlobalSettings}
          onSave={handleGlobalSettingsSave}
        />
      </div>
    );
  }

  // Render chart based on type or from store
  const renderChart = (): React.ReactElement => {
    // If we have chart config from store (AI analysis), use that
    if (chartConfig) {
      const commonProps = {
        data: chartConfig.data.datasets?.[0]?.data?.map((val: any, idx: number) => ({
          index: idx,
          value: val,
          label: chartConfig.data.labels?.[idx] || `Point ${idx + 1}`,
        })) || [],
        margin: { top: 5, right: 30, left: 0, bottom: 5 },
      };

      // Use chart type from settings store if available, otherwise from config
      const activeChartType = chartSettings.chartType || chartConfig.type;
      const showGridLines = chartSettings.showGrid;
      const yAxisZero = chartSettings.yZero;
      const colors = chartSettings.customColors || {};

      switch (activeChartType) {
        case 'line':
          return (
            <LineChart {...commonProps} style={{ backgroundColor: colors.background || chartBackground }}>
              {showGridLines && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid || gridColor} />}
              <XAxis dataKey="label" stroke={axisTextColor} />
              <YAxis stroke={axisTextColor} domain={yAxisZero ? [0, 'auto'] : ['dataMin', 'dataMax']} />
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
              {chartConfig.data.datasets.map((dataset: any, idx: number) => (
                <Line key={dataset.label} type="monotone" dataKey="value" stroke={dataset.borderColor || colors.primary || lineColor || '#0693e3'} name={dataset.label} />
              ))}
            </LineChart>
          );
        case 'bar':
          return (
            <BarChart {...commonProps} style={{ backgroundColor: colors.background || chartBackground }}>
              {showGridLines && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid || gridColor} />}
              <XAxis dataKey="label" stroke={axisTextColor} />
              <YAxis stroke={axisTextColor} domain={yAxisZero ? [0, 'auto'] : ['dataMin', 'dataMax']} />
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
              {chartConfig.data.datasets.map((dataset: any, idx: number) => (
                <Bar key={dataset.label} dataKey="value" fill={dataset.backgroundColor || colors.primary || barColor || '#0693e3'} name={dataset.label} />
              ))}
            </BarChart>
          );
        case 'area':
          return (
            <AreaChart {...commonProps} style={{ backgroundColor: colors.background || chartBackground }}>
              {showGridLines && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid || gridColor} />}
              <XAxis dataKey="label" stroke={axisTextColor} />
              <YAxis stroke={axisTextColor} domain={yAxisZero ? [0, 'auto'] : ['dataMin', 'dataMax']} />
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
              {chartConfig.data.datasets.map((dataset: any, idx: number) => (
                <Area key={dataset.label} type="monotone" dataKey="value" fill={dataset.backgroundColor || colors.secondary || barColor || '#10b981'} stroke={dataset.borderColor || colors.primary || lineColor || '#0693e3'} name={dataset.label} />
              ))}
            </AreaChart>
          );
        case 'scatter':
          return (
            <ScatterChart {...commonProps} style={{ backgroundColor: colors.background || chartBackground }}>
              {showGridLines && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid || gridColor} />}
              <XAxis dataKey="label" stroke={axisTextColor} />
              <YAxis stroke={axisTextColor} domain={yAxisZero ? [0, 'auto'] : ['dataMin', 'dataMax']} />
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
              {chartConfig.data.datasets.map((dataset: any, idx: number) => (
                <Scatter key={dataset.label} name={dataset.label} dataKey="value" fill={dataset.backgroundColor || colors.primary || barColor || '#0693e3'} />
              ))}
            </ScatterChart>
          );
        default:
          return <div className="text-gray-500">Unsupported chart type</div>;
      }
    }

    // Otherwise use local data
    const commonProps = {
      data: filteredData,
      margin: { top: 5, right: 30, left: 0, bottom: 5 },
    };

    const colors = selectedVariables.map((v) => v.color);

    // Use chart type from settings store if available
    const activeChartType = chartSettings.chartType || chartType;
    const showGridLines = chartSettings.showGrid;
    const yAxisZero = chartSettings.yZero;
    const settingsColors = chartSettings.customColors || {};

    switch (activeChartType) {
      case 'line':
        return (
          <LineChart {...commonProps} style={{ backgroundColor: settingsColors.background || chartBackground }}>
            {showGridLines && <CartesianGrid strokeDasharray="3 3" stroke={settingsColors.grid || gridColor} />}
            <XAxis dataKey={selectedVariables[0]?.name as string} stroke={axisTextColor} label={{ value: xAxisLabel, position: 'insideBottomRight', offset: -5 }} />
            <YAxis stroke={axisTextColor} label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} domain={yAxisZero ? [0, 'auto'] : ['dataMin', 'dataMax']} />
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
            {selectedVariables.map((variable, idx) => (
              <Line key={variable.name} type="monotone" dataKey={variable.name} stroke={lineColor || colors[idx]} />
            ))}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart {...commonProps} style={{ backgroundColor: settingsColors.background || chartBackground }}>
            {showGridLines && <CartesianGrid strokeDasharray="3 3" stroke={settingsColors.grid || gridColor} />}
            <XAxis dataKey={selectedVariables[0]?.name as string} stroke={axisTextColor} label={{ value: xAxisLabel, position: 'insideBottomRight', offset: -5 }} />
            <YAxis stroke={axisTextColor} label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} domain={yAxisZero ? [0, 'auto'] : ['dataMin', 'dataMax']} />
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
            {selectedVariables.map((variable, idx) => (
              <Area key={variable.name} type="monotone" dataKey={variable.name} fill={settingsColors.secondary || colors[idx]} stroke={lineColor || colors[idx]} />
            ))}
          </AreaChart>
        );
      case 'scatter':
        return (
          <ScatterChart {...commonProps} style={{ backgroundColor: settingsColors.background || chartBackground }}>
            {showGridLines && <CartesianGrid strokeDasharray="3 3" stroke={settingsColors.grid || gridColor} />}
            <XAxis dataKey={selectedVariables[0]?.name} stroke={axisTextColor} />
            <YAxis stroke={axisTextColor} domain={yAxisZero ? [0, 'auto'] : ['dataMin', 'dataMax']} />
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
            {selectedVariables.map((variable, idx) => (
              <Scatter key={variable.name} name={variable.name} dataKey={variable.name} fill={barColor || colors[idx]} />
            ))}
          </ScatterChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps} style={{ backgroundColor: settingsColors.background || chartBackground }}>
            {showGridLines && <CartesianGrid strokeDasharray="3 3" stroke={settingsColors.grid || gridColor} />}
            <XAxis dataKey={selectedVariables[0]?.name} stroke={axisTextColor} />
            <YAxis stroke={axisTextColor} domain={yAxisZero ? [0, 'auto'] : ['dataMin', 'dataMax']} />
            <Legend verticalAlign="bottom" height={36} />
            {selectedVariables.map((variable, idx) => (
              <Bar key={variable.name} dataKey={variable.name} fill={barColor || colors[idx]} />
            ))}
          </BarChart>
        );
      case 'area':
        return (
          <AreaChart {...commonProps} style={{ backgroundColor: chartBackground }}>
            {gridVisible && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
            <XAxis dataKey={selectedVariables[0]?.name} stroke={axisTextColor} />
            <YAxis stroke={axisTextColor} domain={yAxisStartAtZero ? [0, 'auto'] : ['auto', 'auto']} />
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
            {selectedVariables.map((variable, idx) => (
              <Area key={variable.name} type="monotone" dataKey={variable.name} fill={settingsColors.secondary || colors[idx]} stroke={lineColor || colors[idx]} />
            ))}
          </AreaChart>
        );
      default:
        return <div className="text-gray-500">Unsupported chart type: {activeChartType}</div>;
    }
  };

  return (
    <div className="flex-1 bg-white overflow-y-auto flex flex-col">
      {/* Unified Chart Toolbar - Actions + Editing Controls */}
      <UnifiedChartToolbar
        onNewChart={() => {
          const { addTab } = useTabStore.getState();
          addTab();
        }}
        onSaveFile={handleSaveAsFile}
        onGenerateReport={handleGenerateReport}
        onDownload={() => setShowExportModal(true)}
        isSavingFile={isSavingFile}
        isGeneratingReport={isGeneratingReport}
        isExporting={isExporting}
      />



      {/* Chart Display */}
      <div className="flex-1 p-6 overflow-auto flex flex-col gap-6 min-h-0">
        <div className="bg-white rounded-lg border border-gray-200 p-6 flex-1 flex items-center justify-center min-h-0" data-chart-container>
          <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Data Table - from store or local data */}
        <TableDataDisplay tableData={tableData} selectedVariables={selectedVariables} filteredData={filteredData} />
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        isLoading={isExporting}
      />

      {/* Global Settings Modal */}
      <GlobalSettingsModal
        isOpen={showGlobalSettings}
        onClose={toggleGlobalSettings}
        onSave={handleGlobalSettingsSave}
      />

      {/* Report Preview Modal */}
      {showReportPreview && currentReport && (
        <ReportPreview
          report={currentReport}
          onClose={() => setShowReportPreview(false)}
          onSave={handleSaveReport}
        />
      )}

      {/* Premium Paywall Panel */}
      {showPaywall && (
        <PremiumPaywallPanel
          title="You need a Premium membership"
          message={paywallMessage}
          actionLabel="UNLOCK ACCESS FOR $0"
          onDismiss={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}
