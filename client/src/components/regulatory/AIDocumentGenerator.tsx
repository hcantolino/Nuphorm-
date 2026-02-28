import { useState } from 'react';
import { Loader2, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc';
import { useRegulatoryStore } from '@/stores/regulatoryStore';

interface AIDocumentGeneratorProps {
  projectId: number;
  sourceDocuments: Array<{
    id: number;
    documentName: string;
    extractedText?: string;
  }>;
  deviceInfo: {
    deviceName: string;
    deviceType: string;
    intendedUse: string;
    predicateDevices?: any[];
  };
  onGenerationComplete: () => void;
}

const DOCUMENT_TYPES = [
  { id: 'device_description', label: 'Device Description', description: 'Device specifications and intended use' },
  { id: 'substantial_equivalence', label: 'Substantial Equivalence', description: 'Predicate device comparison' },
  { id: 'safety_evaluation', label: 'Safety & Performance', description: 'Testing and safety assessment' },
  { id: 'labeling_instructions', label: 'Instructions for Use', description: 'Device labeling and warnings' },
  { id: '510k_summary', label: '510(k) Summary', description: 'Submission summary' },
];

export default function AIDocumentGenerator({
  projectId,
  sourceDocuments,
  deviceInfo,
  onGenerationComplete,
}: AIDocumentGeneratorProps) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>(DOCUMENT_TYPES.map(d => d.id));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { addGeneratedDocuments } = useRegulatoryStore();

  const generateMutation = trpc.regulatory.generateDocuments.useMutation();

  const handleGenerateDocuments = async () => {
    if (sourceDocuments.length === 0) {
      setError('Please add at least one source document before generating');
      return;
    }

    if (selectedDocs.length === 0) {
      setError('Please select at least one document type to generate');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Extract text from source documents
      const sourceTexts = sourceDocuments
        .map(doc => doc.extractedText || doc.documentName)
        .filter(Boolean);

      // Call the generation mutation
      const result = await generateMutation.mutateAsync({
        projectId,
        documentTypes: selectedDocs,
        sourceDocuments: sourceTexts,
        deviceInfo,
      });

      if (result.success && result.documents) {
        // Add generated documents to store with default content
        const docsWithContent = result.documents.map(doc => ({
          ...doc,
          content: (doc as any).content || '',
        }));
        addGeneratedDocuments(docsWithContent);
        setProgress(100);
        
        // Show success message
        setTimeout(() => {
          setIsGenerating(false);
          onGenerationComplete();
        }, 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate documents');
      setIsGenerating(false);
    }
  };

  const toggleDocumentType = (docId: string) => {
    setSelectedDocs(prev =>
      prev.includes(docId)
        ? prev.filter(d => d !== docId)
        : [...prev, docId]
    );
  };

  const selectAll = () => {
    setSelectedDocs(DOCUMENT_TYPES.map(d => d.id));
  };

  const deselectAll = () => {
    setSelectedDocs([]);
  };

  return (
    <Card className="p-6 bg-white border-blue-200">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            AI-Powered Document Generation
          </h3>
          <p className="text-sm text-gray-600 mt-2">
            Select which regulatory documents to generate based on your source materials
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Document Type Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Documents to Generate</label>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {DOCUMENT_TYPES.map(docType => (
              <label
                key={docType.id}
                className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedDocs.includes(docType.id)}
                  onChange={() => toggleDocumentType(docType.id)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{docType.label}</div>
                  <div className="text-sm text-gray-600">{docType.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Source Documents Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm">
            <div className="font-medium text-gray-900">Source Documents</div>
            <div className="text-gray-600 mt-1">
              {sourceDocuments.length} document{sourceDocuments.length !== 1 ? 's' : ''} loaded
            </div>
            {sourceDocuments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {sourceDocuments.slice(0, 3).map(doc => (
                  <li key={doc.id} className="text-gray-600 text-xs">
                    • {doc.documentName}
                  </li>
                ))}
                {sourceDocuments.length > 3 && (
                  <li className="text-gray-600 text-xs">
                    • +{sourceDocuments.length - 3} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium">Generating documents...</span>
              <span className="text-gray-600">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerateDocuments}
          disabled={isGenerating || sourceDocuments.length === 0 || selectedDocs.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating {selectedDocs.length} Document{selectedDocs.length !== 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Generate {selectedDocs.length} Document{selectedDocs.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>

        {/* Info Text */}
        <p className="text-xs text-gray-500 text-center">
          AI generation typically takes 30-60 seconds. Documents will be saved to your project.
        </p>
      </div>
    </Card>
  );
}
