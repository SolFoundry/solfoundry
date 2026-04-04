import type { AnalyzerResult, ChangedFile, ReviewFinding } from "../types/review";

const expensivePatterns: Array<{ pattern: RegExp; title: string; severity: "medium" | "high"; recommendation: string }> = [
  {
    pattern: /\bfor\s*\([^)]*\)\s*{[\s\S]{0,250}\bfor\s*\(/,
    title: "Nested loop introduced",
    severity: "medium",
    recommendation: "Confirm the new nested loop is bounded or replace it with indexed lookups."
  },
  {
    pattern: /\bSELECT\s+\*\b/i,
    title: "Broad database query",
    severity: "medium",
    recommendation: "Select only needed columns to reduce I/O and serialization overhead."
  },
  {
    pattern: /\bJSON\.parse\(\s*await\b/,
    title: "Large payload parsing on request path",
    severity: "medium",
    recommendation: "Validate payload size and consider streaming or chunked processing."
  }
];

export function runPerformanceAnalyzer(files: ChangedFile[]): AnalyzerResult {
  const findings: ReviewFinding[] = [];

  for (const file of files) {
    const patch = file.patch ?? "";
    for (const entry of expensivePatterns) {
      if (entry.pattern.test(patch)) {
        findings.push({
          provider: "heuristic",
          category: "performance",
          severity: entry.severity,
          title: entry.title,
          summary: `Potential performance concern in ${file.filename}.`,
          recommendation: entry.recommendation,
          file: file.filename,
          labels: ["heuristic", "performance"]
        });
      }
    }
  }

  return {
    summary: findings.length > 0 ? "Heuristic performance analyzer found review candidates." : "No heuristic performance concerns found.",
    findings
  };
}
