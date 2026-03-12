/**
 * Async Analysis UI Component
 * Handles job submission, polling, and status display
 */

import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, CheckCircle, Clock, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AsyncAnalysisUIProps {
  onResultReceived?: (result: Record<string, unknown>) => void;
  csvData?: Array<Record<string, unknown>>;
}

type AnalysisStatus = "idle" | "submitted" | "polling" | "completed" | "failed" | "cancelled";

export function AsyncAnalysisUI({ onResultReceived, csvData }: AsyncAnalysisUIProps) {
  const [query, setQuery] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  // tRPC mutations and queries
  const startAnalysisMutation = trpc.job.startBiostatisticsAnalysis.useMutation();
  const getStatusQuery = trpc.job.getAnalysisStatus.useQuery(
    { jobId: jobId || "" },
    {
      enabled: status === "polling" && !!jobId,
      refetchInterval: 5000, // Poll every 5 seconds
    }
  );
  const getResultQuery = trpc.job.getAnalysisResult.useQuery(
    { jobId: jobId || "" },
    {
      enabled: status === "completed" && !!jobId,
    }
  );
  const cancelMutation = trpc.job.cancelAnalysis.useMutation();

  // Handle status polling
  useEffect(() => {
    if (!getStatusQuery.data || status !== "polling") return;

    const statusData = getStatusQuery.data;

    setProgress(statusData.progress || 0);
    setMessage(statusData.message || "Processing...");
    setElapsedSeconds(statusData.elapsedSeconds || 0);

    if (statusData.status === "completed") {
      setStatus("completed");
      fetchResult();
    } else if (statusData.status === "failed") {
      setStatus("failed");
      setError(statusData.error?.message || "Analysis failed");
    }
  }, [getStatusQuery.data, status]);

  // Fetch result when completed
  const fetchResult = useCallback(async () => {
    if (!jobId) return;

    try {
      const resultData = await getResultQuery.refetch();
      if (resultData.data?.result) {
        setResult(resultData.data.result);
        onResultReceived?.(resultData.data.result);
      }
    } catch (err) {
      setError("Failed to fetch result");
    }
  }, [jobId, getResultQuery, onResultReceived]);

  // Handle job submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setError("Please enter a query");
      return;
    }

    setError(null);
    setResult(null);
    setProgress(0);
    setElapsedSeconds(0);
    setStatus("submitted");

    try {
      const response = await startAnalysisMutation.mutateAsync({
        query: query.trim(),
        csvData: csvData,
        selectedFiles: [],
      });

      setJobId(response.jobId);
      setMessage(response.message);
      setStatus("polling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
      setStatus("failed");
    }
  };

  // Handle job cancellation
  const handleCancel = async () => {
    if (!jobId) return;

    try {
      await cancelMutation.mutateAsync({ jobId });
      setStatus("cancelled");
      setMessage("Analysis cancelled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job");
    }
  };

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  // Render status icon
  const renderStatusIcon = () => {
    switch (status) {
      case "polling":
      case "submitted":
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case "failed":
      case "cancelled":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Zap className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Query Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Biostatistics Analysis</CardTitle>
          <CardDescription>
            Enter a natural language query (e.g., "compute standard deviation for fold_change")
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter your analysis query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={status === "polling" || status === "submitted"}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={status === "polling" || status === "submitted" || !query.trim()}
              >
                {status === "polling" || status === "submitted" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze"
                )}
              </Button>
              {(status === "polling" || status === "submitted") && (
                <Button variant="outline" onClick={handleCancel} type="button">
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Status Display */}
      {status !== "idle" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {renderStatusIcon()}
              <div>
                <CardTitle className="text-base">
                  {status === "polling" && "Analyzing..."}
                  {status === "submitted" && "Queued for analysis..."}
                  {status === "completed" && "Analysis Complete"}
                  {status === "failed" && "Analysis Failed"}
                  {status === "cancelled" && "Analysis Cancelled"}
                </CardTitle>
                <CardDescription>{message}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            {(status === "polling" || status === "submitted") && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="text-gray-500">
                    {progress}% • Elapsed: {formatTime(elapsedSeconds)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Result Display */}
            {status === "completed" && result && (
              <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900">Results</h4>
                <div className="space-y-2 text-sm">
                  {result.statistic ? (
                    <div>
                      <span className="font-medium">Statistic:</span>{" "}
                      <span>{String(result.statistic as string)}</span>
                    </div>
                  ) : null}
                  {result.value ? (
                    <div>
                      <span className="font-medium">Value:</span>{" "}
                      <span>{Number(result.value as number).toFixed(4)}</span>
                    </div>
                  ) : null}
                  {result.column ? (
                    <div>
                      <span className="font-medium">Column:</span>{" "}
                      <span>{String(result.column as string)}</span>
                    </div>
                  ) : null}
                  {result.explanation ? (
                    <div>
                      <span className="font-medium">Explanation:</span>{" "}
                      <span>{String(result.explanation as string)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Job ID Display */}
            {jobId && (
              <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                Job ID: <code className="font-mono">{jobId}</code>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Retry Button */}
      {(status === "failed" || status === "cancelled") && (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setStatus("idle");
              setJobId(null);
              setError(null);
              setResult(null);
              setQuery("");
            }}
            className="flex-1"
          >
            Start New Analysis
          </Button>
        </div>
      )}
    </div>
  );
}
