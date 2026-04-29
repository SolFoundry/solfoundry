/**
 * SolFoundry GitHub Action - Main Entry Point
 *
 * Automatically posts labeled GitHub issues as SolFoundry bounties.
 * Supports configurable labels, tier detection, reward amounts, and dry-run mode.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { BountyPoster } from './bounty-poster';
import { TierDetector } from './tier-detector';
import { LabelMatcher } from './label-matcher';

async function run(): Promise<void> {
  try {
    // Read inputs
    const solfoundryApiKey = core.getInput('solfoundry-api-key', { required: true });
    const solfoundryBaseUrl = core.getInput('solfoundry-base-url') || 'https://api.solfoundry.io';
    const labelsInput = core.getInput('labels') || 'bounty,solfoundry';
    const defaultTier = parseInt(core.getInput('default-tier') || '2', 10);
    const rewardAmount = parseInt(core.getInput('reward-amount') || '500000', 10);
    const dryRun = core.getInput('dry-run') === 'true';

    const triggerLabels = labelsInput.split(',').map(l => l.trim().toLowerCase());

    core.info(`🚀 SolFoundry Bounty Poster starting...`);
    core.info(`   Trigger labels: ${triggerLabels.join(', ')}`);
    core.info(`   Default tier: ${defaultTier}`);
    core.info(`   Default reward: ${rewardAmount.toLocaleString()} $FNDRY`);
    core.info(`   Dry run: ${dryRun}`);

    // Get issue context
    const context = github.context;
    const issue = context.payload.issue;

    if (!issue) {
      core.warning('No issue found in payload. This action should be triggered by issues events.');
      return;
    }

    const issueNumber = issue.number;
    const issueTitle = issue.title;
    const issueBody = issue.body || '';
    const issueLabels = issue.labels.map(l =>
      typeof l === 'string' ? l.toLowerCase() : (l.name || '').toLowerCase()
    );

    core.info(`📋 Processing issue #${issueNumber}: ${issueTitle}`);

    // Check if any trigger labels match
    const matchedLabels = LabelMatcher.match(triggerLabels, issueLabels);
    if (matchedLabels.length === 0) {
      core.info(`⏭️  Issue #${issueNumber} does not have any trigger labels. Skipping.`);
      return;
    }

    core.info(`✅ Matched labels: ${matchedLabels.join(', ')}`);

    // Detect tier from labels
    const detectedTier = TierDetector.detect(issueLabels, defaultTier);
    core.info(`📊 Detected tier: ${detectedTier}`);

    // Determine reward based on tier
    const tierRewards: Record<number, number> = {
      1: 100000,
      2: rewardAmount,
      3: 1000000,
    };
    const finalReward = tierRewards[detectedTier] || rewardAmount;

    // Prepare bounty data
    const bountyData = {
      title: issueTitle,
      description: issueBody,
      tier: detectedTier,
      reward_amount: finalReward,
      source_repo: `${context.repo.owner}/${context.repo.repo}`,
      source_issue: issueNumber,
      labels: issueLabels,
      html_url: issue.html_url,
    };

    core.info(`💰 Bounty reward: ${finalReward.toLocaleString()} $FNDRY`);

    // Post to SolFoundry
    const poster = new BountyPoster(solfoundryBaseUrl, solfoundryApiKey);

    if (dryRun) {
      core.info(`🔍 DRY RUN - Would post bounty:`);
      core.info(JSON.stringify(bountyData, null, 2));
      core.setOutput('bounty_posted', 'false');
      core.setOutput('bounty_id', '');
      return;
    }

    const result = await poster.post(bountyData);

    if (result.success) {
      core.info(`✅ Bounty posted successfully! ID: ${result.bountyId}`);
      core.setOutput('bounty_posted', 'true');
      core.setOutput('bounty_id', result.bountyId || '');
      core.setOutput('bounty_url', result.bountyUrl || '');
    } else {
      core.setFailed(`❌ Failed to post bounty: ${result.error}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${errorMessage}`);
  }
}

run();
