/**
 * PharmaChartPanel
 *
 * Interactive, pharma-ready visualization dashboard built on react-plotly.js.
 * Provides 8 chart templates, a customization drawer, and export options
 * (PNG, SVG, and PDF via the Python API). The active chart type can be driven
 * externally via the `requestedChartType` prop so the AI chat can trigger it.
 */

import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import {
  TrendingDown,
  AlignCenter,
  BoxSelect,
  Grid3x3,
  BarChart2,
  Zap,
  ScatterChart,
  LineChart,
  Download,
  Settings2,
  ChevronDown,
  X,
  ImageDown,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Lazy-load react-plotly.js — wrapper ensures { default: ... } shape for React.lazy
const Plot = lazy(() =>
  import('react-plotly.js').then((mod) => ({
    default: (mod as any).default ?? mod,
  }))
);

// ── Types ──────────────────────────────────────────────────────────────────

export type PharmaChartType =
  | 'km'
  | 'forest'
  | 'boxplot'
  | 'heatmap'
  | 'waterfall'
  | 'volcano'
  | 'scatter'
  | 'pkpd';

interface Annotation {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface ChartCustomisation {
  xLabel: string;
  xUnit: string;
  yLabel: string;
  yUnit: string;
  legendTitle: string;
  colorTheme: 'default' | 'nejm' | 'lancet' | 'jama' | 'nature' | 'dark';
  showGrid: boolean;
  showCI: boolean;
  annotations: Annotation[];
}

interface PharmaChartPanelProps {
  /** If set, switch to this chart type (e.g., driven by AI chat) */
  requestedChartType?: PharmaChartType | null;
  onChartTypeChange?: (type: PharmaChartType) => void;
}

// ── Colour palettes ────────────────────────────────────────────────────────

const THEMES: Record<string, string[]> = {
  default:  ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
  nejm:     ['#BC3C29', '#0072B5', '#E18727', '#20854E', '#7876B1', '#6F99AD'],
  lancet:   ['#00468B', '#ED0000', '#42B540', '#0099B4', '#925E9F', '#FDAF91'],
  jama:     ['#374E55', '#DF8F44', '#00A1D5', '#B24745', '#79AF97', '#6A6599'],
  nature:   ['#E64B35', '#4DBBD5', '#00A087', '#3C5488', '#F39B7F', '#8491B4'],
  dark:     ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'],
};

const BG: Record<string, string> = {
  default: 'white', dark: '#1e1e2e', nejm: 'white', lancet: 'white', jama: 'white', nature: 'white',
};

const FONT_COLOR: Record<string, string> = {
  default: '#374151', dark: '#e2e8f0', nejm: '#374151', lancet: '#374151', jama: '#374151', nature: '#374151',
};

// ── Chart type definitions ────────────────────────────────────────────────

const CHART_TYPES: { id: PharmaChartType; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: 'km',        label: 'Kaplan-Meier',   icon: TrendingDown, description: 'Survival curves with log-rank test' },
  { id: 'forest',    label: 'Forest Plot',     icon: AlignCenter,  description: 'Meta-analysis effect sizes + CIs' },
  { id: 'boxplot',   label: 'Box Plot',        icon: BoxSelect,    description: 'Group distributions with outliers' },
  { id: 'heatmap',   label: 'Heatmap',         icon: Grid3x3,      description: 'PK/PD correlation matrix' },
  { id: 'waterfall', label: 'Waterfall',       icon: BarChart2,    description: 'Individual patient response (RECIST)' },
  { id: 'volcano',   label: 'Volcano Plot',    icon: Zap,          description: 'Fold-change vs significance' },
  { id: 'scatter',   label: 'Scatter',         icon: ScatterChart, description: 'Dose–response / exposure–response' },
  { id: 'pkpd',      label: 'PK Time-Course',  icon: LineChart,    description: 'Concentration-time profiles' },
];

// ── Sample-data generators ─────────────────────────────────────────────────

function kmData(colors: string[], showCI: boolean) {
  const time = [0, 1, 3, 6, 9, 12, 15, 18, 21, 24];
  const trt  = [1, 0.92, 0.85, 0.75, 0.64, 0.55, 0.48, 0.42, 0.38, 0.35];
  const ctrl = [1, 0.88, 0.74, 0.58, 0.44, 0.33, 0.24, 0.18, 0.13, 0.10];
  const trtU = trt.map((v) => Math.min(1, v + 0.07));
  const trtL = trt.map((v) => Math.max(0, v - 0.07));
  const ctrlU = ctrl.map((v) => Math.min(1, v + 0.07));
  const ctrlL = ctrl.map((v) => Math.max(0, v - 0.07));

  const traces: Plotly.Data[] = [
    { x: time, y: trt, mode: 'lines', name: 'Treatment (n=120)', line: { color: colors[0], width: 2.5, shape: 'hv' }, type: 'scatter' },
    { x: time, y: ctrl, mode: 'lines', name: 'Control (n=118)', line: { color: colors[1], width: 2.5, shape: 'hv', dash: 'dash' }, type: 'scatter' },
  ];

  if (showCI) {
    traces.push(
      { x: [...time, ...time.slice().reverse()], y: [...trtU, ...trtL.slice().reverse()], fill: 'toself', fillcolor: colors[0] + '25', line: { color: 'transparent' }, showlegend: false, type: 'scatter', hoverinfo: 'skip' },
      { x: [...time, ...time.slice().reverse()], y: [...ctrlU, ...ctrlL.slice().reverse()], fill: 'toself', fillcolor: colors[1] + '25', line: { color: 'transparent' }, showlegend: false, type: 'scatter', hoverinfo: 'skip' },
    );
  }
  return traces;
}

function forestData(colors: string[]) {
  const studies = ['BEACON (2023)', 'CATALYST-1 (2022)', 'NOVA-II (2021)', 'SOLAR (2021)', 'ALPINE (2020)', 'FORTE (2019)', 'Pooled Estimate'];
  const hr   = [0.62, 0.74, 0.58, 0.81, 0.68, 0.72, 0.69];
  const lower= [0.48, 0.56, 0.41, 0.62, 0.51, 0.55, 0.61];
  const upper= [0.80, 0.98, 0.82, 1.06, 0.91, 0.94, 0.78];
  const n    = [n2s(342), n2s(218), n2s(456), n2s(190), n2s(520), n2s(280), n2s(2006)];

  const traces: Plotly.Data[] = [
    {
      x: hr, y: studies,
      error_x: { type: 'data', symmetric: false, array: upper.map((u, i) => u - hr[i]), arrayminus: hr.map((h, i) => h - lower[i]), color: colors[0], thickness: 2, width: 8 },
      mode: 'markers',
      marker: { color: studies.map((_, i) => i === 6 ? colors[2] : colors[0]), size: studies.map((_, i) => i === 6 ? 16 : 10), symbol: studies.map((_, i) => i === 6 ? 'diamond' : 'square') },
      type: 'scatter', orientation: 'h',
      customdata: n, hovertemplate: '<b>%{y}</b><br>HR: %{x:.2f}<br>N: %{customdata}<extra></extra>',
    },
    { x: [1, 1], y: [studies[0], studies[studies.length - 1]], mode: 'lines', line: { color: '#9ca3af', dash: 'dot', width: 1.5 }, showlegend: false, type: 'scatter' },
  ];
  return traces;

  function n2s(n: number) { return n.toLocaleString(); }
}

function boxData(colors: string[]) {
  const seed = (n: number, mu: number, sd: number) =>
    Array.from({ length: n }, () => mu + sd * (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.2);

  return [
    { y: seed(80, 2.1, 0.8), name: 'Placebo', marker: { color: colors[1] }, type: 'box', boxpoints: 'outliers', jitter: 0.3 },
    { y: seed(82, 3.4, 0.9), name: 'Low Dose (5 mg)', marker: { color: colors[0] }, type: 'box', boxpoints: 'outliers', jitter: 0.3 },
    { y: seed(78, 4.2, 1.0), name: 'High Dose (20 mg)', marker: { color: colors[2] }, type: 'box', boxpoints: 'outliers', jitter: 0.3 },
  ] as Plotly.Data[];
}

function heatmapData() {
  const params = ['AUC', 'Cmax', 'Tmax', 'CL', 'Vd', 'T½', 'Ctrough'];
  const n = params.length;
  const z = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      if (i === j) return 1;
      const base = 0.8 - Math.abs(i - j) * 0.15 + (Math.random() - 0.5) * 0.2;
      return Math.max(-1, Math.min(1, base));
    })
  );
  const text = z.map((row) => row.map((v) => v.toFixed(2)));
  return [{ z, x: params, y: params, text: text as unknown as string[], type: 'heatmap', colorscale: 'RdBu', reversescale: true, zmin: -1, zmax: 1, texttemplate: '%{text}', showscale: true }] as Plotly.Data[];
}

function waterfallData(colors: string[]) {
  const changes = [-72, -45, -31, -28, -18, -12, -8, 2, 8, 15, 22, 34, 48];
  const patients = changes.map((_, i) => `Pt ${String(i + 1).padStart(2, '0')}`);
  return [{
    type: 'bar',
    x: patients,
    y: changes,
    marker: {
      color: changes.map((v) => v < -30 ? colors[2] : v < 0 ? colors[0] : colors[1]),
      line: { color: 'white', width: 0.5 },
    },
    hovertemplate: '<b>%{x}</b><br>Change: %{y}%<extra></extra>',
  }] as Plotly.Data[];
}

function volcanoData(colors: string[]) {
  const n = 300;
  const logFC  = Array.from({ length: n }, () => (Math.random() - 0.5) * 8);
  const pval   = Array.from({ length: n }, () => Math.random());
  const negLogP = pval.map((p) => -Math.log10(Math.max(p, 1e-10)));
  const sig = logFC.map((fc, i) => Math.abs(fc) > 2 && pval[i] < 0.05);
  return [{
    x: logFC, y: negLogP, mode: 'markers', type: 'scatter',
    marker: { color: sig.map((s, i) => s ? (logFC[i] > 0 ? colors[0] : colors[1]) : '#d1d5db'), size: 5, opacity: 0.8 },
    hovertemplate: 'log2FC: %{x:.2f}<br>-log10(p): %{y:.2f}<extra></extra>',
  }] as Plotly.Data[];
}

function scatterData(colors: string[]) {
  const doses = [1, 2, 5, 10, 20, 50, 100];
  const mkGroup = (mu: number, sd: number, n = 10) =>
    Array.from({ length: n }, () => mu + sd * (Math.random() - 0.5));

  const x = doses.flatMap((d) => mkGroup(d, d * 0.15));
  const y = doses.flatMap((d, i) => mkGroup(20 + i * 12, 8));

  return [{
    x, y, mode: 'markers', type: 'scatter',
    marker: { color: colors[0], size: 8, opacity: 0.75, line: { color: 'white', width: 0.5 } },
    hovertemplate: 'Dose: %{x} mg<br>Response: %{y:.1f}%<extra></extra>',
  }] as Plotly.Data[];
}

function pkpdData(colors: string[]) {
  const t = [0, 0.25, 0.5, 1, 2, 4, 6, 8, 12, 16, 24];
  const doses = [5, 20, 50];
  return doses.map((d, i) => ({
    x: t,
    y: t.map((time) => d * 2.8 * (Math.exp(-0.12 * time) - Math.exp(-2.1 * time))),
    mode: 'lines+markers',
    name: `${d} mg`,
    line: { color: colors[i], width: 2 },
    marker: { color: colors[i], size: 6 },
    type: 'scatter',
    hovertemplate: `<b>${d} mg</b><br>t=%{x}h<br>C=%{y:.1f} ng/mL<extra></extra>`,
  })) as Plotly.Data[];
}

// ── Layout builder ─────────────────────────────────────────────────────────

function buildLayout(
  type: PharmaChartType,
  custom: ChartCustomisation,
  annotations: Partial<Plotly.Annotations>[],
): Partial<Plotly.Layout> {
  const colors = THEMES[custom.colorTheme];
  const fg = FONT_COLOR[custom.colorTheme];
  const bg = BG[custom.colorTheme];

  const base: Partial<Plotly.Layout> = {
    paper_bgcolor: bg,
    plot_bgcolor: bg,
    font: { family: 'Inter, system-ui, sans-serif', size: 12, color: fg },
    legend: { title: { text: custom.legendTitle || undefined }, bgcolor: bg + 'cc', bordercolor: '#e5e7eb', borderwidth: 1, x: 1, xanchor: 'right', y: 1 },
    margin: { t: 40, r: 30, b: 60, l: 70 },
    annotations,
    shapes: [],
  };

  const gridStyle = { gridcolor: custom.showGrid ? '#e5e7eb' : 'transparent', zerolinecolor: '#9ca3af', linecolor: '#d1d5db' };

  const xLabel = custom.xLabel + (custom.xUnit ? ` (${custom.xUnit})` : '');
  const yLabel = custom.yLabel + (custom.yUnit ? ` (${custom.yUnit})` : '');

  if (type === 'km') {
    return { ...base, xaxis: { title: { text: xLabel || 'Time (months)' }, ...gridStyle, range: [0, 25] }, yaxis: { title: { text: yLabel || 'Survival Probability' }, range: [0, 1.05], tickformat: '.0%', ...gridStyle }, title: { text: 'Kaplan–Meier Survival Estimates', font: { size: 14, color: fg } } };
  }
  if (type === 'forest') {
    return { ...base, xaxis: { title: { text: xLabel || 'Hazard Ratio (95% CI)' }, type: 'log', range: [Math.log10(0.25), Math.log10(2)], ...gridStyle }, yaxis: { autorange: 'reversed', ...gridStyle }, margin: { t: 40, r: 200, b: 60, l: 150 }, title: { text: 'Forest Plot — Overall Survival (HR vs Control)', font: { size: 14, color: fg } } };
  }
  if (type === 'boxplot') {
    return { ...base, xaxis: { title: { text: xLabel || 'Treatment Group' }, ...gridStyle }, yaxis: { title: { text: yLabel || 'Primary Endpoint Score' }, zeroline: true, ...gridStyle }, boxmode: 'group', title: { text: 'Efficacy by Treatment Group', font: { size: 14, color: fg } } };
  }
  if (type === 'heatmap') {
    return { ...base, margin: { t: 50, r: 30, b: 80, l: 80 }, title: { text: 'PK/PD Parameter Correlation Matrix', font: { size: 14, color: fg } } };
  }
  if (type === 'waterfall') {
    return { ...base, xaxis: { title: { text: xLabel || 'Patient ID' }, ...gridStyle }, yaxis: { title: { text: yLabel || 'Best % Change from Baseline' }, zeroline: true, ...gridStyle, zerolinecolor: '#374151', zerolinewidth: 1.5 }, title: { text: 'Waterfall Plot — Best Response (RECIST 1.1)', font: { size: 14, color: fg } }, shapes: [{ type: 'line', x0: -0.5, x1: 12.5, y0: -30, y1: -30, line: { color: colors[2], dash: 'dot', width: 1.5 } }, { type: 'line', x0: -0.5, x1: 12.5, y0: 20, y1: 20, line: { color: colors[1], dash: 'dot', width: 1.5 } }] };
  }
  if (type === 'volcano') {
    return { ...base, xaxis: { title: { text: xLabel || 'log₂ Fold Change' }, zeroline: true, ...gridStyle }, yaxis: { title: { text: yLabel || '−log₁₀(p-value)' }, ...gridStyle }, title: { text: 'Volcano Plot — Differential Expression', font: { size: 14, color: fg } }, shapes: [{ type: 'line', x0: 2, x1: 2, y0: 0, y1: 30, line: { color: '#9ca3af', dash: 'dot', width: 1 } }, { type: 'line', x0: -2, x1: -2, y0: 0, y1: 30, line: { color: '#9ca3af', dash: 'dot', width: 1 } }, { type: 'line', x0: -5, x1: 5, y0: -Math.log10(0.05), y1: -Math.log10(0.05), line: { color: '#9ca3af', dash: 'dot', width: 1 } }] };
  }
  if (type === 'scatter') {
    return { ...base, xaxis: { title: { text: xLabel || 'Dose (mg)' }, type: 'log', ...gridStyle }, yaxis: { title: { text: yLabel || 'Response Rate (%)' }, ...gridStyle }, title: { text: 'Dose–Response Relationship', font: { size: 14, color: fg } } };
  }
  // pkpd
  return { ...base, xaxis: { title: { text: xLabel || 'Time (h)' }, ...gridStyle }, yaxis: { title: { text: yLabel || 'Plasma Concentration (ng/mL)' }, ...gridStyle }, title: { text: 'Mean Concentration-Time Profiles', font: { size: 14, color: fg } } };
}

// ── Default customisation per chart type ──────────────────────────────────

const DEFAULTS: Record<PharmaChartType, Partial<ChartCustomisation>> = {
  km:        { xLabel: 'Time', xUnit: 'months', yLabel: 'Survival Probability', yUnit: '', legendTitle: 'Arm', showCI: true },
  forest:    { xLabel: 'Hazard Ratio', xUnit: '95% CI', yLabel: '', yUnit: '', legendTitle: '', showCI: true },
  boxplot:   { xLabel: 'Group', xUnit: '', yLabel: 'Endpoint', yUnit: '', legendTitle: '' },
  heatmap:   { xLabel: '', xUnit: '', yLabel: '', yUnit: '', legendTitle: '' },
  waterfall: { xLabel: 'Patient', xUnit: '', yLabel: 'Best % Change', yUnit: 'from Baseline', legendTitle: '' },
  volcano:   { xLabel: 'log₂ Fold Change', xUnit: '', yLabel: '−log₁₀(p)', yUnit: '', legendTitle: '' },
  scatter:   { xLabel: 'Dose', xUnit: 'mg', yLabel: 'Response', yUnit: '%', legendTitle: 'Dose Group' },
  pkpd:      { xLabel: 'Time', xUnit: 'h', yLabel: 'Concentration', yUnit: 'ng/mL', legendTitle: 'Dose' },
};

// ── Main component ─────────────────────────────────────────────────────────

export default function PharmaChartPanel({ requestedChartType, onChartTypeChange }: PharmaChartPanelProps) {
  const plotRef = useRef<any>(null);
  const [activeType, setActiveType] = useState<PharmaChartType>('km');
  const [customOpen, setCustomOpen] = useState(false);
  const [annotOpen, setAnnotOpen] = useState(false);

  const defaultCustom = (): ChartCustomisation => ({
    xLabel: '', xUnit: '', yLabel: '', yUnit: '', legendTitle: '',
    colorTheme: 'default', showGrid: true, showCI: true, annotations: [],
  });

  const [custom, setCustom] = useState<ChartCustomisation>(defaultCustom);

  // Apply defaults when chart type changes
  const switchType = useCallback((t: PharmaChartType) => {
    setActiveType(t);
    setCustom((prev) => ({ ...prev, ...DEFAULTS[t], annotations: [] }));
    onChartTypeChange?.(t);
  }, [onChartTypeChange]);

  // Respond to external requests (e.g., AI chat triggering a chart type)
  useEffect(() => {
    if (requestedChartType && requestedChartType !== activeType) {
      switchType(requestedChartType);
    }
  }, [requestedChartType]); // eslint-disable-line react-hooks/exhaustive-deps

  const colors = THEMES[custom.colorTheme];

  const plotData: Plotly.Data[] = (() => {
    switch (activeType) {
      case 'km':        return kmData(colors, custom.showCI);
      case 'forest':    return forestData(colors);
      case 'boxplot':   return boxData(colors);
      case 'heatmap':   return heatmapData();
      case 'waterfall': return waterfallData(colors);
      case 'volcano':   return volcanoData(colors);
      case 'scatter':   return scatterData(colors);
      case 'pkpd':      return pkpdData(colors);
    }
  })();

  const plotAnnotations: Partial<Plotly.Annotations>[] = custom.annotations.map((a) => ({
    text: a.text, x: a.x, y: a.y, showarrow: true, arrowhead: 2, arrowsize: 1, arrowwidth: 1.5,
    font: { size: 11, color: FONT_COLOR[custom.colorTheme] }, bgcolor: BG[custom.colorTheme] + 'dd', borderpad: 3,
  }));

  const layout = buildLayout(activeType, custom, plotAnnotations);

  // ── Export helpers ─────────────────────────────────────────────────────

  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    const el = document.querySelector('.js-plotly-plot') as HTMLElement | null;
    if (!el) { toast.error('Chart not rendered yet'); return; }
    try {
      // @ts-ignore — use the pre-built UMD dist (self-contained, no Node.js deps)
      const Plotly = (await import('plotly.js/dist/plotly')).default as any;
      const data = await Plotly.toImage(el, { format, width: 1800, height: 1000, scale: 2 });
      const a = document.createElement('a');
      a.href = data;
      a.download = `nuphorm_${activeType}_chart.${format}`;
      a.click();
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed — ensure chart is visible');
    }
  }, [activeType]);

  const exportPDF = useCallback(async () => {
    try {
      const el = document.querySelector('.js-plotly-plot') as HTMLElement | null;
      if (!el) { toast.error('Chart not rendered yet'); return; }
      // @ts-ignore — use the pre-built UMD dist (self-contained, no Node.js deps)
      const Plotly = (await import('plotly.js/dist/plotly')).default as any;
      const pngData = await Plotly.toImage(el, { format: 'png', width: 1800, height: 1000, scale: 2 });
      // Call Python backend for PDF assembly with regulatory header
      const res = await fetch('/api/v1/compliance/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: pngData.split(',')[1], chart_type: activeType, title: (layout.title as any)?.text ?? 'NuPhorm Analysis' }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `nuphorm_${activeType}.pdf`; a.click();
        URL.revokeObjectURL(url);
        toast.success('PDF exported');
      } else {
        // Fallback: download PNG
        const a = document.createElement('a');
        a.href = pngData; a.download = `nuphorm_${activeType}.png`; a.click();
        toast.info('PDF API unavailable — exported as PNG');
      }
    } catch {
      toast.error('Export failed');
    }
  }, [activeType, layout]);

  // ── New annotation form ────────────────────────────────────────────────

  const [annotText, setAnnotText] = useState('');
  const [annotX, setAnnotX] = useState('');
  const [annotY, setAnnotY] = useState('');

  const addAnnotation = () => {
    if (!annotText.trim()) return;
    setCustom((prev) => ({
      ...prev,
      annotations: [...prev.annotations, { id: Date.now().toString(), text: annotText, x: parseFloat(annotX) || 0, y: parseFloat(annotY) || 0 }],
    }));
    setAnnotText(''); setAnnotX(''); setAnnotY('');
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ── Chart type selector ────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHART_TYPES.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              onClick={() => switchType(id)}
              title={description}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                activeType === id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent'
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Customise toggle */}
          <button
            onClick={() => setCustomOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              customOpen ? 'bg-gray-100 text-gray-700 border-gray-200' : 'text-muted-foreground hover:bg-muted border-transparent'
            )}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Customise</span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', customOpen && 'rotate-180')} />
          </button>

          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-transparent text-muted-foreground hover:bg-muted transition-colors">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg border border-gray-200 shadow-lg z-20 hidden group-hover:block">
              <button onClick={() => exportImage('png')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-t-lg transition-colors">
                <ImageDown className="w-3.5 h-3.5 text-blue-500" /> Export PNG
              </button>
              <button onClick={() => exportImage('svg')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                <ImageDown className="w-3.5 h-3.5 text-blue-500" /> Export SVG
              </button>
              <button onClick={exportPDF} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-b-lg transition-colors">
                <FileDown className="w-3.5 h-3.5 text-red-500" /> Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customisation panel ────────────────────────────────────────── */}
      {customOpen && (
        <div className="flex-shrink-0 border-b border-border bg-gray-50/50 px-3 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {/* X-axis label */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">X-axis Label</label>
              <input value={custom.xLabel} onChange={(e) => setCustom((p) => ({ ...p, xLabel: e.target.value }))} placeholder="e.g. Time" className="w-full text-xs rounded border border-border px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">X Unit</label>
              <input value={custom.xUnit} onChange={(e) => setCustom((p) => ({ ...p, xUnit: e.target.value }))} placeholder="e.g. months" className="w-full text-xs rounded border border-border px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Y-axis Label</label>
              <input value={custom.yLabel} onChange={(e) => setCustom((p) => ({ ...p, yLabel: e.target.value }))} placeholder="e.g. Response" className="w-full text-xs rounded border border-border px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Y Unit</label>
              <input value={custom.yUnit} onChange={(e) => setCustom((p) => ({ ...p, yUnit: e.target.value }))} placeholder="e.g. %" className="w-full text-xs rounded border border-border px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Color theme */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Theme:</label>
              <select value={custom.colorTheme} onChange={(e) => setCustom((p) => ({ ...p, colorTheme: e.target.value as ChartCustomisation['colorTheme'] }))} className="text-xs rounded border border-border px-2 py-0.5 bg-background focus:outline-none">
                <option value="default">Default</option>
                <option value="nejm">NEJM</option>
                <option value="lancet">Lancet</option>
                <option value="jama">JAMA</option>
                <option value="nature">Nature</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            {/* Toggles */}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={custom.showGrid} onChange={(e) => setCustom((p) => ({ ...p, showGrid: e.target.checked }))} className="accent-primary rounded" />
              Grid
            </label>
            {(activeType === 'km') && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={custom.showCI} onChange={(e) => setCustom((p) => ({ ...p, showCI: e.target.checked }))} className="accent-primary rounded" />
                95% CI bands
              </label>
            )}

            {/* Annotation toggle */}
            <button onClick={() => setAnnotOpen((v) => !v)} className="text-xs text-blue-600 underline">
              {annotOpen ? 'Hide annotations' : 'Add annotation'}
            </button>
          </div>

          {/* Annotation form */}
          {annotOpen && (
            <div className="mt-2 flex items-end gap-2 flex-wrap">
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Text</label>
                <input value={annotText} onChange={(e) => setAnnotText(e.target.value)} placeholder="e.g. Median PFS" className="text-xs rounded border border-border px-2 py-1 w-32 bg-background focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">X</label>
                <input value={annotX} onChange={(e) => setAnnotX(e.target.value)} placeholder="x" className="text-xs rounded border border-border px-2 py-1 w-16 bg-background focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Y</label>
                <input value={annotY} onChange={(e) => setAnnotY(e.target.value)} placeholder="y" className="text-xs rounded border border-border px-2 py-1 w-16 bg-background focus:outline-none" />
              </div>
              <button onClick={addAnnotation} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md">Add</button>
              {custom.annotations.map((a) => (
                <span key={a.id} className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                  {a.text}
                  <button onClick={() => setCustom((p) => ({ ...p, annotations: p.annotations.filter((x) => x.id !== a.id) }))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chart ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading chart engine…
          </div>
        }>
          <Plot
            ref={plotRef}
            data={plotData}
            layout={{
              ...layout,
              autosize: true,
              font: { ...(layout.font ?? {}), family: 'Inter, system-ui, sans-serif' },
            }}
            config={{
              displayModeBar: true,
              displaylogo: false,
              modeBarButtonsToRemove: ['sendDataToCloud'],
              responsive: true,
              toImageButtonOptions: { format: 'png', filename: `nuphorm_${activeType}`, height: 1000, width: 1800, scale: 2 },
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </Suspense>

        {/* Pharma-ready badge */}
        <div className="absolute bottom-2 right-2 text-[9px] text-gray-400 bg-white/80 px-1.5 py-0.5 rounded border border-gray-200">
          NuPhorm · Pharma-Ready · {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
