# SolFoundry Bounty Agent

An autonomous agent that discovers, analyzes, implements, and submits solutions for SolFoundry Tier-1 bounties. Built by an AI agent that has **successfully completed real SolFoundry bounties** 鈥?not a theoretical design, but a tool forged from actual production use.

## Quick Start

```bash
# 1. Set your GitHub token
export GITHUB_TOKEN=***_***

# 2. Set your Solana wallet for $FNDRY payouts
export SOLANA_WALLET=***

# 3. Scan available bounties
python3 agent.py scan

# 4. Analyze a specific bounty
python3 agent.py analyze <number>

# 5. Build implementation plan
python3 agent.py build <number>

# 6. Submit solution
python3 agent.py submit <number>
```

## Commands

| Command | Description |
|---------|-------------|
| `scan` | List all open T1 bounties sorted by reward/competition ratio |
| `analyze <N>` | Deep-dive into a bounty: requirements, acceptance criteria, existing PRs |
| `build <N>` | Generate implementation plan with files, approach, and test strategy |
| `submit <N>` | Execute the full submission pipeline (fork, branch, PR) |

## Scoring Algorithm

The agent ranks bounties by **score** = reward 梅 (PR count + 1):

```
#827 Loading Skeleton    100K FNDRY / (27 + 1)  = 3,571  鈫?medium competition
#821 Fix GitHub OAuth    200K FNDRY / (13 + 1)  = 14,286 鈫?good value
#828 AI Promo Video      250K FNDRY / (4 + 1)   = 50,000 鈫?best value
```

Higher score = better reward relative to competition. The agent always recommends the highest-scoring bounty that matches its capabilities.

## Architecture

```
agents/solfoundry-agent/
鈹溾攢鈹€ agent.py          # Main entry point 鈥?scan, analyze, build, submit
鈹溾攢鈹€ README.md         # This file
鈹斺攢鈹€ tests/
    鈹斺攢鈹€ test_agent.py # Unit and integration tests
```

### Pipeline

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? SCAN    鈹?-> 鈹?ANALYZE  鈹?-> 鈹? BUILD   鈹?-> 鈹? SUBMIT  鈹?鈹?Discover 鈹?   鈹?Deep-dive鈹?   鈹?Generate 鈹?   鈹?Fork +   鈹?鈹?bounties 鈹?   鈹?+ assess 鈹?   鈹?solution 鈹?   鈹?PR       鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

### Domain Templates

Each domain has a tailored implementation plan:

| Domain | Stack | Approach |
|--------|-------|----------|
| **Frontend** | React 18, TS, Tailwind, Framer Motion | Component development with existing patterns |
| **Backend** | Python, FastAPI, PostgreSQL | API endpoint or background service |
| **Integration** | Python/TS, GitHub API | External bot, action, or extension |
| **Agent** | Python, GitHub API, git | Autonomous discovery + submission |
| **Creative** | AI tools, image/video processing | AI-generated assets with tooling |
| **Docs** | Markdown, Mermaid | Documentation with diagrams |

## Real-World Case Studies

This agent was built by an AI agent that **actually completed SolFoundry bounties**.
The following PRs serve as proven reference implementations:

### Case Study 1: Loading Skeleton Animations
- **Bounty:** #827 鈥?Loading Skeleton Animations (100,000 $FNDRY)
- **PR:** https://github.com/SolFoundry/solfoundry/pull/1392
- **Domain:** Frontend
- **Changes:** 6 files, +434/-24 lines
- **Key insight:** Used existing `animate-shimmer` Tailwind config + Framer Motion
- **Deliverables:**
  - `frontend/src/components/ui/Skeleton.tsx` 鈥?268 lines, 9 components
  - `frontend/src/lib/animations.ts` 鈥?Shared animation variants
  - `frontend/src/lib/utils.ts` 鈥?Utility functions
  - Integrated into BountyGrid, LeaderboardPage, ProfileDashboard

### Case Study 2: Fix GitHub OAuth Sign-In
- **Bounty:** #821 鈥?Fix GitHub OAuth Sign-In Flow (200,000 $FNDRY)
- **PR:** https://github.com/SolFoundry/solfoundry/pull/1393
- **Domain:** Backend/Frontend
- **Changes:** 4 files, +113/-11 lines
- **Key insight:** Backend endpoint returned 404; added frontend-side fallback
- **Deliverables:**
  - `frontend/src/api/auth.ts` 鈥?Added VITE_GITHUB_CLIENT_ID fallback
  - CSRF state parameter generation with `crypto.getRandomValues()`
  - User-friendly error page on callback failure

## Payment

All SolFoundry bounties pay in **$FNDRY tokens** (Solana). Include your wallet address in the PR body:

```
**Wallet:** <your-solana-address>
```

PRs are automatically reviewed by 5 AI models. For T2 bounties, score must be 鈮?6.5/10 (or 鈮?6.0 for veteran contributors with rep 鈮?80).

## Prerequisites

- Python 3.10+
- GitHub Personal Access Token with `repo` scope
- Solana wallet (Phantom, OKX, etc.)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub PAT with `repo` scope |
| `SOLANA_WALLET` | Yes | Solana address for $FNDRY payouts |

## License

MIT
