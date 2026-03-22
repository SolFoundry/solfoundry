# Contributing to SolFoundry

You want to build AI agents, earn $FNDRY, and ship real code. This doc tells you exactly how.

SolFoundry is an open-source AI agent bounty platform on Solana. Contributors build AI agents and tools, submit PRs, get scored by a multi-LLM review pipeline, and earn $FNDRY tokens on merge.

No applications. No interviews. Ship code, get paid.

---

## Getting Started

### Step 1: Set Up Your Wallet

You need a **Solana wallet** to receive $FNDRY payouts. [Phantom](https://phantom.app) is recommended.

Copy your wallet address — you'll need it for every PR you submit.

### Step 2: Pick a Bounty

Browse open bounties in the [Issues tab](https://github.com/SolFoundry/solfoundry/issues). Filter by the `bounty` label.

Start with a **Tier 1 bounty** — these are open races. No claiming needed, first quality PR wins.

### Step 3: Fork & Build

1. **Fork this repo** to your GitHub account
2. **Clone your fork** locally
3. **Create a branch** for the bounty (e.g. `feat/bounty-18-nav-shell`)
4. **Build your solution** following the issue requirements exactly

### Step 4: Submit Your PR

This is the most important part. **Follow these rules exactly or your PR will be rejected:**

1. **Title:** Descriptive — e.g. `feat: Implement site navigation shell`
2. **PR description must include:**
   - `Closes #N` — where N is the bounty issue number (e.g. `Closes #18`). **Required.** PRs without this are auto-closed.
   - **Your Solana wallet address** — paste it in the description. No wallet = no payout, and your PR will be closed after 24 hours if you don't add one.
3. **Push your branch** and open the PR against `main`

**Example PR description:**
```
Implements the site navigation and layout shell with dark theme, responsive sidebar, and mobile menu.

Closes #18

**Wallet:** 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### Step 5: AI Review

Your PR is automatically reviewed by **5 AI models in parallel** (GPT-5.4, Gemini 2.5 Pro, Grok 4, Sonnet 4.6, DeepSeek V3.2). This usually takes 1-2 minutes.

- Scores are aggregated using **trimmed mean** — highest and lowest are dropped, middle 3 averaged.
- **T1:** Score ≥ 6.0/10 → approved for merge → $FNDRY sent to your wallet automatically.
- **T2:** Score ≥ 7.0/10 (6.5 for veteran contributors with rep ≥ 80).
- **T3:** Score ≥ 7.5/10 (7.0 for veteran contributors with rep ≥ 80).
- Score below threshold → changes requested with feedback. Fix the issues and push an update.
- Review feedback is intentionally vague — it points to problem areas without giving exact fixes.

### Spam Filter (Auto-Rejection)

Your PR will be **instantly closed** if:
- Missing `Closes #N` in the description
- Empty or trivial diff (< 5 lines of real code)
- Contains binary files or `node_modules/`
- Excessive TODOs/placeholders (AI slop)
- Duplicate — another PR for the same bounty was already merged

Your PR gets a **24-hour warning** if:
- Missing Solana wallet address — add it within 24 hours or it's auto-closed

> **💡 Tip:** There's also a temporary star bounty (issue [#48](https://github.com/SolFoundry/solfoundry/issues/48)) — star the repo and comment with your wallet to earn 10,000 $FNDRY. This is a one-time promo and does NOT count toward tier progression.

---

## Bounty Tier System

### Tier 1 -- Open Race

- **Anyone can submit.** No claiming, no prerequisites.
- First clean PR that passes review wins.
- Score minimum: **6.0 / 10**
- Reward: listed on each bounty issue
- Deadline: **72 hours** from issue creation
- Speed matters. If two PRs both pass, the first one merged wins.

### Tier 2 -- Open Race (Gated Access)

- **Requires 4+ merged Tier 1 bounty PRs** to unlock.
- Open race — first clean PR wins, same as T1. No claiming needed.
- The claim-guard checks your merged T1 count automatically. If you don't have 4+, your PR gets flagged.
- Score minimum: **7.0 / 10** (6.5 for veteran contributors with rep ≥ 80)
- Deadline: **7 days** from issue creation

### Tier 3 -- Claim-Based (Gated Access)

- **Two paths to unlock T3:**
  - **Path A:** 3+ merged Tier 2 bounty PRs
  - **Path B:** 5+ merged Tier 1 bounty PRs AND 1+ merged Tier 2 bounty PR
- Comment "claiming" on the issue to reserve it. Only T3 is claim-based.
- Score minimum: **7.5 / 10** (7.0 for veteran contributors with rep ≥ 80)
- Deadline: **14 days** from claim
- Milestones may be defined in the issue for partial payouts.
- Max **2 concurrent T3 claims** per contributor

### What Counts Toward Tier Progression

Only real bounty PRs count. Specifically:

- The issue **must** have both a `bounty` label and a tier label
- Star rewards (issue #48) do **NOT** count
- Content bounties (X posts, videos, articles) do **NOT** count
- Non-bounty PRs (general fixes, typos, docs) do **NOT** count

There are no shortcuts here. You level up by shipping bounty code.

---

## Wallet Requirements

Every PR **must** include a Solana wallet address in the PR description. Use the PR template -- it has a field for this.

- No wallet = no payout. Even if your code is perfect.
- The `wallet-check.yml` GitHub Action will warn you if the wallet is missing.
- Payouts are in **$FNDRY** on Solana.
  - Token: `$FNDRY`
  - CA: `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`

---

## PR Rules

1. **Max 50 submissions per bounty per person.** Make each attempt count — iterate on review feedback.
2. **Reference the bounty issue** with `Closes #N` in the PR description.
3. **Follow the PR template.** Description, wallet address, checklist. All of it.
4. **Code must be clean, tested, and match the issue spec exactly.** Don't over-engineer, don't under-deliver.
5. **Max 2 concurrent T3 claims** per contributor. Finish what you started.

---

## AI Review Pipeline

Every PR is reviewed by **5 AI models in parallel**:

| Model | Role |
|---|---|
| GPT-5.4 | Code quality, logic, architecture |
| Gemini 2.5 Pro | Security analysis, edge cases, test coverage |
| Grok 4 | Performance, best practices, independent verification |
| Sonnet 4.6 | Code correctness, completeness, production readiness |
| DeepSeek V3.2 | Cost-efficient cross-validation |

### Scoring

Each model scores your PR on a 10-point scale across six dimensions:

- **Quality** -- code cleanliness, structure, style
- **Correctness** -- does it do what the issue asks
- **Security** -- no vulnerabilities, no unsafe patterns
- **Completeness** -- all acceptance criteria met
- **Tests** -- test coverage and quality
- **Integration** -- fits cleanly into the existing codebase

Scores are aggregated using **trimmed mean** — the highest and lowest model scores are dropped, and the middle 3 are averaged. This prevents any single model from unfairly swinging the result.

**Pass thresholds by tier:**

| Tier | Standard | Veteran (rep ≥ 80) |
|------|----------|-------------------|
| T1 | 6.0/10 | 6.5/10 (raised to prevent farming) |
| T2 | 7.0/10 | 6.5/10 |
| T3 | 7.5/10 | 7.0/10 |

### How It Works

1. **Spam filter runs first.** Empty diffs, AI-generated slop, and low-effort submissions are auto-rejected before models even look at them.
2. **Five models review independently.** Each produces a score and feedback.
3. **Trimmed mean aggregation.** Highest and lowest scores dropped, middle 3 averaged.
4. **Feedback is intentionally vague.** The review points to problem areas without giving you exact fixes. This is by design -- figure it out.
5. **High disagreement (spread > 3.0 points) is flagged** for manual review.

### GitHub Actions

These actions run automatically on your PR:

| Action | What it does |
|---|---|
| `claim-guard.yml` | Validates bounty claims and tier eligibility |
| `pr-review.yml` | Triggers the multi-LLM review pipeline |
| `bounty-tracker.yml` | Tracks bounty status and contributor progress |
| `star-reward.yml` | Handles star reward payouts |
| `wallet-check.yml` | Validates wallet address is present in PR |

---

## Anti-Spam Policy

We take this seriously.

- **Max 50 submissions per bounty.** After 50 failed attempts on the same bounty, you're locked out. Make each one count.
- **Bulk-dumped AI slop is auto-filtered.** The spam detector catches copy-pasted ChatGPT output. If you didn't write it, don't submit it.
- **One open PR per bounty per person.** Close your old PR before opening a new one for the same bounty.
- **Sybil resistance** via on-chain reputation tied to your Solana wallet. Alt accounts don't work here.

---

## Quick Tips

- **Read the bounty issue carefully.** Most rejections come from not reading the requirements. Match the spec exactly.
- **Always include your Solana wallet in the PR description.** No wallet = no payout.
- **Always include `Closes #N`.** No link to the bounty issue = auto-rejected.
- **Read merged PRs from other contributors.** See what a passing submission looks like.
- **Don't ask for exact fixes.** The vague review feedback is intentional. Read the feedback, read the code, figure it out.
- **Speed matters on T1 bounties.** First clean PR wins. Don't spend three days polishing when someone else ships in three hours.

---

## Links

- **Repo**: [github.com/SolFoundry/solfoundry](https://github.com/SolFoundry/solfoundry)
- **X / Twitter**: [@foundrysol](https://x.com/foundrysol)
- **Token**: $FNDRY on Solana -- `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`

---

Ship code. Earn $FNDRY. Level up.
