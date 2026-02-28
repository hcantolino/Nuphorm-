/**
 * DataPreviewTable
 *
 * Crash-safe, virtualized data table for previewing CSV/XLSX rows.
 *
 * Modes:
 *  - Inline (default): renders head(20) + tail(5) — max 25 rows — in a
 *    fixed-height scrollable div. No virtualizer overhead for small slices.
 *  - Full (virtualize=true): uses @tanstack/react-virtual to render only the
 *    visible rows. Suitable for hundreds/thousands of rows in a modal.
 *
 * Safety:
 *  - All cell values go through safeCell() — never crashes on NaN/null/mixed types.
 *  - Wrapped in an ErrorBoundary so a bad value can't white-screen the parent.
 *  - Shows only first 12 columns; extras noted in header.
 *
 * Props:
 *  rows        — full row array (DataPreviewTable slices internally)
 *  columns     — column names in display order
 *  virtualize  — set true for the "View Full Data" modal (renders all rows)
 *  height      — container height in px (default 260 inline, 460 full)
 *  isLoading   — show skeleton shimmer instead of table
 */

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Safely converts any cell value to a displayable string — never throws. */
function safeCell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') {
    // Check NaN first — isFinite(NaN) is false, so NaN must be caught before !isFinite
    if (isNaN(v)) return 'NaN';
    if (!isFinite(v)) return v > 0 ? '∞' : '-∞';
    return String(v);
  }
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v);
}

const MAX_COLS = 12;
const ROW_HEIGHT = 28; // px — keep in sync with the `h-7` cell class

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TableSkeleton({ cols = 6, rows = 8 }: { cols?: number; rows?: number }) {
  return (
    <div className="space-y-1.5 p-2">
      {/* header */}
      <div className="flex gap-1.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-5 flex-1 rounded" />
        ))}
      </div>
      {/* body rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-1.5">
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton key={ci} className="h-4 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Inline preview (≤25 rows, no virtualizer) ─────────────────────────────────

interface InlinePreviewProps {
  rows: Record<string, unknown>[];
  cols: string[];
  height: number;
}

function InlinePreview({ rows, cols, height }: InlinePreviewProps) {
  const displayCols = cols.slice(0, MAX_COLS);
  // Only show a separate tail when the dataset is large enough that head(20) and
  // tail(5) are entirely disjoint (i.e. rows > 25).  If rows ≤ 25 just show them
  // all so we never display duplicate rows or a negative "omitted" count.
  const showSeparateTail = rows.length > 25;
  const head = showSeparateTail ? rows.slice(0, 20) : rows;
  const tail = showSeparateTail ? rows.slice(-5) : [];
  const hasGap = tail.length > 0;
  const omitted = rows.length - head.length - tail.length;

  return (
    <div className="overflow-auto rounded-lg border border-border text-[10px]" style={{ maxHeight: height }}>
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border w-6 tabular-nums">#</th>
            {displayCols.map((col) => (
              <th
                key={col}
                title={col}
                className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border whitespace-nowrap"
              >
                {col.length > 14 ? col.slice(0, 14) + '…' : col}
              </th>
            ))}
            {cols.length > MAX_COLS && (
              <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border whitespace-nowrap">
                +{cols.length - MAX_COLS} more
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {head.map((row, ri) => (
            <tr key={ri} className="border-b border-border/40 hover:bg-muted/20">
              <td className="px-2 h-7 text-muted-foreground tabular-nums">{ri + 1}</td>
              {displayCols.map((col) => {
                const raw = safeCell(row[col]);
                return (
                  <td key={col} className="px-2 h-7 max-w-[120px] truncate" title={raw}>
                    {raw === '—'
                      ? <span className="text-gray-300 italic">—</span>
                      : raw.length > 16 ? raw.slice(0, 16) + '…' : raw
                    }
                  </td>
                );
              })}
            </tr>
          ))}

          {hasGap && (
            <tr className="border-b border-dashed border-border/60">
              <td
                colSpan={displayCols.length + 1 + (cols.length > MAX_COLS ? 1 : 0)}
                className="px-2 py-1 text-center text-muted-foreground bg-muted/20 italic"
              >
                ·· {omitted.toLocaleString()} rows omitted ··
              </td>
            </tr>
          )}

          {tail.map((row, ti) => (
            <tr key={`tail-${ti}`} className="border-b border-border/40 hover:bg-muted/20 bg-blue-50/20">
              <td className="px-2 h-7 text-muted-foreground tabular-nums">
                {rows.length - tail.length + ti + 1}
              </td>
              {displayCols.map((col) => {
                const raw = safeCell(row[col]);
                return (
                  <td key={col} className="px-2 h-7 max-w-[120px] truncate" title={raw}>
                    {raw === '—'
                      ? <span className="text-gray-300 italic">—</span>
                      : raw.length > 16 ? raw.slice(0, 16) + '…' : raw
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Virtualized preview (all rows, modal usage) ───────────────────────────────

interface VirtualPreviewProps {
  rows: Record<string, unknown>[];
  cols: string[];
  height: number;
}

function VirtualPreview({ rows, cols, height }: VirtualPreviewProps) {
  const displayCols = cols.slice(0, MAX_COLS);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  return (
    <div className="rounded-lg border border-border overflow-hidden text-[10px]">
      {/* Sticky header — outside the scrollable div */}
      <table className="w-full border-collapse">
        <thead className="bg-muted/80">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border w-10 tabular-nums">#</th>
            {displayCols.map((col) => (
              <th
                key={col}
                title={col}
                className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border whitespace-nowrap"
              >
                {col.length > 14 ? col.slice(0, 14) + '…' : col}
              </th>
            ))}
            {cols.length > MAX_COLS && (
              <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border whitespace-nowrap">
                +{cols.length - MAX_COLS} more
              </th>
            )}
          </tr>
        </thead>
      </table>

      {/* Virtualized scrollable body */}
      <div ref={parentRef} style={{ height, overflowY: 'auto' }}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {virtualItems.map((vItem) => {
            const row = rows[vItem.index];
            return (
              <div
                key={vItem.key}
                data-index={vItem.index}
                ref={rowVirtualizer.measureElement}
                style={{ position: 'absolute', top: vItem.start, left: 0, right: 0 }}
                className="flex border-b border-border/40 hover:bg-muted/20"
              >
                {/* Row number */}
                <div className="w-10 px-2 flex items-center text-muted-foreground tabular-nums flex-shrink-0">
                  {vItem.index + 1}
                </div>
                {/* Cells */}
                {displayCols.map((col) => {
                  const raw = safeCell(row[col]);
                  return (
                    <div
                      key={col}
                      title={raw}
                      className="px-2 flex items-center min-w-[80px] max-w-[150px] truncate"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {raw === '—'
                        ? <span className="text-gray-300 italic">—</span>
                        : raw.length > 16 ? raw.slice(0, 16) + '…' : raw
                      }
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground bg-muted/30">
        {rows.length.toLocaleString()} rows · {cols.length} columns
        {cols.length > MAX_COLS && ` (showing first ${MAX_COLS})`}
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface DataPreviewTableProps {
  rows: Record<string, unknown>[];
  columns: string[];
  /** When true, uses @tanstack/react-virtual — intended for the View Full Data modal */
  virtualize?: boolean;
  /** Container height in px */
  height?: number;
  /** Show loading skeleton */
  isLoading?: boolean;
}

export function DataPreviewTable({
  rows,
  columns,
  virtualize = false,
  height,
  isLoading = false,
}: DataPreviewTableProps) {
  const h = height ?? (virtualize ? 460 : 260);

  if (isLoading) {
    return <TableSkeleton cols={Math.min(columns.length || 6, MAX_COLS)} rows={8} />;
  }

  if (!rows.length || !columns.length) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">
        No data to display
      </div>
    );
  }

  return (
    <ErrorBoundary label="Data Preview Table">
      {virtualize
        ? <VirtualPreview rows={rows} cols={columns} height={h} />
        : <InlinePreview rows={rows} cols={columns} height={h} />
      }
    </ErrorBoundary>
  );
}

export default DataPreviewTable;
