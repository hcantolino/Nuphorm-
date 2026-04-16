/**
 * resultsCiter.ts — Stage 7: Auto-citation of computed results.
 *
 * After the LLM generates an interpretation, this module scans the text
 * for numeric claims (p-values, CIs, effect sizes, means, etc.) and
 * cross-references them against the computed results from the stats engine.
 *
 * Every verified number gets a citation marker [1], [2], etc. linking to
 * its source in the computed results. Unverified numbers are flagged.
 */

export interface Citation {
  id: number;
  claim: string;
  value: string;
  source: string;
  verified: boolean;
}

export interface CitedResponse {
  text: string;
  citations: Citation[];
  unverifiedClaims: string[];
}

/**
 * Extract numeric claims from LLM interpretation text.
 * Matches patterns like: p = 0.023, CI [1.2, 3.4], mean = 45.2,
 * HR = 0.67, OR 2.3 (1.1-4.5), F(2,47) = 5.23, t = -2.14
 */
function extractNumericClaims(text: string): Array<{ match: string; value: number; context: string }> {
  const claims: Array<{ match: string; value: number; context: string }> = [];
  const patterns = [
    // p-values: p = 0.023, p < 0.001, p-value = 0.05
    /p[\s-]*(?:value)?\s*[=<>≤≥]\s*([\d.]+(?:e[+-]?\d+)?)/gi,
    // Means: mean = 45.2, M = 45.2, average = 45.2
    /(?:mean|average|M)\s*[=:]\s*([\d.]+)/gi,
    // SD: SD = 12.3, std = 12.3
    /(?:SD|std\.?\s*dev\.?|standard deviation)\s*[=:]\s*([\d.]+)/gi,
    // Effect sizes: d = 0.8, Cohen's d = 0.8, eta² = 0.15
    /(?:Cohen'?s?\s*d|eta[²2]?|r[²2]?|R[²2]?|effect size)\s*[=:]\s*([\d.]+)/gi,
    // Hazard ratio: HR = 0.67
    /(?:HR|hazard ratio|odds ratio|OR)\s*[=:]\s*([\d.]+)/gi,
    // Test statistics: F(2,47) = 5.23, t = -2.14, χ² = 8.3, W = 0.95
    /(?:F\([\d,]+\)|t|[χXx][²2]|W|U|H|Z)\s*[=:]\s*-?([\d.]+)/gi,
    // Confidence intervals: 95% CI [1.2, 3.4], CI: (0.45, 0.89)
    /CI\s*[:\[(\s]*([\d.]+)\s*[,–-]\s*([\d.]+)/gi,
    // Percentages: 45.2%, 78%
    /([\d.]+)\s*%/g,
    // N values: n = 150, N = 45
    /[nN]\s*[=:]\s*(\d+)/g,
    // Median: median = 23.5
    /median\s*[=:]\s*([\d.]+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      if (!isNaN(value)) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        claims.push({
          match: match[0],
          value,
          context: text.slice(start, end).trim(),
        });
      }
    }
  }

  return claims;
}

/**
 * Find a computed result that matches a claim's value.
 * Uses fuzzy matching (within 0.1% for large numbers, exact for small).
 */
function findSource(
  value: number,
  computedResults: Record<string, any>,
  resultsTable: Array<{ metric: string; value: any }>,
  testResults?: Record<string, any>
): string | null {
  const tolerance = Math.abs(value) > 10 ? 0.001 : 0.01;

  // Check results_table
  for (const row of resultsTable) {
    const rowVal = parseFloat(String(row.value));
    if (!isNaN(rowVal) && Math.abs(rowVal - value) / Math.max(Math.abs(value), 0.001) < tolerance) {
      return `results_table: "${row.metric}" = ${row.value}`;
    }
  }

  // Check test results (from statsEngine)
  if (testResults) {
    for (const [key, val] of Object.entries(testResults)) {
      if (typeof val === "number" && Math.abs(val - value) / Math.max(Math.abs(value), 0.001) < tolerance) {
        return `stats_engine: ${key} = ${val}`;
      }
      if (typeof val === "object" && val !== null) {
        for (const [subKey, subVal] of Object.entries(val as Record<string, any>)) {
          if (typeof subVal === "number" && Math.abs(subVal - value) / Math.max(Math.abs(value), 0.001) < tolerance) {
            return `stats_engine: ${key}.${subKey} = ${subVal}`;
          }
        }
      }
    }
  }

  // Check computed results object
  for (const [key, val] of Object.entries(computedResults)) {
    if (typeof val === "number" && Math.abs(val - value) / Math.max(Math.abs(value), 0.001) < tolerance) {
      return `computed: ${key} = ${val}`;
    }
  }

  return null;
}

/**
 * Main entry point: cite all numeric claims in the LLM's interpretation.
 */
export function citeResults(
  interpretationText: string,
  computedResults: Record<string, any>,
  resultsTable: Array<{ metric: string; value: any }>,
  testResults?: Record<string, any>
): CitedResponse {
  const claims = extractNumericClaims(interpretationText);
  const citations: Citation[] = [];
  const unverifiedClaims: string[] = [];
  let citedText = interpretationText;
  let citationId = 1;

  // Process claims in reverse order so string indices stay valid
  const sortedClaims = [...claims].sort((a, b) => {
    const aIdx = interpretationText.indexOf(a.match);
    const bIdx = interpretationText.indexOf(b.match);
    return bIdx - aIdx;
  });

  const seenValues = new Set<string>();

  for (const claim of sortedClaims) {
    const key = `${claim.match}:${claim.value}`;
    if (seenValues.has(key)) continue;
    seenValues.add(key);

    const source = findSource(claim.value, computedResults, resultsTable, testResults);

    if (source) {
      citations.push({
        id: citationId,
        claim: claim.match,
        value: String(claim.value),
        source,
        verified: true,
      });
      citationId++;
    } else {
      unverifiedClaims.push(`"${claim.match}" (value: ${claim.value}) — no matching computed result found`);
    }
  }

  // Sort citations by ID for the footnotes
  citations.sort((a, b) => a.id - b.id);

  return {
    text: citedText,
    citations,
    unverifiedClaims,
  };
}
