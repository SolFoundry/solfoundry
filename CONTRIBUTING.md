# Contributing to SolFoundry

You want to build AI agents, earn $FNDRY, and ship real code. This doc tells you exactly how.

SolFoundry is an open-source AI agent bounty platform on Solana. Contributors build AI agents and tools, submit PRs, get scored by a multi-LLM review pipeline, and earn $FNDRY tokens on merge.

No applications. No interviews. Ship code, get paid.

---

## Getting Started

1. **Star the repo.** There's a star bounty to test your setup (issue [#48](https://github.com/SolFoundry/solfoundry/issues/48)).
2. **Set up your Solana wallet.** [Phantom](https://phantom.app) recommended. You need this for payouts.
3. **Browse open bounties** in the [Issues tab](https://github.com/SolFoundry/solfoundry/issues). Filter by the `bounty` label.
4. **Pick a Tier 1 bounty.** These are open races -- no claiming needed, first quality PR wins.
5. **Fork the repo** and build your solution.
6. **Submit a PR** using the PR template. Include your wallet address and `Closes #N` referencing the bounty issue.
7. **Wait for AI review.** Usually takes minutes, not hours.
8. **Score >= 6.0 and your PR gets merged** -- $FNDRY is sent to your wallet.

> Start with the star bounty (issue #48) to test your entire workflow end to end before touching real bounties.

---

## Bounty Tier System

### Tier 1 -- Open Race

- **Anyone can submit.** No claiming, no prerequisites.
- First clean PR that passes review wins.
- Score minimum: **6.0 / 10**
- Reward: listed on each bounty issue
- Deadline: **72 hours** from issue creation
- Speed matters. If two PRs both pass, the first one merged wins.

### Tier 2 -- Claim-Based

- **Requires 4+ merged Tier 1 bounty PRs** to unlock.
- You must claim the issue before working on it.
- Score minimum: **6.0 / 10**
- Deadline: **7 days** from claim
- Max **2 concurrent T2/T3 claims** per contributor

### Tier 3 -- Claim-Based + Milestones

- **Requires 3+ merged Tier 2 bounty PRs** to unlock.
- Claim required. Milestones may be defined in the issue.
- Score minimum: **6.0 / 10**
- Deadline: **14 days** from claim
- Max **2 concurrent T2/T3 claims** per contributor

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

1. **One PR per bounty per person.** Don't submit multiple attempts.
2. **Reference the bounty issue** with `Closes #N` in the PR description.
3. **Follow the PR template.** Description, wallet address, checklist. All of it.
4. **Code must be clean, tested, and match the issue spec exactly.** Don't over-engineer, don't under-deliver.
5. **Max 2 concurrent T2/T3 claims** per contributor. Finish what you started.

---

## AI Review Pipeline

Every PR is reviewed by **3 AI models in parallel**:

| Model | Role |
|---|---|
| GPT-5.4 | Primary review |
| Gemini 2.5 Pro | Secondary review |
| Grok 4 | Tertiary review |

### Scoring

Each model scores your PR on a 10-point scale across five dimensions:

- **Quality** -- code cleanliness, structure, style
- **Correctness** -- does it do what the issue asks
- **Security** -- no vulnerabilities, no unsafe patterns
- **Performance** -- efficient, no unnecessary overhead
- **Documentation** -- comments, docstrings, clear naming

Minimum to pass: **6.0 / 10**

### How It Works

1. **Spam filter runs first.** Empty diffs, AI-generated slop, and low-effort submissions are auto-rejected before models even look at them.
2. **Three models review independently.** Each produces a score and feedback.
3. **Feedback is intentionally vague.** The review points to problem areas without giving you exact fixes. This is by design -- figure it out.
4. **Disagreements between models escalate to human review.**

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

- **3 rejected PRs = temporary ban.** Don't waste everyone's time.
- **Bulk-dumped AI slop is auto-filtered.** The spam detector catches copy-pasted ChatGPT output. If you didn't write it, don't submit it.
- **One PR per bounty per person.** No second chances on the same issue.
- **Sybil resistance** via on-chain reputation tied to your Solana wallet. Alt accounts don't work here.

---

## Quick Tips

- **Start with the star bounty** (issue [#48](https://github.com/SolFoundry/solfoundry/issues/48)) to test your entire workflow before touching real bounties.
- **Read merged PRs from other contributors.** See what a passing submission looks like.
- **Don't ask for exact fixes.** The vague review feedback is intentional. Read the feedback, read the code, figure it out.
- **Speed matters on T1 bounties.** First clean PR wins. Don't spend three days polishing when someone else ships in three hours.
- **Check the issue spec carefully.** Most rejections come from not reading the requirements.

---

## Links

- **Repo**: [github.com/SolFoundry/solfoundry](https://github.com/SolFoundry/solfoundry)
- **X / Twitter**: [@foundrysol](https://x.com/foundrysol)
- **Token**: $FNDRY on Solana -- `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`

---

Ship code. Earn $FNDRY. Level up.
