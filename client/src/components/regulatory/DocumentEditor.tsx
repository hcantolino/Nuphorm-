import { FileUp, X, Save } from 'lucide-react';
import { useState, useMemo } from 'react';
import SaveTechnicalFileDialog from './SaveTechnicalFileDialog';
import { useRegulatoryStore } from '@/stores/regulatoryStore';

// Sample files from Saved Technical Files
const AVAILABLE_FILES = [
  { name: 'Clinical_Trial_Data.csv', size: '2.4 MB', type: 'CSV' },
  { name: 'Statistical_Analysis.xlsx', size: '1.8 MB', type: 'XLSX' },
  { name: 'Patient_Demographics.pdf', size: '3.2 MB', type: 'PDF' },
  { name: 'Lab_Results.xlsx', size: '956 KB', type: 'XLSX' },
  { name: 'Safety_Report.docx', size: '1.1 MB', type: 'DOCX' },
  { name: 'Protocol_Amendment.pdf', size: '2.7 MB', type: 'PDF' },
];

export default function DocumentEditor() {
  const projects = useRegulatoryStore((state) => state.projects);
  const activeProjectId = useRegulatoryStore((state) => state.activeProjectId);
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId]
  );
  const updateProjectContent = useRegulatoryStore((state) => state.updateProjectContent);
  const attachFile = useRegulatoryStore((state) => state.attachFile);
  const detachFile = useRegulatoryStore((state) => state.detachFile);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isFilesExpanded, setIsFilesExpanded] = useState(true);

  if (!activeProject) return null;

  return (
    <div className="space-y-0">
      {/* Attached Files Section - Collapsible (Right below regulatory bar) */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <button
          onClick={() => setIsFilesExpanded(!isFilesExpanded)}
          className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Attached Files ({activeProject.attachedFiles.length})</h3>
          </div>
          <span className="text-gray-400">{isFilesExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isFilesExpanded && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
            {/* Attached Files List */}
            {activeProject.attachedFiles.length > 0 ? (
              <div className="space-y-2 mb-6">
                {activeProject.attachedFiles.map((fileName) => {
                  const file = AVAILABLE_FILES.find((f) => f.name === fileName);
                  return (
                    <div
                      key={fileName}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileUp className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">{fileName}</p>
                          <p className="text-xs text-gray-500">{file?.size || 'Unknown'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => detachFile(activeProject.id, fileName)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-6">No files attached yet</p>
            )}

            {/* Add Files Button */}
            <button
              onClick={() => setShowFileSelector(!showFileSelector)}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 font-medium hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              + Add Files from Saved Data Files
            </button>

            {/* File Selector */}
            {showFileSelector && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-900 mb-3">Select files to attach:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {AVAILABLE_FILES.map((file) => (
                    <label
                      key={file.name}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={activeProject.attachedFiles.includes(file.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            attachFile(activeProject.id, file.name);
                          } else {
                            detachFile(activeProject.id, file.name);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{file.type} • {file.size}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => setShowFileSelector(false)}
                  className="w-full mt-3 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Editor */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mt-6">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Document Content</h2>
          <p className="text-sm text-gray-600 mt-1">
            Format: {activeProject.paperLayout === 'eSTAR' ? 'FDA eSTAR' : 'Document'} |
            Standard: {activeProject.regulatoryStandard === 'US' ? 'US FDA' : 'EU EMA'}
          </p>
        </div>

        <textarea
          value={activeProject.content}
          onChange={(e) => updateProjectContent(activeProject.id, e.target.value)}
          placeholder="Enter your regulatory document content here..."
          className="w-full h-96 p-6 font-mono text-sm resize-none focus:outline-none"
        />

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {activeProject.content.length} characters | Last saved: {activeProject.updatedAt.toLocaleString()}
          </p>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Technical File
          </button>
        </div>
      </div>

      {/* Save Technical File Dialog */}
      <SaveTechnicalFileDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={(folderName, fileName) => {
          console.log(`Saving to ${folderName}/${fileName}`);
          setShowSaveDialog(false);
        }}
        documentContent={activeProject.content}
      />
    </div>
  );
}
