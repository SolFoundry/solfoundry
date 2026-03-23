// types/report.ts
// Centralized TypeScript interfaces for compliance report schema

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Platform = "ios" | "android";

export type ReportStatus = "pass" | "fail" | "warning" | "manual_review";

// ─── Compliance Finding ────────────────────────────────────────────────────────

export interface ComplianceFinding {
  id: string;
  title: string;
  severity: Severity;
  policyReference: string;
  policyUrl?: string;
  description: string;
  impact: string;
  evidence: Evidence[];
  status: ReportStatus;
  category: string;
}

export interface Evidence {
  type: "code" | "config" | "metadata" | "screenshot" | "text";
  label: string;
  value: string;
  lineNumber?: number;
  filePath?: string;
}

// ─── Remediation Plan ─────────────────────────────────────────────────────────

export interface RemediationStep {
  order: number;
  description: string;
  codeSnippet?: CodeSnippet;
  configChange?: ConfigChange;
  reference?: string;
}

export interface CodeSnippet {
  language: string;
  before?: string;
  after: string;
  filename?: string;
  explanation?: string;
}

export interface ConfigChange {
  file: string;
  key: string;
  value: string;
  explanation?: string;
}

export interface RemediationPlan {
  findingId: string;
  fixSummary: string;
  estimatedEffort: "low" | "medium" | "high";
  steps: RemediationStep[];
  codeSnippets: CodeSnippet[];
  references: string[];
  acceptanceCriteria: string[];
}

// ─── GitHub Issue ─────────────────────────────────────────────────────────────

export interface GitHubIssue {
  title: string;
  labels: string[];
  context: string;
  description: string;
  fixSteps: string[];
  codeSnippets: CodeSnippet[];
  acceptanceCriteria: string[];
  priority: Severity;
  relatedPolicyUrl?: string;
}

// ─── Full Compliance Report ───────────────────────────────────────────────────

export interface AppMetadata {
  appName: string;
  bundleId?: string;
  packageName?: string;
  version?: string;
  platform: Platform;
  submittedAt: string;
  auditedAt: string;
}

export interface ReportSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  passed: number;
  overallStatus: ReportStatus;
  riskScore: number; // 0–100, higher = riskier
}

export interface ComplianceReport {
  reportId: string;
  platform: Platform;
  metadata: AppMetadata;
  summary: ReportSummary;
  findings: ComplianceFinding[];
  remediationPlans: RemediationPlan[];
  githubIssues: GitHubIssue[];
  generatedAt: string;
  version: string;
}

// ─── iOS-specific ─────────────────────────────────────────────────────────────

export interface IOSAuditInput {
  appName: string;
  bundleId?: string;
  version?: string;
  infoPlist?: Record<string, unknown>;
  entitlements?: Record<string, unknown>;
  sourceFiles?: SourceFile[];
  appStoreMetadata?: AppStoreMetadata;
}

export interface AppStoreMetadata {
  description?: string;
  keywords?: string[];
  privacyPolicyUrl?: string;
  supportUrl?: string;
  marketingUrl?: string;
  ageRating?: string;
  categories?: string[];
}

// ─── Android-specific ────────────────────────────────────────────────────────

export interface AndroidAuditInput {
  appName: string;
  packageName?: string;
  version?: string;
  androidManifest?: Record<string, unknown>;
  gradleConfig?: Record<string, unknown>;
  sourceFiles?: SourceFile[];
  playStoreMetadata?: PlayStoreMetadata;
  dataSafetyForm?: DataSafetyForm;
}

export interface PlayStoreMetadata {
  description?: string;
  shortDescription?: string;
  privacyPolicyUrl?: string;
  contentRating?: string;
  targetAudience?: string[];
  categories?: string[];
}

export interface DataSafetyForm {
  collectsData: boolean;
  sharesData: boolean;
  dataTypes?: DataType[];
  securityPractices?: SecurityPractice[];
}

export interface DataType {
  category: string;
  type: string;
  collected: boolean;
  shared: boolean;
  required: boolean;
  purpose: string[];
}

export interface SecurityPractice {
  practice: string;
  implemented: boolean;
}

export interface SourceFile {
  path: string;
  content: string;
  language?: string;
}

// ─── API Request/Response ─────────────────────────────────────────────────────

export interface AuditRequest {
  platform: Platform;
  input: IOSAuditInput | AndroidAuditInput;
}

export interface AuditResponse {
  success: boolean;
  report?: ComplianceReport;
  error?: string;
}

export interface PDFExportOptions {
  includeEvidence: boolean;
  includeCodeSnippets: boolean;
  includeGitHubIssues: boolean;
  colorMode: "color" | "grayscale";
  paperSize: "A4" | "Letter";
}