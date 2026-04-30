# 🚀 Launch Your AI-Powered Bounty Campaign!

Unlock the power of the SolFoundry marketplace to attract top developers and solve your most challenging technical problems. With our AI-powered review system, you can create bounties that get results—fast!

This guide will help you craft compelling bounty specifications that attract high-quality contributors and ensure your project gets the attention it deserves.

## Spec Format

Bounty specs are YAML documents with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | All tiers | Short descriptive title (3-200 chars) |
| `description` | string | All tiers | Detailed description of the bounty |
| `tier` | integer | All tiers | Difficulty tier: 1, 2, or 3 |
| `reward` | number | All tiers | Reward in $FNDRY tokens |
| `requirements` | list | T2, T3 | Acceptance criteria (checkboxes) |
| `category` | string | All tiers | One of the valid categories |
| `deadline` | datetime | T2, T3 | ISO 8601 deadline (must be future) |
| `skills` | list | Optional | Required skills/technologies |
| `github_issue_url` | string | Optional | Link to existing GitHub issue |
| `created_by` | string | Optional | Spec author (defaults to 'system') |

## Valid Categories

- `smart-contract` — Solana/Anchor program work
- `frontend` — React/TypeScript UI work
- `backend` — FastAPI/Python server work
- `design` — UI/UX design
- `content` — Documentation, tutorials, marketing
- `security` — Audits, vulnerability fixes
- `devops` — CI/CD, deployment, infrastructure
- `documentation` — Technical documentation

## 🏆 Choose Your Bounty Tier

Select the tier that best fits your project's needs and budget. Each tier offers a different level of engagement and reward potential.

### 🌱 **Tier 1: Quick Wins (50,000 - 200,000 $FNDRY)**
Perfect for small tasks and quick fixes!

✅ **Required fields:** title, description, tier, reward, category
✅ **Min description length:** 20 characters
🔹 **Requirements:** Optional (great for simple tasks)
🔹 **Deadline:** Optional (flexible timing)
🔹 **Review threshold:** 6.0/10 (fast approval)

**Ideal for:** Bug fixes, documentation updates, minor feature additions, and quick contributions.

### 🚀 **Tier 2: Intermediate Challenges (200,001 - 500,000 $FNDRY)**
For more substantial tasks that require clear specifications.

✅ **Required fields:** title, description, tier, reward, requirements, category, deadline
✅ **Min description length:** 50 characters
✅ **Min requirements:** 2 (clear acceptance criteria)
🔹 **Deadline:** Required (must be in the future)
🔹 **Review threshold:** 6.5/10 (thorough AI review)

**Ideal for:** New features, significant improvements, and tasks requiring detailed specifications.

### 💎 **Tier 3: High-Impact Projects (500,001 - 1,000,000 $FNDRY)**
For your most ambitious and complex projects.

✅ **Required fields:** title, description, tier, reward, requirements, category, deadline
✅ **Min description length:** 100 characters (detailed and engaging)
✅ **Min requirements:** 3 (comprehensive acceptance criteria)
🔹 **Deadline:** Required (must be in the future)
🔹 **Review threshold:** 7.0/10 (rigorous AI review)

**Ideal for:** Major features, complex integrations, and groundbreaking improvements that require thorough validation.


## 🎯 Example Bounty Specifications

Here are some compelling examples of bounty specifications for each tier. Use these as inspiration to create your own high-impact bounties!

### 🌱 **Tier 1 Example: Quick Documentation Fix**

```yaml
title: "📝 Fix Typo in CONTRIBUTING.md Setup Instructions"
description: >
  **🚨 Quick Fix Needed!** 🚨

  Our CONTRIBUTING.md file has a typo in the setup instructions. The command `npm instal` should be `npm install`. This small error might be causing confusion for new contributors.

  **Your mission:**
  1. Fix the typo in the setup instructions
  2. Verify the corrected instructions work end-to-end
  3. Test the setup process yourself to ensure it's smooth

  **Why this matters:** Clear documentation is the foundation of a great open-source project. Your quick fix will help hundreds of developers get started faster!

tier: 1
reward: 100000
category: documentation
skills:
  - documentation
  - markdown
```

### 🚀 **Tier 2 Example: DevOps Automation Pipeline**

```yaml
title: "🔧 Build a CI/CD Pipeline for Bounty Validation"
description: >
  **🚀 Transform Your Bounty Process!**

  We want to create a robust CI/CD pipeline that validates all bounty specifications before they go live. This will ensure high-quality bounties and streamline the contribution process.

  **Your mission:**
  1. Design and implement a CI validation pipeline
  2. Create YAML spec templates for each bounty tier
  3. Develop a spec linter CLI tool
  4. Build batch creation scripts for multiple bounties
  5. Write comprehensive tests for the validation logic

  **Why this matters:** This project will significantly improve the quality of bounties on our platform, making it easier for contributors to find and complete high-value tasks.

tier: 2
reward: 300000
category: devops
deadline: "2026-04-01T23:59:59Z"
requirements:
  - "YAML bounty spec format with required fields"
  - "Templates for each tier (1, 2, and 3)"
  - "CI validation workflow configuration"
  - "Reward validation to ensure amounts are within tier ranges"
  - "Auto-labeling system for bounties based on tier and category"
  - "Spec linter CLI tool with detailed error reporting"
  - "Batch creation script for creating multiple bounties at once"
  - "Comprehensive documentation on writing bounty specs"
  - "Unit and integration tests for validation logic"
skills:
  - python
  - devops
  - ci/cd
  - automation
```

### 💎 **Tier 3 Example: AI-Powered Review System**

```yaml
title: "🤖 Build a Multi-Agent Bounty Review Pipeline"
description: >
  **🚀 Revolutionize Code Review with AI!**

  We're building a production-grade multi-agent review system that scores bounty PR submissions across six key quality dimensions. This system will use three advanced AI models (GPT-5.4, Gemini 3.1 Pro, and Grok 4) to provide comprehensive, unbiased reviews.

  **Your mission:**
  1. Design and implement a multi-LLM review endpoint
  2. Develop a scoring system across six quality dimensions (quality, correctness, security, completeness, tests, and documentation)
  3. Create a consensus algorithm with outlier dampening
  4. Implement per-tier auto-merge thresholds
  5. Add retry logic with exponential backoff
  6. Build a dashboard component to visualize review results
  7. Ensure PostgreSQL persistence for all review data
  8. Write comprehensive tests using mocked LLM responses

  **Why this matters:** This project will transform how we review contributions on our platform, ensuring higher quality work while reducing manual review time. It will also serve as a foundation for future AI-powered features.

tier: 3
reward: 750000
category: backend
deadline: "2026-04-15T23:59:59Z"
requirements:
  - "Multi-LLM review endpoint with configurable weights for each model"
  - "Scoring system across six quality dimensions"
  - "Consensus algorithm with outlier dampening to ensure reliable results"
  - "Per-tier auto-merge thresholds based on review scores"
  - "Retry logic with exponential backoff for failed reviews"
  - "Review results dashboard component with visualizations"
  - "PostgreSQL persistence for all review data and history"
  - "Comprehensive unit and integration tests with mocked LLM responses"
  - "Documentation on the review process and scoring system"
skills:
  - python
  - fastapi
  - react
  - postgresql
  - machine learning
  - ai
```

## 🔍 Quality Assurance: Our Robust Validation Process

We don't just create bounties—we create **high-quality, well-structured opportunities** that attract top developers. Our validation process ensures that every bounty meets our strict standards before going live.

### 🛠️ **CLI Linter: Validate Your Specs Locally**

Before submitting your bounty, validate it locally using our powerful CLI linter. This ensures your spec is error-free and ready for submission.

```bash
# Validate a single spec
python3 scripts/lint-bounty.py bounty.yaml

# Get detailed JSON output for debugging
python3 scripts/lint-bounty.py bounty.yaml --json
```

### 📦 **Batch Creation: Create Multiple Bounties Efficiently**

Need to create multiple bounties at once? Our batch creation tool makes it easy!

```bash
# Create bounties from all specs in a directory
python3 scripts/create-bounties.py specs/

# Dry-run (validate only - no actual creation)
python3 scripts/create-bounties.py specs/ --dry-run

# Get JSON output for programmatic use
python3 scripts/create-bounties.py specs/ --json
```

### 🌐 **API Endpoints: Programmatic Validation and Creation**

Our API provides programmatic access to bounty validation and creation:

```bash
# Validate a spec (dry-run)
curl -X POST http://localhost:8000/api/bounty-specs/validate \
  -H "Content-Type: application/json" \
  -d '{"title":"My Bounty","description":"Description here","tier":2,"reward":300000,"category":"backend","requirements":["Req 1","Req 2"],"deadline":"2026-04-01T23:59:59Z"}'

# Get YAML templates for creating bounties
curl http://localhost:8000/api/bounty-specs/templates

# Create a bounty from spec (requires authentication)
curl -X POST http://localhost:8000/api/bounty-specs/create \
  -H "Content-Type: application/json" \
  -H "X-User-ID: your-user-id" \
  -d '{"title":"My Bounty","description":"Description here","tier":2,"reward":300000,"category":"backend","requirements":["Req 1","Req 2"],"deadline":"2026-04-01T23:59:59Z"}'
```

### 🏗️ **CI Integration: Automated Quality Gates**

Our CI validation workflow ensures that **every bounty** goes through a rigorous quality check before going live:

1. **Automatic Triggering:** Activates when a new bounty issue is created or edited with the `bounty` label
2. **Spec Extraction:** Parses the YAML spec block from the issue body
3. **Validation:** Runs the spec linter to check for errors and compliance
4. **Auto-Labeling:** Applies appropriate labels based on tier and category
5. **Feedback:** Comments validation errors on invalid specs for quick fixes

To activate this workflow, simply copy the `docs/ci-bounty-validation.yaml` file into your repository's `.github/workflows/` directory.

### 🏷️ **Auto-Labels: Organized and Discoverable Bounties**

Our system automatically applies relevant labels to each bounty, making it easier for contributors to find opportunities that match their skills:

- **`bounty`** — Always applied to all bounties
- **Tier Labels** — `tier-1`, `tier-2`, or `tier-3` based on the bounty tier
- **Category Labels** — Specific to the type of work (e.g., `backend`, `frontend`, `devops`)
- **Skill Labels** — For well-known technologies (e.g., `python`, `react`, `postgresql`)

This labeling system helps contributors quickly identify bounties that match their expertise and interests.

## 🚀 Ready to Launch Your Bounty Campaign?

Creating a bounty on SolFoundry is easy! Follow these simple steps:

1. **Write a compelling spec** using our templates
2. **Validate your spec** using our CLI linter
3. **Create your bounty** through our API or GitHub workflow
4. **Watch as top developers** step up to complete your project

### 💡 Pro Tips for Creating High-Impact Bounties

- **Be specific:** The more detailed your requirements, the better the submissions you'll receive
- **Set clear deadlines:** This helps attract the right contributors
- **Offer competitive rewards:** Match the value of the work being done
- **Use engaging titles:** Make your bounty stand out in the marketplace
- **Highlight the impact:** Explain why this task matters to your project

### 🌟 Why Choose SolFoundry?

✅ **AI-powered review system** - Get unbiased, high-quality reviews from multiple AI models
✅ **Automated quality assurance** - Ensure your bounties meet our high standards
✅ **Global talent pool** - Attract developers from around the world
✅ **Secure payments** - Trusted token-based rewards with escrow protection
✅ **Transparent process** - Clear status tracking and communication

Join thousands of projects that are already using SolFoundry to find top talent and get their work done faster. **Create your first bounty today!**

