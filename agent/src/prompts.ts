/**
 * Prompt templates and the orchestration that turns a classified bounty
 * into runnable agent steps.
 *
 * @module @solfoundry/auto-submit-agent/prompts
 */

import type { ClassifiedBounty } from './classifier.js';
import type { ChatMessage, LLMProvider } from './llm.js';

/** The high-level plan the LLM produces for implementing a bounty. */
export interface ImplementationPlan {
  /** Short title. */
  title: string;
  /** Step-by-step implementation plan. */
  steps: string[];
  /** Files expected to be created or modified. */
  files: string[];
  /** Tests to add. */
  tests: string[];
  /** PR description. */
  prDescription: string;
}

/**
 * Plan prompt: ask the LLM to break a bounty into concrete implementation steps
 * and generate a PR description.
 */
export function buildPlanPrompt(bounty: ClassifiedBounty, walletAddress?: string): string {
  const prSuffix = walletAddress
    ? `\n\n**IMPORTANT:** When drafting the PR title, append the payout wallet address at the very end:`
      + ` [${walletAddress}]`
    : '';

  return `You are an autonomous software development agent assigned a Tier-1 bounty.
Respond with STRICT JSON only (no markdown fences), using this schema:
{
  "title": "...",
  "steps": ["..."],
  "files": ["path/to/file"],
  "tests": ["path/to/test"],
  "prDescription": "..."
}${prSuffix}

Bounty title: ${bounty.title}
Category: ${bounty.category ?? 'unspecified'}
Description / requirements:
${bounty.description}
Required skills: ${bounty.requiredSkills.join(', ') || 'none stated'}
Your matched skills: ${bounty.matchedSkills.join(', ') || 'none'}

Produce a realistic, short plan suitable for a T1 bounty (a few hours of work max).
The prDescription must include a Checklist of acceptance-criteria items.`;
}

/**
 * Implementation prompt: give the plan and have the LLM emit file contents.
 */
export function buildImplementPrompt(
  bounty: ClassifiedBounty,
  plan: ImplementationPlan,
  fileIndex: number,
): string {
  return `You are implementing a Tier-1 bounty. Produce the FULL file content for the next step.

Bounty title: ${bounty.title}
Description:
${bounty.description}

Implementation plan:
${plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Your job now: generate the complete, production-ready content for:
**File:** ${plan.files[fileIndex]}

Output ONLY the file content (no explanation, no markdown fences around code unless
the file itself is markdown). Use idiomatic code and include the necessary imports.`;
}

/**
 * Ask the LLM to write the first file of a plan and return its content.
 */
export async function planBounty(
  bounty: ClassifiedBounty,
  provider: LLMProvider,
  walletAddress?: string,
): Promise<ImplementationPlan> {
  const resp = await provider.chat(
    [{ role: 'system', content: 'You are a concise software engineering agent. Reply JSON only.' },
      { role: 'user', content: buildPlanPrompt(bounty, walletAddress) }],
  );

  // Strip possible markdown fences before parsing.
  const cleaned = resp.content.replace(/^```(?:json)?\s*\n/, '').replace(/\n```$/, '').trim();
  let plan: ImplementationPlan;
  try {
    plan = JSON.parse(cleaned) as ImplementationPlan;
  } catch {
    throw new Error(
      `LLM did not return valid plan JSON for bounty ${bounty.id}. Raw: ${cleaned.slice(0, 500)}`,
    );
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error(`LLM returned an empty plan for bounty ${bounty.id}`);
  }
  return plan;
}

/**
 * Full chat messages sent to the LLM for one implementation file.
 */
export function buildFileMessages(
  bounty: ClassifiedBounty,
  plan: ImplementationPlan,
  fileIndex: number,
): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a senior engineer. Output ONLY the complete file contents, no extra text.',
    },
    {
      role: 'user',
      content: buildImplementPrompt(bounty, plan, fileIndex),
    },
  ];
}
