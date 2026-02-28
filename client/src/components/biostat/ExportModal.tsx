import { useState } from 'react';
import { X, Download, FileImage, Code, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type ExportFormat = 'png' | 'svg' | 'csv' | 'xlsx';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat) => Promise<void>;
  isLoading?: boolean;
}

export default function ExportModal({ isOpen, onClose, onExport, isLoading = false }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [isExporting, setIsExporting] = useState(false);

  const exportOptions = [
    {
      id: 'png',
      label: 'PNG Image',
      description: 'High-quality raster image with colors preserved',
      icon: FileImage,
      category: 'Chart',
    },
    {
      id: 'svg',
      label: 'SVG Vector',
      description: 'Scalable vector graphic, editable in design tools',
      icon: Code,
      category: 'Chart',
    },
    {
      id: 'csv',
      label: 'CSV Data',
      description: 'Comma-separated values for spreadsheets',
      icon: Table,
      category: 'Data',
    },
    {
      id: 'xlsx',
      label: 'Excel File',
      description: 'Excel workbook with data and color scheme metadata',
      icon: Table,
      category: 'Data',
    },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(selectedFormat as ExportFormat);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Chart & Data
          </DialogTitle>
          <DialogDescription>
            Choose a format to export your filtered chart and data with applied color scheme
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Chart Export Options */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Chart Export</h3>
            <div className="grid grid-cols-2 gap-3">
              {exportOptions
                .filter((opt) => opt.category === 'Chart')
                .map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedFormat(option.id as ExportFormat)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedFormat === option.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{option.label}</p>
                          <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Data Export Options */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Export</h3>
            <div className="grid grid-cols-2 gap-3">
              {exportOptions
                .filter((opt) => opt.category === 'Data')
                .map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedFormat(option.id as ExportFormat)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedFormat === option.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{option.label}</p>
                          <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Export Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> Your filtered data and custom color scheme will be preserved in the export.
              Excel exports include a separate sheet with your color settings for reference.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isExporting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
