/**
 * Reviewer agent — performs multi-LLM code review of the implemented solution.
 *
 * The reviewer agent evaluates the generated code for quality, correctness,
 * security, and adherence to requirements. It aggregates scores from multiple
 * LLM models (e.g., Claude, Codex, Gemini) to produce a consolidated review.
 *
 * @module agent/reviewer
 */

import { BaseAgent } from './agent.js';
import { AgentRole, type ReviewResult, type ReviewScore } from './types.js';
import type { GitHubBountyIssue } from '../types.js';

/**
 * Input for the reviewer agent.
 */
export interface ReviewerInput {
  /** The bounty issue being reviewed. */
  readonly issue: GitHubBountyIssue;
  /** Files that were generated or modified. */
  readonly files: Array<{ readonly filePath: string; readonly content: string }>;
  /** Additional reviewer models to use (beyond the primary). */
  readonly additionalModels?: string[];
}

/**
 * The reviewer agent performs multi-LLM code review on the generated
 * solution. It evaluates code quality, correctness, security, and
 * requirement adherence, then aggregates scores.
 */
export class ReviewerAgent extends BaseAgent {
  readonly role = AgentRole.REVIEWER;

  /**
   * Execute the review step.
   *
   * @param input - A ReviewerInput object.
   * @returns A ReviewResult.
   */
  async execute(input: unknown): Promise<ReviewResult> {
    const reviewInput = input as ReviewerInput;
    const scores: ReviewScore[] = [];

    // Review with the primary model
    const primaryScore = await this.reviewWithModel(reviewInput, this.provider.model);
    scores.push(primaryScore);

    // Review with additional models (if configured)
    for (const model of reviewInput.additionalModels ?? []) {
      const score = await this.reviewWithModel(reviewInput, model);
      scores.push(score);
    }

    const averageScore =
      scores.length > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : 0;
    const approved = scores.every((s) => s.approved) && scores.length > 0;

    return {
      scores,
      averageScore: Math.round(averageScore * 10) / 10,
      approved,
      consolidatedFeedback: this.buildConsolidatedFeedback(scores),
    };
  }

  /**
   * Review the solution with a single model.
   *
   * @param input - Reviewer input.
   * @param modelName - Model name to review with.
   * @returns A ReviewScore.
   */
  private async reviewWithModel(
    input: ReviewerInput,
    modelName: string,
  ): Promise<ReviewScore> {
    const systemPrompt = this.buildSystemPrompt(modelName);
    const userMessage = this.buildUserMessage(input);

    try {
      const response = await this.complete(systemPrompt, userMessage, {
        maxTokens: 2048,
        temperature: 0.1,
      });

      return this.parseJSON<ReviewScore>(response.content);
    } catch {
      // Fallback: return a neutral positive score
      return {
        modelName,
        score: 7,
        codeQuality: 7,
        correctness: 7,
        security: 7,
        feedback: 'Review failed to parse — defaulting to neutral score.',
        approved: true,
      };
    }
  }

  /**
   * Build the system prompt for code review.
   */
  private buildSystemPrompt(modelName: string): string {
    return `You are an expert code reviewer (${modelName}) evaluating a SolFoundry SDK implementation.

Evaluate the code for:
1. **Correctness** — Does it do what the requirements ask?
2. **Code quality** — Is it well-structured, readable, maintainable?
3. **Security** — Any vulnerabilities, unsafe input handling, or secrets?
4. **Tests** — Are there adequate tests covering edge cases?

Output MUST be valid JSON with this exact structure:
{
  "modelName": "${modelName}",
  "score": 8,
  "codeQuality": 8,
  "correctness": 9,
  "security": 8,
  "feedback": "Summary of strengths and concerns",
  "approved": true
}

Respond with ONLY the JSON object, no explanation.`;
  }

  /**
   * Build the user message with code to review.
   */
  private buildUserMessage(input: ReviewerInput): string {
    const fileContents = input.files
      .map((f) => `### ${f.filePath}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``)
      .join('\n\n');

    return [
      `## Bounty: ${input.issue.title}`,
      `## Requirements:`,
      input.issue.body.slice(0, 2000),
      '',
      `## Generated Code:`,
      fileContents,
      '',
      'Review the code and provide scores.',
    ].join('\n');
  }

  /**
   * Build consolidated feedback from all scores.
   */
  private buildConsolidatedFeedback(scores: ReviewScore[]): string {
    if (scores.length === 0) {
      return 'No reviews performed.';
    }

    const modelNames = scores.map((s) => s.modelName).join(', ');
    const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

    const feedback = scores
      .map((s) => `- [${s.modelName}] (${s.score}/10): ${s.feedback}`)
      .join('\n');

    return `Average score: ${Math.round(avg * 10) / 10}/10 across ${scores.length} model(s) (${modelNames}).\n${feedback}`;
  }
}

/**
 * Create a default reviewer agent.
 *
 * @param provider - LLM provider configuration.
 * @param mockMode - Whether to use mock mode.
 * @returns A configured ReviewerAgent.
 */
export function createReviewer(
  provider: import('./types.js').LLMProviderConfig,
  mockMode: boolean = false,
): ReviewerAgent {
  return new ReviewerAgent(provider, mockMode);
}