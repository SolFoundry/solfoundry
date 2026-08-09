/**
 * Planner agent — analyzes bounty requirements and generates a structured
 * implementation plan.
 *
 * The planner agent takes a GitHub issue (bounty) and produces a detailed
 * plan with ordered steps, file lists, and risk assessment. This plan
 * guides the implementer agent in producing the correct solution.
 *
 * @module agent/planner
 */

import { BaseAgent } from './agent.js';
import { AgentRole, type BountyCandidate, type ImplementationPlan, type PlanStep } from './types.js';
import type { GitHubBountyIssue } from '../types.js';

/**
 * Input for the planner agent.
 */
export interface PlannerInput {
  /** The bounty candidate to plan for. */
  readonly candidate: BountyCandidate;
  /** The underlying GitHub issue. */
  readonly issue: GitHubBountyIssue;
  /** Repository structure context (list of files/dirs). */
  readonly repoStructure?: string;
}

/**
 * The planner agent analyzes a bounty issue and produces a structured
 * implementation plan with ordered steps, file dependencies, and risk
 * assessment.
 */
export class PlannerAgent extends BaseAgent {
  readonly role = AgentRole.PLANNER;

  /**
   * Execute the planning step.
   *
   * @param input - A PlannerInput object.
   * @returns An ImplementationPlan or null if planning fails.
   */
  async execute(input: unknown): Promise<ImplementationPlan | null> {
    const plannerInput = input as PlannerInput;

    const systemPrompt = this.buildSystemPrompt();
    const userMessage = this.buildUserMessage(plannerInput);

    try {
      const response = await this.complete(systemPrompt, userMessage, {
        maxTokens: 4096,
        temperature: 0.3,
      });

      return this.parseJSON<ImplementationPlan>(response.content);
    } catch (error) {
      // Return a minimal fallback plan if LLM parsing fails
      return this.buildFallbackPlan(plannerInput);
    }
  }

  /**
   * Build the system prompt for the planner agent.
   */
  private buildSystemPrompt(): string {
    return `You are an expert software architect and bounty planner. Your job is to analyze a GitHub bounty issue and produce a structured implementation plan.

Rules:
1. Break the implementation into logical, ordered steps.
2. Each step should be independently testable.
3. Dependencies between steps must be declared.
4. Estimate effort for each step (1-5).
5. Identify any risks or concerns.

Output MUST be valid JSON with this exact structure:
{
  "summary": "One-line summary of the plan",
  "steps": [
    {
      "stepNumber": 1,
      "description": "Description of what to implement",
      "files": ["path/to/file1.ts", "path/to/file2.ts"],
      "effort": 3,
      "dependsOn": []
    }
  ],
  "risks": ["Risk 1", "Risk 2"],
  "totalEffort": 5
}

Respond with ONLY the JSON object, no explanation.`;
  }

  /**
   * Build the user message containing the bounty details.
   */
  private buildUserMessage(input: PlannerInput): string {
    const { issue, candidate, repoStructure } = input;

    return [
      `## Bounty Issue #${issue.number}`,
      `Title: ${issue.title}`,
      `Body:`,
      issue.body,
      '',
      `## Labels: ${issue.labels.join(', ')}`,
      `Complexity: ${candidate.complexity}/10`,
      `Confidence: ${candidate.confidence}`,
      '',
      repoStructure ? `## Repository Structure:\n${repoStructure}` : '',
      '',
      'Generate a detailed implementation plan for this bounty.',
    ].join('\n');
  }

  /**
   * Build a fallback plan when the LLM call fails.
   */
  private buildFallbackPlan(input: PlannerInput): ImplementationPlan {
    const issue = input.issue;
    const title = issue.title.replace(/^[^a-zA-Z]+/, '').trim();

    return {
      summary: `Implement: ${title}`,
      steps: [
        {
          stepNumber: 1,
          description: `Analyze requirements for "${title}"`,
          files: [],
          effort: 1,
          dependsOn: [],
        },
        {
          stepNumber: 2,
          description: `Implement core logic for "${title}"`,
          files: [],
          effort: 3,
          dependsOn: [1],
        },
        {
          stepNumber: 3,
          description: `Add tests for "${title}"`,
          files: [],
          effort: 2,
          dependsOn: [2],
        },
      ],
      risks: ['LLM planning failed — verify plan manually'],
      totalEffort: 6,
    };
  }
}

/**
 * Create a default planner agent.
 *
 * @param provider - LLM provider configuration.
 * @param mockMode - Whether to use mock mode.
 * @returns A configured PlannerAgent.
 */
export function createPlanner(
  provider: import('./types.js').LLMProviderConfig,
  mockMode: boolean = false,
): PlannerAgent {
  return new PlannerAgent(provider, mockMode);
}