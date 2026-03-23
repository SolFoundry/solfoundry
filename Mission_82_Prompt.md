# AI Prompt: Implementing Elite Search for SolFoundry (Mission #82)

**Role**: Senior Backend Architect (FastAPI / PostgreSQL Specialist).
**Task**: Upgrade the SolFoundry Bounty Search Engine to "Elite" Tier (Mission #82).

**Current Context**:
- Repository: SolFoundry (Solana-based AI Software Factory).
- Language: Python 3.11, FastAPI, SQLAlchemy (Async).
- Search: PostgreSQL `tsvector` with `plainto_tsquery`.
- Files for reference: 
    - `backend/app/api/bounties.py` (Router with the bug)
    - `backend/app/services/bounty_search_service.py` (Core search logic)
    - `backend/app/models/bounty_table.py` (SQLAlchemy schema)
    - `backend/app/models/bounty.py` (Pydantic models)

**Mission Objectives**:
1.  **Add `project_name`**: The frontend (React) expects `projectName` (camelCase in JSON, `project_name` in DB). Add it to all layers and ensure it's searchable.
2.  **Optimizer Search Vector**: Currently, the `search_vector` handles title and description. Extend it to include `project_name` with higher weight.
3.  **Fix Router Bug**: Ensure `deadline_before` is correctly passed and handled as a `datetime` object in `BountySearchParams`.
4.  **Skills Selection Logic**: Implement a way to toggle between "Contains ANY of these skills" (OR) and "Contains ALL of these skills" (AND) in the API. PostgreSQL `?&` vs `?|` operators.
5.  **Refine Ranking**: How can we balance text relevance (Rank) with bounty popularity and reward size?

**Instructions**:
- Provide the corrected code blocks for `bounties.py`, `bounty_search_service.py`, and the model files.
- Ensure type safety (Pydantic) and asynchronous DB access.
- Propose a SQL migration strategy or explain how the `search_vector` should be regenerated.
- Keep the code "Elite": performant, clean, and properly documented.

**Let's build the best search engine on Solana.**
