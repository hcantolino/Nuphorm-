import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";

interface AnalysisResult {
  analysis_type: string;
  column?: string;
  value?: number;
  n_valid?: number;
  results_table?: Array<{ metric: string; value: any }>;
  chart_data?: any;
  tableData?: { headers: string[]; rows: any[][] };
  points?: Array<{ x: string | number; y: number }>;
}

interface AnalysisResultsDisplayProps {
  result: AnalysisResult;
}

export const AnalysisResultsDisplay: React.FC<AnalysisResultsDisplayProps> = ({
  result,
}) => {
  const [chartConfig, setChartConfig] = useState<any>(null);
  const [tableRows, setTableRows] = useState<any[][]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);

  // Log the full result for debugging
  useEffect(() => {
    console.log("[AnalysisResultsDisplay] Full result:", result);
    console.log("[AnalysisResultsDisplay] chart_data:", result?.chart_data);
    console.log("[AnalysisResultsDisplay] tableData:", result?.tableData);
  }, [result]);

  // Process chart and table data
  useEffect(() => {
    if (!result) {
      console.warn("[AnalysisResultsDisplay] No result provided");
      return;
    }

    // Set table data
    if (result.tableData?.rows && result.tableData?.headers) {
      console.log("[AnalysisResultsDisplay] Setting table rows:", result.tableData.rows.length);
      setTableRows(result.tableData.rows);
      setTableHeaders(result.tableData.headers);
    }

    // Set chart data
    if (result.chart_data) {
      console.log("[AnalysisResultsDisplay] Setting chart config from result");
      setChartConfig(result.chart_data);
    } else {
      // Use test data if no real data (for debugging)
      console.warn("[AnalysisResultsDisplay] No chart_data in result, using test data");
      const testChartData = {
        type: "line",
        labels: Array.from({ length: 100 }, (_, i) => i + 1),
        datasets: [
          {
            label: "fold_change",
            data: Array.from({ length: 100 }, () => Math.random() * 4 - 2),
            borderColor: "#3b82f6",
          },
          {
            label: "Median",
            data: Array(100).fill(0.875),
            borderColor: "#ef4444",
            borderDash: [5, 5],
          },
        ],
      };
      setChartConfig(testChartData);
    }
  }, [result]);

  // Log chart config before rendering
  useEffect(() => {
    console.log("[AnalysisResultsDisplay] Chart config being passed:", chartConfig);
  }, [chartConfig]);

  if (!result) {
    return (
      <Card className="p-4 mt-4 bg-red-50 dark:bg-red-900">
        <p className="text-red-600 dark:text-red-200">No analysis result available</p>
      </Card>
    );
  }

  const renderStatsSummary = () => {
    if (!result.results_table || result.results_table.length === 0) {
      return null;
    }

    return (
      <Card className="p-4 mt-4">
        <h4 className="text-sm font-semibold mb-4">Statistics Summary</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                  Metric
                </th>
                <th className="text-right py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {result.results_table.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <td className="py-2 px-3 text-slate-900 dark:text-slate-50">
                    {row.metric}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {typeof row.value === "number"
                      ? row.value.toFixed(4)
                      : String(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderChart = () => {
    if (!chartConfig) {
      console.warn("[AnalysisResultsDisplay] No chart config available");
      return (
        <Card className="p-4 mt-4 bg-yellow-50 dark:bg-yellow-900">
          <p className="text-yellow-600 dark:text-yellow-200">
            No chart data received
          </p>
        </Card>
      );
    }

    // Transform data for Recharts
    let transformedData: any[] = [];

    if (chartConfig.type === "line" && chartConfig.labels) {
      // Transform labels + datasets into Recharts format
      transformedData = chartConfig.labels.map((label: any, idx: number) => {
        const point: any = { name: label };
        if (chartConfig.datasets && Array.isArray(chartConfig.datasets)) {
          chartConfig.datasets.forEach((dataset: any) => {
            if (dataset.data && dataset.data[idx] !== undefined) {
              point[dataset.label] = dataset.data[idx];
            }
          });
        }
        return point;
      });
    } else if (chartConfig.data) {
      // If data is already in Recharts format
      transformedData = chartConfig.data;
    }

    console.log("[AnalysisResultsDisplay] Transformed chart data:", transformedData.slice(0, 5));

    if (transformedData.length === 0) {
      return (
        <Card className="p-4 mt-4 bg-yellow-50 dark:bg-yellow-900">
          <p className="text-yellow-600 dark:text-yellow-200">
            No data points to display
          </p>
        </Card>
      );
    }

    return (
      <Card className="p-4 mt-4">
        <h4 className="text-sm font-semibold mb-4">Chart</h4>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={transformedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {chartConfig.datasets &&
              chartConfig.datasets.map((dataset: any, idx: number) => (
                <Line
                  key={idx}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={dataset.borderColor || "#3b82f6"}
                  strokeDasharray={
                    dataset.borderDash
                      ? dataset.borderDash.join(" ")
                      : undefined
                  }
                  isAnimationActive={false}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  };

  const renderTable = () => {
    if (!tableRows || tableRows.length === 0) {
      console.warn("[AnalysisResultsDisplay] No table rows available");
      return null;
    }

    console.log("[AnalysisResultsDisplay] Rendering table with", tableRows.length, "rows");

    return (
      <Card className="p-4 mt-4">
        <h4 className="text-sm font-semibold mb-4">Data Table</h4>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-slate-50 dark:bg-slate-900">
                {tableHeaders.map((header, idx) => (
                  <th
                    key={idx}
                    className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(0, 20).map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {row.map((cell: any, cellIdx: number) => (
                    <td
                      key={cellIdx}
                      className="py-2 px-3 text-slate-900 dark:text-slate-50"
                    >
                      {typeof cell === "number" ? cell.toFixed(4) : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableRows.length > 20 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 p-2">
              Showing 20 of {tableRows.length} rows
            </p>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {renderStatsSummary()}
      {renderChart()}
      {renderTable()}
    </div>
  );
};
