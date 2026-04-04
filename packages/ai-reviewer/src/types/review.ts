export type ProviderName = "claude" | "codex" | "gemini";
export type StrictnessLevel = "lenient" | "balanced" | "strict";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Category = "security" | "performance" | "quality" | "best-practice";
export type ReviewDecision = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface ChangedFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface ReviewContext {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
  headSha: string;
  baseRef: string;
  headRef: string;
  author: string;
  changedFiles: ChangedFile[];
  repositoryConfig: ReviewConfig;
}

export interface ReviewFinding {
  provider: ProviderName | "heuristic";
  category: Category;
  severity: Severity;
  title: string;
  summary: string;
  recommendation: string;
  file?: string;
  line?: number;
  labels?: string[];
}

export interface ReviewOutput {
  provider: ProviderName;
  summary: string;
  decisionHint: ReviewDecision;
  findings: ReviewFinding[];
  raw?: unknown;
}

export interface AggregatedReview {
  summary: string;
  decision: ReviewDecision;
  findings: ReviewFinding[];
  providerSummaries: Array<{
    provider: ProviderName | "heuristic";
    summary: string;
  }>;
}

export interface CommentPreferences {
  inline: boolean;
  summary: boolean;
  maxInlineComments: number;
}

export interface ApprovalThresholds {
  blockOnCritical: boolean;
  requestChangesOnHighSeverityCount: number;
}

export interface CustomRule {
  id: string;
  description: string;
  include?: string[];
  pattern?: string;
}

export interface ReviewConfig {
  strictness: StrictnessLevel;
  providers: ProviderName[];
  commentPreferences: CommentPreferences;
  approvalThresholds: ApprovalThresholds;
  customRules: CustomRule[];
}

export interface AnalyzerResult {
  summary: string;
  findings: ReviewFinding[];
}
