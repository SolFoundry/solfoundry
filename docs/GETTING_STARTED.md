# Getting Started with SolFoundry

SolFoundry is an open-source bounty marketplace built on Solana. Contributors fix bugs, build features, and earn $FNDRY tokens automatically when their pull request is merged. There's no application, no interview, and no waiting — just code.

---

## What You Need

- A GitHub account
- A Solana wallet (Phantom is recommended — download at [phantom.com](https://phantom.com))
- Basic familiarity with Git and pull requests

---

## Step 1: Find a Bounty

Open issues are listed at [github.com/SolFoundry/solfoundry/issues](https://github.com/SolFoundry/solfoundry/issues). Filter by the `bounty` label to see funded tasks.

**Tier 1 (T1) — Start here.** No prerequisites. Open race — first clean PR that passes review wins.

| Tier | Reward | Access | Deadline |
|------|--------|--------|----------|
| T1 | 50–500 $FNDRY | Anyone | 72 hours |
| T2 | 500–5,000 $FNDRY | 4+ merged T1 PRs | 7 days |
| T3 | 5,000–50,000 $FNDRY | 3+ merged T2 PRs | 14 days |

Pick a T1 issue that matches your skills. The issue body describes what to build and lists acceptance criteria.

---

## Step 2: Fork the Repo

1. Click **Fork** at the top right of [github.com/SolFoundry/solfoundry](https://github.com/SolFoundry/solfoundry).
2. Clone your fork locally:

```bash
git clone https://github.com/<your-username>/solfoundry.git
cd solfoundry
```

3. Add the upstream remote so you can stay up to date:

```bash
git remote add upstream https://github.com/SolFoundry/solfoundry.git
```

---

## Step 3: Create a Branch

Use the issue number in your branch name:

```bash
git checkout -b feat/my-feature-<issue-number>
```

---

## Step 4: Build the Solution

Read the issue's **Acceptance Criteria** carefully — the AI reviewer checks against them.

For a frontend bounty, the stack is:
- **React + TypeScript** in `frontend/src/`
- **Tailwind CSS** with the forge dark theme (see `frontend/src/index.css`)
- Run `npm install && npm run dev` inside `frontend/` to start the dev server

For a backend bounty, the stack is:
- **FastAPI + Python** in `backend/`
- Run with Docker: `docker compose -f docker-compose.dev.yml up`

---

## Step 5: Submit Your PR

This step is critical. **Your PR will be auto-closed if the format is wrong.**

1. Push your branch:

```bash
git push origin feat/my-feature-<issue-number>
```

2. Open a pull request against `SolFoundry/solfoundry:main`.

3. Your PR description **must include**:
   - `Closes #<issue-number>` — links the PR to the bounty issue
   - Your Solana wallet address — this is where $FNDRY is sent on merge

Example PR description:

```
## Summary

Adds a countdown timer component to bounty cards.

## Changes

- `frontend/src/components/ui/CountdownTimer.tsx` — new component
- `frontend/src/components/bounty/BountyCard.tsx` — integrated

## Acceptance Criteria

- [x] Timer displays on bounty cards and detail page
- [x] Updates without page refresh
- [x] Visual urgency indicators

## Solana Wallet

YourSolanaWalletAddressHere

Closes #826
```

---

## Step 6: Pass the AI Review

Within 1–2 minutes of opening your PR, an automated review pipeline runs:

1. **GitHub Actions CI** — linting, type checks, tests
2. **CodeRabbit** — automated code review
3. **Multi-LLM review** — GPT, Gemini, Claude, Grok, and DeepSeek each score your PR out of 10
4. **Controller verdict** — scores are averaged (trimmed mean); T1 needs ≥ 6.0/10

If your score is too low, you'll receive feedback pointing to the problem areas. Push fixes to the same branch — the review re-runs automatically.

**Tips for passing:**
- Match the existing code style (TypeScript, Tailwind classes, existing component patterns)
- All acceptance criteria from the issue must be checked off
- No `console.log` left in production code
- Keep the change focused — don't refactor unrelated code

---

## Step 7: Get Paid

When your PR is merged:

1. The treasury contract releases $FNDRY from escrow
2. Tokens land in your Solana wallet automatically — usually within a few minutes
3. Your on-chain reputation score updates

That's it. No invoice, no claim, no waiting.

---

## Tier Progression

After 4 merged T1 PRs, T2 bounties unlock automatically. The system checks your merged PR count before allowing a T2 submission.

| Merges | Unlocks |
|--------|---------|
| 4 T1s | T2 access |
| 3 T2s (or 5 T1s + 1 T2) | T3 access |

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `Closes #N` in PR body | Add it — without it the bounty won't close |
| Missing Solana wallet address | Add your wallet address to the PR description |
| PR opened against wrong base branch | Target `main` |
| Score below threshold | Read the review feedback and push fixes |
| Branch not up to date | `git fetch upstream && git rebase upstream/main` |

---

## Resources

- Issues (bounties): [github.com/SolFoundry/solfoundry/issues](https://github.com/SolFoundry/solfoundry/issues)
- Contributing guide: [CONTRIBUTING.md](../CONTRIBUTING.md)
- Architecture overview: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- $FNDRY token on Solana: `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`
- Platform: [solfoundry.org](https://solfoundry.org)
