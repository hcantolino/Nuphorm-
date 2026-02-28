import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Send, BookOpen, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DocumentType {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
}

interface BottomChatBarProps {
  onSendMessage?: (message: string, documentType?: string) => void;
  selectedProject?: string;
  isLoading?: boolean;
  /** When true renders inline (no fixed positioning) with popup opening downward */
  inline?: boolean;
}

const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: '510k',
    name: '510(k) Submission',
    description: 'Premarket notification for substantially equivalent devices',
    promptTemplate: 'Generate a 510(k) submission document using the uploaded sources',
  },
  {
    id: 'pma',
    name: 'Premarket Application (PMA)',
    description: 'Comprehensive application for high-risk devices',
    promptTemplate: 'Generate a Premarket Application (PMA) using the uploaded sources',
  },
  {
    id: 'dmr',
    name: 'Device Medical Records (DMR)',
    description: 'Device history record per 21 CFR 820.184',
    promptTemplate: 'Generate Device Medical Records (DMR) documentation using sources',
  },
  {
    id: 'qms',
    name: 'Quality Management System (QMS/21 CFR 820)',
    description: 'Complete quality system documentation',
    promptTemplate: 'Generate QMS documentation per 21 CFR 820 using sources',
  },
  {
    id: 'technical',
    name: 'Technical File/Document (21 CFR 820.30)',
    description: 'Design and development documentation',
    promptTemplate: 'Generate Technical File documentation per 21 CFR 820.30 using sources',
  },
  {
    id: 'ifu',
    name: 'Instructions for Use (IFU)',
    description: 'User-facing instructions and safety information',
    promptTemplate: 'Generate Instructions for Use (IFU) document using sources',
  },
  {
    id: 'quality-docs',
    name: 'Quality System Documentation',
    description: 'Complete quality system procedures and records',
    promptTemplate: 'Generate comprehensive Quality System Documentation using sources',
  },
  {
    id: 'biocompat',
    name: 'Biocompatibility Test Report',
    description: 'ISO 10993 biocompatibility assessment',
    promptTemplate: 'Generate Biocompatibility Test Report using uploaded sources',
  },
  {
    id: 'mdr',
    name: 'Medical Device Reporting (MDR)',
    description: 'Adverse event and incident reporting',
    promptTemplate: 'Generate Medical Device Reporting (MDR) documentation using sources',
  },
];

export default function BottomChatBar({
  onSendMessage,
  selectedProject,
  isLoading = false,
  inline = false,
}: BottomChatBarProps) {
  const [message, setMessage] = useState('');
  const [showDocTypePanel, setShowDocTypePanel] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [searchDocType, setSearchDocType] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowDocTypePanel(false);
      }
    };

    if (showDocTypePanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDocTypePanel]);

  // Filter document types by search
  const filteredDocTypes = useMemo(() => {
    return DOCUMENT_TYPES.filter(doc =>
      doc.name.toLowerCase().includes(searchDocType.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchDocType.toLowerCase())
    );
  }, [searchDocType]);

  // Handle document type selection
  const handleSelectDocType = useCallback((docType: DocumentType) => {
    setSelectedDocType(docType.id);
    setMessage(docType.promptTemplate);
    setShowDocTypePanel(false);
    setSearchDocType('');
    // Focus input for immediate typing
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Handle send message
  const handleSendMessage = useCallback(() => {
    if (message.trim()) {
      onSendMessage?.(message, selectedDocType || undefined);
      setMessage('');
      setSelectedDocType(null);
    }
  }, [message, selectedDocType, onSendMessage]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <div className={inline
      ? "w-full bg-gray-100 border-b border-gray-300 p-4"
      : "fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-300 p-4 z-40"
    }>
      <div className="max-w-6xl mx-auto">
        {/* Selected Doc Type Badge */}
        {selectedDocType && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium">
              {DOCUMENT_TYPES.find(d => d.id === selectedDocType)?.name}
            </span>
            <button
              onClick={() => {
                setSelectedDocType(null);
                setMessage('');
              }}
              className="text-xs text-gray-500 hover:text-gray-700 transition"
            >
              ✕ Clear
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-3">
          {/* Document Type Selector Button with Book + Magnifying Glass Icon */}
          <div className="relative">
            <button
              onClick={() => setShowDocTypePanel(!showDocTypePanel)}
              className="p-2.5 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center group"
              title="Select document type"
              aria-label="Document type selector"
            >
              <div className="relative">
                <BookOpen className="w-5 h-5 text-blue-600 group-hover:text-blue-700" />
                <Search className="w-3 h-3 text-blue-600 group-hover:text-blue-700 absolute -bottom-0.5 -right-0.5" />
              </div>
            </button>

            {/* Floating Document Type Panel */}
            {showDocTypePanel && (
              <div
                ref={panelRef}
                className={`absolute left-0 w-80 bg-white border border-gray-300 rounded-xl shadow-2xl z-50 overflow-hidden ${
                  inline ? "top-full mt-2" : "bottom-full mb-2"
                }`}
              >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100">
                  <h3 className="font-semibold text-sm text-gray-900">Document Types</h3>
                  <button
                    onClick={() => {
                      setShowDocTypePanel(false);
                      setSearchDocType('');
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition"
                    aria-label="Close panel"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Search Input */}
                <div className="p-3 border-b border-gray-200 bg-white">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search documents..."
                      value={searchDocType}
                      onChange={(e) => setSearchDocType(e.target.value)}
                      className="pl-9 h-8 text-sm border-gray-300 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Document Type List - Scrollable */}
                <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
                  {filteredDocTypes.length > 0 ? (
                    filteredDocTypes.map(docType => (
                      <button
                        key={docType.id}
                        onClick={() => handleSelectDocType(docType)}
                        className={`w-full text-left p-3 rounded-lg transition-all border-2 ${
                          selectedDocType === docType.id
                            ? 'bg-blue-50 border-blue-500 shadow-sm'
                            : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        <p className="font-medium text-sm text-gray-900">{docType.name}</p>
                        <p className="text-xs text-gray-600 mt-1">{docType.description}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-6">No documents found</p>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                  {selectedProject ? (
                    <span>Project: <span className="font-medium text-gray-900">{selectedProject}</span></span>
                  ) : (
                    <span className="text-gray-500">Select a project to generate documents</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="flex-1 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chat with AI about your regulatory documents... (Shift+Enter for new line)"
              className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-24"
              rows={1}
              disabled={isLoading}
            />

            {/* Send Button */}
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 h-auto transition-colors"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Helper Text */}
        <p className="text-xs text-gray-500 mt-2">
          💡 Tip: Click the book icon to select a document type, or type your custom request
        </p>
      </div>
    </div>
  );
}
