# Getting Started with SolFoundry Bounties

Want to earn by shipping code? This quick guide walks you from setup to bounty claim.

## 1) Set up essentials

- GitHub account
- Solana wallet (for payout)
- Git + Node.js + npm

## 2) Find a bounty

Open SolFoundry issues and filter for `bounty` + `tier-1`.
Pick one issue and read acceptance criteria carefully.

## 3) Fork and branch

```bash
git clone git@github.com:<your-user>/solfoundry.git
cd solfoundry
git checkout -b feat/<short-name>-<issue-number>
```

## 4) Build the fix

Keep scope tight:
- Implement only what the issue asks
- Handle loading/error states
- Avoid unrelated refactors

## 5) Validate

```bash
cd frontend
npm run build
```

If build is blocked by known repo-wide issues, call that out clearly in PR validation notes.

## 6) Open PR

Use a clear format:
- Summary
- Why
- Acceptance mapping checklist
- Validation
- Wallet line

Example wallet line:

```text
Wallet: <your-solana-wallet-address>
```

## 7) Comment on issue

After PR is open, comment on the bounty issue with:
- PR link
- short delivery summary
- wallet address

## 8) Track checks and feedback

Watch:
- trigger-review
- check-wallet
- comments/review notes

Respond fast, keep changes focused, and update the same PR.

---

Good luck — build fast, ship clean, and earn $FNDRY.
