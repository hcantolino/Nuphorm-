/**
 * DataPointsTable — Editable data-points table that syncs with the chart in real-time.
 *
 * Displays chart_data labels + datasets as columns. Cells are double-click editable
 * with number validation. On change, updates the chart data in the store so the
 * chart (Recharts/Plotly) re-renders immediately including recomputed trendlines.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

export interface DataPointsTableProps {
  /** Chart data with labels and datasets */
  chartData: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      [key: string]: any;
    }>;
    x_axis?: string;
    [key: string]: any;
  };
  /** Callback when a data point value changes. Receives the full updated chart data. */
  onDataChange: (updatedChartData: any) => void;
  /** X-axis column label override */
  xAxisLabel?: string;
}

// ── Editable cell ─────────────────────────────────────────────────────────

function EditableCell({
  value,
  onCommit,
  isNumeric,
}: {
  value: string | number;
  onCommit: (newValue: string | number) => void;
  isNumeric: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (isNumeric) {
      const num = Number(draft);
      if (!isNaN(num)) {
        onCommit(num);
      }
    } else {
      onCommit(draft);
    }
  }, [draft, isNumeric, onCommit]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={isNumeric ? "number" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="w-full px-2 py-1 text-xs border border-[#194CFF] rounded bg-blue-50 focus:outline-none focus:ring-1 focus:ring-[#194CFF] text-[#0f172a] font-mono"
        step="any"
      />
    );
  }

  return (
    <div
      className="px-2 py-1.5 cursor-pointer hover:bg-[#eff6ff] rounded transition-colors text-xs text-[#0f172a] font-mono tabular-nums group"
      onDoubleClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      title="Double-click to edit"
    >
      {typeof value === "number"
        ? Number.isInteger(value)
          ? String(value)
          : value.toFixed(4)
        : String(value)}
      <Pencil className="w-2.5 h-2.5 inline-block ml-1 text-[#94a3b8] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export const DataPointsTable: React.FC<DataPointsTableProps> = ({
  chartData,
  onDataChange,
  xAxisLabel,
}) => {
  if (!chartData?.labels || !chartData?.datasets) return null;

  const { labels, datasets } = chartData;
  const xHeader = xAxisLabel || chartData.x_axis || "Time (Days)";

  const handleLabelChange = useCallback(
    (rowIndex: number, newLabel: string | number) => {
      const newLabels = [...labels];
      newLabels[rowIndex] = String(newLabel);
      onDataChange({
        ...chartData,
        labels: newLabels,
      });
    },
    [labels, chartData, onDataChange]
  );

  const handleValueChange = useCallback(
    (datasetIndex: number, rowIndex: number, newValue: string | number) => {
      const newDatasets = datasets.map((ds, di) => {
        if (di !== datasetIndex) return ds;
        const newData = [...ds.data];
        newData[rowIndex] = Number(newValue);
        return { ...ds, data: newData };
      });
      onDataChange({
        ...chartData,
        datasets: newDatasets,
      });
    },
    [datasets, chartData, onDataChange]
  );

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e2e8f0]">
        <h3 className="text-[#1a2332] font-bold" style={{ fontSize: "1.125rem" }}>
          Data Points Used in Chart — Edit to Update Graph
        </h3>
        <p className="text-[10px] text-[#94a3b8] mt-1">
          Double-click any cell to edit. Changes update the chart in real-time.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E0F2FE]">
              <th className="text-left py-2 px-3 text-xs font-bold text-[#0f172a] uppercase tracking-wide whitespace-nowrap border-b border-[#e2e8f0]">
                {xHeader}
              </th>
              {datasets.map((ds, i) => (
                <th
                  key={i}
                  className="text-left py-2 px-3 text-xs font-bold text-[#0f172a] uppercase tracking-wide whitespace-nowrap border-b border-[#e2e8f0]"
                >
                  {ds.label ?? `Series ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, rowIdx) => (
              <tr
                key={rowIdx}
                className={`border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f0fdfa] transition-colors ${
                  rowIdx % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"
                }`}
              >
                <td className="py-0.5 px-1 min-w-[100px]">
                  <EditableCell
                    value={label}
                    onCommit={(v) => handleLabelChange(rowIdx, v)}
                    isNumeric={false}
                  />
                </td>
                {datasets.map((ds, di) => (
                  <td key={di} className="py-0.5 px-1 min-w-[100px]">
                    <EditableCell
                      value={ds.data[rowIdx] ?? 0}
                      onCommit={(v) => handleValueChange(di, rowIdx, v)}
                      isNumeric={true}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataPointsTable;
