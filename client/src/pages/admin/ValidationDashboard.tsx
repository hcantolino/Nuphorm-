import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  BarChart2,
  Shield,
} from "lucide-react";

function fmtTime(ts: string | null): string {
  if (!ts) return "Never";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ScenarioData {
  name: string;
  description: string;
  n_replications: number;
  n_successful: number;
  type_I_error: number | null;
  type_I_pass: boolean | null;
  coverage: number | null;
  coverage_pass: boolean | null;
  bias: number | null;
  mse: number | null;
  power: number | null;
  runtime_seconds: number;
}

interface MethodData {
  method_name: string;
  compute_file_hash: string;
  git_sha: string | null;
  timestamp: string;
  scenarios: ScenarioData[];
  overall_pass: boolean;
  total_runtime_seconds: number;
}

function StatusIcon({ pass }: { pass: boolean | null }) {
  if (pass === true) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (pass === false) return <XCircle className="w-4 h-4 text-red-500" />;
  return <AlertTriangle className="w-4 h-4 text-amber-500" />;
}

function MethodCard({ method }: { method: MethodData }) {
  const [expanded, setExpanded] = useState(false);
  const passCount = method.scenarios.filter(
    (s) => s.type_I_pass !== false && s.coverage_pass !== false
  ).length;
  const total = method.scenarios.length;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${method.overall_pass ? "#bbf7d0" : "#fecaca"}`,
        background: method.overall_pass ? "#f0fdf4" : "#fef2f2",
      }}
    >
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon pass={method.overall_pass} />
          <div>
            <span className="font-semibold text-[#0f172a]">{method.method_name}</span>
            <span className="ml-2 text-xs text-[#64748b]">
              {method.overall_pass ? "PASSED" : "FAILED"} ({passCount}/{total} scenarios)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#64748b]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {method.total_runtime_seconds.toFixed(1)}s
          </span>
          <span>{fmtTime(method.timestamp)}</span>
          <span className="font-mono text-[10px]">{method.git_sha}</span>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-[#e2e8f0]">
          <table className="w-full text-sm mt-3" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b-2 border-[#d1d5db]">
                <th className="text-left py-2 text-xs font-semibold text-[#64748b] uppercase">Scenario</th>
                <th className="text-center py-2 text-xs font-semibold text-[#64748b] uppercase w-16">N</th>
                <th className="text-center py-2 text-xs font-semibold text-[#64748b] uppercase w-20">Type I</th>
                <th className="text-center py-2 text-xs font-semibold text-[#64748b] uppercase w-20">Coverage</th>
                <th className="text-center py-2 text-xs font-semibold text-[#64748b] uppercase w-20">Bias</th>
                <th className="text-center py-2 text-xs font-semibold text-[#64748b] uppercase w-20">MSE</th>
                <th className="text-center py-2 text-xs font-semibold text-[#64748b] uppercase w-20">Power</th>
                <th className="text-center py-2 text-xs font-semibold text-[#64748b] uppercase w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {method.scenarios.map((s, i) => (
                <tr key={i} className="border-b border-[#e5e7eb] hover:bg-white/50">
                  <td className="py-2 pr-2">
                    <span className="font-medium text-[#0f172a]">{s.name}</span>
                    <br />
                    <span className="text-[10px] text-[#94a3b8]">{s.description}</span>
                  </td>
                  <td className="text-center font-mono text-xs">{s.n_replications.toLocaleString()}</td>
                  <td className="text-center font-mono text-xs">
                    {s.type_I_error !== null ? (
                      <span style={{ color: s.type_I_pass ? "#16a34a" : "#dc2626" }}>
                        {s.type_I_error.toFixed(4)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="text-center font-mono text-xs">
                    {s.coverage !== null ? (
                      <span style={{ color: s.coverage_pass ? "#16a34a" : "#dc2626" }}>
                        {s.coverage.toFixed(4)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="text-center font-mono text-xs">
                    {s.bias !== null ? s.bias.toFixed(4) : "—"}
                  </td>
                  <td className="text-center font-mono text-xs">
                    {s.mse !== null ? s.mse.toFixed(4) : "—"}
                  </td>
                  <td className="text-center font-mono text-xs">
                    {s.power !== null ? (
                      <span className="font-semibold">{(s.power * 100).toFixed(1)}%</span>
                    ) : "—"}
                  </td>
                  <td className="text-center">
                    <StatusIcon pass={s.type_I_pass !== false && s.coverage_pass !== false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ValidationDashboard() {
  const { data, isLoading, refetch } = trpc.admin.validationResults.useQuery();

  const methods: MethodData[] = data?.methods
    ? Object.values(data.methods as Record<string, MethodData>)
    : [];
  const passCount = methods.filter((m) => m.overall_pass).length;
  const failCount = methods.filter((m) => !m.overall_pass).length;

  return (
    <div className="min-h-screen bg-[#f8fafc]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0] px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-[#2563eb]" />
            <div>
              <h1 className="text-xl font-bold text-[#0f172a]">Statistical Validation</h1>
              <p className="text-xs text-[#64748b]">
                Simulation-based verification of all compute methods
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#64748b]">
              Last run: {fmtTime(data?.last_run ?? null)}
            </span>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-[#94a3b8]">Loading validation results...</div>
        ) : methods.length === 0 ? (
          <div className="text-center py-20">
            <BarChart2 className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
            <p className="text-[#64748b] text-sm">No validation results yet.</p>
            <p className="text-[#94a3b8] text-xs mt-1">
              Run <code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded font-mono text-[11px]">python3 server/validation/run_all.py</code> or push to GitHub to trigger validation.
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">{passCount} passed</span>
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">{failCount} failed</span>
                </div>
              )}
              <span className="text-xs text-[#94a3b8] ml-auto">
                {methods.reduce((s, m) => s + m.scenarios.length, 0)} total scenarios across {methods.length} methods
              </span>
            </div>

            {/* Method cards */}
            <div className="space-y-3">
              {methods
                .sort((a, b) => (a.overall_pass === b.overall_pass ? 0 : a.overall_pass ? 1 : -1))
                .map((m) => (
                  <MethodCard key={m.method_name} method={m} />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
