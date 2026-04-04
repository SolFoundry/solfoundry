# SolFoundry AI Code Review GitHub App

Production-oriented GitHub App for automated pull request reviews using multiple LLMs and local heuristic analyzers.

## Features

- GitHub App install flow with manifest, setup endpoint, and webhook server
- Multi-LLM review orchestration across Claude, Codex, and Gemini
- Security, performance, code-quality, and best-practice checks
- Aggregated review consensus with review approval, comment, or request-changes decisions
- Inline PR comments, summary reviews, and check-run status updates
- Repository-level configuration through `.ai-reviewer.yml`

## Architecture

```text
src/
  app.ts                Express server and GitHub webhook entrypoint
  reviewers/            Claude, Codex, and Gemini integrations
  analyzers/            Security, performance, and quality heuristics
  github/               GitHub App auth, PR context loading, publishing
  config/               Environment and repository configuration loaders
  types/                Review domain types
config/
  defaults.json
  repository-config.example.yml
  github-app-manifest.json
```

## Setup

1. Copy `.env.example` to `.env` and fill in the GitHub App and provider secrets.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.
4. Expose the webhook endpoint publicly, for example with a tunnel.
5. Update `config/github-app-manifest.json` with your deployed base URL.
6. Create or register the GitHub App, then install it into any repository.

## Repository Configuration

Create `.ai-reviewer.yml` or `.github/ai-reviewer.yml` in the target repository.

```yaml
strictness: strict
providers:
  - claude
  - codex
commentPreferences:
  inline: true
  summary: true
  maxInlineComments: 10
approvalThresholds:
  blockOnCritical: true
  requestChangesOnHighSeverityCount: 1
customRules:
  - id: no-console-log
    description: Reject console logging in app code.
    pattern: console.log
```

## Webhook Coverage

The app handles:

- `pull_request.opened`
- `pull_request.reopened`
- `pull_request.ready_for_review`
- `pull_request.synchronize`

For each supported event, the app fetches changed files, loads repository configuration, executes heuristic analyzers plus the configured LLM providers, aggregates findings, posts a PR review, and creates a check run.

## Notes

- LLM provider calls expect JSON-only responses and will degrade to heuristic-only reviews when a provider is not configured.
- File-level inline comments require line numbers returned by the provider; heuristic findings without grounded lines are included in the summary review.
- The implementation is structured for deployment behind any standard Node.js process manager or container platform.
