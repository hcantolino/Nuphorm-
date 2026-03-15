/**
 * CustomizeSidebar — Sliding right sidebar panel with Excel-like customization controls.
 * Replaces the floating ControlPanel for a more integrated experience.
 *
 * Sections (accordion-based):
 *   1. Trendlines — toggle, thickness, style, opacity, glow, confidence bands
 *   2. Colors — legend-item color pickers with palette swatches + hex input
 *   3. Data Labels — toggle, format dropdown
 *   4. Axes — X/Y min/max/step, unit label, rotation, gridlines
 *   5. General — title, legend position, theme toggle
 *   6. Chart Type — bar/line/area/scatter/pie selector
 *   7. Table — filter, sort, zebra striping
 */

import React, { useState, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
import { Switch } from "@/components/ui/switch";
import {
  X,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  RotateCcw,
  BarChart2,
  LineChart,
  TrendingUp,
  PieChart,
  Crosshair,
  Search,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowDown01,
  ArrowDown10,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TabCustomizations,
  ControlChartType,
  PaletteName,
  LegendPosition,
  LegendAnchor,
  TableSortConfig,
  TrendlineType,
  TrendlineDashPattern,
  DataLabelFormat,
  ChartTheme,
  GridStyle,
  SeriesCustomization,
  MarkerShape,
  LineStyle,
} from "@/stores/aiPanelStore";
import { PALETTES } from "./ControlPanel";

// ── Finbox swatch colors ──────────────────────────────────────────────────
const FINBOX_SWATCHES = [
  { label: "Blue", hex: "#194CFF" },
  { label: "Green", hex: "#22C55E" },
  { label: "Pink", hex: "#EC4899" },
  { label: "Black", hex: "#0F172A" },
  { label: "Gray", hex: "#D1D5DB" },
  { label: "Purple", hex: "#8B5CF6" },
  { label: "Orange", hex: "#F59E0B" },
  { label: "Teal", hex: "#14B8A6" },
];

// ── Micro-components ──────────────────────────────────────────────────────

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold text-[#0f172a] uppercase tracking-wide mb-2", className)}>
      {children}
    </p>
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
    <div className="border-b border-[#e2e8f0] pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
      <button
        className="flex items-center justify-between w-full mb-2 focus:outline-none group"
        onClick={() => setOpen((p) => !p)}
      >
        <span className="text-sm font-semibold text-[#0f172a] group-hover:text-[#194CFF] transition-colors">
          {label}
        </span>
        {open
          ? <ChevronDown className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
          : <ChevronRightIcon className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
        }
      </button>
      {open && <div className="space-y-3 pl-0.5">{children}</div>}
    </div>
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
        className="flex-shrink-0 data-[state=checked]:bg-[#22C55E]"
      />
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
          background: `linear-gradient(to right, #194CFF ${pct}%, #e2e8f0 ${pct}%)`,
          accentColor: '#194CFF',
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
        className="flex-1 px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8] min-w-0"
      />
    </div>
  );
}

// ── Chart type options ────────────────────────────────────────────────────

const CHART_TYPES: {
  type: ControlChartType;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { type: "bar",     label: "Bar",     Icon: BarChart2   },
  { type: "line",    label: "Line",    Icon: LineChart    },
  { type: "area",    label: "Area",    Icon: TrendingUp   },
  { type: "scatter", label: "Scatter", Icon: Crosshair    },
  { type: "pie",     label: "Pie",     Icon: PieChart     },
];

const LEGEND_OPTIONS: { label: string; value: LegendPosition }[] = [
  { label: "Top",    value: "top"    },
  { label: "Bottom", value: "bottom" },
  { label: "Left",   value: "left"   },
  { label: "Right",  value: "right"  },
  { label: "None",   value: "none"   },
];

const LEGEND_ANCHOR_OPTIONS: { label: string; value: LegendAnchor }[] = [
  { label: "Top-Right",     value: "top-right" },
  { label: "Top-Left",      value: "top-left" },
  { label: "Bottom-Right",  value: "bottom-right" },
  { label: "Bottom-Left",   value: "bottom-left" },
  { label: "Outside Right", value: "outside-right" },
  { label: "Outside Bottom",value: "outside-bottom" },
];

const MARKER_SHAPE_OPTIONS: { label: string; value: MarkerShape }[] = [
  { label: "\u25CF Circle",        value: "circle" },
  { label: "\u25A0 Square",        value: "square" },
  { label: "\u25B2 Triangle Up",   value: "triangle-up" },
  { label: "\u25C6 Diamond",       value: "diamond" },
  { label: "\u25BC Triangle Down", value: "triangle-down" },
  { label: "\u2B21 Hexagon",       value: "hexagon" },
  { label: "\u2605 Star",          value: "star" },
  { label: "\u2716 Cross",         value: "cross" },
  { label: "\u2B1F Pentagon",      value: "pentagon" },
  { label: "\u22C8 Bowtie",        value: "bowtie" },
];

const LINE_STYLE_OPTIONS: { label: string; value: LineStyle }[] = [
  { label: "\u2500\u2500\u2500 Solid",     value: "solid" },
  { label: "- - - Dashed",    value: "dash" },
  { label: "\u00B7\u00B7\u00B7\u00B7 Dotted",     value: "dot" },
  { label: "-\u00B7-\u00B7 Dash-Dot", value: "dashdot" },
];

const GRID_STYLE_OPTIONS: { label: string; value: GridStyle }[] = [
  { label: "Solid",  value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
];

const PALETTE_LABELS: Record<PaletteName, string> = {
  finbox:       "Finbox Default",
  viridis:      "Viridis",
  pastel:       "Pastel",
  highContrast: "High Contrast",
  publication:  "Publication",
};

type SortKey = "none" | "metric-asc" | "metric-desc" | "value-asc" | "value-desc";

const SORT_OPTIONS: {
  label: string;
  key: SortKey;
  Icon?: React.FC<{ className?: string }>;
  value: TableSortConfig | null;
}[] = [
  { label: "Default", key: "none",        value: null },
  { label: "A\u2192Z",    key: "metric-asc",  Icon: ArrowDownAZ, value: { column: "metric", direction: "asc"  } },
  { label: "Z\u2192A",    key: "metric-desc", Icon: ArrowDownZA, value: { column: "metric", direction: "desc" } },
  { label: "0\u21929",    key: "value-asc",   Icon: ArrowDown01, value: { column: "value",  direction: "asc"  } },
  { label: "9\u21920",    key: "value-desc",  Icon: ArrowDown10, value: { column: "value",  direction: "desc" } },
];

// ── Main component ────────────────────────────────────────────────────────

export interface CustomizeSidebarProps {
  open: boolean;
  onClose: () => void;
  customizations: TabCustomizations;
  onSet: <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => void;
  onReset: () => void;
  seriesCount: number;
  seriesLabels?: string[];
}

export const CustomizeSidebar: React.FC<CustomizeSidebarProps> = ({
  open,
  onClose,
  customizations,
  onSet,
  onReset,
  seriesCount,
  seriesLabels,
}) => {
  const [colorPickerSeries, setColorPickerSeries] = useState<number | null>(null);
  const count = Math.max(seriesCount, 1);
  const paletteColors = PALETTES[customizations.palette];
  const effectiveColors = Array.from({ length: count }, (_, i) =>
    customizations.customColors[i] || paletteColors[i % paletteColors.length]
  );

  const handleCustomColor = useCallback((i: number, color: string) => {
    const next = [...customizations.customColors];
    next[i] = color;
    onSet("customColors", next);
  }, [customizations.customColors, onSet]);

  const currentSortKey: SortKey = customizations.tableSort
    ? (`${customizations.tableSort.column}-${customizations.tableSort.direction}` as SortKey)
    : "none";

  return (
    <div
      className={cn(
        "flex-shrink-0 h-full border-l border-[#e2e8f0] flex flex-col transition-all duration-300 overflow-hidden",
        open ? "w-[300px] opacity-100" : "w-0 opacity-0"
      )}
      style={{
        background: "linear-gradient(180deg, #E0F2FE 0%, #FFFFFF 100%)",
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
        <span className="text-sm font-semibold text-[#0f172a]">Customize</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[10px] text-[#64748b] hover:text-[#194CFF] transition-colors focus:outline-none"
            title="Reset all customizations"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={onClose}
            className="p-1 text-[#0f172a] hover:text-[#194CFF] transition-colors focus:outline-none rounded"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* ── Trendlines ──────────────────────────────────────────────────── */}
        <Accordion label="Trendlines" defaultOpen={true}>
          <ToggleRow
            label="Show Trendlines"
            checked={customizations.trendlineType !== "none"}
            onChange={(v) => onSet("trendlineType", v ? "linear" : "none")}
          />
          {customizations.trendlineType !== "none" && (
            <div className="space-y-3 mt-2">
              <div>
                <span className="text-xs text-[#64748b]">Type</span>
                <select
                  value={customizations.trendlineType}
                  onChange={(e) => onSet("trendlineType", e.target.value as TrendlineType)}
                  className="w-full mt-1 px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a]"
                >
                  <option value="linear">Linear</option>
                  <option value="polynomial">Polynomial</option>
                  <option value="exponential">Exponential</option>
                </select>
              </div>

              <SliderRow
                label="Thickness"
                value={customizations.trendlineThickness}
                min={1} max={5} step={0.5}
                displayFn={(v) => `${v}px`}
                onChange={(v) => onSet("trendlineThickness", v)}
              />

              <div>
                <span className="text-xs text-[#64748b]">Style</span>
                <div className="flex gap-1.5 mt-1">
                  {([
                    { value: "solid" as TrendlineDashPattern, label: "Solid", preview: "\u2500\u2500\u2500\u2500" },
                    { value: "dashed" as TrendlineDashPattern, label: "Dashed", preview: "- - -" },
                    { value: "dotted" as TrendlineDashPattern, label: "Dotted", preview: "\u00B7 \u00B7 \u00B7 \u00B7" },
                  ]).map(({ value, label, preview }) => (
                    <button
                      key={value}
                      onClick={() => onSet("trendlineDashPattern", value)}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-all focus:outline-none",
                        customizations.trendlineDashPattern === value
                          ? "bg-blue-50 border-[#194CFF] text-[#194CFF] shadow-sm"
                          : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#194CFF] hover:bg-blue-50"
                      )}
                    >
                      <span className="font-mono text-[9px] tracking-wider">{preview}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <SliderRow
                label="Opacity"
                value={customizations.trendlineOpacity}
                min={0.5} max={1} step={0.05}
                displayFn={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => onSet("trendlineOpacity", v)}
              />

              <ToggleRow
                label="Glow Effect"
                description="Add box-shadow glow on trendlines"
                checked={customizations.trendlineGlow}
                onChange={(v) => onSet("trendlineGlow", v)}
              />

              <ToggleRow
                label="Confidence Bands"
                description="Semi-transparent fill showing 95% CI"
                checked={customizations.showConfidenceBands}
                onChange={(v) => onSet("showConfidenceBands", v)}
              />

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customizations.showTrendlineEquation}
                  onChange={(e) => onSet("showTrendlineEquation", e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#194CFF] rounded"
                />
                <span className="text-xs text-[#64748b]">Show equation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customizations.showTrendlineR2}
                  onChange={(e) => onSet("showTrendlineR2", e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#194CFF] rounded"
                />
                <span className="text-xs text-[#64748b]">Show R\u00B2</span>
              </label>
            </div>
          )}
        </Accordion>

        {/* ── Colors ──────────────────────────────────────────────────────── */}
        <Accordion label="Colors" defaultOpen={false}>
          {/* Preset palettes */}
          <SectionLabel>Preset Palettes</SectionLabel>
          <div className="space-y-1.5 mb-4">
            {(Object.keys(PALETTES) as PaletteName[]).map((name) => {
              const active = customizations.palette === name && !customizations.customColors.some(Boolean);
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
                      ? "border-[#194CFF] bg-blue-50"
                      : "border-[#e2e8f0] bg-white hover:border-[#194CFF] hover:bg-blue-50"
                  )}
                >
                  <span className={cn("font-medium", active ? "text-[#194CFF]" : "text-[#0f172a]")}>
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

          {/* Legend-item color pickers */}
          <SectionLabel>Series Colors</SectionLabel>
          <p className="text-[10px] text-[#94a3b8] mb-2">Click a series to open its color picker</p>
          <div className="space-y-2">
            {Array.from({ length: count }, (_, i) => {
              const seriesLabel = seriesLabels?.[i] ?? `Series ${i + 1}`;
              const isOpen = colorPickerSeries === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setColorPickerSeries(isOpen ? null : i)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all focus:outline-none",
                      isOpen
                        ? "border-[#194CFF] bg-blue-50"
                        : "border-[#e2e8f0] bg-white hover:border-[#194CFF]/50"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-sm border border-black/10"
                        style={{ backgroundColor: effectiveColors[i] }}
                      />
                      <span className="text-[#0f172a] font-medium truncate max-w-[140px]">{seriesLabel}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#64748b]">{effectiveColors[i]}</span>
                  </button>

                  {isOpen && (
                    <div className="mt-2 p-3 border border-[#e2e8f0] rounded-lg bg-white space-y-3">
                      {/* Hex input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={effectiveColors[i]}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) handleCustomColor(i, v);
                          }}
                          className="flex-1 px-2 py-1.5 text-xs font-mono border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF]"
                          maxLength={7}
                          placeholder="#000000"
                        />
                        <input
                          type="color"
                          value={effectiveColors[i]}
                          onChange={(e) => handleCustomColor(i, e.target.value)}
                          className="w-8 h-8 rounded border border-[#e2e8f0] cursor-pointer p-0 bg-transparent"
                        />
                      </div>

                      {/* Finbox swatches */}
                      <div>
                        <p className="text-[10px] text-[#94a3b8] mb-1.5">Quick swatches</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FINBOX_SWATCHES.map(({ label, hex }) => (
                            <button
                              key={hex}
                              onClick={() => handleCustomColor(i, hex)}
                              className={cn(
                                "w-7 h-7 rounded-md border-2 transition-all focus:outline-none hover:scale-110",
                                effectiveColors[i] === hex
                                  ? "border-[#194CFF] ring-2 ring-[#194CFF]/30"
                                  : "border-transparent hover:border-[#94a3b8]"
                              )}
                              style={{ backgroundColor: hex }}
                              title={`${label} (${hex})`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Color wheel */}
                      <HexColorPicker
                        color={effectiveColors[i]}
                        onChange={(color) => handleCustomColor(i, color)}
                        style={{ width: "100%", height: "130px" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Accordion>

        {/* ── Data Labels ─────────────────────────────────────────────────── */}
        <Accordion label="Data Labels" defaultOpen={false}>
          <ToggleRow
            label="Show Data Labels"
            description="Display values on data points"
            checked={customizations.showDataLabels}
            onChange={(v) => onSet("showDataLabels", v)}
          />
          {customizations.showDataLabels && (
            <div className="mt-2 space-y-2">
              <div>
                <span className="text-xs text-[#64748b]">Format</span>
                <select
                  value={customizations.dataLabelFormat}
                  onChange={(e) => onSet("dataLabelFormat", e.target.value as DataLabelFormat)}
                  className="w-full mt-1 px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a]"
                >
                  <option value="decimal">Decimal (0.00)</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="integer">Integer</option>
                </select>
              </div>
              {customizations.dataLabelFormat === "decimal" && (
                <SliderRow
                  label="Decimal Places"
                  value={customizations.dataLabelDecimals}
                  min={0} max={6} step={1}
                  displayFn={(v) => `${v}`}
                  onChange={(v) => onSet("dataLabelDecimals", v)}
                />
              )}
            </div>
          )}
        </Accordion>

        {/* ── Axes ────────────────────────────────────────────────────────── */}
        <Accordion label="Axes" defaultOpen={false}>
          {/* X-Axis */}
          <SectionLabel>X-Axis</SectionLabel>
          <div className="space-y-2.5 mb-4">
            <div className="grid grid-cols-2 gap-2">
              <BoundInput label="Min" value={customizations.xAxisMin} onChange={(v) => onSet("xAxisMin", v)} />
              <BoundInput label="Max" value={customizations.xAxisMax} onChange={(v) => onSet("xAxisMax", v)} />
            </div>
            <BoundInput label="Step" value={customizations.xAxisStepSize} onChange={(v) => onSet("xAxisStepSize", v)} />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#64748b] w-8 flex-shrink-0">Unit</span>
              <input
                type="text"
                value={customizations.xLabel}
                onChange={(e) => onSet("xLabel", e.target.value)}
                placeholder="e.g. Days, Months"
                className="flex-1 px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8] min-w-0"
              />
            </div>
            <SliderRow
              label="Label Rotation"
              value={customizations.xAxisRotation}
              min={0} max={90} step={15}
              displayFn={(v) => `${v}\u00B0`}
              onChange={(v) => onSet("xAxisRotation", v)}
            />
          </div>

          {/* Y-Axis */}
          <SectionLabel>Y-Axis</SectionLabel>
          <div className="space-y-2.5 mb-4">
            <div className="grid grid-cols-2 gap-2">
              <BoundInput label="Min" value={customizations.yAxisMin} onChange={(v) => onSet("yAxisMin", v)} />
              <BoundInput label="Max" value={customizations.yAxisMax} onChange={(v) => onSet("yAxisMax", v)} />
            </div>
            <BoundInput label="Step" value={customizations.yAxisStepSize} onChange={(v) => onSet("yAxisStepSize", v)} />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#64748b] w-8 flex-shrink-0">Unit</span>
              <input
                type="text"
                value={customizations.yLabel}
                onChange={(e) => onSet("yLabel", e.target.value)}
                placeholder="e.g. Mean PFS, Probability"
                className="flex-1 px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8] min-w-0"
              />
            </div>
            <ToggleRow
              label="Log Scale"
              checked={customizations.yAxisLog}
              onChange={(v) => onSet("yAxisLog", v)}
            />
            <ToggleRow
              label="Reverse Axis"
              checked={customizations.yAxisReverse}
              onChange={(v) => onSet("yAxisReverse", v)}
            />
          </div>

          {/* Gridlines */}
          <ToggleRow
            label="Grid Lines"
            description="Dashed gray grid lines"
            checked={customizations.showGrid}
            onChange={(v) => onSet("showGrid", v)}
          />
        </Accordion>

        {/* ── General ─────────────────────────────────────────────────────── */}
        <Accordion label="General" defaultOpen={false}>
          {/* Title */}
          <div className="mb-3">
            <SectionLabel>Chart Title</SectionLabel>
            <input
              type="text"
              value={customizations.chartTitle}
              onChange={(e) => onSet("chartTitle", e.target.value)}
              placeholder="Enter chart title..."
              className="w-full px-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8] font-semibold"
            />
            <p className="text-[10px] text-[#94a3b8] mt-1">Auto-fits: scales down if too long</p>
          </div>

          {/* Legend */}
          <div className="mb-3">
            <SectionLabel>Legend Position</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {LEGEND_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => onSet("legendPosition", value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs border transition-all focus:outline-none",
                    customizations.legendPosition === value
                      ? "bg-blue-50 border-[#194CFF] text-[#194CFF] font-medium"
                      : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#194CFF] hover:bg-blue-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <SectionLabel>Theme</SectionLabel>
            <div className="flex gap-1.5">
              {([
                { value: "light" as ChartTheme, label: "Light (Finbox)" },
                { value: "dark" as ChartTheme, label: "Dark" },
              ]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onSet("chartTheme", value)}
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all focus:outline-none",
                    customizations.chartTheme === value
                      ? "bg-blue-50 border-[#194CFF] text-[#194CFF] font-medium"
                      : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#194CFF] hover:bg-blue-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Accordion>

        {/* ── Chart Type ──────────────────────────────────────────────────── */}
        <Accordion label="Chart Type" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {CHART_TYPES.map(({ type: t, label, Icon }) => (
              <button
                key={t}
                onClick={() => onSet("chartType", t)}
                title={label}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-[10px] font-medium transition-all focus:outline-none",
                  customizations.chartType === t
                    ? "bg-blue-50 border-[#194CFF] text-[#194CFF] shadow-sm"
                    : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#194CFF] hover:bg-blue-50 hover:text-[#0f172a]"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Series styling */}
          {(customizations.chartType === "line" || customizations.chartType === "area") && (
            <div className="mt-3">
              <SliderRow
                label="Stroke Width"
                value={customizations.strokeWidth}
                min={1} max={5} step={0.5}
                displayFn={(v) => `${v}px`}
                onChange={(v) => onSet("strokeWidth", v)}
              />
            </div>
          )}
          {customizations.chartType === "area" && (
            <div className="mt-2">
              <SliderRow
                label="Fill Opacity"
                value={customizations.fillOpacity}
                min={0} max={1} step={0.05}
                displayFn={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => onSet("fillOpacity", v)}
              />
            </div>
          )}
          {customizations.chartType === "bar" && (
            <div className="mt-3 space-y-2">
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
            </div>
          )}
          {customizations.chartType === "scatter" && (
            <div className="mt-3">
              <SliderRow
                label="Marker Size"
                value={customizations.markerSize}
                min={2} max={14} step={1}
                displayFn={(v) => `${v}px`}
                onChange={(v) => onSet("markerSize", v)}
              />
            </div>
          )}
        </Accordion>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <Accordion label="Table" defaultOpen={false}>
          <div className="space-y-3">
            {/* Filter */}
            <div>
              <SectionLabel>Filter Rows</SectionLabel>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#94a3b8] pointer-events-none" />
                <input
                  type="text"
                  value={customizations.tableFilter}
                  onChange={(e) => onSet("tableFilter", e.target.value)}
                  placeholder="Filter by metric name..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8]"
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
                        ? "bg-blue-50 border-[#194CFF] text-[#194CFF] font-medium"
                        : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#194CFF] hover:bg-blue-50"
                    )}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Display */}
            <ToggleRow
              label="Zebra Striping"
              description="Alternate row backgrounds"
              checked={customizations.zebraStriping}
              onChange={(v) => onSet("zebraStriping", v)}
            />
          </div>
        </Accordion>

        {/* ── Titles & Labels ─────────────────────────────────────────── */}
        <Accordion label="Titles & Labels" defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <SectionLabel>Chart Title</SectionLabel>
              <input
                type="text"
                value={customizations.chartTitle}
                onChange={(e) => onSet("chartTitle", e.target.value)}
                placeholder="Enter chart title..."
                className="w-full px-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8] font-semibold"
              />
            </div>
            <div>
              <SectionLabel>X-Axis Label</SectionLabel>
              <input
                type="text"
                value={customizations.xLabel}
                onChange={(e) => onSet("xLabel", e.target.value)}
                placeholder="e.g. Time (Months)"
                className="w-full px-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8]"
              />
            </div>
            <div>
              <SectionLabel>Y-Axis Label</SectionLabel>
              <input
                type="text"
                value={customizations.yLabel}
                onChange={(e) => onSet("yLabel", e.target.value)}
                placeholder="e.g. Mean PFS (Days)"
                className="w-full px-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8]"
              />
            </div>
            <div>
              <SectionLabel>Subtitle / Reference</SectionLabel>
              <input
                type="text"
                value={customizations.subtitle}
                onChange={(e) => onSet("subtitle", e.target.value)}
                placeholder="e.g. Fig. 1A or citation"
                className="w-full px-3 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF] text-[#0f172a] placeholder:text-[#94a3b8]"
              />
            </div>
          </div>
        </Accordion>

        {/* ── Grid & Background ───────────────────────────────────────── */}
        <Accordion label="Grid & Background" defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <SectionLabel>Background Color</SectionLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customizations.bgColor}
                  onChange={(e) => onSet("bgColor", e.target.value)}
                  className="w-8 h-8 rounded border border-[#e2e8f0] cursor-pointer p-0 bg-transparent"
                />
                <input
                  type="text"
                  value={customizations.bgColor}
                  onChange={(e) => {
                    if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onSet("bgColor", e.target.value);
                  }}
                  className="flex-1 px-2 py-1.5 text-xs font-mono border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 focus:border-[#194CFF]"
                  maxLength={7}
                />
              </div>
            </div>
            <ToggleRow
              label="Show Grid Lines"
              checked={customizations.showGrid}
              onChange={(v) => onSet("showGrid", v)}
            />
            {customizations.showGrid && (
              <>
                <div>
                  <SectionLabel>Grid Color</SectionLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customizations.gridColor}
                      onChange={(e) => onSet("gridColor", e.target.value)}
                      className="w-8 h-8 rounded border border-[#e2e8f0] cursor-pointer p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={customizations.gridColor}
                      onChange={(e) => {
                        if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onSet("gridColor", e.target.value);
                      }}
                      className="flex-1 px-2 py-1.5 text-xs font-mono border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div>
                  <SectionLabel>Grid Style</SectionLabel>
                  <div className="flex gap-1.5">
                    {GRID_STYLE_OPTIONS.map(({ label, value }) => (
                      <button
                        key={value}
                        onClick={() => onSet("gridStyle", value)}
                        className={cn(
                          "flex-1 px-2 py-1 rounded-lg text-xs border transition-all focus:outline-none",
                          customizations.gridStyle === value
                            ? "bg-blue-50 border-[#194CFF] text-[#194CFF] font-medium"
                            : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#194CFF]"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <ToggleRow
              label="Show Chart Border"
              description="Box border around plot area"
              checked={customizations.showChartBorder}
              onChange={(v) => onSet("showChartBorder", v)}
            />
            {customizations.showChartBorder && (
              <div>
                <SectionLabel>Border Color</SectionLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customizations.borderColor}
                    onChange={(e) => onSet("borderColor", e.target.value)}
                    className="w-8 h-8 rounded border border-[#e2e8f0] cursor-pointer p-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={customizations.borderColor}
                    onChange={(e) => {
                      if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onSet("borderColor", e.target.value);
                    }}
                    className="flex-1 px-2 py-1.5 text-xs font-mono border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20"
                    maxLength={7}
                  />
                </div>
              </div>
            )}
            <ToggleRow
              label="Show Minor Ticks"
              description="Smaller tick marks between major ticks"
              checked={customizations.showMinorTicks}
              onChange={(v) => onSet("showMinorTicks", v)}
            />
          </div>
        </Accordion>

        {/* ── Per-Series Styling ───────────────────────────────────────── */}
        <Accordion label="Series / Lines / Bars" defaultOpen={false}>
          <p className="text-[10px] text-[#94a3b8] mb-2">Individually style each data series</p>
          <div className="space-y-2">
            {Array.from({ length: count }, (_, i) => {
              const seriesLabel = seriesLabels?.[i] ?? `Series ${i + 1}`;
              const override = customizations.seriesOverrides[i];
              const isExpanded = colorPickerSeries === (i + 100); // offset to avoid collision
              const color = override?.color ?? effectiveColors[i];

              return (
                <div key={i} className="border border-[#e2e8f0] rounded-lg overflow-hidden bg-white">
                  <button
                    onClick={() => setColorPickerSeries(isExpanded ? null : (i + 100))}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#f8fafc] transition-colors focus:outline-none"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-sm border border-black/10" style={{ backgroundColor: color }} />
                      <span className="font-medium text-[#0f172a] truncate max-w-[150px]">
                        {override?.name ?? seriesLabel}
                      </span>
                      {override?.visible === false && (
                        <span className="text-[9px] text-[#94a3b8] italic">hidden</span>
                      )}
                    </span>
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3 text-[#94a3b8]" />
                      : <ChevronRightIcon className="w-3 h-3 text-[#94a3b8]" />
                    }
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2.5 border-t border-[#e2e8f0]">
                      {/* Name */}
                      <div className="mt-2">
                        <span className="text-[10px] text-[#64748b]">Name</span>
                        <input
                          type="text"
                          value={override?.name ?? seriesLabel}
                          onChange={(e) => {
                            const overrides = [...customizations.seriesOverrides];
                            overrides[i] = {
                              ...(overrides[i] ?? { name: seriesLabel, color, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: color, visible: true }),
                              name: e.target.value,
                            };
                            onSet("seriesOverrides", overrides);
                          }}
                          className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 text-[#0f172a]"
                        />
                      </div>

                      {/* Color — full color picker */}
                      <div>
                        <span className="text-[10px] text-[#64748b]">Color</span>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            value={color}
                            onChange={(e) => {
                              if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                                handleCustomColor(i, e.target.value);
                                const overrides = [...customizations.seriesOverrides];
                                overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color: e.target.value, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: e.target.value, visible: true }), color: e.target.value };
                                onSet("seriesOverrides", overrides);
                              }
                            }}
                            className="flex-1 px-2 py-1.5 text-xs font-mono border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20"
                            maxLength={7}
                          />
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                              handleCustomColor(i, e.target.value);
                              const overrides = [...customizations.seriesOverrides];
                              overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color: e.target.value, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: e.target.value, visible: true }), color: e.target.value };
                              onSet("seriesOverrides", overrides);
                            }}
                            className="w-8 h-8 rounded border border-[#e2e8f0] cursor-pointer p-0 bg-transparent"
                          />
                        </div>
                        <HexColorPicker
                          color={color}
                          onChange={(c) => {
                            handleCustomColor(i, c);
                            const overrides = [...customizations.seriesOverrides];
                            overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color: c, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: c, visible: true }), color: c };
                            onSet("seriesOverrides", overrides);
                          }}
                          style={{ width: "100%", height: "100px", marginTop: 6 }}
                        />
                      </div>

                      {/* Line Style */}
                      <div>
                        <span className="text-[10px] text-[#64748b]">Line Style</span>
                        <select
                          value={override?.lineStyle ?? "solid"}
                          onChange={(e) => {
                            const overrides = [...customizations.seriesOverrides];
                            overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: color, visible: true }), lineStyle: e.target.value as LineStyle };
                            onSet("seriesOverrides", overrides);
                          }}
                          className="w-full mt-1 px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 text-[#0f172a]"
                        >
                          {LINE_STYLE_OPTIONS.map(({ label, value }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Line Width */}
                      <SliderRow
                        label="Line Width"
                        value={override?.lineWidth ?? 2}
                        min={1} max={5} step={0.5}
                        displayFn={(v) => `${v}px`}
                        onChange={(v) => {
                          const overrides = [...customizations.seriesOverrides];
                          overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: color, visible: true }), lineWidth: v };
                          onSet("seriesOverrides", overrides);
                        }}
                      />

                      {/* Marker Shape */}
                      <div>
                        <span className="text-[10px] text-[#64748b]">Marker Shape</span>
                        <select
                          value={override?.markerShape ?? "circle"}
                          onChange={(e) => {
                            const overrides = [...customizations.seriesOverrides];
                            overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: color, visible: true }), markerShape: e.target.value as MarkerShape };
                            onSet("seriesOverrides", overrides);
                          }}
                          className="w-full mt-1 px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 text-[#0f172a]"
                        >
                          {MARKER_SHAPE_OPTIONS.map(({ label, value }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Marker Size */}
                      <SliderRow
                        label="Marker Size"
                        value={override?.markerSize ?? 8}
                        min={4} max={16} step={1}
                        displayFn={(v) => `${v}px`}
                        onChange={(v) => {
                          const overrides = [...customizations.seriesOverrides];
                          overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: color, visible: true }), markerSize: v };
                          onSet("seriesOverrides", overrides);
                        }}
                      />

                      {/* Error Bars */}
                      <ToggleRow
                        label="Show Error Bars"
                        checked={override?.showErrorBars ?? false}
                        onChange={(v) => {
                          const overrides = [...customizations.seriesOverrides];
                          overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: color, visible: true }), showErrorBars: v };
                          onSet("seriesOverrides", overrides);
                        }}
                      />

                      {/* Visible */}
                      <ToggleRow
                        label="Visible"
                        description="Show/hide this series"
                        checked={override?.visible !== false}
                        onChange={(v) => {
                          const overrides = [...customizations.seriesOverrides];
                          overrides[i] = { ...(overrides[i] ?? { name: seriesLabel, color, lineStyle: 'solid', lineWidth: 2, markerShape: 'circle', markerSize: 8, showErrorBars: false, errorBarColor: color, visible: true }), visible: v };
                          onSet("seriesOverrides", overrides);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Accordion>

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <Accordion label="Legend" defaultOpen={false}>
          <div className="space-y-3">
            <ToggleRow
              label="Show Legend"
              checked={customizations.legendPosition !== "none"}
              onChange={(v) => onSet("legendPosition", v ? "top" : "none")}
            />
            {customizations.legendPosition !== "none" && (
              <>
                <div>
                  <SectionLabel>Position</SectionLabel>
                  <select
                    value={customizations.legendAnchor}
                    onChange={(e) => onSet("legendAnchor", e.target.value as LegendAnchor)}
                    className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 text-[#0f172a]"
                  >
                    {LEGEND_ANCHOR_OPTIONS.map(({ label, value }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <ToggleRow
                  label="Legend Border"
                  checked={customizations.showLegendBorder}
                  onChange={(v) => onSet("showLegendBorder", v)}
                />
                <div>
                  <SectionLabel>Legend Background</SectionLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customizations.legendBgColor}
                      onChange={(e) => onSet("legendBgColor", e.target.value)}
                      className="w-8 h-8 rounded border border-[#e2e8f0] cursor-pointer p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={customizations.legendBgColor}
                      onChange={(e) => {
                        if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onSet("legendBgColor", e.target.value);
                      }}
                      className="flex-1 px-2 py-1.5 text-xs font-mono border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20"
                      maxLength={7}
                    />
                  </div>
                </div>
                <SliderRow
                  label="Font Size"
                  value={customizations.legendFontSize}
                  min={8} max={16} step={1}
                  displayFn={(v) => `${v}px`}
                  onChange={(v) => onSet("legendFontSize", v)}
                />
              </>
            )}
          </div>
        </Accordion>

        {/* ── Data Values ─────────────────────────────────────────────── */}
        <Accordion label="Data Values" defaultOpen={false}>
          <div className="space-y-3">
            <ToggleRow
              label="Show Values on Chart"
              description="Display numbers above bars or next to points"
              checked={customizations.showValues}
              onChange={(v) => onSet("showValues", v)}
            />
            {customizations.showValues && (
              <>
                <SliderRow
                  label="Value Font Size"
                  value={customizations.valueFontSize}
                  min={8} max={16} step={1}
                  displayFn={(v) => `${v}px`}
                  onChange={(v) => onSet("valueFontSize", v)}
                />
                <div>
                  <SectionLabel>Position</SectionLabel>
                  <div className="flex gap-1.5">
                    {(["above", "below", "inside"] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => onSet("valuePosition", pos)}
                        className={cn(
                          "flex-1 px-2 py-1 rounded-lg text-xs border transition-all focus:outline-none capitalize",
                          customizations.valuePosition === pos
                            ? "bg-blue-50 border-[#194CFF] text-[#194CFF] font-medium"
                            : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#194CFF]"
                        )}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <SectionLabel>Decimal Places</SectionLabel>
                  <select
                    value={customizations.dataLabelDecimals}
                    onChange={(e) => onSet("dataLabelDecimals", Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#194CFF]/20 text-[#0f172a]"
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </Accordion>
      </div>
    </div>
  );
};

export default CustomizeSidebar;
