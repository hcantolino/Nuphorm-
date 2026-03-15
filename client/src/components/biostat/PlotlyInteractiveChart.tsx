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

import { useState, useCallback, lazy, Suspense, useMemo, useRef } from 'react';
import {
  Tag,
  BarChart2,
  Table2,
  TrendingDown,
  Percent,
  Download,
  Loader2,
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

const LAYOUT_BASE: Partial<Plotly.Layout> = {
  paper_bgcolor: '#ffffff',
  plot_bgcolor: '#f8fafc',
  font: { family: 'Inter, system-ui, sans-serif', size: 12, color: '#0f172a' },
  margin: { t: 48, r: 24, b: 56, l: 64 },
  legend: {
    bgcolor: '#ffffffee',
    bordercolor: '#e2e8f0',
    borderwidth: 1,
    x: 1,
    xanchor: 'right' as const,
    y: 1,
  },
  hovermode: 'closest' as const,
};

const GRID_STYLE = { gridcolor: '#e2e8f0', linecolor: '#e2e8f0', zeroline: false };

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
  // Increase top margin: base 48 + 18px per extra line
  const marginTop = 48 + (lineCount - 1) * 18;

  return {
    title: {
      text,
      font: { size: fontSize, color: '#0f172a', family: 'Inter, system-ui, sans-serif' },
      x: 0.5,
      xanchor: 'center' as const,
      y: 0.98,
      yanchor: 'top' as const,
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

    plotData.push({
      x: trace.time,
      y: trace.values,
      mode: 'lines+markers',
      name: trace.name,
      line: { color, width: 2.5, shape: 'hv' },
      marker: { color, size: 4 },
      type: 'scatter',
      hovertemplate: `<b>${trace.name}</b><br>Time: %{x}<br>Value: %{y:.1f}<extra></extra>`,
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
    {
      x: [1, 1],
      y: [labels[0], labels[labels.length - 1]],
      mode: 'lines' as const,
      line: { color: '#9ca3af', dash: 'dot' as const, width: 1.5 },
      showlegend: false,
      type: 'scatter' as const,
    },
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

  if (ds.data && Array.isArray(ds.data) && typeof ds.data[0] === 'object') {
    logFC = ds.data.map((d: any) => d.x ?? 0);
    negLogP = ds.data.map((d: any) => d.y ?? 0);
  } else {
    logFC = chartData.labels?.map((l: any) => parseFloat(l) || 0) ?? [];
    negLogP = ds.data ?? [];
  }

  const sig = logFC.map((fc, i) => Math.abs(fc) > 2 && negLogP[i] > -Math.log10(0.05));

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

    if (ds.data && Array.isArray(ds.data) && typeof ds.data[0] === 'object') {
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

/** Build Plotly traces from generic LLM chart_data (bar/line) */
function buildGenericPlotlyTraces(
  chartData: any,
  mode: string
): { plotData: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const labels = chartData.labels ?? [];
  const datasets = chartData.datasets ?? [];

  if (mode === 'bar' || (!mode && !isPlotlyChartData(chartData))) {
    const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => ({
      x: labels,
      y: ds.data ?? [],
      name: ds.label ?? `Series ${i + 1}`,
      type: 'bar' as const,
      marker: { color: ds.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] },
      error_y: ds.sem
        ? { type: 'data' as const, array: ds.sem, visible: true, color: '#64748b' }
        : undefined,
    }));

    return {
      plotData,
      layout: {
        barmode: 'group' as const,
        xaxis: { title: { text: chartData.xLabel ?? '' }, ...GRID_STYLE },
        yaxis: { title: { text: chartData.yLabel ?? '' }, ...GRID_STYLE },
      },
    };
  }

  // Default: line chart
  const plotData: Plotly.Data[] = datasets.map((ds: any, i: number) => ({
    x: labels,
    y: ds.data ?? [],
    mode: 'lines+markers' as const,
    name: ds.label ?? `Series ${i + 1}`,
    line: { color: ds.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length], width: 2 },
    marker: { size: 5 },
    type: 'scatter' as const,
  }));

  return {
    plotData,
    layout: {
      xaxis: { title: { text: chartData.xLabel ?? '' }, ...GRID_STYLE },
      yaxis: { title: { text: chartData.yLabel ?? '' }, ...GRID_STYLE },
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

  const { plotData, layout } = useMemo(() => {
    const mode = config.mode ?? 'auto';
    const chartData = config.chartData;

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
        const tc = buildTitleConfig(config.title ?? 'Mean PFS by Treatment Group');
        return {
          plotData,
          layout: {
            ...LAYOUT_BASE,
            title: tc.title,
            margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
            xaxis: { title: { text: config.xLabel ?? 'Time (Months)' }, ...GRID_STYLE },
            yaxis: { title: { text: config.yLabel ?? 'Mean PFS (Days)' }, ...GRID_STYLE },
            annotations,
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
          const tc = buildTitleConfig(config.title ?? chartData.title ?? 'Survival Analysis');
          return {
            plotData,
            layout: {
              ...LAYOUT_BASE,
              title: tc.title,
              margin: { ...LAYOUT_BASE.margin, t: tc.marginTop },
              xaxis: { title: { text: config.xLabel ?? 'Time (Months)' }, ...GRID_STYLE },
              yaxis: { title: { text: config.yLabel ?? 'Mean PFS (Days)' }, ...GRID_STYLE },
              annotations,
            },
          };
        }
      }
    }

    // Generic chart from LLM chart_data (bar/line fallback)
    if (chartData) {
      const { plotData, layout: modeLayout } = buildGenericPlotlyTraces(chartData, mode);
      const tc = buildTitleConfig(config.title ?? chartData.title ?? '');
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
  }, [config]);

  const handlePlotlyClick = useCallback(
    (event: any) => {
      const point = event.points?.[0];
      if (!point) return;

      const clicked = {
        x: point.x as number,
        y: point.y as number,
        trace: point.data?.name ?? 'Unknown',
        data: point,
      };

      setSelectedPoint({ x: clicked.x, y: clicked.y, trace: clicked.trace });
      onPointClick?.(clicked);

      toast.info(
        `${clicked.trace} — x: ${clicked.x}, y: ${Number(clicked.y).toFixed(1)}`,
        {
          style: { background: '#f8fafc', color: '#0f172a', borderColor: '#e2e8f0' },
        }
      );
    },
    [onPointClick]
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

  if (plotData.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        No chart data available
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
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
              modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
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

        {selectedPoint && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-blue-200 rounded-lg px-3 py-2 text-xs shadow-sm">
            <div className="font-medium text-blue-700">{selectedPoint.trace}</div>
            <div className="text-slate-500">
              x: {selectedPoint.x}, y: {Number(selectedPoint.y).toFixed(2)}
            </div>
          </div>
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
