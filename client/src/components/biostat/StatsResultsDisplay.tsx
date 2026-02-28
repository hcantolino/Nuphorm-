/**
 * Statistics Results Display Component
 * Shows computed statistics in formatted tables and charts
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/statistics";

interface DescriptiveStats {
  n: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  sem: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  cv: number | null;
  skewness: number | null;
  kurtosis: number | null;
  ci95: { lower: number; upper: number; margin: number } | null;
}

interface FoldChangeStats {
  meanFoldChange: number | null;
  stdDevFoldChange: number | null;
  medianFoldChange: number | null;
  upregulated: number;
  downregulated: number;
  unchanged: number;
}

interface StatsResultsDisplayProps {
  stats?: DescriptiveStats | FoldChangeStats;
  title: string;
  column?: string;
}

export function StatsResultsDisplay({
  stats,
  title,
  column,
}: StatsResultsDisplayProps) {
  if (!stats) return null;

  const isDescriptive = "n" in stats;

  return (
    <Card className="p-4 bg-white border-gray-200">
      <h3 className="font-semibold text-lg mb-4">
        {title}
        {column && <span className="text-sm font-normal text-gray-600"> ({column})</span>}
      </h3>

      {isDescriptive ? (
        <DescriptiveStatsTable stats={stats as DescriptiveStats} />
      ) : (
        <FoldChangeStatsTable stats={stats as FoldChangeStats} />
      )}
    </Card>
  );
}

function DescriptiveStatsTable({ stats }: { stats: DescriptiveStats }) {
  const rows = [
    { label: "Count", value: stats.n },
    { label: "Mean", value: formatNumber(stats.mean, 4) },
    { label: "Median", value: formatNumber(stats.median, 4) },
    { label: "Std Dev", value: formatNumber(stats.stdDev, 4) },
    { label: "SEM", value: formatNumber(stats.sem, 4) },
    { label: "Min", value: formatNumber(stats.min, 4) },
    { label: "Max", value: formatNumber(stats.max, 4) },
    { label: "Range", value: formatNumber(stats.range, 4) },
    { label: "Q1", value: formatNumber(stats.q1, 4) },
    { label: "Q3", value: formatNumber(stats.q3, 4) },
    { label: "IQR", value: formatNumber(stats.iqr, 4) },
    { label: "CV (%)", value: formatNumber(stats.cv, 2) },
    { label: "Skewness", value: formatNumber(stats.skewness, 4) },
    { label: "Kurtosis", value: formatNumber(stats.kurtosis, 4) },
  ];

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}
            >
              <td className="px-3 py-2 font-medium text-gray-700">
                {row.label}
              </td>
              <td className="px-3 py-2 text-right font-mono text-gray-900">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {stats.ci95 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm font-medium text-blue-900">95% Confidence Interval</p>
          <p className="text-sm text-blue-700 font-mono mt-1">
            [{formatNumber(stats.ci95.lower, 4)}, {formatNumber(stats.ci95.upper, 4)}]
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Margin of Error: ±{formatNumber(stats.ci95.margin, 4)}
          </p>
        </div>
      )}
    </div>
  );
}

function FoldChangeStatsTable({ stats }: { stats: FoldChangeStats }) {
  const total = stats.upregulated + stats.downregulated + stats.unchanged;
  const upPercent = total > 0 ? ((stats.upregulated / total) * 100).toFixed(1) : "0";
  const downPercent = total > 0 ? ((stats.downregulated / total) * 100).toFixed(1) : "0";
  const unchangedPercent = total > 0 ? ((stats.unchanged / total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <tbody>
          <tr className="bg-gray-50">
            <td className="px-3 py-2 font-medium text-gray-700">
              Mean Fold Change
            </td>
            <td className="px-3 py-2 text-right font-mono text-gray-900">
              {formatNumber(stats.meanFoldChange, 4)}
            </td>
          </tr>
          <tr className="bg-white">
            <td className="px-3 py-2 font-medium text-gray-700">
              Std Dev
            </td>
            <td className="px-3 py-2 text-right font-mono text-gray-900">
              {formatNumber(stats.stdDevFoldChange, 4)}
            </td>
          </tr>
          <tr className="bg-gray-50">
            <td className="px-3 py-2 font-medium text-gray-700">
              Median
            </td>
            <td className="px-3 py-2 text-right font-mono text-gray-900">
              {formatNumber(stats.medianFoldChange, 4)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-xs font-medium text-red-700">Upregulated</p>
          <p className="text-lg font-bold text-red-900">{stats.upregulated}</p>
          <p className="text-xs text-red-600">{upPercent}%</p>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs font-medium text-blue-700">Unchanged</p>
          <p className="text-lg font-bold text-blue-900">{stats.unchanged}</p>
          <p className="text-xs text-blue-600">{unchangedPercent}%</p>
        </div>
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-xs font-medium text-green-700">Downregulated</p>
          <p className="text-lg font-bold text-green-900">{stats.downregulated}</p>
          <p className="text-xs text-green-600">{downPercent}%</p>
        </div>
      </div>
    </div>
  );
}
