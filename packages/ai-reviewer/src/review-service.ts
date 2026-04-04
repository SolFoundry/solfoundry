import { runHeuristicAnalyzers } from "./analyzers";
import { buildReviewers } from "./reviewers";
import type { AggregatedReview, ProviderName, ReviewContext, ReviewDecision, ReviewFinding, ReviewOutput } from "./types/review";

function dedupeFindings(findings: ReviewFinding[]): ReviewFinding[] {
  const seen = new Set<string>();
  const result: ReviewFinding[] = [];

  for (const finding of findings) {
    const key = [
      finding.category,
      finding.severity,
      finding.title.toLowerCase(),
      finding.file ?? "",
      finding.line ?? 0
    ].join("|");

    if (!seen.has(key)) {
      seen.add(key);
      result.push(finding);
    }
  }

  return result;
}

function severityRank(severity: ReviewFinding["severity"]): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function deriveDecision(context: ReviewContext, findings: ReviewFinding[], outputs: ReviewOutput[]): ReviewDecision {
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const highCount = findings.filter((finding) => finding.severity === "high").length;
  const requestChangesVotes = outputs.filter((output) => output.decisionHint === "REQUEST_CHANGES").length;
  const approveVotes = outputs.filter((output) => output.decisionHint === "APPROVE").length;

  if (context.repositoryConfig.approvalThresholds.blockOnCritical && criticalCount > 0) {
    return "REQUEST_CHANGES";
  }

  if (highCount >= context.repositoryConfig.approvalThresholds.requestChangesOnHighSeverityCount) {
    return "REQUEST_CHANGES";
  }

  if (requestChangesVotes > approveVotes) {
    return "REQUEST_CHANGES";
  }

  return findings.some((finding) => severityRank(finding.severity) >= 2) ? "COMMENT" : "APPROVE";
}

export async function performReview(context: ReviewContext): Promise<AggregatedReview> {
  const reviewerRegistry = buildReviewers();
  const selectedReviewers = context.repositoryConfig.providers
    .map((name: ProviderName) => reviewerRegistry[name])
    .filter((reviewer) => reviewer && reviewer.isConfigured());

  const llmOutputs = await Promise.all(
    selectedReviewers.map(async (reviewer) => {
      try {
        return await reviewer.reviewCode(context);
      } catch (error) {
        return {
          provider: reviewer.name,
          summary: `${reviewer.name} review failed: ${(error as Error).message}`,
          decisionHint: "COMMENT" as const,
          findings: []
        };
      }
    })
  );

  const heuristicResults = runHeuristicAnalyzers(context);
  const heuristicFindings = heuristicResults.flatMap((result) => result.findings);
  const findings = dedupeFindings([
    ...heuristicFindings,
    ...llmOutputs.filter(Boolean).flatMap((output) => output!.findings)
  ]).sort((left, right) => severityRank(right.severity) - severityRank(left.severity));

  const providerSummaries = [
    ...heuristicResults.map((result) => ({
      provider: "heuristic" as const,
      summary: result.summary
    })),
    ...llmOutputs.filter(Boolean).map((output) => ({
      provider: output!.provider,
      summary: output!.summary
    }))
  ];

  const decision = deriveDecision(context, findings, llmOutputs.filter(Boolean) as ReviewOutput[]);
  const summary = findings.length > 0
    ? `${findings.length} finding(s) detected across heuristic checks and configured LLM reviewers.`
    : "No actionable findings were detected by the configured analyzers and LLM reviewers.";

  return {
    summary,
    decision,
    findings,
    providerSummaries
  };
}
