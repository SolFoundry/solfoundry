# AI Bounty Description Enhancer

Multi-LLM powered bounty description enhancer for SolFoundry.

## Features

- **Multi-LLM fallback** — tries OpenAI GPT-4, Anthropic Claude, and Google Gemini in order
- **Structured enhancement** — clearer requirements, acceptance criteria, code examples, complexity & timeline estimates, skill breakdown
- **Maintainer approval workflow** — enhanced descriptions are held as pending until a maintainer approves or rejects
- **FastAPI endpoints** — simple REST API to trigger, check, approve, and reject enhancements

## Quick Start

```bash
pip install -r automaton/ai_enhancer/requirements.txt
```

Set at least one API key:

```bash
export OPENAI_API_KEY=sk-...
# export ANTHROPIC_API_KEY=...
# export GOOGLE_API_KEY=...
```

Mount the router in your FastAPI app:

```python
from fastapi import FastAPI
from automaton.ai_enhancer import router

app = FastAPI()
app.include_router(router)
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai-enhance/{bounty_id}` | Trigger AI enhancement |
| GET | `/api/ai-enhance/{bounty_id}/status` | Check enhancement status |
| POST | `/api/ai-enhance/{bounty_id}/approve` | Approve and publish |
| POST | `/api/ai-enhance/{bounty_id}/reject` | Reject and revert |

### Trigger Enhancement

```bash
curl -X POST http://localhost:8000/api/ai-enhance/848 \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login","description":"Users cant log in sometimes"}'
```

Response:
```json
{
  "status": "pending",
  "enhancement": {
    "bounty_id": "848",
    "enhanced_title": "Fix intermittent login authentication failure",
    "enhanced_description": "...",
    "clearer_requirements": ["..."],
    "acceptance_criteria": ["..."],
    "code_examples": ["..."],
    "estimated_complexity": "M",
    "estimated_timeline": "1-2 days",
    "required_skills": ["..."],
    "provider_used": "openai/gpt-4o"
  }
}
```

### Approve

```bash
curl -X POST "http://localhost:8000/api/ai-enhance/848/approve?reviewer=alice"
```

## Architecture

```
automaton/ai_enhancer/
├── __init__.py              # Package exports
├── enhancer.py              # BountyEnhancer + EnhancedBounty
├── prompt_templates.py      # System/user prompts + few-shot examples
├── approval_workflow.py     # Maintainer approve/reject pipeline
├── router.py                # FastAPI endpoints
├── requirements.txt         # Python dependencies
├── README.md                # This file
└── providers/
    ├── __init__.py           # Exports
    ├── base.py               # LLMProvider ABC
    ├── openai_provider.py    # GPT-4 implementation
    ├── anthropic_provider.py # Claude implementation
    └── google_provider.py    # Gemini implementation
```

## Configuration

| Env Variable | Description | Required |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | One of three required |
| `ANTHROPIC_API_KEY` | Anthropic API key | One of three required |
| `GOOGLE_API_KEY` | Google AI API key | One of three required |

## License

MIT
