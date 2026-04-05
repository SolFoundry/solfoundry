# Getting Started with SolFoundry: A Complete Contributor Guide

> Earn $FNDRY tokens by contributing code, docs, and creative assets to SolFoundry bounties.

## Table of Contents

1. [What is SolFoundry?](#what-is-solfoundry)
2. [How Bounties Work](#how-bounties-work)
3. [Setting Up Your Environment](#setting-up-your-environment)
4. [Finding a Bounty](#finding-a-bounty)
5. [Working on a Bounty](#working-on-a-bounty)
6. [Submitting Your Work](#submitting-your-work)
7. [The AI Review Process](#the-ai-review-process)
8. [Getting Paid](#getting-paid)
9. [Tips for Success](#tips-for-success)

---

## What is SolFoundry?

SolFoundry is an open-source bounty platform where contributors earn **$FNDRY tokens** for completing tasks. Bounties range from documentation and frontend components to backend features and creative assets.

## How Bounties Work

### Bounty Tiers

| Tier | Access | Reward Range | Description |
|------|--------|-------------|-------------|
| **T1** | Open Race | 50K–200K $FNDRY | Anyone can submit. First quality PR wins. |
| **T2** | Tier-Gated | 200K–500K $FNDRY | Requires contributor reputation or approval. |
| **T3** | Tier-Gated | 500K–1M+ $FNDRY | Complex features; requires proven track record. |

### Bounty Lifecycle

```
📋 Open → 🔨 In Progress → 📤 PR Submitted → 🤖 AI Review → ✅ Merged → 💰 Paid
```

1. **Open**: Bounty is available for anyone (T1) or qualified contributors (T2/T3).
2. **In Progress**: A contributor forks the repo and starts working.
3. **PR Submitted**: Work is submitted as a Pull Request referencing the bounty issue.
4. **AI Review**: An automated AI code reviewer checks quality, tests, and acceptance criteria.
5. **Merged**: Maintainers approve and merge the PR.
6. **Paid**: $FNDRY tokens are distributed to the contributor's wallet.

## Setting Up Your Environment

### Prerequisites

- **Git** (v2.30+)
- **Node.js** (v18+ recommended)
- **GitHub account** with SSH or HTTPS configured

### Step 1: Fork the Repository

```bash
# Using GitHub CLI (recommended)
gh repo fork SolFoundry/solfoundry --clone

# Or manually: click "Fork" on https://github.com/SolFoundry/solfoundry
# Then clone your fork:
git clone https://github.com/YOUR_USERNAME/solfoundry.git
```

### Step 2: Set Up Upstream Remote

```bash
cd solfoundry
git remote add upstream https://github.com/SolFoundry/solfoundry.git
git fetch upstream
```

### Step 3: Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Backend (if working on backend bounties)
cd ../router && npm install
```

### Step 4: Run Locally

```bash
# Start the frontend dev server
cd frontend && npm run dev

# In another terminal, start the backend
cd router && npm start
```

## Finding a Bounty

### Browse Open Bounties

1. Go to [SolFoundry Issues](https://github.com/SolFoundry/solfoundry/issues)
2. Filter by the `bounty` label
3. Look for your tier:
   - `tier-1` — Open to everyone
   - `tier-2` — Requires some reputation
   - `tier-3` — Advanced contributors

### Filter by Domain

Use label filters to find bounties matching your skills:

- `frontend` — React/TypeScript UI components
- `backend` — API endpoints, database, auth
- `docs` — Documentation and tutorials
- `creative` — Design, video, graphics
- `contracts` — Smart contracts (Solidity)

### Check Availability

- **0 comments** = likely unclaimed
- Read existing comments to see if someone is already working on it
- Comment on the issue to claim it (optional but recommended)

## Working on a Bounty

### Step 1: Create a Feature Branch

```bash
# Always start from the latest main
git checkout main
git pull upstream main
git checkout -b bounty/issue-NUMBER-short-description
```

**Example:**
```bash
git checkout -b bounty/825-toast-notification-system
```

### Step 2: Understand the Requirements

Every bounty issue includes:

- **Description**: What needs to be built
- **Requirements**: Specific technical requirements
- **Acceptance Criteria**: Checkboxes that must all pass

Read these carefully. Your PR will be reviewed against the acceptance criteria.

### Step 3: Write Quality Code

- Follow existing code style and conventions
- Add comments for complex logic
- Include TypeScript types (no `any` unless absolutely necessary)
- Write tests if the bounty requires them

### Step 4: Test Your Changes

```bash
# Run the test suite
npm test

# Check TypeScript compilation
npx tsc --noEmit

# Run linting
npm run lint
```

## Submitting Your Work

### Step 1: Commit with a Clear Message

```bash
git add .
git commit -m "feat: add toast notification system

- Toast component with success/error/warning/info variants
- Auto-dismiss after 5 seconds with manual close
- Slide-in animation from top-right
- Accessible with role='alert'

Closes #825"
```

### Step 2: Push and Create a PR

```bash
git push origin bounty/825-toast-notification-system

# Create PR using GitHub CLI
gh pr create \
  --title "feat: Toast Notification System (Bounty #825)" \
  --body "## Summary
Implements the toast notification system as described in #825.

## Changes
- Added Toast component with 4 variants
- Auto-dismiss with configurable timeout
- Stacking support for multiple toasts
- Full accessibility support

## Checklist
- [x] Toast notifications appear for key actions
- [x] Auto-dismiss with manual close option
- [x] Multiple toasts stack properly

Closes #825"
```

### PR Best Practices

- **Reference the issue**: Include `Closes #NUMBER` in the PR body
- **Describe your changes**: Explain what you built and why
- **Include screenshots**: For frontend bounties, add before/after screenshots
- **Keep it focused**: One bounty per PR

## The AI Review Process

After you submit a PR, SolFoundry's AI review system automatically:

1. **Checks code quality** — Style, types, potential bugs
2. **Verifies acceptance criteria** — Matches requirements from the issue
3. **Runs tests** — Ensures nothing is broken
4. **Provides feedback** — Comments on the PR with suggestions

### What the AI Looks For

| Check | What It Means |
|-------|---------------|
| ✅ Code Quality | Clean, readable, well-typed code |
| ✅ Acceptance Criteria | All checkboxes from the issue are met |
| ✅ Tests Pass | Existing tests still pass, new tests added if required |
| ✅ No Regressions | Your changes don't break existing features |

### If the AI Requests Changes

- Read the feedback carefully
- Make the requested changes
- Push new commits to the same branch
- The AI will re-review automatically

## Getting Paid

Once your PR is merged:

1. $FNDRY tokens are allocated to your contributor profile
2. Connect your Solana wallet to claim tokens
3. Tokens can be held, traded, or used within the SolFoundry ecosystem

## Tips for Success

### Do's ✅

- **Start with T1 bounties** to build reputation
- **Claim the bounty** by commenting on the issue before starting
- **Ask questions** if requirements are unclear
- **Submit early** — T1 bounties are open race (first quality PR wins)
- **Follow the existing codebase patterns** — consistency matters

### Don'ts ❌

- **Don't submit half-finished work** — quality over speed
- **Don't work on claimed bounties** without checking first
- **Don't ignore the acceptance criteria** — they're your checklist
- **Don't submit PRs without testing** — the AI will catch it

### Pro Tips 💡

- Watch the repo for new bounties: `gh repo watch SolFoundry/solfoundry`
- Set up notifications for the `bounty` label
- Build on existing components — check `frontend/src/components/` first
- Read `CONTRIBUTING.md` for repo-specific guidelines

---

**Ready to start?** Browse [open bounties](https://github.com/SolFoundry/solfoundry/issues?q=is%3Aissue+is%3Aopen+label%3Abounty) and find your first task!

*Happy building! 🏭*
