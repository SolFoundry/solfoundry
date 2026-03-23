# Technical Specification: SolFoundry Bounty Search Engine (Mission #82)

## Context
SolFoundry requires a high-performance "Elite" search engine for the bounty board. The current implementation uses PostgreSQL Full-Text Search (TSVECTOR) but has significant gaps:
1.  **Missing Metadata**: `projectName` is used in the frontend but doesn't exist in the database or search index.
2.  **Routing Bug**: The `deadline_before` filter is present in the API schema but isn't passed from the router to the search service.
3.  **Skill Filtering Logic**: Currently uses a simple "OR" check (`?|` operator). Advanced hunters need "AND" logic to find specific multi-skill stacks.

## Core Requirements

### 1. Unified Search Vector
Update the PostgreSQL `search_vector` to include more weights:
- **Weight A**: Title
- **Weight B**: Project Name (NEW)
- **Weight C**: Description
- **Weight D**: Category / Required Skills (optional)

### 2. Schema Normalization
- Add `project_name: VARCHAR(100)` to the `bounties` table.
- Sync Pydantic models: `BountyBase`, `BountyDB`, `BountyListItem`, `BountyResponse`.

### 3. Advanced Filtering & Logic
- **AND Logic for Skills**: Add an optional `skills_logic` parameter (`"any"` | `"all"`) to the search API.
- **Solana/FNDRY Pricing**: Ability to filter by exact currency type if multi-currency support expands.
- **Deadline Fix**: Restore the functional `deadline_before` ISO filtering.

### 4. Search Ranking System
Refine `best_match` sorting:
- Rank results by title match first, then project name, then description.
- Combine text relevance with `popularity` and `reward_amount` for a "Hot Relevance" score.

## Architectural Constraints
- **Database**: PostgreSQL 15+ using `AsyncSession`.
- **Backend**: FastAPI / Pydantic v2.
- **Performance**: Search must resolve in < 150ms for the average query.
- **Fallback**: Maintain the `search_bounties_memory` fallback for development environments without DB access.
