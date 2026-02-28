import { useState } from 'react';
import { toast } from 'sonner';
import RegulatorySidebar from '@/components/regulatory/RegulatorySidebar';
import BottomChatBar from '@/components/regulatory/BottomChatBar';
import ReferencesPanel from '@/components/regulatory/ReferencesPanel';
import DocumentContentPanel from '@/components/regulatory/DocumentContentPanel';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import { trpc } from '@/lib/trpc';

export default function Regulatory() {
  const { activeProjectId } = useRegulatoryStore();
  const updateProjectContent = useRegulatoryStore((s) => s.updateProjectContent);
  const updateProjectAnnotations = useRegulatoryStore((s) => s.updateProjectAnnotations);
  const attachFile = useRegulatoryStore((s) => s.attachFile);
  const activeProject = useRegulatoryStore((s) => s.getActiveProject());

  const [isGenerating, setIsGenerating] = useState(false);

  const generateDoc = trpc.regulatory.generateRegulatoryDoc.useMutation({
    onSuccess: (data) => {
      if (!activeProjectId) return;
      updateProjectContent(activeProjectId, data.content);
      updateProjectAnnotations(activeProjectId, data.annotations as any);
      // Auto-attach any files the AI referenced
      data.usedFileNames.forEach((name) => attachFile(activeProjectId, name));
      toast.success('Document generated successfully');
      setIsGenerating(false);
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
      setIsGenerating(false);
    },
  });

  const handleSendMessage = (message: string, documentType?: string) => {
    setIsGenerating(true);
    generateDoc.mutate({
      message,
      documentType,
      attachedFileNames: activeProject?.attachedFiles ?? [],
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col">
      {/* Main Layout with Sidebar */}
      <div className="flex flex-1 relative">
        {/* Regulatory Sidebar — self-contained, manages its own collapsed state */}
        <RegulatorySidebar
          onProjectSelect={(projectId) => console.log('Selected project:', projectId)}
          onSourcesChange={(sources) => console.log('Sources updated:', sources)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* AI Chat Bar — pinned at top, full width */}
          <BottomChatBar
            inline
            onSendMessage={handleSendMessage}
            selectedProject={activeProjectId?.toString()}
            isLoading={isGenerating}
          />

          {/* Document Content (left) + References (right) */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-6">
              <div className="grid grid-cols-2 gap-6 h-[600px]">
                <DocumentContentPanel />
                <ReferencesPanel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
