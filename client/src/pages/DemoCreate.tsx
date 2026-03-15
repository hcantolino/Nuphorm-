import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  ChevronDown,
  Wand2,
  Sigma,
  TrendingUp,
  HeartPulse,
  ShieldCheck,
  Pill,
  Scale,
  FlaskConical,
  Calculator,
  Paperclip,
  Mic,
  Send,
  ArrowRight,
  Lock,
} from "lucide-react";
import { PANEL_MAP, PANEL_TITLES } from "./demo/DemoCharts";

/* ════════════════════════════════════════════════════════════════════
   ANALYSIS TYPE CONFIG
   ════════════════════════════════════════════════════════════════════ */
const ANALYSIS_TYPES = [
  { id: "clean", label: "Clean", icon: Wand2 },
  { id: "descriptive", label: "Descriptive", icon: Sigma },
  { id: "efficacy", label: "Efficacy", icon: TrendingUp },
  { id: "survival", label: "Survival", icon: HeartPulse },
  { id: "safety", label: "Safety", icon: ShieldCheck },
  { id: "pkpd", label: "PK/PD", icon: Pill },
  { id: "bioequiv", label: "Bioequiv.", icon: Scale },
  { id: "inferential", label: "Inferential", icon: FlaskConical },
  { id: "samplesize", label: "Sample Size", icon: Calculator },
] as const;

const ENABLED_TYPES = new Set(Object.keys(PANEL_MAP));

/** CSS to prevent text selection */
const NO_SELECT_STYLE: React.CSSProperties = {
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
  userSelect: "none",
};

/* ════════════════════════════════════════════════════════════════════
   FINGERPRINT: Set a tracking cookie on first visit (non-HttpOnly,
   readable by JS so we can send it; server stores the UUID).
   ════════════════════════════════════════════════════════════════════ */
function ensureFingerprint(): string {
  const name = "nuphorm_demo_fp";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (match) return match[1];
  const uuid = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  document.cookie = `${name}=${uuid}; path=/; max-age=${365 * 86400}; samesite=strict`;
  return uuid;
}

/* ════════════════════════════════════════════════════════════════════
   QUERY → ANALYSIS TYPE MATCHING
   ════════════════════════════════════════════════════════════════════ */
function matchQuery(text: string): string | null {
  const lower = text.toLowerCase();
  const rules: [string[], string][] = [
    [["descri", "summary", "statistic", "mean", "average"], "descriptive"],
    [["surviv", "kaplan", "time to event", "km curve"], "survival"],
    [["efficacy", "compare", "treatment effect", "response rate"], "efficacy"],
    [["safety", "adverse", "side effect", "toxicity", "ae "], "safety"],
    [["sample size", "power", "how many patient"], "samplesize"],
    [["pk", "pharmacokinetic", "concentration", "auc", "cmax"], "pkpd"],
  ];
  for (const [keywords, type] of rules) {
    if (keywords.some((k) => lower.includes(k))) return type;
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function DemoCreate() {
  const [demoUsed, setDemoUsed] = useState<boolean | null>(null); // null = loading
  const [activeType, setActiveType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [noMatchMsg, setNoMatchMsg] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check usage on mount (reads HttpOnly cookie via server)
  useEffect(() => {
    ensureFingerprint();
    fetch("/api/demo/check-usage", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setDemoUsed(data.used === true))
      .catch(() => setDemoUsed(false)); // if API down, allow demo
  }, []);

  const runAnalysis = async (type: string) => {
    if (demoUsed || loading) return;
    if (!ENABLED_TYPES.has(type)) return;

    setNoMatchMsg(null);
    setApiError(null);
    setLoading(true);
    setActiveType(null);

    try {
      const res = await fetch("/api/demo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Analysis failed" }));
        setApiError(err.error || "Analysis failed");
        setLoading(false);
        if (res.status === 403 || res.status === 429) {
          setDemoUsed(true);
        }
        return;
      }

      // Simulate brief processing time so it feels real
      await new Promise((r) => setTimeout(r, 1500));
      setActiveType(type);
      setDemoUsed(true); // Lock after use
    } catch {
      setApiError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!query.trim() || demoUsed || loading) return;
    const matched = matchQuery(query);
    setQuery("");

    if (matched) {
      runAnalysis(matched);
    } else {
      setNoMatchMsg(
        "In the full version, NuPhorm AI can analyze any query. Try one of: describe, survival, efficacy, safety, sample size, pk",
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Still loading usage check
  if (demoUsed === null) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-[#2b7de9] rounded-full animate-spin" />
      </div>
    );
  }

  const isLocked = demoUsed && !activeType; // Used but no result to show
  const hasResult = activeType !== null;
  const ActivePanel = activeType ? PANEL_MAP[activeType] : null;

  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-gray-50"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* ── Demo Banner ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 text-white text-[13px]"
        style={{ background: "linear-gradient(90deg, #2b7de9, #1a5fb4)" }}
      >
        <span>You're using the NuPhorm Demo — 1 free analysis</span>
        <Link
          href="/signup"
          className="flex items-center gap-1 text-white/90 hover:text-white font-medium transition-colors"
        >
          Sign up for full access <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Header bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-semibold text-[#0f172a]">Sample Biostatistics Project</h1>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
        <div
          className="text-xs font-medium px-3.5 py-1.5 rounded-full"
          style={
            demoUsed
              ? { background: "rgba(229, 62, 62, 0.1)", color: "#e53e3e" }
              : { background: "rgba(43, 125, 233, 0.1)", color: "#2b7de9" }
          }
        >
          {demoUsed ? (hasResult ? "Demo analysis complete" : "Demo used") : "1 free analysis"}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 py-1.5 bg-[#f1f5f9] border-b border-gray-200">
        <div className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-t-lg border border-b-0 border-gray-200 text-xs font-medium text-[#0f172a]">
          Demo Analysis
        </div>
      </div>

      {/* ── Main workspace ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ── LEFT PANEL ── */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200">
          {/* Analysis type chips */}
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 overflow-x-auto border-b border-gray-100">
            {ANALYSIS_TYPES.map((t) => {
              const Icon = t.icon;
              const isActive = activeType === t.id;
              const enabled = ENABLED_TYPES.has(t.id);
              const disabled = demoUsed || loading || !enabled;
              return (
                <button
                  key={t.id}
                  onClick={() => enabled && runAnalysis(t.id)}
                  disabled={disabled}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                    ${
                      isActive
                        ? "bg-[#0f172a] text-white scale-[1.03]"
                        : enabled && !demoUsed
                          ? "bg-white border border-gray-200 text-[#64748b] hover:text-[#0f172a] hover:border-gray-300"
                          : "bg-white border border-gray-200 text-gray-300 cursor-not-allowed"
                    }
                    disabled:opacity-50`}
                  title={!enabled ? "Not available in demo" : demoUsed ? "Demo already used" : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-[#2b7de9]">
              <strong>Pre-loaded dataset:</strong> Phase III Clinical Trial — 150 patients, 12 variables.
              {demoUsed && !hasResult
                ? " Your demo analysis has been used."
                : " Click an analysis type above or type a query below."}
            </div>

            {apiError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {apiError}
              </div>
            )}

            {noMatchMsg && (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                {noMatchMsg}
              </div>
            )}

            {!demoUsed && !activeType && !loading && (
              <div className="text-sm text-[#94a3b8] space-y-2 mt-2">
                <p>Try clicking one of the analysis types above:</p>
                <ul className="list-disc list-inside space-y-1 text-[#64748b]">
                  <li><strong>Descriptive</strong> — Interactive histograms, box plots &amp; sortable tables</li>
                  <li><strong>Survival</strong> — Kaplan-Meier curves with CI bands &amp; at-risk table</li>
                  <li><strong>Efficacy</strong> — Grouped bar chart &amp; forest plot</li>
                  <li><strong>Safety</strong> — Stacked AE bar chart with severity filters</li>
                  <li><strong>PK/PD</strong> — Concentration-time profiles with spaghetti plots</li>
                  <li><strong>Sample Size</strong> — Live power calculator with interactive curve</li>
                </ul>
                <p className="text-[#94a3b8]">Or type a natural-language query in the input below.</p>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
            <div
              className={`flex items-end gap-2 rounded-xl border border-gray-200 px-4 py-2 ${demoUsed ? "opacity-50" : ""}`}
            >
              <button className="text-gray-400 hover:text-gray-600 transition-colors p-1" disabled={demoUsed}>
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  demoUsed
                    ? "Demo analysis used — sign up for full access"
                    : "Paste your data or ask a question — no code needed"
                }
                disabled={demoUsed || loading}
                rows={1}
                className="flex-1 resize-none bg-transparent text-[15px] text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none disabled:cursor-not-allowed"
                style={{ minHeight: 36, maxHeight: 120 }}
              />
              <button className="text-gray-400 hover:text-gray-600 transition-colors p-1" disabled={demoUsed}>
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={handleSend}
                disabled={!query.trim() || demoUsed || loading}
                className="p-1.5 rounded-lg bg-[#0f172a] text-white disabled:opacity-30 hover:bg-[#1e293b] transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — Results ── */}
        <div
          className="w-[48%] flex flex-col min-h-0 bg-[#f8fafc] relative"
          style={NO_SELECT_STYLE}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Locked overlay — demo used with no results showing */}
          {isLocked && (
            <div className="absolute inset-0 z-10 bg-white/95 flex items-center justify-center backdrop-blur-sm">
              <div className="text-center px-8 max-w-sm">
                <Lock className="w-14 h-14 text-gray-300 mx-auto mb-5" />
                <h3 className="text-xl font-bold text-[#0f172a] mb-2">Demo Complete</h3>
                <p className="text-sm text-[#64748b] mb-6">
                  You've used your free analysis. Your results are no longer available.
                </p>
                <p className="text-base font-medium text-[#0f172a] mb-4">Ready for unlimited analyses?</p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#2b7de9] text-white text-sm font-medium hover:bg-[#1a5fb4] transition-colors"
                >
                  Create a free account
                </Link>
                <p className="mt-3 text-xs text-[#94a3b8]">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#2b7de9] hover:underline">
                    Sign in
                  </Link>
                </p>
                <p className="mt-4 text-[11px] text-[#94a3b8]">
                  Free accounts include 10 analyses per month. Upgrade anytime for unlimited access.
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-[#2b7de9] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-[#64748b]">Analyzing data...</p>
              </div>
            </div>
          )}

          {/* Active result panel */}
          {!loading && ActivePanel && (
            <div className="flex-1 overflow-y-auto p-5">
              <h2 className="text-base font-semibold text-[#0f172a] mb-4">
                {PANEL_TITLES[activeType!] || "Results"}
              </h2>
              <ActivePanel />
            </div>
          )}

          {/* Empty state — not yet used */}
          {!loading && !ActivePanel && !isLocked && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-xs">
                <Calculator className="w-[52px] h-[52px] text-[#94a3b8] mx-auto mb-4" />
                <h3 className="text-[15px] font-semibold text-[#334155] mb-1.5">
                  No results generated yet
                </h3>
                <p className="text-sm text-[#64748b] mb-4">
                  Ask Nuphorm to calculate — and see your results appear here.
                </p>
                <p className="text-xs text-[#94a3b8]">
                  Enter a biostatistics query in the chat input below to produce:
                </p>
                <ul className="text-xs text-[#94a3b8] mt-2 space-y-1 text-left mx-auto max-w-[240px]">
                  <li>• Summary statistics and editable tables</li>
                  <li>• Inferential analyses (t-tests, ANOVA, etc.)</li>
                  <li>• Survival estimates (Kaplan-Meier curves)</li>
                  <li>• Pharmacokinetic parameters</li>
                  <li>• Custom plots (scatter, box, forest, etc.)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
