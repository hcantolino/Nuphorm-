import { useState } from 'react';
import Papa from 'papaparse';
import { Upload, X, Search } from 'lucide-react';
import { useBiostatStore } from '@/stores/biostatStore';
import { useSampleData } from '@/hooks/useSampleData';

export default function UploadSection() {
  const { datasetName, setData, columns } = useBiostatStore();
  const { loadSampleData } = useSampleData();
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          complete: (results: any) => {
            if (results.data && results.data.length > 0) {
              const cols = Object.keys(results.data[0] as Record<string, any>);
              setData(results.data as any[], cols, file.name);
            }
          },
          error: (error: any) => {
            console.error('CSV parsing error:', error);
          },
        });
      } catch (err) {
        console.error('Error reading file:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Area */}
          <div className="lg:col-span-1">
            <label>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileInput}
                className="hidden"
              />
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  transition-all duration-200
                  ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                  }
                `}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">
                  Upload Dataset
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  CSV or XLSX files
                </p>
              </div>
            </label>
          </div>

          {/* Load Sample Button */}
          <div>
            <button
              onClick={loadSampleData}
              className="w-full px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors text-sm font-medium"
            >
              Load Sample Data
            </button>
          </div>

          {/* Dataset Info */}
          <div className="lg:col-span-1">
            {datasetName ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase mb-1">
                  Loaded Dataset
                </p>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {datasetName}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  {columns.length} variables
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                  No Dataset
                </p>
                <p className="text-sm text-gray-600">
                  Upload a CSV or XLSX file to get started
                </p>
              </div>
            )}
          </div>

          {/* Search Variables */}
          <div className="lg:col-span-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search for a variable..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
