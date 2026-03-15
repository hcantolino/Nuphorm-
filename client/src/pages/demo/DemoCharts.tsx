import { useState, useMemo } from "react";
import Plot from "react-plotly.js";
import {
  Maximize2,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  PATIENT_DATA,
  DESCRIPTIVE_VARS,
  VAR_LABELS,
  computeStats,
  KM_TREATMENT,
  KM_PLACEBO,
  EFFICACY_ENDPOINTS,
  ADVERSE_EVENTS,
  PK_DOSE_GROUPS,
  calcSampleSize,
  powerCurveData,
} from "./demoData";
// @ts-ignore — plotly.js types
import type { Data, Layout } from "plotly.js";

/* ════════════════════════════════════════════════════════════════════
   SHARED: Locked-down chart config — no exports, no customize
   ════════════════════════════════════════════════════════════════════ */

const DEMO_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

/** CSS to prevent text selection, drag, and right-click saving */
const NO_SELECT_STYLE: React.CSSProperties = {
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
  userSelect: "none",
};

/** Block right-click on charts */
function preventCtx(e: React.MouseEvent) {
  e.preventDefault();
}

/** Watermark annotations for every Plotly chart */
function watermarkAnnotations(): Partial<Layout>["annotations"] {
  const marks: Layout["annotations"] = [];
  const positions = [
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 },
  ];
  for (const pos of positions) {
    marks.push({
      text: "NuPhorm Demo",
      xref: "paper",
      yref: "paper",
      x: pos.x,
      y: pos.y,
      showarrow: false,
      font: { size: 16, color: "#1a2332" },
      opacity: 0.08,
      textangle: -30,
    } as any);
  }
  return marks;
}

/** Plotly config: keep zoom/pan/hover but remove ALL export buttons */
const PLOTLY_CONFIG = {
  displayModeBar: true,
  scrollZoom: true,
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: [
    "toImage",
    "sendDataToCloud",
    "downloadImage",
    "select2d",
    "lasso2d",
  ] as any[],
};

/** Shared Plotly layout defaults */
function baseLayout(extra: Partial<Layout> = {}): Partial<Layout> {
  return {
    font: { family: "Inter, system-ui, sans-serif", size: 12, color: "#334155" },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    margin: { l: 60, r: 30, t: 30, b: 60 },
    xaxis: {
      showgrid: true,
      gridcolor: "#e2e8f0",
      zeroline: false,
      ...(extra.xaxis as object || {}),
    },
    yaxis: {
      showgrid: true,
      gridcolor: "#e2e8f0",
      zeroline: false,
      ...(extra.yaxis as object || {}),
    },
    legend: { orientation: "h" as const, y: 1.12, x: 0.5, xanchor: "center" as const },
    hovermode: "closest" as const,
    annotations: [
      ...(watermarkAnnotations() || []),
      ...((extra.annotations as any[]) || []),
    ],
    ...extra,
    // Re-apply annotations after spread
  };
}

function FullscreenOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-8" style={NO_SELECT_STYLE}>
      <div
        className="relative bg-white rounded-2xl w-full h-full max-w-[95vw] max-h-[90vh] overflow-auto p-6"
        onContextMenu={preventCtx}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 z-10">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

/** Minimal toolbar — just fullscreen toggle, no export or customize */
function ChartToolbar({ onFullscreen }: { onFullscreen: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onFullscreen}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        title="Fullscreen"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   1. DESCRIPTIVE STATS
   ════════════════════════════════════════════════════════════════════ */
export function DescriptivePanel() {
  const [selectedVar, setSelectedVar] = useState<string>("age");
  const [chartMode, setChartMode] = useState<"histogram" | "boxplot">("histogram");
  const [bins, setBins] = useState(20);
  const [showNormal, setShowNormal] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const allStats = useMemo(
    () =>
      DESCRIPTIVE_VARS.map((v) => ({
        key: v,
        label: VAR_LABELS[v],
        ...computeStats(PATIENT_DATA.map((p) => p[v])),
      })),
    [],
  );

  const sortedStats = useMemo(() => {
    if (sortCol === null) return allStats;
    const cols = ["label", "n", "mean", "sd", "min", "max"] as const;
    const key = cols[sortCol];
    return [...allStats].sort((a, b) => {
      const av = a[key], bv = b[key];
      const cmp = typeof av === "number" ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
  }, [allStats, sortCol, sortAsc]);

  const handleSort = (col: number) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const values = useMemo(() => PATIENT_DATA.map((p) => p[selectedVar as keyof typeof p] as number), [selectedVar]);
  const stats = useMemo(() => computeStats(values), [values]);

  const chartContent = useMemo(() => {
    const data: Data[] = [];
    if (chartMode === "histogram") {
      data.push({
        x: values,
        type: "histogram",
        nbinsx: bins,
        marker: { color: DEMO_COLORS[0], line: { color: "#fff", width: 1 } },
        name: VAR_LABELS[selectedVar],
        hovertemplate: "%{x}: %{y} patients<extra></extra>",
      });
      if (showNormal) {
        const xs: number[] = [];
        const ys: number[] = [];
        const range = stats.max - stats.min;
        const binWidth = range / bins;
        for (let x = stats.min - range * 0.1; x <= stats.max + range * 0.1; x += range / 200) {
          xs.push(x);
          const z = (x - stats.mean) / stats.sd;
          ys.push(
            (stats.n * binWidth / (stats.sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z),
          );
        }
        data.push({
          x: xs,
          y: ys,
          type: "scatter",
          mode: "lines",
          line: { color: DEMO_COLORS[1], width: 2, dash: "dash" },
          name: "Normal fit",
          hoverinfo: "skip",
        });
      }
    } else {
      data.push({
        y: values,
        type: "box",
        marker: { color: DEMO_COLORS[0] },
        boxpoints: "outliers",
        name: VAR_LABELS[selectedVar],
        hovertemplate: "%{y}<extra></extra>",
      });
    }
    return data;
  }, [values, chartMode, bins, showNormal, selectedVar, stats]);

  const layout = baseLayout({
    xaxis: { title: chartMode === "boxplot" ? undefined : VAR_LABELS[selectedVar], showgrid: true, gridcolor: "#e2e8f0" },
    yaxis: { title: chartMode === "histogram" ? "Frequency" : VAR_LABELS[selectedVar], showgrid: true, gridcolor: "#e2e8f0" },
    bargap: 0.05,
  });

  const chart = (
    <div onContextMenu={preventCtx} draggable={false} onDragStart={preventCtx}>
      <Plot
        data={chartContent}
        layout={{ ...layout, autosize: true } as Layout}
        config={PLOTLY_CONFIG}
        useResizeHandler
        style={{ width: "100%", height: fullscreen ? 500 : 320 }}
      />
    </div>
  );

  return (
    <div className="space-y-4" style={NO_SELECT_STYLE}>
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f1f5f9]">
              {["Variable", "N", "Mean", "SD", "Min", "Max"].map((h, i) => (
                <th
                  key={h}
                  onClick={() => handleSort(i)}
                  className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748b] cursor-pointer hover:text-[#0f172a] select-none"
                >
                  {h} {sortCol === i && (sortAsc ? "↑" : "↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((s, i) => (
              <tr
                key={s.key}
                onClick={() => setSelectedVar(s.key)}
                className={`cursor-pointer transition-colors ${
                  s.key === selectedVar
                    ? "bg-blue-50 border-l-2 border-l-blue-500"
                    : i % 2 === 1
                      ? "bg-[#f8fafc] hover:bg-blue-50/50"
                      : "bg-white hover:bg-blue-50/50"
                }`}
              >
                <td className="px-4 py-2 font-medium text-[#0f172a]">{s.label}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{s.n}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{s.mean}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{s.sd}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{s.min}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{s.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartMode("histogram")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${chartMode === "histogram" ? "bg-[#0f172a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Histogram
          </button>
          <button
            onClick={() => setChartMode("boxplot")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${chartMode === "boxplot" ? "bg-[#0f172a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Box Plot
          </button>
          {chartMode === "histogram" && (
            <>
              <span className="text-xs text-[#64748b] ml-2">Bins: {bins}</span>
              <input
                type="range"
                min={5}
                max={50}
                value={bins}
                onChange={(e) => setBins(+e.target.value)}
                className="w-24"
              />
              <label className="flex items-center gap-1 text-xs text-[#64748b] ml-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNormal}
                  onChange={(e) => setShowNormal(e.target.checked)}
                  className="rounded"
                />
                Normal curve
              </label>
            </>
          )}
        </div>
        <ChartToolbar onFullscreen={() => setFullscreen(true)} />
      </div>

      {/* Chart */}
      <div className="relative bg-white rounded-lg border border-[#e2e8f0] p-3">
        {chart}
      </div>

      {fullscreen && (
        <FullscreenOverlay onClose={() => setFullscreen(false)}>
          <h2 className="text-lg font-semibold mb-4">{VAR_LABELS[selectedVar]} — Distribution</h2>
          {chart}
        </FullscreenOverlay>
      )}

      {/* Interpretation */}
      <div className="p-4 bg-white rounded-lg border border-[#e2e8f0]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2">Interpretation</h3>
        <p className="text-sm text-[#334155] leading-relaxed">
          Sample dataset: Phase III Clinical Trial (n={stats.n} patients). Click any row in the table to explore that variable's distribution.
          The cohort has a mean age of 54.3 years with moderate variability (SD 12.1). BMI averages 26.1 (overweight range).
          Blood pressure and heart rate are within expected clinical ranges.
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   2. SURVIVAL (KM)
   ════════════════════════════════════════════════════════════════════ */
export function SurvivalPanel() {
  const [showCI, setShowCI] = useState(true);
  const [showCensor, setShowCensor] = useState(true);
  const [showMedian, setShowMedian] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const data = useMemo(() => {
    const traces: Data[] = [];

    traces.push({
      x: KM_TREATMENT.map((p) => p.time),
      y: KM_TREATMENT.map((p) => p.survival),
      type: "scatter",
      mode: "lines",
      line: { shape: "hv", color: DEMO_COLORS[0], width: 2.5 },
      name: "Treatment",
      hovertemplate: "Time: %{x} mo<br>Survival: %{y:.1%}<extra>Treatment</extra>",
    });

    traces.push({
      x: KM_PLACEBO.map((p) => p.time),
      y: KM_PLACEBO.map((p) => p.survival),
      type: "scatter",
      mode: "lines",
      line: { shape: "hv", color: DEMO_COLORS[1], width: 2.5 },
      name: "Placebo",
      hovertemplate: "Time: %{x} mo<br>Survival: %{y:.1%}<extra>Placebo</extra>",
    });

    if (showCI) {
      [{ pts: KM_TREATMENT, color: DEMO_COLORS[0] }, { pts: KM_PLACEBO, color: DEMO_COLORS[1] }].forEach(({ pts, color }) => {
        traces.push({
          x: [...pts.map((p) => p.time), ...pts.map((p) => p.time).reverse()],
          y: [...pts.map((p) => p.ciUpper), ...pts.map((p) => p.ciLower).reverse()],
          fill: "toself",
          fillcolor: `${color}20`,
          line: { color: "transparent" },
          type: "scatter",
          showlegend: false,
          hoverinfo: "skip",
          name: "CI",
        });
      });
    }

    if (showCensor) {
      [{ pts: KM_TREATMENT, color: DEMO_COLORS[0] }, { pts: KM_PLACEBO, color: DEMO_COLORS[1] }].forEach(({ pts, color }) => {
        const censored = pts.filter((p) => p.censored);
        if (censored.length) {
          traces.push({
            x: censored.map((p) => p.time),
            y: censored.map((p) => p.survival),
            type: "scatter",
            mode: "markers",
            marker: { symbol: "line-ns-open", size: 10, color, line: { width: 2 } },
            showlegend: false,
            name: "Censored",
            hovertemplate: "Censored at %{x} mo<extra></extra>",
          });
        }
      });
    }

    return traces;
  }, [showCI, showCensor]);

  const shapes = useMemo(() => {
    if (!showMedian) return [];
    return [
      { type: "line" as const, x0: 0, x1: 24, y0: 0.5, y1: 0.5, line: { color: "#94a3b8", width: 1, dash: "dot" as const } },
    ];
  }, [showMedian]);

  const layout = baseLayout({
    xaxis: { title: "Time (months)", showgrid: true, gridcolor: "#e2e8f0", range: [0, 25] },
    yaxis: { title: "Survival Probability", showgrid: true, gridcolor: "#e2e8f0", range: [0, 1.05], tickformat: ".0%" },
    shapes,
  });

  const riskTimes = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  const chart = (
    <div onContextMenu={preventCtx} draggable={false} onDragStart={preventCtx}>
      <Plot
        data={data}
        layout={{ ...layout, autosize: true } as Layout}
        config={PLOTLY_CONFIG}
        useResizeHandler
        style={{ width: "100%", height: fullscreen ? 480 : 340 }}
      />
    </div>
  );

  return (
    <div className="space-y-4" style={NO_SELECT_STYLE}>
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {[
            { label: "95% CI", val: showCI, set: setShowCI },
            { label: "Censor marks", val: showCensor, set: setShowCensor },
            { label: "Median line", val: showMedian, set: setShowMedian },
          ].map(({ label, val, set }) => (
            <label key={label} className="flex items-center gap-1 text-xs text-[#64748b] cursor-pointer">
              <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="rounded" />
              {label}
            </label>
          ))}
        </div>
        <ChartToolbar onFullscreen={() => setFullscreen(true)} />
      </div>

      {/* Chart */}
      <div className="relative bg-white rounded-lg border border-[#e2e8f0] p-3">
        {chart}
      </div>

      {/* Stats box */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
          <p className="text-xs text-[#64748b]">Hazard Ratio</p>
          <p className="text-xl font-bold text-[#0f172a]">0.62</p>
          <p className="text-xs text-[#64748b]">95% CI: 0.45–0.86</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
          <p className="text-xs text-[#64748b]">Log-rank p</p>
          <p className="text-xl font-bold text-[#0f172a]">0.003</p>
          <p className="text-xs text-[#64748b]">Statistically significant</p>
        </div>
      </div>

      {/* At-risk table */}
      <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#f1f5f9]">
              <th className="px-3 py-2 text-left font-semibold text-[#64748b]">No. at Risk</th>
              {riskTimes.map((t) => <th key={t} className="px-3 py-2 text-center font-medium text-[#64748b]">{t}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="px-3 py-1.5 font-medium" style={{ color: DEMO_COLORS[0] }}>Treatment</td>
              {riskTimes.map((t) => {
                const pt = KM_TREATMENT.find((p) => p.time === t) || KM_TREATMENT[KM_TREATMENT.length - 1];
                return <td key={t} className="px-3 py-1.5 text-center tabular-nums text-[#334155]">{pt.nRisk}</td>;
              })}
            </tr>
            <tr className="bg-[#f8fafc]">
              <td className="px-3 py-1.5 font-medium" style={{ color: DEMO_COLORS[1] }}>Placebo</td>
              {riskTimes.map((t) => {
                const pt = KM_PLACEBO.find((p) => p.time === t) || KM_PLACEBO[KM_PLACEBO.length - 1];
                return <td key={t} className="px-3 py-1.5 text-center tabular-nums text-[#334155]">{pt.nRisk}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Interpretation */}
      <div className="p-4 bg-white rounded-lg border border-[#e2e8f0]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2">Interpretation</h3>
        <p className="text-sm text-[#334155] leading-relaxed">
          Median survival: Treatment 18.2 months vs Placebo 12.7 months (HR = 0.62, 95% CI: 0.45–0.86, log-rank p = 0.003).
          The treatment arm demonstrates a statistically significant improvement in overall survival with a 38% reduction in the hazard of death.
        </p>
      </div>

      {fullscreen && (
        <FullscreenOverlay onClose={() => setFullscreen(false)}>
          <h2 className="text-lg font-semibold mb-4">Kaplan-Meier Survival Curves</h2>
          {chart}
        </FullscreenOverlay>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   3. EFFICACY
   ════════════════════════════════════════════════════════════════════ */
export function EfficacyPanel() {
  const [barMode, setBarMode] = useState<"group" | "stack">("group");
  const [showRelative, setShowRelative] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  const barData = useMemo((): Data[] => {
    const names = EFFICACY_ENDPOINTS.map((e) => e.name);
    if (showRelative) {
      return [{
        x: names,
        y: EFFICACY_ENDPOINTS.map((e) => +(e.treatment - e.placebo).toFixed(1)),
        error_y: {
          type: "data",
          array: EFFICACY_ENDPOINTS.map((e) => +((e.treatmentCI[1] - e.placeboCI[0]) / 2).toFixed(1)),
          visible: true,
          color: "#64748b",
        },
        type: "bar",
        marker: { color: DEMO_COLORS[4] },
        name: "Difference",
        hovertemplate: "%{x}<br>Diff: %{y}%<extra></extra>",
      }];
    }
    return [
      {
        x: names,
        y: EFFICACY_ENDPOINTS.map((e) => e.treatment),
        error_y: {
          type: "data",
          array: EFFICACY_ENDPOINTS.map((e) => e.treatmentCI[1] - e.treatment),
          arrayminus: EFFICACY_ENDPOINTS.map((e) => e.treatment - e.treatmentCI[0]),
          visible: true,
          color: "#64748b",
        },
        type: "bar",
        marker: { color: DEMO_COLORS[0] },
        name: "Treatment",
        hovertemplate: "%{x}<br>Treatment: %{y}%<extra></extra>",
      },
      {
        x: names,
        y: EFFICACY_ENDPOINTS.map((e) => e.placebo),
        error_y: {
          type: "data",
          array: EFFICACY_ENDPOINTS.map((e) => e.placeboCI[1] - e.placebo),
          arrayminus: EFFICACY_ENDPOINTS.map((e) => e.placebo - e.placeboCI[0]),
          visible: true,
          color: "#64748b",
        },
        type: "bar",
        marker: { color: DEMO_COLORS[1] },
        name: "Placebo",
        hovertemplate: "%{x}<br>Placebo: %{y}%<extra></extra>",
      },
    ];
  }, [barMode, showRelative]);

  const barLayout = baseLayout({
    barmode: barMode,
    yaxis: { title: showRelative ? "Difference (%)" : "Response Rate (%)", showgrid: true, gridcolor: "#e2e8f0" },
  });

  const forestData = useMemo((): Data[] => {
    const names = EFFICACY_ENDPOINTS.map((e) => e.name);
    return [{
      x: EFFICACY_ENDPOINTS.map((e) => e.or),
      y: names,
      error_x: {
        type: "data",
        array: EFFICACY_ENDPOINTS.map((e) => e.orCI[1] - e.or),
        arrayminus: EFFICACY_ENDPOINTS.map((e) => e.or - e.orCI[0]),
        visible: true,
        color: DEMO_COLORS[0],
        thickness: 2,
      },
      type: "scatter",
      mode: "markers",
      marker: { color: DEMO_COLORS[0], size: 12, symbol: "diamond" },
      name: "Odds Ratio",
      hovertemplate: "%{y}<br>OR: %{x:.2f}<extra></extra>",
    }];
  }, []);

  const forestLayout = baseLayout({
    xaxis: { title: "Odds Ratio", showgrid: true, gridcolor: "#e2e8f0", type: "log" as const },
    yaxis: { showgrid: false, automargin: true },
    shapes: [{ type: "line" as const, x0: 1, x1: 1, y0: -0.5, y1: 3.5, line: { color: "#94a3b8", width: 1.5, dash: "dash" as const } }],
    margin: { l: 140, r: 30, t: 30, b: 50 },
  });

  const barChart = (
    <div onContextMenu={preventCtx} draggable={false} onDragStart={preventCtx}>
      <Plot data={barData} layout={{ ...barLayout, autosize: true } as Layout} config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%", height: 320 }} />
    </div>
  );

  return (
    <div className="space-y-4" style={NO_SELECT_STYLE}>
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBarMode(barMode === "group" ? "stack" : "group")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {barMode === "group" ? "Stacked" : "Grouped"}
          </button>
          <label className="flex items-center gap-1 text-xs text-[#64748b] cursor-pointer">
            <input type="checkbox" checked={showRelative} onChange={(e) => setShowRelative(e.target.checked)} className="rounded" />
            Show difference
          </label>
        </div>
        <ChartToolbar onFullscreen={() => setFullscreen(true)} />
      </div>

      {/* Bar chart */}
      <div className="relative bg-white rounded-lg border border-[#e2e8f0] p-3">
        {barChart}
      </div>

      {/* Endpoint details (expandable) */}
      <div className="space-y-2">
        {EFFICACY_ENDPOINTS.map((ep) => (
          <div key={ep.name} className="border border-[#e2e8f0] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedEndpoint(expandedEndpoint === ep.name ? null : ep.name)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-[#0f172a]">{ep.name}</span>
              <div className="flex items-center gap-3 text-xs text-[#64748b]">
                <span>p = {ep.pValue}</span>
                {expandedEndpoint === ep.name ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </button>
            {expandedEndpoint === ep.name && (
              <div className="px-4 py-3 bg-[#f8fafc] border-t border-[#e2e8f0] grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#64748b] text-xs mb-1">Treatment</p>
                  <p className="font-semibold text-[#0f172a]">{ep.treatment}%</p>
                  <p className="text-xs text-[#64748b]">95% CI: {ep.treatmentCI[0]}%–{ep.treatmentCI[1]}%</p>
                </div>
                <div>
                  <p className="text-[#64748b] text-xs mb-1">Placebo</p>
                  <p className="font-semibold text-[#0f172a]">{ep.placebo}%</p>
                  <p className="text-xs text-[#64748b]">95% CI: {ep.placeboCI[0]}%–{ep.placeboCI[1]}%</p>
                </div>
                <div className="col-span-2 pt-1 border-t border-[#e2e8f0]">
                  <span className="text-xs text-[#64748b]">OR: {ep.or} ({ep.orCI[0]}–{ep.orCI[1]}) · p = {ep.pValue}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Forest plot */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-3" onContextMenu={preventCtx}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2">Forest Plot — Odds Ratios</h3>
        <Plot data={forestData} layout={{ ...forestLayout, autosize: true } as Layout} config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%", height: 240 }} />
      </div>

      {/* Interpretation */}
      <div className="p-4 bg-white rounded-lg border border-[#e2e8f0]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2">Interpretation</h3>
        <p className="text-sm text-[#334155] leading-relaxed">
          The treatment group shows statistically significant improvements across all endpoints. Overall response rate: 68.0% vs 42.7% (p &lt; 0.001).
          Complete response rate was more than double in the treatment arm (32.0% vs 14.7%). The forest plot shows all odds ratios favour treatment (OR &gt; 1).
        </p>
      </div>

      {fullscreen && (
        <FullscreenOverlay onClose={() => setFullscreen(false)}>
          <h2 className="text-lg font-semibold mb-4">Efficacy Analysis</h2>
          {barChart}
        </FullscreenOverlay>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   4. SAFETY
   ════════════════════════════════════════════════════════════════════ */
export function SafetyPanel() {
  const [groupFilter, setGroupFilter] = useState<"both" | "treatment" | "placebo">("both");
  const [severityFilter, setSeverityFilter] = useState({ mild: true, moderate: true, severe: true });
  const [sortBy, setSortBy] = useState<"frequency" | "severity" | "name">("frequency");
  const [fullscreen, setFullscreen] = useState(false);

  const sortedEvents = useMemo(() => {
    const events = [...ADVERSE_EVENTS];
    const total = (e: typeof events[0]) => {
      let t = 0;
      if (groupFilter !== "placebo") t += e.treatmentMild + e.treatmentModerate + e.treatmentSevere;
      if (groupFilter !== "treatment") t += e.placeboMild + e.placeboModerate + e.placeboSevere;
      return t;
    };
    const severe = (e: typeof events[0]) => {
      let t = 0;
      if (groupFilter !== "placebo") t += e.treatmentSevere;
      if (groupFilter !== "treatment") t += e.placeboSevere;
      return t;
    };

    if (sortBy === "frequency") events.sort((a, b) => total(b) - total(a));
    else if (sortBy === "severity") events.sort((a, b) => severe(b) - severe(a));
    else events.sort((a, b) => a.name.localeCompare(b.name));

    return events;
  }, [groupFilter, sortBy]);

  const chartData = useMemo((): Data[] => {
    const traces: Data[] = [];
    const names = sortedEvents.map((e) => e.name);

    const addSeverity = (severity: "mild" | "moderate" | "severe", color: string, label: string) => {
      if (!severityFilter[severity]) return;
      const values = sortedEvents.map((e) => {
        let v = 0;
        if (groupFilter !== "placebo") v += e[`treatment${severity.charAt(0).toUpperCase() + severity.slice(1)}` as keyof typeof e] as number;
        if (groupFilter !== "treatment") v += e[`placebo${severity.charAt(0).toUpperCase() + severity.slice(1)}` as keyof typeof e] as number;
        return v;
      });
      traces.push({
        y: names,
        x: values,
        type: "bar",
        orientation: "h",
        marker: { color },
        name: label,
        hovertemplate: "%{y}: %{x} patients<extra>" + label + "</extra>",
      });
    };

    addSeverity("mild", "#93c5fd", "Mild");
    addSeverity("moderate", "#f59e0b", "Moderate");
    addSeverity("severe", "#ef4444", "Severe");

    return traces;
  }, [sortedEvents, groupFilter, severityFilter]);

  const layout = baseLayout({
    barmode: "stack",
    margin: { l: 160, r: 30, t: 30, b: 50 },
    yaxis: { automargin: true, showgrid: false },
    xaxis: { title: "Number of Patients", showgrid: true, gridcolor: "#e2e8f0" },
    height: 420,
  });

  const chart = (
    <div onContextMenu={preventCtx} draggable={false} onDragStart={preventCtx}>
      <Plot data={chartData} layout={{ ...layout, autosize: true } as Layout} config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%", height: fullscreen ? 600 : 420 }} />
    </div>
  );

  return (
    <div className="space-y-4" style={NO_SELECT_STYLE}>
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {(["both", "treatment", "placebo"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${groupFilter === g ? "bg-[#0f172a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {g === "both" ? "Both" : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {(["mild", "moderate", "severe"] as const).map((s) => (
              <label key={s} className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: s === "mild" ? "#3b82f6" : s === "moderate" ? "#f59e0b" : "#ef4444" }}>
                <input
                  type="checkbox"
                  checked={severityFilter[s]}
                  onChange={(e) => setSeverityFilter({ ...severityFilter, [s]: e.target.checked })}
                  className="rounded"
                />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </label>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
          >
            <option value="frequency">Sort: Frequency</option>
            <option value="severity">Sort: Severity</option>
            <option value="name">Sort: A-Z</option>
          </select>
        </div>
        <ChartToolbar onFullscreen={() => setFullscreen(true)} />
      </div>

      {/* Chart */}
      <div className="relative bg-white rounded-lg border border-[#e2e8f0] p-3">
        {chart}
      </div>

      {/* Interpretation */}
      <div className="p-4 bg-white rounded-lg border border-[#e2e8f0]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2">Interpretation</h3>
        <p className="text-sm text-[#334155] leading-relaxed">
          The most common adverse events were nausea (37.3%), fatigue (37.3%), and headache (28.0%). Treatment-related severe events were most notable for
          neutropenia (8.0% treatment vs 0% placebo). Use the filters above to isolate by group and severity grade.
        </p>
      </div>

      {fullscreen && (
        <FullscreenOverlay onClose={() => setFullscreen(false)}>
          <h2 className="text-lg font-semibold mb-4">Adverse Events Summary</h2>
          {chart}
        </FullscreenOverlay>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   5. SAMPLE SIZE
   ════════════════════════════════════════════════════════════════════ */
export function SampleSizePanel() {
  const [effectSize, setEffectSize] = useState(0.3);
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.8);
  const [allocRatio, setAllocRatio] = useState(1);
  const [dropout, setDropout] = useState(0.1);
  const [showFormula, setShowFormula] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const result = useMemo(() => calcSampleSize(effectSize, alpha, power, allocRatio, dropout), [effectSize, alpha, power, allocRatio, dropout]);
  const curve = useMemo(() => powerCurveData(effectSize, alpha, power, allocRatio, dropout), [effectSize, alpha, power, allocRatio, dropout]);

  const extraCurves = useMemo(() => {
    const sizes = [0.2, 0.5, 0.8].filter((s) => Math.abs(s - effectSize) > 0.05);
    return sizes.map((s) => ({
      size: s,
      data: powerCurveData(s, alpha, power, allocRatio, dropout),
    }));
  }, [effectSize, alpha, power, allocRatio, dropout]);

  const chartData = useMemo((): Data[] => {
    const traces: Data[] = [
      {
        x: curve.map((p) => p.n),
        y: curve.map((p) => p.pwr),
        type: "scatter",
        mode: "lines",
        line: { color: DEMO_COLORS[0], width: 3 },
        name: `d = ${effectSize}`,
        hovertemplate: "n = %{x}<br>Power = %{y:.1%}<extra></extra>",
      },
    ];
    extraCurves.forEach((ec, i) => {
      traces.push({
        x: ec.data.map((p) => p.n),
        y: ec.data.map((p) => p.pwr),
        type: "scatter",
        mode: "lines",
        line: { color: DEMO_COLORS[i + 1] || "#94a3b8", width: 1.5, dash: "dash" },
        name: `d = ${ec.size}`,
        opacity: 0.6,
        hovertemplate: "n = %{x}<br>Power = %{y:.1%}<extra></extra>",
      });
    });
    traces.push({
      x: [result.perGroup],
      y: [power],
      type: "scatter",
      mode: "markers",
      marker: { color: DEMO_COLORS[0], size: 14, symbol: "circle", line: { color: "#fff", width: 2 } },
      name: "Current",
      hovertemplate: `n = ${result.perGroup}<br>Power = ${(power * 100).toFixed(0)}%<extra></extra>`,
      showlegend: false,
    });
    return traces;
  }, [curve, extraCurves, effectSize, result, power]);

  const layout = baseLayout({
    xaxis: { title: "Sample Size (per group)", showgrid: true, gridcolor: "#e2e8f0" },
    yaxis: { title: "Power", showgrid: true, gridcolor: "#e2e8f0", range: [0, 1.05], tickformat: ".0%" },
    shapes: [
      { type: "line" as const, x0: 0, x1: 500, y0: power, y1: power, line: { color: "#94a3b8", width: 1, dash: "dot" as const } },
      { type: "line" as const, x0: result.perGroup, x1: result.perGroup, y0: 0, y1: power, line: { color: "#94a3b8", width: 1, dash: "dot" as const } },
    ],
  });

  const chart = (
    <div onContextMenu={preventCtx} draggable={false} onDragStart={preventCtx}>
      <Plot data={chartData} layout={{ ...layout, autosize: true } as Layout} config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%", height: fullscreen ? 480 : 320 }} />
    </div>
  );

  return (
    <div className="space-y-4" style={NO_SELECT_STYLE}>
      {/* Big number display */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
          <p className="text-xs text-[#64748b] mb-1">Per Group</p>
          <p className="text-3xl font-bold text-[#0f172a]">{result.perGroup}</p>
          <p className="text-xs text-[#64748b]">patients</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
          <p className="text-xs text-[#64748b] mb-1">Total (with {(dropout * 100).toFixed(0)}% dropout)</p>
          <p className="text-3xl font-bold text-[#0f172a]">{result.total}</p>
          <p className="text-xs text-[#64748b]">patients</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#64748b]">Effect Size (d)</span>
            <span className="font-medium text-[#0f172a]">{effectSize.toFixed(2)}</span>
          </div>
          <input type="range" min={0.1} max={1.0} step={0.01} value={effectSize} onChange={(e) => setEffectSize(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-[10px] text-[#94a3b8] mt-0.5"><span>Small (0.1)</span><span>Large (1.0)</span></div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#64748b]">Significance Level (α)</span>
            <span className="font-medium text-[#0f172a]">{alpha}</span>
          </div>
          <select value={alpha} onChange={(e) => setAlpha(+e.target.value)} className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none">
            <option value={0.01}>0.01</option>
            <option value={0.025}>0.025</option>
            <option value={0.05}>0.05</option>
            <option value={0.10}>0.10</option>
          </select>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#64748b]">Power (1-β)</span>
            <span className="font-medium text-[#0f172a]">{(power * 100).toFixed(0)}%</span>
          </div>
          <input type="range" min={0.5} max={0.99} step={0.01} value={power} onChange={(e) => setPower(+e.target.value)} className="w-full" />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#64748b]">Allocation Ratio</span>
            <span className="font-medium text-[#0f172a]">{allocRatio}:1</span>
          </div>
          <input type="range" min={1} max={3} step={0.5} value={allocRatio} onChange={(e) => setAllocRatio(+e.target.value)} className="w-full" />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#64748b]">Dropout Rate</span>
            <span className="font-medium text-[#0f172a]">{(dropout * 100).toFixed(0)}%</span>
          </div>
          <input type="range" min={0} max={0.3} step={0.01} value={dropout} onChange={(e) => setDropout(+e.target.value)} className="w-full" />
        </div>
      </div>

      {/* Power curve chart */}
      <div className="flex items-center justify-end">
        <ChartToolbar onFullscreen={() => setFullscreen(true)} />
      </div>
      <div className="relative bg-white rounded-lg border border-[#e2e8f0] p-3">
        {chart}
      </div>

      {/* Formula */}
      <button
        onClick={() => setShowFormula(!showFormula)}
        className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#0f172a] transition-colors"
      >
        {showFormula ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Show formula
      </button>
      {showFormula && (
        <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] text-xs text-[#334155] font-mono">
          n = (z<sub>α/2</sub> + z<sub>β</sub>)² × (1 + 1/r) / d²<br />
          n<sub>adjusted</sub> = n / (1 - dropout)<br />
          <span className="text-[#64748b]">where d = effect size, r = allocation ratio</span>
        </div>
      )}

      {fullscreen && (
        <FullscreenOverlay onClose={() => setFullscreen(false)}>
          <h2 className="text-lg font-semibold mb-4">Power Curve</h2>
          {chart}
        </FullscreenOverlay>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   6. PK/PD
   ════════════════════════════════════════════════════════════════════ */
export function PKPDPanel() {
  const [logScale, setLogScale] = useState(false);
  const [showIndividual, setShowIndividual] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const chartData = useMemo((): Data[] => {
    const traces: Data[] = [];

    PK_DOSE_GROUPS.forEach((group) => {
      if (showIndividual) {
        const nPatients = group.points[0]?.patients.length || 0;
        for (let p = 0; p < nPatients; p++) {
          traces.push({
            x: group.points.map((pt) => pt.time),
            y: group.points.map((pt) => pt.patients[p]),
            type: "scatter",
            mode: "lines",
            line: { color: group.color, width: 0.8 },
            opacity: 0.25,
            showlegend: false,
            hoverinfo: "skip",
            name: `${group.dose} pt${p + 1}`,
          });
        }
      }

      traces.push({
        x: group.points.map((pt) => pt.time),
        y: group.points.map((pt) => pt.mean),
        type: "scatter",
        mode: "lines+markers",
        line: { color: group.color, width: 2.5 },
        marker: { color: group.color, size: 5 },
        name: group.dose,
        hovertemplate: `${group.dose}<br>Time: %{x}h<br>Conc: %{y} ng/mL<extra></extra>`,
      });
    });

    return traces;
  }, [showIndividual]);

  const layout = baseLayout({
    xaxis: { title: "Time (hours)", showgrid: true, gridcolor: "#e2e8f0" },
    yaxis: {
      title: "Concentration (ng/mL)",
      showgrid: true,
      gridcolor: "#e2e8f0",
      type: logScale ? ("log" as const) : ("linear" as const),
    },
  });

  const chart = (
    <div onContextMenu={preventCtx} draggable={false} onDragStart={preventCtx}>
      <Plot data={chartData} layout={{ ...layout, autosize: true } as Layout} config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%", height: fullscreen ? 480 : 340 }} />
    </div>
  );

  return (
    <div className="space-y-4" style={NO_SELECT_STYLE}>
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-[#64748b] cursor-pointer">
            <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} className="rounded" />
            Log scale (Y)
          </label>
          <label className="flex items-center gap-1 text-xs text-[#64748b] cursor-pointer">
            <input type="checkbox" checked={showIndividual} onChange={(e) => setShowIndividual(e.target.checked)} className="rounded" />
            Show individual curves
          </label>
        </div>
        <ChartToolbar onFullscreen={() => setFullscreen(true)} />
      </div>

      {/* Chart */}
      <div className="relative bg-white rounded-lg border border-[#e2e8f0] p-3">
        {chart}
      </div>

      {/* PK Parameters table */}
      <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f1f5f9]">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">Dose</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">C<sub>max</sub> (ng/mL)</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">T<sub>max</sub> (h)</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">AUC (ng·h/mL)</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">t<sub>½</sub> (h)</th>
            </tr>
          </thead>
          <tbody>
            {PK_DOSE_GROUPS.map((g, i) => (
              <tr key={g.dose} className={i % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"}>
                <td className="px-4 py-2 font-medium" style={{ color: g.color }}>{g.dose}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{g.cmax}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{g.tmax}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{g.auc.toLocaleString()}</td>
                <td className="px-4 py-2 text-[#334155] tabular-nums">{g.halfLife}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interpretation */}
      <div className="p-4 bg-white rounded-lg border border-[#e2e8f0]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2">Interpretation</h3>
        <p className="text-sm text-[#334155] leading-relaxed">
          Dose-proportional pharmacokinetics observed across the 10–100 mg range. C<sub>max</sub> and AUC increase linearly with dose.
          Terminal half-life is consistent (~5.2–5.5 h) across doses, suggesting linear elimination kinetics.
          Toggle "Show individual curves" to see inter-patient variability.
        </p>
      </div>

      {fullscreen && (
        <FullscreenOverlay onClose={() => setFullscreen(false)}>
          <h2 className="text-lg font-semibold mb-4">PK/PD — Concentration-Time Profiles</h2>
          {chart}
        </FullscreenOverlay>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EXPORTS INDEX
   ════════════════════════════════════════════════════════════════════ */
export const PANEL_MAP: Record<string, React.FC> = {
  descriptive: DescriptivePanel,
  survival: SurvivalPanel,
  efficacy: EfficacyPanel,
  safety: SafetyPanel,
  samplesize: SampleSizePanel,
  pkpd: PKPDPanel,
};

export const PANEL_TITLES: Record<string, string> = {
  descriptive: "Descriptive Statistics — Phase III Clinical Trial",
  survival: "Kaplan-Meier Survival Analysis",
  efficacy: "Efficacy Analysis — Treatment vs Placebo",
  safety: "Safety Analysis — Adverse Events",
  samplesize: "Sample Size & Power Calculator",
  pkpd: "Pharmacokinetic Analysis",
};
