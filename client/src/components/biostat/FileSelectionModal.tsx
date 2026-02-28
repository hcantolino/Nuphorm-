import { useState } from "react";
import { X, Check, FileText, Download, Trash2 } from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  fileName: string;
  uploadDate: string;
  size: string;
  rows: number;
  columns: number;
  format: "CSV" | "XLSX" | "JSON";
  description?: string;
}

interface FileSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFiles: (files: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
}

export default function FileSelectionModal({
  isOpen,
  onClose,
  onSelectFiles,
  uploadedFiles,
}: FileSelectionModalProps) {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFiles = uploadedFiles.filter(
    (file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleFile = (fileId: string) => {
    const newSelected = new Set(selectedFileIds);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFileIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFileIds.size === filteredFiles.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const handleConfirm = () => {
    const selectedFiles = uploadedFiles.filter((f) =>
      selectedFileIds.has(f.id)
    );
    onSelectFiles(selectedFiles);
    setSelectedFileIds(new Set());
    setSearchTerm("");
    onClose();
  };

  const getFormatColor = (format: string) => {
    switch (format) {
      case "CSV":
        return "bg-blue-100 text-blue-800";
      case "XLSX":
        return "bg-green-100 text-green-800";
      case "JSON":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Select Data Files</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* File List */}
        <div className="flex-1 overflow-auto">
          {filteredFiles.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">
                {searchTerm ? "No files match your search" : "No uploaded files found"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedFileIds.has(file.id)}
                    onChange={() => handleToggleFile(file.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">
                        {file.name}
                      </h3>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${getFormatColor(
                          file.format
                        )}`}
                      >
                        {file.format}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate mb-2">
                      {file.fileName}
                    </p>
                    {file.description && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-1">
                        {file.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>{file.rows.toLocaleString()} rows</span>
                      <span>{file.columns} columns</span>
                      <span>{file.size}</span>
                      <span>{file.uploadDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={
                selectedFileIds.size > 0 &&
                selectedFileIds.size === filteredFiles.length
              }
              onChange={handleSelectAll}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {selectedFileIds.size > 0
                ? `${selectedFileIds.size} file${selectedFileIds.size !== 1 ? "s" : ""} selected`
                : "Select all"}
            </span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedFileIds.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Add {selectedFileIds.size > 0 ? `(${selectedFileIds.size})` : "Files"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
