import { FileText, FileSpreadsheet, FileUp, X, Plus } from 'lucide-react';
import { useState } from 'react';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

// Static catalogue matching the available files in the sidebar
const AVAILABLE_FILES = [
  { name: 'Clinical_Trial_Data.csv', size: 2.4 * 1024 * 1024, type: 'CSV' },
  { name: 'Statistical_Analysis.xlsx', size: 1.8 * 1024 * 1024, type: 'XLSX' },
  { name: 'Patient_Demographics.pdf', size: 3.2 * 1024 * 1024, type: 'PDF' },
  { name: 'Lab_Results.xlsx', size: 956 * 1024, type: 'XLSX' },
  { name: 'Safety_Report.docx', size: 1.1 * 1024 * 1024, type: 'DOCX' },
  { name: 'Protocol_Amendment.pdf', size: 2.7 * 1024 * 1024, type: 'PDF' },
];

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function FileIcon({ type }: { type: string }) {
  if (type === 'CSV' || type === 'XLSX')
    return <FileSpreadsheet className="w-4 h-4 text-green-500 flex-shrink-0" />;
  return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
}

export default function ReferencesPanel() {
  const activeProject = useRegulatoryStore((state) => state.getActiveProject());
  const attachFile = useRegulatoryStore((state) => state.attachFile);
  const detachFile = useRegulatoryStore((state) => state.detachFile);
  const [showFileSelector, setShowFileSelector] = useState(false);

  if (!activeProject) return null;

  const handleDetach = (fileName: string) => {
    detachFile(activeProject.id, fileName);
  };

  const count = activeProject.attachedFiles.length;

  return (
    <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">References</h2>

            {/* Clickable count → Popover with file detail list */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline focus:outline-none mt-1 text-left"
                >
                  {count} document{count !== 1 ? 's' : ''} attached
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-96 p-4 space-y-3" align="start" sideOffset={8}>
                {/* Popover header */}
                <div className="border-b border-gray-200 pb-2">
                  <h4 className="font-semibold text-gray-900">Attached References</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {count} document{count !== 1 ? 's' : ''} used in this regulatory document
                  </p>
                </div>

                {/* File list inside popover */}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {count > 0 ? (
                    activeProject.attachedFiles.map((fileName) => {
                      const file = AVAILABLE_FILES.find((f) => f.name === fileName);
                      return (
                        <div
                          key={fileName}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileIcon type={file?.type ?? 'PDF'} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                              <p className="text-xs text-gray-500">
                                {file?.type ?? 'FILE'} · {file ? formatFileSize(file.size) : 'Unknown'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => handleDetach(fileName)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">No documents attached yet</p>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-1 text-xs text-gray-400 text-center border-t border-gray-100">
                  Click <strong>+ Add</strong> in the panel to attach more files
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <button
            onClick={() => setShowFileSelector(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Body — compact summary only; detail is in the popover */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {count > 0 ? (
          <>
            <FileUp className="w-10 h-10 text-blue-200 mb-3" />
            <p className="text-sm text-gray-500">
              <button
                type="button"
                onClick={() => {/* popover is triggered from header */}}
                className="text-blue-600 hover:underline font-medium"
              >
                {count} source{count !== 1 ? 's' : ''} attached
              </button>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Click the count above to view or manage sources
            </p>
          </>
        ) : (
          <>
            <FileUp className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No sources attached yet</p>
            <p className="text-xs text-gray-300 mt-1">
              Use <strong>+ Add</strong> to attach reference documents
            </p>
          </>
        )}
      </div>

      {/* File Selector Modal */}
      {showFileSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add Documents</h3>
              <button
                onClick={() => setShowFileSelector(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {AVAILABLE_FILES.map((file) => (
                <label
                  key={file.name}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-200 hover:border-blue-300 transition-colors"
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
                  <FileIcon type={file.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{file.type} · {formatFileSize(file.size)}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <button
                onClick={() => setShowFileSelector(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
