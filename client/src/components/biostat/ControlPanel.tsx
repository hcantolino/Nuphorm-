/**
 * ControlPanel — Excel-like comprehensive customization floating panel
 * for the Results panel. Draggable, persistent (no backdrop blur).
 *
 * Sections:
 *   1. Chart  — type selector, series styling sliders, elements (labels, trendlines, error bars)
 *   2. Table  — filter, sort, display
 *   3. Graph  — axis labels, Y/X bounds, log scale, reverse, legend, grid
 *   4. Colors — preset palettes, react-colorful color wheel, per-series overrides
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import Draggable from "react-draggable";
import { HexColorPicker } from "react-colorful";
import { Switch } from "@/components/ui/switch";
import {
  Settings2,
  BarChart2,
  LineChart,
  TrendingUp,
  PieChart,
  Crosshair,
  Table2,
  Palette,
  RotateCcw,
  Search,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowDown01,
  ArrowDown10,
  X,
  GripHorizontal,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TabCustomizations,
  ControlChartType,
  PaletteName,
  LegendPosition,
  TableSortConfig,
  ErrorBarType,
  TrendlineType,
} from "@/stores/aiPanelStore";

// ── Palette definitions (exported so ChartRenderer can use them) ─────────

export const PALETTES: Record<PaletteName, string[]> = {
  finbox:       ["#14b8a6", "#3b82f6", "#64748b", "#8b5cf6", "#f59e0b", "#ec4899"],
  viridis:      ["#440154", "#31688e", "#35b779", "#fde725", "#90d743", "#6fbe44"],
  pastel:       ["#8ecae6", "#219ebc", "#e9c46a", "#f4a261", "#e76f51", "#f8c8d4"],
  highContrast: ["#1a1a1a", "#e41a1c", "#377eb8", "#4daf4a", "#ff7f00", "#984ea3"],
  publication:  ["#BC3C29", "#0072B5", "#E18727", "#20854E", "#7876B1", "#6F99AD"],
};

const PALETTE_LABELS: Record<PaletteName, string> = {
  finbox:       "Finbox Default",
  viridis:      "Viridis",
  pastel:       "Pastel",
  highContrast: "High Contrast",
  publication:  "Publication",
};

export const CHART_TYPES: {
  type: ControlChartType;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { type: "bar",     label: "Bar",     Icon: BarChart2   },
  { type: "line",    label: "Line",    Icon: LineChart   },
  { type: "area",    label: "Area",    Icon: TrendingUp  },
  { type: "scatter", label: "Scatter", Icon: Crosshair   },
  { type: "pie",     label: "Pie",     Icon: PieChart    },
];

// ── Shared micro-components ───────────────────────────────────────────────

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-2", className)}>
      {children}
    </p>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", disabled && "opacity-40 pointer-events-none")}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#0f172a]">{label}</p>
        {description && (
          <p className="text-[10px] text-[#94a3b8] leading-tight">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="flex-shrink-0 data-[state=checked]:bg-[#14b8a6]"
      />
    </div>
  );
}

function Accordion({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#f1f5f9] first:border-t-0 pt-3 mt-3 first:mt-0 first:pt-0">
      <button
        className="flex items-center justify-between w-full mb-2 focus:outline-none group"
        onClick={() => setOpen((p) => !p)}
      >
        <SectionLabel className="mb-0 group-hover:text-[#0f172a] transition-colors">{label}</SectionLabel>
        {open
          ? <ChevronDown className="w-3 h-3 text-[#94a3b8] flex-shrink-0" />
          : <ChevronRightIcon className="w-3 h-3 text-[#94a3b8] flex-shrink-0" />
        }
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  displayFn,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayFn?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#64748b]">{label}</span>
        <span className="text-[10px] font-mono text-[#0f172a] w-12 text-right">
          {displayFn ? displayFn(value) : String(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #14b8a6 ${pct}%, #e2e8f0 ${pct}%)`,
          accentColor: '#14b8a6',
        }}
      />
    </div>
  );
}

function BoundInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-[#64748b] w-8 flex-shrink-0">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          onChange(isNaN(v as number) ? null : v);
        }}
        placeholder="auto"
        className="flex-1 px-2 py-1 text-xs border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#14b8a6] focus:border-[#14b8a6] text-[#0f172a] placeholder:text-[#94a3b8] min-w-0"
      />
    </div>
  );
}

// ── Section: Chart ────────────────────────────────────────────────────────

const ChartSection: React.FC<{
  customizations: TabCustomizations;
  onSet: <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => void;
}> = ({ customizations, onSet }) => {
  const type = customizations.chartType;
  const isLine      = type === "line";
  const isArea      = type === "area";
  const isLineOrArea = isLine || isArea;
  const isScatter   = type === "scatter";
  const isBar       = type === "bar";

  return (
    <div>
      {/* Chart Type */}
      <SectionLabel>Chart Type</SectionLabel>
      <div className="grid grid-cols-5 gap-1.5 mb-0">
        {CHART_TYPES.map(({ type: t, label, Icon }) => (
          <button
            key={t}
            onClick={() => onSet("chartType", t)}
            title={label}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-[10px] font-medium transition-all focus:outline-none",
              type === t
                ? "bg-teal-50 border-[#14b8a6] text-[#14b8a6] shadow-sm"
                : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#14b8a6] hover:bg-teal-50 hover:text-[#0f172a]"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Series Styling */}
      <Accordion label="Series Styling" defaultOpen={true}>
        {isLineOrArea && (
          <SliderRow
            label="Stroke Width"
            value={customizations.strokeWidth}
            min={1} max={5} step={0.5}
            displayFn={(v) => `${v}px`}
            onChange={(v) => onSet("strokeWidth", v)}
          />
        )}
        {isArea && (
          <SliderRow
            label="Fill Opacity"
            value={customizations.fillOpacity}
            min={0} max={1} step={0.05}
            displayFn={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onSet("fillOpacity", v)}
          />
        )}
        {isScatter && (
          <SliderRow
            label="Marker Size"
            value={customizations.markerSize}
            min={2} max={14} step={1}
            displayFn={(v) => `${v}px`}
            onChange={(v) => onSet("markerSize", v)}
          />
        )}
        {isBar && (
          <>
            <SliderRow
              label="Corner Radius"
              value={customizations.barBorderRadius}
              min={0} max={12} step={1}
              displayFn={(v) => `${v}px`}
              onChange={(v) => onSet("barBorderRadius", v)}
            />
            <SliderRow
              label="Bar Gap"
              value={customizations.barGap}
              min={0} max={20} step={1}
              displayFn={(v) => `${v}px`}
              onChange={(v) => onSet("barGap", v)}
            />
          </>
        )}
        {!isLineOrArea && !isScatter && !isBar && (
          <p className="text-[10px] text-[#94a3b8] italic">
            Select Bar, Line, Area, or Scatter to see series styling.
          </p>
        )}
      </Accordion>

      {/* Elements */}
      <Accordion label="Elements" defaultOpen={true}>
        <ToggleRow
          label="Data Labels"
          description="Show values directly on bars / points"
          checked={customizations.showDataLabels}
          onChange={(v) => onSet("showDataLabels", v)}
        />
        {isScatter && (
          <ToggleRow
            label="Drop Lines"
            description="Vertical lines from each point to X-axis"
            checked={customizations.showDropLines}
            onChange={(v) => onSet("showDropLines", v)}
          />
        )}

        {/* Trendline */}
        <div>
          <p className="text-xs font-medium text-[#0f172a] mb-1.5">Trendline</p>
          <select
            value={customizations.trendlineType}
            onChange={(e) => onSet("trendlineType", e.target.value as TrendlineType)}
            className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#14b8a6] text-[#0f172a] bg-white"
          >
            <option value="none">None</option>
            <option value="linear">Linear</option>
            <option value="polynomial">Polynomial</option>
            <option value="exponential">Exponential</option>
          </select>
          {customizations.trendlineType !== "none" && (
            <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-teal-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customizations.showTrendlineEquation}
                  onChange={(e) => onSet("showTrendlineEquation", e.target.checked)}
                  className="w-3 h-3 accent-teal-500"
                />
                <span className="text-xs text-[#64748b]">Show equation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customizations.showTrendlineR2}
                  onChange={(e) => onSet("showTrendlineR2", e.target.checked)}
                  className="w-3 h-3 accent-teal-500"
                />
                <span className="text-xs text-[#64748b]">Show R²</span>
              </label>
            </div>
          )}
        </div>

        {/* Error Bars */}
        <div>
          <ToggleRow
            label="Error Bars"
            description="Requires error data from the AI response"
            checked={customizations.showErrorBars}
            onChange={(v) => onSet("showErrorBars", v)}
          />
          {customizations.showErrorBars && (
            <div className="mt-2 pl-3 border-l-2 border-teal-100">
              <select
                value={customizations.errorBarType}
                onChange={(e) => onSet("errorBarType", e.target.value as ErrorBarType)}
                className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#14b8a6] text-[#0f172a] bg-white"
              >
                <option value="std">Standard Deviation</option>
                <option value="se">Standard Error</option>
                <option value="ci95">95% Confidence Interval</option>
              </select>
            </div>
          )}
        </div>
      </Accordion>
    </div>
  );
};

// ── Section: Table ────────────────────────────────────────────────────────

type SortKey = "none" | "metric-asc" | "metric-desc" | "value-asc" | "value-desc";

const SORT_OPTIONS: {
  label: string;
  key: SortKey;
  Icon?: React.FC<{ className?: string }>;
  value: TableSortConfig | null;
}[] = [
  { label: "Default", key: "none",        value: null },
  { label: "A→Z",    key: "metric-asc",  Icon: ArrowDownAZ, value: { column: "metric", direction: "asc"  } },
  { label: "Z→A",    key: "metric-desc", Icon: ArrowDownZA, value: { column: "metric", direction: "desc" } },
  { label: "0→9",    key: "value-asc",   Icon: ArrowDown01, value: { column: "value",  direction: "asc"  } },
  { label: "9→0",    key: "value-desc",  Icon: ArrowDown10, value: { column: "value",  direction: "desc" } },
];

const TableSection: React.FC<{
  customizations: TabCustomizations;
  onSet: <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => void;
}> = ({ customizations, onSet }) => {
  const currentSortKey: SortKey = customizations.tableSort
    ? (`${customizations.tableSort.column}-${customizations.tableSort.direction}` as SortKey)
    : "none";

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div>
        <SectionLabel>Filter Rows</SectionLabel>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#94a3b8] pointer-events-none" />
          <input
            type="text"
            value={customizations.tableFilter}
            onChange={(e) => onSet("tableFilter", e.target.value)}
            placeholder="Filter by metric name…"
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-[#14b8a6] text-[#0f172a] placeholder:text-[#94a3b8] transition-colors"
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <SectionLabel>Sort By</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map(({ label, key, Icon, value }) => (
            <button
              key={key}
              onClick={() => onSet("tableSort", value)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-all focus:outline-none",
                currentSortKey === key
                  ? "bg-teal-50 border-[#14b8a6] text-[#14b8a6] font-medium"
                  : "border-[#e2e8f0] text-[#64748b] hover:border-[#14b8a6] hover:bg-teal-50 hover:text-[#0f172a]"
              )}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Display */}
      <div className="space-y-3">
        <SectionLabel>Display</SectionLabel>
        <ToggleRow
          label="Zebra Striping"
          description="Alternate row backgrounds"
          checked={customizations.zebraStriping}
          onChange={(v) => onSet("zebraStriping", v)}
        />
      </div>
    </div>
  );
};

// ── Section: Graph ────────────────────────────────────────────────────────

const LEGEND_OPTIONS: { label: string; value: LegendPosition }[] = [
  { label: "Top",    value: "top"    },
  { label: "Bottom", value: "bottom" },
  { label: "Left",   value: "left"   },
  { label: "Right",  value: "right"  },
  { label: "None",   value: "none"   },
];

const GraphSection: React.FC<{
  customizations: TabCustomizations;
  onSet: <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => void;
}> = ({ customizations, onSet }) => (
  <div className="space-y-4">
    {/* Axis Labels */}
    <div>
      <SectionLabel>Axis Labels</SectionLabel>
      <div className="space-y-1.5">
        <input
          type="text"
          value={customizations.xLabel}
          onChange={(e) => onSet("xLabel", e.target.value)}
          placeholder="X-axis label…"
          className="w-full px-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-[#14b8a6] text-[#0f172a] placeholder:text-[#94a3b8] transition-colors"
        />
        <input
          type="text"
          value={customizations.yLabel}
          onChange={(e) => onSet("yLabel", e.target.value)}
          placeholder="Y-axis label…"
          className="w-full px-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-[#14b8a6] text-[#0f172a] placeholder:text-[#94a3b8] transition-colors"
        />
      </div>
    </div>

    {/* Y-Axis */}
    <div>
      <SectionLabel>Y-Axis</SectionLabel>
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <BoundInput label="Min" value={customizations.yAxisMin} onChange={(v) => onSet("yAxisMin", v)} />
          <BoundInput label="Max" value={customizations.yAxisMax} onChange={(v) => onSet("yAxisMax", v)} />
        </div>
        <ToggleRow
          label="Log Scale"
          description="Logarithmic Y-axis"
          checked={customizations.yAxisLog}
          onChange={(v) => onSet("yAxisLog", v)}
        />
        <ToggleRow
          label="Reverse Axis"
          description="Invert Y-axis direction"
          checked={customizations.yAxisReverse}
          onChange={(v) => onSet("yAxisReverse", v)}
        />
      </div>
    </div>

    {/* X-Axis Bounds */}
    <div>
      <SectionLabel>X-Axis Bounds</SectionLabel>
      <p className="text-[10px] text-[#94a3b8] mb-2 -mt-1">For scatter / numeric X-axis</p>
      <div className="grid grid-cols-2 gap-2">
        <BoundInput label="Min" value={customizations.xAxisMin} onChange={(v) => onSet("xAxisMin", v)} />
        <BoundInput label="Max" value={customizations.xAxisMax} onChange={(v) => onSet("xAxisMax", v)} />
      </div>
    </div>

    {/* Legend position */}
    <div>
      <SectionLabel>Legend Position</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {LEGEND_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onSet("legendPosition", value)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs border transition-all focus:outline-none",
              customizations.legendPosition === value
                ? "bg-teal-50 border-[#14b8a6] text-[#14b8a6] font-medium"
                : "border-[#e2e8f0] text-[#64748b] hover:border-[#14b8a6] hover:bg-teal-50 hover:text-[#0f172a]"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    {/* Display */}
    <div className="space-y-3">
      <SectionLabel>Display</SectionLabel>
      <ToggleRow
        label="Grid Lines"
        description="Show major grid lines on chart"
        checked={customizations.showGrid}
        onChange={(v) => onSet("showGrid", v)}
      />
    </div>
  </div>
);

// ── Section: Colors ───────────────────────────────────────────────────────

const ColorsSection: React.FC<{
  customizations: TabCustomizations;
  onSet: <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => void;
  seriesCount: number;
}> = ({ customizations, onSet, seriesCount }) => {
  const [selectedSeries, setSelectedSeries] = useState(0);
  const paletteColors = PALETTES[customizations.palette];
  const count = Math.max(seriesCount, 1);
  const effectiveColors = Array.from({ length: count }, (_, i) =>
    customizations.customColors[i] || paletteColors[i % paletteColors.length]
  );

  const handleCustomColor = useCallback((i: number, color: string) => {
    const next = [...customizations.customColors];
    next[i] = color;
    onSet("customColors", next);
  }, [customizations.customColors, onSet]);

  const isCustom = customizations.customColors.some(Boolean);
  const wheelColor = effectiveColors[Math.min(selectedSeries, count - 1)] ?? "#14b8a6";

  return (
    <div className="space-y-4">
      {/* Preset palettes */}
      <div>
        <SectionLabel>Preset Palettes</SectionLabel>
        <div className="space-y-1.5">
          {(Object.keys(PALETTES) as PaletteName[]).map((name) => {
            const active = customizations.palette === name && !isCustom;
            return (
              <button
                key={name}
                onClick={() => {
                  onSet("palette", name);
                  onSet("customColors", []);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all focus:outline-none",
                  active
                    ? "border-[#14b8a6] bg-teal-50"
                    : "border-[#e2e8f0] hover:border-[#14b8a6] hover:bg-teal-50"
                )}
              >
                <span className={cn("font-medium", active ? "text-[#14b8a6]" : "text-[#0f172a]")}>
                  {PALETTE_LABELS[name]}
                </span>
                <div className="flex gap-0.5">
                  {PALETTES[name].map((c, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Wheel */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel className="mb-0">Color Wheel</SectionLabel>
          {isCustom && (
            <button
              onClick={() => onSet("customColors", [])}
              className="text-[10px] text-[#64748b] hover:text-[#14b8a6] transition-colors"
            >
              Reset custom
            </button>
          )}
        </div>

        {/* Series selector */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              onClick={() => setSelectedSeries(i)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border transition-all focus:outline-none",
                selectedSeries === i
                  ? "border-[#14b8a6] bg-teal-50 text-[#14b8a6] font-semibold"
                  : "border-[#e2e8f0] text-[#64748b] hover:border-[#14b8a6]"
              )}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: effectiveColors[i] }} />
              S{i + 1}
            </button>
          ))}
        </div>

        {/* HexColorPicker */}
        <div className="flex justify-center">
          <HexColorPicker
            color={wheelColor}
            onChange={(color) => handleCustomColor(selectedSeries, color)}
            style={{ width: "100%", height: "160px" }}
          />
        </div>

        {/* Hex text input */}
        <div className="mt-2 flex items-center gap-2">
          <div
            className="w-5 h-5 rounded border border-[#e2e8f0] flex-shrink-0"
            style={{ backgroundColor: wheelColor }}
          />
          <input
            type="text"
            value={wheelColor}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) handleCustomColor(selectedSeries, v);
            }}
            className="flex-1 px-2 py-1 text-xs font-mono border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#14b8a6]"
            maxLength={7}
            placeholder="#000000"
          />
          <span className="text-[10px] text-[#94a3b8]">Series {selectedSeries + 1}</span>
        </div>
      </div>

      {/* All series swatches */}
      <div>
        <SectionLabel>All Series</SectionLabel>
        <div className="space-y-2">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-[#64748b]">Series {i + 1}</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded border border-[#e2e8f0] flex-shrink-0"
                  style={{ backgroundColor: effectiveColors[i] }}
                />
                <input
                  type="color"
                  value={effectiveColors[i]}
                  onChange={(e) => handleCustomColor(i, e.target.value)}
                  className="w-8 h-6 rounded border border-[#e2e8f0] cursor-pointer p-0 bg-transparent"
                  title={`Color for series ${i + 1}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main ControlPanel component ───────────────────────────────────────────

type ControlSection = "chart" | "table" | "graph" | "colors";

const SECTION_TABS: {
  key: ControlSection;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { key: "chart",  label: "Chart",  Icon: BarChart2  },
  { key: "table",  label: "Table",  Icon: Table2     },
  { key: "graph",  label: "Graph",  Icon: TrendingUp },
  { key: "colors", label: "Colors", Icon: Palette    },
];

export interface ControlPanelProps {
  customizations: TabCustomizations;
  onSet: <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => void;
  onReset: () => void;
  hasChartData: boolean;
  seriesCount?: number;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  customizations,
  onSet,
  onReset,
  hasChartData,
  seriesCount = 1,
}) => {
  const [section, setSection] = useState<ControlSection>("chart");
  const [open, setOpen] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(360);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const resizeState = useRef<{
    type: "right" | "bottom" | "corner";
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeState.current) return;
      const { type, startX, startY, startW, startH } = resizeState.current;
      if (type === "right" || type === "corner") {
        const newW = Math.max(320, Math.min(700, startW + (e.clientX - startX)));
        setPanelWidth(newW);
      }
      if (type === "bottom" || type === "corner") {
        const maxH = window.innerHeight * 0.92;
        const newH = Math.max(280, Math.min(maxH, startH + (e.clientY - startY)));
        setPanelHeight(newH);
      }
    };
    const onUp = () => { resizeState.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startResize = useCallback(
    (type: "right" | "bottom" | "corner", e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeState.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        startW: panelWidth,
        startH: nodeRef.current?.offsetHeight ?? 400,
      };
    },
    [panelWidth]
  );

  // Suppress unused warning — hasChartData available for future scatter-specific logic
  void hasChartData;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-lg bg-[#14b8a6] hover:bg-[#0d9488] active:bg-[#0f766e] text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-1"
        aria-label="Open customization panel"
        aria-expanded={open}
      >
        <Settings2 className="w-3.5 h-3.5" />
        Customize
      </button>

      {/* Draggable floating panel — rendered in place, z-indexed above everything */}
      {open && (
        <Draggable nodeRef={nodeRef} handle=".drag-handle">
          <div
            ref={nodeRef}
            className="fixed top-20 right-4 bg-white border border-[#e2e8f0] rounded-xl z-[200] flex flex-col"
            style={{
              width: panelWidth,
              height: panelHeight ?? "auto",
              maxHeight: panelHeight ? "none" : "85vh",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            {/* Drag handle / header */}
            <div className="drag-handle flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc] rounded-tl-xl rounded-tr-xl cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-center gap-2">
                <GripHorizontal className="w-4 h-4 text-[#94a3b8]" />
                <span className="text-sm font-semibold text-[#0f172a]">Customize Results</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onReset}
                  className="flex items-center gap-1 text-[10px] text-[#64748b] hover:text-[#14b8a6] transition-colors focus:outline-none"
                  title="Reset all customizations to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset all
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-0.5 text-[#94a3b8] hover:text-[#0f172a] transition-colors focus:outline-none rounded"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Section tabs */}
            <div className="flex-shrink-0 flex border-b border-[#e2e8f0] bg-[#f8fafc]">
              {SECTION_TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors focus:outline-none",
                    section === key
                      ? "text-[#14b8a6] border-b-2 border-[#14b8a6] bg-white"
                      : "text-[#64748b] hover:text-[#0f172a] hover:bg-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Section content — scrollable only when content overflows height */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4">
                {section === "chart" && (
                  <ChartSection customizations={customizations} onSet={onSet} />
                )}
                {section === "table" && (
                  <TableSection customizations={customizations} onSet={onSet} />
                )}
                {section === "graph" && (
                  <GraphSection customizations={customizations} onSet={onSet} />
                )}
                {section === "colors" && (
                  <ColorsSection
                    customizations={customizations}
                    onSet={onSet}
                    seriesCount={seriesCount}
                  />
                )}
              </div>
            </div>

            {/* Right edge — drag to resize width */}
            <div
              onMouseDown={(e) => startResize("right", e)}
              title="Drag to resize width"
              style={{
                position: "absolute",
                top: 0,
                right: -3,
                bottom: 10,
                width: 6,
                cursor: "col-resize",
                borderRadius: "0 4px 4px 0",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,184,169,0.35)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            />

            {/* Bottom edge — drag to resize height */}
            <div
              onMouseDown={(e) => startResize("bottom", e)}
              title="Drag to resize height"
              style={{
                position: "absolute",
                bottom: -3,
                left: 10,
                right: 10,
                height: 6,
                cursor: "row-resize",
                borderRadius: "0 0 4px 4px",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,184,169,0.35)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            />

            {/* Bottom-right corner — drag to resize both */}
            <div
              onMouseDown={(e) => startResize("corner", e)}
              title="Drag to resize"
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 14,
                height: 14,
                cursor: "nwse-resize",
                background: "#DEE2E6",
                borderRadius: "0 0 10px 0",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#00B8A9"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#DEE2E6"; }}
            />
          </div>
        </Draggable>
      )}
    </>
  );
};

export default ControlPanel;
