# Full Autonomous Bounty-Hunting Agent

This is a complete implementation of the T3 bounty: Full Autonomous Bounty-Hunting Agent.

## What This Does

An autonomous multi-agent system that:
1. **Discovers** open bounties on GitHub across configured repositories
2. **Analyzes** requirements using LLM planning  
3. **Implements** solutions with full test coverage
4. **Validates** through CI/CD checks
5. **Submits** properly formatted PRs autonomously

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   BountyHunter (Orchestrator)           │
│  - Session management & state persistence                │
│  - Agent coordination & error recovery                  │
└──────────────────────┬──────────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    ▼                  ▼                  ▼
┌─────────┐      ┌───────────┐      ┌────────────┐
│ Scanner │      │ Analyzer  │      │  Coder     │
└─────────┘      └───────────┘      └─────┬──────┘
                                           │
                                           ▼
                                    ┌────────────┐
                                    │  Tester    │
                                    └─────┬──────┘
                                          │
                                          ▼
                                    ┌────────────┐
                                    │PR Submitter │
                                    └────────────┘
```

## Key Components

- **Scanner**: Finds bounty-labeled issues via GitHub API
- **Analyzer**: Uses LLM to create implementation plans
- **Coder**: Implements code across multiple files
- **Tester**: Runs tests and validates output
- **PRSubmitter**: Creates properly formatted PRs

## Files

- `src/index.ts` - Entry point
- `src/hunter.ts` - Main orchestrator
- `src/agents/scanner.ts` - GitHub issue discovery
- `src/agents/analyzer.ts` - LLM-powered planning
- `src/agents/coder.ts` - Code implementation
- `src/agents/tester.ts` - Test execution
- `src/agents/submitter.ts` - PR creation
- `src/store/state.ts` - SQLite persistence

## Setup

```bash
cd bounty-hunter
npm install
cp .env.example .env
# Add your GITHUB_TOKEN and OPENAI_API_KEY to .env
npm run hunter
```

## Acceptance Criteria Met

✅ Multi-LLM agent orchestration with planning
✅ Automated solution implementation and testing  
✅ Autonomous PR submission with proper formatting
