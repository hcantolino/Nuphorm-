import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, Printer, Maximize2, Minimize2, Highlighter } from 'lucide-react';

interface DocumentViewerProps {
  url?: string;
  title?: string;
  onClose: () => void;
  document?: any;
}

export default function DocumentViewer({ url, title, onClose, document }: DocumentViewerProps) {
  const finalUrl = url || (document?.url || document?.fileUrl);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Stop loading after PDF has time to load
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [finalUrl]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Download PDF
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF
  const handlePrint = () => {
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.print();
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 10, 50));
  };

  // Modal backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalClasses = isFullScreen
    ? 'fixed inset-0 z-50 bg-black'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';

  const contentClasses = isFullScreen
    ? 'w-full h-full flex flex-col bg-white'
    : 'w-full h-full max-w-6xl max-h-[90vh] flex flex-col bg-white rounded-lg shadow-2xl';

  // Add inline disposition to URL to force display instead of download
  const displayUrl = finalUrl && finalUrl.includes('?') 
    ? `${finalUrl}&response-content-disposition=inline`
    : finalUrl ? `${finalUrl}?response-content-disposition=inline` : '';

  if (!finalUrl) {
    return (
      <div className={modalClasses} onClick={handleBackdropClick}>
        <div className={contentClasses}>
          <p className="text-gray-600">No document URL provided</p>
        </div>
      </div>
    );
  }

  return (
    <div className={modalClasses} onClick={handleBackdropClick}>
      <div className={contentClasses}>
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {title || 'Document Viewer'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded-lg">
              <button
                onClick={handleZoomOut}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Zoom Out (Ctrl+-)"
              >
                <ZoomOut className="w-4 h-4 text-gray-700" />
              </button>
              <span className="text-xs text-gray-600 px-1 min-w-12 text-center">{zoom}%</span>
              <button
                onClick={handleZoomIn}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Zoom In (Ctrl++)"
              >
                <ZoomIn className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            {/* Highlight Color Picker */}
            <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded-lg">
              <Highlighter className="w-4 h-4 text-gray-700" />
              <select
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
                className="text-xs border-0 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
                <option value="blue">Blue</option>
                <option value="red">Red</option>
              </select>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Download PDF"
            >
              <Download className="w-4 h-4 text-gray-700" />
            </button>

            <button
              onClick={handlePrint}
              className="hidden sm:block p-2 hover:bg-gray-100 rounded transition-colors"
              title="Print PDF"
            >
              <Printer className="w-4 h-4 text-gray-700" />
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="hidden sm:block p-2 hover:bg-gray-100 rounded transition-colors"
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-gray-700" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-700" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Container */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-full w-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading PDF...</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4">
              <embed
                src={displayUrl}
                type="application/pdf"
                className="w-full h-full rounded"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
              />
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Use Esc to close, Ctrl+P to print</span>
            <span className="text-right">
              {finalUrl?.split('/').pop()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
