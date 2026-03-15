/**
 * Regulatory Document Creation Dashboard
 * 
 * A comprehensive SaaS component for creating regulatory documents with:
 * - Multi-tab interface (New Doc, Library, Integrations)
 * - Left sidebar navigation with document sections
 * - Drag-and-drop file upload zone
 * - AI configuration panel with customizable prompts
 * - Real-time preview pane for AI-generated content
 * - Mobile-responsive design with accessibility features
 * 
 * @component
 * @example
 * import { RegulatoryDocumentDashboard } from '@/components/regulatory/RegulatoryDocumentDashboard';
 * 
 * export default function Page() {
 *   return <RegulatoryDocumentDashboard />;
 * }
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Upload,
  FileText,
  Settings,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Library,
  Zap,
  FolderOpen,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Share2,
  MoreVertical,
  Menu,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

/**
 * Type definitions for regulatory document creation
 */
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  progress?: number;
}

interface AIConfiguration {
  prompt: string;
  sections: {
    deviceDescription: boolean;
    safetyPerformance: boolean;
    clinicalData: boolean;
    riskAnalysis: boolean;
    complianceStatement: boolean;
    references: boolean;
  };
  tone: 'formal' | 'technical' | 'balanced';
  maxLength: number;
}

interface PreviewContent {
  title: string;
  sections: {
    [key: string]: string;
  };
  generatedAt: Date;
  status: 'idle' | 'generating' | 'complete' | 'error';
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

/**
 * Main Regulatory Document Dashboard Component
 */
export const RegulatoryDocumentDashboard: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState<'new' | 'library' | 'integrations'>('new');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(['upload', 'ai-config', 'preview'])
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiConfig, setAiConfig] = useState<AIConfiguration>({
    prompt: 'Generate a comprehensive regulatory document for a medical device based on the uploaded files.',
    sections: {
      deviceDescription: true,
      safetyPerformance: true,
      clinicalData: false,
      riskAnalysis: true,
      complianceStatement: true,
      references: false,
    },
    tone: 'formal',
    maxLength: 5000,
  });
  const [previewContent, setPreviewContent] = useState<PreviewContent>({
    title: 'Regulatory Document Preview',
    sections: {
      deviceDescription: 'Device description will appear here...',
      safetyPerformance: 'Safety and performance data will appear here...',
    },
    generatedAt: new Date(),
    status: 'idle',
  });
  const [activeSidebarItem, setActiveSidebarItem] = useState<string>('uploaded-docs');
  const [documentTitle, setDocumentTitle] = useState('Untitled Regulatory Document');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  /**
   * Sidebar navigation items
   */
  const sidebarItems: SidebarItem[] = useMemo(
    () => [
      { 
        id: 'uploaded-docs', 
        label: 'Uploaded Documents', 
        icon: <FolderOpen className="w-5 h-5" />, 
        badge: uploadedFiles.length 
      },
      { 
        id: 'biostat', 
        label: 'Create Biostatistics', 
        icon: <Database className="w-5 h-5" /> 
      },
      { 
        id: 'sandbox', 
        label: 'Data Sandbox', 
        icon: <Zap className="w-5 h-5" /> 
      },
    ],
    [uploadedFiles.length]
  );

  /**
   * Handle file drag enter
   */
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  /**
   * Handle file drag leave
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  }, []);

  /**
   * Process uploaded files
   */
  const handleFileUpload = useCallback((files: File[]) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'application/json',
    ];

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 50MB limit`);
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} has unsupported file type`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newFiles = validFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date(),
      progress: 0,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // Simulate upload progress
    newFiles.forEach((file) => {
      simulateUploadProgress(file.id);
    });

    toast.success(`${validFiles.length} file(s) uploaded successfully`);
  }, []);

  /**
   * Simulate file upload progress
   */
  const simulateUploadProgress = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, progress } : f))
      );
    }, 200);
  };

  /**
   * Remove uploaded file
   */
  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    toast.success('File removed');
  }, []);

  /**
   * Toggle panel expansion
   */
  const togglePanel = useCallback((panelId: string) => {
    setExpandedPanels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(panelId)) {
        newSet.delete(panelId);
      } else {
        newSet.add(panelId);
      }
      return newSet;
    });
  }, []);

  /**
   * Update AI configuration
   */
  const updateAiConfig = useCallback(
    (updates: Partial<AIConfiguration>) => {
      setAiConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  /**
   * Generate regulatory document using AI
   */
  const generateDocument = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    setIsGenerating(true);
    setPreviewContent((prev) => ({ ...prev, status: 'generating' }));

    try {
      // Simulate API call to generate document
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const generatedSections: { [key: string]: string } = {};
      if (aiConfig.sections.deviceDescription) {
        generatedSections.deviceDescription =
          'This medical device is designed to provide accurate measurements and reliable performance in clinical settings. The device incorporates advanced technology to ensure user safety and data integrity. It has been engineered to meet stringent regulatory requirements and international standards.';
      }
      if (aiConfig.sections.safetyPerformance) {
        generatedSections.safetyPerformance =
          'Safety testing has been conducted in accordance with applicable standards including ISO 13485 and FDA requirements. Performance metrics demonstrate consistent accuracy and reliability across all tested parameters. The device has undergone rigorous validation testing to ensure patient safety.';
      }
      if (aiConfig.sections.clinicalData) {
        generatedSections.clinicalData =
          `Clinical evaluation data from ${uploadedFiles.length} uploaded file(s) supports the safety and effectiveness of this device. The clinical data demonstrates statistically significant improvements in patient outcomes. All clinical trials were conducted in accordance with Good Clinical Practice guidelines.`;
      }
      if (aiConfig.sections.riskAnalysis) {
        generatedSections.riskAnalysis =
          'Risk analysis has identified and mitigated potential hazards through design modifications and risk controls. All residual risks are acceptable given the clinical benefits of the device. The risk management process followed ISO 14971 standards.';
      }
      if (aiConfig.sections.complianceStatement) {
        generatedSections.complianceStatement =
          'This device complies with applicable regulatory requirements including FDA 21 CFR Part 820 (Quality System Regulation) and international standards such as ISO 13485. The device has been designed and manufactured to meet all applicable requirements.';
      }
      if (aiConfig.sections.references) {
        generatedSections.references = 'Standards: ISO 13485:2016, FDA 21 CFR Part 11, IEC 62304:2015, ISO 14971:2019';
      }

      setPreviewContent({
        title: documentTitle,
        sections: generatedSections,
        generatedAt: new Date(),
        status: 'complete',
      });

      toast.success('Document generated successfully');
    } catch (error) {
      console.error('Error generating document:', error);
      setPreviewContent((prev) => ({ ...prev, status: 'error' }));
      toast.error('Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  }, [uploadedFiles, aiConfig, documentTitle]);

  /**
   * Export document
   */
  const exportDocument = useCallback((format: 'pdf' | 'docx' | 'txt') => {
    if (previewContent.status !== 'complete') {
      toast.error('Generate a document first');
      return;
    }

    const content = Object.values(previewContent.sections).join('\n\n');
    const dataStr = `${previewContent.title}\n\n${content}`;
    const dataBlob = new Blob([dataStr], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${documentTitle.replace(/\s+/g, '-')}.${format === 'txt' ? 'txt' : 'docx'}`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Document exported as ${format.toUpperCase()}`);
  }, [previewContent, documentTitle]);

  /**
   * Render upload zone panel
   */
  const renderUploadPanel = () => (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => togglePanel('upload')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel('upload');
          }
        }}
        aria-expanded={expandedPanels.has('upload')}
        aria-label="Toggle upload zone"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Upload Zone</CardTitle>
          </div>
          {expandedPanels.has('upload') ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
        <CardDescription>Drag and drop files or click to browse</CardDescription>
      </CardHeader>

      {expandedPanels.has('upload') && (
        <CardContent className="space-y-4">
          {/* Drag and drop area */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Drop files here or click to upload"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  handleFileUpload(Array.from(e.target.files));
                }
              }}
              className="hidden"
              accept=".pdf,.csv,.xlsx,.xls,.txt,.json"
              aria-label="File input"
            />
            <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Drag and drop your files here
            </p>
            <p className="text-xs text-gray-500 mt-1">
              or click to browse (PDF, CSV, XLSX, TXT, JSON - max 50MB)
            </p>
          </div>

          {/* Uploaded files list */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Uploaded Files ({uploadedFiles.length})</h4>
              <ScrollArea className="h-48">
                <div className="space-y-2 pr-4">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${file.progress || 0}%` }}
                              role="progressbar"
                              aria-valuenow={file.progress || 0}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Upload progress for ${file.name}`}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {Math.round(file.progress || 0)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="ml-2 p-1 hover:bg-red-100 rounded transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );

  /**
   * Render AI configuration panel
   */
  const renderAiConfigPanel = () => (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => togglePanel('ai-config')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel('ai-config');
          }
        }}
        aria-expanded={expandedPanels.has('ai-config')}
        aria-label="Toggle AI configuration"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">AI Configuration</CardTitle>
          </div>
          {expandedPanels.has('ai-config') ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
        <CardDescription>Customize AI generation parameters</CardDescription>
      </CardHeader>

      {expandedPanels.has('ai-config') && (
        <CardContent className="space-y-6">
          {/* Document title */}
          <div className="space-y-2">
            <label htmlFor="doc-title" className="text-sm font-medium">
              Document Title
            </label>
            <Input
              id="doc-title"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="Enter document title"
              aria-label="Document title"
            />
          </div>

          {/* Custom prompt */}
          <div className="space-y-2">
            <label htmlFor="ai-prompt" className="text-sm font-medium">
              AI Prompt
            </label>
            <textarea
              id="ai-prompt"
              value={aiConfig.prompt}
              onChange={(e) => updateAiConfig({ prompt: e.target.value })}
              placeholder="Enter custom prompt for AI generation"
              className="w-full h-24 p-3 border border-gray-300 rounded-lg bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="AI prompt"
            />
          </div>

          {/* Tone selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium block">Tone</label>
            <div className="flex gap-2 flex-wrap">
              {(['formal', 'technical', 'balanced'] as const).map((tone) => (
                <button
                  key={tone}
                  onClick={() => updateAiConfig({ tone })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    aiConfig.tone === tone
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  aria-pressed={aiConfig.tone === tone}
                  aria-label={`Select ${tone} tone`}
                >
                  {tone.charAt(0).toUpperCase() + tone.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Document sections */}
          <div className="space-y-3">
            <label className="text-sm font-medium block">Document Sections</label>
            <div className="space-y-2">
              {[
                { key: 'deviceDescription', label: 'Device Description' },
                { key: 'safetyPerformance', label: 'Safety & Performance' },
                { key: 'clinicalData', label: 'Clinical Data' },
                { key: 'riskAnalysis', label: 'Risk Analysis' },
                { key: 'complianceStatement', label: 'Compliance Statement' },
                { key: 'references', label: 'References' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <Checkbox
                    id={key}
                    checked={aiConfig.sections[key as keyof typeof aiConfig.sections]}
                    onCheckedChange={(checked) =>
                      updateAiConfig({
                        sections: {
                          ...aiConfig.sections,
                          [key]: checked,
                        },
                      })
                    }
                    aria-label={`Include ${label}`}
                  />
                  <label
                    htmlFor={key}
                    className="text-sm cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Max length */}
          <div className="space-y-2">
            <label htmlFor="max-length" className="text-sm font-medium">
              Maximum Length: {aiConfig.maxLength} words
            </label>
            <input
              id="max-length"
              type="range"
              min="500"
              max="10000"
              step="500"
              value={aiConfig.maxLength}
              onChange={(e) => updateAiConfig({ maxLength: parseInt(e.target.value) })}
              className="w-full"
              aria-label="Maximum document length"
            />
          </div>

          {/* Generate button */}
          <Button
            onClick={generateDocument}
            disabled={isGenerating || uploadedFiles.length === 0}
            className="w-full"
            size="lg"
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Generate Document
              </>
            )}
          </Button>
        </CardContent>
      )}
    </Card>
  );

  /**
   * Render preview pane
   */
  const renderPreviewPane = () => (
    <Card className="border-0 shadow-sm bg-white h-full flex flex-col">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => togglePanel('preview')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel('preview');
          }
        }}
        aria-expanded={expandedPanels.has('preview')}
        aria-label="Toggle preview pane"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Preview</CardTitle>
          </div>
          {expandedPanels.has('preview') ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
        <CardDescription>Real-time AI-generated content</CardDescription>
      </CardHeader>

      {expandedPanels.has('preview') && (
        <CardContent className="flex-1 flex flex-col space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {previewContent.status === 'idle' && (
              <div className="flex items-center gap-2 text-gray-500">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Ready to generate</span>
              </div>
            )}
            {previewContent.status === 'generating' && (
              <div className="flex items-center gap-2 text-blue-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating...</span>
              </div>
            )}
            {previewContent.status === 'complete' && (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">
                  Generated {previewContent.generatedAt.toLocaleTimeString()}
                </span>
              </div>
            )}
            {previewContent.status === 'error' && (
              <div className="flex items-center gap-2 text-red-500">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Error generating document</span>
              </div>
            )}
          </div>

          {/* Preview content */}
          <ScrollArea className="flex-1 border border-gray-200 rounded-lg p-4">
            <div className="space-y-4 pr-4">
              <h3 className="text-lg font-semibold">{previewContent.title}</h3>
              {Object.entries(previewContent.sections).map(([key, content]) => (
                <div key={key}>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">
                    {key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) => str.toUpperCase())
                      .trim()}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {content}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Export buttons */}
          {previewContent.status === 'complete' && (
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => exportDocument('pdf')}
                variant="outline"
                size="sm"
                className="flex-1 min-w-20"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button
                onClick={() => exportDocument('docx')}
                variant="outline"
                size="sm"
                className="flex-1 min-w-20"
              >
                <Download className="w-4 h-4 mr-2" />
                DOCX
              </Button>
              <Button
                onClick={() => exportDocument('txt')}
                variant="outline"
                size="sm"
                className="flex-1 min-w-20"
              >
                <Download className="w-4 h-4 mr-2" />
                TXT
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 min-w-20"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );

  /**
   * Main render
   */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Create a Regulatory Document
              </h1>
              <p className="text-gray-600 mt-1">
                Generate comprehensive regulatory documents using AI
              </p>
            </div>
            <Button variant="outline" size="lg" className="gap-2 whitespace-nowrap">
              <Plus className="w-5 h-5" />
              New Document
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="mt-6">
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="new" className="gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">New Doc</span>
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-2">
                <Library className="w-4 h-4" />
                <span className="hidden sm:inline">Library</span>
              </TabsTrigger>
              <TabsTrigger value="integrations" className="gap-2">
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Integrations</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Hidden on mobile, visible on desktop */}
          <aside className="hidden lg:block lg:col-span-1">
            <nav className="space-y-2 sticky top-24" aria-label="Sidebar navigation">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSidebarItem(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeSidebarItem === item.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-current={activeSidebarItem === item.id ? 'page' : undefined}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content area */}
          <main className="lg:col-span-3 space-y-6" role="main">
            {/* Upload and AI Config panels */}
            <div className="space-y-4">
              {renderUploadPanel()}
              {renderAiConfigPanel()}
            </div>

            {/* Preview pane - visible on mobile below content */}
            <div className="lg:hidden">
              {renderPreviewPane()}
            </div>
          </main>

          {/* Preview pane - right column on desktop */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              {renderPreviewPane()}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RegulatoryDocumentDashboard;
