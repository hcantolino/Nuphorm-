/**
 * PromptSuggestions
 *
 * Horizontal scrollable chip bar above the chat input with:
 *  - Quick chips for the first 6 prompts most relevant to current data context
 *  - "Browse Prompts" button opening a searchable, grouped dropdown (cmdk Command)
 *  - Keyboard accessible (Tab / Enter / Escape)
 *  - WCAG 2.1 AA contrast compliant
 *  - Clinical disclaimer badge on sensitive prompts
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Search, ChevronRight, AlertTriangle, X, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BIOSTAT_PROMPTS, PROMPT_CATEGORIES, type BiostatPrompt } from './biostatPrompts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PromptSuggestionsProps {
  /** Called when a prompt chip is clicked or selected from Browse */
  onSelect: (prompt: BiostatPrompt) => void;
  /** Column names from the current dataset — used to surface context-aware chips */
  dataColumns?: string[];
  /** Whether the bar is visible */
  visible?: boolean;
  onToggleVisible?: () => void;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Score a prompt against current data columns to surface contextual ones first */
function scorePrompt(prompt: BiostatPrompt, cols: string[]): number {
  if (cols.length === 0) return 0;
  const lower = cols.map((c) => c.toLowerCase());
  let score = 0;
  const fp = prompt.fullPrompt.toLowerCase();

  if (lower.some((c) => /aval|cnsr|evnt|event|surv|os|pfs/.test(c)) &&
      prompt.category === 'Survival Analysis') score += 3;
  if (lower.some((c) => /ae|adverse|sev|ser/.test(c)) &&
      prompt.category === 'Adverse Events') score += 3;
  if (lower.some((c) => /trt|arm|group|treat/.test(c)) &&
      fp.includes('treatment')) score += 2;
  if (lower.some((c) => /date|dt$|dtc$/.test(c)) &&
      fp.includes('date')) score += 1;

  return score;
}

/** Get the 6 most context-relevant prompts for the chip bar */
function getQuickChips(cols: string[]): BiostatPrompt[] {
  return [...BIOSTAT_PROMPTS]
    .sort((a, b) => scorePrompt(b, cols) - scorePrompt(a, cols))
    .slice(0, 6);
}

// ── Browse Dropdown ───────────────────────────────────────────────────────────

function BrowseDropdown({
  onSelect,
  onClose,
}: {
  onSelect: (p: BiostatPrompt) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = BIOSTAT_PROMPTS.filter(
    (p) =>
      !query ||
      p.label.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase()) ||
      p.fullPrompt.toLowerCase().includes(query.toLowerCase())
  );

  const categorised = PROMPT_CATEGORIES.map((cat) => ({
    cat,
    items: filtered.filter((p) => p.category === cat),
  })).filter((g) => g.items.length > 0);

  // Flat list for keyboard nav
  const flat = categorised.flatMap((g) => g.items);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flat.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && flat[activeIdx]) { onSelect(flat[activeIdx]); onClose(); return; }
  }, [flat, activeIdx, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  let itemGlobalIdx = 0;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
      onKeyDown={handleKey}
      role="dialog"
      aria-label="Browse biostatistics prompts"
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
          placeholder="Search prompts…"
          className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
          aria-label="Search biostatistics prompts"
        />
        <button onClick={onClose} className="p-0.5 rounded hover:bg-muted transition-colors" aria-label="Close">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Results */}
      <div
        ref={listRef}
        className="max-h-72 overflow-y-auto py-1"
        role="listbox"
        aria-label="Prompt suggestions"
      >
        {categorised.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">No prompts match "{query}"</p>
        )}
        {categorised.map(({ cat, items }) => (
          <div key={cat}>
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">
              {cat}
            </div>
            {items.map((prompt) => {
              const isActive = flat[activeIdx] === prompt;
              const idx = itemGlobalIdx++;
              return (
                <button
                  key={prompt.label}
                  data-active={isActive}
                  onClick={() => { onSelect(prompt); onClose(); }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    'w-full flex items-start gap-2 px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                  )}
                >
                  <ChevronRight className={cn('w-3 h-3 mt-0.5 flex-shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground/50')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{prompt.label}</span>
                      {prompt.hasClinicalDisclaimer && (
                        <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" aria-label="Interpret with clinical context" />
                      )}
                    </div>
                    {prompt.description && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{prompt.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-border px-3 py-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <kbd className="px-1 rounded bg-muted font-mono">↑↓</kbd> navigate
        <kbd className="px-1 rounded bg-muted font-mono ml-1">↵</kbd> select
        <kbd className="px-1 rounded bg-muted font-mono ml-1">Esc</kbd> close
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PromptSuggestions({
  onSelect,
  dataColumns = [],
  visible = true,
  onToggleVisible,
  className,
}: PromptSuggestionsProps) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const quickChips = getQuickChips(dataColumns);

  // Close browse on outside click
  useEffect(() => {
    if (!browseOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setBrowseOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [browseOpen]);

  if (!visible) {
    return (
      <button
        onClick={onToggleVisible}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue-500 transition-colors"
        aria-label="Show prompt suggestions"
      >
        <Sparkles className="w-3 h-3" />
        Show suggestions
      </button>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative space-y-1', className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Sparkles className="w-3 h-3 text-blue-400" aria-hidden="true" />
          <span>Suggested Prompts</span>
        </div>
        <button
          onClick={onToggleVisible}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Hide prompt suggestions"
        >
          hide
        </button>
      </div>

      {/* Chip bar */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-border"
        role="toolbar"
        aria-label="Quick prompt suggestions"
      >
        {quickChips.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => onSelect(prompt)}
            title={prompt.description ?? prompt.fullPrompt}
            aria-label={`Use prompt: ${prompt.label}${prompt.hasClinicalDisclaimer ? ' (interpret with clinical context)' : ''}`}
            className={cn(
              'flex items-center gap-1 flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors',
              'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1'
            )}
          >
            <ChevronRight className="w-3 h-3 flex-shrink-0 text-blue-400" aria-hidden="true" />
            <span className="truncate max-w-[180px]">{prompt.label}</span>
            {prompt.hasClinicalDisclaimer && (
              <AlertTriangle
                className="w-2.5 h-2.5 flex-shrink-0 text-amber-500"
                aria-label="Interpret with clinical context"
              />
            )}
          </button>
        ))}

        {/* Browse button */}
        <button
          onClick={() => setBrowseOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={browseOpen}
          aria-label="Browse all biostatistics prompts"
          className={cn(
            'flex items-center gap-1 flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors',
            'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300',
            'focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1',
            browseOpen && 'bg-gray-100 border-gray-300'
          )}
        >
          <BookOpen className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          Browse all
        </button>
      </div>

      {/* Browse dropdown */}
      {browseOpen && (
        <BrowseDropdown
          onSelect={onSelect}
          onClose={() => setBrowseOpen(false)}
        />
      )}
    </div>
  );
}
