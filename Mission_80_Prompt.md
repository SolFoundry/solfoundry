# System Reliability Engineering Prompt (Mission #80)

Act as a Senior Backend Architect specializing in Reliability Engineering and FastAPI.

## Context
We are upgrading the SolFoundry backend health monitoring suite. The goal is to move from basic connectivity checks to comprehensive infrastructure telemetry.

## Task
Implement the `GET /api/health` logic in `backend/app/api/health.py` based on the provided specifications.

## Key Requirements for the Implementation:
1. **Parallelism**: Use `asyncio.gather` to poll PostgreSQL, Redis, Solana RPC, and GitHub API simultaneously.
2. **Robustness**: Implement strict timeouts for each check to avoid cascading delays. 
3. **Telemetry**: Integrate `psutil` to extract core system health (CPU/RAM).
4. **Clean Schema**: Ensure the JSON response is structured for easy parsing by external monitors (e.g., Datadog, Prometheus).

## Input Files:
- `backend/app/api/health.py` (Current implementation)
- `Mission_80_Specs.md`

Please provide the complete Python code for the enhanced `health.py` module.
