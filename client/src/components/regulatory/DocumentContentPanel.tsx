import { useState, useCallback } from 'react';
import { Lightbulb, AlignLeft, FileText, Edit3 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import type { Annotation } from '@/stores/regulatoryStore';
import AnnotationsPanel from './AnnotationsPanel';
import SourcePreviewModal from './SourcePreviewModal';

// ── Light-theme annotation highlight colors ──────────────────────────────────
const SENTENCE_COLORS: Record<string, string> = {
  yellow: 'bg-amber-100 border-b-2 border-amber-400 hover:bg-amber-200/80',
  blue: 'bg-blue-100 border-b-2 border-blue-400 hover:bg-blue-200/80',
  green: 'bg-emerald-100 border-b-2 border-emerald-400 hover:bg-emerald-200/80',
  purple: 'bg-purple-100 border-b-2 border-purple-400 hover:bg-purple-200/80',
  orange: 'bg-orange-100 border-b-2 border-orange-400 hover:bg-orange-200/80',
};

const COLOR_DOTS: Record<string, string> = {
  yellow: 'bg-amber-400',
  blue: 'bg-blue-400',
  green: 'bg-emerald-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
};

function splitSentences(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z\d])|(?<=\n)\s*(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderTextWithCitations(
  text: string,
  onCitationClick?: (citationKey: string) => void
): React.ReactNode[] {
  const citationRegex = /\[([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const citationKey = match[1];
    parts.push(
      <button
        key={`cit-${match.index}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCitationClick?.(citationKey);
        }}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-[10px] font-mono cursor-pointer transition-colors border border-blue-200"
        title={`Jump to reference: ${citationKey}`}
      >
        <FileText className="w-2.5 h-2.5 inline" />
        {citationKey}
      </button>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface DocumentContentPanelProps {
  onCitationClick?: (citationKey: string) => void;
}

export default function DocumentContentPanel({ onCitationClick }: DocumentContentPanelProps) {
  const activeProject = useRegulatoryStore((state) => state.getActiveProject());
  const updateProjectContent = useRegulatoryStore((state) => state.updateProjectContent);

  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showAnnotationsPanel, setShowAnnotationsPanel] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleAnnotationClick = useCallback((ann: Annotation) => {
    setSelectedAnnotation(ann);
  }, []);

  if (!activeProject) return null;

  const annotations: Annotation[] = activeProject.annotations ?? [];
  const sentences = splitSentences(activeProject.content);

  const legendEntries = (() => {
    const seen = new Set<string>();
    const entries: { color: string; name: string }[] = [];
    for (const ann of annotations) {
      if (!seen.has(ann.color)) {
        seen.add(ann.color);
        entries.push({ color: ann.color, name: ann.sourceName });
      }
    }
    return entries;
  })();

  const renderAnnotated = () => {
    if (sentences.length === 0) {
      return (
        <div className="p-8 text-sm text-slate-400 italic text-center">
          No content yet. Use the AI chat above to generate a regulatory document
          from your uploaded source documents.
        </div>
      );
    }

    return (
      <div className="p-6 text-sm leading-relaxed" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
        {sentences.map((sentence, idx) => {
          const ann = annotations.find((a) => a.sentenceIndex === idx);
          const content = renderTextWithCitations(sentence, onCitationClick);
          if (ann) {
            return (
              <span
                key={idx}
                className={`${SENTENCE_COLORS[ann.color] ?? 'bg-slate-100'} cursor-pointer rounded-sm px-0.5 transition-colors`}
                onClick={() => handleAnnotationClick(ann)}
                title={`Source: ${ann.sourceName} — click to preview`}
              >
                {content}{' '}
              </span>
            );
          }
          return <span key={idx}>{content} </span>;
        })}
      </div>
    );
  };

  const renderPlainContent = () => {
    if (!activeProject.content.trim()) return null;
    return (
      <div className="p-6 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
        {renderTextWithCitations(activeProject.content, onCitationClick)}
      </div>
    );
  };

  return (
    <div className="h-full bg-white rounded-xl overflow-hidden flex flex-col relative">
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Document Content</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Format: {activeProject.paperLayout === 'eSTAR' ? 'FDA eSTAR' : 'Document'} |{' '}
              Standard: {activeProject.regulatoryStandard === 'US' ? 'US FDA' : 'EU EMA'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {annotations.length > 0 && (
              <button
                onClick={() => setShowAnnotationsPanel((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  showAnnotationsPanel
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                {annotations.length} notes
              </button>
            )}

            {activeProject.content.trim() && (
              <button
                onClick={() => setIsEditing((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  isEditing
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isEditing ? 'Done' : 'Edit'}
              </button>
            )}

            <button
              onClick={() => {
                if (annotations.length > 0) setShowAnnotations((v) => !v);
              }}
              disabled={annotations.length === 0}
              title={
                annotations.length === 0
                  ? 'Generate a document first to see source annotations'
                  : showAnnotations
                  ? 'Switch back to plain view'
                  : 'Highlight source annotations'
              }
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed ${
                showAnnotations
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              {showAnnotations ? 'Annotations On' : 'Annotations'}
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {isEditing ? (
          <textarea
            value={activeProject.content}
            onChange={(e) => updateProjectContent(activeProject.id, e.target.value)}
            placeholder="Enter your regulatory document content here, or use the AI chat above to generate from uploaded source documents."
            className="flex-1 w-full p-6 text-sm resize-none focus:outline-none bg-white text-slate-800 placeholder:text-slate-400"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif", lineHeight: 1.8 }}
          />
        ) : showAnnotations ? (
          <div className="flex-1 overflow-y-auto text-slate-800">{renderAnnotated()}</div>
        ) : activeProject.content.trim() ? (
          <div className="flex-1 overflow-y-auto">{renderPlainContent()}</div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: '#eff6ff' }}
              >
                <FileText size={28} style={{ color: '#3b82f6' }} />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-2">No document yet</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Use the chat bar above to prompt the AI, or click "Generate Sample" to see a demo
                eStar submission generated from source documents.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-3 border-t flex items-center justify-between flex-shrink-0"
        style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
      >
        <p className="text-xs text-slate-400">
          {activeProject.content.length.toLocaleString()} characters · Last saved:{' '}
          {activeProject.updatedAt.toLocaleString()}
        </p>

        {showAnnotations && legendEntries.length > 0 && (
          <div className="flex items-center gap-3">
            {legendEntries.map(({ color, name }) => (
              <div key={color} className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${COLOR_DOTS[color] ?? 'bg-gray-400'}`}
                />
                <span className="text-xs text-slate-500 truncate max-w-[6rem]">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Annotations slide-in panel */}
      <AnimatePresence>
        {showAnnotationsPanel && (
          <AnnotationsPanel
            annotations={annotations}
            onClose={() => setShowAnnotationsPanel(false)}
            onAnnotationClick={handleAnnotationClick}
          />
        )}
      </AnimatePresence>

      {/* Source preview modal */}
      {selectedAnnotation && (
        <SourcePreviewModal
          annotation={selectedAnnotation}
          onClose={() => setSelectedAnnotation(null)}
        />
      )}
    </div>
  );
}
