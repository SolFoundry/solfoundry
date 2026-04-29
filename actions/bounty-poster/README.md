# SolFoundry GitHub Action — Bounty Auto-Poster

**Automatically post labeled GitHub issues as SolFoundry bounties with configurable tiers, rewards, and dry-run mode.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-45-brightgreen)](__tests__/)

---

## Overview

This GitHub Action monitors your repository for issues with specific labels (e.g., `bounty`, `solfoundry`) and automatically posts them to the SolFoundry bounty marketplace. It supports:

- **Automatic tier detection** from issue labels (T1/T2/T3)
- **Configurable reward amounts** per tier
- **Wildcard label matching** (e.g., `bounty-*`)
- **Dry-run mode** for testing without posting
- **Source attribution** — every bounty links back to the original GitHub issue

---

## Quick Start

### 1. Add to Your Workflow

Create `.github/workflows/solfoundry-bounty.yml`:

```yaml
name: SolFoundry Bounty Poster

on:
  issues:
    types: [labeled, opened]

jobs:
  post-bounty:
    runs-on: ubuntu-latest
    steps:
      - name: Post to SolFoundry
        uses: jshaofa-ui/solfoundry-github-action@v1
        with:
          solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
          labels: 'bounty,solfoundry'
          default-tier: '2'
          reward-amount: '500000'
```

### 2. Configure Secrets

Add your SolFoundry API key to repository secrets:
- `SOLFOUNDRY_API_KEY` — Your SolFoundry API authentication token

### 3. Label Issues

Add `bounty` or `solfoundry` labels to any issue to trigger automatic posting.

---

## Configuration

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `solfoundry-api-key` | SolFoundry API key | ✅ Yes | — |
| `solfoundry-base-url` | API base URL | ❌ No | `https://api.solfoundry.io` |
| `labels` | Trigger labels (comma-separated) | ❌ No | `bounty,solfoundry` |
| `default-tier` | Default bounty tier (1, 2, 3) | ❌ No | `2` |
| `reward-amount` | Default reward in $FNDRY | ❌ No | `500000` |
| `dry-run` | Test without posting | ❌ No | `false` |

### Outputs

| Output | Description |
|--------|-------------|
| `bounty_posted` | `true` if bounty was posted, `false` otherwise |
| `bounty_id` | SolFoundry bounty ID |
| `bounty_url` | URL to the posted bounty |

---

## Tier Detection

The action automatically determines the bounty tier from issue labels:

### Priority 1: Explicit Tier Labels
| Label | Tier |
|-------|------|
| `tier-1`, `T1`, `tier1` | 1 |
| `tier-2`, `T2`, `tier2` | 2 |
| `tier-3`, `T3`, `tier3` | 3 |

### Priority 2: Complexity Labels
| Label | Tier |
|-------|------|
| `simple`, `easy`, `good-first-issue` | 1 |
| `medium`, `moderate` | 2 |
| `complex`, `hard`, `advanced` | 3 |

### Priority 3: Default Tier
If no labels match, uses the `default-tier` input value.

### Reward Multipliers
| Tier | Multiplier | Example (base: 500K) |
|------|-----------|---------------------|
| 1 | 0.2x | 100K $FNDRY |
| 2 | 1.0x | 500K $FNDRY |
| 3 | 2.0x | 1M $FNDRY |

---

## Label Matching

### Exact Match
```yaml
labels: 'bounty'  # Matches issues labeled exactly "bounty"
```

### Prefix Match
```yaml
labels: 'bounty'  # Also matches "bounty-rust", "bounty-llm", etc.
```

### Wildcard Match
```yaml
labels: 'bounty-*'  # Matches "bounty-rust", "bounty-frontend", etc.
labels: '*-integration'  # Matches "discord-integration", "twitter-integration", etc.
```

---

## Examples

### Example 1: Basic Usage
```yaml
- name: Post Bounty
  uses: jshaofa-ui/solfoundry-github-action@v1
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
```

### Example 2: Custom Labels & Tiers
```yaml
- name: Post Bounty
  uses: jshaofa-ui/solfoundry-github-action@v1
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    labels: 'bounty,solfoundry,needs-contributor'
    default-tier: '3'
    reward-amount: '1000000'
```

### Example 3: Dry Run (Testing)
```yaml
- name: Test Bounty Posting
  uses: jshaofa-ui/solfoundry-github-action@v1
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    dry-run: 'true'
```

### Example 4: Multiple Tiers with Different Rewards
```yaml
- name: Post T1 Bounty
  if: contains(github.event.issue.labels.*.name, 'tier-1')
  uses: jshaofa-ui/solfoundry-github-action@v1
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    default-tier: '1'
    reward-amount: '100000'

- name: Post T2 Bounty
  if: contains(github.event.issue.labels.*.name, 'tier-2')
  uses: jshaofa-ui/solfoundry-github-action@v1
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    default-tier: '2'
    reward-amount: '500000'

- name: Post T3 Bounty
  if: contains(github.event.issue.labels.*.name, 'tier-3')
  uses: jshaofa-ui/solfoundry-github-action@v1
  with:
    solfoundry-api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
    default-tier: '3'
    reward-amount: '1000000'
```

---

## Project Structure

```
solfoundry-github-action/
├── action.yml                    # GitHub Action definition
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── src/
│   ├── index.ts                  # Main entry point
│   ├── bounty-poster.ts          # SolFoundry API client
│   ├── tier-detector.ts          # Tier detection logic
│   └── label-matcher.ts          # Label matching logic
├── __tests__/
│   ├── tier-detector.test.ts     # Tier detection tests (18 cases)
│   ├── label-matcher.test.ts     # Label matching tests (15 cases)
│   └── bounty-poster.test.ts     # API client tests (12 cases)
├── INTEGRATION.md                # Integration guide
└── README.md                     # This file
```

---

## Development

### Setup
```bash
npm install
npm run build
npm test
```

### Package for Distribution
```bash
npm run package  # Bundles to dist/index.js
```

### Run Tests
```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

---

## Testing

The action includes **45 test cases** across 3 test suites:

| Suite | Cases | Coverage |
|-------|-------|----------|
| Tier Detector | 18 | Tier detection, reward calculation, multipliers |
| Label Matcher | 15 | Exact, prefix, wildcard matching |
| Bounty Poster | 12 | API posting, error handling, metadata |

Run tests: `npm test`

---

## Security

- **API Key**: Always store as GitHub Secret, never in workflow files
- **Dry Run**: Use `dry-run: 'true'` to test before live posting
- **Input Validation**: All inputs are validated before API calls
- **Error Handling**: Network errors are caught and reported gracefully

---

## License

MIT © 2026 jshaofa-ui

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a PR

---

## Acknowledgments

Built for the [SolFoundry](https://solfoundry.io) bounty marketplace on Solana.
