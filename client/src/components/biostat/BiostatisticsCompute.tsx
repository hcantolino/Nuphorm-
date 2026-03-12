/**
 * Biostatistics Compute Component
 * Calls backend to compute actual statistics and displays results with charts
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Upload } from "lucide-react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";

interface ComputationResult {
  query: string;
  column: string | string[];
  statistic: string;
  result: {
    value: number | null;
    n: number;
    mean?: number | null;
    median?: number | null;
    stdDev?: number | null;
    min?: number | null;
    max?: number | null;
    range?: number | null;
    q1?: number | null;
    q3?: number | null;
    iqr?: number | null;
    cv?: number | null;
    ci95?: { lower: number; upper: number; margin: number } | null;
    upregulated?: number;
    downregulated?: number;
    unchanged?: number;
  };
  chartData: {
    type: "bar" | "line" | "scatter" | "histogram";
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }>;
  };
  explanation: string;
  rawData?: number[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: ComputationResult;
  timestamp: Date;
}

export function BiostatisticsCompute() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [csvData, setCsvData] = useState<Record<string, any>[] | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /**
   * Handle file upload
   */
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    try {
      const text = await file.text();
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && Array.isArray(results.data)) {
            setCsvData(results.data as Record<string, any>[]);

            const systemMessage: Message = {
              id: Date.now().toString(),
              role: "assistant",
              content: `✓ Uploaded "${file.name}" with ${results.data.length} rows.\n\nTry: "standard deviation for fold_change" or "show descriptive statistics"`,
              timestamp: new Date(),
            };
            setMessages([systemMessage]);
          }
        },
      });
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setFileLoading(false);
    }
  };

  /**
   * Handle query submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !csvData) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Call backend API
      const response = await fetch("/api/trpc/biostatistics.compute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: input,
          csvData,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.result?.data) {
        const result: ComputationResult = data.result.data;

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.explanation,
          result,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data.result?.error || "Unknown error");
      }
    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Render chart based on type
   */
  const renderChart = (result: ComputationResult) => {
    const { chartData } = result;

    // Prepare chart data
    const chartDataFormatted = chartData.labels.map((label, idx) => {
      const obj: any = { name: label };
      chartData.datasets.forEach((dataset) => {
        obj[dataset.label] = dataset.data[idx];
      });
      return obj;
    });

    switch (chartData.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartDataFormatted}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.datasets.map((dataset, idx) => (
                <Bar
                  key={idx}
                  dataKey={dataset.label}
                  fill={dataset.backgroundColor || "#3b82f6"}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartDataFormatted}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.datasets.map((dataset, idx) => (
                <Line
                  key={idx}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={dataset.borderColor || "#3b82f6"}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="name" />
              <YAxis type="number" />
              <Tooltip />
              <Legend />
              {chartData.datasets.map((dataset, idx) => (
                <Scatter
                  key={idx}
                  name={dataset.label}
                  data={chartDataFormatted}
                  fill={dataset.backgroundColor || "#3b82f6"}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        );

      case "histogram":
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartDataFormatted}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.datasets.map((dataset, idx) => (
                <Bar
                  key={idx}
                  dataKey={dataset.label}
                  fill={dataset.backgroundColor || "#3b82f6"}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  /**
   * Render statistics table
   */
  const renderStatsTable = (result: ComputationResult) => {
    const { result: stats } = result;

    return (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <tbody>
            <tr className="bg-gray-50">
              <td className="border px-3 py-2 font-medium">Count (n)</td>
              <td className="border px-3 py-2 font-mono text-right">
                {stats.n}
              </td>
            </tr>
            {stats.value !== null && (
              <tr className="bg-white">
                <td className="border px-3 py-2 font-medium">Value</td>
                <td className="border px-3 py-2 font-mono text-right">
                  {stats.value.toFixed(4)}
                </td>
              </tr>
            )}
            {stats.mean !== null && stats.mean !== undefined && (
              <tr className="bg-gray-50">
                <td className="border px-3 py-2 font-medium">Mean</td>
                <td className="border px-3 py-2 font-mono text-right">
                  {(stats.mean as number).toFixed(4)}
                </td>
              </tr>
            )}
            {stats.median !== null && stats.median !== undefined && (
              <tr className="bg-white">
                <td className="border px-3 py-2 font-medium">Median</td>
                <td className="border px-3 py-2 font-mono text-right">
                  {(stats.median as number).toFixed(4)}
                </td>
              </tr>
            )}
            {stats.stdDev !== null && stats.stdDev !== undefined && (
              <tr className="bg-gray-50">
                <td className="border px-3 py-2 font-medium">Std Dev</td>
                <td className="border px-3 py-2 font-mono text-right">
                  {(stats.stdDev as number).toFixed(4)}
                </td>
              </tr>
            )}
            {stats.min !== null && stats.min !== undefined && (
              <tr className="bg-white">
                <td className="border px-3 py-2 font-medium">Min</td>
                <td className="border px-3 py-2 font-mono text-right">
                  {(stats.min as number).toFixed(4)}
                </td>
              </tr>
            )}
            {stats.max !== null && stats.max !== undefined && (
              <tr className="bg-gray-50">
                <td className="border px-3 py-2 font-medium">Max</td>
                <td className="border px-3 py-2 font-mono text-right">
                  {(stats.max as number).toFixed(4)}
                </td>
              </tr>
            )}
            {stats.range !== null && stats.range !== undefined && (
              <tr className="bg-white">
                <td className="border px-3 py-2 font-medium">Range</td>
                <td className="border px-3 py-2 font-mono text-right">
                  {(stats.range as number).toFixed(4)}
                </td>
              </tr>
            )}
            {stats.ci95 && (
              <tr className="bg-blue-50">
                <td className="border px-3 py-2 font-medium">95% CI</td>
                <td className="border px-3 py-2 font-mono text-right">
                  [{stats.ci95.lower.toFixed(4)}, {stats.ci95.upper.toFixed(4)}]
                </td>
              </tr>
            )}
            {stats.upregulated !== undefined && (
              <>
                <tr className="bg-red-50">
                  <td className="border px-3 py-2 font-medium">Upregulated</td>
                  <td className="border px-3 py-2 font-mono text-right">
                    {stats.upregulated}
                  </td>
                </tr>
                <tr className="bg-blue-50">
                  <td className="border px-3 py-2 font-medium">Downregulated</td>
                  <td className="border px-3 py-2 font-mono text-right">
                    {stats.downregulated}
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border px-3 py-2 font-medium">Unchanged</td>
                  <td className="border px-3 py-2 font-mono text-right">
                    {stats.unchanged}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* File Upload */}
      {!csvData && (
        <Card className="p-4 border-dashed">
          <label className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition">
            <Upload className="w-5 h-5" />
            <span className="text-sm font-medium">
              {fileLoading ? "Uploading..." : "Click to upload CSV file"}
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={fileLoading}
              className="hidden"
            />
          </label>
        </Card>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 border rounded-lg p-4">
        <div className="space-y-4" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id}>
              {/* Message Text */}
              <div
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                } mb-2`}
              >
                <div
                  className={`max-w-md px-4 py-2 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>

              {/* Result Visualization */}
              {msg.result && (
                <Card className="p-4 bg-white border-gray-200">
                  {/* Chart */}
                  <div className="mb-4">{renderChart(msg.result)}</div>

                  {/* Stats Table */}
                  {renderStatsTable(msg.result)}
                </Card>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask: 'standard deviation for fold_change'..."
          disabled={loading || !csvData}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={loading || !csvData || !input.trim()}
          size="icon"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
