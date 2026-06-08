/**
 * GitHub Issue Scraper — Auto-discovers bounty-worthy issues from
 * configured repositories and posts them to SolFoundry.
 *
 * Bounty: #840 (600K FNDRY, T2)
 *
 * Usage:
 *   npx tsx automaton/scrapers/github-issue-scraper.ts
 *   npx tsx automaton/scrapers/github-issue-scraper.ts --dry-run
 */

import { randomUUID } from "node:crypto";

// ============================================================
// Config
// ============================================================

interface ScraperConfig {
  /** Repositories to monitor */
  repos: string[];
  /** Labels that indicate a bounty issue */
  bountyLabels: string[];
  /** Minimum USD value to import (avoid junk $2 bounties) */
  minRewardUsd: number;
  /** Exclude repos matching these patterns (spam repos) */
  excludePatterns: RegExp[];
  /** Max issues per repo per run */
  maxPerRepo: number;
  /** GitHub personal access token (read-only is fine) */
  githubToken?: string;
  /** SolFoundry API base URL */
  solfoundryApiBase: string;
}

const DEFAULT_CONFIG: ScraperConfig = {
  repos: [
    "claude-builders-bounty/claude-builders-bounty",
    "xevrion-v2/agent-playground",
    "warpspeedopen-source/warpspeed-bounties",
    "SolFoundry/solfoundry",
    "UnsafeLabs/Bounty-Hunters",
  ],
  bountyLabels: ["bounty", "paid", "opire"],
  minRewardUsd: 25,
  excludePatterns: [
    /Apache-Arrow/,
    /Apache-ZooKeeper/,
    /Apache-Dolphin/,
    /tier-2/,
    /tier-3/,
  ],
  maxPerRepo: 20,
  githubToken: process.env.GITHUB_TOKEN,
  solfoundryApiBase: process.env.SOLFOUNDRY_API || "http://localhost:8000",
};

// ============================================================
// Types
// ============================================================

interface GithubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  repository_url: string;
  labels: string[];
  state: string;
  created_at: string;
  updated_at: string;
  user: { login: string };
}

interface ScrapedBounty {
  /** Source GitHub issue URL (used as dedup key) */
  source_issue_url: string;
  title: string;
  description: string;
  /** Original repo name */
  repo_name: string;
  /** Original org/owner */
  org_name: string;
  /** Issue number */
  issue_number: number;
  /** Detected or extracted reward in USD */
  reward_amount: number;
  /** Detected skills from labels or body */
  skills: string[];
  /** Suggested tier */
  tier: "T1" | "T2" | "T3";
  /** Labels from original issue */
  source_labels: string[];
}

// ============================================================
// GitHub API Client
// ============================================================

async function githubApi(path: string, token?: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "solfoundry-scraper/1.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(`https://api.github.com${path}`, { headers });
  if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${path}`);
  return resp.json();
}

// ============================================================
// Reward extraction
// ============================================================

function extractReward(body: string, labels: string[]): number {
  const text = [body, ...labels].join(" ");
  const matches = text.match(/\$(\d[\d,]*)/g) || [];
  const amounts = matches
    .map((m) => parseInt(m.replace(/[$,]/g, "")))
    .filter((n) => n > 0);
  return amounts.length > 0 ? Math.max(...amounts) : 0;
}

// ============================================================
// Skill extraction
// ============================================================

const KNOWN_SKILLS = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "solidity",
  "react",
  "react-native",
  "node.js",
  "nodejs",
  "next.js",
  "express",
  "prisma",
  "tailwind",
  "ethers",
  "web3",
  "blockchain",
  "ethereum",
  "solana",
];

function extractSkills(body: string, labels: string[]): string[] {
  const text = (body + " " + labels.join(" ")).toLowerCase();
  return KNOWN_SKILLS.filter((s) => text.includes(s));
}

// ============================================================
// Tier suggestion
// ============================================================

function suggestTier(reward: number): "T1" | "T2" | "T3" {
  if (reward >= 500) return "T2";
  if (reward >= 200) return "T1";
  return "T1";
}

// ============================================================
// Core scraper
// ============================================================

export async function scrapeBounties(
  config: Partial<ScraperConfig> = {}
): Promise<ScrapedBounty[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const bounties: ScrapedBounty[] = [];
  const seen = new Set<string>();

  for (const repo of cfg.repos) {
    const [owner, name] = repo.split("/");
    if (!owner || !name) continue;

    // Check exclusion
    if (cfg.excludePatterns.some((p) => p.test(repo))) continue;

    try {
      const q = cfg.bountyLabels.map((l) => `label:"${l}"`).join("+");
      const path = `/search/issues?q=repo:${repo}+is:open+is:issue+${q}&sort=updated&per_page=${cfg.maxPerRepo}`;

      const result = await githubApi(path, cfg.githubToken);
      const issues: GithubIssue[] = result.items || [];

      for (const issue of issues) {
        const labels = (issue.labels || []).map((l: any) =>
          (l.name || "").toLowerCase()
        );
        const reward = extractReward(issue.body || "", labels);

        // Filter
        if (reward < cfg.minRewardUsd) continue;
        if (seen.has(issue.html_url)) continue;
        seen.add(issue.html_url);

        bounties.push({
          source_issue_url: issue.html_url,
          title: issue.title,
          description: (issue.body || "").slice(0, 2000),
          repo_name: name,
          org_name: owner,
          issue_number: issue.number,
          reward_amount: reward,
          skills: extractSkills(issue.body || "", labels),
          tier: suggestTier(reward),
          source_labels: labels,
        });
      }
    } catch (err: any) {
      console.warn(`  ⚠️ ${repo}: ${err.message}`);
    }

    // Rate limit safety
    await new Promise((r) => setTimeout(r, 1500));
  }

  return bounties;
}

// ============================================================
// CLI
// ============================================================

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`🔍 SolFoundry GitHub Issue Scraper${dryRun ? " (dry-run)" : ""}\n`);

  const bounties = await scrapeBounties();

  console.log(`Found ${bounties.length} bounty-worthy issues:\n`);

  for (const b of bounties) {
    console.log(`  [${b.tier}] ${b.title.slice(0, 60)}`);
    console.log(`    ${b.source_issue_url}`);
    console.log(`    Reward: $${b.reward_amount} | Skills: ${b.skills.join(", ") || "none"}`);
    console.log();
  }

  if (!dryRun && bounties.length > 0) {
    console.log(`📤 Posting to SolFoundry API (${DEFAULT_CONFIG.solfoundryApiBase})...`);
    // POST each bounty to SolFoundry API
    for (const b of bounties) {
      try {
        const resp = await fetch(
          `${DEFAULT_CONFIG.solfoundryApiBase}/api/scraper/bounties`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(b),
          }
        );
        if (resp.ok) {
          console.log(`  ✅ Posted: ${b.title.slice(0, 50)}`);
        } else {
          console.log(`  ⚠️ Failed (${resp.status}): ${b.title.slice(0, 50)}`);
        }
      } catch (err: any) {
        console.log(`  ❌ Error: ${b.title.slice(0, 40)} — ${err.message}`);
      }
    }
  }

  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
