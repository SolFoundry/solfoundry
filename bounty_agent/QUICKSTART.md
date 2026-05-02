# ⚡ Quickstart — Get Running in 30 Seconds

> **Reviewer? Start here.** This guide proves the system works end-to-end without any infrastructure.

## Prerequisites

- Python 3.11+
- Git

## 1. Install & Run Demo (no API keys needed)

```bash
pip install -r bounty_agent/requirements.txt
python -m bounty_agent.demo
```

**What you'll see:** 5 core systems running live — scheduler, task dispatch, LLM client, event bus, full pipeline. Zero external dependencies.

## 2. Run Tests

```bash
pip install -r bounty_agent/requirements.txt
python -m pytest tests/ -v
```

**Expected:** 173 tests passing in <1 second.

## 3. Run a Real Scan (needs GitHub token)

```bash
export GITHUB_TOKEN=ghp_your_token_here
python -m bounty_agent.cli scan --bounty-type security --min-reward 500
```

This calls the real GitHub API, discovers active bounties, scores them, and outputs a ranked list.

## Architecture at a Glance

```
bounty_agent/          ← Autonomous agent core (Python)
├── discovery.py       # Multi-platform bounty scanner
├── planner.py         # LLM-powered task decomposition
├── orchestrator.py    # Pipeline coordination (5 stages)
├── model_fallback.py  # 5-tier LLM fallback + circuit breaker
├── memory_manager.py  # 4-layer persistent memory
├── scheduler.py       # Tier-based agent dispatch
├── submitter.py       # PR creation with credential sanitization
├── llm_client.py      # Multi-provider LLM client
├── security_audit.py  # Secret scanner + code auditor
├── events.py          # Structured event bus
├── retry.py           # Exponential backoff + dead letter
├── state.py           # SQLite-backed persistence
├── config.py          # Configuration management
└── demo.py            # Zero-dependency live demo

tests/                 ← 173 tests (unit + integration)
```

## Why Python?

The bounty agent is a **standalone service** — deploy with Docker, call via REST API. Python is the standard for AI/ML agents:

- **LLM integration:** OpenAI/Anthropic SDKs are Python-first
- **Agent frameworks:** LangChain, CrewAI, AutoGen — all Python
- **Security tooling:** semgrep, Bandit, safety — all Python-native
- **Data analysis:** bounty scoring, market analysis — pandas/numpy ecosystem

It doesn't replace the TS codebase, it extends it with AI capabilities that Python handles better. Any TypeScript code can integrate by calling the HTTP endpoints.

## Screenshots

| Demo Output | Test Results |
|:-----------:|:------------:|
| ![Demo](assets/demo-screenshot.png) | ![Tests](assets/test-results-screenshot.png) |

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Read [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Read [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for security review
