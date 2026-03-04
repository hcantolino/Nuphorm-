import React, { useState, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useAIPanelStore, DEFAULT_CUSTOMIZATIONS } from "@/stores/aiPanelStore";
import type { TabCustomizations } from "@/stores/aiPanelStore";
import { useTabStore } from "@/stores/tabStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BarChart2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Save,
  Table2,
  Trash2,
  TrendingUp,
} from "lucide-react";
// BEFORE: import PharmaChartPanel, { type PharmaChartType } from "./PharmaChartPanel"
// AFTER:  Charts tab removed — PharmaChartPanel no longer rendered as a separate view
import SaveAnalysisModal from "./SaveAnalysisModal";
import { ControlPanel, PALETTES } from "./ControlPanel";
import { toast } from "sonner";

// ─── Color resolution ────────────────────────────────────────────────────────

function resolveColors(customizations: TabCustomizations): string[] {
  const palette = PALETTES[customizations.palette];
  return Array.from({ length: 6 }, (_, i) =>
    customizations.customColors[i] || palette[i % palette.length]
  );
}

// ─── Legend props helper ──────────────────────────────────────────────────────

function buildLegendProps(pos: TabCustomizations["legendPosition"]) {
  if (pos === "none") return null;
  if (pos === "left")  return { verticalAlign: "middle" as const, align: "left"   as const, layout: "vertical"   as const };
  if (pos === "right") return { verticalAlign: "middle" as const, align: "right"  as const, layout: "vertical"   as const };
  if (pos === "top")   return { verticalAlign: "top"    as const, align: "center" as const, layout: "horizontal" as const };
  return                      { verticalAlign: "bottom" as const, align: "center" as const, layout: "horizontal" as const };
}

// ─── Linear regression helper ────────────────────────────────────────────────

interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

function calcLinearRegression(points: { x: number; y: number }[]): RegressionResult | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

// ─── Markdown rendering helpers ──────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, '<code class="bg-[#f1f5f9] px-1 rounded font-mono text-xs">$1</code>');
}

function MarkdownTable({ source }: { source: string }) {
  const lines = source.split("\n").filter((l) => l.trim());
  const parseRow = (line: string) => {
    const parts = line.split("|");
    // Strip leading/trailing empty from | borders |
    if (parts[0].trim() === "") parts.shift();
    if (parts[parts.length - 1].trim() === "") parts.pop();
    return parts.map((c) => c.trim());
  };
  const sepIdx = lines.findIndex((l) => /^\|?[\s\-:|]+\|/.test(l));
  if (lines.length < 2 || sepIdx < 1) {
    return <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">{source}</pre>;
  }
  const headers = parseRow(lines[0]);
  const rows = lines.slice(sepIdx + 1).map(parseRow);
  return (
    <div className="overflow-x-auto rounded border border-[#e2e8f0]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left py-1.5 px-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap"
                dangerouslySetInnerHTML={{ __html: renderInline(h) }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f0fdfa] transition-colors">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="py-1.5 px-3 text-[#0f172a]"
                  dangerouslySetInnerHTML={{ __html: renderInline(cell) }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Headings
        if (trimmed.startsWith("### "))
          return <h5 key={i} className="font-semibold text-[#0f172a] text-sm mt-1" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(4)) }} />;
        if (trimmed.startsWith("## "))
          return <h4 key={i} className="font-semibold text-[#0f172a]" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(3)) }} />;
        if (trimmed.startsWith("# "))
          return <h3 key={i} className="font-bold text-[#0f172a] text-base" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(2)) }} />;

        // Markdown table
        if (/\|\s*[-:]+[-|\s:]*\|/.test(trimmed))
          return <MarkdownTable key={i} source={trimmed} />;

        // Bullet list
        const lines = trimmed.split("\n");
        const bulletLines = lines.filter((l) => /^[-*+]\s/.test(l.trim()));
        if (bulletLines.length > 0 && bulletLines.length === lines.filter((l) => l.trim()).length) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {bulletLines.map((l, j) => (
                <li key={j} className="text-sm text-[#0f172a]/80" dangerouslySetInnerHTML={{ __html: renderInline(l.trim().replace(/^[-*+]\s+/, "")) }} />
              ))}
            </ul>
          );
        }

        // Numbered list
        const numberedLines = lines.filter((l) => /^\d+\.\s/.test(l.trim()));
        if (numberedLines.length > 0 && numberedLines.length === lines.filter((l) => l.trim()).length) {
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1">
              {numberedLines.map((l, j) => (
                <li key={j} className="text-sm text-[#0f172a]/80" dangerouslySetInnerHTML={{ __html: renderInline(l.trim().replace(/^\d+\.\s+/, "")) }} />
              ))}
            </ol>
          );
        }

        // Regular paragraph
        return (
          <p key={i} className="text-sm text-[#0f172a]/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.replace(/\n/g, "<br>")) }} />
        );
      })}
    </div>
  );
}

// ─── Extended chart renderer ─────────────────────────────────────────────────

interface ChartProps {
  chartData: any;
  customizations: TabCustomizations;
  colors: string[];
}

const ChartRenderer: React.FC<ChartProps> = ({ chartData, customizations, colors }) => {
  if (!chartData) return null;

  let data: any[] = [];
  let datasetKeys: string[] = [];
  const type = customizations.chartType;

  if (chartData.labels && chartData.datasets) {
    data = chartData.labels.map((label: any, idx: number) => {
      const point: any = { name: label };
      chartData.datasets.forEach((ds: any) => {
        if (ds.data?.[idx] !== undefined) point[ds.label] = ds.data[idx];
      });
      return point;
    });
    datasetKeys = chartData.datasets.map((ds: any) => ds.label);
  } else if (Array.isArray(chartData.points)) {
    data = chartData.points.map((p: any, i: number) => ({
      name: p.x ?? i,
      value: p.y,
    }));
    datasetKeys = ["value"];
  }

  if (data.length === 0) return null;

  const gridStroke = customizations.showGrid ? "#e2e8f0" : "transparent";
  const legendProps = buildLegendProps(customizations.legendPosition);

  const bottomMargin = customizations.xLabel ? 30 : 8;
  const leftMargin   = customizations.yLabel ? 20 : 0;
  const sharedMargin = { top: 8, right: 16, bottom: bottomMargin, left: leftMargin };

  const xAxisLabel = customizations.xLabel
    ? { value: customizations.xLabel, position: "insideBottom" as const, offset: -12, fontSize: 11, fill: "#64748b" }
    : undefined;
  const yAxisLabel = customizations.yLabel
    ? { value: customizations.yLabel, angle: -90, position: "insideLeft" as const, fontSize: 11, fill: "#64748b" }
    : undefined;

  // Y-axis domain: guard against 0/negative with log scale
  const yMin = customizations.yAxisMin;
  const yMax = customizations.yAxisMax;
  const yDomainMin: number | string =
    customizations.yAxisLog && (yMin === null || yMin <= 0) ? "auto" : (yMin ?? "auto");
  const yDomainMax: number | string = yMax ?? "auto";
  const yDomain: [number | string, number | string] = [yDomainMin, yDomainMax];
  const yScale = customizations.yAxisLog ? ("log" as const) : ("auto" as const);

  // X-axis domain for numeric axes
  const xDomain: [number | string, number | string] = [
    customizations.xAxisMin ?? "auto",
    customizations.xAxisMax ?? "auto",
  ];

  // ── Pie ─────────────────────────────────────────────────────────────────
  if (type === "pie") {
    const firstKey = datasetKeys[0] ?? "value";
    const pieData = data.map((d: any) => ({
      name: d.name,
      value: typeof d[firstKey] === "number" ? d[firstKey] : (d.value ?? 0),
    }));
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={100}
            dataKey="value"
            isAnimationActive={false}
            label={customizations.showDataLabels
              ? ({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`
              : undefined}
            labelLine={customizations.showDataLabels}
          >
            {pieData.map((_: any, i: number) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val: any) => [typeof val === "number" ? val.toFixed(4) : val]} />
          {legendProps && <Legend {...legendProps} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // ── Scatter ──────────────────────────────────────────────────────────────
  if (type === "scatter" && chartData.points) {
    const scatterData = chartData.points.map((p: any) => ({ x: p.x, y: p.y }));
    const r = customizations.markerSize;
    const dotShape = (props: any) => (
      <circle cx={props.cx} cy={props.cy} r={r} fill={colors[0]} />
    );

    // Linear trendline
    const regression =
      customizations.trendlineType === "linear"
        ? calcLinearRegression(scatterData)
        : null;

    let trendlinePoints: { tx: number; ty: number }[] = [];
    let trendLabel = "";
    if (regression) {
      const xs = scatterData.map((p: any) => p.x as number);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      trendlinePoints = [
        { tx: minX, ty: regression.slope * minX + regression.intercept },
        { tx: maxX, ty: regression.slope * maxX + regression.intercept },
      ];
      const eqParts: string[] = [];
      if (customizations.showTrendlineEquation) {
        eqParts.push(
          `y = ${regression.slope.toFixed(3)}x ${regression.intercept >= 0 ? "+" : "−"} ${Math.abs(regression.intercept).toFixed(3)}`
        );
      }
      if (customizations.showTrendlineR2) {
        eqParts.push(`R² = ${regression.r2.toFixed(3)}`);
      }
      trendLabel = eqParts.length > 0 ? eqParts.join("  ") : "Trend";
    }

    // Use ComposedChart when trendline is active
    if (regression) {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart margin={sharedMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="tx"
              type="number"
              tick={{ fontSize: 11 }}
              label={xAxisLabel}
              domain={xDomain}
              name="x"
              allowDataOverflow
            />
            <YAxis
              type="number"
              tick={{ fontSize: 11 }}
              label={yAxisLabel}
              domain={yDomain}
              scale={yScale}
              reversed={customizations.yAxisReverse}
              allowDataOverflow
            />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            {legendProps && <Legend {...legendProps} />}
            <Scatter
              name="Data"
              data={scatterData.map((p: any) => ({ tx: p.x, ty: p.y }))}
              dataKey="ty"
              fill={colors[0]}
              isAnimationActive={false}
              shape={dotShape}
            />
            <Line
              name={trendLabel || "Trend"}
              data={trendlinePoints}
              dataKey="ty"
              dot={false}
              stroke={colors[1] ?? "#ef4444"}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              isAnimationActive={false}
              type="linear"
              legendType="line"
            />
            {customizations.showDropLines &&
              scatterData.map((p: any, i: number) => (
                <ReferenceLine
                  key={i}
                  x={p.x}
                  stroke={colors[0]}
                  strokeOpacity={0.25}
                  strokeDasharray="2 2"
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // Regular scatter (no trendline)
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={sharedMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="x"
            type="number"
            tick={{ fontSize: 11 }}
            label={xAxisLabel}
            domain={xDomain}
            allowDataOverflow
          />
          <YAxis
            dataKey="y"
            type="number"
            tick={{ fontSize: 11 }}
            label={yAxisLabel}
            domain={yDomain}
            scale={yScale}
            reversed={customizations.yAxisReverse}
            allowDataOverflow
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          {legendProps && <Legend {...legendProps} />}
          <Scatter
            data={scatterData}
            fill={colors[0]}
            isAnimationActive={false}
            shape={dotShape}
          />
          {customizations.showDropLines &&
            scatterData.map((p: any, i: number) => (
              <ReferenceLine
                key={i}
                x={p.x}
                stroke={colors[0]}
                strokeOpacity={0.25}
                strokeDasharray="2 2"
              />
            ))}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  // ── Area ─────────────────────────────────────────────────────────────────
  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={sharedMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" label={xAxisLabel} />
          <YAxis
            tick={{ fontSize: 11 }}
            label={yAxisLabel}
            domain={yDomain}
            scale={yScale}
            reversed={customizations.yAxisReverse}
            allowDataOverflow
          />
          <Tooltip />
          {legendProps && <Legend {...legendProps} />}
          {datasetKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              strokeWidth={customizations.strokeWidth}
              fill={colors[i % colors.length]}
              fillOpacity={customizations.fillOpacity}
              dot={false}
              isAnimationActive={false}
            >
              {customizations.showDataLabels && (
                <LabelList dataKey={key} position="top" style={{ fontSize: 9, fill: "#64748b" }} />
              )}
            </Area>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ── Line ─────────────────────────────────────────────────────────────────
  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={sharedMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" label={xAxisLabel} />
          <YAxis
            tick={{ fontSize: 11 }}
            label={yAxisLabel}
            domain={yDomain}
            scale={yScale}
            reversed={customizations.yAxisReverse}
            allowDataOverflow
          />
          <Tooltip />
          {legendProps && <Legend {...legendProps} />}
          {datasetKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              strokeWidth={customizations.strokeWidth}
              dot={false}
              isAnimationActive={false}
            >
              {customizations.showDataLabels && (
                <LabelList dataKey={key} position="top" style={{ fontSize: 9, fill: "#64748b" }} />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── Bar (default / scatter fallback) ─────────────────────────────────────
  const barRadius: [number, number, number, number] = [
    customizations.barBorderRadius,
    customizations.barBorderRadius,
    0,
    0,
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={sharedMargin} barGap={customizations.barGap}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} label={xAxisLabel} />
        <YAxis
          tick={{ fontSize: 11 }}
          label={yAxisLabel}
          domain={yDomain}
          scale={yScale}
          reversed={customizations.yAxisReverse}
          allowDataOverflow
        />
        <Tooltip />
        {legendProps && <Legend {...legendProps} />}
        {datasetKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[i % colors.length]}
            radius={barRadius}
            isAnimationActive={false}
          >
            {customizations.showDataLabels && (
              <LabelList dataKey={key} position="top" style={{ fontSize: 9, fill: "#64748b" }} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// ─── Editable cell ────────────────────────────────────────────────────────────

interface EditableCellProps {
  value: string | number;
  resultId: string;
  rowIndex: number;
  field: "metric" | "value";
  align?: "left" | "right";
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  resultId,
  rowIndex,
  field,
  align = "left",
}) => {
  const editTableCell = useAIPanelStore((s) => s.editTableCell);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    if (activeTabId) editTableCell(activeTabId, resultId, rowIndex, field, draft);
    setEditing(false);
  };

  const displayValue =
    typeof value === "number" ? value.toFixed(4) : String(value ?? "—");

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`h-6 text-sm py-0 px-1 ${align === "right" ? "text-right" : ""}`}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:text-[#14b8a6] hover:underline transition-colors ${
        align === "right" ? "font-mono" : ""
      }`}
      title="Click to edit"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {displayValue}
    </span>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

export const GraphTablePanel: React.FC = () => {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const activeTabName = useMemo(
    () => tabs.find((t) => t.id === activeTabId)?.title,
    [tabs, activeTabId]
  );

  const {
    resultsByTab,
    activeResultIdByTab,
    setActiveResult,
    clearResults,
    setCustomization,
    resetCustomizations,
    getTabCustomizations,
  } = useAIPanelStore();

  const results = (activeTabId ? resultsByTab[activeTabId] : null) ?? [];
  const activeResultId = activeTabId
    ? (activeResultIdByTab[activeTabId] ?? null)
    : null;

  const activeResult =
    results.find((r) => r.id === activeResultId) ??
    results[results.length - 1] ??
    null;

  const activeIndex = activeResult ? results.indexOf(activeResult) : -1;

  const customizations = activeTabId
    ? getTabCustomizations(activeTabId)
    : { ...DEFAULT_CUSTOMIZATIONS };

  const activeColors = useMemo(() => resolveColors(customizations), [customizations]);

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Editable graph title
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const displayTitle = titleOverride ?? activeResult?.graphTitle ?? null;
  React.useEffect(() => { setTitleOverride(null); }, [activeResult?.id]);

  // Chart data
  const chartData = activeResult?.analysisResults?.chart_data;
  const analysisType = activeResult?.analysisResults?.analysis_type;

  const seriesCount = useMemo(() => {
    if (!chartData) return 1;
    if (chartData.datasets) return chartData.datasets.length;
    return 1;
  }, [chartData]);

  // Table with sort / filter / zebra
  const displayTable = useMemo(() => {
    let table: Array<{ metric: string; value: any }> =
      activeResult?.editedTable ??
      activeResult?.analysisResults?.results_table ??
      [];

    if (customizations.tableFilter) {
      const q = customizations.tableFilter.toLowerCase();
      table = table.filter((r) =>
        String(r.metric).toLowerCase().includes(q)
      );
    }

    if (customizations.tableSort) {
      const { column, direction } = customizations.tableSort;
      table = [...table].sort((a, b) => {
        const av = column === "metric" ? String(a.metric) : a.value;
        const bv = column === "metric" ? String(b.metric) : b.value;
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return direction === "asc" ? cmp : -cmp;
      });
    }

    return table;
  }, [activeResult, customizations.tableFilter, customizations.tableSort]);

  // Customization handlers
  const handleSet = useCallback(
    <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => {
      if (!activeTabId) return;
      if (key === "chartType" && value === "scatter" && chartData && !chartData.points) {
        toast.warning("Data not suitable for Scatter — rendering as bar.", {
          description: "Try Line or Area for this label-based dataset.",
          duration: 4000,
        });
      }
      setCustomization(activeTabId, key, value);
    },
    [activeTabId, chartData, setCustomization]
  );

  const handleReset = useCallback(() => {
    if (activeTabId) resetCustomizations(activeTabId);
  }, [activeTabId, resetCustomizations]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (!activeResult) return;
    const table =
      activeResult.editedTable ??
      activeResult.analysisResults?.results_table ??
      [];
    const header = ["Metric", "Value"];
    const rows = table.map((r: any) => [
      `"${String(r.metric).replace(/"/g, '""')}"`,
      `"${String(r.value).replace(/"/g, '""')}"`,
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${activeResult.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeResult]);

  // BEFORE: requestedChartType useMemo — used to detect pharma chart type for PharmaChartPanel
  // AFTER:  removed — Charts tab is gone; Recharts ChartRenderer handles all chart output inline

  // BEFORE: const [view, setView] = useState<"charts" | "results">("charts")
  //         React.useEffect(() => { if (results.length > 0) setView("results"); }, [results.length])
  // AFTER:  view state removed — single panel always shows results

  // ── BLANK STATE ─────────────────────────────────────────────────────────
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#f8fafc] select-none px-10">
        <div className="flex flex-col items-center gap-5 text-center max-w-sm">
          {/* Icon */}
          <Calculator
            className="text-[#94a3b8]"
            style={{ width: 52, height: 52, strokeWidth: 1.5 }}
          />

          {/* Primary heading */}
          <div className="space-y-1">
            <p className="text-base font-semibold text-[#334155] leading-snug">
              No results generated yet
            </p>
            <p className="text-sm text-[#64748b] leading-relaxed">
              Ask Nuphorm to calculate — and see your results appear here.
            </p>
          </div>

          {/* Capability list */}
          <div className="text-left w-full">
            <p className="text-xs text-[#64748b] mb-2 leading-relaxed">
              Enter a biostatistics query in the chat input below to produce:
            </p>
            <ul className="space-y-1.5">
              {[
                "Summary statistics and editable tables",
                "Inferential analyses (t-tests, ANOVA, non-parametric tests, etc.)",
                "Survival estimates (Kaplan-Meier curves)",
                "Pharmacokinetic parameters and visualizations",
                "Custom plots (scatter, box, volcano, forest, heatmaps, and more)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-[#64748b] leading-relaxed">
                  <span className="mt-[3px] shrink-0 w-1 h-1 rounded-full bg-[#94a3b8]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Body sentence */}
          <p className="text-xs text-[#64748b] leading-relaxed">
            All generated outputs — tables, charts, and interpretations — will populate this panel instantly.
          </p>

          {/* Footer */}
          <p className="text-xs text-[#94a3b8] leading-relaxed">
            Ready when you are. Upload clean data and begin your analysis.
          </p>
        </div>
      </div>
    );
  }

  // BEFORE: if (view === "charts") { return <PharmaChartPanel … /> }
  // AFTER:  Charts tab removed — single results view always rendered below

  // ── RESULTS VIEW ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      {/* BEFORE: had Charts | Results view-toggle button group on the left   */}
      {/* AFTER:  single panel — title + inline pagination left, controls right */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#e2e8f0] bg-white">

        {/* Left: icon + title + pagination (when >1 result) */}
        <div className="flex items-center gap-2 min-w-0">
          <BarChart2 className="w-4 h-4 text-[#3b82f6] flex-shrink-0" />
          <span className="font-semibold text-sm text-[#0f172a] truncate">
            {results.length > 1
              ? `Results — ${activeIndex + 1} / ${results.length}`
              : "Analysis Results"}
          </span>

          {/* Inline pagination — shown only when multiple results exist */}
          {results.length > 1 && (
            <div className="flex items-center gap-0.5 ml-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-[#64748b] hover:text-[#0f172a]"
                disabled={activeIndex <= 0}
                onClick={() =>
                  activeTabId &&
                  setActiveResult(activeTabId, results[activeIndex - 1].id)
                }
                title="Previous result"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-[#64748b] hover:text-[#0f172a]"
                disabled={activeIndex >= results.length - 1}
                onClick={() =>
                  activeTabId &&
                  setActiveResult(activeTabId, results[activeIndex + 1].id)
                }
                title="Next result"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Right: Customize · Save · CSV · Clear */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Customize control panel */}
          <ControlPanel
            customizations={customizations}
            onSet={handleSet}
            onReset={handleReset}
            hasChartData={!!chartData}
            seriesCount={seriesCount}
          />

          {/* Save */}
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 transition-colors"
            onClick={() => setSaveModalOpen(true)}
            disabled={!activeResult}
            title="Save analysis to Technical Files"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>

          {/* Export CSV */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs px-2 text-[#64748b] hover:text-[#0f172a]"
            onClick={handleExportCSV}
            disabled={!activeResult || displayTable.length === 0}
            title="Export table as CSV"
          >
            <FileDown className="w-3.5 h-3.5" />
            CSV
          </Button>

          {/* Clear */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs px-2 text-destructive hover:text-destructive"
            onClick={() => activeTabId && clearResults(activeTabId)}
            title="Clear all results for this tab"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Editable AI-generated title */}
        {displayTitle && (
          <h2
            className="text-lg font-semibold text-[#0f172a] cursor-text outline-none hover:bg-[#f0fdfa] focus:bg-[#f0fdfa] rounded-lg px-2 py-1 -mx-2 transition-colors"
            contentEditable
            suppressContentEditableWarning
            title="Click to edit title"
            onBlur={(e) => {
              const val = e.currentTarget.textContent?.trim() ?? "";
              setTitleOverride(val || null);
            }}
          >
            {displayTitle}
          </h2>
        )}

        {/* Subtitle — shown for dataset_generation and any result with a subtitle */}
        {activeResult?.analysisResults?.subtitle && (
          <p className="text-sm text-[#64748b] leading-relaxed -mt-2">
            {activeResult.analysisResults.subtitle}
          </p>
        )}

        {/* Query caption */}
        {activeResult?.query && (
          <p className="text-xs text-[#64748b]">
            <span className="font-medium text-[#0f172a]/70">Query: </span>
            <em>{activeResult.query}</em>
            {analysisType && (
              <Badge
                variant="outline"
                className="ml-2 text-xs capitalize border-[#e2e8f0] text-[#64748b]"
              >
                {analysisType.replace(/_/g, " ")}
              </Badge>
            )}
          </p>
        )}

        {/* Stats table */}
        {displayTable.length > 0 && (
          <Card className="border border-[#e2e8f0] shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
              <CardTitle className="text-sm flex items-center gap-2 text-[#0f172a]">
                <Table2 className="w-4 h-4 text-[#14b8a6]" />
                Statistics Summary
                <span className="text-xs font-normal text-[#64748b]">
                  — click any cell to edit
                </span>
                {customizations.tableFilter && (
                  <Badge className="text-[10px] h-4 bg-teal-50 text-[#14b8a6] border border-[#14b8a6]/20 ml-1">
                    filtered
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                      Metric
                    </th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayTable.map((row: any, rowIdx: number) => (
                    <tr
                      key={rowIdx}
                      className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f0fdfa] transition-colors"
                      style={
                        customizations.zebraStriping && rowIdx % 2 === 0
                          ? { backgroundColor: "#f1f5f9" }
                          : undefined
                      }
                    >
                      <td className="py-1.5 px-4">
                        <EditableCell
                          value={row.metric}
                          resultId={activeResult!.id}
                          rowIndex={rowIdx}
                          field="metric"
                          align="left"
                        />
                      </td>
                      <td className="py-1.5 px-4 text-right">
                        <EditableCell
                          value={row.value}
                          resultId={activeResult!.id}
                          rowIndex={rowIdx}
                          field="value"
                          align="right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        {chartData && (
          <Card className="border border-[#e2e8f0] shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
              <CardTitle className="text-sm flex items-center gap-2 text-[#0f172a]">
                <TrendingUp className="w-4 h-4 text-[#14b8a6]" />
                {analysisType
                  ? `${analysisType.charAt(0).toUpperCase()}${analysisType
                      .slice(1)
                      .replace(/_/g, " ")} Chart`
                  : "Chart"}
                <Badge className="text-[10px] h-4 bg-[#f1f5f9] text-[#64748b] border-0 capitalize font-normal">
                  {customizations.chartType}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-3">
              <ChartRenderer
                chartData={chartData}
                customizations={customizations}
                colors={activeColors}
              />
            </CardContent>
          </Card>
        )}

        {/* Raw data table */}
        {activeResult?.tableData?.rows?.length > 0 && (
          <Card className="border border-[#e2e8f0] shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="py-2.5 px-4 border-b border-[#e2e8f0] bg-white">
              <CardTitle className="text-sm flex items-center gap-2 text-[#0f172a]">
                <Table2 className="w-4 h-4 text-[#14b8a6]" />
                Dataset
                <span className="text-xs font-normal text-[#64748b]">
                  — {activeResult.tableData.rows.length} observations
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto" style={{ maxHeight: "480px" }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#f8fafc] z-10">
                    <tr className="border-b border-[#e2e8f0]">
                      {activeResult.tableData.headers.map((h: string, i: number) => (
                        <th
                          key={i}
                          className="text-left py-2 px-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult.tableData.rows
                      .slice(0, 100)
                      .map((row: any[], rowIdx: number) => (
                        <tr
                          key={rowIdx}
                          className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f0fdfa] transition-colors"
                          style={
                            customizations.zebraStriping && rowIdx % 2 === 0
                              ? { backgroundColor: "#f1f5f9" }
                              : undefined
                          }
                        >
                          {row.map((cell: any, cellIdx: number) => (
                            <td
                              key={cellIdx}
                              className="py-1.5 px-3 font-mono text-xs text-[#0f172a] whitespace-nowrap"
                            >
                              {typeof cell === "number" && !Number.isInteger(cell)
                                ? cell.toFixed(4)
                                : String(cell ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
                {activeResult.tableData.rows.length > 100 && (
                  <p className="text-xs text-[#64748b] px-4 py-2 border-t border-[#e2e8f0]">
                    Showing 100 of {activeResult.tableData.rows.length} rows — export CSV to view all
                  </p>
                )}
              </div>
              {/* Table note (synthetic data disclaimer, etc.) */}
              {activeResult.analysisResults?.tableNote && (
                <p className="text-xs italic text-[#94a3b8] px-4 py-2.5 border-t border-[#e2e8f0]">
                  {activeResult.analysisResults.tableNote}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI interpretation / analysis text.
            Show when: no structured table/chart (fallback), OR analysis is pure narrative
            alongside a structured table. Hide only when analysis IS a raw markdown table
            and a structured table is already shown (avoids duplicate display). */}
        {activeResult?.analysis &&
          (displayTable.length === 0 && !chartData
            ? true  // always show if there's nothing else
            : !/\|\s*[-:]+[-|\s:]*\|/.test(activeResult.analysis)  // hide only if analysis IS a raw table
          ) && (
            <Card className="border border-[#e2e8f0] shadow-sm rounded-xl">
              <CardHeader className="py-2 px-4 border-b border-[#e2e8f0] bg-white">
                <CardTitle className="text-sm flex items-center gap-2 text-[#0f172a]">
                  <TrendingUp className="w-4 h-4 text-[#14b8a6]" />
                  Interpretation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 pb-4">
                <MarkdownContent content={activeResult.analysis} />
              </CardContent>
            </Card>
          )}
      </div>

      {/* Save modal */}
      <SaveAnalysisModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        result={activeResult}
        allResults={results}
        activeIndex={activeIndex}
        tabName={activeTabName}
        graphTitle={titleOverride ?? activeResult?.graphTitle}
      />
    </div>
  );
};

export default GraphTablePanel;
