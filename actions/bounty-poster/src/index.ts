/**
 * SolFoundry Bounty Poster — GitHub Action
 *
 * Converts labeled GitHub issues into SolFoundry bounties.
 * Reward amount can be overridden per-issue via issue body metadata:
 *
 *   <!-- solfoundry: reward=1000000 tier=t1 skills=rust,backend deadline=14 -->
 *
 * If no metadata comment is found, defaults from action.yml inputs are used.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { IssueEvent } from './types';

/* ─── Config ─── */

const METADATA_REGEX = /<!--\s*solfoundry:\s*(.+?)\s*-->/;
const REWARD_REGEX = /reward=(\d+)/;
const TIER_REGEX = /tier=(t[123])/;
const SKILLS_REGEX = /skills=([a-z0-9_,+-]+)/;
const DEADLINE_REGEX = /deadline=(\d+)/;

/* ─── Helpers ─── */

function parseMetadata(body: string | null | undefined): Partial<IssueEvent> {
  if (!body) return {};
  const match = body.match(METADATA_REGEX);
  if (!match) return {};

  const meta = match[1];
  return {
    rewardAmount: REWARD_REGEX.exec(meta)?.[1],
    tier: TIER_REGEX.exec(meta)?.[1],
    skills: SKILLS_REGEX.exec(meta)?.[1],
    deadlineDays: DEADLINE_REGEX.exec(meta)?.[1],
  };
}

async function createBounty(
  apiUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ id: string; url: string }> {
  const res = await fetch(`${apiUrl}/api/bounties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SolFoundry API ${res.status}: ${text}`);
  }

  return res.json() as Promise<{ id: string; url: string }>;
}

async function addLabelComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  bountyUrl: string,
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: `🤑 **Bounty posted on SolFoundry!**\n\n[View bounty →](${bountyUrl})`,
  });
}

/* ─── Main ─── */

async function run(): Promise<void> {
  try {
    const apiUrl = core.getInput('solfoundry-api-url');
    const apiKey = core.getInput('solfoundry-api-key', { required: true });
    const bountyLabel = core.getInput('bounty-label');
    const defaultReward = core.getInput('reward-amount');
    const defaultToken = core.getInput('reward-token');
    const defaultTier = core.getInput('tier');
    const defaultDeadlineDays = core.getInput('deadline-days');
    const defaultSkills = core.getInput('skills');
    const dryRun = core.getInput('dry-run') === 'true';

    const context = github.context;
    const issue = context.payload.issue;

    if (!issue) {
      core.info('No issue in payload — skipping.');
      return;
    }

    // Check if the issue has the bounty label
    const labels: string[] = (issue.labels ?? []).map(
      (l: { name: string } | string) => typeof l === 'string' ? l : l.name,
    );

    if (!labels.includes(bountyLabel)) {
      core.info(`Issue #${issue.number} does not have label "${bountyLabel}" — skipping.`);
      return;
    }

    // Parse per-issue overrides from body
    const metadata = parseMetadata(issue.body);
    const rewardAmount = metadata.rewardAmount ?? defaultReward;
    const tier = metadata.tier ?? defaultTier;
    const skillsStr = metadata.skills ?? defaultSkills;
    const deadlineDays = metadata.deadlineDays ?? defaultDeadlineDays;

    const skills = skillsStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Calculate deadline ISO string
    let deadline: string | null = null;
    const days = parseInt(deadlineDays, 10);
    if (days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      deadline = d.toISOString();
    }

    // Build the bounty payload
    const payload: Record<string, unknown> = {
      title: issue.title,
      description: issue.body ?? '',
      reward_amount: parseInt(rewardAmount, 10),
      reward_token: defaultToken,
      tier,
      github_repo_url: context.payload.repository?.html_url ?? null,
      github_issue_url: issue.html_url ?? null,
      skills,
      deadline,
    };

    if (dryRun) {
      core.info('🔒 DRY RUN — would post the following bounty:');
      core.info(JSON.stringify(payload, null, 2));
      core.setOutput('bounty-id', 'dry-run');
      core.setOutput('bounty-url', 'dry-run');
      return;
    }

    // Post to SolFoundry
    core.info(`Creating bounty for issue #${issue.number}...`);
    const result = await createBounty(apiUrl, apiKey, payload);

    core.setOutput('bounty-id', result.id);
    core.setOutput('bounty-url', result.url);
    core.info(`Bounty created: ${result.id} — ${result.url}`);

    // Add a comment on the issue with the bounty link
    const token = core.getInput('github-token', { required: false }) || process.env.GITHUB_TOKEN;
    if (token) {
      const octokit = github.getOctokit(token);
      const { owner, repo } = context.repo;
      await addLabelComment(octokit, owner, repo, issue.number, result.url);
    }
  } catch (err) {
    if (err instanceof Error) {
      core.setFailed(err.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

run();
