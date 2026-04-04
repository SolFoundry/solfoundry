import type { AnalyzerResult, ChangedFile, ReviewFinding } from "../types/review";

const riskyPatterns: Array<{ pattern: RegExp; title: string; recommendation: string }> = [
  {
    pattern: /\beval\s*\(/,
    title: "Dynamic code execution detected",
    recommendation: "Remove eval-style execution or replace it with explicit parsing and validation."
  },
  {
    pattern: /(api[_-]?key|secret|token)\s*[:=]\s*['"`][^'"`]{8,}/i,
    title: "Possible hard-coded credential",
    recommendation: "Move credentials to secrets management and scrub them from git history if needed."
  },
  {
    pattern: /SELECT\s+.+\s+FROM\s+.+\+\s*\w+/i,
    title: "Potential SQL injection risk",
    recommendation: "Use parameterized queries instead of string concatenation."
  }
];

export function runSecurityAnalyzer(files: ChangedFile[]): AnalyzerResult {
  const findings: ReviewFinding[] = [];

  for (const file of files) {
    const patch = file.patch ?? "";
    for (const entry of riskyPatterns) {
      if (entry.pattern.test(patch)) {
        findings.push({
          provider: "heuristic",
          category: "security",
          severity: "high",
          title: entry.title,
          summary: `Potential security issue found in ${file.filename}.`,
          recommendation: entry.recommendation,
          file: file.filename,
          labels: ["heuristic", "security"]
        });
      }
    }
  }

  return {
    summary: findings.length > 0 ? "Heuristic security analyzer found suspicious patterns." : "No heuristic security issues found.",
    findings
  };
}
