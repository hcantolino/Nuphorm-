/**
 * Biostatistics Chat Component
 * Handles user queries and performs real statistical calculations
 */

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Upload } from "lucide-react";
import { useBiostatData } from "@/contexts/BiostatDataContext";
import {
  computeSampleStdDev,
  computeMean,
  computeMedian,
  computeDescriptiveStats,
  computeFoldChangeStats,
  filterNumericValues,
  formatNumber,
} from "@/lib/statistics";
import {
  parseQuery,
  generateResponse,
  generateSuggestions,
  requiresData,
} from "@/lib/queryParser";
import Papa from "papaparse";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  result?: any;
  column?: string;
}

export function BiostatisticsChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, uploadData, getNumericColumnData, addAnalysisResult } =
    useBiostatData();

  // Auto-scroll to bottom
  useEffect(() => {
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
            uploadData(file.name, results.data as Record<string, any>[]);

            // Add system message
            const systemMessage: Message = {
              id: Date.now().toString(),
              role: "assistant",
              content: `✓ Uploaded "${file.name}" with ${results.data.length} rows and ${Object.keys(results.data[0] || {}).length} columns.\n\nAvailable columns: ${Object.keys(results.data[0] || {}).join(", ")}\n\nTry: "Calculate standard deviation for fold_change" or "Show descriptive statistics"`,
              timestamp: new Date(),
            };
            setMessages([systemMessage]);
          }
        },
        error: (error: any) => {
          const errorMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: `Error parsing file: ${error.message}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        },
      });
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setFileLoading(false);
    }
  };

  /**
   * Process user query and perform calculations
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Check if data is required
    if (!data && requiresData(input)) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Please upload a CSV file first to perform analysis.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setInput("");
      return;
    }

    // Add user message
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
      // Parse query
      const parsed = parseQuery(input);

      let result: any = null;
      let responseText = "";

      // Execute computation based on intent
      if (parsed.intent === "stddev" && data && parsed.column) {
        const columnData = getNumericColumnData(parsed.column);
        if (columnData.length > 0) {
          result = computeSampleStdDev(columnData);
          responseText = `Standard deviation for "${parsed.column}": **${formatNumber(result, 4)}**\n\nThis is calculated using the sample standard deviation formula (n-1 denominator) with ${columnData.length} values.`;
        } else {
          responseText = `No numeric data found in column "${parsed.column}".`;
        }
      } else if (parsed.intent === "mean" && data && parsed.column) {
        const columnData = getNumericColumnData(parsed.column);
        if (columnData.length > 0) {
          result = computeMean(columnData);
          responseText = `Mean for "${parsed.column}": **${formatNumber(result, 4)}**\n\nCalculated from ${columnData.length} values.`;
        } else {
          responseText = `No numeric data found in column "${parsed.column}".`;
        }
      } else if (parsed.intent === "median" && data && parsed.column) {
        const columnData = getNumericColumnData(parsed.column);
        if (columnData.length > 0) {
          result = computeMedian(columnData);
          responseText = `Median for "${parsed.column}": **${formatNumber(result, 4)}**\n\nThis is the middle value when data is sorted.`;
        } else {
          responseText = `No numeric data found in column "${parsed.column}".`;
        }
      } else if (parsed.intent === "stats" && data && parsed.column) {
        const columnData = getNumericColumnData(parsed.column);
        if (columnData.length > 0) {
          result = computeDescriptiveStats(columnData);
          responseText = `**Descriptive Statistics for "${parsed.column}"**\n\n`;
          responseText += `• Count: ${result.n}\n`;
          responseText += `• Mean: ${formatNumber(result.mean, 4)}\n`;
          responseText += `• Median: ${formatNumber(result.median, 4)}\n`;
          responseText += `• Std Dev: ${formatNumber(result.stdDev, 4)}\n`;
          responseText += `• Min: ${formatNumber(result.min, 4)}\n`;
          responseText += `• Max: ${formatNumber(result.max, 4)}\n`;
          responseText += `• Range: ${formatNumber(result.range, 4)}\n`;
          if (result.q1 !== null) responseText += `• Q1: ${formatNumber(result.q1, 4)}\n`;
          if (result.q3 !== null) responseText += `• Q3: ${formatNumber(result.q3, 4)}\n`;
          if (result.iqr !== null) responseText += `• IQR: ${formatNumber(result.iqr, 4)}\n`;
          if (result.cv !== null) responseText += `• CV: ${formatNumber(result.cv, 2)}%\n`;
          if (result.ci95) {
            responseText += `• 95% CI: [${formatNumber(result.ci95.lower, 4)}, ${formatNumber(result.ci95.upper, 4)}]`;
          }
        } else {
          responseText = `No numeric data found in column "${parsed.column}".`;
        }
      } else if (parsed.intent === "fold_change" && data) {
        const foldChangeData = getNumericColumnData("fold_change");
        if (foldChangeData.length > 0) {
          result = computeFoldChangeStats(foldChangeData);
          responseText = `**Fold Change Analysis**\n\n`;
          responseText += `• Mean Fold Change: ${formatNumber(result.meanFoldChange, 4)}\n`;
          responseText += `• Std Dev: ${formatNumber(result.stdDevFoldChange, 4)}\n`;
          responseText += `• Median: ${formatNumber(result.medianFoldChange, 4)}\n`;
          responseText += `• Upregulated (>1.5x): ${result.upregulated}\n`;
          responseText += `• Downregulated (<0.67x): ${result.downregulated}\n`;
          responseText += `• Unchanged: ${result.unchanged}`;
        } else {
          responseText = `No fold_change column found in data.`;
        }
      } else if (parsed.intent === "unknown") {
        responseText =
          "I'm not sure what you're asking. Try:\n• 'Calculate standard deviation for fold_change'\n• 'Show descriptive statistics'\n• 'Compute mean for treated_value'\n• 'What is the median?'";
      } else {
        responseText = generateResponse(parsed, result);
      }

      // Add suggestions
      const suggestions = generateSuggestions(input, data?.columns || []);
      if (suggestions.length > 0) {
        responseText += "\n\n**Suggestions:**\n";
        suggestions.forEach((s) => {
          responseText += `• ${s}\n`;
        });
      }

      // Add assistant message
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        result,
        column: parsed.column || undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Add to analysis history
      addAnalysisResult({
        id: assistantMsg.id,
        query: input,
        intent: parsed.intent,
        result,
        timestamp: new Date(),
        column: parsed.column || undefined,
      });
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

  return (
    <div className="flex flex-col h-full gap-4">
      {/* File Upload */}
      {!data && (
        <Card className="p-4 border-dashed">
          <label className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition">
            <Upload className="w-5 h-5" />
            <span className="text-sm font-medium">
              {fileLoading ? "Uploading..." : "Click to upload CSV file"}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileUpload}
              disabled={fileLoading}
              className="hidden"
            />
          </label>
        </Card>
      )}

      {/* Data Info */}
      {data && (
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-sm font-medium text-blue-900">
            📊 {data.filename} ({data.rows.length} rows, {data.columns.length}{" "}
            columns)
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Data Quality: {data.dataQuality}%
          </p>
        </Card>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 border rounded-lg p-4">
        <div className="space-y-4" ref={scrollRef}>
          {messages.length === 0 && !data && (
            <div className="text-center text-gray-500 py-8">
              <p className="text-sm">
                Upload a CSV file to get started with biostatistics analysis
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-md px-4 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
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
          placeholder="Ask: 'Calculate standard deviation for fold_change'..."
          disabled={loading || !data}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={loading || !data || !input.trim()}
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
