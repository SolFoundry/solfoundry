import type { ReviewContext, ReviewOutput } from "../types/review";

export interface LLMReviewer {
  readonly name: "claude" | "codex" | "gemini";
  isConfigured(): boolean;
  reviewCode(context: ReviewContext): Promise<ReviewOutput | null>;
}

export function buildReviewPrompt(context: ReviewContext): string {
  const files = context.changedFiles.map((file) => [
    `FILE: ${file.filename}`,
    `STATUS: ${file.status}`,
    `ADDITIONS: ${file.additions}`,
    `DELETIONS: ${file.deletions}`,
    file.patch ? `PATCH:\n${file.patch}` : "PATCH: unavailable"
  ].join("\n")).join("\n\n");

  return [
    "Review this pull request for security issues, performance regressions, code quality problems, and best-practice violations.",
    `Strictness: ${context.repositoryConfig.strictness}`,
    `Pull request: ${context.title}`,
    `Description: ${context.body || "No description provided."}`,
    `Branch: ${context.headRef} -> ${context.baseRef}`,
    "Return JSON with keys: summary, decisionHint, findings.",
    "Each finding must contain: category, severity, title, summary, recommendation, file, line, labels.",
    "Only include file and line when grounded in the diff.",
    "Decision hint must be APPROVE, REQUEST_CHANGES, or COMMENT.",
    `Custom rules: ${JSON.stringify(context.repositoryConfig.customRules)}`,
    "",
    files
  ].join("\n");
}

export function normalizeReviewOutput(name: "claude" | "codex" | "gemini", payload: unknown): ReviewOutput {
  const input = (payload ?? {}) as Partial<ReviewOutput>;
  return {
    provider: name,
    summary: typeof input.summary === "string" ? input.summary : `${name} produced a review summary.`,
    decisionHint:
      input.decisionHint === "APPROVE" || input.decisionHint === "REQUEST_CHANGES" || input.decisionHint === "COMMENT"
        ? input.decisionHint
        : "COMMENT",
    findings: Array.isArray(input.findings)
      ? input.findings.map((finding) => ({
          ...finding,
          provider: name
        }))
      : [],
    raw: payload
  };
}

export function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const sanitized = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  return JSON.parse(sanitized);
}
