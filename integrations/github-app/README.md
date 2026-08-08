"""
SolFoundry AI Code Review GitHub App
=====================================

An installable GitHub App that provides automated multi-LLM code reviews
on every pull request, with security checks, performance analysis, and
best practices verification.

## Features

- **Multi-LLM Reviews**: Claude, OpenAI/Codex, and Gemini review every PR
- **3 Review Modes**: Quick (1 model), Standard (3 models), Thorough (5 models)
- **Security Checks**: 7 patterns (hardcoded secrets, SQL injection, eval, etc.)
- **Performance Analysis**: N+1 queries, sync-in-async, large lists, string concat
- **Best Practices**: Type hints, console.log, TODO/FIXME, magic numbers, bare except
- **Configurable**: Per-repository `.github/ai-code-review.yml` configuration
- **Check Runs**: Results appear as check runs on every PR
- **Inline Comments**: Findings are posted as inline review comments

## Quick Start

### 1. Install the App

Click the "Install" button on the GitHub App page and select which repositories
to grant access to.

### 2. (Optional) Configuration

Create `.github/ai-code-review.yml` in your repository:

```yaml
mode: standard          # quick | standard | thorough
strictness: balanced    # lenient | balanced | strict
comment_style: inline   # inline | summary | both
auto_approve_threshold: 8.0
block_threshold: 4.0
languages:
  - python
  - javascript
  - typescript
  - go
  - rust
```

### 3. Open a PR

The app automatically reviews every pull request and posts:
- **Check Run**: Score out of 10 with model-specific scores
- **Review Comments**: Inline comments on issues found
- **Summary Comment**: Overview of all findings

## Scoring

| Score | Meaning |
|-------|---------|
| 8.0-10 | Good — no critical/high issues |
| 6.0-7.9 | Fair — minor issues to address |
| 4.0-5.9 | Needs work — significant issues |
| 0.0-3.9 | Poor — major problems |

## Architecture

```
integrations/github-app/
├── manifest.json          # GitHub App manifest
├── app.py                 # FastAPI webhook handler
├── config.py              # Review configuration models
├── github_client.py       # GitHub API client
├── models.py              # Shared data models
├── requirements.txt       # Python dependencies
├── README.md              # This file
├── analyzers/
│   ├── security.py        # Security pattern detection
│   ├── performance.py     # Performance analysis
│   └── best_practices.py  # Best practices checker
├── reviewers/
│   ├── base.py            # Abstract reviewer interface
│   ├── claude.py          # Claude reviewer
│   ├── openai.py          # OpenAI/Codex reviewer
│   ├── gemini.py          # Gemini reviewer
│   └── orchestrator.py    # Multi-model orchestration
└── tests/
    ├── test_app.py        # Unit tests
    └── ...
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | App private key (PEM) |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI/Codex API key |
| `GEMINI_API_KEY` | Google Gemini API key |

## License

SolFoundry
"""