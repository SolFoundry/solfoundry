# Contributing to SolFoundry

You want to build AI agents, earn $FNDRY, and ship real code. This doc tells you exactly how.

SolFoundry is an open-source AI agent bounty platform on Solana. Contributors build AI agents and tools, submit PRs, get scored by a multi-LLM review pipeline, and earn $FNDRY tokens on merge.

No applications. No interviews. Ship code, get paid.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [How Bounties Work](#how-bounties-work)
3. [Tier System](#tier-system)
4. [Claim Process](#claim-process)
5. [PR Guidelines](#pr-guidelines)
6. [Code Style](#code-style)
7. [AI Review Pipeline](#ai-review-pipeline)
8. [Anti-Farming Rules](#anti-farming-rules)
9. [Payout](#payout)

---

## Getting Started

### 1. Set Up Your Solana Wallet

You need a **Solana wallet** to receive $FNDRY payouts. [Phantom](https://phantom.app) is recommended.

Copy your public wallet address — you will need it in every PR you submit.

### 2. Set Up the Local Development Environment

#### Frontend (React + TypeScript)

**Requirements:** Node.js v18+

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

#### Backend (Python + FastAPI)

**Requirements:** Python 3.11+

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API server starts at `http://localhost:8000`. API docs are at `http://localhost:8000/docs`.

#### Smart Contracts (Anchor / Rust) — Optional

Smart contract work is only required for Tier 3 bounties that touch on-chain logic. If you are working on frontend or backend bounties, you can skip this step.

**Requirements:** Rust (stable), Solana CLI, Anchor CLI

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest && avm use latest

# Build contracts
cd contracts
anchor build

# Run tests
anchor test
```

### 3. Pick a Bounty

Browse open bounties in the [Issues tab](https://github.com/SolFoundry/solfoundry/issues). Filter by the `bounty` label.

Start with a **Tier 1 bounty** — these are open races. No claiming needed; the first quality PR wins.

---

## How Bounties Work

Each bounty is a GitHub issue with a reward denominated in $FNDRY. You build the solution, open a PR, and get paid automatically on merge.

### The Process at a Glance

1. Find a bounty issue tagged `bounty`.
2. Fork the repo and create a feature branch.
3. Build the solution described in the issue — match the spec exactly.
4. Open a PR with `Closes #N` and your Solana wallet address in the description.
5. The 5-LLM AI review pipeline scores your PR automatically within 1–2 minutes.
6. If your score meets the tier threshold, the PR is approved and merged.
7. $FNDRY is sent to your wallet automatically — typically within ~5 minutes of merge.

### 5-LLM AI Review Pipeline

Every PR is scored by **five AI models running in parallel**:

| Model | Focus |
|---|---|
| GPT-5.4 | Code quality, logic, architecture |
| Gemini 2.5 Pro | Security analysis, edge cases, test coverage |
| Grok 4 | Performance, best practices, independent verification |
| Sonnet 4.6 | Code correctness, completeness, production readiness |
| DeepSeek V3.2 | Cost-efficient cross-validation |

Each model scores your PR on a 10-point scale across six dimensions: **Quality**, **Correctness**, **Security**, **Completeness**, **Tests**, and **Integration**.

Scores are aggregated using **trimmed mean** — the highest and lowest scores are dropped and the middle three are averaged. This prevents any single model from swinging the result unfairly.

**Pass thresholds by tier:**

| Tier | Standard | Veteran (rep ≥ 80) |
|------|----------|-------------------|
| T1 | 6.0 / 10 | 6.5 / 10 |
| T2 | 6.5 / 10 | 6.0 / 10 |
| T3 | 7.0 / 10 | 6.5 / 10 |

If your score is below the threshold, you receive feedback pointing to problem areas. Fix the issues, push an update, and the pipeline re-runs. Review feedback is intentionally vague — it points to problem areas without giving exact fixes.

### Spam Filter (Auto-Rejection)

Your PR is **instantly closed** if it:

- Is missing `Closes #N` in the description
- Has an empty or trivial diff (< 5 lines of real code)
- Contains binary files or `node_modules/`
- Contains excessive TODOs or placeholders (AI slop)
- Is a duplicate of an already-merged PR for the same bounty

Your PR gets a **24-hour warning** if it is missing a Solana wallet address. Add one within 24 hours or it is auto-closed.

---

## Tier System

### Tier 1 — Open Race

- **Anyone can submit.** No prerequisites, no claiming.
- First clean PR that passes review wins.
- Score minimum: **6.0 / 10**
- Deadline: **72 hours** from issue creation
- Speed matters. If two PRs both pass, the first one merged wins.

### Tier 2 — Open Race (Gated Access)

- **Requires 4+ merged Tier 1 bounty PRs** to unlock.
- Open race — first clean PR wins, same as T1. No claiming needed.
- The claim-guard checks your merged T1 count automatically. If you do not have 4+, your PR is flagged.
- Score minimum: **6.5 / 10** (6.0 for veteran contributors with rep ≥ 80)
- Deadline: **7 days** from issue creation

### Tier 3 — Claim-Based (Gated Access)

- **Two paths to unlock T3:**
  - **Path A:** 3+ merged Tier 2 bounty PRs
  - **Path B:** 5+ merged Tier 1 bounty PRs AND 1+ merged Tier 2 bounty PR
- Comment `claiming` on the issue to reserve it. Only T3 is claim-based.
- Score minimum: **7.0 / 10** (6.5 for veteran contributors with rep ≥ 80)
- Deadline: **14 days** from claim
- Milestones may be defined in the issue for partial payouts.
- Maximum **2 concurrent T3 claims** per contributor.

### Reputation System

Reputation is an on-chain score tied to your Solana wallet. It accumulates from merged bounty PRs and affects your scoring thresholds at higher tiers.

- Veteran status is earned at **rep ≥ 80** and lowers the score threshold for T2 and T3.
- At T1, veteran contributors face a **raised** threshold (6.5 instead of 6.0) to prevent farming.

### What Counts Toward Tier Progression

Only real bounty PRs count:

- The issue **must** have both a `bounty` label and a tier label.
- Star rewards (issue #48) do **not** count.
- Content bounties (X posts, videos, articles) do **not** count.
- Non-bounty PRs (general fixes, typos, docs) do **not** count.

There are no shortcuts. You level up by shipping bounty code.

---

## Claim Process

1. **Fork this repo** to your GitHub account.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/solfoundry.git
   cd solfoundry
   ```
3. **Create a branch** for the bounty:
   ```bash
   git checkout -b feat/bounty-N-short-description
   ```
4. **Build your solution** following the issue requirements exactly.
5. **Push your branch** and open a PR against `SolFoundry/solfoundry` `main`.
6. **PR description must include:**
   - `Closes #N` — where N is the bounty issue number. **Required.** PRs without this are auto-closed.
   - **Your Solana wallet address** — paste it in the description. No wallet = no payout.

For **Tier 3 bounties only**: comment `claiming` on the issue before opening your PR to reserve the bounty. T1 and T2 are open races — do not comment claiming on them.

---

## PR Guidelines

### Branch Naming

Use the following format:

```
feat/bounty-N-short-description
```

Examples:
- `feat/bounty-18-nav-shell`
- `feat/bounty-42-wallet-connect`
- `feat/bounty-99-escrow-contract`

### Commit Conventions

Use conventional commit prefixes:

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code change that neither adds a feature nor fixes a bug
- `test:` — adding or updating tests
- `docs:` — documentation only changes
- `style:` — formatting, whitespace (no logic changes)
- `chore:` — build process, tooling changes

Example: `feat: add wallet connect modal with Phantom adapter`

### PR Description Template

```
[Brief description of what the PR implements]

Closes #N

**Wallet:** YOUR_SOLANA_WALLET_ADDRESS
```

- The `Closes #N` line is required and must appear exactly like this.
- The wallet address must be a valid Solana public key.
- Do not open a new PR for the same bounty while a previous one is still open — close the old one first.

### Checklist Before Submitting

- [ ] Branch is named `feat/bounty-N-description`
- [ ] Code matches the issue spec exactly — no over-engineering, no under-delivering
- [ ] Tests are included where required
- [ ] No linting violations (`npm run lint` / `ruff check .` pass cleanly)
- [ ] `Closes #N` is in the PR description
- [ ] Solana wallet address is in the PR description

---

## Code Style

### Frontend — TypeScript / React

- Language: **TypeScript** (strict mode). No `any` unless absolutely unavoidable.
- Components live in `frontend/src/components/`. Use functional components and hooks.
- Styling: **Tailwind CSS** utility classes. Do not add custom CSS unless Tailwind cannot achieve the result.
- State: prefer local state (`useState`, `useReducer`) before reaching for global state.
- Tests: **Vitest** + **React Testing Library**. Co-locate test files or place them in `frontend/src/__tests__/`.
- Linting: ESLint. Run `npm run lint` before submitting. Zero violations allowed.
- Formatting: Prettier. Configured in the repo root.

### Backend — Python / FastAPI

- Language: **Python 3.11+**.
- Framework: **FastAPI** with async handlers.
- Type hints on all function signatures.
- Dependencies: add new packages to `requirements.txt`.
- Tests: **pytest**. Place test files alongside source or in a `tests/` directory.
- Linting: **ruff** (`ruff check .`). Zero violations allowed.
- Formatting: **black** (`black .`). All code must be formatted before submitting.

### Smart Contracts — Rust / Anchor

- Language: **Rust stable**.
- Framework: **Anchor**.
- All public instruction handlers must have descriptive doc comments.
- Tests: Anchor TypeScript tests in `tests/`. Run with `anchor test`.
- No `unsafe` blocks without a comment explaining why they are necessary.

---

## AI Review Pipeline

Every PR is reviewed by **five AI models in parallel**:

| Model | Role |
|---|---|
| GPT-5.4 | Code quality, logic, architecture |
| Gemini 2.5 Pro | Security analysis, edge cases, test coverage |
| Grok 4 | Performance, best practices, independent verification |
| Sonnet 4.6 | Code correctness, completeness, production readiness |
| DeepSeek V3.2 | Cost-efficient cross-validation |

### Scoring Dimensions

Each model scores your PR on a 10-point scale across six dimensions:

- **Quality** — code cleanliness, structure, style
- **Correctness** — does it do what the issue asks
- **Security** — no vulnerabilities, no unsafe patterns
- **Completeness** — all acceptance criteria met
- **Tests** — test coverage and quality
- **Integration** — fits cleanly into the existing codebase

### Aggregation

Scores are aggregated using **trimmed mean** — the highest and lowest model scores are dropped, and the middle 3 are averaged. This prevents any single model from unfairly swinging the result.

High disagreement (spread > 3.0 points) is flagged for manual review.

### GitHub Actions

These actions run automatically on every PR:

| Action | What it does |
|---|---|
| `claim-guard.yml` | Validates bounty claims and tier eligibility |
| `pr-review.yml` | Triggers the multi-LLM review pipeline |
| `bounty-tracker.yml` | Tracks bounty status and contributor progress |
| `star-reward.yml` | Handles star reward payouts |
| `wallet-check.yml` | Validates wallet address is present in the PR |

---

## Anti-Farming Rules

We take this seriously.

- **No duplicate submissions.** Only one open PR per bounty per person. Close your old PR before opening a new one for the same bounty.
- **No copy-cat PRs.** Submitting code that is substantively copied from another contributor's PR — merged or open — is an instant ban.
- **No inflated descriptions.** Padding your PR description with verbose explanations of trivial changes is flagged by the spam filter.
- **No bulk-dumped AI slop.** The spam detector catches copy-pasted LLM output. If you did not write it and do not understand it, do not submit it.
- **Max 50 submissions per bounty.** After 50 failed attempts on the same bounty, you are locked out. Make each attempt count.
- **Sybil resistance.** Reputation is on-chain and tied to your Solana wallet. Alt accounts do not bypass tier requirements.

---

## Payout

- Payouts are **automatic on merge** — no manual action needed from you.
- $FNDRY is sent to the wallet address you included in the PR description.
- Typical delivery: **~5 minutes after merge**.
- Token: `$FNDRY` on Solana
- Contract address: `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`
- **No wallet = no payout.** Even if your code is perfect. Add your wallet address before the PR is merged.

---

## Quick Tips

- **Read the bounty issue carefully.** Most rejections come from not reading the requirements. Match the spec exactly.
- **Always include `Closes #N`.** No link to the bounty issue = auto-rejected.
- **Always include your Solana wallet.** No wallet = no payout, and the PR is auto-closed after 24 hours.
- **Read merged PRs from other contributors.** See what a passing submission looks like.
- **Do not ask for exact fixes.** The vague review feedback is intentional. Read the feedback, read the code, figure it out.
- **Speed matters on T1 bounties.** First clean PR wins. Do not spend three days polishing when someone else ships in three hours.

---

## Links

- **Repo**: [github.com/SolFoundry/solfoundry](https://github.com/SolFoundry/solfoundry)
- **X / Twitter**: [@foundrysol](https://x.com/foundrysol)
- **Token**: $FNDRY on Solana — `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`

---

Ship code. Earn $FNDRY. Level up.
