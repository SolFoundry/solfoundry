# 🚀 Getting Started with SolFoundry

Welcome to the SolFoundry ecosystem! SolFoundry is a decentralized marketplace for developers to contribute to high-quality Solana projects and earn rewards in **$FNDRY**.

This guide will walk you through the entire process, from finding your first bounty to getting your Pull Request (PR) merged.

---

## 1. Understanding Bounty Tiers

SolFoundry uses a tiered system to categorize tasks based on complexity and access:

| Tier | Type | Access | Description |
| :--- | :--- | :--- | :--- |
| **T1** | **Open Race** | Public | Micro-tasks, documentation, or simple bugs. Anyone can submit a PR. The best/first valid submission wins. |
| **T2** | **Intermediate** | Gated | Requires specific skills. You usually need to be assigned or "claim" the issue before starting. |
| **T3** | **Advanced** | Gated | Complex architecture or core protocol changes. Reserved for proven contributors. |

---

## 2. Finding an Issue

1. Navigate to the [SolFoundry Issues](https://github.com/SolFoundry/solfoundry/issues) tab.
2. Look for labels like `bounty`, `tier-1`, or `good first issue`.

> **Tip:** Check the `Reward` field in the issue description to see how much $FNDRY is at stake.

![Screenshot: The GitHub Issues page filtered by 'bounty' and 'tier-1' labels](https://via.placeholder.com/800x400?text=GitHub+Issues+List+with+Bounty+Labels)

---

## 3. The Contributor Workflow

### Step A: Fork and Clone
Once you find a T1 bounty you want to tackle:
1. Click the **Fork** button at the top right of the SolFoundry repository.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/solfoundry.git
   cd solfoundry
   ```

### Step B: Create a Branch
Always work on a new branch named after the issue:
```bash
git checkout -b feat/issue-1497-tutorial
```

### Step C: Development & Local Testing
Follow the instructions in the issue. If you are working on smart contracts:
- Ensure you have [Anchor](https://www.anchor-lang.com/) installed.
- Run tests: `anchor test`

---

## 4. Submitting your PR

When your code is ready:
1. Push to your fork: `git push origin feat/issue-1497-tutorial`.
2. Open a **Pull Request** against the `main` branch of `SolFoundry/solfoundry`.
3. **Crucial:** Use the provided PR template. Link the issue by writing `Closes #1497` in the description.

![Screenshot: The New Pull Request page showing the 'Closes #issue_number' syntax](https://via.placeholder.com/800x400?text=Creating+a+Pull+Request+Linking+to+Issue)

---

## 5. The AI Review Process 🤖

SolFoundry uses an automated AI review system to provide instant feedback.

1. **Spam Guard:** Upon submission, the `spam-guard.yml` workflow checks if your PR meets basic quality standards.
2. **Trigger Review:** The `trigger-review.yml` workflow initiates the analysis. Ensure your PR description contains the issue link so the bot can contextually review your changes.
3. **AI Feedback:** A bot (powered by CodeRabbit and custom scripts) will comment on your PR within minutes. It will suggest improvements or highlight potential bugs in your Rust or TypeScript code.
4. **Iterate:** Don't be discouraged by AI comments! Address the suggestions, push new commits, and the AI will re-evaluate.

![Screenshot: An example of an AI Bot comment on a PR providing code suggestions](https://via.placeholder.com/800x400?text=AI+Review+Bot+Comments+on+PR)

---

## 6. Approval and Rewards

### Review & Merge
A maintainer will review your code after the CI (Continuous Integration) passes. They might ask for manual changes. Once approved, they will merge your PR.

### Claiming $FNDRY
SolFoundry automates payments using the `bounty-tracker.yml` and `escrow-cleanup.yml` workflows.
- **T1 Bounties:** Once the PR is merged, the bounty is automatically marked as completed.
- **Payment:** Rewards are typically distributed via **Algora** or **Opire**. Ensure your GitHub profile is linked to your Solana wallet as per the project's current payment provider instructions.

---

## Quick Checklist for Success
- [ ] Did I link the issue number (e.g., `Closes #1497`)?
- [ ] Did I follow the project's coding style (see `CONTRIBUTING.md`)?
- [ ] Did all GitHub Action checks pass?
- [ ] Did I respond to the AI Reviewer's comments?

**Ready to build?** Head over to the [Issues](https://github.com/SolFoundry/solfoundry/issues) and find your first T1 task!
