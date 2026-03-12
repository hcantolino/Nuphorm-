import React, { useState, useEffect } from 'react';
import { X, FileText, Check } from 'lucide-react';

export interface DataFile {
  id: string;
  name: string;
  fileName: string;
  size: string;
  type: 'CSV' | 'XLSX' | 'JSON';
  uploadedDate: string;
  description?: string;
  rows?: number;
  columns?: number;
}

interface DataFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFiles: string[];
  onSelect: (fileIds: string[]) => void;
}

// Sample datasets from Data Uploaded page
const AVAILABLE_DATASETS: DataFile[] = [
  {
    id: '1',
    name: 'Clinical Trial Phase 2',
    fileName: 'trial_phase2_data.csv',
    uploadedDate: '2026-01-28',
    size: '2.4 MB',
    type: 'CSV',
    description: 'Patient demographics and lab results from Phase 2 trial',
    rows: 1250,
    columns: 24,
  },
  {
    id: '2',
    name: 'Patient Safety Database',
    fileName: 'safety_data_2025.xlsx',
    uploadedDate: '2026-01-27',
    size: '5.8 MB',
    type: 'XLSX',
    description: 'Adverse events and safety monitoring data',
    rows: 3450,
    columns: 18,
  },
  {
    id: '3',
    name: 'Biomarker Analysis',
    fileName: 'biomarkers_q4_2025.csv',
    uploadedDate: '2026-01-25',
    size: '1.2 MB',
    type: 'CSV',
    description: 'Serum biomarker measurements and correlations',
    rows: 890,
    columns: 15,
  },
  {
    id: '4',
    name: 'Efficacy Outcomes',
    fileName: 'efficacy_outcomes.xlsx',
    uploadedDate: '2026-01-20',
    size: '3.1 MB',
    type: 'XLSX',
    description: 'Primary and secondary efficacy endpoints',
    rows: 2100,
    columns: 22,
  },
  {
    id: '5',
    name: 'Pharmacokinetics Study',
    fileName: 'pk_study_data.csv',
    uploadedDate: '2026-01-15',
    size: '1.9 MB',
    type: 'CSV',
    description: 'PK parameters and concentration-time data',
    rows: 450,
    columns: 12,
  },
];

export default function DataFilesModal({
  isOpen,
  onClose,
  selectedFiles,
  onSelect,
}: DataFilesModalProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedFiles);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLocalSelected(selectedFiles);
  }, [selectedFiles]);

  const handleToggleFile = (fileId: string) => {
    setLocalSelected((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleConfirm = () => {
    onSelect(localSelected);
    onClose();
  };

  const filteredFiles = AVAILABLE_DATASETS.filter(
    (file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Select Data Files</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 pt-4">
          <input
            type="text"
            placeholder="Search datasets by name or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => handleToggleFile(file.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  localSelected.includes(file.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        file.type === 'CSV' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {file.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{file.fileName}</p>
                    {file.description && (
                      <p className="text-xs text-gray-500 mt-1">{file.description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>{file.size}</span>
                      {file.rows && <span>{file.rows.toLocaleString()} rows</span>}
                      {file.columns && <span>{file.columns} columns</span>}
                      <span>Uploaded: {file.uploadedDate}</span>
                    </div>
                  </div>
                  {localSelected.includes(file.id) && (
                    <div className="flex-shrink-0 p-1 bg-blue-500 rounded-full">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-32 text-center">
              <p className="text-sm text-gray-500">
                {AVAILABLE_DATASETS.length === 0 ? 'No data files available' : 'No files match your search'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium text-sm"
          >
            Add Selected Files ({localSelected.length})
          </button>
        </div>
      </div>
    </div>
  );
}
