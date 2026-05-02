# Quick Start — Autonomous Bounty Agent

> **30 seconds to verify this works.** No API keys needed for demo mode.

## Prerequisites

- Python 3.10+
- Git

## 1. Install

```bash
cd bounty_agent
pip install -r requirements.txt
```

## 2. Run Tests (173 passing)

```bash
cd ..  # back to project root
python -m pytest tests/ -v
# Expected: 173 passed, 3 skipped
```

## 3. Run Demo (No API Keys Needed)

```bash
python -m bounty_agent.demo
```

**Expected output:**
```
============================================================
 🤖 Autonomous Bounty Agent — Live Demo
============================================================

📋 [1/5] Agent Scheduler — S/A/B/C Tier Rating
✅ sec-alpha [S] → security on gw-1
✅ res-gamma [A] → research on gw-2
📊 Team: 8 agents | Tiers: S=2, A=2, B=2, C=2

🎯 [2/5] Task Dispatch — Priority Queue + Tier Matching
🚀 Dispatched: t-sec-1 → sec-alpha [S]

🤖 [3/5] LLM Client — Multi-Provider + Fallback Chain
📊 Fallback chain: openai/glm-5.1 → anthropic/deepseek-v4-pro → local/qwen

📡 [4/5] Event Bus — Structured Events
[mission_completed] Mission #861 completed

🔄 [5/5] Full Pipeline — 5-Stage Mission Execution
✅ discover → analyze → implement → test → submit

============================================================
✅ All systems operational
============================================================
```

## 4. Run Full Agent (Requires GitHub Token)

```bash
export GITHUB_TOKEN=ghp_your_token
python -m bounty_agent --scan --keywords "bounty" --limit 10
```

## What Each Module Does

| Module | Purpose | Tests |
|--------|---------|-------|
| `scheduler.py` | S/A/B/C tier dispatch + memory-aware | 25 |
| `discovery.py` | GitHub bounty scanner with `prioritize()` + `is_easy()` | 9 |
| `planner.py` | Department-based task decomposition | 14 |
| `orchestrator.py` | Multi-agent × multi-gateway coordination | 20 |
| `model_fallback.py` | 5-tier LLM chain with circuit breaker | 18 |
| `memory_manager.py` | 4-layer persistence with session context | 14 |
| `events.py` | Structured pub/sub event bus | 14 |
| `retry.py` | Exponential backoff with policy | 5 |
| `state.py` | Mission state machine + disk persistence | 7 |
| `submitter.py` | PR creation + credential sanitization | 11 |
| `llm_client.py` | Multi-provider client with rate limiting | 12 |
| `config.py` | YAML/JSON config loading | 8 |

## Architecture at a Glance

See [ARCHITECTURE.md](./ARCHITECTURE.md) for 8 Mermaid diagrams covering:
- System overview (Multi-agent × multi-gateway)
- 4-phase pipeline sequence
- S/A/B/C scheduler grading
- 3-layer economic system
- Disaster recovery (4 layers)
- LLM fallback chain
- React dashboard components
