# SolFoundry Multi-LLM Review Dashboard

Full-stack dashboard for comparing Claude, Codex, and Gemini review outcomes, calculating consensus, surfacing disagreement analysis, and routing disputes through an appeal workflow with human reviewer assignment and history tracking.

## Structure

- `frontend/`: React + TypeScript dashboard
- `backend/`: Express API and workflow logic
- `shared/`: shared types and interfaces
- `database/`: schema and migration notes

## Run

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies API calls to the backend on `http://localhost:4000`.
