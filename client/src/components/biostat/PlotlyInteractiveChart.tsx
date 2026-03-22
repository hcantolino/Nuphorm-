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
  Download,
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
    xAxisMin?: number | null;
    xAxisMax?: number | null;
    yAxisMin?: number | null;
    yAxisMax?: number | null;
    yAxisLog?: boolean;
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
    showDataLabels?: boolean;
    strokeWidth?: number;
    markerSize?: number;
  };
  onPointClick?: (point: { x: number; y: number; trace: string; data?: any }) => void;
  onEditAction?: (action: string, context?: any) => void;
  height?: number;
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

  if (seriesCount <= 3) {
    legend = { orientation: 'h', x: 0.5, y: -0.12, xanchor: 'center', yanchor: 'top', font: { size: 11 }, bgcolor: 'rgba(255,255,255,0)', borderwidth: 0, itemwidth: 30, tracegroupgap: 15 };
    margin = { l: 80, r: 30, t: 80, b: 80 };
  } else if (seriesCount <= 8) {
    legend = { orientation: 'v', x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', font: { size: 10 }, bgcolor: 'rgba(255,255,255,0.95)', bordercolor: '#e0e0e0', borderwidth: 1, itemwidth: 25, tracegroupgap: 3 };
    margin = { l: 80, r: Math.min(legendWidth + 20, 200), t: 80, b: 60 };
  } else {
    legend = { orientation: 'v', x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', font: { size: 9 }, bgcolor: 'rgba(255,255,255,0.95)', bordercolor: '#e0e0e0', borderwidth: 1, itemwidth: 20, tracegroupgap: 1, itemsizing: 'constant' };
    margin = { l: 80, r: Math.min(legendWidth + 15, 180), t: 80, b: 60 };
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
  margin: { l: 80, r: 120, t: 80, b: 80 },
  modebar: { orientation: 'h', bgcolor: 'transparent', color: '#8fa3b8', activecolor: '#2b7de9' } as any,
  showlegend: true,
  legend: {
    bgcolor: 'rgba(255,255,255,0.9)',
    bordercolor: '#cccccc',
    borderwidth: 1,
    font: { size: 11, family: 'Arial, sans-serif' },
    x: 1.02,
    y: 1,
    xanchor: 'left' as const,
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

  const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => {
    let xVals: number[] = [];
    let yVals: number[] = [];

    if (ds.data && Array.isArray(ds.data) && ds.data.length > 0 && typeof ds.data[0] === 'object') {
      xVals = ds.data.map((d: any) => d.x ?? 0);
      yVals = ds.data.map((d: any) => d.y ?? 0);
    } else {
      xVals = chartData.labels?.map((l: any) => parseFloat(l) || 0) ?? [];
      yVals = ds.data ?? [];
    }

    return {
      x: xVals,
      y: yVals,
      mode: 'markers' as const,
      name: ds.label ?? `Series ${i + 1}`,
      type: 'scatter' as const,
      marker: {
        color: ds.color ?? ds.borderColor ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
        size: 8,
        opacity: 0.75,
        line: { color: 'white', width: 0.5 },
      },
      hovertemplate: `<b>${ds.label ?? `Series ${i + 1}`}</b><br>x: %{x:.2f}<br>y: %{y:.2f}<extra></extra>`,
    };
  });

  return {
    plotData,
    layout: {
      xaxis: { title: { text: chartData.x_axis ?? chartData.xLabel ?? 'X' }, ...GRID_STYLE },
      yaxis: { title: { text: chartData.y_axis ?? chartData.yLabel ?? 'Y' }, ...GRID_STYLE },
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
]);

/** Auto-detect if LLM chart_data should render via Plotly instead of Recharts */
export function isSurvivalChartData(chartData: any): boolean {
  return isPlotlyChartData(chartData);
}

export function isPlotlyChartData(chartData: any): boolean {
  if (!chartData) return false;

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

/** Resolve error bar data from dataset or chart-level error_bars array */
function resolveErrorBars(ds: any, chartData: any, seriesName: string): any {
  try {
    // Dataset-level error bars
    const errArr = ds?.error_y ?? ds?.sem ?? ds?.error ?? ds?.errorBars ?? ds?.sd;
    if (errArr && Array.isArray(errArr) && errArr.length > 0) {
      return {
        type: 'data' as const,
        array: errArr,
        visible: true,
        color: ds?.color ?? '#64748b',
        thickness: 1.5,
        width: 4,
      };
    }
    // Chart-level error_bars array (from AI prompt)
    if (chartData?.error_bars && Array.isArray(chartData.error_bars)) {
      const match = chartData.error_bars.find((eb: any) => eb?.series === seriesName);
      if (match?.values && Array.isArray(match.values)) {
        return {
          type: 'data' as const,
          array: match.values,
          visible: true,
          color: ds?.color ?? '#64748b',
          thickness: 1.5,
          width: 4,
        };
      }
    }
  } catch { /* ignore — no error bars */ }
  return undefined;
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

/** Build Plotly traces from generic LLM chart_data (bar/line) */
function buildGenericPlotlyTraces(
  chartData: any,
  mode: string
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const labels = chartData.labels ?? [];
  const datasets = chartData.datasets ?? [];
  const annotations = buildSignificanceAnnotations(chartData);

  // Axis titles with units — fallback to column name from labels/datasets if AI didn't provide
  const rawX = chartData.x_axis ?? chartData.xLabel ?? chartData.x_label
    ?? (labels.length > 0 && typeof labels[0] === 'string' ? 'Category' : 'X');
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

  // Choose palette: use RESEARCH_PALETTE for >2 series, KM for survival-like
  const palette = datasets.length > 2 ? RESEARCH_PALETTE : DEFAULT_PALETTE;

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
  if (['kaplan-meier', 'box', 'boxplot', 'heatmap', 'waterfall', 'forest', 'volcano'].includes(ct)) return ct;
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

    // Guard: if chartData is missing or empty, return empty traces
    if (!chartData || (typeof chartData === 'object' && !chartData.datasets && !chartData.labels && !chartData.z)) {
      return { plotData: [] as Plotly.Data[], layout: { ...LAYOUT_BASE } };
    }

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

    // Legend position — applied AFTER smart sizing so user choice wins
    if (custOverrides.legendPosition) {
      const legendMap: Record<string, Partial<Plotly.Layout['legend']>> = {
        'top-right':    { x: 1, y: 1, xanchor: 'right', yanchor: 'top', orientation: 'v' },
        'top-left':     { x: 0, y: 1, xanchor: 'left', yanchor: 'top', orientation: 'v' },
        'bottom-right': { x: 1, y: 0, xanchor: 'right', yanchor: 'bottom', orientation: 'v' },
        'bottom-left':  { x: 0, y: 0, xanchor: 'left', yanchor: 'bottom', orientation: 'v' },
        'bottom':       { x: 0.5, y: -0.15, xanchor: 'center', yanchor: 'top', orientation: 'h' },
        'top':          { x: 0.5, y: 1.02, xanchor: 'center', yanchor: 'bottom', orientation: 'h' },
        'right':        { x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', orientation: 'v' },
        'left':         { x: -0.15, y: 1, xanchor: 'right', yanchor: 'top', orientation: 'v' },
        'none':         { visible: false } as any,
      };
      const pos = legendMap[custOverrides.legendPosition];
      if (pos) {
        lo.legend = { ...lo.legend, ...pos };
        if (custOverrides.legendPosition === 'none') {
          lo.showlegend = false;
        } else {
          lo.showlegend = true;
        }
      }
    }

    // Legend anchor (fine-grained position: top-right, bottom-left, etc.)
    if (custOverrides.legendAnchor) {
      const anchorMap: Record<string, Partial<Plotly.Layout['legend']>> = {
        'top-right':      { x: 1, y: 1, xanchor: 'right', yanchor: 'top', orientation: 'v' },
        'top-left':       { x: 0, y: 1, xanchor: 'left', yanchor: 'top', orientation: 'v' },
        'bottom-right':   { x: 1, y: 0, xanchor: 'right', yanchor: 'bottom', orientation: 'v' },
        'bottom-left':    { x: 0, y: 0, xanchor: 'left', yanchor: 'bottom', orientation: 'v' },
        'outside-right':  { x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', orientation: 'v' },
        'outside-bottom': { x: 0.5, y: -0.15, xanchor: 'center', yanchor: 'top', orientation: 'h' },
      };
      const pos = anchorMap[custOverrides.legendAnchor];
      if (pos) {
        lo.legend = { ...lo.legend, ...pos };
        lo.showlegend = true;
      }
    }

    // Legend text color — always black, never trace-colored
    lo.legend = {
      ...lo.legend,
      font: { ...(lo.legend?.font ?? {}), color: '#1a2332', family: 'Arial, sans-serif' },
    };

    return { plotData: pd, layout: lo };
  }, [basePlotData, baseLayout, custOverrides]);

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

  const handleExport = useCallback(() => {
    if (plotRef.current?.el) {
      // @ts-ignore — use pre-bundled UMD dist (Vite converts CJS→ESM via optimizeDeps)
      import('plotly.js/dist/plotly').then((mod) => {
        const Plotly = (mod as any).default ?? mod;
        Plotly.downloadImage(plotRef.current!.el, {
          format: 'png',
          width: 1200,
          height: 700,
          filename: (config.title ?? 'chart').replace(/\s+/g, '_'),
        });
      }).catch(() => {
        toast.error('Export failed — Plotly module not available');
      });
    }
  }, [config.title]);

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

  return (
    <div className="flex flex-col">
      {/* Chart action buttons — dedicated row above chart */}
      <div className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0">
        <button
          onClick={() => {
            if (plotRef.current?.el) {
              // @ts-ignore — use pre-bundled UMD dist
              import('plotly.js/dist/plotly').then((mod: any) => {
                const Plotly = mod.default ?? mod;
                Plotly.relayout(plotRef.current!.el, { 'xaxis.autorange': true, 'yaxis.autorange': true });
              }).catch(() => {});
            }
          }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded transition-colors"
          title="Reset zoom to fit all data"
        >
          Fit All
        </button>
        <button
          onClick={() => {
            onEditAction?.('add_labels', selectedPoint);
          }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded transition-colors"
          title="Toggle data value labels"
        >
          Values
        </button>
        <button
          onClick={() => {
            onEditAction?.('add_trendline', selectedPoint);
          }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded transition-colors"
          title="Add trendline"
        >
          Trendline
        </button>
      </div>

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="relative rounded-lg overflow-hidden flex-1"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0', minHeight: 400 }}
        onContextMenu={handleContextMenu}
      >
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center gap-2 text-sm text-slate-400"
              style={{ height }}
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
                ...layout,
                width: undefined,
                height,
                autosize: true,
              } as any
            }
            config={{
              responsive: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'autoScale2d'],
              displaylogo: false,
              toImageButtonOptions: {
                format: 'png',
                filename: config.title ?? 'biostat-chart',
                width: 1200,
                height: 700,
              },
            }}
            onClick={handlePlotlyClick}
            useResizeHandler
            style={{ width: '100%', height }}
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
          <div className="ml-auto">
            <ActionButton icon={Download} label="Export PNG" onClick={handleExport} variant="primary" />
          </div>
        </div>
      )}
    </div>
  );
}
