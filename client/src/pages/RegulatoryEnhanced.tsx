import { useState, useCallback, useMemo } from 'react';
import { Save, Loader } from 'lucide-react';
import RegulatorySidebar from '@/components/regulatory/RegulatorySidebar';
import BottomChatBar from '@/components/regulatory/BottomChatBar';
import MainDocumentViewer from '@/components/regulatory/MainDocumentViewer';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// Match MainDocumentViewer SourceDocument interface
interface SourceDocument {
  id: string;
  title: string;
  filename: string;
  uploadedAt: Date;
  snippets: Array<{
    id: string;
    text: string;
    pageNumber?: number;
    highlighted?: boolean;
    usedInCitations?: string[];
  }>;
  fileSize: number;
}

interface DocumentContent {
  id: string;
  title: string;
  sections: Array<{
    id: string;
    heading: string;
    content: string;
    citations: Array<{
      id: string;
      text: string;
      sourceId: string;
      pageNumber?: number;
    }>;
  }>;
  citations: Array<{
    id: string;
    text: string;
    sourceId: string;
    pageNumber?: number;
  }>;
  generatedAt: Date;
  documentType: string;
}

/**
 * Enhanced Regulatory page with AI document generation
 * Integrates MainDocumentViewer with BottomChatBar for end-to-end workflow
 */
export default function RegulatoryEnhanced() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDocument, setGeneratedDocument] = useState<DocumentContent | null>(null);
  const [uploadedSources, setUploadedSources] = useState<SourceDocument[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState({
    deviceName: 'Medical Device',
    deviceType: 'diagnostic',
    intendedUse: 'Device intended use',
    predicateDevices: [] as any[],
  });
  const [repositoryOnly, setRepositoryOnly] = useState(true);

  // tRPC mutation for document generation
  const generateDocMutation = trpc.documentGeneration.generateFromChat.useMutation({
    onSuccess: (data) => {
      setGeneratedDocument(data.document);
      setIsGenerating(false);
      toast.success('Document generated successfully!');
    },
    onError: (error) => {
      setIsGenerating(false);
      toast.error(`Failed to generate document: ${error.message}`);
    },
  });

  /**
   * Handle message from BottomChatBar
   * Triggers document generation with selected document type and sources
   */
  const handleSendMessage = useCallback(
    async (message: string, documentType?: string) => {
      if (!uploadedSources.length) {
        toast.error('Please upload source documents first');
        return;
      }

      if (!documentType) {
        toast.error('Please select a document type');
        return;
      }

      setIsGenerating(true);

      // Extract snippets from uploaded sources
      const sourceSnippets = uploadedSources.flatMap((source) =>
        source.snippets.map((snippet) => ({
          id: snippet.id,
          text: snippet.text,
          sourceId: source.id,
          pageNumber: snippet.pageNumber,
        }))
      );

      try {
        await generateDocMutation.mutateAsync({
          documentType,
          deviceInfo,
          sourceSnippets,
          repositoryOnly,
        });
      } catch (error) {
        console.error('Generation error:', error);
      }
    },
    [uploadedSources, deviceInfo, repositoryOnly, generateDocMutation]
  );

  /**
   * Handle sources update from RegulatorySidebar
   */
  const handleSourcesChange = useCallback((sources: any[]) => {
    setUploadedSources(sources);
  }, []);

  /**
   * Handle project selection from RegulatorySidebar
   */
  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProject(projectId);
    // TODO: Load project details and update deviceInfo
  }, []);

  /**
   * Handle document edits from MainDocumentViewer
   */
  const handleDocumentEdit = useCallback((updatedDocument: DocumentContent) => {
    setGeneratedDocument(updatedDocument);
    toast.success('Document updated');
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Regulatory Document Generation</h1>
            <p className="text-sm text-gray-600 mt-1">
              AI-powered document creation with full source attribution
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {uploadedSources.length > 0 && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                {uploadedSources.length} source{uploadedSources.length !== 1 ? 's' : ''} uploaded
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Regulatory Sidebar - Collapsible */}
        <div
          className={`flex-shrink-0 border-r border-gray-300 bg-gray-900 transition-all duration-300 overflow-hidden ${
            isSidebarExpanded ? 'w-64' : 'w-20'
          }`}
        >
          <div className="h-full flex flex-col">
            {/* Collapse Toggle Button */}
            <button
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className="p-3 text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center"
              title={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarExpanded ? '◀' : '▶'}
            </button>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              <RegulatorySidebar
                isCollapsed={!isSidebarExpanded}
                onProjectSelect={handleProjectSelect}
                onSourcesChange={handleSourcesChange}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {generatedDocument ? (
            <MainDocumentViewer
              document={generatedDocument}
              sources={uploadedSources}
              isGenerating={isGenerating}
              onEdit={handleDocumentEdit}
              onDownloadPDF={() => {
                // PDF export is handled in MainDocumentViewer
                toast.success('PDF export initiated');
              }}
              onDownloadSources={() => {
                // ZIP export is handled in MainDocumentViewer
                toast.success('Sources export initiated');
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Save className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Ready to generate a document?
                </h2>
                <p className="text-gray-600 max-w-md">
                  Upload source documents in the sidebar, select a document type from the chat bar below,
                  and let AI generate your regulatory document with full source attribution.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Chat Bar */}
      <BottomChatBar
        onSendMessage={handleSendMessage}
        selectedProject={selectedProject || undefined}
        isLoading={isGenerating}
      />

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4">
            <Loader className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <p className="font-semibold text-gray-900">Generating document...</p>
              <p className="text-sm text-gray-600">This may take a moment</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
