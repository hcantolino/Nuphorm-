import { useState } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import { useBiostatStore, ChartPanel } from '@/stores/biostatStore';
import ChartArea from './ChartArea';
import { generateSimpleReport } from '@/services/simpleReportGenerator';

export default function MultiViewPanel() {
  const {
    chartPanels,
    activePanel,
    activeViewType,
    setActivePanel,
    setActiveViewType,
    addChartPanel,
    removeChartPanel,
    chartTitle,
    data,
    selectedVariables,
  } = useBiostatStore();

  const [showNewPanelMenu, setShowNewPanelMenu] = useState(false);

  const handleAddNewChart = () => {
    const newPanel: ChartPanel = {
      id: `chart-${Date.now()}`,
      title: `Chart ${chartPanels.length + 1}`,
      chartType: 'line',
      selectedVariables: [],
      data: [],
      createdAt: new Date(),
    };
    addChartPanel(newPanel);
    setShowNewPanelMenu(false);
  };

  const handleAddReportView = () => {
    generateSimpleReport({
      title: chartTitle,
      measurements: selectedVariables.map((v) => v.name),
      dataFiles: ['Clinical_Trial_Data.csv', 'Statistical_Analysis.xlsx'],
      statistics: {},
      aiInterpretation: 'Report generated from selected measurements and data files.',
    });

    const reportContent = `
      <div class="prose">
        <h2>${chartTitle}</h2>
        <p>Report generated on ${new Date().toLocaleDateString()}</p>
        <p>Measurements: ${selectedVariables.map((v) => v.name).join(', ')}</p>
        <p>Data Files: Clinical_Trial_Data.csv, Statistical_Analysis.xlsx</p>
      </div>
    `;

    const newPanel: ChartPanel = {
      id: `report-${Date.now()}`,
      title: 'Generated Report',
      chartType: 'line',
      selectedVariables: [],
      data: [],
      reportContent: reportContent,
      createdAt: new Date(),
    };
    addChartPanel(newPanel);
    setActivePanel(newPanel.id);
    setActiveViewType('report');
    setShowNewPanelMenu(false);
  };

  const currentPanel = chartPanels.find((p) => p.id === activePanel);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Tab Navigation - Compact and integrated */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        {/* Chart Panels Tabs */}
        {chartPanels.map((panel) => (
          <div
            key={panel.id}
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
              activePanel === panel.id && activeViewType === 'chart'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
            onClick={() => {
              setActivePanel(panel.id);
              setActiveViewType('chart');
            }}
          >
            <span className="truncate max-w-[100px]">{panel.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeChartPanel(panel.id);
              }}
              className="p-0 hover:opacity-70 transition-opacity"
              title="Remove panel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeViewType === 'chart' && !activePanel ? (
          <ChartArea />
        ) : activeViewType === 'report' && currentPanel?.reportContent ? (
          <div className="p-6 overflow-auto flex-1">
            <div
              dangerouslySetInnerHTML={{ __html: currentPanel.reportContent }}
              className="prose max-w-none"
            />
          </div>
        ) : activePanel && activeViewType === 'chart' ? (
          <div className="p-6 text-center text-gray-500 flex-1 flex items-center justify-center">
            <div>
              <p>Chart panel: {currentPanel?.title}</p>
              <p className="text-sm mt-2">Chart generation for this panel coming soon</p>
            </div>
          </div>
        ) : (
          <ChartArea />
        )}
      </div>
    </div>
  );
}
