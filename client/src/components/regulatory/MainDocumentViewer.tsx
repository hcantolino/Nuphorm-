import { useState, useCallback, useMemo, useRef } from 'react';
import { Download, FileText, BookMarked, Edit2, Eye, Highlighter, Link2, X, ChevronUp, ChevronDown, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportDocumentToPDF, exportSourcesAsZip } from '@/lib/pdfExport';

interface Citation {
  id: string;
  text: string;
  sourceId: string;
  pageNumber?: number;
}

interface DocumentContent {
  id: string;
  title: string;
  sections: DocumentSection[];
  citations: Citation[];
  generatedAt: Date;
  documentType: string;
}

interface DocumentSection {
  id: string;
  heading: string;
  content: string;
  citations: Citation[];
}

interface SourceDocument {
  id: string;
  title: string;
  filename: string;
  uploadedAt: Date;
  snippets: SourceSnippet[];
  fileSize: number;
}

interface SourceSnippet {
  id: string;
  text: string;
  pageNumber?: number;
  highlighted?: boolean;
  usedInCitations?: string[]; // Citation IDs
}

interface MainDocumentViewerProps {
  document?: DocumentContent;
  sources?: SourceDocument[];
  isGenerating?: boolean;
  onEdit?: (content: DocumentContent) => void;
  onDownloadPDF?: () => void;
  onDownloadSources?: () => void;
}

export default function MainDocumentViewer({
  document,
  sources = [],
  isGenerating = false,
  onEdit,
  onDownloadPDF,
  onDownloadSources,
}: MainDocumentViewerProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<DocumentContent | null>(document || null);
  const [selectedText, setSelectedText] = useState('');
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [showCitationPopup, setShowCitationPopup] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle text selection for highlighting
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      setSelectedText(selection.toString());
      setShowCitationPopup(true);
    }
  }, []);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  // Copy snippet to clipboard
  const handleCopySnippet = useCallback((snippetId: string) => {
    const snippet = sources
      .flatMap(s => s.snippets)
      .find(s => s.id === snippetId);
    if (snippet) {
      navigator.clipboard.writeText(snippet.text);
      setCopiedSnippetId(snippetId);
      setTimeout(() => setCopiedSnippetId(null), 2000);
    }
  }, [sources]);

  // Save edits
  const handleSaveEdits = useCallback(() => {
    if (editedContent) {
      onEdit?.(editedContent);
      setIsEditMode(false);
    }
  }, [editedContent, onEdit]);

  // Mock AI generation simulation
  const mockGeneratedDocument: DocumentContent = {
    id: '1',
    title: '510(k) Submission - Device XYZ',
    documentType: '510k',
    generatedAt: new Date(),
    citations: [
      { id: 'c1', text: 'Device is substantially equivalent', sourceId: 's1', pageNumber: 2 },
      { id: 'c2', text: 'Performance testing completed', sourceId: 's2', pageNumber: 5 },
    ],
    sections: [
      {
        id: 'sec1',
        heading: '1. Device Description',
        content: 'The Device XYZ is a medical device designed for [use]. It is substantially equivalent to predicate device ABC (K123456). The device incorporates advanced materials and design features that ensure safety and effectiveness.',
        citations: [],
      },
      {
        id: 'sec2',
        heading: '2. Substantial Equivalence',
        content: 'Substantial equivalence has been demonstrated through comparative analysis of device design, materials, performance, and intended use. Performance testing completed per FDA guidance documents. All critical parameters meet or exceed predicate device specifications.',
        citations: [],
      },
      {
        id: 'sec3',
        heading: '3. Safety & Performance',
        content: 'Safety and performance testing has been conducted per applicable standards including ISO 13485, ISO 14971, and FDA guidance. Test results demonstrate device safety and effectiveness for intended use. Biocompatibility testing per ISO 10993 completed with favorable results.',
        citations: [],
      },
    ],
  };

  // Mock source documents
  const mockSources: SourceDocument[] = [
    {
      id: 's1',
      title: 'Predicate Device Specifications',
      filename: 'predicate_device_spec.pdf',
      uploadedAt: new Date(),
      fileSize: 2.5,
      snippets: [
        {
          id: 'snip1',
          text: 'Device is substantially equivalent in design and performance',
          pageNumber: 2,
          highlighted: true,
          usedInCitations: ['c1'],
        },
        {
          id: 'snip2',
          text: 'Material composition: Stainless steel 316L with biocompatible coating',
          pageNumber: 3,
          highlighted: true,
          usedInCitations: [],
        },
      ],
    },
    {
      id: 's2',
      title: 'Performance Test Report',
      filename: 'performance_test_report.pdf',
      uploadedAt: new Date(),
      fileSize: 4.2,
      snippets: [
        {
          id: 'snip3',
          text: 'Performance testing completed per FDA guidance documents',
          pageNumber: 5,
          highlighted: true,
          usedInCitations: ['c2'],
        },
        {
          id: 'snip4',
          text: 'All critical parameters meet or exceed predicate specifications',
          pageNumber: 6,
          highlighted: false,
          usedInCitations: [],
        },
      ],
    },
  ];

  const displayDocument = document || mockGeneratedDocument;
  const displaySources = sources.length > 0 ? sources : mockSources;

  // Handle PDF export
  const handleExportPDF = useCallback(() => {
    if (editedContent) {
      exportDocumentToPDF(editedContent, displaySources);
    } else {
      exportDocumentToPDF(displayDocument, displaySources);
    }
  }, [editedContent, displayDocument, displaySources]);

  // Handle sources export
  const handleExportSources = useCallback(async () => {
    try {
      await exportSourcesAsZip(displaySources, displayDocument.title);
    } catch (error) {
      console.error('Failed to export sources:', error);
    }
  }, [displaySources, displayDocument.title]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Toolbar */}
      <div className="border-b border-gray-300 bg-gray-50 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">{displayDocument.title}</h2>
          <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
            {displayDocument.documentType.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit Mode Toggle */}
          <Button
            onClick={() => setIsEditMode(!isEditMode)}
            variant={isEditMode ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
          >
            {isEditMode ? <Eye className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            {isEditMode ? 'Preview' : 'Edit'}
          </Button>

          {/* Save Button (visible in edit mode) */}
          {isEditMode && (
            <Button
              onClick={handleSaveEdits}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
          )}

          {/* Download Buttons */}
          <Button
            onClick={handleExportPDF}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            PDF
          </Button>

          <Button
            onClick={handleExportSources}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Sources
          </Button>
        </div>
      </div>

      {/* Main Content Area with Tabs */}
      <Tabs defaultValue="document" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b border-gray-300 bg-gray-50 px-6 py-0">
          <TabsTrigger value="document" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600">
            <FileText className="w-4 h-4 mr-2" />
            Document
          </TabsTrigger>
          <TabsTrigger value="sources" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600">
            <BookMarked className="w-4 h-4 mr-2" />
            Sources ({displaySources.length})
          </TabsTrigger>
        </TabsList>

        {/* Document Tab */}
        <TabsContent value="document" className="flex-1 overflow-hidden flex flex-col">
          {isGenerating ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating document...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Document Content */}
              <div
                ref={contentRef}
                className="flex-1 overflow-y-auto px-8 py-6"
                onMouseUp={handleTextSelection}
              >
                <div
                  ref={documentRef}
                  className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8 print:shadow-none print:p-0"
                >
                  {/* Document Title */}
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={editedContent?.title || ''}
                        onChange={(e) =>
                          setEditedContent(prev =>
                            prev ? { ...prev, title: e.target.value } : null
                          )
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1"
                      />
                    ) : (
                      displayDocument.title
                    )}
                  </h1>

                  {/* Generated Date */}
                  <p className="text-sm text-gray-500 mb-8">
                    Generated: {displayDocument.generatedAt.toLocaleDateString()}
                  </p>

                  {/* Document Sections */}
                  <div className="space-y-6">
                    {displayDocument.sections.map((section) => (
                      <div key={section.id}>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">
                          {section.heading}
                        </h2>
                        {isEditMode ? (
                          <textarea
                            value={
                              editedContent?.sections.find(s => s.id === section.id)?.content ||
                              section.content
                            }
                            onChange={(e) =>
                              setEditedContent(prev =>
                                prev
                                  ? {
                                    ...prev,
                                    sections: prev.sections.map(s =>
                                      s.id === section.id ? { ...s, content: e.target.value } : s
                                    ),
                                  }
                                  : null
                              )
                            }
                            className="w-full border border-gray-300 rounded px-3 py-2 min-h-24 font-serif text-gray-700"
                          />
                        ) : (
                          <p className="text-gray-700 leading-relaxed font-serif">
                            {section.content}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scroll Navigation Buttons */}
              <div className="border-t border-gray-300 bg-gray-50 px-6 py-3 flex items-center justify-center gap-2">
                <Button
                  onClick={scrollToTop}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ChevronUp className="w-4 h-4" />
                  Top
                </Button>
                <Button
                  onClick={scrollToBottom}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ChevronDown className="w-4 h-4" />
                  Bottom
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {displaySources.length > 0 ? (
              displaySources.map((source) => (
                <div
                  key={source.id}
                  className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {/* Source Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{source.title}</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        {source.filename} • {source.fileSize} MB • Uploaded{' '}
                        {source.uploadedAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Source Snippets */}
                  <div className="space-y-2">
                    {source.snippets.map((snippet) => (
                      <div
                        key={snippet.id}
                        className={`p-3 rounded text-sm ${
                          snippet.highlighted
                            ? 'bg-yellow-100 border-l-4 border-yellow-400'
                            : 'bg-gray-50 border-l-4 border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-gray-800 leading-relaxed">
                              "{snippet.text}"
                            </p>
                            {snippet.pageNumber && (
                              <p className="text-xs text-gray-600 mt-2">
                                Page {snippet.pageNumber}
                              </p>
                            )}
                            {snippet.usedInCitations && snippet.usedInCitations.length > 0 && (
                              <p className="text-xs text-blue-600 mt-2">
                                ✓ Used in {snippet.usedInCitations.length} citation(s)
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleCopySnippet(snippet.id)}
                            className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                            title="Copy snippet"
                          >
                            {copiedSnippetId === snippet.id ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <BookMarked className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No sources uploaded yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Citation Popup (appears on text selection) */}
      {showCitationPopup && selectedText && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Add Citation</h3>
              <button
                onClick={() => setShowCitationPopup(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4 line-clamp-3">
              "{selectedText}"
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Select Source</label>
                <select className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm">
                  <option>Choose a source...</option>
                  {displaySources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Highlight Color</label>
                <div className="flex gap-2 mt-2">
                  {['yellow', 'blue', 'green', 'pink'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setHighlightColor(color)}
                      className={`w-6 h-6 rounded border-2 ${
                        highlightColor === color ? 'border-gray-900' : 'border-gray-300'
                      } bg-${color}-200`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setShowCitationPopup(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Link2 className="w-4 h-4 mr-2" />
                  Add Citation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
