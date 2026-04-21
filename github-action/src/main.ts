/**
 * SolFoundry Bounty Creator - GitHub Action
 *
 * Automatically converts labeled GitHub issues into SolFoundry bounties
 * with customizable reward amounts, tiers, and deadlines.
 *
 * Features:
 * - Label-triggered bounty auto-posting
 * - Configurable reward tiers (T1/T2/T3) via labels
 * - Skill extraction from issue labels
 * - Dry-run mode for testing
 * - Automatic comment on issue with bounty link
 * - Support for custom reward amounts via issue body
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { GitHubContext, BountyPayload, BountyResponse, TierConfig, ActionOutput } from './types';

// ============================================================
// Configuration
// ============================================================

const DEFAULT_TIERS: Record<string, TierConfig> = {
  T1: { label: 'tier-1', reward: 500000, description: 'Simple fix or documentation' },
  T2: { label: 'tier-2', reward: 500000, description: 'Feature implementation' },
  T3: { label: 'tier-3', reward: 1000000, description: 'Complex feature or integration' },
};

const BOUNTY_LABEL_PREFIX = 'bounty';
const TIER_LABEL_REGEX = /^tier-(\d)$/i;
const REWARD_REGEX = /(?:reward|bounty|💰)[:\s]*(\d+(?:,\d+)*)\s*(?:FNDRY|USDC)?/i;
const SKILL_LABELS = ['frontend', 'backend', 'docs', 'creative', 'integration', 'agent', 'marketplace'];

// ============================================================
// Main Action
// ============================================================

async function run(): Promise<void> {
  try {
    const ctx = extractContext();
    core.info(`🎯 Processing issue #${ctx.issueNumber}: ${ctx.issueTitle}`);

    if (!shouldCreateBounty(ctx)) {
      core.info('⏭️ Skipping: issue does not match bounty criteria');
      setOutputs({ bountyId: '', bountyUrl: '', status: 'skipped' });
      return;
    }

    const payload = buildBountyPayload(ctx);
    core.info(`📋 Bounty payload: ${JSON.stringify(payload, null, 2)}`);

    if (ctx.dryRun) {
      core.info('🏃 Dry-run mode: would create the following bounty:');
      core.info(JSON.stringify(payload, null, 2));
      setOutputs({ bountyId: 'dry-run', bountyUrl: '', status: 'success' });
      return;
    }

    const result = await createBounty(ctx, payload);

    if (result.id) {
      core.info(`✅ Bounty created: ${result.id}`);
      await postComment(ctx, result);
      setOutputs({
        bountyId: result.id,
        bountyUrl: `https://solfoundry.com/bounties/${result.id}`,
        status: 'success',
      });
    } else {
      core.warning(`⚠️ Bounty creation returned no ID`);
      setOutputs({ bountyId: '', bountyUrl: '', status: 'failed' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${msg}`);
    setOutputs({ bountyId: '', bountyUrl: '', status: 'failed' });
  }
}

// ============================================================
// Context Extraction
// ============================================================

function extractContext(): GitHubContext {
  const issue = github.context.payload.issue;
  if (!issue) {
    throw new Error('No issue found in payload. This action must run on issue events.');
  }

  const labels: string[] = (issue.labels || []).map(
    (l: { name: string } | string) => typeof l === 'string' ? l : l.name
  );

  const repoFullName = github.context.payload.repository?.full_name || '';
  const [orgName, repoName] = repoFullName.split('/');

  return {
    issueNumber: issue.number,
    issueTitle: issue.title || '',
    issueBody: issue.body || '',
    issueUrl: issue.html_url || '',
    issueLabels: labels,
    orgName: orgName || '',
    repoName: repoName || '',
    repoUrl: github.context.payload.repository?.html_url || '',
    solfoundryApiUrl: core.getInput('solfoundry-api-url') || 'https://solfoundry.com/api',
    apiKey: core.getInput('api-key', { required: true }),
    bountyLabel: core.getInput('bounty-label') || 'bounty',
    defaultRewardAmount: parseInt(core.getInput('reward-amount') || '100000', 10),
    defaultRewardToken: (core.getInput('reward-token') || 'FNDRY') as 'FNDRY' | 'USDC',
    defaultTier: (core.getInput('tier') || 'T2') as 'T1' | 'T2' | 'T3',
    deadlineDays: parseInt(core.getInput('deadline-days') || '30', 10),
    dryRun: core.getInput('dry-run') === 'true',
  };
}

// ============================================================
// Bounty Logic
// ============================================================

function shouldCreateBounty(ctx: GitHubContext): boolean {
  const hasBountyLabel = ctx.issueLabels.some(
    (l) => l.toLowerCase() === ctx.bountyLabel.toLowerCase()
  );
  const hasBountyPrefix = ctx.issueLabels.some(
    (l) => l.toLowerCase().startsWith(BOUNTY_LABEL_PREFIX)
  );
  return hasBountyLabel || hasBountyPrefix;
}

function buildBountyPayload(ctx: GitHubContext): BountyPayload {
  // Determine tier from labels
  const tier = detectTier(ctx);

  // Determine reward amount
  const rewardAmount = detectRewardAmount(ctx, tier);

  // Extract skills from labels
  const skills = extractSkills(ctx);

  // Build description with original issue link
  const description = buildDescription(ctx);

  // Calculate deadline
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + ctx.deadlineDays);
  const deadlineStr = deadline.toISOString().split('T')[0];

  return {
    title: ctx.issueTitle,
    description,
    reward_amount: rewardAmount,
    reward_token: ctx.defaultRewardToken,
    tier,
    skills,
    deadline: deadlineStr,
    github_repo_url: ctx.repoUrl,
    github_issue_url: ctx.issueUrl,
  };
}

function detectTier(ctx: GitHubContext): 'T1' | 'T2' | 'T3' {
  for (const label of ctx.issueLabels) {
    const match = label.match(TIER_LABEL_REGEX);
    if (match) {
      const tierNum = parseInt(match[1], 10);
      if (tierNum >= 1 && tierNum <= 3) {
        return `T${tierNum}` as 'T1' | 'T2' | 'T3';
      }
    }
  }
  return ctx.defaultTier;
}

function detectRewardAmount(ctx: GitHubContext, tier: 'T1' | 'T2' | 'T3'): number {
  // Check issue body for explicit reward amount
  const bodyMatch = ctx.issueBody.match(REWARD_REGEX);
  if (bodyMatch) {
    const amount = parseInt(bodyMatch[1].replace(/,/g, ''), 10);
    if (amount > 0) return amount;
  }

  // Check labels for reward amount
  for (const label of ctx.issueLabels) {
    const rewardMatch = label.match(/reward-(\d+)k?/i);
    if (rewardMatch) {
      const amount = parseInt(rewardMatch[1], 10);
      return label.toLowerCase().includes('k') ? amount * 1000 : amount;
    }
  }

  // Use tier default
  return DEFAULT_TIERS[tier]?.reward || ctx.defaultRewardAmount;
}

function extractSkills(ctx: GitHubContext): string[] {
  const skills: string[] = [];
  for (const label of ctx.issueLabels) {
    const normalized = label.toLowerCase();
    if (SKILL_LABELS.includes(normalized)) {
      skills.push(normalized);
    }
  }
  return skills.length > 0 ? skills : ['integration'];
}

function buildDescription(ctx: GitHubContext): string {
  const lines = [
    `## ${ctx.issueTitle}`,
    '',
    `**Source:** [Issue #${ctx.issueNumber}](${ctx.issueUrl}) in ${ctx.orgName}/${ctx.repoName}`,
    '',
  ];

  // Add issue body (truncated if too long)
  if (ctx.issueBody) {
    const maxLen = 4000;
    const body = ctx.issueBody.length > maxLen
      ? ctx.issueBody.substring(0, maxLen) + '\n\n...(truncated)'
      : ctx.issueBody;
    lines.push(body);
  }

  lines.push('');
  lines.push('---');
  lines.push('*This bounty was automatically created by the SolFoundry GitHub Action.*');

  return lines.join('\n');
}

// ============================================================
// API Calls
// ============================================================

async function createBounty(ctx: GitHubContext, payload: BountyPayload): Promise<BountyResponse> {
  const url = `${ctx.solfoundryApiUrl}/bounties`;

  core.info(`📡 POST ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ctx.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SolFoundry API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json() as BountyResponse;
  return result;
}

async function postComment(ctx: GitHubContext, bounty: BountyResponse): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning('GITHUB_TOKEN not available, skipping comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const bountyUrl = `https://solfoundry.com/bounties/${bounty.id}`;
  const rewardStr = bounty.reward_token === 'USDC'
    ? `$${bounty.reward_amount} USDC`
    : `${(bounty.reward_amount / 1000).toFixed(0)}K $FNDRY`;

  const comment = [
    '## 🏭 SolFoundry Bounty Created!',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Bounty ID** | ${bounty.id} |`,
    `| **Tier** | ${bounty.tier} |`,
    `| **Reward** | ${rewardStr} |`,
    `| **Deadline** | ${bounty.deadline || 'N/A'} |`,
    `| **URL** | [View on SolFoundry](${bountyUrl}) |`,
    '',
    '---',
    '*This bounty was automatically created by the [SolFoundry GitHub Action](https://github.com/marketplace/actions/solfoundry-bounty-creator).*',
  ].join('\n');

  try {
    await octokit.rest.issues.createComment({
      owner: ctx.orgName,
      repo: ctx.repoName,
      issue_number: ctx.issueNumber,
      body: comment,
    });
    core.info('💬 Comment posted on issue');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.warning(`Failed to post comment: ${msg}`);
  }
}

// ============================================================
// Helpers
// ============================================================

function setOutputs(output: ActionOutput): void {
  core.setOutput('bounty-id', output.bountyId);
  core.setOutput('bounty-url', output.bountyUrl);
  core.setOutput('status', output.status);
}

// ============================================================
// Entry Point
// ============================================================

run();
