# Getting Started with SolFoundry

A step-by-step guide to finding bounties, contributing code, and earning $FNDRY rewards.

## What is SolFoundry?

SolFoundry is an autonomous AI software factory on Solana. It coordinates bounty-based development where contributors submit pull requests, get AI-reviewed, and earn $FNDRY tokens.

## Bounty Tiers

| Tier | Access | Description |
|------|--------|-------------|
| **T1** | Open Race | Anyone can claim. Best for beginners. |
| **T2** | Tier-gated | Requires 3+ merged T2 bounties first. |
| **T3** | Tier-gated | Requires 3+ merged T2 bounties. Higher rewards. |

**New contributors should start with T1 bounties.**

## Step 1: Find a Bounty

1. Go to the [Issues tab](https://github.com/SolFoundry/solfoundry/issues)
2. Filter by `bounty` label
3. Look for issues with **T1 (Open Race)** in the title
4. Check that the issue has no assignees (nobody claimed it yet)

> **Tip:** Sort by "Recently updated" to find fresh bounties before others claim them.

## Step 2: Understand the Requirements

Each bounty issue contains:
- **Reward:** Amount in $FNDRY tokens
- **Tier:** T1, T2, or T3
- **Domain:** Frontend, Backend, Creative, Documentation
- **Description:** What needs to be built
- **Acceptance Criteria:** Checklist of requirements

Read the acceptance criteria carefully. Your PR must satisfy every checkbox.

## Step 3: Set Up the Project

```bash
# Fork the repository
gh repo fork SolFoundry/solfoundry --clone=false

# Clone your fork
git clone https://github.com/YOUR_USERNAME/solfoundry.git
cd solfoundry

# Install dependencies
cd frontend
npm install

# Start development server
npm run dev
```

## Step 4: Implement the Feature

1. Create a new branch: `git checkout -b feat/bounty-<issue-number>-<short-name>`
2. Write your code following the existing patterns
3. Test locally with `npm run dev`
4. Run tests: `npm run test`
5. Commit with a clear message referencing the bounty: `git commit -m "feat: description (closes #<issue-number>)"`

## Step 5: Submit Your PR

```bash
git push -u origin feat/bounty-<issue-number>-<short-name>
gh pr create --repo SolFoundry/solfoundry \
  --title "feat: description (Bounty #<issue-number>)" \
  --body "Closes #<issue-number>

## Changes
- What you built
- How it works

## Acceptance Criteria
- [x] Criterion 1
- [x] Criterion 2" \
  --head YOUR_USERNAME:feat/bounty-<issue-number>-<short-name>
```

## Step 6: AI Review

After submitting:
1. SolFoundry runs **automated AI code review** on your PR
2. The review checks code quality, patterns, and correctness
3. Address any feedback from the review
4. Once approved, maintainers will merge your PR

## Step 7: Get Paid

After your PR is merged:
- $FNDRY tokens are sent to your wallet
- Check the [Leaderboard](https://github.com/SolFoundry/solfoundry) for your ranking
- Tier-up by completing more bounties to unlock T2/T3

## Tips for Success

- **Start with T1** bounties to build your track record
- **Read existing code** before implementing — follow the same patterns
- **Small, focused PRs** are more likely to pass review
- **Test locally** before pushing
- **Write clear PR descriptions** with acceptance criteria checklists
- **Be responsive** to review feedback

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Animations | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |
| State | TanStack Query |

## Need Help?

- Check existing PRs for patterns
- Read the [CONTRIBUTING.md](https://github.com/SolFoundry/solfoundry/blob/main/CONTRIBUTING.md) guide
- Open a discussion on the issue if something is unclear

Happy hunting! 🏭
