import { useState, useCallback } from 'react';
import { Lightbulb, AlignLeft } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import type { Annotation } from '@/stores/regulatoryStore';
import AnnotationsPanel from './AnnotationsPanel';
import SourcePreviewModal from './SourcePreviewModal';

// Tailwind classes for each annotation colour
const SENTENCE_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-100 border-b-2 border-yellow-400 hover:bg-yellow-200',
  blue: 'bg-blue-100 border-b-2 border-blue-400 hover:bg-blue-200',
  green: 'bg-green-100 border-b-2 border-green-400 hover:bg-green-200',
  purple: 'bg-purple-100 border-b-2 border-purple-400 hover:bg-purple-200',
  orange: 'bg-orange-100 border-b-2 border-orange-400 hover:bg-orange-200',
};

const COLOR_DOTS: Record<string, string> = {
  yellow: 'bg-yellow-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
};

// Split plain-text content into sentences for the annotation overlay
function splitSentences(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z\d])|(?<=\n)\s*(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function DocumentContentPanel() {
  const activeProject = useRegulatoryStore((state) => state.getActiveProject());
  const updateProjectContent = useRegulatoryStore((state) => state.updateProjectContent);

  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showAnnotationsPanel, setShowAnnotationsPanel] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);

  const handleAnnotationClick = useCallback((ann: Annotation) => {
    setSelectedAnnotation(ann);
  }, []);

  if (!activeProject) return null;

  const annotations: Annotation[] = activeProject.annotations ?? [];
  const sentences = splitSentences(activeProject.content);

  // Unique colour → source pairs for the footer legend
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

  // Render content as colour-coded sentence spans (annotation mode)
  const renderAnnotated = () => {
    if (sentences.length === 0) {
      return (
        <div className="p-6 text-sm text-gray-400 italic">
          No content yet. Use the AI chat above to generate a regulatory document from your
          uploaded source documents.
        </div>
      );
    }

    return (
      <div className="p-6 font-mono text-sm leading-relaxed">
        {sentences.map((sentence, idx) => {
          const ann = annotations.find((a) => a.sentenceIndex === idx);
          if (ann) {
            return (
              <span
                key={idx}
                className={`${
                  SENTENCE_COLORS[ann.color] ?? 'bg-gray-100'
                } cursor-pointer rounded-sm px-0.5 transition-colors`}
                onClick={() => handleAnnotationClick(ann)}
                title={`Source: ${ann.sourceName} — click to preview`}
              >
                {sentence}{' '}
              </span>
            );
          }
          return <span key={idx}>{sentence} </span>;
        })}
      </div>
    );
  };

  return (
    <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col relative">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Document Content</h2>
            <p className="text-sm text-gray-600 mt-1">
              Format: {activeProject.paperLayout === 'eSTAR' ? 'FDA eSTAR' : 'Document'} |{' '}
              Standard: {activeProject.regulatoryStandard === 'US' ? 'US FDA' : 'EU EMA'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Annotation list toggle — only shown when annotations exist */}
            {annotations.length > 0 && (
              <button
                onClick={() => setShowAnnotationsPanel((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  showAnnotationsPanel
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                {annotations.length} notes
              </button>
            )}

            {/* Annotation highlight toggle */}
            <button
              onClick={() => {
                if (annotations.length > 0) setShowAnnotations((v) => !v);
              }}
              disabled={annotations.length === 0}
              title={
                annotations.length === 0
                  ? 'Generate a document first to see source annotations'
                  : showAnnotations
                  ? 'Switch back to edit mode'
                  : 'Highlight source annotations'
              }
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                showAnnotations
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              {showAnnotations ? 'Annotations on' : 'Annotations'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Editor / Annotated View ──────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {showAnnotations ? (
          <div className="flex-1 overflow-y-auto">{renderAnnotated()}</div>
        ) : (
          <textarea
            value={activeProject.content}
            onChange={(e) => updateProjectContent(activeProject.id, e.target.value)}
            placeholder="Enter your regulatory document content here, or use the AI chat above to generate from uploaded source documents."
            className="flex-1 w-full p-6 font-mono text-sm resize-none focus:outline-none"
          />
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-gray-500">
          {activeProject.content.length} characters · Last saved:{' '}
          {activeProject.updatedAt.toLocaleString()}
        </p>

        {/* Colour legend when annotations are visible */}
        {showAnnotations && legendEntries.length > 0 && (
          <div className="flex items-center gap-3">
            {legendEntries.map(({ color, name }) => (
              <div key={color} className="flex items-center gap-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${COLOR_DOTS[color] ?? 'bg-gray-400'}`}
                />
                <span className="text-xs text-gray-600 truncate max-w-[6rem]">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Annotations slide-in panel ───────────────────────────────────── */}
      <AnimatePresence>
        {showAnnotationsPanel && (
          <AnnotationsPanel
            annotations={annotations}
            onClose={() => setShowAnnotationsPanel(false)}
            onAnnotationClick={handleAnnotationClick}
          />
        )}
      </AnimatePresence>

      {/* ── Source preview modal ─────────────────────────────────────────── */}
      {selectedAnnotation && (
        <SourcePreviewModal
          annotation={selectedAnnotation}
          onClose={() => setSelectedAnnotation(null)}
        />
      )}
    </div>
  );
}
