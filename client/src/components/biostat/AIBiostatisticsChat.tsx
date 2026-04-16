import { useState, useEffect, useRef, useMemo } from "react";
import { Send, Upload, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
// AnalysisResultsDisplay removed - charts/tables now display in right panels via store
import { useChartStore } from "@/stores/chartStore";
import { useMeasurementTriggerStore } from "@/stores/measurementTriggerStore";
import { PromptSuggestions } from "./PromptSuggestions";
import { type BiostatPrompt } from "./biostatPrompts";
import { useDatasetStore } from "@/stores/datasetStore";

// ── Follow-up chip mapping ──────────────────────────────────────────────────────
// Keys are lowercase keywords that appear in the AI's response text.
// Values are short follow-up labels that get inserted into the input.

const FOLLOW_UP_MAP: Record<string, string[]> = {
  'kaplan-meier':   ['Add log-rank test', 'Stratify by sex', 'Show median survival'],
  'survival':       ['Add log-rank test', 'Fit Cox PH model', 'Show median survival'],
  'cox':            ['Check PH assumption', 'Add forest plot', 'Report hazard ratios'],
  'forest plot':    ['Stratify by age group', 'Add overall estimate', 'Export as SVG'],
  'adverse event':  ['Show Grade ≥3 AEs', 'Compare by arm', 'Generate AE table (TLF)'],
  'anova':          ['Tukey post-hoc test', 'Check homogeneity of variance', 'Show box plots'],
  't-test':         ['Check normality first', 'Report effect size (Cohen\'s d)', 'Show box plot'],
  'normality':      ['Run Shapiro-Wilk', 'Show Q-Q plot', 'Suggest transformation'],
  'missing':        ['Impute with median', 'Drop rows > 30% missing', 'Visualise missingness'],
  'outlier':        ['Winsorise outliers', 'Remove and rerun', 'Flag for review'],
  'correlation':    ['Show scatter plot', 'Test significance', 'Run regression'],
  'regression':     ['Check residuals', 'Report R²', 'Add confidence band'],
  'waterfall':      ['Colour by response', 'Add PR/PD thresholds', 'Export as PDF'],
  'volcano':        ['Label top 10 genes', 'Adjust for FDR', 'Filter by fold-change'],
  'descriptive':    ['Add by-arm breakdown', 'Export as TLF table', 'Test normality'],
  'mmrm':           ['Report LSMeans', 'Add visit × treatment plot', 'Check residuals'],
  'power':          ['Plot power curve', 'Vary effect size', 'Calculate for 90% power'],
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  analysisResult?: any;
  followUps?: string[];
}

interface AIBiostatisticsChatProps {
  onDataLoaded?: (data: any) => void;
  // Legacy props kept for backward compatibility but unused
  onMeasurementSelect?: (measurement: string) => void;
  selectedFiles?: string[];
  onInsertMessage?: (message: string) => void;
}

/** Derive follow-up chip labels from AI response text */
function getFollowUps(responseText: string): string[] {
  const lower = responseText.toLowerCase();
  const chips: string[] = [];
  for (const [keyword, labels] of Object.entries(FOLLOW_UP_MAP)) {
    if (lower.includes(keyword)) {
      chips.push(...labels);
      if (chips.length >= 4) break;
    }
  }
  // Deduplicate while preserving order
  return Array.from(new Set(chips)).slice(0, 4);
}

/**
 * Parse CSV data into array of objects
 */
function parseCSVData(csvContent: string): Array<Record<string, any>> {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const data: Array<Record<string, any>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, any> = {};

    headers.forEach((header, idx) => {
      const value = values[idx];
      row[header] = isNaN(Number(value)) ? value : Number(value);
    });

    data.push(row);
  }

  return data;
}

export const AIBiostatisticsChat: React.FC<AIBiostatisticsChatProps> = ({
  onDataLoaded,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fullData, setFullData] = useState<Array<Record<string, any>>>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = trpc.biostatistics.analyzeBiostatisticsData.useMutation();
  const getDataContext = useDatasetStore((s) => s.getDataContext);
  const storeDataset = useDatasetStore((s) => s.dataset);

  /**
   * MAX_FULL_DATA_ROWS — hard cap on the row slice sent to the tRPC mutation.
   * Prevents 413 Payload Too Large on large CSVs.
   * The LLM receives DataContext (schema + head15 + tail5 + stats), NOT this slice.
   * The slice is only used by the server-side analysis engine for computation.
   */
  const MAX_FULL_DATA_ROWS = 500;

  // Columns from loaded data, passed to PromptSuggestions for context-aware ranking.
  // Prefers local fullData; falls back to the shared datasetStore (populated by DataUploadAI).
  const dataColumns = useMemo(() => {
    if (fullData.length > 0) return Object.keys(fullData[0]);
    if (storeDataset) return storeDataset.columns;
    return [];
  }, [fullData, storeDataset]);

  // Insert a message from measurement quick-trigger


  // Listen for measurement quick-trigger messages
  const { pendingMessage, setPendingMessage } = useMeasurementTriggerStore();
  
  useEffect(() => {
    if (pendingMessage) {
      setInputValue(pendingMessage);
      setPendingMessage(null); // Clear after using
    }
  }, [pendingMessage, setPendingMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /**
   * Keywords that indicate the user wants to work with the loaded dataset.
   * When present we inject the datasetStore JSON summary into the LLM context.
   */
  const DATA_KEYWORDS = /analyz|clean|data|dataset|column|missing|outlier|statistic|import|upload|variable|csv|xlsx/i;

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Use local fullData first; fall back to the shared datasetStore
    const effectiveData = fullData.length > 0 ? fullData : (storeDataset?.rows ?? []);

    if (effectiveData.length === 0) {
      toast.error("Please upload data first (use the Upload button or the Data tab)");
      return;
    }

    try {
      setIsLoading(true);
      const userInputValue = inputValue;
      setInputValue("");

      const userMessage: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: userInputValue,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      const newHistory = [
        ...conversationHistory,
        { role: "user", content: userInputValue },
      ];

      // Cap rows at MAX_FULL_DATA_ROWS to prevent 413 / memory spikes.
      // The LLM prompt always uses DataContext (schema + previews + stats), NOT raw rows.
      const cappedData = effectiveData.slice(0, MAX_FULL_DATA_ROWS);
      const isTruncated = effectiveData.length > MAX_FULL_DATA_ROWS;

      console.log(
        "[AIBiostatisticsChat] Sending request | rows:", effectiveData.length,
        isTruncated ? `(capped to ${MAX_FULL_DATA_ROWS})` : ''
      );

      if (isTruncated) {
        toast.info(
          `Large dataset: analysis uses first ${MAX_FULL_DATA_ROWS} of ${effectiveData.length} rows. ` +
          'For full coverage use the Python API.',
          { duration: 5000 }
        );
      }

      // Build enriched prompt: inject DataContext when query is data-related.
      // DataContext is always safe to stringify — computeDataContext() sanitises NaN/Infinity.
      let enrichedQuery = userInputValue;
      if (DATA_KEYWORDS.test(userInputValue)) {
        try {
          const ctx = getDataContext();
          if (ctx) {
            const ctxJson = JSON.stringify(ctx, null, 2);
            enrichedQuery =
              `${userInputValue}\n\n<dataset_context>\n${ctxJson}\n</dataset_context>`;
          }
        } catch (err) {
          // Non-fatal — proceed without context injection
          console.warn('[AIBiostatisticsChat] DataContext stringify failed:', err);
        }
      }

      // Safe stringify for the dataPreview field
      let dataPreviewJson = '[]';
      try {
        dataPreviewJson = JSON.stringify(cappedData.slice(0, 5));
      } catch {
        dataPreviewJson = '[]';
      }

      // ── Payload size guard ───────────────────────────────────────────────
      // Build the payload, measure its serialised size, and strip fullData
      // if > 500 KB to avoid 413 / server OOM on large datasets.
      const MAX_PAYLOAD_BYTES = 500_000; // 500 KB
      let payloadFullData = cappedData;

      try {
        const probe = {
          userQuery: enrichedQuery,
          dataPreview: dataPreviewJson,
          dataColumns: cappedData.length > 0 ? Object.keys(cappedData[0]) : [],
          conversationHistory: newHistory,
          fullData: cappedData,
        };
        const payloadSizeKb = new Blob([JSON.stringify(probe)]).size / 1024;
        console.log(`[AIBiostatisticsChat] Payload size: ${payloadSizeKb.toFixed(1)} KB`);

        if (payloadSizeKb * 1024 > MAX_PAYLOAD_BYTES) {
          toast.error(
            `Payload too large (${payloadSizeKb.toFixed(0)} KB). ` +
            'Using minimal context — dataset summary still injected in prompt.',
            { duration: 6000 }
          );
          payloadFullData = []; // drop raw rows; DataContext in enrichedQuery is enough
        }
      } catch {
        // Size check is non-fatal — proceed with original data
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Analysis request timed out after 120 seconds. Please try again.")), 120000)
      );

      const analysisPromise = analyzeMutation.mutateAsync({
        userQuery: enrichedQuery,
        dataPreview: dataPreviewJson,
        dataColumns: cappedData.length > 0 ? Object.keys(cappedData[0]) : [],
        classifications: {},
        conversationHistory: newHistory,
        // Send capped slice only — never the full potentially-huge array
        fullData: payloadFullData,
      });

      let result;
      try {
        result = await Promise.race([analysisPromise, timeoutPromise]) as any;
      } catch (raceError) {
        // If Promise.race times out, try to get the mutation result anyway
        // The mutation has completed but Promise.race timed out
        // In this case, the result should be available from the mutation
        if (!analyzeMutation.isPending && analyzeMutation.data) {
          result = analyzeMutation.data as any;
        } else {
          throw raceError;
        }
      }

      // Extract chart and table data from result
      const chartConfig = result.chartConfig || null;
      const tableData = result.tableData || null;

      // Update global chart store instead of displaying inline
      if (chartConfig || tableData) {
        useChartStore.getState().setChartData(chartConfig, tableData);
        console.log('[AIBiostatisticsChat] Updated chart store with:', { chartConfig, tableData });
      }

      // Show only text explanation in chat
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: result.analysis || "Analysis completed",
        timestamp: new Date(),
        analysisResult: result.analysisResults,
        followUps: getFollowUps(result.analysis || ""),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationHistory(newHistory.concat([{ role: "assistant", content: result.analysis }]));

      if (result.analysisResults) {
        onDataLoaded?.(result.analysisResults);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Analysis failed";
      console.error("[AIBiostatisticsChat] Error:", errorMsg);

      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (['xlsx', 'xls'].includes(ext)) {
        toast.error('Excel files should be uploaded via the main Biostatistics AI tab for proper server-side parsing.');
        return;
      }

      const content = await file.text();
      const parsedData = parseCSVData(content);

      setFullData(parsedData);

      const fileLoadedMessage: Message = {
        id: `file-loaded-${Date.now()}`,
        role: "assistant",
        content: `✅ Uploaded file: ${file.name} (${parsedData.length} rows, ${parsedData.length > 0 ? Object.keys(parsedData[0]).length : 0} columns)`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, fileLoadedMessage]);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /** Handle prompt chip selection — insert text, optionally auto-submit */
  const handlePromptSelect = (prompt: BiostatPrompt) => {
    setInputValue(prompt.fullPrompt);
    setSuggestionsVisible(false);
    if (autoSubmit && fullData.length > 0) {
      // Defer one tick so state settles, then send
      setTimeout(() => {
        handleSendMessage();
      }, 50);
    }
  };

  /** Insert a follow-up chip label as the next message */
  const handleFollowUp = (label: string) => {
    setInputValue(label);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Auto-submit toggle in a narrow header strip ──────────────── */}
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/20">
        <span className="text-[10px] text-muted-foreground">Auto-run suggestions</span>
        <button
          onClick={() => setAutoSubmit((v) => !v)}
          aria-label={autoSubmit ? 'Disable auto-run' : 'Enable auto-run'}
          aria-pressed={autoSubmit}
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {autoSubmit
            ? <ToggleRight className="w-5 h-5 text-blue-500" />
            : <ToggleLeft className="w-5 h-5" />}
        </button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <Card className="p-4 text-center text-muted-foreground">
              <p>Upload data and ask questions about your biostatistics analysis.</p>
            </Card>
          )}

          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div key={message.id} className="space-y-2">
                <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <Streamdown>{message.content}</Streamdown>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                </div>
                {/* Follow-up chips after assistant messages */}
                {message.role === "assistant" && message.followUps && message.followUps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {message.followUps.map((label) => (
                      <button
                        key={label}
                        onClick={() => handleFollowUp(label)}
                        aria-label={`Follow-up: ${label}`}
                        className="text-[10px] px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-muted-foreground px-4 py-2 rounded-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analyzing...</span>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        {/* ── Prompt suggestions (replaces old inline chip bar) ─────── */}
        <PromptSuggestions
          onSelect={handlePromptSelect}
          dataColumns={dataColumns}
          visible={suggestionsVisible}
          onToggleVisible={() => setSuggestionsVisible((v) => !v)}
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="gap-2 flex-shrink-0"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Ask about your data analysis..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (e.target.value) setSuggestionsVisible(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            disabled={isLoading}
            className="text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
