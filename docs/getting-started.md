# Getting Started with SolFoundry: A Complete Contributor Guide

## What is SolFoundry?

SolFoundry is a decentralized bounty platform built on Solana where developers earn $FNDRY tokens by completing open-source tasks. Bounties range from documentation and design (T1) to complex agent systems (T3), with rewards scaling accordingly.

## How It Works

### Bounty Tiers

| Tier | Access | Typical Reward | Examples |
|------|--------|---------------|----------|
| **T1** | Open to everyone | 50K-150K $FNDRY | Docs, UI fixes, design, blog posts |
| **T2** | 4+ merged T1 bounties | 500K-600K $FNDRY | Integrations, bots, extensions |
| **T3** | 3+ merged T2 bounties | 750K-1M $FNDRY | SDKs, agents, marketplaces |

T1 bounties are **open race** - the first quality PR wins. T2/T3 are gated by your track record.

## Step-by-Step: Your First Bounty

### Step 1: Find a Bounty

1. Visit the [SolFoundry issues page](https://github.com/SolFoundry/solfoundry/issues)
2. Filter by labels: `bounty` + `tier-1` for open bounties
3. Look for issues matching your skills: `frontend`, `docs`, `creative`, `backend`
4. Check if the bounty is unclaimed or has few competing PRs

### Step 2: Claim It

Comment on the issue to signal your intent:

```
/attempt #<issue-number>
I'm working on this bounty. ETA: <your estimate>.
FNDRY wallet: <your-solana-wallet-address>
```

### Step 3: Fork and Clone

```bash
# Fork via GitHub CLI or UI
gh repo fork SolFoundry/solfoundry --clone

# Create a branch for your bounty
cd solfoundry
git checkout -b bounty/issue-<number>-<short-description>
```

### Step 4: Build Your Solution

- Read the issue requirements and acceptance criteria carefully
- Follow existing code patterns in the repository
- Include tests where applicable
- Write clear commit messages referencing the issue

```bash
git add .
git commit -m "feat: implement <feature> (closes #<issue-number>)"
```

### Step 5: Submit Your Pull Request

```bash
git push origin bounty/issue-<number>-<short-description>
```

Then create a PR:
- **Title:** `[Bounty #<number>] <Description>`
- **Body:** Reference the issue, explain your approach
- **Link:** `Closes #<number>`

### Step 6: AI Review

SolFoundry uses AI-powered code review. Your PR is automatically analyzed for:
- Code quality and adherence to project standards
- Completeness against the acceptance criteria
- Test coverage and documentation

Address feedback promptly - the first quality PR wins!

### Step 7: Earn Rewards

Once merged:
- $FNDRY tokens are sent to your registered wallet
- Your contribution count increases, unlocking higher tiers
- 4 merged T1s unlock T2 access; 3 merged T2s unlock T3

## Tips for Success

1. **Start with T1 bounties** to build reputation
2. **Read existing PRs** to learn quality expectations
3. **Be fast but thorough** - T1 is first-come-first-served
4. **Work multiple bounties** simultaneously to level up faster
5. **Check AI review** before submitting

## Bounty Categories

| Category | Tags | Examples |
|----------|------|---------|
| Frontend | `frontend` | React components, responsive design |
| Backend | `backend` | API endpoints, auth, database |
| Documentation | `docs` | Tutorials, guides, README |
| Creative | `creative` | Design, video, stickers |
| Integration | `integration` | Bots, GitHub Actions, extensions |
| Agent | `agent` | AI systems, autonomous workflows |

## FAQ

**Q: What is $FNDRY?**
A: The native token of SolFoundry on Solana, earned by completing bounties.

**Q: Can I work on multiple bounties?**
A: Yes! Work on as many T1 bounties as you can handle.

**Q: What if someone submits first?**
A: T1 is open race. First quality PR wins, but better quality may be chosen.

---

*Start earning today at [SolFoundry](https://github.com/SolFoundry/solfoundry/issues?q=is%3Aissue+is%3Aopen+label%3Abounty+label%3Atier-1)*
