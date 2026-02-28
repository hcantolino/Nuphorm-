import { Plus, Save, Zap, Download } from 'lucide-react';
import { useState } from 'react';

interface CommandBarProps {
  onNewChart?: () => void;
  onSaveFile?: () => void;
  onGenerateReport?: () => void;
  onDownload?: () => void;
  onExamples?: () => void;
}

export default function CommandBar({
  onNewChart,
  onSaveFile,
  onGenerateReport,
  onDownload,
  onExamples,
}: CommandBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleSaveFile = async () => {
    setIsSaving(true);
    try {
      await onSaveFile?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      await onGenerateReport?.();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload?.();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-4">
      {/* Ghost Buttons - Text only, no borders/fills */}
      <button
        onClick={onNewChart}
        className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
        title="Create a new chart"
      >
        <Plus className="w-4 h-4" />
        New Chart
      </button>

      <button
        onClick={handleSaveFile}
        disabled={isSaving}
        className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        title="Save technical file"
      >
        <Save className="w-4 h-4" />
        {isSaving ? 'Saving...' : 'Save Technical File'}
      </button>

      <button
        onClick={handleGenerateReport}
        disabled={isGenerating}
        className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        title="Generate report"
      >
        <Zap className="w-4 h-4" />
        {isGenerating ? 'Generating...' : 'Generate Report'}
      </button>

      {/* Download Button - Ghost style */}
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        title="Download"
      >
        <Download className="w-4 h-4" />
        {isDownloading ? 'Downloading...' : 'Download'}
      </button>
    </div>
  );
}
