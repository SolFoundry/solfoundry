import * as core from '@actions/core';
import * as github from '@actions/github';
import { createBounty } from './api';

function parseRewardFromLabels(
  labels: { name: string }[],
  defaultAmount: number,
  defaultToken: string
): { amount: number; token: string } {
  let amount = defaultAmount;
  let token = defaultToken;

  for (const label of labels) {
    const name = label.name.toLowerCase();

    // Match patterns: "bounty:$200", "bounty:200fn dry", "bounty:100usdc", "bounty:$100usdc"
    const rewardMatch = name.match(/^bounty:\$?(\d+)(fn dry|usdc)?$/i);
    if (rewardMatch) {
      amount = parseInt(rewardMatch[1], 10);
      if (rewardMatch[2]) {
        token = rewardMatch[2].toUpperCase() === 'FNDRY' ? 'FNDRY' : 'USDC';
      }
    }

    // Also check "reward:$200" pattern
    const rewardMatch2 = name.match(/^reward:\$?(\d+)(fn dry|usdc)?$/i);
    if (rewardMatch2) {
      amount = parseInt(rewardMatch2[1], 10);
      if (rewardMatch2[2]) {
        token = rewardMatch2[2].toUpperCase() === 'FNDRY' ? 'FNDRY' : 'USDC';
      }
    }
  }

  return { amount, token };
}

function parseTierFromLabels(labels: { name: string }[], defaultTier: string): string {
  for (const label of labels) {
    const name = label.name.toLowerCase();
    const tierMatch = name.match(/^bounty-tier:(t[1-3])$/i);
    if (tierMatch) {
      return tierMatch[1].toUpperCase();
    }
  }
  return defaultTier;
}

async function run(): Promise<void> {
  try {
    const apiKey = core.getInput('solfoundry-api-key', { required: true });
    const apiUrl = core.getInput('solfoundry-api-url') || 'https://solfoundry.vercel.app';
    const defaultRewardAmount = parseInt(core.getInput('default-reward-amount') || '100', 10);
    const defaultRewardToken = core.getInput('default-reward-token') || 'USDC';
    const defaultTier = (core.getInput('default-tier') || 'T1').toUpperCase();
    const bountyLabel = core.getInput('bounty-label') || 'bounty';
    const token = core.getInput('github-token') || '';

    const payload = github.context.payload;
    const issue = payload.issue as {
      number: number;
      title?: string;
      body?: string;
      labels?: { name: string }[];
      html_url?: string;
    } | undefined;

    if (!issue) {
      core.setFailed('No issue found in context. This action must run on issue events.');
      return;
    }

    const { number: issueNumber, title, body, labels, html_url: issueUrl } = issue;
    const repoFullName = `${github.context.repo.owner}/${github.context.repo.repo}`;
    const issueLabels = labels || [];

    // Check if the issue has the bounty label
    const labelNames: string[] = issueLabels.map((l) => l.name.toLowerCase());
    if (!labelNames.includes(bountyLabel.toLowerCase())) {
      core.info(`Issue #${issueNumber} does not have the "${bountyLabel}" label. Skipping.`);
      return;
    }

    core.info(`Processing bounty for issue #${issueNumber}: ${title}`);

    // Parse reward and tier from labels
    const { amount, token: rewardToken } = parseRewardFromLabels(
      issueLabels,
      defaultRewardAmount,
      defaultRewardToken
    );
    const tier = parseTierFromLabels(issueLabels, defaultTier);

    core.info(`Reward: ${amount} ${rewardToken} | Tier: ${tier}`);

    // Create bounty via API
    const bounty = await createBounty(apiUrl, apiKey, {
      title: title || '',
      description: body || '',
      repository: repoFullName,
      issueNumber,
      issueUrl: issueUrl || '',
      rewardAmount: amount,
      rewardToken,
      tier,
    });

    core.info(`Bounty created: ${bounty.id}`);
    core.setOutput('bounty-id', bounty.id);
    core.setOutput('bounty-url', bounty.url);

    // Post comment on the issue
    if (token) {
      const octokit = github.getOctokit(token);
      const commentBody = [
        `## 🎯 Bounty Created`,
        '',
        `A bounty has been posted on **SolFoundry** for this issue!`,
        '',
        `| Detail | Value |`,
        `|--------|-------|`,
        `| **Reward** | ${amount} ${rewardToken} |`,
        `| **Tier** | ${tier} |`,
        `| **Bounty URL** | ${bounty.url} |`,
        '',
        `> _This bounty was automatically created by the [SolFoundry GitHub Action](https://github.com/SolFoundry/solfoundry/tree/main/integrations/github-action)._`,
      ].join('\n');

      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issueNumber,
        body: commentBody,
      });

      core.info('Comment posted on issue.');
    } else {
      core.warning('No GitHub token provided; skipping comment.');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
