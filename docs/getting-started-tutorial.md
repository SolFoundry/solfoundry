# Getting Started with SolFoundry

> Ship code, earn $FNDRY. No applications. No interviews.

SolFoundry is an AI-powered bounty platform on Solana where developers earn tokens by completing open-source tasks. Your work is reviewed by 5 AI models and scored automatically — no waiting for human approval.

---

## Step 1: Set Up

### Prerequisites
- **Node.js 20+** and **pnpm** (or npm)
- A **Solana wallet** ([Phantom](https://phantom.app) recommended)
- A **GitHub account**

### Fork the Repository

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/solfoundry.git
cd solfoundry

# Install frontend dependencies
cd frontend && npm install

# Start dev server
npm run dev
```

The app runs on `http://localhost:5173`.

---

## Step 2: Pick a Bounty

1. Open the [Issues tab](https://github.com/SolFoundry/solfoundry/issues)
2. Filter by `bounty` label
3. Start with a **Tier 1 (T1) bounty** — these are open races: no claiming needed, first quality PR wins

### Bounty Tiers

| Tier | Reward Range | Review Threshold | Style |
|------|-------------|-----------------|-------|
| T1 | 100K - 250K $FNDRY | Score ≥ 6.0/10 | Open Race |
| T2 | 500K - 850K $FNDRY | Score ≥ 6.5/10 | Claim & Build |
| T3 | 850K+ $FNDRY | Score ≥ 7.0/10 | Deep Work |

---

## Step 3: Build Your Solution

```bash
# Create a branch for your bounty
git checkout -b feat/bounty-NNN-description

# Build your solution following the issue requirements exactly
# Run the dev server to verify your work
npm run dev
```

### Quality Tips
- Match the existing code style and Tailwind theme
- Test your changes in the browser before committing
- Keep PRs focused — one bounty per PR
- The `forge-*` color palette is in `src/index.css`

---

## Step 4: Submit Your PR

**⚠️ CRITICAL — Follow these rules exactly or your PR will be auto-closed:**

1. **Title:** Descriptive — `feat: implement feature name`
2. **PR body must include:**
   - `Closes #N` where N is the bounty issue number
   - **Your Solana wallet address** — no wallet = no payout!

**Example PR description:**
```
Implements the site navigation and layout shell with dark theme.

Closes #18

Wallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

---

## Step 5: AI Review

Once you submit, 5 AI models review your PR in parallel:
- **GPT-5.4**
- **Gemini 2.5 Pro**
- **Grok 4**
- **Claude Sonnet 4.6**
- **DeepSeek V3.2**

Scores are aggregated with trimmed mean (highest and lowest dropped). If your score meets the tier threshold, your PR is **auto-merged** and $FNDRY is sent to your wallet automatically.

If your score is below threshold, you'll get feedback and can push fixes.

---

## Quick Reference

```bash
# Dev
cd frontend && npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

### Project Structure

```
frontend/src/
├── components/
│   ├── bounty/       # Bounty cards, detail, create wizard
│   ├── home/         # Hero, activity feed, featured
│   ├── layout/       # Navbar, footer
│   ├── leaderboard/  # Podium, table
│   ├── profile/      # User dashboard
│   └── ui/           # Shared primitives
├── api/              # API client functions
├── hooks/            # React Query hooks
├── services/         # Auth, API client
├── types/            # TypeScript types
└── pages/            # Route-level pages
```

### Useful Links
- [Issues](https://github.com/SolFoundry/solfoundry/issues)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Code Review Guide](../../CODE_REVIEW.md)

---

**Ready? Pick your first T1 bounty and start building. Ship code, get paid.**
