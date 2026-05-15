# Getting Started with SolFoundry

> A complete guide to finding bounties, submitting PRs, and earning rewards.

## Table of Contents
1. [What is SolFoundry?](#what-is-solfoundry)
2. [Finding Bounties](#finding-bounties)
3. [Understanding Bounty Tiers](#understanding-bounty-tiers)
4. [Submitting Your First PR](#submitting-your-first-pr)
5. [The AI Review Process](#the-ai-review-process)
6. [Earning Rewards](#earning-rewards)

---

## What is SolFoundry?

SolFoundry is a decentralized bounty platform built on Solana. It connects open-source projects with contributors through bounties — tasks with financial rewards paid in $FNDRY tokens.

**Key features:**
- Browse open bounties across any GitHub repository
- Submit PRs directly through the platform
- AI-powered code review for faster feedback
- Transparent reward distribution via smart contracts

## Finding Bounties

### Step 1: Browse the Bounties Page
Navigate to **/bounties** to see all available bounties. Use filters to narrow down:
- **Status**: Open, In Progress, Completed
- **Language**: TypeScript, Rust, Python, etc.
- **Difficulty**: T1 (Beginner), T2 (Intermediate), T3 (Advanced)

### Step 2: Read the Bounty Details
Click on a bounty to see:
- Description and requirements
- Reward amount in $FNDRY
- Acceptance criteria
- Deadline (if any)

### Step 3: Claim the Bounty
Comment on the issue to signal your intent. For T1 bounties (open race), multiple contributors can submit simultaneously.

## Understanding Bounty Tiers

### T1 — Open Race (Beginner-Friendly)
- **Reward**: 100,000 – 150,000 $FNDRY
- **Who can participate**: Anyone
- **How winners are chosen**: First approved PR wins, or best submission
- **Examples**: UI components, documentation, bug fixes

### T2 — Tier-Gated (Intermediate)
- **Reward**: 200,000 – 500,000 $FNDRY
- **Who can participate**: Contributors who have completed at least 1 T1 bounty
- **How winners are chosen**: Best submission by deadline
- **Examples**: Feature development, API integrations, design work

### T3 — Expert
- **Reward**: 500,000+ $FNDRY
- **Who can participate**: Contributors with proven track record
- **How winners are chosen**: Detailed review + community vote
- **Examples**: Architecture decisions, complex features, agent systems

## Submitting Your First PR

### Step 1: Fork the Repository
```bash
# Fork via GitHub CLI
gh repo fork owner/repo --clone

# Or use the GitHub web interface
```

### Step 2: Create a Feature Branch
```bash
git checkout -b feat/my-bounty-solution
```

### Step 3: Make Your Changes
Follow the repository's CONTRIBUTING.md and the bounty's acceptance criteria.

### Step 4: Submit Your PR
```bash
git push origin feat/my-bounty-solution
# Then create a PR via GitHub
gh pr create --title "feat: my bounty solution" --body "Closes #123"
```

### Step 5: Reference the Bounty
In your PR description, include:
- The bounty issue number
- Your wallet address for reward distribution
- Any relevant screenshots or demos

## The AI Review Process

After submitting your PR:

1. **Automated Review**: Our AI reviews your code within minutes
2. **Feedback**: You receive structured feedback on:
   - Code quality and best practices
   - Test coverage
   - Security considerations
3. **Revision**: Address feedback and push updates
4. **Final Review**: AI performs a second review
5. **Approval**: Maintainer reviews and merges

### Tips for Passing AI Review
- Write clean, well-documented code
- Include tests for new functionality
- Follow the project's existing patterns
- Keep PRs focused on a single bounty

## Earning Rewards

### Reward Distribution
- Rewards are paid in $FNDRY tokens on Solana
- After PR merge, rewards are distributed within 24-48 hours
- You need a Solana wallet connected to your SolFoundry account

### Building Your Reputation
- Complete T1 bounties to unlock T2
- Consistent quality work builds your contributor score
- Top contributors get priority access to high-value bounties

### Getting Help
- **Discord**: Join our community for questions
- **GitHub Discussions**: Ask questions about specific bounties
- **Documentation**: Check /docs for detailed guides

---

*Happy contributing! 🚀*
