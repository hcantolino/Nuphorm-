import { useState, useEffect, useRef } from 'react';
import { FileText, FileSpreadsheet, BookOpen, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import type { AIReference } from '@/stores/regulatoryStore';

// ── Light-theme color accents for source highlights ──────────────────────────
const COLOR_ACCENTS: Record<string, { bg: string; border: string; dot: string; highlight: string; text: string }> = {
  yellow: { bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-400', highlight: 'bg-amber-100', text: 'text-amber-800' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-300', dot: 'bg-blue-400', highlight: 'bg-blue-100', text: 'text-blue-800' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-400', highlight: 'bg-emerald-100', text: 'text-emerald-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-300', dot: 'bg-purple-400', highlight: 'bg-purple-100', text: 'text-purple-800' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-400', highlight: 'bg-orange-100', text: 'text-orange-800' },
};

function FileIcon({ type }: { type: string }) {
  if (['CSV', 'XLSX', 'XLS'].includes(type.toUpperCase()))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
}

interface ReferencesPanelProps {
  highlightedCitation?: string | null;
}

export default function ReferencesPanel({ highlightedCitation }: ReferencesPanelProps) {
  const activeProject = useRegulatoryStore((state) => state.getActiveProject());
  const [activeCard, setActiveCard] = useState(0);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const references: AIReference[] = activeProject?.references ?? [];

  useEffect(() => {
    if (!highlightedCitation || references.length === 0) return;
    const idx = references.findIndex(
      (r) => r.citationKey === highlightedCitation || r.sourceName === highlightedCitation
    );
    if (idx >= 0) {
      setActiveCard(idx);
      cardRefs.current.get(idx)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedCitation, references]);

  if (!activeProject) return null;

  const toggleFlip = (idx: number) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const goTo = (dir: 'prev' | 'next') => {
    setActiveCard((prev) => {
      const next = dir === 'next' ? prev + 1 : prev - 1;
      if (next < 0) return references.length - 1;
      if (next >= references.length) return 0;
      return next;
    });
  };

  return (
    <div className="h-full bg-white rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className="px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-800">References</h2>
          </div>
          {references.length > 0 && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {references.length} source{references.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Auto-populated from AI generation
        </p>
      </div>

      {/* Body */}
      {references.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: '#eff6ff' }}
          >
            <BookOpen className="w-7 h-7 text-blue-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">No references yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
            Generate a document to auto-populate references from your source materials
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Card navigation */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
            style={{ borderColor: '#e2e8f0' }}
          >
            <button
              onClick={() => goTo('prev')}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-500">
              {activeCard + 1} / {references.length}
            </span>
            <button
              onClick={() => goTo('next')}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable card list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {references.map((ref, idx) => {
              const colors = COLOR_ACCENTS[ref.color] ?? COLOR_ACCENTS.yellow;
              const isActive = idx === activeCard;
              const isFlipped = flipped.has(idx);
              const isHighlighted = highlightedCitation === ref.citationKey || highlightedCitation === ref.sourceName;

              return (
                <div
                  key={ref.id}
                  ref={(el) => { if (el) cardRefs.current.set(idx, el); }}
                  onClick={() => { setActiveCard(idx); toggleFlip(idx); }}
                  className={`rounded-xl border cursor-pointer transition-all duration-200 ${
                    isHighlighted
                      ? `${colors.highlight} ${colors.border} ring-2 ring-blue-400 shadow-lg`
                      : isActive
                      ? `${colors.bg} ${colors.border} shadow-md`
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {/* Front: Source name + excerpt */}
                  {!isFlipped ? (
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <FileIcon type={ref.sourceType} />
                        <span className="text-xs font-semibold text-slate-700 truncate flex-1">
                          {ref.sourceName}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {ref.sourceType}
                        </span>
                      </div>

                      {/* Highlighted excerpt */}
                      <div className={`rounded-lg p-3 text-xs leading-relaxed ${colors.highlight} border ${colors.border}`}>
                        <Quote className="w-3 h-3 text-slate-400 mb-1 inline-block mr-1" />
                        <span className={`${colors.text}`}>{ref.excerpt}</span>
                      </div>

                      <p className="text-[10px] text-slate-400 mt-2 text-center">
                        Click to see annotation
                      </p>
                    </div>
                  ) : (
                    /* Back: Annotation tooltip */
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <span className="text-xs font-semibold text-slate-600">Annotation</span>
                        <span className="ml-auto text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          [{ref.citationKey}]
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-200">
                        {ref.annotation}
                      </p>

                      <div className="flex items-center gap-1.5 mt-3">
                        <FileIcon type={ref.sourceType} />
                        <span className="text-[10px] text-slate-500 truncate">{ref.sourceName}</span>
                      </div>

                      <p className="text-[10px] text-slate-400 mt-2 text-center">
                        Click to see excerpt
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Source legend footer */}
          <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
            <div className="flex flex-wrap gap-2">
              {references.map((ref) => {
                const colors = COLOR_ACCENTS[ref.color] ?? COLOR_ACCENTS.yellow;
                return (
                  <div key={ref.id} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    <span className="text-[10px] text-slate-500 truncate max-w-[5rem]">
                      {ref.sourceName.replace(/\.[^.]+$/, '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
