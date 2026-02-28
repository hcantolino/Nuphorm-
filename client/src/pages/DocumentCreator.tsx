import React, { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { useNuphorm } from '@/contexts/NuphormContext';
import RegulatorySidebar from '@/components/regulatory/RegulatorySidebar';
import BottomChatBar from '@/components/regulatory/BottomChatBar';
import MainDocumentViewer from '@/components/regulatory/MainDocumentViewer';
import { Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

// Lazy load heavy components (optional for future use);

interface GeneratedDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  sources: any[];
  generatedAt: Date;
  sections: Array<{
    id: string;
    heading: string;
    content: string;
    citations: any[];
  }>;
  citations: Array<{
    id: string;
    text: string;
    sourceId: string;
    pageNumber?: number;
  }>;
}

/**
 * Document Creator Page - Main interface for Nuphorm
 * Combines sidebar, chat interface, and document viewer
 */
export default function DocumentCreator() {
  const { activeProjectId, getActiveProject, sources, settings, isLoading, setIsLoading } =
    useNuphorm();

  const [sidebarToggle, setSidebarToggle] = useState(true);
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeProject = useMemo(() => getActiveProject(), [getActiveProject]);

  /**
   * Handle chat message from BottomChatBar
   * Triggers mock AI document generation
   */
  const handleChatMessage = useCallback(
    async (message: string, documentType?: string) => {
      if (!activeProject) {
        toast.error('Please select a project first');
        return;
      }

      if (!sources.length) {
        toast.error('Please upload source documents first');
        return;
      }

      if (!documentType) {
        toast.error('Please select a document type');
        return;
      }

      setIsGenerating(true);
      setIsLoading(true);

      try {
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Mock AI generation
        const mockDocument: GeneratedDocument = {
          id: `doc-${Date.now()}`,
          title: `${documentType.toUpperCase()} - ${activeProject.deviceName}`,
          documentType,
          content: generateMockDocumentContent(documentType, activeProject, message),
          sources: sources,
          generatedAt: new Date(),
          sections: [
            {
              id: 'sec-1',
              heading: 'Document Content',
              content: generateMockDocumentContent(documentType, activeProject, message),
              citations: generateMockCitations(sources),
            },
          ],
          citations: generateMockCitations(sources),
        };

        setGeneratedDocument(mockDocument);
        toast.success('Document generated successfully!');
      } catch (error) {
        console.error('Generation error:', error);
        toast.error('Failed to generate document');
      } finally {
        setIsGenerating(false);
        setIsLoading(false);
      }
    },
    [activeProject, sources, setIsLoading]
  );

  /**
   * Handle document edits
   */
  const handleDocumentEdit = useCallback((updatedDocument: any) => {
    setGeneratedDocument(updatedDocument);
    toast.success('Document updated');
  }, []);

  /**
   * Handle PDF export
   */
  const handleExportPDF = useCallback(() => {
    if (generatedDocument) {
      toast.success('PDF export initiated');
      // PDF export logic handled in MainDocumentViewer
    }
  }, [generatedDocument]);

  /**
   * Handle sources export
   */
  const handleExportSources = useCallback(() => {
    if (generatedDocument) {
      toast.success('Sources export initiated');
      // ZIP export logic handled in MainDocumentViewer
    }
  }, [generatedDocument]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex flex-col">
      {/* Header */}
      <div className="ml-16 px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Regulatory Document Creator
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {activeProject
                ? `Project: ${activeProject.name}`
                : 'Select a project to begin'}
            </p>
          </div>

          {sources.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-blue-600 rounded-full" />
                {sources.length} source{sources.length !== 1 ? 's' : ''} uploaded
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden ml-16">
        {/* Secondary Sidebar - Regulatory */}
        <div
          className={`flex-shrink-0 border-r border-slate-200 bg-slate-900 transition-all duration-300 overflow-hidden ${
            sidebarToggle ? 'w-64' : 'w-20'
          }`}
        >
          <div className="h-full flex flex-col">
            {/* Collapse Toggle */}
            <button
              onClick={() => setSidebarToggle(!sidebarToggle)}
              className="p-3 text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center"
              title={sidebarToggle ? 'Collapse' : 'Expand'}
            >
              {sidebarToggle ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              <RegulatorySidebar
                isCollapsed={!sidebarToggle}
                onProjectSelect={() => {}}
                onSourcesChange={() => {}}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {generatedDocument ? (
          <MainDocumentViewer
            document={generatedDocument as any}
            sources={sources as any}
            isGenerating={isGenerating}
            onEdit={handleDocumentEdit as any}
            onDownloadPDF={handleExportPDF}
            onDownloadSources={handleExportSources}
          />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-2xl">📄</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">
                  Ready to create a document?
                </h2>
                <p className="text-slate-600 mb-6">
                  {activeProject
                    ? 'Upload source documents, select a document type from the chat bar below, and let AI generate your regulatory document with full source attribution.'
                    : 'Select a project from the sidebar to get started.'}
                </p>

                {!activeProject && (
                  <div className="text-sm text-slate-500 italic">
                    No active project selected
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Chat Bar */}
      <BottomChatBar
        onSendMessage={handleChatMessage}
        selectedProject={activeProject?.name}
        isLoading={isGenerating}
      />

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4 shadow-2xl">
            <div className="relative w-12 h-12">
              <Loader className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Generating document...</p>
              <p className="text-sm text-slate-600 mt-1">
                AI is analyzing your sources and creating the regulatory document
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generate mock document content based on type and project
 */
function generateMockDocumentContent(
  documentType: string,
  project: any,
  userMessage: string
): string {
  const templates: Record<string, string> = {
    '510k': `
# 510(k) Submission - ${project.deviceName}

## 1. Device Description
The ${project.deviceName} is a medical device designed for ${project.intendedUse}. 
This device is substantially equivalent to the predicate device in terms of design, 
materials, performance, and intended use.

## 2. Substantial Equivalence
Substantial equivalence has been demonstrated through comparative analysis of:
- Device design and construction
- Materials and biocompatibility
- Performance characteristics
- Intended use and user population

## 3. Performance Testing
All performance testing has been conducted per applicable FDA guidance documents 
and industry standards. Test results demonstrate that the device meets all critical 
performance parameters.

## 4. Safety and Effectiveness
Safety and effectiveness have been established through:
- Biocompatibility testing per ISO 10993
- Performance testing per FDA guidance
- Risk analysis per ISO 14971
- Clinical data from predicate devices

## 5. Conclusion
Based on the substantial equivalence analysis and supporting data, this device 
is appropriate for marketing under the 510(k) pathway.
    `,
    pma: `
# Premarket Approval (PMA) Application - ${project.deviceName}

## Executive Summary
This PMA application provides comprehensive clinical and technical data 
supporting the safety and effectiveness of the ${project.deviceName}.

## Clinical Summary
Clinical data demonstrates that the device is safe and effective for its 
intended use in the target population.

## Technical Data
Comprehensive technical specifications and performance data are provided, 
including design files, materials specifications, and manufacturing processes.

## Safety Profile
The safety profile of the device has been thoroughly evaluated through 
preclinical testing, clinical trials, and risk analysis.

## Recommendation
Based on the totality of evidence, approval of this PMA is recommended.
    `,
    dmr: `
# Device Medical Records (DMR) - ${project.deviceName}

## Device Identification
- Device Name: ${project.deviceName}
- Device Type: ${project.deviceType}
- Intended Use: ${project.intendedUse}

## Design and Development
Design specifications and development records are maintained per 21 CFR 820.30.

## Manufacturing Information
Manufacturing procedures, specifications, and quality standards are documented.

## Labeling and Packaging
All labeling and packaging materials are maintained in the DMR.

## Quality Records
Quality control records, test results, and inspection records are maintained.

## Complaint Files
All complaints and adverse events are documented and investigated.
    `,
  };

  return (
    templates[documentType] ||
    `# ${documentType.toUpperCase()} - ${project.deviceName}\n\nDocument generated based on user request: ${userMessage}`
  );
}

/**
 * Generate mock citations from sources
 */
function generateMockCitations(sources: any[]): GeneratedDocument['citations'] {
  return sources.slice(0, 2).map((source, index) => ({
    id: `cite-${index}`,
    text: `Reference from ${source.name}`,
    sourceId: source.id,
    pageNumber: Math.floor(Math.random() * 10) + 1,
  }));
}
