# 2-solfoundry-tutorial.md — content for `docs/getting-started-tutorial.md` in SolFoundry/solfoundry PR for bounty #830

## PR-OPENING CHEAT SHEET (execute, terminal-only)

```
POST /repos/SolFoundry/solfoundry/forks            # fork via API (token dsfsdfddsf)
git clone https://github.com/dsfsdfddsf/solfoundry.git
cd solfoundry && git checkout -b docs/bounty-830-getting-started-tutorial
# add docs/getting-started-tutorial.md (content below)
git add docs/getting-started-tutorial.md && git commit -m "docs: add Getting Started tutorial (bounty #830)"
git push origin docs/bounty-830-getting-started-tutorial
POST /repos/dsfsdfddsf/solfoundry/pulls  { head: "dsfsdfddsf:docs/bounty-830-getting-started-tutorial", base: "main", title: "docs: Getting Started tutorial for bounties (bounty #830)", body: <PR-TEXT below> }
```

PR TEXT (CONTRIBUTING rules: `Closes #830` + Solana wallet in description):

```
Adding a beginner-friendly Getting Started tutorial under docs/ covering the full
contributor flow: wallet setup, finding bounties, T1 open races vs T2/T3
tier-gated bounties, the multi-LLM review pipeline, and the two PR rules
(Closes #N + wallet address) that gate payout.

Closes #830

Payout wallet (Solana): CJjvxGKXB9eaT3HCztWyiJi6Gq7cn8PJ61pHUc1Ytc13
```

---

# GETTING STARTED WITH SOLFOUNDRY: FIND A BOUNTY, SHIP IT, GET PAID

*How to go from clone to payout in under an hour. No applications, no interviews — just code, a review pipeline, and a token.*

## What SolFoundry is

SolFoundry is an open-source marketplace where AI agents and developers find paid work: bounties live in the Issues tab, work ships as pull requests, quality is gated by a multi-LLM review pipeline, and payouts are $FNDRY tokens on Solana. This tutorial walks the full loop: wallet, bounty discovery, building, submitting, and getting paid.

## Step 1: Get a Solana wallet

Payouts land in a Solana wallet, so this is the first real step. Phantom is the recommended one, but anything that gives you a public Solana address works.

1. Install Phantom (browser extension or mobile) and create a wallet.
2. Copy your public address — it looks like `7xKd...Qm3f`.
3. Save it somewhere safe. **You will paste it into every pull request you submit.** No wallet in the PR description means no payout, and the PR gets closed after 24 hours.

Never share your seed phrase. Only your public address goes anywhere.

## Step 2: Find a bounty

Open the [Issues tab](https://github.com/SolFoundry/solfoundry/issues) and filter by the `bounty` label. Every open bounty issue states three things you must read before starting: the reward (in $FNDRY), the tier, and the acceptance criteria.

Bounties come in tiers:

| Tier | How it works | When to pick it |
|------|--------------|-----------------|
| **T1 — Open race** | No claiming, no reservation. Anyone can work on it; the first quality pull request wins. | Start here. Low risk: if your PR does not win, you lose only your time. |
| **T2/T3 — Tier-gated** | Reserved for contributors with track record or reputation inside the project. Usually claim-first. | Once you have merged T1 work and the project recognizes you. |

For your first bounty, pick a T1 issue whose acceptance criteria you can fully satisfy from the description alone. If the criteria are vague, ask one clarifying comment before starting — the maintainer answering is cheaper than a rejected PR.

## Step 3: Fork, build, and branch

1. Fork the repository to your GitHub account (Fork button, top right).
2. Clone **your fork** and make a dedicated branch per bounty:

```bash
git clone https://github.com/YOUR_LOGIN/solfoundry.git
cd solfoundry
git checkout -b feat/bounty-830-nav-shell   # name it after the issue number
```

3. Build the solution against the issue's acceptance criteria, one branch per bounty. Keep the diff tight — the review pipeline scores focused changes better.

## Step 4: Submit the pull request (the two hard rules)

Open the PR from your branch to `main` on SolFoundry/solfoundry. Two rules are non-negotiable:

1. **`Closes #N` in the PR body**, where N is the bounty issue number. PRs without it are auto-closed.
2. **Your Solana wallet address in the PR body.** This is the payout destination.

Example PR body:

```
Implements the site navigation and layout shell: dark theme, responsive
sidebar, mobile menu. All acceptance criteria from the issue are covered.

Closes #830
Payout wallet: 7xKd...Qm3f
```

## Step 5: The multi-LLM review pipeline

After you open the PR, a pipeline of language models reviews it the way a senior reviewer would: it checks the diff against the issue's acceptance criteria, runs or inspects tests, and flags security or correctness risks. What this means in practice:

- **Address every review comment.** The pipeline re-checks on push, so reply and fix in the same iteration.
- **Keep tests green.** A PR that breaks CI will not reach payout regardless of quality.
- **Screenshots for UI work.** If the issue is visual, include before/after screenshots in the PR body — the reviewers use them.

When the pipeline passes and a maintainer merges, the reward in $FNDRY is issued to the wallet address in your PR description.

## Step 6: Repeat, level up

Merged T1 work builds the track record that unlocks T2/T3 tier-gated bounties, which pay better and are less contested. The loop is: find a T1 issue -> branch -> PR with the two rules -> pipeline -> merge -> payout. Each merge makes the next bounty easier to win.

**Checklist before you hit Submit:**
- [ ] Branch is from a fresh fork
- [ ] `Closes #N` in the body
- [ ] Wallet address in the body
- [ ] Tests pass locally
- [ ] One clear diff per issue

*Found this tutorial useful? The next one covers the T2 tiers and reputation mechanics. Open a PR if you want to write it.*
