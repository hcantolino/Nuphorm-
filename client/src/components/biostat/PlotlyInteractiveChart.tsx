/**
 * PlotlyInteractiveChart
 *
 * Interactive Plotly.js chart component for advanced biostatistics visualizations.
 * Supports: survival/KM curves with SEM bands, box plots, heatmaps, waterfall plots,
 * forest plots, volcano plots, scatter, bar, and line charts.
 *
 * Integrates with GraphTablePanel — rendered when chart_data contains pharma_type
 * metadata or survival/pharma keywords detected via isPlotlyChartData().
 */

import { useState, useCallback, useEffect, lazy, Suspense, useMemo, useRef } from 'react';
import {
  Tag,
  BarChart2,
  Table2,
  TrendingDown,
  Percent,
  Loader2,
  X,
  Palette,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

// Lazy-load react-plotly.js — use factory wrapper to produce { default: ... } shape
// that React.lazy requires (react-plotly.js exports a CJS module, not ESM default).
const Plot = lazy(() =>
  import('react-plotly.js').then((mod) => ({
    default: (mod as any).default ?? mod,
  }))
);

// ── Types ──────────────────────────────────────────────────────────────────

export interface SurvivalTrace {
  name: string;
  time: number[];
  values: number[];
  sem?: number[];
  color?: string;
  pValues?: Array<{ timeIndex: number; value: number }>;
}

export interface PlotlyChartConfig {
  /** Chart mode: 'survival' | 'bar' | 'box' | 'heatmap' | 'waterfall' | 'forest' | 'volcano' | 'scatter' | 'auto' */
  mode: string;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  traces?: SurvivalTrace[];
  /** Raw chart_data from LLM — auto-detected */
  chartData?: any;
}

interface PlotlyInteractiveChartProps {
  config: PlotlyChartConfig;
  /** Per-result customization overrides from the Customize panel */
  customizations?: {
    xLabel?: string;
    yLabel?: string;
    chartTitle?: string;
    subtitle?: string;
    xAxisMin?: number | null;
    xAxisMax?: number | null;
    yAxisMin?: number | null;
    yAxisMax?: number | null;
    yAxisLog?: boolean;
    xAxisScale?: 'linear' | 'log';
    xAxisRotation?: number;
    xAxisStepSize?: number | null;
    yAxisStepSize?: number | null;
    showGrid?: boolean;
    bgColor?: string;
    gridColor?: string;
    gridStyle?: string;
    showChartBorder?: boolean;
    borderColor?: string;
    showMinorTicks?: boolean;
    customColors?: string[];
    legendPosition?: string;
    legendAnchor?: string;
    showLegendBorder?: boolean;
    legendBgColor?: string;
    legendFontSize?: number;
    showDataLabels?: boolean;
    showValues?: boolean;
    valuePosition?: string;
    valueFontSize?: number;
    strokeWidth?: number;
    markerSize?: number;
    barGap?: number;
    barBorderRadius?: number;
    fillOpacity?: number;
    showErrorBars?: boolean;
    errorBarType?: 'sd' | 'se' | 'ci95' | 'std';
    chartTheme?: string;
    seriesOverrides?: Array<{
      color?: string;
      lineStyle?: string;
      lineWidth?: number;
      markerShape?: string;
      markerSize?: number;
      name?: string;
      visible?: boolean;
    }>;
  };
  onPointClick?: (point: { x: number; y: number; trace: string; data?: any }) => void;
  onEditAction?: (action: string, context?: any) => void;
  /** Callback when user edits a label inline (title, subtitle, xLabel, yLabel) */
  onLabelEdit?: (field: 'chartTitle' | 'subtitle' | 'xLabel' | 'yLabel', value: string) => void;
  /** Raw dataset rows for local error bar computation — from currentDatasetStore */
  rawDataset?: { rows: Record<string, unknown>[]; columns: string[] } | null;
  /** Callback when validation detects a mismatch (e.g. error bars requested but missing) */
  onValidationWarning?: (message: string) => void;
  height?: number;
}

// ── Inline editable text component ────────────────────────────────────────

interface InlineEditableTextProps {
  value: string;
  onCommit: (newValue: string) => void;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
}

function InlineEditableText({ value, onCommit, style, className, placeholder }: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    } else {
      setDraft(value); // revert if empty or unchanged
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        style={{
          ...style,
          background: 'transparent',
          border: 'none',
          borderBottom: '1.5px solid #3b82f6',
          outline: 'none',
          width: '100%',
          padding: 0,
          margin: 0,
          fontFamily: 'inherit',
        }}
        className={className}
      />
    );
  }

  return (
    <span
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      style={{
        ...style,
        cursor: 'text',
        borderBottom: '1px solid transparent',
        transition: 'border-color 0.15s',
      }}
      className={className}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderBottomColor = '#cbd5e1'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderBottomColor = 'transparent'; }}
    >
      {value || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{placeholder ?? 'Double-click to edit'}</span>}
    </span>
  );
}

// ── Theme constants ────────────────────────────────────────────────────────

const TREATMENT_COLORS: Record<string, string> = {
  experimental: '#0F172A',
  treatment: '#0F172A',
  control: '#EC4899',
  placebo: '#EC4899',
  kinase: '#3b82f6',
  chemo: '#10b981',
  chemotherapy: '#10b981',
  combination: '#8b5cf6',
  immunotherapy: '#f59e0b',
};

const DEFAULT_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#64748b'];
/** KM/survival default: black for Experimental, pink for Control */
const KM_PALETTE = ['#0F172A', '#EC4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
/** Trendline default color for survival charts */
const KM_TRENDLINE_COLOR = '#D1D5DB';

// Publication-quality research palette (10 colors)
const RESEARCH_PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be185d', '#854d0e', '#4f46e5', '#059669'];

/** Adaptive legend/margin sizing based on series count and label length */
function calculateChartSizing(traces: any[], chartTitle?: string, yLabel?: string): {
  legend: Record<string, any>;
  margin: Record<string, number>;
} {
  const seriesCount = traces.length;
  // Shorten legend labels
  traces.forEach(t => {
    if (!t.name) return;
    let name = t.name.replace(/\s*\(\d+\s*records?\)/gi, '').replace(/[⚠△]/g, '').trim();
    const maxLen = seriesCount > 15 ? 12 : seriesCount > 8 ? 18 : seriesCount > 4 ? 22 : 30;
    if (name.length > maxLen) name = name.substring(0, maxLen - 1) + '…';
    t.name = name;
  });
  const longestLabel = Math.max(...traces.map(t => (t.name ?? '').length), 5);
  const legendWidth = Math.min(longestLabel, 22) * 7 + 50;

  let legend: Record<string, any>;
  let margin: Record<string, number>;

  if (seriesCount <= 4) {
    // Horizontal below chart — never overlaps data
    legend = { orientation: 'h', x: 0.5, y: -0.25, xanchor: 'center', yanchor: 'top', font: { size: 11, color: '#1a2332', family: 'Arial, sans-serif' }, bgcolor: 'rgba(0,0,0,0)', borderwidth: 0, itemwidth: 30, tracegroupgap: 15 };
    margin = { l: 80, r: 30, t: 80, b: 140 };
  } else if (seriesCount <= 8) {
    // Vertical OUTSIDE right — pushed past the plot area
    legend = { orientation: 'v', x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', font: { size: 10, color: '#1a2332', family: 'Arial, sans-serif' }, bgcolor: 'rgba(255,255,255,0.95)', bordercolor: '#e0e0e0', borderwidth: 1, itemwidth: 25, tracegroupgap: 3 };
    margin = { l: 80, r: Math.max(legendWidth + 20, 180), t: 80, b: 80 };
  } else {
    // Many series — compact vertical OUTSIDE right
    legend = { orientation: 'v', x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', font: { size: 9, color: '#1a2332', family: 'Arial, sans-serif' }, bgcolor: 'rgba(255,255,255,0.95)', bordercolor: '#e0e0e0', borderwidth: 1, itemwidth: 20, tracegroupgap: 1, itemsizing: 'constant' };
    margin = { l: 80, r: Math.max(legendWidth + 15, 180), t: 80, b: 80 };
  }
  if (yLabel && yLabel.length > 15) margin.l = 95;
  if (chartTitle && chartTitle.length > 60) margin.t = 100;
  return { legend, margin };
}

// Marker shapes per series index — Plotly symbol names
const MARKER_SHAPES: string[] = [
  'circle', 'square', 'triangle-up', 'diamond',
  'triangle-down', 'hexagon', 'star', 'cross',
  'pentagon', 'bowtie',
];

const LAYOUT_BASE: Partial<Plotly.Layout> = {
  paper_bgcolor: '#ffffff',
  plot_bgcolor: '#ffffff',
  font: { family: 'Arial, sans-serif', size: 12, color: '#1a2332' },
  margin: { l: 80, r: 30, t: 80, b: 140 },
  modebar: { orientation: 'h', bgcolor: 'transparent', color: '#8fa3b8', activecolor: '#2b7de9' } as any,
  showlegend: true,
  legend: {
    orientation: 'h' as const,
    x: 0.5,
    y: -0.25,
    xanchor: 'center' as const,
    yanchor: 'top' as const,
    bgcolor: 'rgba(0,0,0,0)',
    borderwidth: 0,
    font: { size: 11, color: '#1a2332', family: 'Arial, sans-serif' },
  },
  hovermode: 'closest' as const,
  hoverlabel: { bgcolor: '#1a2332', font: { color: '#ffffff', size: 12 } },
};

const GRID_STYLE: Record<string, any> = {
  linecolor: '#1a2332',
  linewidth: 1.5,
  mirror: true,
  ticks: 'outside',
  tickwidth: 1,
  ticklen: 5,
  tickcolor: '#1a2332',
  tickfont: { size: 11, color: '#333333' },
  showgrid: true,
  gridcolor: '#e8e8e8',
  gridwidth: 0.5,
  zeroline: false,
  showline: true,
  title: { font: { size: 13, color: '#1a2332' }, standoff: 15 },
};

const MINOR_TICKS: Record<string, any> = {
  minor: { showgrid: true, gridcolor: '#f0f0f0' },
};

// ── Title wrapping helper ─────────────────────────────────────────────────
// Plotly renders titles as SVG text — no auto-wrap. We insert <br> tags to
// wrap at ~55 chars per line (roughly the chart width at 14px), cap at 3
// lines, and truncate with ellipsis if needed.
const MAX_TITLE_LINE_CHARS = 55;
const MAX_TITLE_LINES = 3;

function wrapPlotlyTitle(raw: string): { text: string; lineCount: number } {
  if (!raw || raw.length <= MAX_TITLE_LINE_CHARS) return { text: raw, lineCount: 1 };

  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > MAX_TITLE_LINE_CHARS && current) {
      lines.push(current);
      current = word;
      if (lines.length >= MAX_TITLE_LINES) break;
    } else {
      current = test;
    }
  }

  if (lines.length >= MAX_TITLE_LINES) {
    // Truncate the last line with ellipsis
    const last = lines[MAX_TITLE_LINES - 1];
    if (current || last.length > MAX_TITLE_LINE_CHARS) {
      lines[MAX_TITLE_LINES - 1] = last.slice(0, MAX_TITLE_LINE_CHARS - 3).trimEnd() + '…';
    }
  } else if (current) {
    lines.push(current);
  }

  return { text: lines.join('<br>'), lineCount: lines.length };
}

/** Build a Plotly title config with proper wrapping, centering, and dynamic margin. */
function buildTitleConfig(
  rawTitle: string,
  baseFontSize = 14
): { title: Partial<Plotly.Layout['title']>; marginTop: number } {
  const { text, lineCount } = wrapPlotlyTitle(rawTitle);
  // Scale font down slightly for very long titles (>1 line)
  const fontSize = lineCount > 1 ? Math.max(12, baseFontSize - 1) : baseFontSize;
  // Increase top margin: base 70 for title room + 18px per extra line
  const marginTop = rawTitle ? 70 + (lineCount - 1) * 18 : 50;

  return {
    title: {
      text: `<b>${text}</b>`,
      font: { size: fontSize, color: '#1a2332', family: 'Arial, sans-serif' },
      x: 0.5,
      xanchor: 'center' as const,
      y: 0.98,
      yanchor: 'top' as const,
      pad: { t: 10 },
    },
    marginTop,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getTraceColor(name: string, index: number, isSurvival = false): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(TREATMENT_COLORS)) {
    if (lower.includes(key)) return color;
  }
  // Use KM palette (black/pink) for survival charts, default palette otherwise
  const palette = isSurvival ? KM_PALETTE : DEFAULT_PALETTE;
  return palette[index % palette.length];
}

// ── Survival / KM builder ────────────────────────────────────────────────

function buildSurvivalTraces(
  traces: SurvivalTrace[]
): { plotData: Plotly.Data[]; annotations: Partial<Plotly.Annotations>[] } {
  const plotData: Plotly.Data[] = [];
  const annotations: Partial<Plotly.Annotations>[] = [];

  traces.forEach((trace, i) => {
    const color = trace.color ?? getTraceColor(trace.name, i, true);
    const markerShape = MARKER_SHAPES[i % MARKER_SHAPES.length];

    plotData.push({
      x: trace.time,
      y: trace.values,
      mode: 'lines+markers',
      name: trace.name,
      line: { color, width: 2.5, shape: 'hv' },
      marker: { color, size: 7, symbol: markerShape },
      type: 'scatter',
      hovertemplate: `<b>${trace.name}</b><br>Time: %{x}<br>Value: %{y:.3f}<extra></extra>`,
    });

    if (trace.sem && trace.sem.length === trace.values.length) {
      const upper = trace.values.map((v, j) => v + (trace.sem![j] ?? 0));
      const lower = trace.values.map((v, j) => v - (trace.sem![j] ?? 0));

      plotData.push({
        x: [...trace.time, ...trace.time.slice().reverse()],
        y: [...upper, ...lower.slice().reverse()],
        fill: 'toself',
        fillcolor: color + '2E',
        line: { color: 'transparent' },
        showlegend: false,
        type: 'scatter',
        hoverinfo: 'skip',
      });
    }

    if (trace.pValues) {
      for (const pv of trace.pValues) {
        const idx = pv.timeIndex;
        if (idx < trace.time.length) {
          const stars =
            pv.value < 0.001 ? '***' : pv.value < 0.01 ? '**' : pv.value < 0.05 ? '*' : '';
          if (stars) {
            annotations.push({
              x: trace.time[idx],
              y: trace.values[idx] + (trace.sem?.[idx] ?? 0) + 2,
              text: `<b>${stars}</b>`,
              showarrow: false,
              font: { size: 14, color },
              xanchor: 'center',
              yanchor: 'bottom',
            });
          }
        }
      }
    }
  });

  return { plotData, annotations };
}

// ── Box plot builder ─────────────────────────────────────────────────────

function buildBoxPlotTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];
  const labels = chartData.labels ?? [];

  const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => ({
    y: ds.data ?? [],
    name: ds.label ?? labels[i] ?? `Group ${i + 1}`,
    type: 'box' as const,
    marker: { color: ds.color ?? ds.borderColor ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] },
    boxpoints: 'outliers' as const,
    jitter: 0.3,
    pointpos: -1.5,
    hovertemplate: `<b>${ds.label ?? `Group ${i + 1}`}</b><br>%{y:.2f}<extra></extra>`,
  }));

  return {
    plotData,
    layout: {
      xaxis: { title: { text: chartData.x_axis ?? chartData.xLabel ?? 'Group' }, ...GRID_STYLE },
      yaxis: { title: { text: chartData.y_axis ?? chartData.yLabel ?? 'Value' }, ...GRID_STYLE },
      boxmode: 'group' as const,
    },
  };
}

// ── Violin plot builder ──────────────────────────────────────────────────

function buildViolinTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];
  const labels = chartData.labels ?? [];

  const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => ({
    y: ds.data ?? [],
    name: ds.label ?? labels[i] ?? `Group ${i + 1}`,
    type: 'violin' as const,
    box: { visible: true },
    meanline: { visible: true },
    points: 'outliers' as const,
    jitter: 0.3,
    pointpos: -1.5,
    marker: { size: 4, opacity: 0.6, color: ds.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] },
    line: { color: ds.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] },
    fillcolor: (ds.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]) + '40',
    side: 'both' as const,
    hovertemplate: `<b>${ds.label ?? `Group ${i + 1}`}</b><br>%{y:.2f}<extra></extra>`,
  }));

  return {
    plotData,
    layout: {
      xaxis: { title: { text: chartData.x_axis ?? chartData.xLabel ?? 'Group' }, ...GRID_STYLE },
      yaxis: { title: { text: chartData.y_axis ?? chartData.yLabel ?? 'Value' }, ...GRID_STYLE },
    },
  };
}

// ── Dot plot / strip chart builder ──────────────────────────────────────

function buildDotPlotTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];

  const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => {
    const values = ds.data ?? [];
    const groupLabel = ds.label ?? `Group ${i + 1}`;
    // Add jitter to x-position to avoid overlapping points
    const jitteredX = values.map(() => i + (Math.random() - 0.5) * 0.3);

    return {
      type: 'scatter' as const,
      mode: 'markers' as const,
      y: values,
      x: jitteredX,
      name: groupLabel,
      marker: {
        size: 8,
        color: ds.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
        opacity: 0.7,
        line: { width: 1, color: '#333' },
      },
      hovertemplate: `<b>${groupLabel}</b><br>%{y:.2f}<extra></extra>`,
    };
  });

  return {
    plotData,
    layout: {
      xaxis: {
        title: { text: chartData.x_axis ?? chartData.xLabel ?? 'Group' },
        tickvals: datasets.map((_: any, i: number) => i),
        ticktext: datasets.map((ds: any, i: number) => ds.label ?? `Group ${i + 1}`),
        ...GRID_STYLE,
      },
      yaxis: { title: { text: chartData.y_axis ?? chartData.yLabel ?? 'Value' }, ...GRID_STYLE },
    },
  };
}

// ── Dose-response curve builder ─────────────────────────────────────────

function buildDoseResponseTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];
  const plotData: Plotly.Data[] = [];

  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    const color = ds.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

    // Raw data points
    if (ds.data && Array.isArray(ds.data)) {
      const xVals = ds.data.map((p: any) => typeof p === 'object' ? p.x : undefined).filter((v: any) => v != null);
      const yVals = ds.data.map((p: any) => typeof p === 'object' ? p.y : undefined).filter((v: any) => v != null);

      if (xVals.length > 0) {
        plotData.push({
          type: 'scatter' as const,
          mode: 'markers' as const,
          x: xVals,
          y: yVals,
          name: ds.label ?? 'Data',
          marker: { size: 8, color, symbol: 'circle' },
          showlegend: true,
        });
      }
    }

    // Fitted curve (if provided)
    if (ds.fitted_x && ds.fitted_y) {
      plotData.push({
        type: 'scatter' as const,
        mode: 'lines' as const,
        x: ds.fitted_x,
        y: ds.fitted_y,
        name: `${ds.label ?? 'Fit'} (fitted)`,
        line: { color, width: 2 },
        showlegend: true,
      });
    }

    // Confidence band (if provided)
    if (ds.fitted_x && ds.ci_upper && ds.ci_lower) {
      plotData.push({
        x: [...ds.fitted_x, ...ds.fitted_x.slice().reverse()],
        y: [...ds.ci_upper, ...ds.ci_lower.slice().reverse()],
        fill: 'toself' as const,
        fillcolor: color + '20',
        line: { color: 'transparent' },
        showlegend: false,
        type: 'scatter' as const,
        hoverinfo: 'skip' as const,
      });
    }
  }

  // EC50 annotation
  if (chartData.ec50) {
    plotData.push({
      type: 'scatter' as const,
      mode: 'markers' as const,
      x: [chartData.ec50.x ?? chartData.ec50.dose],
      y: [chartData.ec50.y ?? chartData.ec50.response],
      name: `EC50 = ${chartData.ec50.value ?? chartData.ec50.x}`,
      marker: { size: 12, color: '#ef4444', symbol: 'x' },
      showlegend: true,
    });
  }

  return {
    plotData,
    layout: {
      xaxis: {
        title: { text: chartData.x_axis ?? 'Dose' },
        type: chartData.x_scale === 'log' ? 'log' : 'linear',
        ...GRID_STYLE,
      },
      yaxis: { title: { text: chartData.y_axis ?? 'Response (%)' }, ...GRID_STYLE },
    },
  };
}

// ── ROC curve builder ───────────────────────────────────────────────────

function buildROCTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];
  const plotData: Plotly.Data[] = [];

  // Diagonal reference line (random classifier)
  plotData.push({
    type: 'scatter' as const,
    mode: 'lines' as const,
    x: [0, 1],
    y: [0, 1],
    name: 'Random (AUC = 0.5)',
    line: { color: '#94a3b8', width: 1, dash: 'dash' },
    showlegend: true,
  });

  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    const color = ds.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
    const fpr = ds.fpr ?? ds.data?.map((p: any) => p.x) ?? [];
    const tpr = ds.tpr ?? ds.data?.map((p: any) => p.y) ?? [];
    const auc = ds.auc ?? ds.area_under_curve;
    const label = `${ds.label ?? 'Model'}${auc ? ` (AUC = ${typeof auc === 'number' ? auc.toFixed(3) : auc})` : ''}`;

    plotData.push({
      type: 'scatter' as const,
      mode: 'lines' as const,
      x: fpr,
      y: tpr,
      name: label,
      line: { color, width: 2.5 },
      fill: chartData.show_auc_fill ? 'tozeroy' as const : undefined,
      fillcolor: chartData.show_auc_fill ? color + '15' : undefined,
    });

    // Optimal threshold point
    if (ds.optimal_threshold) {
      plotData.push({
        type: 'scatter' as const,
        mode: 'markers' as const,
        x: [ds.optimal_threshold.fpr],
        y: [ds.optimal_threshold.tpr],
        name: `Optimal (threshold = ${ds.optimal_threshold.value?.toFixed(3) ?? '?'})`,
        marker: { size: 10, color, symbol: 'star' },
      });
    }
  }

  return {
    plotData,
    layout: {
      xaxis: { title: { text: 'False Positive Rate (1 - Specificity)' }, range: [0, 1], ...GRID_STYLE },
      yaxis: { title: { text: 'True Positive Rate (Sensitivity)' }, range: [0, 1.05], ...GRID_STYLE },
    },
  };
}

// ── Bland-Altman plot builder ───────────────────────────────────────────

function buildBlandAltmanTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const ds = chartData.datasets?.[0] ?? chartData;
  const means = ds.means ?? ds.data?.map((p: any) => p.x) ?? [];
  const diffs = ds.differences ?? ds.data?.map((p: any) => p.y) ?? [];
  const meanDiff = ds.mean_diff ?? ds.bias ?? 0;
  const upperLoA = ds.upper_loa ?? ds.upper_limit ?? 0;
  const lowerLoA = ds.lower_loa ?? ds.lower_limit ?? 0;

  const plotData: Plotly.Data[] = [
    // Scatter points
    {
      type: 'scatter' as const,
      mode: 'markers' as const,
      x: means,
      y: diffs,
      name: 'Observations',
      marker: { size: 7, color: '#3b82f6', opacity: 0.7 },
      hovertemplate: 'Mean: %{x:.2f}<br>Diff: %{y:.2f}<extra></extra>',
    },
  ];

  const shapes: any[] = [
    // Mean difference (bias) line
    { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: meanDiff, y1: meanDiff,
      line: { color: '#0f172a', width: 2 } },
    // Upper LoA
    { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: upperLoA, y1: upperLoA,
      line: { color: '#ef4444', width: 1.5, dash: 'dash' } },
    // Lower LoA
    { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: lowerLoA, y1: lowerLoA,
      line: { color: '#ef4444', width: 1.5, dash: 'dash' } },
  ];

  const annotations: any[] = [
    { x: 1.02, y: meanDiff, xref: 'paper', yref: 'y', text: `Bias: ${meanDiff.toFixed(2)}`,
      showarrow: false, font: { size: 9, color: '#0f172a' }, xanchor: 'left' },
    { x: 1.02, y: upperLoA, xref: 'paper', yref: 'y', text: `+1.96 SD: ${upperLoA.toFixed(2)}`,
      showarrow: false, font: { size: 9, color: '#ef4444' }, xanchor: 'left' },
    { x: 1.02, y: lowerLoA, xref: 'paper', yref: 'y', text: `−1.96 SD: ${lowerLoA.toFixed(2)}`,
      showarrow: false, font: { size: 9, color: '#ef4444' }, xanchor: 'left' },
  ];

  return {
    plotData,
    layout: {
      xaxis: { title: { text: chartData.x_axis ?? 'Mean of Two Methods' }, ...GRID_STYLE },
      yaxis: { title: { text: chartData.y_axis ?? 'Difference Between Methods' }, ...GRID_STYLE },
      shapes,
      annotations,
      margin: { ...LAYOUT_BASE.margin, r: 100 },
    },
  };
}

// ── Before-After / Paired line plot builder ──────────────────────────────

function buildPairedLineTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];
  const plotData: Plotly.Data[] = [];

  if (datasets.length >= 2) {
    const beforeDs = datasets[0];
    const afterDs = datasets[1];
    const beforeVals = beforeDs.data ?? [];
    const afterVals = afterDs.data ?? [];
    const n = Math.min(beforeVals.length, afterVals.length);
    const beforeLabel = beforeDs.label ?? 'Before';
    const afterLabel = afterDs.label ?? 'After';

    // Individual subject lines
    for (let i = 0; i < n; i++) {
      const increased = afterVals[i] > beforeVals[i];
      plotData.push({
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        x: [0, 1],
        y: [beforeVals[i], afterVals[i]],
        marker: { size: 6, color: increased ? '#ef4444' : '#3b82f6' },
        line: { width: 1, color: increased ? '#ef4444' : '#3b82f6' },
        showlegend: false,
        hovertemplate: `Subject ${i + 1}<br>${beforeLabel}: ${beforeVals[i]}<br>${afterLabel}: ${afterVals[i]}<extra></extra>`,
      });
    }

    // Mean markers
    const meanBefore = beforeVals.reduce((a: number, b: number) => a + b, 0) / n;
    const meanAfter = afterVals.reduce((a: number, b: number) => a + b, 0) / n;
    plotData.push({
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      x: [0, 1],
      y: [meanBefore, meanAfter],
      name: 'Mean',
      marker: { size: 14, color: '#0f172a', symbol: 'diamond' },
      line: { width: 3, color: '#0f172a' },
    });
  } else if (datasets.length === 1 && datasets[0].pairs) {
    // Alternative: pairs format [{before: x, after: y}, ...]
    const pairs = datasets[0].pairs;
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i];
      const increased = p.after > p.before;
      plotData.push({
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        x: [0, 1],
        y: [p.before, p.after],
        marker: { size: 6, color: increased ? '#ef4444' : '#3b82f6' },
        line: { width: 1, color: increased ? '#ef4444' : '#3b82f6' },
        showlegend: false,
      });
    }
  }

  const labels = chartData.labels ?? ['Before', 'After'];
  return {
    plotData,
    layout: {
      xaxis: {
        title: { text: chartData.x_axis ?? '' },
        tickvals: [0, 1],
        ticktext: [labels[0] ?? 'Before', labels[1] ?? 'After'],
        range: [-0.3, 1.3],
        ...GRID_STYLE,
      },
      yaxis: { title: { text: chartData.y_axis ?? chartData.yLabel ?? 'Value' }, ...GRID_STYLE },
    },
  };
}

// ── Heatmap builder ──────────────────────────────────────────────────────

function buildHeatmapTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];

  // If z-matrix provided directly
  if (chartData.z) {
    const plotData: Plotly.Data[] = [{
      z: chartData.z,
      x: chartData.x ?? chartData.labels ?? undefined,
      y: chartData.y ?? undefined,
      type: 'heatmap' as const,
      colorscale: chartData.colorscale ?? 'RdBu',
      reversescale: true,
      zmin: chartData.zmin ?? -1,
      zmax: chartData.zmax ?? 1,
      showscale: true,
      hovertemplate: '%{x} / %{y}<br>Value: %{z:.2f}<extra></extra>',
    }];
    return {
      plotData,
      layout: {
        margin: { t: 48, r: 30, b: 80, l: 80 },
      },
    };
  }

  // Build z-matrix from datasets (each dataset is a row)
  if (datasets.length > 0) {
    const z = datasets.map((ds: any) => ds.data ?? []);
    const xLabels = chartData.labels ?? datasets[0]?.data?.map((_: any, j: number) => `Col ${j + 1}`) ?? [];
    const yLabels = datasets.map((ds: any, i: number) => ds.label ?? `Row ${i + 1}`);

    const plotData: Plotly.Data[] = [{
      z,
      x: xLabels,
      y: yLabels,
      type: 'heatmap' as const,
      colorscale: 'RdBu',
      reversescale: true,
      showscale: true,
      hovertemplate: '%{x} / %{y}<br>Value: %{z:.2f}<extra></extra>',
    }];
    return {
      plotData,
      layout: {
        margin: { t: 48, r: 30, b: 80, l: 80 },
      },
    };
  }

  return { plotData: [], layout: {} };
}

// ── Waterfall builder ────────────────────────────────────────────────────

function buildWaterfallTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];
  const labels = chartData.labels ?? [];
  const data = datasets[0]?.data ?? [];

  const plotData: Plotly.Data[] = [{
    type: 'bar' as const,
    x: labels,
    y: data,
    marker: {
      color: data.map((v: number) =>
        v < -30 ? '#10b981' : v < 0 ? '#3b82f6' : '#ef4444'
      ),
      line: { color: 'white', width: 0.5 },
    },
    hovertemplate: '<b>%{x}</b><br>Change: %{y}%<extra></extra>',
  }];

  return {
    plotData,
    layout: {
      xaxis: {
        title: { text: chartData.x_axis ?? chartData.xLabel ?? 'Patient' },
        ...GRID_STYLE,
      },
      yaxis: {
        title: { text: chartData.y_axis ?? chartData.yLabel ?? 'Best % Change from Baseline' },
        ...GRID_STYLE,
        zeroline: true,
        zerolinecolor: '#374151',
        zerolinewidth: 1.5,
      },
      shapes: [
        { type: 'line' as const, x0: -0.5, x1: labels.length - 0.5, y0: -30, y1: -30, line: { color: '#10b981', dash: 'dot' as const, width: 1.5 } },
        { type: 'line' as const, x0: -0.5, x1: labels.length - 0.5, y0: 20, y1: 20, line: { color: '#ef4444', dash: 'dot' as const, width: 1.5 } },
      ],
    },
  };
}

// ── Forest plot builder ──────────────────────────────────────────────────

function buildForestPlotTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];
  const labels = chartData.labels ?? [];

  // Expect datasets with: data (point estimates), ci_lower, ci_upper
  const ds = datasets[0] ?? {};
  const estimates = ds.data ?? [];
  const ciLower = ds.ci_lower ?? ds.lower ?? estimates.map((v: number) => v * 0.8);
  const ciUpper = ds.ci_upper ?? ds.upper ?? estimates.map((v: number) => v * 1.2);
  const isPooled = labels.map((l: string) =>
    l.toLowerCase().includes('pooled') || l.toLowerCase().includes('overall')
  );

  const plotData: Plotly.Data[] = [
    {
      x: estimates,
      y: labels,
      error_x: {
        type: 'data' as const,
        symmetric: false,
        array: ciUpper.map((u: number, i: number) => u - estimates[i]),
        arrayminus: estimates.map((h: number, i: number) => h - ciLower[i]),
        color: '#3b82f6',
        thickness: 2,
        width: 8,
      },
      mode: 'markers' as const,
      marker: {
        color: isPooled.map((p: boolean) => p ? '#ef4444' : '#3b82f6'),
        size: isPooled.map((p: boolean) => p ? 16 : 10),
        symbol: isPooled.map((p: boolean) => p ? 'diamond' : 'square'),
      },
      type: 'scatter' as const,
      orientation: 'h' as const,
      hovertemplate: '<b>%{y}</b><br>HR: %{x:.2f}<extra></extra>',
    },
    // Reference line at x=1
    ...(labels.length > 0 ? [{
      x: [1, 1],
      y: [labels[0], labels[labels.length - 1]],
      mode: 'lines' as const,
      line: { color: '#9ca3af', dash: 'dot' as const, width: 1.5 },
      showlegend: false,
      type: 'scatter' as const,
    }] : []),
  ];

  return {
    plotData,
    layout: {
      xaxis: {
        title: { text: chartData.x_axis ?? 'Hazard Ratio (95% CI)' },
        type: 'log' as const,
        range: [Math.log10(0.25), Math.log10(2)],
        ...GRID_STYLE,
      },
      yaxis: { autorange: 'reversed' as const, ...GRID_STYLE },
      margin: { t: 48, r: 120, b: 56, l: 150 },
    },
  };
}

// ── Volcano plot builder ─────────────────────────────────────────────────

function buildVolcanoTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];
  const ds = datasets[0] ?? {};

  // Expect: x = log2FC values, y = -log10(p) values, or data with {x, y} objects
  let logFC: number[] = [];
  let negLogP: number[] = [];

  if (ds.data && Array.isArray(ds.data) && ds.data.length > 0 && typeof ds.data[0] === 'object') {
    logFC = ds.data.map((d: any) => d.x ?? 0);
    negLogP = ds.data.map((d: any) => d.y ?? 0);
  } else {
    logFC = chartData.labels?.map((l: any) => parseFloat(l) || 0) ?? [];
    negLogP = ds.data ?? [];
  }

  const sig = logFC.map((fc: number, i: number) => Math.abs(fc) > 2 && (negLogP[i] ?? 0) > -Math.log10(0.05));

  const plotData: Plotly.Data[] = [{
    x: logFC,
    y: negLogP,
    mode: 'markers' as const,
    type: 'scatter' as const,
    marker: {
      color: sig.map((s, i) => s ? (logFC[i] > 0 ? '#3b82f6' : '#ef4444') : '#d1d5db'),
      size: 5,
      opacity: 0.8,
    },
    hovertemplate: 'log2FC: %{x:.2f}<br>-log10(p): %{y:.2f}<extra></extra>',
  }];

  return {
    plotData,
    layout: {
      xaxis: {
        title: { text: chartData.x_axis ?? 'log\u2082 Fold Change' },
        ...GRID_STYLE,
        zeroline: true,
      },
      yaxis: {
        title: { text: chartData.y_axis ?? '\u2212log\u2081\u2080(p-value)' },
        ...GRID_STYLE,
      },
      shapes: [
        { type: 'line' as const, x0: 2, x1: 2, y0: 0, y1: 30, line: { color: '#9ca3af', dash: 'dot' as const, width: 1 } },
        { type: 'line' as const, x0: -2, x1: -2, y0: 0, y1: 30, line: { color: '#9ca3af', dash: 'dot' as const, width: 1 } },
        { type: 'line' as const, x0: -5, x1: 5, y0: -Math.log10(0.05), y1: -Math.log10(0.05), line: { color: '#9ca3af', dash: 'dot' as const, width: 1 } },
      ],
    },
  };
}

// ── Scatter builder ──────────────────────────────────────────────────────

function buildScatterTraces(
  chartData: any
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const datasets = chartData.datasets ?? [];

  // Also handle series format: { series: [{ name, x: [...], y: [...] }] }
  const seriesArr = chartData.series ?? [];

  // Also handle data-array format: { data: [{ species: "Owl", mean: 58.5 }, ...] }
  const dataArr = chartData.data ?? [];

  let plotData: Plotly.Data[] = [];
  let isCategorical = false;

  if (datasets.length > 0) {
    plotData = datasets.map((ds: any, i: number) => {
      let xVals: any[] = [];
      let yVals: number[] = [];

      if (ds.data && Array.isArray(ds.data) && ds.data.length > 0 && typeof ds.data[0] === 'object') {
        xVals = ds.data.map((d: any) => d.x ?? 0);
        yVals = ds.data.map((d: any) => d.y ?? 0);
      } else {
        // Preserve labels as-is (strings for categorical, numbers for numeric)
        xVals = chartData.labels ?? [];
        yVals = ds.data ?? [];
      }

      if (xVals.length > 0 && typeof xVals[0] === 'string') isCategorical = true;

      const seriesName = ds.label ?? `Series ${i + 1}`;
      return {
        x: xVals,
        y: yVals,
        mode: 'markers' as const,
        name: seriesName,
        type: 'scatter' as const,
        marker: {
          color: ds.color ?? ds.borderColor ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
          size: resolveMarkerSize(chartData, seriesName),
          symbol: resolveMarkerShape(chartData, seriesName, i),
          opacity: 0.75,
          line: { color: 'white', width: 0.5 },
        },
        error_y: resolveErrorBars(ds, chartData, seriesName),
        hovertemplate: isCategorical
          ? `<b>${seriesName}</b><br>%{x}<br>y: %{y:.2f}<extra></extra>`
          : `<b>${seriesName}</b><br>x: %{x:.2f}<br>y: %{y:.2f}<extra></extra>`,
      };
    });
  } else if (seriesArr.length > 0) {
    // Series format: [{ name, x: [...], y: [...], error_y: [...] }]
    plotData = seriesArr.map((s: any, i: number) => {
      const xVals = s.x ?? s.data?.map((d: any) => d.x) ?? [];
      const yVals = s.y ?? s.data?.map((d: any) => d.y) ?? [];
      if (xVals.length > 0 && typeof xVals[0] === 'string') isCategorical = true;
      const seriesName = s.name ?? s.label ?? `Series ${i + 1}`;
      return {
        x: xVals,
        y: yVals,
        mode: 'markers' as const,
        name: seriesName,
        type: 'scatter' as const,
        marker: {
          color: s.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
          size: resolveMarkerSize(chartData, seriesName),
          symbol: resolveMarkerShape(chartData, seriesName, i),
          opacity: 0.75,
          line: { color: 'white', width: 0.5 },
        },
        error_y: s.error_y ? { type: 'data' as const, array: Array.isArray(s.error_y) ? s.error_y : s.error_y.array, visible: true, color: '#64748b' } : undefined,
      };
    });
  } else if (dataArr.length > 0 && typeof dataArr[0] === 'object') {
    // Data-array format: [{ species: "Owl", mean: 58.5, ci_lower: 55.3, ci_upper: 61.7 }, ...]
    const keys = Object.keys(dataArr[0]);
    const xKey = chartData.x_column ?? keys.find((k: string) =>
      /species|group|treatment|category|name|label|arm|dose|time|visit|subject/i.test(k)
    ) ?? keys[0];
    const errorKeys = new Set(keys.filter((k: string) => /ci_lower|ci_upper|lower|upper|error|sd|sem|se\b/i.test(k)));
    const yKeys = keys.filter((k: string) => k !== xKey && !errorKeys.has(k) && typeof dataArr[0][k] === 'number');
    const ciLowerKey = keys.find((k: string) => /ci_lower|lower_ci|lower_bound|lower/i.test(k));
    const ciUpperKey = keys.find((k: string) => /ci_upper|upper_ci|upper_bound|upper/i.test(k));
    isCategorical = typeof dataArr[0][xKey] === 'string';
    plotData = yKeys.map((yKey: string, i: number) => {
      const yVals = dataArr.map((d: any) => d[yKey]);
      const trace: any = {
        x: dataArr.map((d: any) => d[xKey]),
        y: yVals,
        mode: 'markers' as const,
        name: yKey,
        type: 'scatter' as const,
        marker: {
          color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
          size: 8,
          opacity: 0.75,
          line: { color: 'white', width: 0.5 },
        },
        hovertemplate: isCategorical
          ? `<b>${yKey}</b><br>%{x}<br>y: %{y:.2f}<extra></extra>`
          : `<b>${yKey}</b><br>x: %{x:.2f}<br>y: %{y:.2f}<extra></extra>`,
      };
      // Asymmetric CI error bars
      if (ciLowerKey && ciUpperKey) {
        trace.error_y = {
          type: 'data' as const,
          symmetric: false,
          array: yVals.map((y: number, j: number) => (dataArr[j][ciUpperKey] ?? y) - y),
          arrayminus: yVals.map((y: number, j: number) => y - (dataArr[j][ciLowerKey] ?? y)),
          visible: true,
          color: '#64748b',
          thickness: 2,
          width: 6,
        };
      }
      return trace;
    });
  }

  const xAxisConfig: any = {
    title: { text: chartData.x_axis ?? chartData.xLabel ?? chartData.x_label ?? 'X' },
    ...GRID_STYLE,
  };
  if (isCategorical) {
    xAxisConfig.type = 'category';
    const firstXVals = (plotData[0] as any)?.x;
    if (firstXVals && Array.isArray(firstXVals)) {
      xAxisConfig.categoryorder = 'array';
      xAxisConfig.categoryarray = firstXVals;
    }
  }

  return {
    plotData,
    layout: {
      xaxis: xAxisConfig,
      yaxis: { title: { text: chartData.y_axis ?? chartData.yLabel ?? chartData.y_label ?? 'Y' }, ...GRID_STYLE },
    },
  };
}

// ── Detection ────────────────────────────────────────────────────────────

/** Known pharma_type values that trigger Plotly rendering */
const PLOTLY_PHARMA_TYPES = new Set([
  'survival', 'km', 'kaplan-meier',
  'box', 'boxplot', 'box_chart',
  'heatmap', 'heatmap_chart',
  'waterfall', 'waterfall_chart',
  'forest', 'forest_chart',
  'volcano', 'volcano_chart',
  'violin', 'violin_chart',
  'dot', 'dot_plot', 'strip', 'strip_chart',
  'dose_response', 'dose-response',
  'roc', 'roc_curve',
  'bland_altman', 'bland-altman',
  'paired', 'before_after', 'paired_line',
]);

/** Auto-detect if LLM chart_data should render via Plotly instead of Recharts */
export function isSurvivalChartData(chartData: any): boolean {
  return isPlotlyChartData(chartData);
}

export function isPlotlyChartData(chartData: any, customizations?: { showErrorBars?: boolean }): boolean {
  if (!chartData) return false;

  // Route to Plotly when error bars are requested — Recharts ChartRenderer
  // does not support error bar computation; only PlotlyInteractiveChart does.
  if (chartData.show_error_bars === true || customizations?.showErrorBars === true) return true;

  // Check explicit pharma_type
  if (chartData.pharma_type && PLOTLY_PHARMA_TYPES.has(chartData.pharma_type)) return true;

  // Check chart_mode
  if (chartData.chart_mode === 'survival' || chartData.chart_mode === 'plotly') return true;

  // Check type field for advanced types
  const chartType = (chartData.type ?? '').toLowerCase();
  if (['kaplan-meier', 'box', 'boxplot', 'heatmap', 'waterfall', 'forest', 'volcano'].includes(chartType)) {
    return true;
  }

  // Check for survival-like keywords in labels/dataset names
  const labels = chartData.labels ?? [];
  const datasetLabels = (chartData.datasets ?? []).map((d: any) => (d.label ?? '').toLowerCase());
  const allLabels = [...labels.map((l: any) => String(l).toLowerCase()), ...datasetLabels];

  const survivalKeywords = ['pfs', 'os', 'survival', 'km', 'kaplan', 'meier', 'time_months', 'mean_pfs'];
  return allLabels.some((l: string) => survivalKeywords.some((kw) => l.includes(kw)));
}

/** Convert LLM chart_data to SurvivalTrace[] */
function chartDataToSurvivalTraces(chartData: any): SurvivalTrace[] | null {
  if (!chartData?.datasets || !chartData?.labels) return null;

  return chartData.datasets.map((ds: any, i: number) => ({
    name: ds.label ?? `Series ${i + 1}`,
    time: chartData.labels.map((l: any) => (typeof l === 'number' ? l : parseFloat(l) || i)),
    values: ds.data ?? [],
    sem: ds.sem ?? ds.error ?? ds.errorBars ?? undefined,
    color: ds.color ?? ds.borderColor ?? undefined,
    pValues: ds.pValues ?? undefined,
  }));
}

/** Helper: coerce an error bar value into a flat numeric array.
 *  Handles: plain array [3.2, 5.1], Plotly object { type: 'data', array: [...] },
 *  single number (broadcast to dataLength), or null/undefined → null. */
function coerceErrorArray(val: any, dataLength: number): number[] | null {
  if (val == null) return null;
  // Already a flat number array
  if (Array.isArray(val) && val.length > 0 && val.every((v: any) => typeof v === 'number' || !isNaN(Number(v)))) {
    return val.map(Number);
  }
  // Plotly-format object: { type: 'data', array: [...] }
  if (typeof val === 'object' && !Array.isArray(val) && val.array && Array.isArray(val.array)) {
    return val.array.map(Number);
  }
  // Single number → broadcast to all data points
  if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) {
    return Array(dataLength).fill(Number(val));
  }
  return null;
}

/** Resolve error bar data from dataset or chart-level error_bars array */
function resolveErrorBars(ds: any, chartData: any, seriesName: string): any {
  try {
    const dataLength = Array.isArray(ds?.data) ? ds.data.length : 0;
    const mkResult = (arr: number[], opts: any = {}) => ({
      type: 'data' as const,
      visible: true,
      color: ds?.color ?? '#64748b',
      thickness: 2,
      width: 6,
      ...opts,
      array: arr,
    });

    // ── Level 1: Dataset-level asymmetric CI bounds ──
    const ciLower = ds?._ci_lower ?? ds?.ci_lower ?? ds?.CI_Lower ?? ds?.CI_lower;
    const ciUpper = ds?._ci_upper ?? ds?.ci_upper ?? ds?.CI_Upper ?? ds?.CI_upper;
    const ciLArr = coerceErrorArray(ciLower, dataLength);
    const ciUArr = coerceErrorArray(ciUpper, dataLength);
    if (ciLArr && ciUArr && ds?.data) {
      const yVals = ds.data;
      return mkResult(
        yVals.map((y: number, i: number) => (ciUArr[i] ?? y) - y),
        {
          symmetric: false,
          arrayminus: yVals.map((y: number, i: number) => y - (ciLArr[i] ?? y)),
        }
      );
    }

    // ── Level 2: Dataset-level symmetric error bars (case-insensitive key search) ──
    // Check all common property names including case variants
    const errRaw = ds?.error_y ?? ds?.Error_Y ?? ds?.errorY
      ?? ds?.sem ?? ds?.SEM ?? ds?.Sem
      ?? ds?.error ?? ds?.Error
      ?? ds?.errorBars ?? ds?.error_bars
      ?? ds?.sd ?? ds?.SD ?? ds?.Sd ?? ds?.std_dev ?? ds?.StdDev ?? ds?.stdev;
    const errArr = coerceErrorArray(errRaw, dataLength);
    if (errArr && errArr.length > 0) {
      console.log(`[resolveErrorBars] ✓ Found dataset-level error bars for "${seriesName}": ${errArr.length} values`);
      return mkResult(errArr);
    }

    // ── Level 3: Chart-level ci_lower/ci_upper arrays ──
    const chartCiL = coerceErrorArray(chartData?.ci_lower ?? chartData?.CI_Lower, dataLength);
    const chartCiU = coerceErrorArray(chartData?.ci_upper ?? chartData?.CI_Upper, dataLength);
    if (chartCiL && chartCiU && ds?.data) {
      const yVals = ds.data;
      return mkResult(
        yVals.map((y: number, i: number) => (chartCiU[i] ?? y) - y),
        {
          symmetric: false,
          arrayminus: yVals.map((y: number, i: number) => y - (chartCiL[i] ?? y)),
        }
      );
    }

    // ── Level 4: Chart-level error_y (symmetric, top-level) ──
    const chartErr = coerceErrorArray(chartData?.error_y ?? chartData?.Error_Y ?? chartData?.SD ?? chartData?.sd, dataLength);
    if (chartErr && chartErr.length > 0) {
      return mkResult(chartErr);
    }

    // ── Level 5: Chart-level error_bars array (named series) ──
    if (chartData?.error_bars && Array.isArray(chartData.error_bars)) {
      const match = chartData.error_bars.find((eb: any) =>
        eb?.series === seriesName || eb?.name === seriesName || eb?.label === seriesName
      );
      const matchArr = coerceErrorArray(match?.values ?? match?.array ?? match?.data, dataLength);
      if (matchArr) return mkResult(matchArr);

      // Fallback: if only one error_bars entry and one dataset, use it
      if (chartData.error_bars.length === 1) {
        const singleArr = coerceErrorArray(
          chartData.error_bars[0]?.values ?? chartData.error_bars[0]?.array ?? chartData.error_bars[0]?.data,
          dataLength
        );
        if (singleArr) return mkResult(singleArr);
      }
    }

    // ── Level 6: Datasets have upperBound/lowerBound (PK-style) ──
    const ub = coerceErrorArray(ds?.upperBound ?? ds?.upper_bound ?? ds?.Upper, dataLength);
    const lb = coerceErrorArray(ds?.lowerBound ?? ds?.lower_bound ?? ds?.Lower, dataLength);
    if (ub && lb && ds?.data) {
      const yVals = ds.data;
      return mkResult(
        yVals.map((y: number, i: number) => (ub[i] ?? y) - y),
        {
          symmetric: false,
          arrayminus: yVals.map((y: number, i: number) => y - (lb[i] ?? y)),
        }
      );
    }

    // Level 7: No approximation fallback — local computation handles error bars
    // when showErrorBars toggle is enabled in the customization panel.
    // The 10% approximation was removed because it produced misleading error bars.

    // If we got here with no match, log for debugging
    if (ds?.error_y || ds?.sd || ds?.SD || ds?.sem || ds?.SEM || chartData?.error_y || chartData?.error_bars) {
      console.warn('[resolveErrorBars] Error bar data was present but could not be coerced:', {
        dsErrorY: typeof ds?.error_y, dsSd: typeof ds?.sd, dsSD: typeof ds?.SD,
        chartErrorY: typeof chartData?.error_y, chartErrorBars: typeof chartData?.error_bars,
      });
    }
  } catch (e) {
    console.error('[resolveErrorBars] Unexpected error:', e);
  }
  return undefined;
}

// ── Compute error bars from raw dataset ──────────────────────────────────────
// Instead of relying on the AI to return error_y, compute SD/SE/CI directly
// from the raw uploaded data. The chart's x-axis labels are used as group keys.

interface ComputedErrorBars {
  /** One error value per x-axis label, in the same order */
  array: number[];
  type: 'sd' | 'se' | 'ci95';
}

/** t-critical value at alpha/2 = 0.025 (two-tailed 95% CI) for given df.
 *  Uses lookup table for common small-sample df; falls back to 1.96 for df >= 120. */
function tCritical025(df: number): number {
  // Lookup table: df → t-critical at alpha/2 = 0.025
  const table: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
    16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
    25: 2.060, 30: 2.042, 40: 2.021, 50: 2.009, 60: 2.000,
    80: 1.990, 100: 1.984, 120: 1.980,
  };
  if (df <= 0) return 1.96;
  if (table[df]) return table[df];
  // Interpolate between nearest keys
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (df > keys[keys.length - 1]) return 1.96;
  const upper = keys.find(k => k >= df) ?? keys[keys.length - 1];
  const lower = keys.reverse().find(k => k <= df) ?? keys[0];
  if (lower === upper) return table[lower];
  const frac = (df - lower) / (upper - lower);
  return table[lower] + frac * (table[upper] - table[lower]);
}

function computeErrorBarsFromRawData(
  rawRows: Record<string, unknown>[],
  rawColumns: string[],
  xLabels: string[],
  yValues: number[],
  seriesLabel: string,
  errorType: 'sd' | 'se' | 'ci95' = 'sd',
): ComputedErrorBars | null {
  if (!rawRows || rawRows.length === 0 || xLabels.length === 0) return null;

  // Try to find the value column that matches this series label
  const valueCol = rawColumns.find((c) => {
    const cl = c.toLowerCase();
    const sl = seriesLabel.toLowerCase();
    return cl === sl || cl.replace(/[_\s]/g, '') === sl.replace(/[_\s]/g, '');
  });

  // Try to find the group/category column whose unique values match xLabels
  let groupCol: string | null = null;
  for (const col of rawColumns) {
    const uniq = Array.from(new Set(rawRows.map((r: Record<string, unknown>) => String(r[col] ?? '').trim()))).filter(Boolean);
    const labelLower = xLabels.map((l: string) => String(l).trim().toLowerCase());
    const matchCount = uniq.filter((v: string) => labelLower.includes(v.toLowerCase())).length;
    if (matchCount >= Math.min(xLabels.length, uniq.length) * 0.7 && matchCount >= 2) {
      groupCol = col;
      break;
    }
  }

  if (!groupCol || !valueCol) {
    // Fallback: try to compute from any numeric column that could match the y-values
    // Group by the first categorical column
    if (!groupCol) {
      for (const col of rawColumns) {
        const vals = rawRows.map((r: Record<string, unknown>) => r[col]);
        const numericRatio = vals.filter((v: unknown) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))).length / vals.length;
        if (numericRatio < 0.5) { // categorical column
          const uniq = Array.from(new Set(vals.map((v: unknown) => String(v ?? ''))));
          if (uniq.length >= 2 && uniq.length <= 50) {
            groupCol = col;
            break;
          }
        }
      }
    }
    if (!groupCol) return null;

    // Find best numeric column
    if (!valueCol) {
      const numCol = rawColumns.find((c: string) => {
        if (c === groupCol) return false;
        const numCount = rawRows.filter((r: Record<string, unknown>) => typeof r[c] === 'number' || (typeof r[c] === 'string' && !isNaN(Number(r[c])))).length;
        return numCount > rawRows.length * 0.5;
      });
      if (!numCol) return null;
      return computeErrorBarsFromRawData(rawRows, rawColumns, xLabels, yValues, numCol, errorType);
    }
  }

  // Group raw data by the group column, compute stats for the value column
  const groups: Record<string, number[]> = {};
  for (const row of rawRows) {
    const key = String(row[groupCol!] ?? '').trim();
    const val = Number(row[valueCol]);
    if (key && !isNaN(val)) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(val);
    }
  }

  if (Object.keys(groups).length === 0) return null;

  // Build error array matching xLabels order
  const errorArray: number[] = xLabels.map((label: string) => {
    const labelKey = String(label).trim();
    // Case-insensitive match
    const values = groups[labelKey]
      ?? Object.entries(groups).find(([k]) => k.toLowerCase() === labelKey.toLowerCase())?.[1]
      ?? [];

    if (values.length < 2) return 0;

    const n = values.length;
    const mean = values.reduce((a: number, b: number) => a + b, 0) / n;
    const variance = values.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / (n - 1);
    const sd = Math.sqrt(variance);
    const se = sd / Math.sqrt(n);

    switch (errorType) {
      case 'se': return se;
      case 'ci95': {
        // Use t-critical value for df = n-1 at alpha/2 = 0.025
        // For large samples this approaches 1.96; for small samples it's larger
        const tCrit = tCritical025(n - 1);
        return tCrit * se;
      }
      case 'sd':
      default: return sd;
    }
  });

  // Only return if we got meaningful error values
  if (errorArray.every((v) => v === 0)) return null;

  return { array: errorArray, type: errorType };
}

/** Resolve marker shape for a series index from chart_data markers array or default */
function resolveMarkerShape(chartData: any, seriesName: string, index: number): string {
  try {
    if (chartData?.markers && Array.isArray(chartData.markers)) {
      const match = chartData.markers.find((m: any) => m?.series === seriesName);
      if (match?.shape) return match.shape;
    }
  } catch { /* ignore */ }
  return MARKER_SHAPES[index % MARKER_SHAPES.length];
}

/** Resolve marker size from chart_data markers array or default */
function resolveMarkerSize(chartData: any, seriesName: string): number {
  try {
    if (chartData?.markers && Array.isArray(chartData.markers)) {
      const match = chartData.markers.find((m: any) => m?.series === seriesName);
      if (typeof match?.size === 'number') return match.size;
    }
  } catch { /* ignore */ }
  return 8;
}

/** Build significance annotations from chart_data */
function buildSignificanceAnnotations(chartData: any): Partial<Plotly.Annotations>[] {
  try {
    if (!chartData?.significance || !Array.isArray(chartData.significance)) return [];
    return chartData.significance
      .filter((sig: any) => sig && typeof sig.x !== 'undefined' && typeof sig.y !== 'undefined')
      .map((sig: any) => ({
        x: sig.x,
        y: sig.y,
        text: sig.text ?? '***',
        showarrow: false,
        font: { size: 14, color: '#1a2332' },
        yshift: 10,
        xref: 'x' as const,
        yref: 'y' as const,
      }));
  } catch { return []; }
}

/** Calculate smart X-axis label config to prevent overlapping labels */
function calculateXAxisLabelConfig(xValues: any[]): Record<string, any> {
  if (!xValues || xValues.length === 0) return { automargin: true };

  const labelCount = xValues.length;
  const maxLabelLength = Math.max(...xValues.map((v: any) => String(v).length));

  let tickangle = 0;
  let tickfontSize = 11;

  // Few labels, short text — horizontal is fine
  if (labelCount <= 5 && maxLabelLength <= 15) {
    tickangle = 0;
    tickfontSize = 11;
  }
  // Moderate labels or medium text — slight angle
  else if (labelCount <= 10 && maxLabelLength <= 20) {
    tickangle = -30;
    tickfontSize = 10;
  }
  // Many labels or long text — steep angle
  else if (labelCount <= 20) {
    tickangle = -45;
    tickfontSize = 9;
  }
  // Very many labels — steep
  else if (labelCount <= 40) {
    tickangle = -60;
    tickfontSize = 8;
  }
  // Extreme — vertical and small
  else {
    tickangle = -90;
    tickfontSize = 7;
  }

  // Long labels always need angling regardless of count
  if (maxLabelLength > 15 && tickangle === 0) {
    tickangle = -45;
  }
  if (maxLabelLength > 25) {
    tickangle = -60;
    tickfontSize = Math.min(tickfontSize, 9);
  }

  return {
    tickangle,
    tickfont: { size: tickfontSize, family: 'Arial, sans-serif', color: '#333' },
    automargin: true,
    ...(labelCount > 50 ? { nticks: 20 } : {}),
  };
}

/** Improve axis labels — fix vague/single-word labels from the AI */
function improveAxisLabel(label: string | undefined, axis: 'x' | 'y'): string {
  if (!label || label === '' || label === 'undefined') return axis === 'x' ? 'Category' : 'Value';
  const lc = label.toLowerCase().trim();
  const badLabels: Record<string, string> = {
    'mean': 'Mean Value',
    'count': 'Count (n)',
    'value': 'Value',
    'time': 'Time (units)',
    'subject': 'Subject ID',
    'frequency': 'Frequency (n)',
    'x': axis === 'x' ? 'Category' : 'Value',
    'y': axis === 'y' ? 'Value' : 'Category',
    'index': 'Index',
    'subjid': 'Subject ID',
    'siteid': 'Site ID',
    'age': 'Age (years)',
    'weight': 'Weight (kg)',
    'height': 'Height (cm)',
    'dose': 'Dose (mg)',
    'concentration': 'Concentration (ng/mL)',
    'auc': 'AUC (h·ng/mL)',
    'cmax': 'Cmax (ng/mL)',
    'tmax': 'Tmax (hours)',
    'percent': 'Percentage (%)',
    'pct': 'Percentage (%)',
    'n': 'Count (n)',
    'number': 'Number',
  };
  return badLabels[lc] || label;
}

/** Normalize AI chart_data into a common { labels, datasets } shape so all builders work uniformly.
 *  After this function: labels is always a flat array of x-values (strings or numbers),
 *  and each dataset.data is always a flat array of y-values (numbers). */
function normalizeChartData(chartData: any): { labels: any[]; datasets: any[] } {
  let labels = chartData.labels ?? [];
  const datasets = chartData.datasets ?? [];

  // Standard format — but datasets[].data might be objects [{x, y}] instead of numbers
  if (datasets.length > 0) {
    // Check if any dataset has object-format data
    const firstDs = datasets[0];
    const firstData = firstDs?.data;
    if (Array.isArray(firstData) && firstData.length > 0 && typeof firstData[0] === 'object' && firstData[0] !== null) {
      // Extract x from first dataset's objects (they share the same x values)
      const extractedLabels = firstData.map((d: any) => d.x ?? d.name ?? d.label ?? d.category ?? '');
      const normalizedDatasets = datasets.map((ds: any) => {
        if (!Array.isArray(ds.data) || ds.data.length === 0 || typeof ds.data[0] !== 'object') return ds;
        return {
          ...ds,
          data: ds.data.map((d: any) => d.y ?? d.value ?? 0),
          // Preserve CI if present in objects
          _ci_lower: ds.data[0].ci_lower !== undefined ? ds.data.map((d: any) => d.ci_lower) : ds._ci_lower ?? ds.ci_lower,
          _ci_upper: ds.data[0].ci_upper !== undefined ? ds.data.map((d: any) => d.ci_upper) : ds._ci_upper ?? ds.ci_upper,
          error_y: ds.data[0].sd !== undefined ? ds.data.map((d: any) => d.sd) :
                   ds.data[0].sem !== undefined ? ds.data.map((d: any) => d.sem) :
                   ds.data[0].error !== undefined ? ds.data.map((d: any) => d.error) :
                   ds.error_y,
        };
      });
      // Use extracted labels if chart didn't provide explicit labels
      if (labels.length === 0) labels = extractedLabels;
      console.log('[normalizeChartData] Extracted x from object data:', labels, 'y sample:', normalizedDatasets[0]?.data?.slice(0, 3));
      return { labels, datasets: normalizedDatasets };
    }
    // labels present or data is already flat numbers — normalize error bar property names
    const normalizedDs = datasets.map((ds: any) => {
      const out = { ...ds };
      // Normalize case variants of error bar properties onto canonical names
      if (!out.error_y && (out.SD || out.Sd || out.std_dev || out.StdDev || out.stdev)) {
        out.error_y = out.SD ?? out.Sd ?? out.std_dev ?? out.StdDev ?? out.stdev;
      }
      if (!out.error_y && (out.SEM || out.Sem || out.std_error)) {
        out.error_y = out.SEM ?? out.Sem ?? out.std_error;
      }
      if (!out.error_y && out.Error_Y) out.error_y = out.Error_Y;
      if (!out._ci_lower && (out.CI_Lower || out.CI_lower)) out._ci_lower = out.CI_Lower ?? out.CI_lower;
      if (!out._ci_upper && (out.CI_Upper || out.CI_upper)) out._ci_upper = out.CI_Upper ?? out.CI_upper;
      // Handle Plotly object format: { type: 'data', array: [...] } → extract the array
      if (out.error_y && typeof out.error_y === 'object' && !Array.isArray(out.error_y) && out.error_y.array) {
        out.error_y = out.error_y.array;
      }
      return out;
    });
    return { labels, datasets: normalizedDs };
  }

  // Format: { series: [{ name, x: [...], y: [...] }] }
  if (chartData.series && Array.isArray(chartData.series) && chartData.series.length > 0) {
    const firstSeries = chartData.series[0];
    const xVals = firstSeries.x ?? firstSeries.data?.map((d: any) => d.x) ?? [];
    return {
      labels: xVals,
      datasets: chartData.series.map((s: any) => ({
        label: s.name ?? s.label,
        data: s.y ?? s.data?.map((d: any) => d.y) ?? [],
        color: s.color,
        borderColor: s.borderColor ?? s.color,
        error_y: s.error_y ?? s.sd ?? s.sem,
      })),
    };
  }

  // Format: { x: [...], y: [...] } — direct arrays
  if (chartData.x && chartData.y && Array.isArray(chartData.x) && Array.isArray(chartData.y)) {
    const ds: any = {
      label: chartData.name ?? chartData.series_name ?? 'Data',
      data: chartData.y,
    };
    if (chartData.error_y) {
      ds.error_y = Array.isArray(chartData.error_y) ? chartData.error_y : chartData.error_y.array;
    } else if (chartData.ci_lower && chartData.ci_upper) {
      ds._ci_lower = chartData.ci_lower;
      ds._ci_upper = chartData.ci_upper;
    }
    return { labels: chartData.x, datasets: [ds] };
  }

  // Format: { data: [{ species: "Owl", mean: 58.5, ci_lower: ... }, ...] }
  if (chartData.data && Array.isArray(chartData.data) && chartData.data.length > 0 && typeof chartData.data[0] === 'object' && !Array.isArray(chartData.data[0])) {
    const keys = Object.keys(chartData.data[0]);
    const xKey = chartData.x_column ?? keys.find((k: string) =>
      /species|group|treatment|category|name|label|arm|dose|time|visit|subject|site|region|country/i.test(k)
    ) ?? keys[0];
    // Exclude CI/error columns from being separate Y series
    const errorKeys = new Set(keys.filter((k: string) => /ci_lower|ci_upper|lower|upper|error|sd|sem|se\b/i.test(k)));
    const yKeys = keys.filter((k: string) => k !== xKey && !errorKeys.has(k) && typeof chartData.data[0][k] === 'number');
    if (yKeys.length > 0) {
      // Try to pair each Y key with CI bounds
      const ciLowerKey = keys.find((k: string) => /ci_lower|lower_ci|lower_bound|lower/i.test(k));
      const ciUpperKey = keys.find((k: string) => /ci_upper|upper_ci|upper_bound|upper/i.test(k));
      const sdKey = keys.find((k: string) => /^sd$|^std_dev$|^stdev$/i.test(k));
      const semKey = keys.find((k: string) => /^sem$|^se$|^std_error$/i.test(k));

      return {
        labels: chartData.data.map((d: any) => d[xKey]),
        datasets: yKeys.map((yKey: string) => {
          const ds: any = {
            label: yKey,
            data: chartData.data.map((d: any) => d[yKey]),
          };
          // Attach asymmetric CI error bars
          if (ciLowerKey && ciUpperKey) {
            ds._ci_lower = chartData.data.map((d: any) => d[ciLowerKey]);
            ds._ci_upper = chartData.data.map((d: any) => d[ciUpperKey]);
          } else if (sdKey) {
            ds.error_y = chartData.data.map((d: any) => d[sdKey]);
          } else if (semKey) {
            ds.error_y = chartData.data.map((d: any) => d[semKey]);
          }
          return ds;
        }),
      };
    }
  }

  // Format: results_table with metric/value pairs
  if (chartData.results_table && Array.isArray(chartData.results_table)) {
    const numericRows = chartData.results_table.filter((r: any) => r?.value != null && !isNaN(Number(r.value)));
    if (numericRows.length > 0) {
      return {
        labels: numericRows.map((r: any) => r.metric ?? r.label ?? r.name ?? ''),
        datasets: [{
          label: 'Values',
          data: numericRows.map((r: any) => Number(r.value)),
        }],
      };
    }
  }

  return { labels, datasets };
}

/** Build Plotly traces from generic LLM chart_data (bar/line) */
function buildGenericPlotlyTraces(
  chartData: any,
  mode: string
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const { labels, datasets } = normalizeChartData(chartData);
  const annotations = buildSignificanceAnnotations(chartData);

  // Detect categorical x-axis: if labels are strings (species names, treatment groups, etc.)
  const isCategorical = labels.length > 0 && typeof labels[0] === 'string' && labels.some((l: any) => isNaN(Number(l)));

  // Axis titles with units — fallback to column name from labels/datasets if AI didn't provide
  const rawX = chartData.x_axis ?? chartData.xLabel ?? chartData.x_label
    ?? (isCategorical ? 'Category' : 'X');
  const rawY = chartData.y_axis ?? chartData.yLabel ?? chartData.y_label
    ?? (datasets.length > 0 ? (datasets[0]?.label ?? 'Value') : 'Y');
  const xTitle = improveAxisLabel(rawX, 'x');
  const yTitle = improveAxisLabel(rawY, 'y');
  const xTitleConfig = { text: xTitle, font: { size: 13, color: '#1a2332', family: 'Arial, sans-serif' as const } };
  const yTitleConfig = { text: yTitle, font: { size: 13, color: '#1a2332', family: 'Arial, sans-serif' as const } };

  // Axis tick intervals from AI
  const axisTicks = chartData.axis_ticks ?? {};
  const xAxisExtra: any = {};
  const yAxisExtra: any = {};
  if (axisTicks.x_interval) xAxisExtra.dtick = axisTicks.x_interval;
  if (axisTicks.y_interval) yAxisExtra.dtick = axisTicks.y_interval;
  if (axisTicks.x_minor) Object.assign(xAxisExtra, MINOR_TICKS);
  if (axisTicks.y_minor) Object.assign(yAxisExtra, MINOR_TICKS);

  // Y-axis scale (log if specified)
  if (chartData.y_scale === 'log') {
    yAxisExtra.type = 'log';
  }

  // Categorical x-axis: tell Plotly to treat as categories, preserving original order
  if (isCategorical) {
    xAxisExtra.type = 'category';
    xAxisExtra.categoryorder = 'array';
    xAxisExtra.categoryarray = labels;
  }

  // Choose palette: use RESEARCH_PALETTE for >2 series, KM for survival-like
  const palette = datasets.length > 2 ? RESEARCH_PALETTE : DEFAULT_PALETTE;

  // Hover template: show category name for categorical x, numeric for numeric x
  const hoverTpl = isCategorical
    ? '<b>%{x}</b><br>%{y:.2f}<extra>%{fullData.name}</extra>'
    : '<b>%{fullData.name}</b><br>x: %{x:.2f}<br>y: %{y:.2f}<extra></extra>';

  if (mode === 'bar' || (!mode && !isPlotlyChartData(chartData))) {
    const showValues = chartData.show_values === true; // only show if explicitly requested
    const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => {
      const color = ds.color ?? ds.borderColor ?? palette[i % palette.length];
      const seriesName = ds.label ?? `Series ${i + 1}`;
      return {
        x: labels,
        y: ds.data ?? [],
        name: seriesName,
        type: 'bar' as const,
        marker: { color, line: { width: 1, color: '#ffffff' } },
        error_y: resolveErrorBars(ds, chartData, seriesName),
        hovertemplate: hoverTpl,
        // Values above bars
        ...(showValues ? {
          text: (ds.data ?? []).map((v: number) => typeof v === 'number' ? v.toFixed(1) : String(v)),
          textposition: 'outside' as const,
          textfont: { size: 10, color: '#1a2332' },
        } : {}),
      };
    });

    return {
      plotData,
      layout: {
        barmode: 'group' as const,
        xaxis: { title: xTitleConfig, ...GRID_STYLE, ...xAxisExtra },
        yaxis: { title: yTitleConfig, ...GRID_STYLE, ...yAxisExtra },
        annotations,
      },
    };
  }

  // Default: line chart with markers
  const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => {
    const color = ds.color ?? ds.borderColor ?? palette[i % palette.length];
    const seriesName = ds.label ?? `Series ${i + 1}`;
    const markerShape = resolveMarkerShape(chartData, seriesName, i);
    const markerSize = resolveMarkerSize(chartData, seriesName);
    return {
      x: labels,
      y: ds.data ?? [],
      mode: 'lines+markers' as const,
      name: seriesName,
      line: { color, width: 2.5 },
      marker: { color, size: markerSize, symbol: markerShape, line: { width: 1.5, color: '#1a2332' } },
      type: 'scatter' as const,
      error_y: resolveErrorBars(ds, chartData, seriesName),
      hovertemplate: hoverTpl,
    };
  });

  return {
    plotData,
    layout: {
      xaxis: { title: xTitleConfig, ...GRID_STYLE, ...xAxisExtra },
      yaxis: { title: yTitleConfig, ...GRID_STYLE, ...yAxisExtra },
      annotations,
    },
  };
}

// ── Resolve pharma_type → builder ────────────────────────────────────────

function resolvePharmaType(chartData: any): string | null {
  if (!chartData) return null;
  const pt = (chartData.pharma_type ?? '').toLowerCase();
  if (pt) return pt;
  const ct = (chartData.type ?? '').toLowerCase();
  if (['kaplan-meier', 'box', 'boxplot', 'heatmap', 'waterfall', 'forest', 'volcano', 'violin', 'histogram', 'bubble', 'qq', 'pareto', 'swimmer', 'funnel', 'dot', 'strip', 'dose_response', 'dose-response', 'roc', 'roc_curve', 'bland_altman', 'bland-altman', 'paired', 'before_after', 'paired_line'].includes(ct)) return ct;
  const chartType = (chartData.chart_type ?? '').toLowerCase();
  if (chartType) return chartType;
  return null;
}

// ── Edit Action Buttons ────────────────────────────────────────────────────

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

function ActionButton({ icon: Icon, label, onClick, variant }: ActionButtonProps & { variant?: "primary" }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border transition-colors ${
        isPrimary
          ? "bg-[#194CFF] border-[#194CFF] text-white hover:bg-[#3B82F6] hover:border-[#3B82F6]"
          : "bg-[#F1F5F9] border-[#E2E8F0] text-[#64748b] hover:bg-[#E2E8F0] hover:text-[#0f172a]"
      }`}
      style={{ borderRadius: "0.5rem" }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PlotlyInteractiveChart({
  config,
  customizations: custOverrides,
  onPointClick,
  onEditAction,
  onLabelEdit,
  rawDataset,
  onValidationWarning,
  height = 420,
}: PlotlyInteractiveChartProps) {
  const [selectedPoint, setSelectedPoint] = useState<{
    x: number;
    y: number;
    trace: string;
  } | null>(null);
  const plotRef = useRef<any>(null);

  const { plotData: basePlotData, layout: baseLayout } = useMemo(() => {
   try {
    const mode = config.mode ?? 'auto';
    const chartData = config.chartData;

    // Guard: if chartData is missing or truly empty, return empty traces
    if (!chartData || (typeof chartData === 'object' && !chartData.datasets && !chartData.labels && !chartData.z && !chartData.series && !chartData.data && !chartData.x && !chartData.y)) {
      console.warn('[PlotlyInteractiveChart] No chartData or empty chartData:', chartData);
      return { plotData: [] as Plotly.Data[], layout: { ...LAYOUT_BASE } };
    }

    console.log('[PlotlyInteractiveChart] CHART DATA FROM AI:', JSON.stringify(chartData, null, 2));

    // ── Resolve pharma_type for advanced charts ───────────────────────
    const pharmaType = resolvePharmaType(chartData);

    // Box plot
    if (mode === 'box' || pharmaType === 'box' || pharmaType === 'boxplot' || pharmaType === 'box_chart') {
      const { plotData, layout: modeLayout } = buildBoxPlotTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Distribution by Group');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          ...modeLayout,
        },
      };
    }

    // Heatmap
    if (mode === 'heatmap' || pharmaType === 'heatmap' || pharmaType === 'heatmap_chart') {
      const { plotData, layout: modeLayout } = buildHeatmapTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Correlation Heatmap');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          ...modeLayout,
        },
      };
    }

    // Waterfall
    if (mode === 'waterfall' || pharmaType === 'waterfall' || pharmaType === 'waterfall_chart') {
      const { plotData, layout: modeLayout } = buildWaterfallTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Waterfall Plot');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          ...modeLayout,
        },
      };
    }

    // Forest plot
    if (mode === 'forest' || pharmaType === 'forest' || pharmaType === 'forest_chart') {
      const { plotData, layout: modeLayout } = buildForestPlotTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Forest Plot');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          ...modeLayout,
        },
      };
    }

    // Volcano plot
    if (mode === 'volcano' || pharmaType === 'volcano' || pharmaType === 'volcano_chart') {
      const { plotData, layout: modeLayout } = buildVolcanoTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Volcano Plot');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          ...modeLayout,
        },
      };
    }

    // Violin plot
    if (mode === 'violin' || pharmaType === 'violin' || pharmaType === 'violin_chart') {
      const { plotData, layout: modeLayout } = buildViolinTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Violin Plot');
      return {
        plotData,
        layout: { ...LAYOUT_BASE, title: tc.title, margin: { ...LAYOUT_BASE.margin, t: tc.marginTop }, ...modeLayout },
      };
    }

    // Dot plot / strip chart
    if (mode === 'dot' || mode === 'strip' || pharmaType === 'dot' || pharmaType === 'dot_plot' || pharmaType === 'strip' || pharmaType === 'strip_chart') {
      const { plotData, layout: modeLayout } = buildDotPlotTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Dot Plot');
      return {
        plotData,
        layout: { ...LAYOUT_BASE, title: tc.title, margin: { ...LAYOUT_BASE.margin, t: tc.marginTop }, ...modeLayout },
      };
    }

    // Dose-response curve
    if (mode === 'dose_response' || mode === 'dose-response' || pharmaType === 'dose_response' || pharmaType === 'dose-response') {
      const { plotData, layout: modeLayout } = buildDoseResponseTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Dose-Response Curve');
      return {
        plotData,
        layout: { ...LAYOUT_BASE, title: tc.title, margin: { ...LAYOUT_BASE.margin, t: tc.marginTop }, ...modeLayout },
      };
    }

    // ROC curve
    if (mode === 'roc' || mode === 'roc_curve' || pharmaType === 'roc' || pharmaType === 'roc_curve') {
      const { plotData, layout: modeLayout } = buildROCTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'ROC Curve');
      return {
        plotData,
        layout: { ...LAYOUT_BASE, title: tc.title, margin: { ...LAYOUT_BASE.margin, t: tc.marginTop }, ...modeLayout },
      };
    }

    // Bland-Altman plot
    if (mode === 'bland_altman' || mode === 'bland-altman' || pharmaType === 'bland_altman' || pharmaType === 'bland-altman') {
      const { plotData, layout: modeLayout } = buildBlandAltmanTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Bland-Altman Plot');
      return {
        plotData,
        layout: { ...LAYOUT_BASE, title: tc.title, margin: { ...LAYOUT_BASE.margin, t: tc.marginTop }, ...modeLayout },
      };
    }

    // Before-After / Paired line plot
    if (mode === 'paired' || mode === 'before_after' || mode === 'paired_line' || pharmaType === 'paired' || pharmaType === 'before_after' || pharmaType === 'paired_line') {
      const { plotData, layout: modeLayout } = buildPairedLineTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Paired Comparison');
      return {
        plotData,
        layout: { ...LAYOUT_BASE, title: tc.title, margin: { ...LAYOUT_BASE.margin, t: tc.marginTop }, ...modeLayout },
      };
    }

    // Histogram
    if (mode === 'histogram' || pharmaType === 'histogram') {
      const datasets = chartData.datasets ?? [];
      const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => ({
        type: 'histogram' as const,
        x: ds.data ?? [],
        name: ds.label ?? `Variable ${i + 1}`,
        marker: { color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length], line: { width: 1, color: '#ffffff' } },
        opacity: datasets.length > 1 ? 0.7 : 1,
      }));
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Distribution');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          barmode: datasets.length > 1 ? 'overlay' as const : undefined,
          xaxis: { title: { text: chartData.x_label ?? chartData.x_axis ?? 'Value', font: { size: 13, color: '#1a2332' } }, ...GRID_STYLE },
          yaxis: { title: { text: chartData.y_label ?? chartData.y_axis ?? 'Frequency', font: { size: 13, color: '#1a2332' } }, ...GRID_STYLE },
        },
      };
    }

    // Bubble chart
    if (mode === 'bubble' || pharmaType === 'bubble') {
      const datasets = chartData.datasets ?? [];
      const labels = chartData.labels ?? [];
      const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => ({
        type: 'scatter' as const,
        mode: 'markers' as const,
        x: ds.x ?? labels,
        y: ds.data ?? ds.y ?? [],
        name: ds.label ?? `Series ${i + 1}`,
        text: ds.text ?? labels,
        marker: {
          size: ds.sizes ?? ds.data?.map(() => 10) ?? [],
          sizemode: 'area' as const,
          sizeref: 2 * Math.max(...(ds.sizes ?? [10])) / (40 ** 2),
          color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
          line: { width: 1, color: '#1a2332' },
        },
      }));
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Bubble Chart');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          xaxis: { title: { text: chartData.x_label ?? chartData.x_axis ?? 'X', font: { size: 13, color: '#1a2332' } }, ...GRID_STYLE },
          yaxis: { title: { text: chartData.y_label ?? chartData.y_axis ?? 'Y', font: { size: 13, color: '#1a2332' } }, ...GRID_STYLE },
        },
      };
    }

    // Q-Q Plot
    if (mode === 'qq' || pharmaType === 'qq') {
      const observed = chartData.datasets?.[0]?.data ?? [];
      const sorted = [...observed].sort((a, b) => a - b);
      const n = sorted.length;
      // Theoretical normal quantiles
      const theoretical = sorted.map((_: number, i: number) => {
        const p = (i + 0.5) / n;
        // Approximate inverse normal using Beasley-Springer-Moro algorithm
        const a = p - 0.5;
        const r = a * a;
        return a * (2.50662823884 + r * (-18.61500062529 + r * (41.39119773534 + r * -25.44106049637))) /
          (1 + r * (-8.47351093090 + r * (23.08336743743 + r * (-21.06224101826 + r * 3.13082909833))));
      });
      const plotData: Plotly.Data[] = [
        {
          type: 'scatter' as const, mode: 'markers' as const,
          x: theoretical, y: sorted,
          name: 'Data Points',
          marker: { color: '#2563eb', size: 6 },
        },
        {
          type: 'scatter' as const, mode: 'lines' as const,
          x: [Math.min(...theoretical), Math.max(...theoretical)],
          y: [Math.min(...sorted), Math.max(...sorted)],
          name: 'Reference Line',
          line: { dash: 'dash', color: '#e53e3e', width: 1.5 },
        },
      ];
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Normal Q-Q Plot');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          xaxis: { title: { text: 'Theoretical Quantiles', font: { size: 13, color: '#1a2332' } }, ...GRID_STYLE },
          yaxis: { title: { text: 'Sample Quantiles', font: { size: 13, color: '#1a2332' } }, ...GRID_STYLE },
        },
      };
    }

    // Scatter (explicit)
    if (mode === 'scatter' && chartData) {
      const { plotData, layout: modeLayout } = buildScatterTraces(chartData);
      const tc = buildTitleConfig(config.title ?? chartData?.title ?? 'Scatter Plot');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          ...modeLayout,
        },
      };
    }

    // Survival / PFS / KM mode
    if (mode === 'survival' || (mode === 'auto' && config.traces)) {
      const traces =
        config.traces ?? chartDataToSurvivalTraces(config.chartData) ?? [];
      if (traces.length > 0) {
        const { plotData, annotations } = buildSurvivalTraces(traces);
        const sigAnnotations = buildSignificanceAnnotations(chartData ?? {});
        const tc = buildTitleConfig(config.title ?? 'Mean PFS by Treatment Group');
        return {
          plotData,
          layout: {
            ...LAYOUT_BASE,
            title: tc.title,
            margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
            xaxis: {
              title: { text: config.xLabel ?? chartData?.x_axis ?? 'Time (Months)', font: { size: 13, color: '#1a2332' } },
              ...GRID_STYLE,
            },
            yaxis: {
              title: { text: config.yLabel ?? chartData?.y_axis ?? 'Mean PFS (Days)', font: { size: 13, color: '#1a2332' } },
              ...GRID_STYLE,
            },
            annotations: [...annotations, ...sigAnnotations],
          },
        };
      }
    }

    // Auto-detect survival from chart_data keywords
    if (mode === 'auto' && chartData) {
      // Check survival keywords
      const labels = chartData.labels ?? [];
      const datasetLabels = (chartData.datasets ?? []).map((d: any) => (d.label ?? '').toLowerCase());
      const allLabels = [...labels.map((l: any) => String(l).toLowerCase()), ...datasetLabels];
      const survivalKeywords = ['pfs', 'os', 'survival', 'km', 'kaplan', 'meier', 'time_months', 'mean_pfs'];
      const isSurvival = allLabels.some((l: string) => survivalKeywords.some((kw) => l.includes(kw))) ||
        chartData.chart_mode === 'survival' ||
        (pharmaType && ['survival', 'km', 'kaplan-meier'].includes(pharmaType));

      if (isSurvival) {
        const traces = chartDataToSurvivalTraces(chartData);
        if (traces && traces.length > 0) {
          const { plotData, annotations } = buildSurvivalTraces(traces);
          const sigAnnotations = buildSignificanceAnnotations(chartData);
          const tc = buildTitleConfig(config.title ?? chartData.title ?? 'Survival Analysis');
          return {
            plotData,
            layout: {
              ...LAYOUT_BASE,
              title: tc.title,
              margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
              xaxis: {
                title: { text: config.xLabel ?? chartData.x_axis ?? 'Time (Months)', font: { size: 13, color: '#1a2332' } },
                ...GRID_STYLE,
              },
              yaxis: {
                title: { text: config.yLabel ?? chartData.y_axis ?? 'Mean PFS (Days)', font: { size: 13, color: '#1a2332' } },
                ...GRID_STYLE,
              },
              annotations: [...annotations, ...sigAnnotations],
            },
          };
        }
      }
    }

    // Generic chart from LLM chart_data (bar/line fallback)
    if (chartData) {
      const { plotData, layout: modeLayout } = buildGenericPlotlyTraces(chartData, mode);
      const tc = buildTitleConfig(config.title ?? chartData.title ?? chartData.graphTitle ?? 'Analysis Results');
      return {
        plotData,
        layout: {
          ...LAYOUT_BASE,
          title: tc.title,
          margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
          ...modeLayout,
        },
      };
    }

    return { plotData: [], layout: LAYOUT_BASE };
   } catch (err) {
    console.error('[PlotlyInteractiveChart] Error building chart traces:', err);
    return { plotData: [] as Plotly.Data[], layout: { ...LAYOUT_BASE } };
   }
  }, [config]);

  // Apply per-result customization overrides on top of AI-generated layout
  const { plotData, layout } = useMemo(() => {
    const lo: any = { ...baseLayout };
    const pd = basePlotData.map((t: any) => ({ ...t }));
    if (!custOverrides) return { plotData: pd, layout: lo };

    // Axis labels
    if (custOverrides.xLabel) {
      lo.xaxis = { ...lo.xaxis, title: { ...(lo.xaxis?.title ?? {}), text: custOverrides.xLabel } };
    }
    if (custOverrides.yLabel) {
      lo.yaxis = { ...lo.yaxis, title: { ...(lo.yaxis?.title ?? {}), text: custOverrides.yLabel } };
    }
    // Chart title
    if (custOverrides.chartTitle) {
      lo.title = { ...(lo.title ?? {}), text: `<b>${custOverrides.chartTitle}</b>` };
    }
    // Axis ranges — only override when the user has explicitly set a value.
    // null = "auto" (user hasn't touched it) → leave AI layout range untouched.
    // Plotly requires [number, number] with autorange: false to honour a manual range.
    {
      const xMin = custOverrides.xAxisMin;
      const xMax = custOverrides.xAxisMax;
      if (xMin != null || xMax != null) {
        lo.xaxis = {
          ...lo.xaxis,
          range: [xMin ?? -1e15, xMax ?? 1e15],
          autorange: false,
        };
      }
      // Both null → don't touch; let AI/Plotly auto-range naturally
    }
    {
      const yMin = custOverrides.yAxisMin;
      const yMax = custOverrides.yAxisMax;
      if (yMin != null || yMax != null) {
        lo.yaxis = {
          ...lo.yaxis,
          range: [yMin ?? -1e15, yMax ?? 1e15],
          autorange: false,
        };
      }
      // Both null → don't touch; let AI/Plotly auto-range naturally
    }
    // Log scale — only apply when explicitly set to true (default is false)
    if (custOverrides.yAxisLog === true) {
      lo.yaxis = { ...lo.yaxis, type: 'log' };
    }
    // Grid
    if (custOverrides.showGrid !== undefined) {
      lo.xaxis = { ...lo.xaxis, showgrid: custOverrides.showGrid };
      lo.yaxis = { ...lo.yaxis, showgrid: custOverrides.showGrid };
    }
    // Background — set both plot and paper
    if (custOverrides.bgColor) {
      lo.plot_bgcolor = custOverrides.bgColor;
      lo.paper_bgcolor = custOverrides.bgColor;
    }
    // Grid color
    if (custOverrides.gridColor) {
      lo.xaxis = { ...lo.xaxis, gridcolor: custOverrides.gridColor };
      lo.yaxis = { ...lo.yaxis, gridcolor: custOverrides.gridColor };
    }
    // Grid style — map store values to Plotly griddash values
    if (custOverrides.gridStyle) {
      const dashMap: Record<string, string> = { solid: 'solid', dashed: 'dash', dotted: 'dot' };
      const griddash = dashMap[custOverrides.gridStyle] ?? 'solid';
      lo.xaxis = { ...lo.xaxis, griddash };
      lo.yaxis = { ...lo.yaxis, griddash };
    }
    // Border
    if (custOverrides.showChartBorder !== undefined) {
      const show = custOverrides.showChartBorder;
      lo.xaxis = { ...lo.xaxis, showline: show, mirror: show, linewidth: show ? 1.5 : 0 };
      lo.yaxis = { ...lo.yaxis, showline: show, mirror: show, linewidth: show ? 1.5 : 0 };
    }
    if (custOverrides.borderColor) {
      lo.xaxis = { ...lo.xaxis, linecolor: custOverrides.borderColor };
      lo.yaxis = { ...lo.yaxis, linecolor: custOverrides.borderColor };
    }
    // Minor ticks
    if (custOverrides.showMinorTicks !== undefined) {
      const minor = custOverrides.showMinorTicks
        ? { ticks: 'outside' as const, showgrid: true, gridcolor: '#f0f0f0' }
        : { ticks: '' as const, showgrid: false };
      lo.xaxis = { ...lo.xaxis, minor };
      lo.yaxis = { ...lo.yaxis, minor };
    }
    // Series colors
    if (custOverrides.customColors && custOverrides.customColors.length > 0) {
      pd.forEach((trace: any, i: number) => {
        const c = custOverrides.customColors![i];
        if (c) {
          trace.marker = { ...trace.marker, color: c };
          if (trace.line) trace.line = { ...trace.line, color: c };
        }
      });
    }
    // Marker size / line width
    if (custOverrides.markerSize !== undefined) {
      pd.forEach((trace: any) => {
        if (trace.marker) trace.marker = { ...trace.marker, size: custOverrides.markerSize };
      });
    }
    if (custOverrides.strokeWidth !== undefined) {
      pd.forEach((trace: any) => {
        if (trace.line) trace.line = { ...trace.line, width: custOverrides.strokeWidth };
      });
    }
    // Apply smart legend/margin sizing based on actual trace count
    const titleText = typeof lo.title === 'object' ? lo.title?.text : lo.title;
    const yLabelText = typeof lo.yaxis?.title === 'object' ? lo.yaxis?.title?.text : lo.yaxis?.title;
    const { legend: smartLegend, margin: smartMargin } = calculateChartSizing(pd, titleText, yLabelText);
    lo.legend = { ...smartLegend, ...(lo.legend ?? {}) };
    lo.margin = { ...smartMargin, ...(lo.margin?.t ? { t: lo.margin.t } : {}) };

    // Legend position — ALL positions are OUTSIDE the plot area to never overlap data.
    // Margins are adjusted to accommodate the legend in its new position.
    if (custOverrides.legendPosition) {
      const legendMap: Record<string, { legend: Partial<Plotly.Layout['legend']>; marginKey?: string; marginVal?: number }> = {
        'top-right':    { legend: { x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', orientation: 'v' }, marginKey: 'r', marginVal: 160 },
        'top-left':     { legend: { x: -0.02, y: 1, xanchor: 'right', yanchor: 'top', orientation: 'v' }, marginKey: 'l', marginVal: 160 },
        'bottom-right': { legend: { x: 1.02, y: 0, xanchor: 'left', yanchor: 'bottom', orientation: 'v' }, marginKey: 'r', marginVal: 160 },
        'bottom-left':  { legend: { x: -0.02, y: 0, xanchor: 'right', yanchor: 'bottom', orientation: 'v' }, marginKey: 'l', marginVal: 160 },
        'bottom':       { legend: { x: 0.5, y: -0.25, xanchor: 'center', yanchor: 'top', orientation: 'h' }, marginKey: 'b', marginVal: 140 },
        'top':          { legend: { x: 0.5, y: 1.15, xanchor: 'center', yanchor: 'bottom', orientation: 'h' }, marginKey: 't', marginVal: 110 },
        'right':        { legend: { x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', orientation: 'v' }, marginKey: 'r', marginVal: 180 },
        'left':         { legend: { x: -0.02, y: 1, xanchor: 'right', yanchor: 'top', orientation: 'v' }, marginKey: 'l', marginVal: 180 },
        'none':         { legend: {} },
      };
      const entry = legendMap[custOverrides.legendPosition];
      if (entry) {
        lo.legend = { ...lo.legend, ...entry.legend };
        if (custOverrides.legendPosition === 'none') {
          lo.showlegend = false;
        } else {
          lo.showlegend = true;
          if (entry.marginKey && entry.marginVal) {
            lo.margin = { ...lo.margin, [entry.marginKey]: Math.max(lo.margin?.[entry.marginKey] ?? 0, entry.marginVal) };
          }
        }
      }
    }

    // Legend anchor (fine-grained position) — all OUTSIDE the plot area
    if (custOverrides.legendAnchor) {
      const anchorMap: Record<string, { legend: Partial<Plotly.Layout['legend']>; marginKey?: string; marginVal?: number }> = {
        'top-right':      { legend: { x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', orientation: 'v' }, marginKey: 'r', marginVal: 160 },
        'top-left':       { legend: { x: -0.02, y: 1, xanchor: 'right', yanchor: 'top', orientation: 'v' }, marginKey: 'l', marginVal: 160 },
        'bottom-right':   { legend: { x: 1.02, y: 0, xanchor: 'left', yanchor: 'bottom', orientation: 'v' }, marginKey: 'r', marginVal: 160 },
        'bottom-left':    { legend: { x: -0.02, y: 0, xanchor: 'right', yanchor: 'bottom', orientation: 'v' }, marginKey: 'l', marginVal: 160 },
        'outside-right':  { legend: { x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', orientation: 'v' }, marginKey: 'r', marginVal: 180 },
        'outside-bottom': { legend: { x: 0.5, y: -0.25, xanchor: 'center', yanchor: 'top', orientation: 'h' }, marginKey: 'b', marginVal: 140 },
      };
      const entry = anchorMap[custOverrides.legendAnchor];
      if (entry) {
        lo.legend = { ...lo.legend, ...entry.legend };
        lo.showlegend = true;
        if (entry.marginKey && entry.marginVal) {
          lo.margin = { ...lo.margin, [entry.marginKey]: Math.max(lo.margin?.[entry.marginKey] ?? 0, entry.marginVal) };
        }
      }
    }

    // Legend text color — always black, never trace-colored
    lo.legend = {
      ...lo.legend,
      font: { ...(lo.legend?.font ?? {}), color: '#1a2332', family: 'Arial, sans-serif' },
    };

    // Legend border
    if (custOverrides.showLegendBorder !== undefined) {
      lo.legend = { ...lo.legend, borderwidth: custOverrides.showLegendBorder ? 1 : 0, bordercolor: '#cccccc' };
    }
    // Legend background
    if (custOverrides.legendBgColor) {
      lo.legend = { ...lo.legend, bgcolor: custOverrides.legendBgColor };
    }
    // Legend font size
    if (custOverrides.legendFontSize !== undefined) {
      lo.legend = { ...lo.legend, font: { ...(lo.legend?.font ?? {}), size: custOverrides.legendFontSize } };
    }

    // Bar gap — store value is 0–20 px; Plotly bargap is 0–1 fraction
    if (custOverrides.barGap !== undefined) {
      lo.bargap = Math.max(0, Math.min(1, custOverrides.barGap / 20));
    }
    // Bar corner radius (Plotly 2.27+ marker.cornerradius)
    if (custOverrides.barBorderRadius !== undefined && custOverrides.barBorderRadius > 0) {
      pd.forEach((trace: any) => {
        if (trace.type === 'bar') {
          trace.marker = { ...trace.marker, cornerradius: custOverrides.barBorderRadius };
        }
      });
    }
    // Show error bars — ALWAYS compute from raw dataset when available (overwrite AI values)
    // Also auto-trigger when chart_data has show_error_bars flag, even if toggle wasn't manually set
    const wantsErrorBars = custOverrides.showErrorBars === true
      || config.chartData?.show_error_bars === true
      || config.chartData?.error_type;
    if (wantsErrorBars) {
      const rawErrType = custOverrides.errorBarType ?? config.chartData?.error_type ?? 'sd';
      const errorType: 'sd' | 'se' | 'ci95' = rawErrType === 'std' ? 'sd' : rawErrType === 'sem' ? 'se' : rawErrType as 'sd' | 'se' | 'ci95';

      console.log('[ERROR BARS] Enabled. rawDataset:', rawDataset ? `${rawDataset.rows.length} rows, ${rawDataset.columns.length} cols` : 'NULL', 'errorType:', errorType);

      let anyComputed = false;
      pd.forEach((trace: any, idx: number) => {
        const xLabels: string[] = (trace.x ?? []).map(String);
        const yVals: number[] = trace.y ?? [];
        if (xLabels.length === 0 || yVals.length === 0) return;

        // Compute from raw dataset — overwrites whatever the AI returned
        if (rawDataset?.rows && rawDataset.rows.length > 0) {
          console.log(`[ERROR BARS] Trace ${idx} "${trace.name}": computing from ${rawDataset.rows.length} raw rows, xLabels:`, xLabels.slice(0, 5));
          const computed = computeErrorBarsFromRawData(
            rawDataset.rows as Record<string, any>[],
            rawDataset.columns,
            xLabels,
            yVals,
            trace.name ?? '',
            errorType,
          );
          if (computed) {
            console.log(`[ERROR BARS] ✓ Trace ${idx} "${trace.name}": computed ${computed.array.length} error values:`, computed.array);
            trace.error_y = {
              type: 'data' as const,
              array: computed.array,
              visible: true,
              color: trace.marker?.color ?? '#64748b',
              thickness: 1.5,
              width: 4,
            };
            anyComputed = true;
            return;
          } else {
            console.warn(`[ERROR BARS] ✗ Trace ${idx} "${trace.name}": computeErrorBarsFromRawData returned null. Columns:`, rawDataset.columns.slice(0, 10));
          }
        }

        // Fallback: if AI provided error bars and we couldn't compute locally, keep AI values
        if (trace.error_y?.array?.length > 0 && trace.error_y.array.some((v: number) => v > 0)) {
          trace.error_y = { ...trace.error_y, visible: true };
          anyComputed = true;
          console.log(`[ERROR BARS] Trace ${idx}: using AI-provided error bars (fallback)`);
          return;
        }
        // No raw data and no AI data — no error bars for this trace
      });
      if (!anyComputed && onValidationWarning) {
        onValidationWarning(
          'Error bars could not be computed. Upload raw data with individual observations per group, or ensure your data includes SD/SE/CI columns.'
        );
      }
    } else if (custOverrides.showErrorBars === false) {
      pd.forEach((trace: any) => {
        if (trace.error_y) trace.error_y = { ...trace.error_y, visible: false };
      });
    }

    // Fill opacity
    if (custOverrides.fillOpacity !== undefined) {
      pd.forEach((trace: any) => {
        if (trace.fill && trace.line?.color) {
          // Convert hex/rgb to rgba with specified opacity
          const c = trace.line.color;
          if (c.startsWith('#')) {
            const r = parseInt(c.slice(1, 3), 16);
            const g = parseInt(c.slice(3, 5), 16);
            const b = parseInt(c.slice(5, 7), 16);
            trace.fillcolor = `rgba(${r},${g},${b},${custOverrides.fillOpacity})`;
          }
        }
      });
    }

    // X-axis rotation (user override — applied before auto-rotation below)
    if (custOverrides.xAxisRotation !== undefined) {
      lo.xaxis = { ...lo.xaxis, tickangle: custOverrides.xAxisRotation };
    }
    // Axis step sizes
    if (custOverrides.xAxisStepSize != null) {
      lo.xaxis = { ...lo.xaxis, dtick: custOverrides.xAxisStepSize };
    }
    if (custOverrides.yAxisStepSize != null) {
      lo.yaxis = { ...lo.yaxis, dtick: custOverrides.yAxisStepSize };
    }
    // X-axis log scale
    if (custOverrides.xAxisScale === 'log') {
      lo.xaxis = { ...lo.xaxis, type: 'log' };
    }

    // Subtitle annotation
    if (custOverrides.subtitle) {
      const existing = Array.isArray(lo.annotations) ? lo.annotations : [];
      lo.annotations = [
        ...existing.filter((a: any) => a._subtitleFlag !== true),
        {
          text: custOverrides.subtitle,
          xref: 'paper', yref: 'paper',
          x: 0.5, y: 1.02,
          xanchor: 'center', yanchor: 'bottom',
          showarrow: false,
          font: { size: 11, color: '#64748b' },
          _subtitleFlag: true,
        },
      ];
    }

    // Show values / data labels
    if (custOverrides.showValues !== undefined || custOverrides.showDataLabels !== undefined) {
      const show = custOverrides.showValues ?? custOverrides.showDataLabels ?? false;
      const pos = custOverrides.valuePosition === 'inside' ? 'inside' : custOverrides.valuePosition === 'below' ? 'bottom' : 'outside';
      const fontSize = custOverrides.valueFontSize ?? 10;
      pd.forEach((trace: any) => {
        if (show) {
          const vals = trace.y ?? trace.x ?? [];
          trace.text = vals.map((v: any) => typeof v === 'number' ? v.toFixed(1) : String(v ?? ''));
          trace.textposition = pos;
          trace.textfont = { size: fontSize, color: '#1a2332' };
        } else {
          trace.text = undefined;
          trace.textposition = 'none';
        }
      });
    }

    // Dark theme
    if (custOverrides.chartTheme === 'dark') {
      lo.plot_bgcolor = '#1e293b';
      lo.paper_bgcolor = '#0f172a';
      lo.font = { ...lo.font, color: '#e2e8f0' };
      lo.xaxis = { ...lo.xaxis, gridcolor: '#334155', linecolor: '#475569', tickcolor: '#94a3b8' };
      lo.yaxis = { ...lo.yaxis, gridcolor: '#334155', linecolor: '#475569', tickcolor: '#94a3b8' };
      lo.legend = { ...lo.legend, font: { ...(lo.legend?.font ?? {}), color: '#e2e8f0' } };
    }

    // Per-series overrides
    if (custOverrides.seriesOverrides && custOverrides.seriesOverrides.length > 0) {
      custOverrides.seriesOverrides.forEach((so, i) => {
        if (i >= pd.length) return;
        const trace = pd[i] as any;
        if (so.color) {
          trace.marker = { ...trace.marker, color: so.color };
          if (trace.line) trace.line = { ...trace.line, color: so.color };
        }
        if (so.lineStyle) {
          const sDashMap: Record<string, string> = { solid: 'solid', dashed: 'dash', dotted: 'dot', dashdot: 'dashdot' };
          trace.line = { ...trace.line, dash: sDashMap[so.lineStyle] ?? so.lineStyle };
        }
        if (so.lineWidth !== undefined) trace.line = { ...trace.line, width: so.lineWidth };
        if (so.markerShape) trace.marker = { ...trace.marker, symbol: so.markerShape };
        if (so.markerSize !== undefined) trace.marker = { ...trace.marker, size: so.markerSize };
        if (so.name) trace.name = so.name;
        if (so.visible !== undefined) trace.visible = so.visible ? true : 'legendonly';
      });
    }

    // ── SAFETY NET: axis labels & title must ALWAYS exist ──────────────────
    const axisFont = { size: 13, color: '#1a2332', family: 'Arial, sans-serif' as const };
    const getAxisTitle = (axis: any): string => {
      if (!axis?.title) return '';
      if (typeof axis.title === 'string') return axis.title;
      return axis.title?.text ?? '';
    };

    // Derive sensible labels from trace data when AI omits them
    const deriveLabel = (traces: any[], axis: 'x' | 'y'): string => {
      if (!traces || traces.length === 0) return axis === 'x' ? 'Category' : 'Value';
      const t = traces[0];
      if (axis === 'x') {
        if (t.x && t.x.length > 0 && typeof t.x[0] === 'string') {
          const sample = String(t.x[0]).toLowerCase();
          if (/^(s|subj|sub)\d/i.test(sample)) return 'Subject ID';
          return 'Category';
        }
        return 'Index';
      }
      // y-axis
      const name = (t.name ?? '').toLowerCase();
      if (name.includes('count')) return 'Count (n)';
      if (name.includes('mean')) return 'Mean Value';
      if (name.includes('survival')) return 'Survival Probability';
      if (name.includes('concentration')) return 'Concentration (ng/mL)';
      return 'Value';
    };

    if (!getAxisTitle(lo.xaxis)) {
      const label = deriveLabel(pd, 'x');
      lo.xaxis = { ...lo.xaxis, title: { text: label, font: axisFont, standoff: 15 } };
    }
    if (!getAxisTitle(lo.yaxis)) {
      const label = deriveLabel(pd, 'y');
      lo.yaxis = { ...lo.yaxis, title: { text: label, font: axisFont, standoff: 15 } };
    }

    // Ensure chart always has a title inside the Plotly area (for exports)
    if (!lo.title || (typeof lo.title === 'object' && !lo.title.text)) {
      const fallbackTitle = config?.title ?? 'Analysis Results';
      lo.title = {
        text: `<b>${fallbackTitle}</b>`,
        font: { size: 14, color: '#1a2332', family: 'Arial, sans-serif' },
        x: 0.5,
        xanchor: 'center' as const,
        y: 0.98,
        yanchor: 'top' as const,
      };
      lo.margin = { ...lo.margin, t: Math.max(lo.margin?.t ?? 60, 70) };
    }

    // Auto-rotate dense x-axis labels — skip if user set explicit rotation
    const xCount = (pd[0] as any)?.x?.length ?? 0;
    if (xCount > 20 && custOverrides?.xAxisRotation === undefined) {
      lo.xaxis = {
        ...lo.xaxis,
        tickangle: xCount > 30 ? -90 : -45,
        tickfont: { ...(lo.xaxis?.tickfont ?? {}), size: xCount > 30 ? 9 : 11 },
      };
      lo.margin = { ...lo.margin, b: Math.max(lo.margin?.b ?? 80, xCount > 30 ? 120 : 100) };
    }

    // Add reference/citation as annotation at bottom (appears in exports)
    const ref = config?.chartData?.reference;
    if (ref && typeof ref === 'string') {
      const existingAnnotations = Array.isArray(lo.annotations) ? lo.annotations : [];
      lo.annotations = [
        ...existingAnnotations,
        {
          text: ref,
          xref: 'paper', yref: 'paper',
          x: 0, y: -0.22,
          xanchor: 'left', yanchor: 'top',
          showarrow: false,
          font: { size: 9, color: '#5a7a96', family: 'Arial, sans-serif' },
        },
      ];
      lo.margin = { ...lo.margin, b: Math.max(lo.margin?.b ?? 80, 130) };
    }

    // ── PERMANENT GUARD: Auto-detect categorical X-axis + smart label sizing ──
    // Runs LAST so nothing downstream can overwrite it.
    // If traces have string X values that aren't parseable numbers, force categorical axis.
    if (pd && pd.length > 0) {
      const firstX = (pd[0] as any)?.x;
      if (firstX && Array.isArray(firstX) && firstX.length > 0) {
        const allStrings = firstX.every((v: any) => typeof v === 'string');
        const hasNonNumeric = firstX.some((v: any) => typeof v === 'string' && isNaN(Number(v)));

        if (allStrings && hasNonNumeric) {
          // Force categorical axis
          const labelConfig = calculateXAxisLabelConfig(firstX);
          lo.xaxis = {
            ...lo.xaxis,
            type: 'category',
            categoryorder: 'array',
            categoryarray: firstX,
            ...labelConfig,
          };

          // Expand bottom margin to accommodate angled labels
          const maxLen = Math.max(...firstX.map((v: any) => String(v).length));
          const extraBottom = Math.min(maxLen * 3, 80);
          lo.margin = {
            ...lo.margin,
            b: Math.max(lo.margin?.b ?? 80, 120 + extraBottom),
          };
        } else {
          // Even for numeric x, ensure automargin
          lo.xaxis = { ...lo.xaxis, automargin: true };
        }
      }
    }

    return { plotData: pd, layout: lo };
  }, [basePlotData, baseLayout, custOverrides]);

  // Debug: log final traces and layout being rendered + error bar validation
  useEffect(() => {
    console.log('=== PLOTLY DEBUG ===');
    console.log('Number of traces:', plotData?.length);
    if (plotData?.[0]) {
      const t0 = plotData[0] as any;
      console.log('First trace type:', t0.type);
      console.log('First trace x (first 5):', t0.x?.slice(0, 5));
      console.log('First trace y (first 5):', t0.y?.slice(0, 5));
      console.log('X value type:', typeof t0.x?.[0]);
      console.log('Has error bars:', !!t0.error_y);
      if (t0.error_y) {
        console.log('Error bar config:', JSON.stringify(t0.error_y));
      }
    }
    // Error bar validation: check if chartData had error bars but traces don't
    const cd = config.chartData;
    if (cd) {
      const sourceHasErrors = cd.error_y || cd.error_bars || cd.ci_lower || cd.ci_upper || cd.sd || cd.SD || cd.show_error_bars
        || cd.datasets?.some((ds: any) => ds.error_y || ds.sd || ds.SD || ds.SEM || ds.sem || ds._ci_lower || ds.ci_lower);
      const tracesHaveErrors = plotData?.some((t: any) => t.error_y?.visible && t.error_y?.array?.length > 0);
      if (sourceHasErrors && !tracesHaveErrors) {
        console.error('[ERROR BAR VALIDATION FAILED] chartData has error bar data but no traces have visible error bars.');
        console.error('chartData error fields:', {
          error_y: typeof cd.error_y, error_bars: typeof cd.error_bars,
          ci_lower: typeof cd.ci_lower, ci_upper: typeof cd.ci_upper,
          show_error_bars: cd.show_error_bars,
          dataset0_error_y: typeof cd.datasets?.[0]?.error_y,
          dataset0_sd: typeof cd.datasets?.[0]?.sd,
          dataset0_SD: typeof cd.datasets?.[0]?.SD,
        });
        // Surface to user instead of only logging
        if (onValidationWarning) {
          onValidationWarning(
            'Error bars were requested but could not be rendered — the AI response did not include valid error bar values. Try toggling "Show Error Bars" in Customize to compute from your raw data.'
          );
        }
      }
    }
    console.log('Layout xaxis type:', (layout as any)?.xaxis?.type);
    console.log('=== END DEBUG ===');
  }, [plotData, layout, config.chartData]);

  // Revision counter — state-based so React actually re-renders the <Plot> component.
  // react-plotly.js compares the `revision` prop and calls Plotly.react when it changes.
  const [plotRevision, setPlotRevision] = useState(0);
  useEffect(() => {
    setPlotRevision((r) => r + 1);
  }, [layout, plotData]);

  // ── Plotly imperative helpers ──────────────────────────────────────────
  const applyRestyle = useCallback((update: Record<string, any>, traceIdx: number) => {
    const el = plotRef.current?.el;
    if (!el) return;
    // @ts-ignore
    import('plotly.js/dist/plotly').then((mod: any) => {
      const Plotly = mod.default ?? mod;
      Plotly.restyle(el, update, [traceIdx]);
    }).catch(() => {});
  }, []);

  const applyRelayout = useCallback((update: Record<string, any>) => {
    const el = plotRef.current?.el;
    if (!el) return;
    // @ts-ignore
    import('plotly.js/dist/plotly').then((mod: any) => {
      const Plotly = mod.default ?? mod;
      Plotly.relayout(el, update);
    }).catch(() => {});
  }, []);

  const highlightTrace = useCallback((traceIdx: number) => {
    const el = plotRef.current?.el;
    if (!el) return;
    // @ts-ignore
    import('plotly.js/dist/plotly').then((mod: any) => {
      const Plotly = mod.default ?? mod;
      plotData.forEach((_: any, i: number) => {
        Plotly.restyle(el, { opacity: i === traceIdx ? 1 : 0.35 }, [i]);
      });
    }).catch(() => {});
  }, [plotData]);

  const resetHighlight = useCallback(() => {
    const el = plotRef.current?.el;
    if (!el) return;
    // @ts-ignore
    import('plotly.js/dist/plotly').then((mod: any) => {
      const Plotly = mod.default ?? mod;
      plotData.forEach((_: any, i: number) => {
        Plotly.restyle(el, { opacity: 1 }, [i]);
      });
    }).catch(() => {});
  }, [plotData]);

  // ── Click-to-edit popover state ────────────────────────────────────────
  const [editPopover, setEditPopover] = useState<{
    traceIdx: number;
    pointIdx: number;
    x: any;
    y: number;
    trace: string;
    color: string;
    screenX: number;
    screenY: number;
    chartType: string;
  } | null>(null);
  const [editValues, setEditValues] = useState<{ y: string; color: string; label: string }>({ y: '', color: '', label: '' });
  const editPopoverRef = useRef<HTMLDivElement>(null);

  const closeEditPopover = useCallback(() => {
    setEditPopover(null);
    setSelectedPoint(null);
    resetHighlight();
  }, [resetHighlight]);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!editPopover) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeEditPopover(); };
    const handleClick = (e: MouseEvent) => {
      if (editPopoverRef.current && !editPopoverRef.current.contains(e.target as Node)) {
        closeEditPopover();
      }
    };
    window.addEventListener('keydown', handleKey);
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 100);
    return () => { window.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick); clearTimeout(timer); };
  }, [editPopover, closeEditPopover]);

  const handlePlotlyClick = useCallback(
    (event: any) => {
      const point = event.points?.[0];
      if (!point) { setEditPopover(null); return; }

      const traceIdx = point.curveNumber ?? 0;
      const pointIdx = point.pointNumber ?? 0;
      const traceData = point.data ?? {};
      const chartType = traceData.type ?? 'scatter';
      // Get per-point color or series color
      const markerColors = traceData.marker?.color;
      const pointColor = Array.isArray(markerColors) ? markerColors[pointIdx] : (typeof markerColors === 'string' ? markerColors : traceData.line?.color ?? '#3b82f6');

      const clicked = {
        x: point.x,
        y: point.y as number,
        trace: traceData.name ?? 'Unknown',
        data: point,
      };

      setSelectedPoint({ x: clicked.x, y: clicked.y, trace: clicked.trace });
      onPointClick?.(clicked);

      // Get screen position from the event
      const bbox = (event.event as MouseEvent);
      const screenX = bbox?.clientX ?? 300;
      const screenY = bbox?.clientY ?? 200;

      setEditPopover({
        traceIdx, pointIdx,
        x: clicked.x, y: clicked.y, trace: clicked.trace,
        color: pointColor,
        screenX, screenY, chartType,
      });
      setEditValues({
        y: String(clicked.y),
        color: pointColor,
        label: String(clicked.x),
      });

      // Highlight the clicked trace
      highlightTrace(traceIdx);
    },
    [onPointClick, highlightTrace]
  );

  // ── Context menu state ──────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number;
    pointX: number; pointY: number;
    trace: string; traceIdx: number; pointIdx: number;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Only show context menu if a point was recently clicked
    if (selectedPoint) {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        pointX: selectedPoint.x,
        pointY: selectedPoint.y,
        trace: selectedPoint.trace,
        traceIdx: 0,
        pointIdx: 0,
      });
    }
  }, [selectedPoint]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Close context menu on outside click
  const chartContainerRef = useRef<HTMLDivElement>(null);

  if (plotData.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        No chart data available
      </div>
    );
  }

  // ── Extract text values for editable HTML overlays ────────────────────────
  const resolvedTitle = (() => {
    const t = (layout as any)?.title;
    if (!t) return '';
    if (typeof t === 'string') return t;
    const raw = t.text ?? '';
    // Strip Plotly bold tags for display
    return raw.replace(/<\/?b>/gi, '');
  })();

  const resolvedSubtitle = custOverrides?.subtitle ?? '';

  const resolvedXLabel = (() => {
    const ax = (layout as any)?.xaxis?.title;
    if (!ax) return '';
    if (typeof ax === 'string') return ax;
    return ax.text ?? '';
  })();

  const resolvedYLabel = (() => {
    const ax = (layout as any)?.yaxis?.title;
    if (!ax) return '';
    if (typeof ax === 'string') return ax;
    return ax.text ?? '';
  })();

  // Build a layout copy that suppresses Plotly's own title + axis title text
  // so our HTML overlays don't double-render.
  const plotLayout = useMemo(() => {
    const lo: any = { ...layout };
    // Hide Plotly title — we render it as HTML above the chart
    lo.title = { ...(typeof lo.title === 'object' ? lo.title : {}), text: '' };
    // Reduce top margin since our HTML title is outside
    lo.margin = { ...lo.margin, t: Math.max((lo.margin?.t ?? 60) - 30, 35) };
    return lo;
  }, [layout]);

  return (
    <div className="flex flex-col">
      {/* Editable chart title — HTML overlay above the Plotly SVG */}
      {resolvedTitle && (
        <div style={{ padding: '10px 16px 2px', textAlign: 'center' }}>
          <InlineEditableText
            value={resolvedTitle}
            onCommit={(v) => onLabelEdit?.('chartTitle', v)}
            style={{ fontSize: 14, fontWeight: 700, color: '#1a2332', fontFamily: 'Arial, sans-serif', display: 'inline-block', maxWidth: '90%' }}
            placeholder="Chart title"
          />
          {resolvedSubtitle && (
            <div style={{ marginTop: 2 }}>
              <InlineEditableText
                value={resolvedSubtitle}
                onCommit={(v) => onLabelEdit?.('subtitle', v)}
                style={{ fontSize: 11, fontWeight: 400, color: '#64748b', fontFamily: 'Arial, sans-serif', display: 'inline-block' }}
                placeholder="Subtitle"
              />
            </div>
          )}
        </div>
      )}

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="relative rounded-lg flex-1"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          minHeight: 400,
          overflowX: (plotData[0] as any)?.x?.length > 30 ? 'auto' : 'hidden',
          overflowY: 'hidden',
        }}
        onContextMenu={handleContextMenu}
      >
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center gap-2 text-sm text-slate-400"
              style={{ minHeight: 400 }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading chart...
            </div>
          }
        >
          <Plot
            ref={plotRef}
            revision={plotRevision}
            data={plotData as any}
            layout={
              {
                ...plotLayout,
                width: undefined,
                height: undefined,
                autosize: true,
              } as any
            }
            config={{
              responsive: true,
              displayModeBar: false,
              displaylogo: false,
            }}
            onClick={handlePlotlyClick}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>

        {/* Click-to-edit popover */}
        {editPopover && (
          <div
            ref={editPopoverRef}
            className="fixed z-[400] bg-white rounded-xl shadow-xl border border-[#e2e8f0]"
            style={{
              left: Math.min(editPopover.screenX, window.innerWidth - 240),
              top: Math.min(editPopover.screenY - 10, window.innerHeight - 320),
              width: 220,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#f1f5f9]">
              <span className="text-xs font-semibold text-[#0f172a] truncate" style={{ maxWidth: 160 }}>
                {editPopover.trace}
              </span>
              <button onClick={closeEditPopover} className="p-0.5 rounded hover:bg-[#f1f5f9] text-[#94a3b8] hover:text-[#0f172a] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-2.5">
              {/* Value */}
              <div>
                <label className="text-[10px] font-medium text-[#64748b] block mb-0.5">Value (Y)</label>
                <input
                  type="number"
                  step="any"
                  value={editValues.y}
                  onChange={(e) => {
                    setEditValues(v => ({ ...v, y: e.target.value }));
                    const num = parseFloat(e.target.value);
                    if (!isNaN(num)) {
                      const el = plotRef.current?.el;
                      if (!el) return;
                      const currentY = [...(el.data?.[editPopover.traceIdx]?.y ?? [])];
                      currentY[editPopover.pointIdx] = num;
                      applyRestyle({ y: [currentY] }, editPopover.traceIdx);
                    }
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 text-[#0f172a]"
                />
              </div>
              {/* Color */}
              <div>
                <label className="text-[10px] font-medium text-[#64748b] block mb-0.5">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editValues.color}
                    onChange={(e) => {
                      setEditValues(v => ({ ...v, color: e.target.value }));
                      const el = plotRef.current?.el;
                      if (!el) return;
                      const traceData = el.data?.[editPopover.traceIdx];
                      if (!traceData) return;
                      // For bar charts: set per-bar color array
                      if (editPopover.chartType === 'bar') {
                        const colors = Array.isArray(traceData.marker?.color)
                          ? [...traceData.marker.color]
                          : Array(traceData.y?.length ?? 1).fill(traceData.marker?.color ?? '#3b82f6');
                        colors[editPopover.pointIdx] = e.target.value;
                        applyRestyle({ 'marker.color': [colors] }, editPopover.traceIdx);
                      } else {
                        // For line/scatter: set series color
                        applyRestyle({ 'marker.color': e.target.value, 'line.color': e.target.value }, editPopover.traceIdx);
                      }
                    }}
                    className="w-7 h-7 rounded border border-[#e2e8f0] cursor-pointer p-0"
                  />
                  <span className="text-[10px] text-[#64748b] font-mono">{editValues.color}</span>
                </div>
              </div>
              {/* Asterisk annotations */}
              <div>
                <label className="text-[10px] font-medium text-[#64748b] block mb-1">Add Significance</label>
                <div className="flex gap-1">
                  {['*', '**', '***', 'ns'].map(sig => (
                    <button
                      key={sig}
                      onClick={() => {
                        const el = plotRef.current?.el;
                        if (!el) return;
                        const existing = [...(el.layout?.annotations ?? [])];
                        existing.push({
                          x: editPopover.x,
                          y: editPopover.y,
                          text: `<b>${sig}</b>`,
                          showarrow: false,
                          font: { size: sig === 'ns' ? 10 : 14, color: '#1a2332' },
                          yshift: 15,
                          xref: 'x',
                          yref: 'y',
                        });
                        applyRelayout({ annotations: existing });
                        toast.success(`Added ${sig} annotation`);
                      }}
                      className="flex-1 px-1.5 py-1 text-[11px] font-semibold border border-[#e2e8f0] rounded hover:bg-[#f1f5f9] text-[#374151] transition-colors"
                    >
                      {sig}
                    </button>
                  ))}
                </div>
              </div>
              {/* Delete point */}
              <button
                onClick={() => {
                  const el = plotRef.current?.el;
                  if (!el) return;
                  const traceData = el.data?.[editPopover.traceIdx];
                  if (!traceData) return;
                  const newX = (traceData.x ?? []).filter((_: any, i: number) => i !== editPopover.pointIdx);
                  const newY = (traceData.y ?? []).filter((_: any, i: number) => i !== editPopover.pointIdx);
                  applyRestyle({ x: [newX], y: [newY] }, editPopover.traceIdx);
                  closeEditPopover();
                  toast.success('Data point removed');
                }}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete Point
              </button>
            </div>
            {/* Footer hint */}
            <div className="px-3 py-1.5 border-t border-[#f1f5f9] text-[9px] text-[#94a3b8]">
              x: {String(editPopover.x)} · Press Esc to close
            </div>
          </div>
        )}

        {/* Right-click context menu */}
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-[300]" onClick={closeContextMenu} />
            <div
              className="fixed z-[301] bg-white rounded-lg shadow-lg border border-[#e2e8f0] py-1 min-w-[180px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <div className="px-3 py-1.5 border-b border-[#e2e8f0]">
                <p className="text-[10px] font-semibold text-[#0f172a]">{contextMenu.trace}</p>
                <p className="text-[9px] text-[#94a3b8]">x: {contextMenu.pointX}, y: {Number(contextMenu.pointY).toFixed(2)}</p>
              </div>
              {[
                { label: 'Add Asterisk *', action: 'add_asterisk_1' },
                { label: 'Add Asterisk **', action: 'add_asterisk_2' },
                { label: 'Add Asterisk ***', action: 'add_asterisk_3' },
                { label: 'Add Error Bar', action: 'add_error_bar' },
                { label: 'Add Label', action: 'add_point_label' },
                { label: 'Edit Value', action: 'edit_value' },
                { label: 'Change Color', action: 'change_point_color' },
                { label: 'Change Shape', action: 'change_point_shape' },
              ].map(({ label, action }) => (
                <button
                  key={action}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#374151] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
                  onClick={() => {
                    onEditAction?.(action, {
                      x: contextMenu.pointX,
                      y: contextMenu.pointY,
                      trace: contextMenu.trace,
                    });
                    closeContextMenu();
                  }}
                >
                  {label}
                </button>
              ))}
              <div className="h-px bg-[#e2e8f0] my-1 mx-2" />
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => {
                  onEditAction?.('delete_point', {
                    x: contextMenu.pointX,
                    y: contextMenu.pointY,
                    trace: contextMenu.trace,
                  });
                  closeContextMenu();
                }}
              >
                Delete Point
              </button>
            </div>
          </>
        )}
      </div>

      {onEditAction && (
        <div className="flex flex-wrap items-center gap-2 mt-3 px-1">
          <ActionButton
            icon={Tag}
            label="Add Labels"
            onClick={() => onEditAction('add_labels', selectedPoint)}
          />
          <ActionButton
            icon={BarChart2}
            label="Bar at Month 12"
            onClick={() => onEditAction('bar_at_month_12', selectedPoint)}
          />
          <ActionButton
            icon={Table2}
            label="Pairwise Table"
            onClick={() => onEditAction('pairwise_table', selectedPoint)}
          />
          <ActionButton
            icon={Percent}
            label="Percent Improvement"
            onClick={() => onEditAction('percent_improvement', selectedPoint)}
          />
          <ActionButton
            icon={TrendingDown}
            label="Add Trendline"
            onClick={() => onEditAction('add_trendline', selectedPoint)}
          />
        </div>
      )}

      {/* Editable axis labels below chart */}
      {onLabelEdit && (resolvedXLabel || resolvedYLabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px 0', gap: 16 }}>
          {resolvedYLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Y:</span>
              <InlineEditableText
                value={resolvedYLabel}
                onCommit={(v) => onLabelEdit('yLabel', v)}
                style={{ fontSize: 11, color: '#64748b', fontFamily: 'Arial, sans-serif' }}
                placeholder="Y-axis label"
              />
            </div>
          )}
          {resolvedXLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>X:</span>
              <InlineEditableText
                value={resolvedXLabel}
                onCommit={(v) => onLabelEdit('xLabel', v)}
                style={{ fontSize: 11, color: '#64748b', fontFamily: 'Arial, sans-serif' }}
                placeholder="X-axis label"
              />
            </div>
          )}
        </div>
      )}

      {/* Reference / citation below chart — editable */}
      {config.chartData?.reference && (
        <div
          style={{
            fontSize: '11px',
            color: '#5a7a96',
            fontStyle: 'italic',
            padding: '8px 16px',
            borderTop: '1px solid #e2e8f0',
            lineHeight: 1.5,
          }}
        >
          {config.chartData.reference}
        </div>
      )}
    </div>
  );
}
