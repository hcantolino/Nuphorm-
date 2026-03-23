/**
 * AssumptionsPanel — Expandable panel showing normality/variance assumption checks.
 * Displayed above the Statistics Summary table when a statistical test has been run.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NormalityResult {
  W: number | null;
  p: number | null;
  isNormal: boolean;
}

interface VarianceResult {
  statistic: number;
  p: number;
  equalVariance: boolean;
}

interface AssumptionsData {
  normality?: Record<string, NormalityResult>;
  equalVariance?: VarianceResult | null;
  warning?: string | null;
  suggestedAlternative?: string | null;
  sample_sizes?: { per_group: number[]; total: number };
}

interface AssumptionsPanelProps {
  assumptions: AssumptionsData;
  onRunAlternative?: (test: string) => void;
}

export function AssumptionsPanel({ assumptions, onRunAlternative }: AssumptionsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const normality = assumptions.normality ?? {};
  const equalVar = assumptions.equalVariance;
  const warning = assumptions.warning;
  const suggested = assumptions.suggestedAlternative;

  const allNormal = Object.values(normality).every(r => r.isNormal);
  const hasNormality = Object.keys(normality).length > 0;
  const hasVarCheck = equalVar != null;

  // Determine overall status
  const hasWarning = !allNormal || (equalVar && !equalVar.equalVariance);

  return (
    <div className={`rounded-lg border text-xs ${
      hasWarning
        ? 'border-amber-200 bg-amber-50/50'
        : 'border-emerald-200 bg-emerald-50/50'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-[#64748b] flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-[#64748b] flex-shrink-0" />
        }
        <span className="font-medium text-[#0f172a]">Assumptions</span>

        {/* Inline status badges */}
        {hasNormality && (
          <span className={`inline-flex items-center gap-1 ${allNormal ? 'text-emerald-700' : 'text-amber-700'}`}>
            {allNormal
              ? <><CheckCircle2 className="w-3 h-3" /> Normality</>
              : <><AlertTriangle className="w-3 h-3" /> Normality</>
            }
          </span>
        )}
        {hasVarCheck && (
          <span className={`inline-flex items-center gap-1 ${equalVar.equalVariance ? 'text-emerald-700' : 'text-amber-700'}`}>
            {equalVar.equalVariance
              ? <><CheckCircle2 className="w-3 h-3" /> Equal variance</>
              : <><AlertTriangle className="w-3 h-3" /> Unequal variance</>
            }
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-inherit">
          {/* Normality details */}
          {hasNormality && (
            <div className="pt-2">
              <p className="font-medium text-[#0f172a] mb-1">Normality (Shapiro-Wilk)</p>
              <div className="space-y-0.5">
                {Object.entries(normality).map(([group, result]) => (
                  <div key={group} className="flex items-center gap-2">
                    {result.isNormal
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      : <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    }
                    <span className="text-[#334155]">
                      {group}: {result.W != null ? `W = ${result.W.toFixed(3)}` : 'n/a'},{' '}
                      {result.p != null ? `p = ${result.p < 0.001 ? '< 0.001' : result.p.toFixed(3)}` : 'n/a'}
                      {result.isNormal ? '' : ' (non-normal)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equal variance details */}
          {hasVarCheck && (
            <div>
              <p className="font-medium text-[#0f172a] mb-1">Equal Variance (Levene&apos;s test)</p>
              <div className="flex items-center gap-2">
                {equalVar.equalVariance
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  : <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                }
                <span className="text-[#334155]">
                  F = {equalVar.statistic.toFixed(3)}, p = {equalVar.p < 0.001 ? '< 0.001' : equalVar.p.toFixed(3)}
                  {equalVar.equalVariance ? ' (equal)' : ' (unequal)'}
                </span>
              </div>
            </div>
          )}

          {/* Warning + alternative suggestion */}
          {warning && (
            <div className="mt-2 p-2 rounded bg-amber-100/60 border border-amber-200 text-amber-900">
              <p>{warning}</p>
              {suggested && onRunAlternative && (
                <button
                  onClick={() => onRunAlternative(suggested)}
                  className="mt-1.5 px-2.5 py-1 rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium transition-colors"
                >
                  Run {suggested.replace(/_/g, ' ')} instead
                </button>
              )}
            </div>
          )}

          {/* Sample sizes */}
          {assumptions.sample_sizes && (
            <div className="text-[#64748b]">
              Sample sizes: {assumptions.sample_sizes.per_group.join(', ')} (total: {assumptions.sample_sizes.total})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
