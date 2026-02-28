import { useState } from 'react';
import { Sparkles, ChevronDown, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import { LoadingProgressBar } from './LoadingProgressBar';

// Regulatory document types that AI can generate
const DOCUMENT_TYPES = [
  { id: 'fda-estar', label: 'FDA eSTAR', description: 'US FDA electronic submission template' },
  { id: 'fda-nda', label: 'FDA NDA', description: 'New Drug Application' },
  { id: 'fda-anda', label: 'FDA ANDA', description: 'Abbreviated New Drug Application' },
  { id: 'eu-ema', label: 'EU EMA', description: 'European Medicines Agency submission' },
  { id: 'clinical-protocol', label: 'Clinical Protocol', description: 'Clinical trial protocol document' },
  { id: 'safety-report', label: 'Safety Report', description: 'Adverse event safety report' },
  { id: 'summary-clin', label: 'Summary of Clinical', description: 'Clinical efficacy and safety summary' },
  { id: 'summary-nonclin', label: 'Summary of Non-Clinical', description: 'Non-clinical study summary' },
];

// Citation/Reference formats
const REFERENCE_FORMATS = [
  { id: 'apa', label: 'APA' },
  { id: 'mla', label: 'MLA' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'harvard', label: 'Harvard' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'ama', label: 'AMA' },
  { id: 'vancouver', label: 'Vancouver' },
];

export default function RegulatoryControlPanel({
  onDataFilesChange,
}: {
  onDataFilesChange?: (files: string[]) => void;
}) {
  const activeProject = useRegulatoryStore((state) => state.getActiveProject());
  const updateReferenceFormat = useRegulatoryStore((state) => state.updateReferenceFormat);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<string>('fda-estar');
  const [selectedRefFormat, setSelectedRefFormat] = useState<string>('apa');
  const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState(false);
  const [isRefFormatDropdownOpen, setIsRefFormatDropdownOpen] = useState(false);
  const [selectedDataFiles, setSelectedDataFiles] = useState<string[]>([]);
  const [aiResponse, setAiResponse] = useState<{ type: 'success' | 'warning' | 'info'; message: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!activeProject) return null;

  const selectedDocTypeLabel = DOCUMENT_TYPES.find((doc) => doc.id === selectedDocType)?.label || 'Select Document Type';
  const selectedRefFormatLabel = REFERENCE_FORMATS.find((fmt) => fmt.id === selectedRefFormat)?.label || 'APA';

  const handleGenerateWithAI = () => {
    if (aiPrompt.trim()) {
      setIsGenerating(true);
      console.log(`Generating ${selectedDocType} with:`);
      console.log(`- Reference Format: ${selectedRefFormat}`);
      console.log(`- Data Files: ${selectedDataFiles.join(', ')}`);
      console.log(`- Prompt: ${aiPrompt}`);
      
      // Progress bar completes in 5.5 seconds, then show response
      setTimeout(() => {
        if (selectedDataFiles.length === 0) {
          setAiResponse({
            type: 'warning',
            message: '⚠️ No data files selected. Please add data files for the AI to reference when generating the document.',
          });
        } else {
          setAiResponse({
            type: 'success',
            message: `✓ Generated ${selectedDocTypeLabel} document in ${selectedRefFormatLabel} format using ${selectedDataFiles.length} data file(s). Document is ready for review and editing.`,
          });
        }
        setIsGenerating(false);
      }, 5500);
    }
  };

  const handleAddDataFile = (fileName: string) => {
    if (!selectedDataFiles.includes(fileName)) {
      const newFiles = [...selectedDataFiles, fileName];
      setSelectedDataFiles(newFiles);
      onDataFilesChange?.(newFiles);
    }
  };

  const handleRemoveDataFile = (fileName: string) => {
    const newFiles = selectedDataFiles.filter((f) => f !== fileName);
    setSelectedDataFiles(newFiles);
    onDataFilesChange?.(newFiles);
  };

  return (
    <>
      <LoadingProgressBar isVisible={isGenerating} />
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      {/* AI Generation Section */}
      <div className="px-4 py-4 border-b border-gray-100">
        {/* Top Row: Document Type, Reference Format, and Generate */}
        <div className="flex items-center gap-3 mb-4">
          {/* Document Type Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDocTypeDropdownOpen(!isDocTypeDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              <span className="text-gray-600">{selectedDocTypeLabel}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDocTypeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Document Type Dropdown Menu */}
            {isDocTypeDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="max-h-96 overflow-y-auto">
                  {DOCUMENT_TYPES.map((docType) => (
                    <button
                      key={docType.id}
                      onClick={() => {
                        setSelectedDocType(docType.id);
                        setIsDocTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors ${
                        selectedDocType === docType.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <p className="font-medium text-gray-900">{docType.label}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{docType.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reference Format Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsRefFormatDropdownOpen(!isRefFormatDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              <span className="text-gray-600">Format: {selectedRefFormatLabel}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isRefFormatDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Reference Format Dropdown Menu */}
            {isRefFormatDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="max-h-96 overflow-y-auto">
                  {REFERENCE_FORMATS.map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => {
                        setSelectedRefFormat(fmt.id);
                        setIsRefFormatDropdownOpen(false);
                        updateReferenceFormat(activeProject.id, fmt.id as any);
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors text-sm ${
                        selectedRefFormat === fmt.id ? 'bg-blue-50 border-l-4 border-l-blue-600 font-medium' : ''
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Text Input */}
          <div className="flex-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleGenerateWithAI();
                }
              }}
              placeholder="Describe what you want the AI to generate..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              onClick={handleGenerateWithAI}
              disabled={!aiPrompt.trim() || isGenerating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm whitespace-nowrap"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Data Files Section */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
            <Upload className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Add Data Uploaded Files:</span>
          </div>
          
          {/* Selected Data Files Display */}
          <div className="flex flex-wrap gap-2">
            {selectedDataFiles.length === 0 ? (
              <span className="text-xs text-gray-500 italic">No files selected</span>
            ) : (
              selectedDataFiles.map((file) => (
                <div
                  key={file}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                >
                  {file}
                  <button
                    onClick={() => handleRemoveDataFile(file)}
                    className="ml-1 hover:text-blue-900 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Quick Add Buttons for Common Files */}
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => handleAddDataFile('Clinical_Trial_Data.csv')}
              disabled={selectedDataFiles.includes('Clinical_Trial_Data.csv')}
              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              + Clinical Data
            </button>
            <button
              onClick={() => handleAddDataFile('Statistical_Analysis.xlsx')}
              disabled={selectedDataFiles.includes('Statistical_Analysis.xlsx')}
              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              + Stats Analysis
            </button>
          </div>
        </div>

        {/* AI Response/Feedback Area */}
        {aiResponse && (
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              aiResponse.type === 'success'
                ? 'bg-green-50 border-green-200'
                : aiResponse.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
            }`}
          >
            {aiResponse.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm ${
                  aiResponse.type === 'success'
                    ? 'text-green-800'
                    : aiResponse.type === 'warning'
                      ? 'text-yellow-800'
                      : 'text-blue-800'
                }`}
              >
                {aiResponse.message}
              </p>
            </div>
            <button
              onClick={() => setAiResponse(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
