import { useState } from 'react';
import { ChevronDown, ChevronUp, Folder } from 'lucide-react';

interface SaveTechnicalFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderName: string, fileName: string) => void;
  documentContent: string;
}

// Sample folders from Saved Technical Files
const SAMPLE_FOLDERS = [
  {
    name: 'Clinical Trial Data',
    description: 'Clinical trial datasets and analysis files',
    files: ['Patient_Demographics.pdf', 'Lab_Results.xlsx', 'Safety_Report.docx'],
  },
  {
    name: 'Regulatory Submissions',
    description: 'Previous regulatory submissions and documents',
    files: ['IND_2023.pdf', 'BLA_Amendment.docx'],
  },
  {
    name: 'Statistical Analysis',
    description: 'Statistical analysis reports and datasets',
    files: ['Statistical_Analysis.xlsx', 'Protocol_Amendment.pdf'],
  },
  {
    name: 'Protocol Documents',
    description: 'Study protocols and amendments',
    files: ['Protocol_v1.pdf', 'Protocol_Amendment_v2.pdf'],
  },
];

export default function SaveTechnicalFileDialog({
  isOpen,
  onClose,
  onSave,
  documentContent,
}: SaveTechnicalFileDialogProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);

  const handleSave = () => {
    if (!selectedFolder || !fileName.trim()) {
      alert('Please select a folder and enter a file name');
      return;
    }
    onSave(selectedFolder, fileName);
    setFileName('');
    setSelectedFolder(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Save Technical File</h2>
            <p className="text-sm text-gray-600 mt-1">Choose a folder from Saved Data Files to save your document</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Name Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">File Name</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g., IND_Application_v2.md"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">File will be saved as Markdown format</p>
          </div>

          {/* Folders List */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Select Folder</label>
            <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
              {SAMPLE_FOLDERS.map((folder) => (
                <div key={folder.name} className="border border-gray-200 rounded-lg bg-white">
                  {/* Folder Header */}
                  <button
                    onClick={() => {
                      setSelectedFolder(folder.name);
                      setExpandedFolder(expandedFolder === folder.name ? null : folder.name);
                    }}
                    className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                      selectedFolder === folder.name ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">{folder.name}</p>
                        <p className="text-xs text-gray-500">{folder.description}</p>
                      </div>
                    </div>
                    {expandedFolder === folder.name ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {/* Files List */}
                  {expandedFolder === folder.name && (
                    <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-1">
                      {folder.files.map((file) => (
                        <div key={file} className="text-xs text-gray-600 pl-8 py-1">
                          📄 {file}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* File Preview */}
          {selectedFolder && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900">
                ✓ File will be saved to: <span className="font-semibold">{selectedFolder}</span>
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Document size: {documentContent.length} characters
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedFolder || !fileName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Technical File
          </button>
        </div>
      </div>
    </div>
  );
}
