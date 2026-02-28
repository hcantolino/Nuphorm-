import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import type { Annotation } from '@/stores/regulatoryStore';

const COLOR_DOTS: Record<string, string> = {
  yellow: 'bg-yellow-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
};

const COLOR_BG: Record<string, string> = {
  yellow: 'bg-yellow-50 border-yellow-200',
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
};

interface AnnotationsPanelProps {
  annotations: Annotation[];
  onClose: () => void;
  onAnnotationClick: (annotation: Annotation) => void;
}

export default function AnnotationsPanel({
  annotations,
  onClose,
  onAnnotationClick,
}: AnnotationsPanelProps) {
  // Group annotations by source
  const sources = Array.from(new Set(annotations.map((a) => a.sourceName)));

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="absolute right-0 top-0 bottom-0 w-72 bg-white border-l border-gray-200 shadow-2xl z-30 flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Annotations ({annotations.length})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{sources.length} source{sources.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/60 rounded-lg transition text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Source legend */}
      {sources.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-1.5 flex-shrink-0">
          {sources.map((src) => {
            const firstAnn = annotations.find((a) => a.sourceName === src);
            const color = firstAnn?.color ?? 'yellow';
            return (
              <div key={src} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_DOTS[color] ?? 'bg-gray-400'}`} />
                <span className="text-xs text-gray-600 truncate">{src}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Annotation list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {annotations.map((ann, idx) => (
          <button
            key={ann.id}
            onClick={() => onAnnotationClick(ann)}
            className={`w-full text-left p-3 rounded-lg border transition hover:shadow-sm ${
              COLOR_BG[ann.color] ?? 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  COLOR_DOTS[ann.color] ?? 'bg-gray-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-800 line-clamp-3 leading-relaxed">{ann.text}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500 truncate">{ann.sourceName}</p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 flex-shrink-0">
        Click any annotation to preview its source
      </div>
    </motion.div>
  );
}
