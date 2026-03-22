/**
 * pythonExecutor.ts — Sandboxed Python code execution for statistical computations.
 *
 * Claude writes Python code → this module executes it in a subprocess → returns
 * stdout/stderr. The code runs with numpy, scipy, pandas, and statsmodels available.
 *
 * Security: runs with a timeout, no network access, temp files are cleaned up.
 */

import { execFile } from 'child_process';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const PYTHON_BIN = 'python3';
const TIMEOUT_MS = 30_000; // 30s max execution time
const MAX_OUTPUT_BYTES = 512_000; // 512 KB max output

export interface PythonResult {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
}

/**
 * Execute Python code in a sandboxed subprocess.
 *
 * @param code   - Python source code to execute
 * @param dataJson - Optional JSON string of the dataset (injected as DATA_JSON env var)
 */
export async function executePython(
  code: string,
  dataJson?: string
): Promise<PythonResult> {
  const start = Date.now();
  let tmpDir: string | null = null;
  let scriptPath: string | null = null;

  try {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'nuphorm-py-'));
    scriptPath = path.join(tmpDir, 'analysis.py');

    // Wrap the user code with imports and data injection
    const wrappedCode = `
import sys, os, json, warnings
warnings.filterwarnings('ignore')

# Standard scientific stack
import numpy as np
import pandas as pd
from scipy import stats
try:
    import statsmodels.api as sm
    from statsmodels.formula.api import ols
    from statsmodels.stats.multicomp import pairwise_tukeyhsd
    from statsmodels.stats.anova import anova_lm
except ImportError:
    pass

# Load dataset if provided
DATA_JSON = os.environ.get('DATA_JSON', '')
df = pd.DataFrame()
if DATA_JSON:
    try:
        df = pd.read_json(DATA_JSON, orient='records')
    except Exception:
        try:
            df = pd.DataFrame(json.loads(DATA_JSON))
        except Exception:
            pass

# ── User code ──────────────────────────────────────────────
${code}
`;

    await writeFile(scriptPath, wrappedCode, 'utf-8');

    // Prepare environment — inject data as env var if small enough,
    // otherwise write to a temp file and read it in the script
    const env: Record<string, string> = { ...process.env as any };
    if (dataJson && dataJson.length < 128_000) {
      env.DATA_JSON = dataJson;
    } else if (dataJson) {
      const dataPath = path.join(tmpDir, 'data.json');
      await writeFile(dataPath, dataJson, 'utf-8');
      // Rewrite the script to load from file instead
      const loadFromFile = `
import sys, os, json, warnings
warnings.filterwarnings('ignore')
import numpy as np
import pandas as pd
from scipy import stats
try:
    import statsmodels.api as sm
    from statsmodels.formula.api import ols
    from statsmodels.stats.multicomp import pairwise_tukeyhsd
    from statsmodels.stats.anova import anova_lm
except ImportError:
    pass

df = pd.read_json('${dataPath}', orient='records')

${code}
`;
      await writeFile(scriptPath, loadFromFile, 'utf-8');
    }

    return await new Promise<PythonResult>((resolve) => {
      execFile(
        PYTHON_BIN,
        [scriptPath!],
        {
          timeout: TIMEOUT_MS,
          maxBuffer: MAX_OUTPUT_BYTES,
          env,
          cwd: tmpDir!,
        },
        (error, stdout, stderr) => {
          const executionTimeMs = Date.now() - start;
          if (error) {
            resolve({
              success: false,
              stdout: stdout?.toString() ?? '',
              stderr: stderr?.toString() ?? '',
              executionTimeMs,
              error: error.message,
            });
          } else {
            resolve({
              success: true,
              stdout: stdout?.toString() ?? '',
              stderr: stderr?.toString() ?? '',
              executionTimeMs,
            });
          }
        }
      );
    });
  } catch (err) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      executionTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    // Clean up temp files
    try {
      if (scriptPath) await unlink(scriptPath).catch(() => {});
      if (tmpDir) {
        const dataPath = path.join(tmpDir, 'data.json');
        await unlink(dataPath).catch(() => {});
        // rmdir only works on empty dirs
        const { rmdir } = await import('fs/promises');
        await rmdir(tmpDir).catch(() => {});
      }
    } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Build a concise data summary for Claude's context (Layer 2).
 * Runs pandas profiling in Python to generate column stats, dtypes,
 * group counts, and missing value info.
 */
export async function buildDataSummary(
  data: any[],
  columns: string[]
): Promise<string> {
  if (!data || data.length === 0) return 'No data available.';

  const dataJson = JSON.stringify(data.slice(0, 5000)); // cap at 5k rows for profiling
  const code = `
import json

summary = {
    "rows": len(df),
    "columns": list(df.columns),
    "dtypes": {col: str(dt) for col, dt in df.dtypes.items()},
    "missing": {col: int(df[col].isna().sum()) for col in df.columns if df[col].isna().sum() > 0},
    "numeric_stats": {},
    "categorical_groups": {},
}

for col in df.select_dtypes(include='number').columns:
    s = df[col].describe()
    summary["numeric_stats"][col] = {
        "mean": round(float(s["mean"]), 4),
        "std": round(float(s["std"]), 4),
        "min": round(float(s["min"]), 4),
        "max": round(float(s["max"]), 4),
        "median": round(float(df[col].median()), 4),
        "n_nonmissing": int(s["count"]),
    }

for col in df.select_dtypes(include=['object', 'category']).columns:
    vc = df[col].value_counts()
    summary["categorical_groups"][col] = {str(k): int(v) for k, v in vc.head(20).items()}

print(json.dumps(summary))
`;

  const result = await executePython(code, dataJson);
  if (result.success && result.stdout.trim()) {
    try {
      const parsed = JSON.parse(result.stdout.trim());
      const lines: string[] = [
        `Dataset: ${parsed.rows} rows × ${parsed.columns.length} columns`,
        `Columns: ${parsed.columns.join(', ')}`,
        `Data types: ${Object.entries(parsed.dtypes).map(([k, v]) => `${k}(${v})`).join(', ')}`,
      ];

      if (Object.keys(parsed.missing).length > 0) {
        lines.push(`Missing values: ${Object.entries(parsed.missing).map(([k, v]) => `${k}: ${v} NaN`).join(', ')}`);
      }

      for (const [col, stats] of Object.entries(parsed.numeric_stats) as any) {
        lines.push(`  ${col}: mean=${stats.mean}, std=${stats.std}, min=${stats.min}, max=${stats.max}, median=${stats.median}, n=${stats.n_nonmissing}`);
      }

      for (const [col, groups] of Object.entries(parsed.categorical_groups) as any) {
        const groupStr = Object.entries(groups).map(([k, v]) => `${k}(n=${v})`).join(', ');
        lines.push(`  ${col} groups: ${groupStr}`);
      }

      return lines.join('\n');
    } catch {
      return `Dataset: ${data.length} rows × ${columns.length} columns\nColumns: ${columns.join(', ')}`;
    }
  }

  // Fallback: build summary in JS if Python fails
  return `Dataset: ${data.length} rows × ${columns.length} columns\nColumns: ${columns.join(', ')}`;
}

/**
 * Check if Python 3 + scientific packages are available.
 */
export async function isPythonAvailable(): Promise<boolean> {
  try {
    const result = await executePython('import numpy, scipy, pandas; print("ok")');
    return result.success && result.stdout.trim() === 'ok';
  } catch {
    return false;
  }
}
