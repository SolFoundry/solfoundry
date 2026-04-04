import type { AnalyzerResult, ChangedFile, CustomRule, ReviewFinding } from "../types/review";

function applyCustomRules(files: ChangedFile[], rules: CustomRule[]): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  for (const rule of rules) {
    if (!rule.pattern) {
      continue;
    }

    const regex = new RegExp(rule.pattern, "i");
    for (const file of files) {
      if (regex.test(file.patch ?? "")) {
        findings.push({
          provider: "heuristic",
          category: "best-practice",
          severity: "medium",
          title: `Custom rule matched: ${rule.id}`,
          summary: rule.description,
          recommendation: `Update ${file.filename} to satisfy the ${rule.id} rule.`,
          file: file.filename,
          labels: ["heuristic", "custom-rule", rule.id]
        });
      }
    }
  }

  return findings;
}

export function runQualityAnalyzer(files: ChangedFile[], rules: CustomRule[]): AnalyzerResult {
  const findings: ReviewFinding[] = [];

  for (const file of files) {
    const patch = file.patch ?? "";
    if (/\bconsole\.log\(/.test(patch) || /\bTODO\b/.test(patch) || /\bFIXME\b/.test(patch)) {
      findings.push({
        provider: "heuristic",
        category: "quality",
        severity: "low",
        title: "Debug or placeholder code detected",
        summary: `Review ${file.filename} for leftover debug statements or unfinished work.`,
        recommendation: "Remove temporary statements or convert them into tracked follow-up work before merging.",
        file: file.filename,
        labels: ["heuristic", "quality"]
      });
    }
  }

  findings.push(...applyCustomRules(files, rules));

  return {
    summary: findings.length > 0 ? "Heuristic quality analyzer flagged review items." : "No heuristic quality issues found.",
    findings
  };
}
