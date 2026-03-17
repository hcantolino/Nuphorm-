import { useState, useEffect, useRef } from "react";
import {
  LayoutGrid, List, Image, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ViewMode = "grid" | "list" | "gallery";

export type GroupByOption =
  | "none"
  | "name"
  | "kind"
  | "dateModified"
  | "dateAdded"
  | "size"
  | "tags";

export const VIEW_MODES: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  { key: "grid",    label: "Grid",    icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { key: "list",    label: "List",    icon: <List className="w-3.5 h-3.5" /> },
  { key: "gallery", label: "Gallery", icon: <Image className="w-3.5 h-3.5" /> },
];

export const GROUP_BY_OPTIONS: { key: GroupByOption; label: string }[] = [
  { key: "none",         label: "None" },
  { key: "name",         label: "Name" },
  { key: "kind",         label: "Kind (File Type)" },
  { key: "dateModified", label: "Date Modified" },
  { key: "dateAdded",    label: "Date Added" },
  { key: "size",         label: "Size" },
  { key: "tags",         label: "Tags" },
];

// ── localStorage keys ─────────────────────────────────────────────────────────

const LS_VIEW_KEY_PREFIX = "nuphorm-view-mode-";
const LS_GROUP_KEY_PREFIX = "nuphorm-group-by-";

export function loadViewMode(section: string, fallback: ViewMode = "grid"): ViewMode {
  try {
    const v = localStorage.getItem(LS_VIEW_KEY_PREFIX + section);
    if (v && VIEW_MODES.some((m) => m.key === v)) return v as ViewMode;
  } catch {}
  return fallback;
}

export function saveViewMode(section: string, mode: ViewMode) {
  try { localStorage.setItem(LS_VIEW_KEY_PREFIX + section, mode); } catch {}
}

export function loadGroupBy(section: string, fallback: GroupByOption = "none"): GroupByOption {
  try {
    const v = localStorage.getItem(LS_GROUP_KEY_PREFIX + section);
    if (v === "dateCreated") return "dateAdded"; // migrate removed option
    if (v && GROUP_BY_OPTIONS.some((o) => o.key === v)) return v as GroupByOption;
  } catch {}
  return fallback;
}

export function saveGroupBy(section: string, group: GroupByOption) {
  try { localStorage.setItem(LS_GROUP_KEY_PREFIX + section, group); } catch {}
}

// ── Grouping helpers ──────────────────────────────────────────────────────────

export interface GroupedSection<T> {
  label: string;
  items: T[];
}

function getSizeCategory(sizeStr: string): string {
  const num = parseFloat(sizeStr);
  if (isNaN(num)) return "Unknown";
  const lower = sizeStr.toLowerCase();
  let bytes = num;
  if (lower.includes("kb")) bytes = num * 1024;
  else if (lower.includes("mb")) bytes = num * 1024 * 1024;
  else if (lower.includes("gb")) bytes = num * 1024 * 1024 * 1024;
  if (bytes < 1024 * 1024) return "Small (<1 MB)";
  if (bytes < 10 * 1024 * 1024) return "Medium (1-10 MB)";
  return "Large (>10 MB)";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Returns a sort-key prefix + display label separated by "|" so we can sort then display. */
function getDateCategory(dateStr: string): string {
  if (!dateStr) return "9|Unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "9|Unknown";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fileDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // This Day — same calendar day
  if (fileDay.getTime() === today.getTime()) {
    const label = `${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    return `0|${label}`;
  }

  // This Week — same ISO week (Mon-Sun containing today)
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  if (fileDay >= weekStart && fileDay <= weekEnd) {
    const fmt = (dt: Date) => `${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}`;
    const label = `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekEnd.getFullYear()}`;
    return `1|${label}`;
  }

  // This Month — same calendar month & year
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    return `2|${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }

  // Earlier — grouped by month/year, sorted most recent first
  const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return `${3 + monthsAgo}|${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Generic grouping for Data Library datasets */
export function groupDatasets<T extends { name: string; format?: string; uploadDate?: string; size?: string; tags?: string[] }>(
  items: T[],
  groupBy: GroupByOption,
  tagNames?: Map<string, string>,
): GroupedSection<T>[] {
  if (groupBy === "none") return [{ label: "", items }];

  const groups = new Map<string, T[]>();

  for (const item of items) {
    let key: string;
    switch (groupBy) {
      case "name": {
        const first = item.name.charAt(0).toUpperCase();
        key = /[A-Z]/.test(first) ? first : "#";
        break;
      }
      case "kind":
        key = item.format || "Unknown";
        break;
      case "dateModified":
      case "dateAdded":
        key = getDateCategory(item.uploadDate ?? "");
        break;
      case "size":
        key = getSizeCategory(item.size ?? "");
        break;
      case "tags": {
        const ts = item.tags ?? [];
        if (ts.length === 0) {
          key = "Untagged";
        } else {
          // Put item in first tag group
          key = tagNames?.get(ts[0]) ?? ts[0];
        }
        break;
      }
      default:
        key = "Other";
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  // Sort group keys — date groups use "N|Label" format for ordering
  const isDateGroup = groupBy === "dateModified" || groupBy === "dateAdded";
  const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
    if (isDateGroup) {
      const aNum = parseInt(a.split("|")[0], 10);
      const bNum = parseInt(b.split("|")[0], 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    }
    return a.localeCompare(b);
  });
  // Strip sort-key prefix for display
  return sorted.map(([rawLabel, items]) => {
    const label = isDateGroup && rawLabel.includes("|") ? rawLabel.split("|").slice(1).join("|") : rawLabel;
    return { label, items };
  });
}

/** Generic grouping for Technical Files */
export function groupTechnicalFiles<T extends { title?: string; filename?: string; content?: string; createdAt?: string | Date; generatedAt?: string | Date; measurements?: string[] }>(
  items: T[],
  groupBy: GroupByOption,
): GroupedSection<T>[] {
  if (groupBy === "none") return [{ label: "", items }];

  const groups = new Map<string, T[]>();

  for (const item of items) {
    let key: string;
    const name = (item as any).filename ?? (item as any).title ?? "";
    const dateStr = (item.createdAt ?? item.generatedAt ?? "").toString();
    const content = (item as any).content ?? "";
    const formatMatch = content.match?.(/<!-- FORMAT: (\w+) -->/);
    const format = formatMatch ? formatMatch[1].toUpperCase() : "HTML";
    const size = new Blob([content]).size;

    switch (groupBy) {
      case "name": {
        const first = name.charAt(0).toUpperCase();
        key = /[A-Z]/.test(first) ? first : "#";
        break;
      }
      case "kind":
        key = format;
        break;
      case "dateModified":
      case "dateAdded":
        key = getDateCategory(dateStr);
        break;
      case "size":
        if (size < 1024 * 1024) key = "Small (<1 MB)";
        else if (size < 10 * 1024 * 1024) key = "Medium (1-10 MB)";
        else key = "Large (>10 MB)";
        break;
      case "tags": {
        const ms: string[] = Array.isArray(item.measurements) ? item.measurements : [];
        const tags = ms.filter((m) => m.startsWith("tag:")).map((m) => m.slice(4));
        key = tags.length > 0 ? tags[0] : "Untagged";
        break;
      }
      default:
        key = "Other";
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const isDateGroup = groupBy === "dateModified" || groupBy === "dateAdded";
  const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
    if (isDateGroup) {
      const aNum = parseInt(a.split("|")[0], 10);
      const bNum = parseInt(b.split("|")[0], 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    }
    return a.localeCompare(b);
  });
  return sorted.map(([rawLabel, items]) => {
    const label = isDateGroup && rawLabel.includes("|") ? rawLabel.split("|").slice(1).join("|") : rawLabel;
    return { label, items };
  });
}

// ── GroupHeader component ─────────────────────────────────────────────────────

export function GroupHeader({
  label, count, collapsed, onToggle,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (!label) return null;
  return (
    <button
      onClick={onToggle}
      className="col-span-full w-full flex items-center gap-2.5 px-4 py-2.5 bg-[#e0f2ff] rounded-lg mb-2 transition-colors hover:bg-[#bae0fd]"
    >
      <ChevronDown className={cn("w-4 h-4 text-[#007bff] transition-transform", collapsed && "-rotate-90")} />
      <span className="text-sm font-bold text-[#1e40af]">{label}</span>
      <span className="text-xs text-[#3b82f6] font-medium ml-1">({count})</span>
    </button>
  );
}

// ── ViewToolbar component ─────────────────────────────────────────────────────

export function ViewToolbar({
  viewMode,
  onViewModeChange,
  groupBy,
  onGroupByChange,
  availableViews,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  groupBy: GroupByOption;
  onGroupByChange: (group: GroupByOption) => void;
  availableViews?: ViewMode[];
}) {
  const [groupOpen, setGroupOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const modes = availableViews
    ? VIEW_MODES.filter((m) => availableViews.includes(m.key))
    : VIEW_MODES;

  useEffect(() => {
    if (!groupOpen) return;
    const close = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [groupOpen]);

  const activeGroupLabel = GROUP_BY_OPTIONS.find((o) => o.key === groupBy)?.label ?? "None";

  return (
    <div className="flex-shrink-0 flex items-center gap-2">
      {/* View mode toggle */}
      <div className="flex items-center bg-[#f3f4f6] rounded-md p-0.5 gap-0.5">
        {modes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => onViewModeChange(mode.key)}
            title={`${mode.label} view`}
            className={cn(
              "p-2 rounded transition-all",
              viewMode === mode.key
                ? "bg-white text-[#007BFF] shadow-sm"
                : "text-[#6C757D] hover:text-[#374151]"
            )}
          >
            {mode.icon}
          </button>
        ))}
      </div>

      {/* Group By dropdown */}
      <div ref={groupRef} className="relative">
        <button
          onClick={() => setGroupOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors border",
            groupBy !== "none"
              ? "bg-[#EFF6FF] border-[#BFDBFE] text-[#007BFF]"
              : "bg-white border-[#DEE2E6] text-[#6C757D] hover:text-[#374151] hover:border-[#93C5FD]"
          )}
        >
          <span>Group: {activeGroupLabel}</span>
          <ChevronDown className={cn("w-3 h-3 transition-transform", groupOpen && "rotate-180")} />
        </button>
        {groupOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#DEE2E6] rounded-xl shadow-lg z-30 p-1">
            {GROUP_BY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { onGroupByChange(opt.key); setGroupOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-[13px] rounded-md transition-colors",
                  groupBy === opt.key
                    ? "bg-[#EFF6FF] text-[#007BFF] font-medium"
                    : "text-[#374151] hover:bg-[#f3f4f6]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
