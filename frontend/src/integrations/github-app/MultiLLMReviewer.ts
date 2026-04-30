/**
 * MultiLLMReviewer — Multi-LLM review pipeline for the AI Code Review GitHub App.
 *
 * Orchestrates code reviews across multiple LLM providers (Claude, Codex, Gemini),
 * aggregates their feedback, and produces a unified review output.
 *
 * LLM calls are mocked for now; the interface is designed for easy integration
 * with actual provider APIs.
 *
 * @module integrations/github-app/MultiLLMReviewer
 */

import type { ReviewConfig, LLMProvider, LLMProviderConfig } from './ReviewConfig';

/**
 * A single review finding from an LLM provider.
 */
export interface ReviewFinding {
  /** Unique finding identifier */
  id: string;
  /** Source LLM provider */
  provider: LLMProvider;
  /** Severity: 'critical' | 'high' | 'medium' | 'low' | 'info' */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** File path the finding relates to */
  filePath: string;
  /** Line number (1-indexed, 0 for file-level findings) */
  line: number;
  /** Short title of the finding */
  title: string;
  /** Detailed description of the finding */
  description: string;
  /** Suggested fix or improvement */
  suggestion: string;
  /** Category of the finding */
  category: 'security' | 'bug' | 'performance' | 'style' | 'architecture' | 'documentation' | 'testing';
}

/**
 * Aggregated review result from all LLM providers.
 */
export interface ReviewResult {
  /** Unique review identifier */
  id: string;
  /** PR number being reviewed */
  prNumber: number;
  /** Repository full name */
  repository: string;
  /** List of all findings from all providers */
  findings: ReviewFinding[];
  /** Per-provider results */
  providerResults: ProviderReviewResult[];
  /** Overall summary of the review */
  summary: string;
  /** Whether the review passed (no critical/high findings) */
  passed: boolean;
  /** Timestamps */
  startedAt: string;
  completedAt: string;
}

/**
 * Result from a single LLM provider.
 */
export interface ProviderReviewResult {
  /** Provider name */
  provider: LLMProvider;
  /** Model used */
  model: string;
  /** Findings from this provider */
  findings: ReviewFinding[];
  /** Whether the provider completed successfully */
  success: boolean;
  /** Error message if the provider failed */
  error?: string;
  /** Response time in milliseconds */
  durationMs: number;
}

/**
 * Input for a code review request.
 */
export interface ReviewInput {
  /** PR number */
  prNumber: number;
  /** Repository full name (owner/repo) */
  repository: string;
  /** PR title */
  prTitle: string;
  /** PR body/description */
  prBody: string;
  /** List of changed files with their diffs */
  changedFiles: ChangedFile[];
  /** Base branch name */
  baseBranch: string;
  /** Head branch name */
  headBranch: string;
}

/**
 * A changed file with its diff content.
 */
export interface ChangedFile {
  /** File path */
  path: string;
  /** Diff content (unified diff format) */
  diff: string;
  /** Number of added lines */
  additions: number;
  /** Number of deleted lines */
  deletions: number;
  /** File status: 'added' | 'modified' | 'removed' | 'renamed' */
  status: 'added' | 'modified' | 'removed' | 'renamed';
}

/**
 * Mock LLM response generator for development/testing.
 * In production, this would be replaced with actual API calls.
 */
async function mockLLMCall(
  providerConfig: LLMProviderConfig,
  input: ReviewInput,
): Promise<{ findings: ReviewFinding[]; summary: string }> {
  const { provider, model } = providerConfig;

  // Simulate API latency (100-500ms)
  const latency = Math.floor(Math.random() * 400) + 100;
  await new Promise((resolve) => setTimeout(resolve, latency));

  const findings: ReviewFinding[] = [];
  let findingId = 0;

  // Generate mock findings based on file changes
  for (const file of input.changedFiles) {
    if (file.status === 'removed') continue;

    // Security scan
    if (file.diff.includes('eval(') || file.diff.includes('exec(') || file.diff.includes('innerHTML')) {
      findings.push({
        id: `finding_${provider}_${++findingId}`,
        provider,
        severity: 'critical',
        filePath: file.path,
        line: findLineInDiff(file.diff, 'eval') || findLineInDiff(file.diff, 'exec') || findLineInDiff(file.diff, 'innerHTML') || 1,
        title: 'Potential code injection vulnerability',
        description: `Detected use of ${file.diff.includes('eval(') ? 'eval()' : file.diff.includes('exec(') ? 'exec()' : 'innerHTML'} which can lead to code injection attacks.`,
        suggestion: 'Use safe alternatives like JSON.parse() for data parsing, or sanitize input before using innerHTML.',
        category: 'security',
      });
    }

    // Error handling
    if (file.diff.includes('catch') && file.diff.includes('pass') || file.diff.includes('catch') && file.diff.includes('// TODO')) {
      findings.push({
        id: `finding_${provider}_${++findingId}`,
        provider,
        severity: 'high',
        filePath: file.path,
        line: findLineInDiff(file.diff, 'catch') || 1,
        title: 'Empty error handling',
        description: 'Error is caught but not properly handled. Silent failures can lead to data corruption or unexpected behavior.',
        suggestion: 'Log the error and handle it appropriately. Consider re-throwing if the error is unrecoverable.',
        category: 'bug',
      });
    }

    // Performance
    if (file.diff.includes('SELECT *') || file.diff.includes('find(')) {
      findings.push({
        id: `finding_${provider}_${++findingId}`,
        provider,
        severity: 'medium',
        filePath: file.path,
        line: findLineInDiff(file.diff, 'SELECT') || findLineInDiff(file.diff, 'find(') || 1,
        title: 'Potential performance issue',
        description: 'Consider optimizing this query/call. Fetching all fields or loading all records may impact performance at scale.',
        suggestion: 'Use specific field selection and add pagination/limit clauses.',
        category: 'performance',
      });
    }

    // Style
    if (file.diff.includes('console.log')) {
      findings.push({
        id: `finding_${provider}_${++findingId}`,
        provider,
        severity: 'low',
        filePath: file.path,
        line: findLineInDiff(file.diff, 'console.log') || 1,
        title: 'Debug logging in production code',
        description: 'console.log statements should be removed or replaced with a proper logging framework before merging.',
        suggestion: 'Use a structured logger (e.g., winston, pino) with appropriate log levels.',
        category: 'style',
      });
    }
  }

  // Generate summary
  const totalLines = input.changedFiles.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const summary = `[${provider.toUpperCase()}] Reviewed ${input.changedFiles.length} files (${totalLines} lines changed). ` +
    `Found ${findings.length} issues: ${findings.filter(f => f.severity === 'critical').length} critical, ` +
    `${findings.filter(f => f.severity === 'high').length} high, ${findings.filter(f => f.severity === 'medium').length} medium, ` +
    `${findings.filter(f => f.severity === 'low').length} low, ${findings.filter(f => f.severity === 'info').length} info.`;

  return { findings, summary };
}

/**
 * Find a line number in a unified diff that contains a given pattern.
 */
function findLineInDiff(diff: string, pattern: string): number {
  const lines = diff.split('\n');
  let lineNumber = 0;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) lineNumber = parseInt(match[1], 10) - 1;
    } else if (line.startsWith('+') && line.includes(pattern)) {
      return lineNumber;
    } else if (!line.startsWith('-')) {
      lineNumber++;
    }
  }
  return 0;
}

/**
 * Aggregate findings from multiple providers, deduplicating similar findings.
 */
function aggregateFindings(allProviderFindings: ReviewFinding[]): ReviewFinding[] {
  const aggregated = new Map<string, ReviewFinding>();

  for (const finding of allProviderFindings) {
    // Create a dedup key based on file, category, and title similarity
    const dedupKey = `${finding.filePath}:${finding.category}:${finding.title}`;

    if (aggregated.has(dedupKey)) {
      // If we already have this finding, note additional providers
      const existing = aggregated.get(dedupKey)!;
      if (!existing.provider.includes(finding.provider)) {
        // Keep the more severe finding
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        if (severityOrder[finding.severity] < severityOrder[existing.severity]) {
          aggregated.set(dedupKey, finding);
        }
      }
    } else {
      aggregated.set(dedupKey, finding);
    }
  }

  // Sort by severity (critical first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return Array.from(aggregated.values()).sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
}

/**
 * Generate a unified review summary from aggregated findings.
 */
function generateSummary(
  findings: ReviewFinding[],
  input: ReviewInput,
  providerResults: ProviderReviewResult[],
): string {
  const totalChanges = input.changedFiles.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;

  const providersUsed = providerResults.filter((r) => r.success).map((r) => r.provider).join(', ');
  const avgDuration = providerResults.filter((r) => r.success).reduce((sum, r) => sum + r.durationMs, 0) /
    Math.max(1, providerResults.filter((r) => r.success).length);

  let summary = `## 🤖 AI Code Review Summary\n\n`;
  summary += `**PR:** ${input.prTitle} (#${input.prNumber})\n`;
  summary += `**Scope:** ${input.changedFiles.length} files, ${totalChanges} lines changed\n`;
  summary += `**Providers:** ${providersUsed}\n`;
  summary += `**Avg Review Time:** ${Math.round(avgDuration)}ms\n\n`;

  summary += `### Findings\n\n`;
  summary += `| Severity | Count |\n|----------|-------|\n`;
  summary += `| 🔴 Critical | ${criticalCount} |\n`;
  summary += `| 🟠 High | ${highCount} |\n`;
  summary += `| 🟡 Medium | ${mediumCount} |\n`;
  summary += `| 🔵 Low | ${lowCount} |\n`;
  summary += `| ⚪ Info | ${findings.filter((f) => f.severity === 'info').length} |\n`;
  summary += `| **Total** | **${findings.length}** |\n`;

  if (criticalCount > 0 || highCount > 0) {
    summary += `\n### ⚠️ Action Required\n\n`;
    summary += `This PR has **${criticalCount + highCount}** critical/high severity findings that should be addressed before merging.\n`;
  } else if (findings.length > 0) {
    summary += `\n### ✅ Looks Good\n\n`;
    summary += `No critical or high severity issues found. ${mediumCount + lowCount} suggestions for improvement.\n`;
  } else {
    summary += `\n### ✅ Clean\n\n`;
    summary += `No issues found. This PR looks ready to merge!\n`;
  }

  return summary;
}

/**
 * MultiLLMReviewer — Orchestrates code reviews across multiple LLM providers.
 */
export class MultiLLMReviewer {
  /**
   * Run a code review using all enabled LLM providers.
   * @param input - The review input containing PR and file change data
   * @param config - Review configuration
   * @returns Aggregated review result
   */
  async review(input: ReviewInput, config: ReviewConfig): Promise<ReviewResult> {
    const startedAt = new Date().toISOString();
    const reviewId = `review_${Date.now()}_${input.prNumber}`;

    // Filter to enabled providers
    const enabledProviders = config.providers.filter((p) => p.enabled);
    if (enabledProviders.length === 0) {
      throw new Error('No LLM providers are enabled for review');
    }

    // Run reviews in parallel across all providers
    const providerPromises = enabledProviders.map(async (providerConfig) => {
      const providerStart = Date.now();
      try {
        const result = await mockLLMCall(providerConfig, input);
        const durationMs = Date.now() - providerStart;

        return {
          provider: providerConfig.provider,
          model: providerConfig.model,
          findings: result.findings,
          success: true,
          durationMs,
        } as ProviderReviewResult;
      } catch (error) {
        const durationMs = Date.now() - providerStart;
        return {
          provider: providerConfig.provider,
          model: providerConfig.model,
          findings: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs,
        } as ProviderReviewResult;
      }
    });

    const providerResults = await Promise.all(providerPromises);

    // Aggregate all findings
    const allFindings = providerResults
      .filter((r) => r.success)
      .flatMap((r) => r.findings);
    const aggregatedFindings = aggregateFindings(allFindings);

    // Generate summary
    const summary = generateSummary(aggregatedFindings, input, providerResults);

    const completedAt = new Date().toISOString();

    return {
      id: reviewId,
      prNumber: input.prNumber,
      repository: input.repository,
      findings: aggregatedFindings,
      providerResults,
      summary,
      passed: aggregatedFindings.filter(
        (f) => f.severity === 'critical' || f.severity === 'high',
      ).length === 0,
      startedAt,
      completedAt,
    };
  }

  /**
   * Generate inline comments for a review result.
   * @param result - The aggregated review result
   * @param commentPreference - Whether to post inline, summary, or both
   * @returns Formatted comments
   */
  formatComments(
    result: ReviewResult,
    commentPreference: 'inline' | 'summary' | 'both',
  ): { inline: InlineComment[]; summary: string } {
    const inline: InlineComment[] = [];

    if (commentPreference === 'inline' || commentPreference === 'both') {
      for (const finding of result.findings) {
        if (finding.line > 0) {
          inline.push({
            path: finding.filePath,
            line: finding.line,
            body: this.formatInlineComment(finding),
          });
        }
      }
    }

    const summary = commentPreference === 'summary' || commentPreference === 'both'
      ? result.summary
      : '';

    return { inline, summary };
  }

  /**
   * Format a single inline comment for a finding.
   */
  private formatInlineComment(finding: ReviewFinding): string {
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: '⚪',
    }[finding.severity];

    return `${severityEmoji} **[${finding.category.toUpperCase()}] ${finding.title}**\n\n${finding.description}\n\n💡 **Suggestion:** ${finding.suggestion}`;
  }
}

/**
 * An inline comment to be posted on a PR.
 */
export interface InlineComment {
  /** File path */
  path: string;
  /** Line number */
  line: number;
  /** Comment body (Markdown) */
  body: string;
}

// Export singleton instance
export const multiLLMReviewer = new MultiLLMReviewer();
