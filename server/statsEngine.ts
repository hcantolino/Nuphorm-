/**
 * statsEngine.ts — Server-side statistics engine orchestrator.
 *
 * The AI selects which test to run. This module calls Python (scipy/statsmodels/lifelines)
 * to execute the computation. Results are returned as structured JSON.
 *
 * Supported tests:
 *   TWO GROUPS: unpaired_ttest, paired_ttest, mann_whitney, wilcoxon_signed_rank
 *   THREE+ GROUPS: one_way_anova, two_way_anova, kruskal_wallis, friedman, repeated_measures_anova
 *   POST-HOC: tukey_hsd, bonferroni, dunnett, dunn
 *   CORRELATION: pearson, spearman, kendall
 *   REGRESSION: linear_regression, logistic_regression
 *   CATEGORICAL: chi_squared, fisher_exact
 *   SURVIVAL: kaplan_meier, log_rank, cox_proportional_hazards
 *   NORMALITY: shapiro_wilk, dagostino_pearson, levene_test
 */

import { executePython } from './pythonExecutor';

export interface StatsResult {
  results: Record<string, any>;
  test_used: string;
  assumptions?: {
    normality?: Record<string, { W: number; p: number; isNormal: boolean }>;
    equalVariance?: { statistic: number; p: number; equalVariance: boolean } | null;
    warning?: string | null;
    suggestedAlternative?: string | null;
    sample_sizes?: { per_group: number[]; total: number };
  };
  post_hoc?: Record<string, any>;
  error?: string;
}

// ── Map of parametric tests that require normality ──────────────────────────
const NORMALITY_REQUIRED = new Set([
  'unpaired_ttest', 'paired_ttest', 'one_way_anova',
  'two_way_anova', 'repeated_measures_anova',
]);

const ALTERNATIVES: Record<string, string> = {
  unpaired_ttest: 'mann_whitney',
  paired_ttest: 'wilcoxon_signed_rank',
  one_way_anova: 'kruskal_wallis',
  repeated_measures_anova: 'friedman',
};

/**
 * Run a statistical test with automatic assumption checking.
 */
export async function runStatisticalTest(
  test: string,
  data: any,
  params: any,
): Promise<StatsResult> {
  try {
    // Build the Python code for the requested test
    const pythonCode = buildPythonCode(test, data, params);

    // Execute via Python subprocess
    const result = await executePython(pythonCode, JSON.stringify(data));

    if (!result.success) {
      return {
        results: {},
        test_used: test,
        error: result.stderr || result.error || 'Python execution failed',
      };
    }

    // Parse Python JSON output
    let parsed: any;
    try {
      // Extract the last JSON object from stdout (Python may print warnings before)
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}$/);
      if (!jsonMatch) throw new Error('No JSON output from Python');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return {
        results: {},
        test_used: test,
        error: `Failed to parse Python output: ${result.stdout.slice(0, 500)}`,
      };
    }

    if (parsed.error) {
      return { results: {}, test_used: test, error: parsed.error };
    }

    return {
      results: parsed.results ?? parsed,
      test_used: parsed.test_used ?? test,
      assumptions: parsed.assumptions ?? undefined,
      post_hoc: parsed.post_hoc ?? undefined,
    };
  } catch (error) {
    return {
      results: {},
      test_used: test,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build Python code for a given statistical test.
 */
function buildPythonCode(test: string, data: any, params: any): string {
  const paramsJson = JSON.stringify(params ?? {});

  return `
import json, sys
import numpy as np
import pandas as pd
from scipy import stats as sp_stats

# Load data and params
params = json.loads('''${paramsJson}''')
alpha = params.get('alpha', 0.05)

# Helper: effect size labels
def cohen_d_label(d):
    d = abs(d)
    if d < 0.2: return "negligible"
    if d < 0.5: return "small"
    if d < 0.8: return "medium"
    return "large"

def eta_sq_label(e):
    if e < 0.01: return "negligible"
    if e < 0.06: return "small"
    if e < 0.14: return "medium"
    return "large"

def format_p(p):
    if p < 0.0001: return "< 0.0001"
    if p < 0.001: return "< 0.001"
    return f"{p:.4f}"

def sig_stars(p):
    if p < 0.0001: return "****"
    if p < 0.001: return "***"
    if p < 0.01: return "**"
    if p < 0.05: return "*"
    return "ns"

# Extract groups from data
def extract_groups():
    group_col = params.get('group_column')
    value_col = params.get('value_column')
    if not group_col or not value_col:
        return {}
    groups = {}
    for row in df.to_dict('records'):
        g = str(row.get(group_col, '')).strip()
        v = row.get(value_col)
        if g and v is not None:
            try:
                v = float(v)
                if g not in groups:
                    groups[g] = []
                groups[g].append(v)
            except (ValueError, TypeError):
                pass
    return groups

# Normality check helper
def check_normality(groups_dict):
    normality = {}
    for name, vals in groups_dict.items():
        vals = np.array(vals, dtype=float)
        if len(vals) >= 3:
            try:
                w, p = sp_stats.shapiro(vals)
                normality[name] = {"W": round(w, 4), "p": round(p, 4), "isNormal": bool(p > alpha)}
            except Exception:
                normality[name] = {"W": None, "p": None, "isNormal": True}
        else:
            normality[name] = {"W": None, "p": None, "isNormal": True}
    return normality

# Equal variance check
def check_equal_variance(groups_dict):
    arrays = [np.array(v, dtype=float) for v in groups_dict.values() if len(v) >= 2]
    if len(arrays) < 2:
        return None
    try:
        stat, p = sp_stats.levene(*arrays)
        return {"statistic": round(stat, 4), "p": round(p, 4), "equalVariance": bool(p > alpha)}
    except Exception:
        return None

output = {"test_used": "${test}", "results": {}, "assumptions": {}}

try:
${getTestCode(test)}
except Exception as e:
    output["error"] = str(e)

print(json.dumps(output, default=str))
`;
}

function getTestCode(test: string): string {
  const indent = '    ';

  switch (test) {
    // ── TWO GROUP TESTS ──────────────────────────────────────────────────
    case 'unpaired_ttest':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}if len(keys) < 2:
${indent}    output["error"] = f"Need 2 groups, found {len(keys)}"
${indent}else:
${indent}    g1, g2 = np.array(groups[keys[0]], dtype=float), np.array(groups[keys[1]], dtype=float)
${indent}    norm = check_normality(groups)
${indent}    eq_var = check_equal_variance(groups)
${indent}    equal_var = eq_var["equalVariance"] if eq_var else True
${indent}    t_stat, p_val = sp_stats.ttest_ind(g1, g2, equal_var=equal_var)
${indent}    mean_diff = float(np.mean(g1) - np.mean(g2))
${indent}    pooled_std = np.sqrt(((len(g1)-1)*np.var(g1,ddof=1) + (len(g2)-1)*np.var(g2,ddof=1)) / (len(g1)+len(g2)-2))
${indent}    cohens_d = mean_diff / pooled_std if pooled_std > 0 else 0
${indent}    se_diff = np.sqrt(np.var(g1,ddof=1)/len(g1) + np.var(g2,ddof=1)/len(g2))
${indent}    df_val = len(g1) + len(g2) - 2
${indent}    from scipy.stats import t as t_dist
${indent}    t_crit = t_dist.ppf(1 - alpha/2, df_val)
${indent}    ci_lower = mean_diff - t_crit * se_diff
${indent}    ci_upper = mean_diff + t_crit * se_diff
${indent}    output["results"] = {
${indent}        "t_statistic": round(float(t_stat), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "df": df_val, "mean_diff": round(mean_diff, 4),
${indent}        "ci_95": [round(ci_lower, 4), round(ci_upper, 4)],
${indent}        "cohens_d": round(float(cohens_d), 4),
${indent}        "effect_size_label": cohen_d_label(cohens_d),
${indent}        "significance": sig_stars(p_val),
${indent}        "equal_var_used": equal_var,
${indent}        "test_variant": "Student's t-test" if equal_var else "Welch's t-test",
${indent}        "group1": {"name": keys[0], "n": len(g1), "mean": round(float(np.mean(g1)), 4), "sd": round(float(np.std(g1,ddof=1)), 4)},
${indent}        "group2": {"name": keys[1], "n": len(g2), "mean": round(float(np.mean(g2)), 4), "sd": round(float(np.std(g2,ddof=1)), 4)},
${indent}    }
${indent}    output["assumptions"] = {
${indent}        "normality": norm,
${indent}        "equalVariance": eq_var,
${indent}        "sample_sizes": {"per_group": [len(g1), len(g2)], "total": len(g1)+len(g2)},
${indent}    }`;

    case 'paired_ttest':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}if len(keys) < 2:
${indent}    output["error"] = f"Need 2 groups, found {len(keys)}"
${indent}else:
${indent}    g1, g2 = np.array(groups[keys[0]], dtype=float), np.array(groups[keys[1]], dtype=float)
${indent}    n = min(len(g1), len(g2))
${indent}    g1, g2 = g1[:n], g2[:n]
${indent}    diffs = g1 - g2
${indent}    t_stat, p_val = sp_stats.ttest_rel(g1, g2)
${indent}    mean_diff = float(np.mean(diffs))
${indent}    se_diff = float(np.std(diffs, ddof=1) / np.sqrt(n))
${indent}    from scipy.stats import t as t_dist
${indent}    t_crit = t_dist.ppf(1 - alpha/2, n-1)
${indent}    output["results"] = {
${indent}        "t_statistic": round(float(t_stat), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "df": n - 1, "mean_diff": round(mean_diff, 4),
${indent}        "ci_95": [round(mean_diff - t_crit*se_diff, 4), round(mean_diff + t_crit*se_diff, 4)],
${indent}        "significance": sig_stars(p_val), "n_pairs": n,
${indent}    }
${indent}    norm = check_normality({"differences": diffs.tolist()})
${indent}    output["assumptions"] = {"normality": norm, "sample_sizes": {"per_group": [n, n], "total": 2*n}}`;

    case 'mann_whitney':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}if len(keys) < 2:
${indent}    output["error"] = f"Need 2 groups, found {len(keys)}"
${indent}else:
${indent}    g1, g2 = np.array(groups[keys[0]], dtype=float), np.array(groups[keys[1]], dtype=float)
${indent}    u_stat, p_val = sp_stats.mannwhitneyu(g1, g2, alternative='two-sided')
${indent}    n1, n2 = len(g1), len(g2)
${indent}    rank_biserial = 1 - (2*u_stat)/(n1*n2)
${indent}    output["results"] = {
${indent}        "U_statistic": round(float(u_stat), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "rank_biserial_r": round(float(rank_biserial), 4),
${indent}        "significance": sig_stars(p_val),
${indent}        "group1": {"name": keys[0], "n": n1, "median": round(float(np.median(g1)), 4)},
${indent}        "group2": {"name": keys[1], "n": n2, "median": round(float(np.median(g2)), 4)},
${indent}    }
${indent}    output["assumptions"] = {"sample_sizes": {"per_group": [n1, n2], "total": n1+n2}}`;

    case 'wilcoxon_signed_rank':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}if len(keys) < 2:
${indent}    output["error"] = f"Need 2 groups, found {len(keys)}"
${indent}else:
${indent}    g1, g2 = np.array(groups[keys[0]], dtype=float), np.array(groups[keys[1]], dtype=float)
${indent}    n = min(len(g1), len(g2))
${indent}    g1, g2 = g1[:n], g2[:n]
${indent}    w_stat, p_val = sp_stats.wilcoxon(g1, g2)
${indent}    output["results"] = {
${indent}        "W_statistic": round(float(w_stat), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "significance": sig_stars(p_val), "n_pairs": n,
${indent}    }
${indent}    output["assumptions"] = {"sample_sizes": {"per_group": [n, n], "total": 2*n}}`;

    // ── THREE+ GROUP TESTS ───────────────────────────────────────────────
    case 'one_way_anova':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}if len(keys) < 2:
${indent}    output["error"] = f"Need >=2 groups, found {len(keys)}"
${indent}else:
${indent}    arrays = [np.array(groups[k], dtype=float) for k in keys]
${indent}    f_stat, p_val = sp_stats.f_oneway(*arrays)
${indent}    all_vals = np.concatenate(arrays)
${indent}    grand_mean = np.mean(all_vals)
${indent}    ss_between = sum(len(a) * (np.mean(a) - grand_mean)**2 for a in arrays)
${indent}    ss_total = np.sum((all_vals - grand_mean)**2)
${indent}    eta_sq = ss_between / ss_total if ss_total > 0 else 0
${indent}    df_between = len(keys) - 1
${indent}    df_within = len(all_vals) - len(keys)
${indent}    norm = check_normality(groups)
${indent}    eq_var = check_equal_variance(groups)
${indent}    output["results"] = {
${indent}        "F_statistic": round(float(f_stat), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "df_between": df_between, "df_within": df_within,
${indent}        "eta_squared": round(float(eta_sq), 4),
${indent}        "effect_size_label": eta_sq_label(eta_sq),
${indent}        "significance": sig_stars(p_val),
${indent}        "group_stats": [{
${indent}            "name": k, "n": len(groups[k]),
${indent}            "mean": round(float(np.mean(groups[k])), 4),
${indent}            "sd": round(float(np.std(groups[k], ddof=1)), 4),
${indent}            "sem": round(float(np.std(groups[k], ddof=1)/np.sqrt(len(groups[k]))), 4),
${indent}            "median": round(float(np.median(groups[k])), 4),
${indent}            "min": round(float(np.min(groups[k])), 4),
${indent}            "max": round(float(np.max(groups[k])), 4),
${indent}        } for k in keys],
${indent}    }
${indent}    output["assumptions"] = {
${indent}        "normality": norm, "equalVariance": eq_var,
${indent}        "sample_sizes": {"per_group": [len(groups[k]) for k in keys], "total": len(all_vals)},
${indent}    }
${indent}    # Auto post-hoc if significant
${indent}    if p_val < alpha:
${indent}        try:
${indent}            from statsmodels.stats.multicomp import pairwise_tukeyhsd
${indent}            all_data = np.concatenate([np.array(groups[k]) for k in keys])
${indent}            all_labels = np.concatenate([[k]*len(groups[k]) for k in keys])
${indent}            tukey = pairwise_tukeyhsd(all_data, all_labels, alpha=alpha)
${indent}            post_hoc = []
${indent}            for i in range(len(tukey.summary().data)-1):
${indent}                row = tukey.summary().data[i+1]
${indent}                post_hoc.append({
${indent}                    "group1": str(row[0]), "group2": str(row[1]),
${indent}                    "mean_diff": round(float(row[2]), 4),
${indent}                    "p_adj": float(row[3]) if not isinstance(row[3], str) else row[3],
${indent}                    "ci_lower": round(float(row[4]), 4),
${indent}                    "ci_upper": round(float(row[5]), 4),
${indent}                    "reject": bool(row[6]) if not isinstance(row[6], str) else row[6] == "True",
${indent}                    "significance": sig_stars(float(row[3])) if not isinstance(row[3], str) else "ns",
${indent}                })
${indent}            output["post_hoc"] = {"method": "tukey_hsd", "comparisons": post_hoc}
${indent}        except Exception as e:
${indent}            output["post_hoc"] = {"method": "tukey_hsd", "error": str(e)}`;

    case 'kruskal_wallis':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}if len(keys) < 2:
${indent}    output["error"] = f"Need >=2 groups, found {len(keys)}"
${indent}else:
${indent}    arrays = [np.array(groups[k], dtype=float) for k in keys]
${indent}    h_stat, p_val = sp_stats.kruskal(*arrays)
${indent}    output["results"] = {
${indent}        "H_statistic": round(float(h_stat), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "significance": sig_stars(p_val),
${indent}        "group_stats": [{"name": k, "n": len(groups[k]), "median": round(float(np.median(groups[k])), 4)} for k in keys],
${indent}    }
${indent}    output["assumptions"] = {"sample_sizes": {"per_group": [len(groups[k]) for k in keys], "total": sum(len(groups[k]) for k in keys)}}
${indent}    # Post-hoc Dunn test if significant
${indent}    if p_val < alpha:
${indent}        try:
${indent}            import scikit_posthocs as sp
${indent}            all_data = np.concatenate([np.array(groups[k]) for k in keys])
${indent}            all_labels = np.concatenate([[k]*len(groups[k]) for k in keys])
${indent}            dunn_df = pd.DataFrame({"value": all_data, "group": all_labels})
${indent}            dunn_result = sp.posthoc_dunn(dunn_df, val_col="value", group_col="group", p_adjust="bonferroni")
${indent}            comparisons = []
${indent}            for i, k1 in enumerate(dunn_result.index):
${indent}                for j, k2 in enumerate(dunn_result.columns):
${indent}                    if i < j:
${indent}                        p = float(dunn_result.iloc[i, j])
${indent}                        comparisons.append({"group1": str(k1), "group2": str(k2), "p_adj": round(p, 4), "significance": sig_stars(p)})
${indent}            output["post_hoc"] = {"method": "dunn", "comparisons": comparisons}
${indent}        except ImportError:
${indent}            output["post_hoc"] = {"method": "dunn", "error": "scikit-posthocs not installed"}
${indent}        except Exception as e:
${indent}            output["post_hoc"] = {"method": "dunn", "error": str(e)}`;

    case 'friedman':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}if len(keys) < 3:
${indent}    output["error"] = f"Need >=3 groups for Friedman, found {len(keys)}"
${indent}else:
${indent}    min_n = min(len(groups[k]) for k in keys)
${indent}    arrays = [np.array(groups[k][:min_n], dtype=float) for k in keys]
${indent}    chi2, p_val = sp_stats.friedmanchisquare(*arrays)
${indent}    output["results"] = {
${indent}        "chi2_statistic": round(float(chi2), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "significance": sig_stars(p_val), "n_subjects": min_n, "k_conditions": len(keys),
${indent}    }`;

    case 'two_way_anova':
      return `${indent}try:
${indent}    from statsmodels.formula.api import ols
${indent}    from statsmodels.stats.anova import anova_lm
${indent}    factor1 = params.get('factor1', params.get('group_column', ''))
${indent}    factor2 = params.get('factor2', '')
${indent}    value_col = params.get('value_column', '')
${indent}    if not factor1 or not factor2 or not value_col:
${indent}        output["error"] = "two_way_anova requires factor1, factor2, and value_column params"
${indent}    else:
${indent}        safe_f1 = factor1.replace(' ', '_')
${indent}        safe_f2 = factor2.replace(' ', '_')
${indent}        safe_val = value_col.replace(' ', '_')
${indent}        df_anova = df.rename(columns={factor1: safe_f1, factor2: safe_f2, value_col: safe_val})
${indent}        formula = f"{safe_val} ~ C({safe_f1}) * C({safe_f2})"
${indent}        model = ols(formula, data=df_anova).fit()
${indent}        anova_table = anova_lm(model, typ=2)
${indent}        results = {}
${indent}        for idx in anova_table.index:
${indent}            name = str(idx).replace(f"C({safe_f1})", factor1).replace(f"C({safe_f2})", factor2)
${indent}            row = anova_table.loc[idx]
${indent}            results[name] = {
${indent}                "sum_sq": round(float(row.get("sum_sq", 0)), 4),
${indent}                "df": int(row.get("df", 0)),
${indent}                "F": round(float(row.get("F", 0)), 4) if not np.isnan(row.get("F", float("nan"))) else None,
${indent}                "p_value": float(row.get("PR(>F)", 1)) if not np.isnan(row.get("PR(>F)", float("nan"))) else None,
${indent}            }
${indent}            if results[name]["p_value"] is not None:
${indent}                results[name]["significance"] = sig_stars(results[name]["p_value"])
${indent}        output["results"] = results
${indent}except ImportError:
${indent}    output["error"] = "statsmodels not installed"`;

    case 'repeated_measures_anova':
      return `${indent}try:
${indent}    import pingouin as pg
${indent}    subject_col = params.get('subject_column', 'Subject')
${indent}    within_col = params.get('group_column', '')
${indent}    value_col = params.get('value_column', '')
${indent}    if not within_col or not value_col:
${indent}        output["error"] = "repeated_measures_anova requires group_column and value_column"
${indent}    else:
${indent}        aov = pg.rm_anova(data=df, dv=value_col, within=within_col, subject=subject_col)
${indent}        row = aov.iloc[0]
${indent}        output["results"] = {
${indent}            "F": round(float(row["F"]), 4),
${indent}            "p_value": float(row["p-unc"]),
${indent}            "p_formatted": format_p(float(row["p-unc"])),
${indent}            "df_num": int(row["ddof1"]),
${indent}            "df_den": int(row["ddof2"]),
${indent}            "partial_eta_squared": round(float(row["np2"]), 4),
${indent}            "sphericity": bool(row.get("sphericity", True)),
${indent}            "significance": sig_stars(float(row["p-unc"])),
${indent}        }
${indent}except ImportError:
${indent}    output["error"] = "pingouin not installed"`;

    // ── POST-HOC TESTS ───────────────────────────────────────────────────
    case 'tukey_hsd':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}from statsmodels.stats.multicomp import pairwise_tukeyhsd
${indent}all_data = np.concatenate([np.array(groups[k]) for k in keys])
${indent}all_labels = np.concatenate([[k]*len(groups[k]) for k in keys])
${indent}tukey = pairwise_tukeyhsd(all_data, all_labels, alpha=alpha)
${indent}comparisons = []
${indent}for i in range(len(tukey.summary().data)-1):
${indent}    row = tukey.summary().data[i+1]
${indent}    comparisons.append({
${indent}        "group1": str(row[0]), "group2": str(row[1]),
${indent}        "mean_diff": round(float(row[2]), 4),
${indent}        "p_adj": round(float(row[3]), 4) if not isinstance(row[3], str) else row[3],
${indent}        "ci_lower": round(float(row[4]), 4),
${indent}        "ci_upper": round(float(row[5]), 4),
${indent}        "reject": bool(row[6]) if not isinstance(row[6], str) else row[6] == "True",
${indent}        "significance": sig_stars(float(row[3])) if not isinstance(row[3], str) else "ns",
${indent}    })
${indent}output["results"] = {"comparisons": comparisons}`;

    case 'bonferroni':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}comparisons = []
${indent}n_comparisons = len(keys) * (len(keys) - 1) // 2
${indent}for i in range(len(keys)):
${indent}    for j in range(i+1, len(keys)):
${indent}        g1, g2 = np.array(groups[keys[i]], dtype=float), np.array(groups[keys[j]], dtype=float)
${indent}        t_stat, p_raw = sp_stats.ttest_ind(g1, g2)
${indent}        p_adj = min(p_raw * n_comparisons, 1.0)
${indent}        mean_diff = float(np.mean(g1) - np.mean(g2))
${indent}        comparisons.append({
${indent}            "group1": keys[i], "group2": keys[j],
${indent}            "mean_diff": round(mean_diff, 4),
${indent}            "p_raw": round(float(p_raw), 4),
${indent}            "p_adj": round(float(p_adj), 4),
${indent}            "reject": bool(p_adj < alpha),
${indent}            "significance": sig_stars(p_adj),
${indent}        })
${indent}output["results"] = {"comparisons": comparisons, "correction": "bonferroni", "n_comparisons": n_comparisons}`;

    case 'dunnett':
      return `${indent}groups = extract_groups()
${indent}keys = list(groups.keys())
${indent}control = params.get('control_group', keys[0])
${indent}control_data = np.array(groups.get(control, []), dtype=float)
${indent}comparisons = []
${indent}for k in keys:
${indent}    if k == control: continue
${indent}    treatment = np.array(groups[k], dtype=float)
${indent}    try:
${indent}        result = sp_stats.dunnett(treatment, control=control_data)
${indent}        comparisons.append({
${indent}            "group": k, "vs_control": control,
${indent}            "statistic": round(float(result.statistic[0]), 4),
${indent}            "p_adj": round(float(result.pvalue[0]), 4),
${indent}            "significance": sig_stars(float(result.pvalue[0])),
${indent}        })
${indent}    except Exception:
${indent}        t_stat, p_val = sp_stats.ttest_ind(treatment, control_data)
${indent}        comparisons.append({
${indent}            "group": k, "vs_control": control,
${indent}            "statistic": round(float(t_stat), 4),
${indent}            "p_adj": round(float(p_val), 4),
${indent}            "significance": sig_stars(float(p_val)),
${indent}            "note": "Dunnett unavailable, used t-test",
${indent}        })
${indent}output["results"] = {"comparisons": comparisons, "control": control}`;

    case 'dunn':
      return `${indent}try:
${indent}    import scikit_posthocs as sp
${indent}    groups = extract_groups()
${indent}    keys = list(groups.keys())
${indent}    all_data = np.concatenate([np.array(groups[k]) for k in keys])
${indent}    all_labels = np.concatenate([[k]*len(groups[k]) for k in keys])
${indent}    dunn_df = pd.DataFrame({"value": all_data, "group": all_labels})
${indent}    result = sp.posthoc_dunn(dunn_df, val_col="value", group_col="group", p_adjust="bonferroni")
${indent}    comparisons = []
${indent}    for i, k1 in enumerate(result.index):
${indent}        for j, k2 in enumerate(result.columns):
${indent}            if i < j:
${indent}                p = float(result.iloc[i, j])
${indent}                comparisons.append({"group1": str(k1), "group2": str(k2), "p_adj": round(p, 4), "significance": sig_stars(p)})
${indent}    output["results"] = {"comparisons": comparisons}
${indent}except ImportError:
${indent}    output["error"] = "scikit-posthocs not installed"`;

    // ── CORRELATION ──────────────────────────────────────────────────────
    case 'pearson':
      return `${indent}x_col = params.get('x_column', params.get('value_column', ''))
${indent}y_col = params.get('y_column', '')
${indent}if not x_col or not y_col:
${indent}    output["error"] = "pearson requires x_column and y_column"
${indent}else:
${indent}    x = df[x_col].dropna().astype(float)
${indent}    y = df[y_col].dropna().astype(float)
${indent}    n = min(len(x), len(y))
${indent}    x, y = x.iloc[:n].values, y.iloc[:n].values
${indent}    r, p_val = sp_stats.pearsonr(x, y)
${indent}    # Fisher z-transform for CI
${indent}    z = np.arctanh(r)
${indent}    se_z = 1/np.sqrt(n-3) if n > 3 else 0
${indent}    ci_z = [z - 1.96*se_z, z + 1.96*se_z]
${indent}    ci_r = [float(np.tanh(ci_z[0])), float(np.tanh(ci_z[1]))]
${indent}    output["results"] = {
${indent}        "r": round(float(r), 4), "r_squared": round(float(r**2), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "ci_95": [round(ci_r[0], 4), round(ci_r[1], 4)],
${indent}        "n": n, "significance": sig_stars(p_val),
${indent}    }`;

    case 'spearman':
      return `${indent}x_col = params.get('x_column', params.get('value_column', ''))
${indent}y_col = params.get('y_column', '')
${indent}if not x_col or not y_col:
${indent}    output["error"] = "spearman requires x_column and y_column"
${indent}else:
${indent}    x = df[x_col].dropna().astype(float)
${indent}    y = df[y_col].dropna().astype(float)
${indent}    n = min(len(x), len(y))
${indent}    x, y = x.iloc[:n].values, y.iloc[:n].values
${indent}    rho, p_val = sp_stats.spearmanr(x, y)
${indent}    output["results"] = {
${indent}        "rho": round(float(rho), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "n": n, "significance": sig_stars(p_val),
${indent}    }`;

    case 'kendall':
      return `${indent}x_col = params.get('x_column', params.get('value_column', ''))
${indent}y_col = params.get('y_column', '')
${indent}if not x_col or not y_col:
${indent}    output["error"] = "kendall requires x_column and y_column"
${indent}else:
${indent}    x = df[x_col].dropna().astype(float)
${indent}    y = df[y_col].dropna().astype(float)
${indent}    n = min(len(x), len(y))
${indent}    x, y = x.iloc[:n].values, y.iloc[:n].values
${indent}    tau, p_val = sp_stats.kendalltau(x, y)
${indent}    output["results"] = {
${indent}        "tau": round(float(tau), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "n": n, "significance": sig_stars(p_val),
${indent}    }`;

    // ── REGRESSION ───────────────────────────────────────────────────────
    case 'linear_regression':
      return `${indent}try:
${indent}    import statsmodels.api as sm
${indent}    x_cols = params.get('x_columns', [params.get('x_column', '')])
${indent}    y_col = params.get('y_column', params.get('value_column', ''))
${indent}    if not x_cols or not y_col:
${indent}        output["error"] = "linear_regression requires x_columns and y_column"
${indent}    else:
${indent}        X = df[x_cols].dropna().astype(float)
${indent}        y = df[y_col].dropna().astype(float)
${indent}        n = min(len(X), len(y))
${indent}        X, y = X.iloc[:n], y.iloc[:n]
${indent}        X_const = sm.add_constant(X)
${indent}        model = sm.OLS(y, X_const).fit()
${indent}        ci = model.conf_int(alpha=alpha)
${indent}        coeffs = []
${indent}        names = ["Intercept"] + list(x_cols)
${indent}        for i, name in enumerate(names):
${indent}            coeffs.append({
${indent}                "name": name,
${indent}                "coefficient": round(float(model.params.iloc[i]), 4),
${indent}                "std_error": round(float(model.bse.iloc[i]), 4),
${indent}                "t_value": round(float(model.tvalues.iloc[i]), 4),
${indent}                "p_value": float(model.pvalues.iloc[i]),
${indent}                "p_formatted": format_p(float(model.pvalues.iloc[i])),
${indent}                "ci_lower": round(float(ci.iloc[i, 0]), 4),
${indent}                "ci_upper": round(float(ci.iloc[i, 1]), 4),
${indent}            })
${indent}        output["results"] = {
${indent}            "coefficients": coeffs,
${indent}            "r_squared": round(float(model.rsquared), 4),
${indent}            "adj_r_squared": round(float(model.rsquared_adj), 4),
${indent}            "f_statistic": round(float(model.fvalue), 4),
${indent}            "f_pvalue": float(model.f_pvalue),
${indent}            "n": int(model.nobs), "df_model": int(model.df_model), "df_resid": int(model.df_resid),
${indent}        }
${indent}except ImportError:
${indent}    output["error"] = "statsmodels not installed"`;

    case 'logistic_regression':
      return `${indent}try:
${indent}    import statsmodels.api as sm
${indent}    x_cols = params.get('x_columns', [params.get('x_column', '')])
${indent}    y_col = params.get('y_column', params.get('value_column', ''))
${indent}    X = df[x_cols].dropna().astype(float)
${indent}    y = df[y_col].dropna().astype(float)
${indent}    n = min(len(X), len(y))
${indent}    X, y = X.iloc[:n], y.iloc[:n]
${indent}    X_const = sm.add_constant(X)
${indent}    model = sm.Logit(y, X_const).fit(disp=0)
${indent}    ci = model.conf_int(alpha=alpha)
${indent}    coeffs = []
${indent}    names = ["Intercept"] + list(x_cols)
${indent}    for i, name in enumerate(names):
${indent}        coeffs.append({
${indent}            "name": name,
${indent}            "coefficient": round(float(model.params.iloc[i]), 4),
${indent}            "odds_ratio": round(float(np.exp(model.params.iloc[i])), 4),
${indent}            "p_value": float(model.pvalues.iloc[i]),
${indent}            "ci_lower": round(float(np.exp(ci.iloc[i, 0])), 4),
${indent}            "ci_upper": round(float(np.exp(ci.iloc[i, 1])), 4),
${indent}        })
${indent}    output["results"] = {
${indent}        "coefficients": coeffs,
${indent}        "pseudo_r_squared": round(float(model.prsquared), 4),
${indent}        "n": int(model.nobs),
${indent}    }
${indent}except ImportError:
${indent}    output["error"] = "statsmodels not installed"`;

    // ── CATEGORICAL ──────────────────────────────────────────────────────
    case 'chi_squared':
      return `${indent}col1 = params.get('column1', params.get('group_column', ''))
${indent}col2 = params.get('column2', params.get('value_column', ''))
${indent}if not col1 or not col2:
${indent}    output["error"] = "chi_squared requires column1 and column2"
${indent}else:
${indent}    ct = pd.crosstab(df[col1], df[col2])
${indent}    chi2, p_val, dof, expected = sp_stats.chi2_contingency(ct)
${indent}    n = ct.values.sum()
${indent}    k = min(ct.shape) - 1
${indent}    cramers_v = np.sqrt(chi2 / (n * k)) if n * k > 0 else 0
${indent}    output["results"] = {
${indent}        "chi2": round(float(chi2), 4),
${indent}        "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}        "df": int(dof), "cramers_v": round(float(cramers_v), 4),
${indent}        "significance": sig_stars(p_val),
${indent}        "contingency_table": ct.to_dict(),
${indent}        "expected_frequencies": pd.DataFrame(expected, index=ct.index, columns=ct.columns).to_dict(),
${indent}    }`;

    case 'fisher_exact':
      return `${indent}col1 = params.get('column1', params.get('group_column', ''))
${indent}col2 = params.get('column2', params.get('value_column', ''))
${indent}if not col1 or not col2:
${indent}    output["error"] = "fisher_exact requires column1 and column2"
${indent}else:
${indent}    ct = pd.crosstab(df[col1], df[col2])
${indent}    if ct.shape == (2, 2):
${indent}        odds_ratio, p_val = sp_stats.fisher_exact(ct)
${indent}        output["results"] = {
${indent}            "odds_ratio": round(float(odds_ratio), 4),
${indent}            "p_value": float(p_val), "p_formatted": format_p(p_val),
${indent}            "significance": sig_stars(p_val),
${indent}        }
${indent}    else:
${indent}        output["error"] = f"Fisher exact requires 2x2 table, got {ct.shape}"`;

    // ── SURVIVAL ─────────────────────────────────────────────────────────
    case 'kaplan_meier':
      return `${indent}try:
${indent}    from lifelines import KaplanMeierFitter
${indent}    time_col = params.get('time_column', '')
${indent}    event_col = params.get('event_column', '')
${indent}    group_col = params.get('group_column', '')
${indent}    if not time_col or not event_col:
${indent}        output["error"] = "kaplan_meier requires time_column and event_column"
${indent}    else:
${indent}        group_results = {}
${indent}        groups_to_fit = {}
${indent}        if group_col and group_col in df.columns:
${indent}            for g in df[group_col].dropna().unique():
${indent}                mask = df[group_col] == g
${indent}                groups_to_fit[str(g)] = df[mask]
${indent}        else:
${indent}            groups_to_fit["All"] = df
${indent}        for gname, gdf in groups_to_fit.items():
${indent}            kmf = KaplanMeierFitter()
${indent}            T = gdf[time_col].dropna().astype(float)
${indent}            E = gdf[event_col].dropna().astype(float)
${indent}            n = min(len(T), len(E))
${indent}            kmf.fit(T.iloc[:n], E.iloc[:n], label=gname)
${indent}            sf = kmf.survival_function_
${indent}            ci = kmf.confidence_interval_survival_function_
${indent}            group_results[gname] = {
${indent}                "timeline": sf.index.tolist(),
${indent}                "survival_probability": sf.iloc[:, 0].tolist(),
${indent}                "ci_lower": ci.iloc[:, 0].tolist() if ci.shape[1] >= 1 else [],
${indent}                "ci_upper": ci.iloc[:, 1].tolist() if ci.shape[1] >= 2 else [],
${indent}                "median_survival": float(kmf.median_survival_time_) if not np.isinf(kmf.median_survival_time_) else None,
${indent}                "n_events": int(E.iloc[:n].sum()),
${indent}                "n_censored": int(n - E.iloc[:n].sum()),
${indent}                "n_total": n,
${indent}            }
${indent}        output["results"] = group_results
${indent}except ImportError:
${indent}    output["error"] = "lifelines not installed"`;

    case 'log_rank':
      return `${indent}try:
${indent}    from lifelines.statistics import logrank_test
${indent}    time_col = params.get('time_column', '')
${indent}    event_col = params.get('event_column', '')
${indent}    group_col = params.get('group_column', '')
${indent}    if not time_col or not event_col or not group_col:
${indent}        output["error"] = "log_rank requires time_column, event_column, and group_column"
${indent}    else:
${indent}        groups = df[group_col].dropna().unique()
${indent}        if len(groups) < 2:
${indent}            output["error"] = f"Need >=2 groups, found {len(groups)}"
${indent}        else:
${indent}            g1_mask = df[group_col] == groups[0]
${indent}            g2_mask = df[group_col] == groups[1]
${indent}            result = logrank_test(
${indent}                df[g1_mask][time_col].astype(float), df[g2_mask][time_col].astype(float),
${indent}                df[g1_mask][event_col].astype(float), df[g2_mask][event_col].astype(float),
${indent}            )
${indent}            output["results"] = {
${indent}                "test_statistic": round(float(result.test_statistic), 4),
${indent}                "p_value": float(result.p_value), "p_formatted": format_p(float(result.p_value)),
${indent}                "significance": sig_stars(float(result.p_value)),
${indent}                "group1": str(groups[0]), "group2": str(groups[1]),
${indent}            }
${indent}except ImportError:
${indent}    output["error"] = "lifelines not installed"`;

    case 'cox_proportional_hazards':
      return `${indent}try:
${indent}    from lifelines import CoxPHFitter
${indent}    time_col = params.get('time_column', '')
${indent}    event_col = params.get('event_column', '')
${indent}    covariates = params.get('covariates', [])
${indent}    if not time_col or not event_col:
${indent}        output["error"] = "cox requires time_column and event_column"
${indent}    else:
${indent}        cols = [time_col, event_col] + covariates
${indent}        cdf = df[cols].dropna()
${indent}        # Convert categoricals to dummies
${indent}        for c in covariates:
${indent}            if cdf[c].dtype == object:
${indent}                cdf = pd.get_dummies(cdf, columns=[c], drop_first=True)
${indent}        cph = CoxPHFitter()
${indent}        cph.fit(cdf, duration_col=time_col, event_col=event_col)
${indent}        summary = cph.summary
${indent}        coeffs = []
${indent}        for idx in summary.index:
${indent}            row = summary.loc[idx]
${indent}            coeffs.append({
${indent}                "covariate": str(idx),
${indent}                "hazard_ratio": round(float(row["exp(coef)"]), 4),
${indent}                "ci_lower": round(float(row["exp(coef) lower 95%"]), 4),
${indent}                "ci_upper": round(float(row["exp(coef) upper 95%"]), 4),
${indent}                "p_value": float(row["p"]),
${indent}                "p_formatted": format_p(float(row["p"])),
${indent}                "significance": sig_stars(float(row["p"])),
${indent}            })
${indent}        output["results"] = {
${indent}            "coefficients": coeffs,
${indent}            "concordance_index": round(float(cph.concordance_index_), 4),
${indent}            "n": int(cdf.shape[0]),
${indent}        }
${indent}except ImportError:
${indent}    output["error"] = "lifelines not installed"`;

    // ── NORMALITY / ASSUMPTION CHECKS ────────────────────────────────────
    case 'shapiro_wilk':
      return `${indent}groups = extract_groups()
${indent}if len(groups) == 0:
${indent}    vals = params.get('values', [])
${indent}    if len(vals) >= 3:
${indent}        w, p = sp_stats.shapiro(np.array(vals, dtype=float))
${indent}        output["results"] = {"W_statistic": round(float(w), 4), "p_value": float(p), "is_normal": bool(p > alpha)}
${indent}    else:
${indent}        output["error"] = "Need at least 3 values"
${indent}else:
${indent}    output["results"] = check_normality(groups)`;

    case 'dagostino_pearson':
      return `${indent}groups = extract_groups()
${indent}results = {}
${indent}for name, vals in (groups if groups else {"values": params.get("values", [])}).items():
${indent}    arr = np.array(vals, dtype=float)
${indent}    if len(arr) >= 8:
${indent}        stat, p = sp_stats.normaltest(arr)
${indent}        results[name] = {"statistic": round(float(stat), 4), "p_value": float(p), "is_normal": bool(p > alpha)}
${indent}    else:
${indent}        results[name] = {"statistic": None, "p_value": None, "is_normal": True, "note": "n < 8, test not reliable"}
${indent}output["results"] = results`;

    case 'levene_test':
      return `${indent}groups = extract_groups()
${indent}if len(groups) < 2:
${indent}    output["error"] = "Need >=2 groups for Levene test"
${indent}else:
${indent}    arrays = [np.array(v, dtype=float) for v in groups.values()]
${indent}    stat, p = sp_stats.levene(*arrays)
${indent}    output["results"] = {"statistic": round(float(stat), 4), "p_value": float(p), "equalVariance": bool(p > alpha)}`;

    default:
      return `${indent}output["error"] = "Unknown test: ${test}"`;
  }
}
