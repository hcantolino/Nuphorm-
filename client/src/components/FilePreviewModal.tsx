'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface FilePreviewModalProps {
  isOpen?: boolean;
  onClose: () => void;
  file?: {
    id: number;
    fileName: string;
    fileKey: string;
    fileUrl: string;
    mimeType: string;
    fileSizeBytes: number;
  } | null;
}

interface PreviewData {
  headers: string[];
  rows: (string | number | null)[][];
  totalRows: number;
}

export default function FilePreviewModal({ isOpen = true, onClose, file }: FilePreviewModalProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Download is a query, not a mutation

  const rowsPerPage = 10;

  useEffect(() => {
    if (isOpen && file) {
      loadPreview();
    }
  }, [isOpen, file]);

  const loadPreview = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setPreviewData(null);
    setCurrentPage(0);

    try {
      // Get download URL
      const downloadResponse = await fetch('/api/trpc/files.download?input=' + encodeURIComponent(JSON.stringify({ fileKey: file.fileKey })));
      const downloadJson = await downloadResponse.json();
      const downloadResult = downloadJson.result?.data;

      if (!downloadResult.success) {
        throw new Error('Failed to get download URL');
      }

      // Fetch file content
      const response = await fetch(downloadResult.url);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Parse based on file type
      if (file.mimeType.includes('csv') || file.fileName.endsWith('.csv')) {
        parseCSV(data);
      } else if (
        file.mimeType.includes('spreadsheet') ||
        file.mimeType.includes('excel') ||
        file.fileName.endsWith('.xlsx') ||
        file.fileName.endsWith('.xls')
      ) {
        parseXLSX(data);
      } else {
        throw new Error('Unsupported file format for preview');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load preview';
      setError(message);
      toast.error(message);
      console.error('[Preview Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  const parseCSV = (data: Uint8Array) => {
    try {
      const text = new TextDecoder().decode(data);
      const lines = text.trim().split('\n');

      if (lines.length === 0) {
        throw new Error('Empty file');
      }

      // Parse header
      const headers = lines[0].split(',').map((h) => h.trim());

      // Parse rows
      const rows = lines.slice(1).map((line) =>
        line.split(',').map((cell) => {
          const trimmed = cell.trim();
          const num = parseFloat(trimmed);
          return isNaN(num) ? trimmed : num;
        })
      );

      setPreviewData({
        headers,
        rows,
        totalRows: rows.length,
      });
    } catch (err) {
      throw new Error(`Failed to parse CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const parseXLSX = (data: Uint8Array) => {
    // For XLSX, we'll show a placeholder message since parsing requires additional libraries
    // In a production app, you'd use a library like xlsx or exceljs
    throw new Error(
      'XLSX preview requires additional setup. Please download the file to view its contents.'
    );
  };

  const handleDownload = async () => {
    if (!file) return;

    try {
      const response = await fetch('/api/trpc/files.download?input=' + encodeURIComponent(JSON.stringify({ fileKey: file.fileKey })));
      const json = await response.json();
      const result = json.result?.data;
      if (result?.success) {
        window.open(result.url, '_blank');
        toast.success('Download started');
      }
    } catch (err) {
      toast.error('Failed to download file');
      console.error('[Download Error]', err);
    }
  };

  const paginatedRows = previewData
    ? previewData.rows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage)
    : [];

  const totalPages = previewData ? Math.ceil(previewData.rows.length / rowsPerPage) : 0;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{file?.fileName}</h2>
              <p className="text-xs text-gray-500 mt-1">
                {formatBytes(file?.fileSizeBytes || 0)} • {file?.mimeType}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p className="text-gray-600">Loading preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-600 font-medium mb-2">Failed to load preview</p>
                <p className="text-sm text-gray-600">{error}</p>
              </div>
            </div>
          )}

          {previewData && !isLoading && (
            <div className="p-4">
              {/* Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {previewData.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-2 text-left font-semibold text-gray-700 whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-4 py-2 text-gray-700 whitespace-nowrap"
                          >
                            {cell === null ? '—' : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Info */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                  <span>
                    Showing {currentPage * rowsPerPage + 1} to{' '}
                    {Math.min((currentPage + 1) * rowsPerPage, previewData.totalRows)} of{' '}
                    {previewData.totalRows} rows
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                      className="p-1 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 py-1">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                      disabled={currentPage === totalPages - 1}
                      className="p-1 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
