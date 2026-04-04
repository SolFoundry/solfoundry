# Database Models

The implementation uses seeded in-memory data for demo velocity, but the canonical persistence model lives in [`001_initial.sql`](/Users/akii/.openclaw/workspace/solfoundry-llm-dashboard/database/migrations/001_initial.sql).

Core entities:

- `reviews`: submission metadata
- `model_reviews`: Claude, Codex, and Gemini scoring with reasoning
- `appeals`: dispute state and reviewer assignment
- `appeal_events`: append-only appeal timeline
