# SolFoundry Autonomous Bounty-Hunting Agent

Autonomous multi-agent bounty-hunting system built for GitHub issue `#861`.

## Architecture

The implementation uses a master coordinator and five specialized agents:

- `FinderAgent`: discovers and filters bounties.
- `AnalyzerAgent`: performs requirement analysis, planning, risk scoring, and multi-LLM consensus.
- `ImplementerAgent`: produces implementation artifacts and execution notes.
- `TesterAgent`: validates the proposed solution through an automated testing harness.
- `SubmitterAgent`: prepares a properly formatted PR draft with branch naming, labels, and checklist.

The code is organized under the requested layout:

- `src/bounty_agent/coordinator/`
- `src/bounty_agent/agents/`
- `src/bounty_agent/llms/`
- `src/bounty_agent/workflows/`
- `src/bounty_agent/utils/`

## Multi-LLM Integration

The default workflow wires three provider adapters through a shared registry:

- `GeminiLLM`: requirement analysis
- `ClaudeLLM`: code analysis and writing
- `CodexLLM`: implementation execution

The shipped providers are deterministic local adapters so orchestration and tests run without external credentials. The interfaces are designed so live API clients can replace them without changing agent behavior.

## Core Capabilities

- Bounty discovery and filtering by reward, language, tag, and difficulty
- Requirement analysis with planning, confidence scoring, and success prediction
- Autonomous implementation artifact generation
- Automated validation with failure detection and recovery planning
- PR drafting with consistent formatting and checklists
- Progress tracking through execution timelines and inter-agent messages

## Usage

Run the workflow against the included example marketplace file:

```bash
PYTHONPATH=src python3 -m bounty_agent.cli examples/marketplace.json --language python --detailed
```

Emit structured JSON instead of text:

```bash
PYTHONPATH=src python3 -m bounty_agent.cli examples/marketplace.json --json
```

## Testing

```bash
PYTHONPATH=src python3 -m unittest discover -s tests
```

## Notes

- PR submission is implemented as a draft-generation layer because this environment has no network access.
- `src/bounty_agent/utils/git.py` provides a non-interactive git command wrapper for branch and status automation in real deployments.
- Failure paths attach a recovery plan so the coordinator can retry or escalate instead of stopping silently.
