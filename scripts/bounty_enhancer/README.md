# AI Bounty Description Enhancer

**Bounty:** [#848 - AI Bounty Description Enhancer](https://github.com/SolFoundry/solfoundry/issues/848)
**Tier:** T2 | **Reward:** 450K $FNDRY

## Overview

An AI-powered agent that analyzes vague bounty descriptions and generates improved versions with clearer requirements, acceptance criteria, and examples. Uses multi-LLM analysis across Claude, GPT, and Gemini for robust enhancement.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Bounty     │────▶│  Bounty Enhancer │────▶│  Enhanced   │
│  Input      │     │  (Core Engine)   │     │  Output     │
└─────────────┘     └────────┬─────────┘     └──────┬──────┘
                             │                      │
                    ┌────────┼────────┐             │
                    ▼        ▼        ▼             ▼
              ┌─────────┐┌─────────┐┌─────────┐  ┌─────────┐
              │ Claude  ││  GPT    ││ Gemini  │  │ Approve │
              └─────────┘└─────────┘└─────────┘  │ Workflow│
                                                   └─────────┘
```

## Components

### Core Engine (`enhancer.py`)
- **Multi-LLM aggregation**: Queries multiple providers in parallel
- **Frequency-based merging**: Requirements/criteria that multiple LLMs agree on rank higher
- **Confidence scoring**: Each provider self-assesses improvement quality
- **Approval workflow**: Maintainer review before publishing

### LLM Providers (`providers.py`)
- **Claude** (Anthropic API)
- **GPT/Codex** (OpenAI API)
- **Gemini** (Google AI)
- **DeepSeek** (optional fallback)
- OpenAI-compatible interface for easy provider addition
- Graceful degradation: individual provider failures don't block others

### Data Models (`models.py`)
- Type-safe dataclasses for all inputs/outputs
- Status tracking (PENDING → ANALYZING → ENHANCED → APPROVED/REJECTED)
- Confidence scores and processing metrics

### API Routes (`api/bounty_enhancer.py`)
- `POST /api/v1/enhance/bounty` — Submit bounty for enhancement
- `POST /api/v1/enhance/approve` — Approve/reject with optional modifications
- `GET /api/v1/enhance/pending` — List pending reviews
- `GET /api/v1/enhance/result/{id}` — Get specific result

### CLI Tool (`cli.py`)
```bash
# Enhance from command line
python -m backend.app.services.bounty_enhancer.cli enhance \
  "Add dark mode" \
  "Make the site dark mode"

# Enhance from YAML file
python -m backend.app.services.bounty_enhancer.cli enhance-file specs/bounty.yaml

# Approve an enhancement
python -m backend.app.services.bounty_enhancer.cli approve abc123 -r maintainer

# List pending reviews
python -m backend.app.services.bounty_enhancer.cli list-pending
```

## Aggregation Strategy

When multiple LLMs provide suggestions:

1. **Title**: Highest confidence suggestion wins
2. **Description**: Most detailed version (with length sanity check)
3. **Requirements**: Union with deduplication, ranked by agreement frequency
4. **Acceptance Criteria**: Union with deduplication, ranked by frequency
5. **Examples**: All unique examples merged

This ensures that consensus items rank highest while preserving unique insights from individual providers.

## Configuration

Environment variables:
```bash
CLAUDE_API_KEY=sk-ant-...      # Anthropic Claude
OPENAI_API_KEY=sk-...          # OpenAI GPT/Codex
GEMINI_API_KEY=AIza...         # Google Gemini
DEEPSEEK_API_KEY=sk-...        # DeepSeek (optional)
```

Or via `.env` file (auto-loaded by CLI).

## Testing

```bash
# Run all tests
python -m pytest tests/bounty_enhancer/ -v

# Run specific test class
python -m pytest tests/bounty_enhancer/test_enhancer.py::TestAggregation -v

# Run with coverage
python -m pytest tests/bounty_enhancer/ --cov=backend/app/services/bounty_enhancer -v
```

## Integration with SolFoundry

The enhancement API can be integrated into the existing SolFoundry backend:

```python
# In FastAPI app setup
from backend.app.api.bounty_enhancer import router
app.include_router(router)
```

Bounty creators can optionally trigger auto-enhancement when creating a bounty, and maintainainers see a "pending enhancements" queue for approval.
