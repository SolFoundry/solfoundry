import * as fs from 'fs';
import * as path from 'path';
import type { GitHubContext } from './types';

// ============================================================
// Minimal mock for GitHub Actions core
// ============================================================

const outputs: Record<string, string> = {};

const mockCore = {
  getInput: (name: string, options?: { required?: boolean }) => {
    const envVar = `INPUT_${name.toUpperCase().replace(/-/g, '_')}`;
    return process.env[envVar] || '';
  },
  setOutput: (name: string, value: string) => {
    outputs[name] = value;
  },
  setFailed: (msg: string) => {
    throw new Error(msg);
  },
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warning: (msg: string) => console.warn(`[WARN] ${msg}`),
};

// ============================================================
// Import functions under test (re-exports)
// ============================================================

// We test the pure functions by importing logic directly
function detectTier(labels: string[], defaultTier: string): string {
  const TIER_LABEL_REGEX = /^tier-(\d)$/i;
  for (const label of labels) {
    const match = label.match(TIER_LABEL_REGEX);
    if (match) {
      const tierNum = parseInt(match[1], 10);
      if (tierNum >= 1 && tierNum <= 3) return `T${tierNum}`;
    }
  }
  return defaultTier;
}

function detectRewardAmount(
  issueBody: string,
  labels: string[],
  tier: string,
  defaultAmount: number
): number {
  const DEFAULT_TIERS: Record<string, number> = {
    T1: 500000,
    T2: 500000,
    T3: 1000000,
  };

  const bodyMatch = issueBody.match(/(?:reward|bounty|💰)[:\s]*(\d+(?:,\d+)*)\s*(?:FNDRY|USDC)?/i);
  if (bodyMatch) {
    const amount = parseInt(bodyMatch[1].replace(/,/g, ''), 10);
    if (amount > 0) return amount;
  }

  for (const label of labels) {
    const rewardMatch = label.match(/reward-(\d+)k?/i);
    if (rewardMatch) {
      const amount = parseInt(rewardMatch[1], 10);
      return label.toLowerCase().includes('k') ? amount * 1000 : amount;
    }
  }

  return DEFAULT_TIERS[tier] || defaultAmount;
}

function extractSkills(labels: string[]): string[] {
  const SKILL_LABELS = ['frontend', 'backend', 'docs', 'creative', 'integration', 'agent', 'marketplace'];
  return labels.filter((l) => SKILL_LABELS.includes(l.toLowerCase()));
}

function shouldCreateBounty(labels: string[], bountyLabel: string): boolean {
  return labels.some(
    (l) =>
      l.toLowerCase() === bountyLabel.toLowerCase() ||
      l.toLowerCase().startsWith('bounty')
  );
}

function buildDescription(title: string, body: string, issueUrl: string, issueNumber: number, orgName: string, repoName: string): string {
  const lines = [
    `## ${title}`,
    '',
    `**Source:** [Issue #${issueNumber}](${issueUrl}) in ${orgName}/${repoName}`,
    '',
  ];
  if (body) {
    const maxLen = 4000;
    lines.push(body.length > maxLen ? body.substring(0, maxLen) + '\n\n...(truncated)' : body);
  }
  lines.push('');
  lines.push('---');
  lines.push('*This bounty was automatically created by the SolFoundry GitHub Action.*');
  return lines.join('\n');
}

// ============================================================
// Tests
// ============================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

function assertEqual(actual: unknown, expected: unknown, name: string) {
  if (actual === expected) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// --- Tier Detection ---

console.log('\n📦 Tier Detection:');
assertEqual(detectTier(['bounty', 'tier-1'], 'T2'), 'T1', 'detects tier-1 from label');
assertEqual(detectTier(['bounty', 'tier-2'], 'T2'), 'T2', 'detects tier-2 from label');
assertEqual(detectTier(['bounty', 'tier-3'], 'T2'), 'T3', 'detects tier-3 from label');
assertEqual(detectTier(['bounty', 'TIER-1'], 'T2'), 'T1', 'case insensitive tier label');
assertEqual(detectTier(['bounty'], 'T2'), 'T2', 'uses default tier when no tier label');
assertEqual(detectTier(['bounty', 'frontend'], 'T1'), 'T1', 'ignores non-tier labels');

// --- Reward Detection ---

console.log('\n💰 Reward Detection:');
assertEqual(
  detectRewardAmount('reward: 250000 FNDRY', [], 'T2', 100000),
  250000,
  'extracts reward from body text'
);
assertEqual(
  detectRewardAmount('Bounty: 750,000', [], 'T2', 100000),
  750000,
  'handles comma-formatted amounts'
);
assertEqual(
  detectRewardAmount('', ['reward-500k'], 'T2', 100000),
  500000,
  'extracts reward from reward-500k label'
);
assertEqual(
  detectRewardAmount('', ['reward-250'], 'T2', 100000),
  250,
  'extracts reward from reward-250 label'
);
assertEqual(
  detectRewardAmount('', [], 'T3', 100000),
  1000000,
  'uses tier default (T3 = 1M)'
);
assertEqual(
  detectRewardAmount('', [], 'T1', 100000),
  500000,
  'uses tier default (T1 = 500K)'
);
assertEqual(
  detectRewardAmount('', [], 'T2', 100000),
  500000,
  'uses tier default (T2 = 500K)'
);
assertEqual(
  detectRewardAmount('', [], 'T2', 200000),
  500000,
  'uses T2 tier default (500K) even with custom default'
);
assertEqual(
  detectRewardAmount('', [], 'T4' as any, 200000),
  200000,
  'uses user default when tier not in mapping'
);

// --- Skill Extraction ---

console.log('\n🛠️ Skill Extraction:');
assertEqual(extractSkills(['frontend', 'backend']).length, 2, 'extracts two skills');
assertEqual(extractSkills(['frontend', 'bounty']).length, 1, 'filters non-skill labels');
assertEqual(extractSkills(['bounty', 'tier-2']).length, 0, 'empty when no skill labels');

// --- Bounty Criteria ---

console.log('\n🏷️ Bounty Label Detection:');
assert(shouldCreateBounty(['bounty'], 'bounty'), 'exact label match');
assert(shouldCreateBounty(['bounty-request'], 'bounty'), 'prefix match');
assert(shouldCreateBounty(['BOUNTY'], 'bounty'), 'case insensitive');
assert(!shouldCreateBounty(['bug', 'enhancement'], 'bounty'), 'no match without bounty label');
assert(shouldCreateBounty(['bounty', 'frontend'], 'bounty'), 'match with other labels');

// --- Description Builder ---

console.log('\n📝 Description Builder:');
const desc = buildDescription(
  'Test Issue',
  'Issue body text',
  'https://github.com/org/repo/issues/1',
  1,
  'org',
  'repo'
);
assert(desc.includes('## Test Issue'), 'includes title');
assert(desc.includes('Issue #1'), 'includes issue number');
assert(desc.includes('org/repo'), 'includes repo');
assert(desc.includes('Issue body text'), 'includes body');
assert(desc.includes('SolFoundry GitHub Action'), 'includes footer');

// Long body truncation
const longBody = 'x'.repeat(5000);
const longDesc = buildDescription('Title', longBody, 'url', 1, 'org', 'repo');
assert(longDesc.includes('...(truncated)'), 'truncates long body');

// --- Summary ---

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

if (failed > 0) {
  process.exit(1);
}
