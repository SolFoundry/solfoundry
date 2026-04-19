# SolFoundry Bounty Agent

An autonomous AI agent that discovers, implements, and submits solutions for SolFoundry bounties.

## Features

- 🔍 **Automatic Bounty Discovery**: Scans for open T1 bounties matching agent capabilities
- ⚙️ **Solution Implementation**: Generates code, creative assets, or documentation
- 🚀 **Automated PR Submission**: Forks repo, creates branch, uploads files, submits PR
- 📊 **Competition Assessment**: Evaluates existing PRs to avoid crowded bounties
- 🎯 **Smart Selection**: Chooses bounties based on reward, competition, and capability match

## Quick Start

```bash
# Set your GitHub token
export GITHUB_TOKEN="ghp_your_token_here"

# Set your Solana wallet address
export SOLANA_WALLET="your_wallet_address"

# Run the agent (dry run first)
python3 solfoundry_agent.py --dry-run

# Actually submit PRs
python3 solfoundry_agent.py --max-prs 1

# Filter by bounty type
python3 solfoundry_agent.py --bounty-type creative --max-prs 2
```

## How It Works

1. **Discovery Phase**
   - Queries GitHub API for open T1 bounties
   - Filters by category (creative, frontend, backend, docs)
   - Assesses competition by counting existing PRs

2. **Selection Phase**
   - Scores bounties based on:
     - Competition level (fewer PRs = better)
     - Reward amount (higher = better)
     - Category match (agent capabilities)

3. **Implementation Phase**
   - Creates a new branch in user's fork
   - Generates appropriate solution based on category:
     - **Creative**: GIFs, stickers, videos using PIL/image tools
     - **Frontend**: React components, animations
     - **Backend**: API integrations, services
     - **Docs**: Markdown tutorials, guides

4. **Submission Phase**
   - Uploads files to the branch
   - Creates PR with proper formatting:
     - Title: `feat: Description (Closes #N)`
     - Body: Includes wallet address, summary, implementation details
   - Comments on original issue with PR link

## Architecture

```
solfoundry_agent/
├── agent.py              # Main agent logic
├── discovery.py          # Bounty discovery and filtering
├── implementation/       # Solution generators
│   ├── creative.py       # GIF, sticker, video generation
│   ├── frontend.py       # React component generation
│   ├── backend.py        # Service/API implementation
│   └── docs.py           # Documentation generation
├── submission.py         # PR creation and management
├── config.py             # Configuration management
└── utils.py              # Helper functions
```

## Configuration

Create a `config.json` file:

```json
{
  "github_token": "ghp_...",
  "wallet_address": "your_solana_wallet",
  "max_competition": 3,
  "preferred_categories": ["creative", "backend"],
  "dry_run": false,
  "rate_limit_delay": 2
}
```

## Bounty Categories

### Creative (GIFs, Stickers, Videos)
- Uses Python PIL for image generation
- Supports brand colors and themes
- Generates transparent PNGs and animated GIFs

### Frontend (React Components)
- Analyzes existing codebase structure
- Generates TypeScript/React components
- Follows project's design system

### Backend (Services, APIs)
- Implements FastAPI endpoints
- Integrates with existing services
- Follows project's architecture patterns

### Docs (Tutorials, Guides)
- Generates Markdown documentation
- Includes code examples and screenshots
- Follows project's documentation style

## Competition Strategy

The agent avoids bounties with:
- More than 3 existing PRs
- Recent activity from other contributors
- Complex requirements beyond agent capabilities

It prioritizes:
- New bounties with 0-1 PRs
- Creative tasks (less competition)
- Clear acceptance criteria

## Rate Limiting

- 2-second delay between API calls
- Respects GitHub's rate limits
- Implements exponential backoff on errors

## Monitoring

The agent logs:
- Bounties discovered and scored
- Competition assessments
- Implementation progress
- PR submission results

## Future Enhancements

- [ ] AI-powered solution generation using LLMs
- [ ] Multi-agent collaboration for complex bounties
- [ ] Learning from past submissions to improve quality
- [ ] Integration with SolFoundry's AI review system
- [ ] Support for T2/T3 bounties (requires merged T1s)

## Contributing

This agent is itself a submission for SolFoundry Bounty #845. Contributions welcome!

## License

MIT

## Wallet

`47HxQss7ctt6fFymSo8gevkYUWJPxieYFDG1eWQK7AjU`
