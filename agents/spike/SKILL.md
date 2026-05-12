# Spike — Autonomous Bounty-Hunting Agent

> "You're gonna carry that weight." — Spike Spiegel

## Description
An autonomous AI agent that discovers open-source security bounties, audits repositories for vulnerabilities, generates AI-powered fixes, and submits PRs. Built for SolFoundry's bounty ecosystem.

## Commands
- `/spike discover` — Scan Algora, GitHub issues, and Security Advisories for bounty opportunities
- `/spike scan <owner/repo>` — Perform deep security audit on a repository
- `/spike pipeline` — End-to-end: discover → audit → generate fixes → report

## Requirements
- Node.js 18+
- GITHUB_TOKEN (GitHub API)
- ANTHROPIC_API_KEY (for AI fix generation via Claude)

## Architecture
Four-agent orchestration:
1. **Discovery Agent** — Finds bounty opportunities across platforms
2. **Audit Agent** — Static analysis with 11 security patterns (zero dependencies)
3. **Fix Agent** — AI-powered fix generation via Anthropic Claude + SiliconFlow fallback
4. **Submit Agent** — GitHub API integration for PR submission

## Example
```bash
export GITHUB_TOKEN=ghp_...
export ANTHROPIC_API_KEY=sk-ant_...
npx spike discover
npx spike scan expressjs/express
npx spike pipeline
```
