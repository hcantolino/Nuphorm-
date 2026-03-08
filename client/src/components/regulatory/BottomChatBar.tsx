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

  const filteredDocTypes = useMemo(() => {
    return DOCUMENT_TYPES.filter(doc =>
      doc.name.toLowerCase().includes(searchDocType.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchDocType.toLowerCase())
    );
  }, [searchDocType]);

  const handleSelectDocType = useCallback((docType: DocumentType) => {
    setSelectedDocType(docType.id);
    setMessage(docType.promptTemplate);
    setShowDocTypePanel(false);
    setSearchDocType('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (message.trim()) {
      onSendMessage?.(message, selectedDocType || undefined);
      setMessage('');
      setSelectedDocType(null);
    }
  }, [message, selectedDocType, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <div
      className={inline
        ? 'w-full p-4'
        : 'fixed bottom-0 left-0 right-0 p-4 z-40'
      }
      style={{
        background: '#ffffff',
        borderBottom: inline ? '1px solid #e2e8f0' : undefined,
        borderTop: !inline ? '1px solid #e2e8f0' : undefined,
        boxShadow: inline ? undefined : '0 -2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Selected Doc Type Badge */}
        {selectedDocType && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium border border-blue-200">
              {DOCUMENT_TYPES.find(d => d.id === selectedDocType)?.name}
            </span>
            <button
              onClick={() => { setSelectedDocType(null); setMessage(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-3.5 h-3.5 inline" /> Clear
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-3">
          {/* Document Type Selector */}
          <div className="relative">
            <button
              onClick={() => setShowDocTypePanel(!showDocTypePanel)}
              className="p-2.5 rounded-lg border transition-all flex items-center justify-center group"
              style={{
                background: showDocTypePanel ? '#eff6ff' : '#f8fafc',
                borderColor: showDocTypePanel ? '#3b82f6' : '#e2e8f0',
              }}
              title="Select document type"
            >
              <div className="relative">
                <BookOpen className="w-5 h-5 text-blue-500 group-hover:text-blue-600" />
                <Search className="w-3 h-3 text-blue-500 group-hover:text-blue-600 absolute -bottom-0.5 -right-0.5" />
              </div>
            </button>

            {/* Floating Document Type Panel */}
            {showDocTypePanel && (
              <div
                ref={panelRef}
                className={`absolute left-0 w-80 rounded-xl shadow-xl z-50 overflow-hidden ${
                  inline ? 'top-full mt-2' : 'bottom-full mb-2'
                }`}
                style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
              >
                {/* Header */}
                <div
                  className="p-4 border-b flex items-center justify-between sticky top-0"
                  style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
                >
                  <h3 className="font-semibold text-sm text-slate-800">Document Types</h3>
                  <button
                    onClick={() => { setShowDocTypePanel(false); setSearchDocType(''); }}
                    className="p-1 hover:bg-slate-100 rounded transition"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b" style={{ borderColor: '#e2e8f0' }}>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search documents..."
                      value={searchDocType}
                      onChange={(e) => setSearchDocType(e.target.value)}
                      className="pl-9 h-8 text-sm bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
                  {filteredDocTypes.length > 0 ? (
                    filteredDocTypes.map(docType => (
                      <button
                        key={docType.id}
                        onClick={() => handleSelectDocType(docType)}
                        className={`w-full text-left p-3 rounded-lg transition-all border ${
                          selectedDocType === docType.id
                            ? 'bg-blue-50 border-blue-300 shadow-sm'
                            : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50/50'
                        }`}
                      >
                        <p className="font-medium text-sm text-slate-700">{docType.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{docType.description}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-6">No documents found</p>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t text-xs text-slate-400" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                  {selectedProject ? (
                    <span>Project: <span className="font-medium text-slate-700">{selectedProject}</span></span>
                  ) : (
                    <span>Select a project to generate documents</span>
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
              placeholder="Describe the regulatory document you need... (Shift+Enter for new line)"
              className="flex-1 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent max-h-24"
              style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                color: '#0f172a',
              }}
              rows={1}
              disabled={isLoading}
            />

            {/* Send Button */}
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || isLoading}
              className="disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 h-auto transition-colors"
              style={{
                background: message.trim() && !isLoading ? '#3b82f6' : '#94a3b8',
                color: '#fff',
                borderRadius: 8,
              }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Helper Text */}
        <p className="text-xs text-slate-400 mt-2">
          Tip: Click the book icon to select a document type, or type your custom request
        </p>
      </div>
    </div>
  );
}
