# SolFoundry Getting Started Tutorial (Bounty #830)

This tutorial helps a new contributor go from zero to a valid bounty PR.

---

## 1) Prerequisites

- GitHub account
- Git + Node.js (v20+ recommended)
- npm
- A Solana wallet address (for bounty payout)

---

## 2) Fork and clone

```bash
git clone git@github.com:<your-username>/solfoundry.git
cd solfoundry
git remote add upstream git@github.com:SolFoundry/solfoundry.git
```

Keep your fork up to date:

```bash
git checkout main
git fetch upstream
git merge --ff-only upstream/main
git push origin main
```

---

## 3) Run frontend locally

```bash
cd frontend
npm install
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

---

## 4) Choose a bounty

1. Go to GitHub Issues and filter by `label:bounty`.
2. Start with Tier-1 if you are new.
3. Read acceptance criteria carefully.
4. Check existing open PRs to avoid duplicating stale work.

---

## 5) Create a feature branch

```bash
git checkout -b feat/<short-bounty-name>-<issue-number>
```

Examples:
- `feat/activity-feed-822`
- `fix/oauth-flow-821`

---

## 6) Implement with acceptance criteria in mind

Use the issue checklist as your source of truth.

Tips:
- Keep changes scoped to the bounty.
- Avoid unrelated refactors.
- Prefer small, testable commits.
- Handle edge cases and loading/error states.

---

## 7) Validate before opening PR

At minimum:

```bash
cd frontend
npm run build
```

If there are known pre-existing build failures, call that out clearly in your PR and provide manual verification evidence for your touched files.

---

## 8) Push and open PR

```bash
git add .
git commit -m "feat(frontend): <what you changed>"
git push -u origin <your-branch>
```

Then open PR to `SolFoundry/solfoundry:main`.

Recommended PR body sections:
- Summary
- Why
- Acceptance mapping (checkboxes)
- Validation
- Wallet

Wallet line format:

```text
Wallet: <your-solana-wallet-address>
```

---

## 9) Comment on the bounty issue

After opening PR, add a claim comment on the issue with:
- PR link
- What was implemented
- Wallet address

This makes payout processing easier for maintainers.

---

## 10) Pass review and checks

Watch for:
- GitHub Actions checks
- Review comments
- Wallet verification labels/comments

Respond quickly and keep updates in the same PR.

---

## 11) Merge and payout

If your PR is selected and merged:
- Ensure your wallet address is present in PR/issue comments.
- Payout is sent in $FNDRY according to bounty rules.

---

## Common mistakes to avoid

- Missing wallet address
- PR title/body not linked to issue
- Not mapping acceptance criteria explicitly
- Large unrelated code changes
- Ignoring failing checks

---

## Quick PR template

```md
## Summary
- ...

## Why
Implements #<issue-number>

## Acceptance mapping
- [x] ...
- [x] ...

## Validation
- ...

## Wallet
Wallet: <your-solana-wallet-address>
```

---

Happy building ⚒️
