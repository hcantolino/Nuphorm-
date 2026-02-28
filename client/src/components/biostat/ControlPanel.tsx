/**
 * ControlPanel — Finbox-themed customization popover for the Results panel.
 *
 * Four sections (tabs inside the popover):
 *   1. Chart Type  — switch between bar/line/area/scatter/pie
 *   2. Table       — filter, sort, zebra striping
 *   3. Graph       — axis labels, legend position, grid, data labels
 *   4. Colors      — preset palettes + per-series color overrides
 */

import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TabCustomizations,
  ControlChartType,
  PaletteName,
  LegendPosition,
  TableSortConfig,
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

// ── Shared helpers ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#0f172a]">{label}</p>
        {description && (
          <p className="text-[10px] text-[#94a3b8] leading-tight">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="flex-shrink-0 data-[state=checked]:bg-[#14b8a6]"
      />
    </div>
  );
}

// ── Section: Chart Type ───────────────────────────────────────────────────

const ChartTypeSection: React.FC<{
  value: ControlChartType;
  onChange: (v: ControlChartType) => void;
}> = ({ value, onChange }) => (
  <div>
    <SectionLabel>Chart Type</SectionLabel>
    <div className="grid grid-cols-5 gap-1.5">
      {CHART_TYPES.map(({ type, label, Icon }) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          title={label}
          className={cn(
            "flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-[10px] font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]",
            value === type
              ? "bg-teal-50 border-[#14b8a6] text-[#14b8a6] shadow-sm"
              : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#14b8a6] hover:bg-teal-50 hover:text-[#0f172a]"
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  </div>
);

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

      {/* Zebra striping */}
      <ToggleRow
        label="Zebra Striping"
        description="Alternate row backgrounds"
        checked={customizations.zebraStriping}
        onChange={(v) => onSet("zebraStriping", v)}
      />
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
    {/* Axis labels */}
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

    {/* Toggles */}
    <ToggleRow
      label="Grid Lines"
      description="Show major grid lines on chart"
      checked={customizations.showGrid}
      onChange={(v) => onSet("showGrid", v)}
    />
    <ToggleRow
      label="Data Labels"
      description="Show values on bars / points"
      checked={customizations.showDataLabels}
      onChange={(v) => onSet("showDataLabels", v)}
    />
  </div>
);

// ── Section: Colors ───────────────────────────────────────────────────────

const ColorsSection: React.FC<{
  customizations: TabCustomizations;
  onSet: <K extends keyof TabCustomizations>(key: K, value: TabCustomizations[K]) => void;
  seriesCount: number;
}> = ({ customizations, onSet, seriesCount }) => {
  const paletteColors = PALETTES[customizations.palette];
  const count = Math.max(seriesCount, 1);
  const effectiveColors = Array.from({ length: count }, (_, i) =>
    customizations.customColors[i] || paletteColors[i % paletteColors.length]
  );

  const handleCustomColor = (i: number, color: string) => {
    const next = [...customizations.customColors];
    next[i] = color;
    onSet("customColors", next);
  };

  const isCustom = customizations.customColors.some(Boolean);

  return (
    <div className="space-y-4">
      {/* Preset palettes */}
      <div>
        <SectionLabel>Preset Palettes</SectionLabel>
        <div className="space-y-1.5">
          {(Object.keys(PALETTES) as PaletteName[]).map((name) => {
            const active =
              customizations.palette === name && !isCustom;
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
                <span
                  className={cn(
                    "font-medium",
                    active ? "text-[#14b8a6]" : "text-[#0f172a]"
                  )}
                >
                  {PALETTE_LABELS[name]}
                </span>
                <div className="flex gap-0.5">
                  {PALETTES[name].map((c, i) => (
                    <div
                      key={i}
                      className="w-3.5 h-3.5 rounded-sm"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-series custom colors */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Custom Colors</SectionLabel>
          {isCustom && (
            <button
              onClick={() => onSet("customColors", [])}
              className="text-[10px] text-[#64748b] hover:text-[#14b8a6] transition-colors mb-2"
            >
              Reset
            </button>
          )}
        </div>
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-lg bg-[#14b8a6] hover:bg-[#0d9488] active:bg-[#0f766e] text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-1"
          aria-label="Open customization panel"
          aria-expanded={open}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Customize
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-[300px] p-0 bg-white border border-[#e2e8f0] rounded-xl shadow-lg overflow-hidden z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
          <span className="text-sm font-semibold text-[#0f172a]">
            Customize Results
          </span>
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[10px] text-[#64748b] hover:text-[#14b8a6] transition-colors focus:outline-none"
            title="Reset all customizations to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-[#e2e8f0] bg-[#f8fafc]">
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

        {/* Section content */}
        <ScrollArea className="max-h-72">
          <div className="p-4">
            {section === "chart" && (
              <ChartTypeSection
                value={customizations.chartType}
                onChange={(v) => {
                  if (!hasChartData && v !== "bar") {
                    /* allow — ChartRenderer falls back gracefully */
                  }
                  onSet("chartType", v);
                }}
              />
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
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default ControlPanel;
