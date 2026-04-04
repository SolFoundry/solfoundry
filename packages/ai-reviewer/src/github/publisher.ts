import type { AggregatedReview, ReviewDecision, ReviewFinding } from "../types/review";
import type { InstallationOctokit } from "./client";

function scoreSeverity(finding: ReviewFinding): number {
  switch (finding.severity) {
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

function buildInlineComments(findings: ReviewFinding[], maxInlineComments: number) {
  return findings
    .filter((finding) => finding.file && finding.line)
    .sort((left, right) => scoreSeverity(right) - scoreSeverity(left))
    .slice(0, maxInlineComments)
    .map((finding) => ({
      path: finding.file!,
      line: finding.line!,
      side: "RIGHT" as const,
      body: `**${finding.severity.toUpperCase()} ${finding.category}**\n\n${finding.title}\n\n${finding.summary}\n\nRecommendation: ${finding.recommendation}`
    }));
}

function buildSummary(review: AggregatedReview): string {
  const findings = review.findings
    .slice(0, 20)
    .map((finding) => `- [${finding.severity}] ${finding.category}: ${finding.title}${finding.file ? ` (${finding.file})` : ""}`)
    .join("\n");

  const providerSummaries = review.providerSummaries
    .map((item) => `- ${item.provider}: ${item.summary}`)
    .join("\n");

  return [
    "## AI Code Review",
    "",
    review.summary,
    "",
    "### Provider summaries",
    providerSummaries || "- No provider output available.",
    "",
    "### Findings",
    findings || "- No findings."
  ].join("\n");
}

export async function publishReview(
  octokit: InstallationOctokit,
  context: { owner: string; repo: string; pullNumber: number; headSha: string; inline: boolean; summary: boolean; maxInlineComments: number },
  review: AggregatedReview
) {
  const body = buildSummary(review);
  const event: ReviewDecision = review.decision;
  const comments = context.inline ? buildInlineComments(review.findings, context.maxInlineComments) : [];

  await octokit.rest.pulls.createReview({
    owner: context.owner,
    repo: context.repo,
    pull_number: context.pullNumber,
    commit_id: context.headSha,
    body: context.summary ? body : undefined,
    event,
    comments
  });
}

export async function publishCheckRun(
  octokit: InstallationOctokit,
  context: { owner: string; repo: string; headSha: string },
  review: AggregatedReview
) {
  await octokit.rest.checks.create({
    owner: context.owner,
    repo: context.repo,
    name: "AI Code Review",
    head_sha: context.headSha,
    status: "completed",
    conclusion: review.decision === "REQUEST_CHANGES" ? "action_required" : "success",
    output: {
      title: "AI Code Review",
      summary: review.summary,
      text: review.providerSummaries.map((item) => `${item.provider}: ${item.summary}`).join("\n")
    }
  });
}
