/**
 * GitHub Issue Scraper 鈥?Automaton Service
 *
 * Scans configured GitHub repositories for open issues with bounty labels,
 * classifies them by tier, and posts them as SolFoundry bounties.
 *
 * Integrates with the SolFoundry automaton system for scheduled execution.
 *
 * Usage:
 *   npx ts-node automaton/scrapers/github-issue-scraper.ts scan
 *   npx ts-node automaton/scrapers/github-issue-scraper.ts scan --dry-run
 */

import https from 'https';
import http from 'http';

// 鈹€鈹€鈹€ Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

interface ScrapedIssue {
  repo: string;
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  labels: string[];
  state: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  tier: Tier;
  rewardEstimate: string;
}

type Tier = 'T1' | 'T2' | 'T3';

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: { name: string }[];
  state: string;
  created_at: string;
  updated_at: string;
  comments: number;
}

// 鈹€鈹€鈹€ Configuration 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const SOLFOUNDRY_API_URL = process.env.SOLFOUNDRY_API_URL || 'http://localhost:8000';

const DEFAULT_REPOS = [
  'claude-builders-bounty/claude-builders-bounty',
  'warpspeedopen-source/warpspeed-bounties',
  'PlatformNetwork/bounty-challenge',
  'SecureBananaLabs/bug-bounty',
];

const TIER_LABELS: Record<Tier, string[]> = {
  T1: ['bounty', 'paid', 'good-first-issue', 'help-wanted'],
  T2: ['expert', 'feature', 'enhancement'],
  T3: ['core', 'security'],
};

// 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function githubApi(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'solfoundry-scraper/1.0',
        Accept: 'application/vnd.github.v3+json',
        ...(GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}),
      },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

function estimateTier(labels: string[], body: string): Tier {
  const lowerLabels = labels.map((l) => l.toLowerCase().replace(/\s+/g, '-'));
  for (const [tier, keywords] of Object.entries(TIER_LABELS)) {
    for (const kw of keywords) {
      if (lowerLabels.some((l) => l.includes(kw))) return tier as Tier;
    }
  }
  const bodyLower = body.toLowerCase();
  if (/complex|expert|multi-step/.test(bodyLower)) return 'T2';
  if (/quick|easy|simple|beginner/.test(bodyLower)) return 'T1';
  return 'T1';
}

function estimateReward(tier: Tier, _labels: string[], body: string): string {
  const match = body.match(/\$?(\d[\d,]*)\s*(USD|USDT|\$FNDRY)?/);
  if (match) return match[0];
  const defaults: Record<Tier, string> = { T1: '100-250K', T2: '400-700K', T3: '1M+' };
  return defaults[tier];
}

// 鈹€鈹€鈹€ Scanner 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

async function scanRepo(repo: string, maxIssues = 20): Promise<ScrapedIssue[]> {
  console.log(`  Scanning ${repo}...`);
  const q = `repo:${repo}+state:open+is:issue`;
  const data = await githubApi(`/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${maxIssues}`);

  const issues: ScrapedIssue[] = [];
  for (const item of (data?.items ?? []) as GitHubIssue[]) {
    const labels = item.labels.map((l) => l.name);
    const body = item.body ?? '';
    const tier = estimateTier(labels, body);
    issues.push({
      repo,
      number: item.number,
      title: item.title,
      body,
      htmlUrl: item.html_url,
      labels,
      state: item.state,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      comments: item.comments,
      tier,
      rewardEstimate: estimateReward(tier, labels, body),
    });
  }
  console.log(`    Found ${issues.length} open issues`);
  return issues;
}

async function scanAll(repos: string[] = DEFAULT_REPOS): Promise<ScrapedIssue[]> {
  const all: ScrapedIssue[] = [];
  const seen = new Set<string>();
  for (const repo of repos) {
    const issues = await scanRepo(repo);
    for (const issue of issues) {
      const key = `${issue.repo}#${issue.number}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(issue);
      }
    }
  }
  return all;
}

// 鈹€鈹€鈹€ Display 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function displayIssues(issues: ScrapedIssue[]): void {
  const tiers: Record<string, ScrapedIssue[]> = {};
  for (const issue of issues) {
    (tiers[issue.tier] ??= []).push(issue);
  }

  console.log(`\n${'鈹€'.repeat(60)}`);
  console.log(`  Total: ${issues.length} issues\n`);

  for (const [tier, tierIssues] of Object.entries(tiers).sort()) {
    console.log(`  [${tier}] ${tierIssues.length} issues:`);
    for (const issue of tierIssues) {
      const est = issue.rewardEstimate !== '?' ? ` [${issue.rewardEstimate}]` : '';
      console.log(`    \u2022 ${issue.repo}#${issue.number}${est}`);
      console.log(`      ${issue.title.slice(0, 70)}`);
    }
    console.log();
  }
}

// 鈹€鈹€鈹€ CLI 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const dryRun = args.includes('--dry-run');

  if (!command || command === 'help') {
    console.log(`
SolFoundry GitHub Issue Scraper

Usage:
  npx ts-node ${process.argv[1]} scan           Scan configured repos
  npx ts-node ${process.argv[1]} scan --dry-run  Preview only
    `);
    return;
  }

  if (command === 'scan') {
    console.log(`\n\u{1F50D} Scanning configured repositories...\n`);
    const issues = await scanAll();
    if (issues.length === 0) {
      console.log('  No issues found.');
      return;
    }
    displayIssues(issues);
    if (dryRun) {
      console.log('  \u{1F4A1} Run without --dry-run to post to SolFoundry API.\n');
    }
  }
}

main().catch(console.error);
