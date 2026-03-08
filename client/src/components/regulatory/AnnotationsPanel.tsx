import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import type { Annotation } from '@/stores/regulatoryStore';

const COLOR_DOTS: Record<string, string> = {
  yellow: 'bg-amber-400',
  blue: 'bg-blue-400',
  green: 'bg-emerald-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
};

const COLOR_BG: Record<string, string> = {
  yellow: 'bg-amber-50 border-amber-200 hover:bg-amber-100/70',
  blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100/70',
  green: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70',
  purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100/70',
  orange: 'bg-orange-50 border-orange-200 hover:bg-orange-100/70',
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
  const sources = Array.from(new Set(annotations.map((a) => a.sourceName)));

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="absolute right-0 top-0 bottom-0 w-72 bg-white border-l shadow-xl z-30 flex flex-col"
      style={{ borderColor: '#e2e8f0' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Annotations ({annotations.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {sources.length} source{sources.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Source legend */}
      {sources.length > 0 && (
        <div className="px-4 py-3 border-b flex flex-col gap-1.5 flex-shrink-0" style={{ borderColor: '#e2e8f0' }}>
          {sources.map((src) => {
            const firstAnn = annotations.find((a) => a.sourceName === src);
            const color = firstAnn?.color ?? 'yellow';
            return (
              <div key={src} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_DOTS[color] ?? 'bg-gray-400'}`} />
                <span className="text-xs text-slate-600 truncate">{src}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Annotation list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {annotations.map((ann) => (
          <button
            key={ann.id}
            onClick={() => onAnnotationClick(ann)}
            className={`w-full text-left p-3 rounded-lg border transition cursor-pointer ${
              COLOR_BG[ann.color] ?? 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  COLOR_DOTS[ann.color] ?? 'bg-gray-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed">{ann.text}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <p className="text-xs text-slate-400 truncate">{ann.sourceName}</p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div
        className="px-4 py-3 border-t text-xs text-slate-400 flex-shrink-0"
        style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
      >
        Click any annotation to preview its source
      </div>
    </motion.div>
  );
}
