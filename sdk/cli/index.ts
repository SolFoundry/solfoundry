#!/usr/bin/env node
/**
 * solfoundry-cli — SolFoundry command-line tool
 *
 * Usage:
 *   solfoundry bounties list [--status open] [--tier T2] [--page 1]
 *   solfoundry bounty get <id>
 *   solfoundry contributors list [--page 1]
 *   solfoundry contributor get <handle>
 */

import { SolFoundryClient, SolFoundryError } from '../src/index.js';

const BASE_URL = process.env.SOLFOUNDRY_API_URL ?? 'https://api.solfoundry.io';
const API_KEY  = process.env.SOLFOUNDRY_API_KEY;

const client = new SolFoundryClient({ baseUrl: BASE_URL, apiKey: API_KEY });

// ── Minimal arg parser ────────────────────────────────────────────────────────

function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] ?? 'true';
      i += 2;
    } else {
      positional.push(args[i]);
      i++;
    }
  }
  return { positional, flags };
}

function printHelp() {
  console.log(`
solfoundry — CLI for the SolFoundry bounty platform

USAGE
  solfoundry <command> [options]

COMMANDS
  bounties list              List bounties
    --status <status>        Filter by status (open|in_progress|completed|…)
    --tier   <tier>          Filter by tier (T1|T2|T3)
    --page   <n>             Page number (default: 1)
    --search <query>         Full-text search

  bounty get <id>            Fetch a bounty by ID or issue number

  contributors list          List contributors
    --page   <n>             Page number (default: 1)

  contributor get <handle>   Fetch a contributor by GitHub handle

ENVIRONMENT VARIABLES
  SOLFOUNDRY_API_URL         Override API base URL
  SOLFOUNDRY_API_KEY         API key (required for submit)
`);
}

// ── Command handlers ─────────────────────────────────────────────────────────

async function cmdBountiesList(flags: Record<string, string>) {
  const result = await client.getBounties({
    status: flags['status'] as never,
    tier:   flags['tier'] as never,
    page:   flags['page'] ? Number(flags['page']) : 1,
    search: flags['search'],
  });

  console.log(`\n📋 Bounties (${result.data.length} of ${result.total} total)\n`);
  console.log(
    'ID'.padEnd(38) + 'ISSUE'.padEnd(8) + 'TIER'.padEnd(6) + 'STATUS'.padEnd(14) +
    'REWARD'.padEnd(18) + 'TITLE',
  );
  console.log('─'.repeat(120));
  for (const b of result.data) {
    console.log(
      b.id.padEnd(38) +
      `#${b.issueNumber}`.padEnd(8) +
      b.tier.padEnd(6) +
      b.status.padEnd(14) +
      `${b.reward.toLocaleString()} ${b.rewardToken}`.padEnd(18) +
      b.title,
    );
  }
  if (result.hasNext) {
    console.log(`\nMore results: use --page ${(result.page ?? 1) + 1}`);
  }
}

async function cmdBountyGet(id: string) {
  const b = await client.getBounty(id);
  console.log(`\n🏆 ${b.title}`);
  console.log(`   ID:          ${b.id}`);
  console.log(`   Issue:       #${b.issueNumber}`);
  console.log(`   Tier:        ${b.tier}`);
  console.log(`   Status:      ${b.status}`);
  console.log(`   Reward:      ${b.reward.toLocaleString()} ${b.rewardToken}`);
  console.log(`   Tags:        ${b.tags.join(', ')}`);
  console.log(`   Created:     ${b.createdAt}`);
  if (b.deadline) console.log(`   Deadline:    ${b.deadline}`);
  if (b.claimedBy) console.log(`   Claimed by:  @${b.claimedBy}`);
  console.log(`\n   ${b.description}`);
  console.log(`\n   Issue URL:   ${b.issueUrl}`);
}

async function cmdContributorsList(flags: Record<string, string>) {
  const result = await client.getContributors({
    page: flags['page'] ? Number(flags['page']) : 1,
  });

  console.log(`\n👥 Contributors (${result.data.length} of ${result.total} total)\n`);
  console.log(
    'HANDLE'.padEnd(24) + 'TIER'.padEnd(6) + 'REP'.padEnd(10) +
    'COMPLETED'.padEnd(12) + 'EARNED',
  );
  console.log('─'.repeat(80));
  for (const c of result.data) {
    console.log(
      `@${c.githubHandle}`.padEnd(24) +
      c.tier.padEnd(6) +
      String(c.reputation).padEnd(10) +
      String(c.bountiesCompleted).padEnd(12) +
      `${c.totalEarned.toLocaleString()} $FNDRY`,
    );
  }
  if (result.hasNext) {
    console.log(`\nMore results: use --page ${(result.page ?? 1) + 1}`);
  }
}

async function cmdContributorGet(handle: string) {
  const c = await client.getContributor(handle.replace(/^@/, ''));
  console.log(`\n👤 @${c.githubHandle}`);
  console.log(`   ID:          ${c.id}`);
  console.log(`   Tier:        ${c.tier}`);
  console.log(`   Reputation:  ${c.reputation}`);
  console.log(`   Completed:   ${c.bountiesCompleted}`);
  console.log(`   In progress: ${c.bountiesInProgress}`);
  console.log(`   Total earned:${c.totalEarned.toLocaleString()} $FNDRY`);
  console.log(`   Skills:      ${c.skills.join(', ')}`);
  console.log(`   Joined:      ${c.joinedAt}`);
  if (c.bio) console.log(`\n   ${c.bio}`);
}

// ── Main entry ────────────────────────────────────────────────────────────────

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [cmd, sub, arg] = positional;

  if (!cmd || cmd === 'help' || flags['help']) {
    printHelp();
    return;
  }

  try {
    if (cmd === 'bounties' && sub === 'list') {
      await cmdBountiesList(flags);
    } else if (cmd === 'bounty' && sub === 'get' && arg) {
      await cmdBountyGet(arg);
    } else if (cmd === 'contributors' && sub === 'list') {
      await cmdContributorsList(flags);
    } else if (cmd === 'contributor' && sub === 'get' && arg) {
      await cmdContributorGet(arg);
    } else {
      console.error(`Unknown command: ${positional.join(' ')}\n`);
      printHelp();
      process.exit(1);
    }
  } catch (err) {
    if (err instanceof SolFoundryError) {
      console.error(`\n❌ Error [${err.statusCode ?? 'N/A'}]: ${err.message}`);
      if (err.code) console.error(`   Code: ${err.code}`);
    } else {
      console.error('\n❌ Unexpected error:', err);
    }
    process.exit(1);
  }
}

main();
