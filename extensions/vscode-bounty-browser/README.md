# SolFoundry Bounty Browser - VS Code Extension

A VS Code extension for browsing, searching, filtering, and submitting claims for SolFoundry bounties directly from your editor.

## Features

- **Sidebar Explorer**: Browse bounties in a VS Code tree view with tier-based icons
- **Search & Filter**: Filter by status (open/funded/in_review/completed), tier (T1/T2/T3), and skills
- **Quick Pick**: Fast bounty selection with `Ctrl+Shift+P` → "SolFoundry Bounty Browser: Quick Open"
- **Detail Panel**: Rich webview panel showing full bounty details, requirements, and links
- **Claim Submission**: Submit PR/repo URLs with transaction signatures for review fee verification
- **GitHub Integration**: Open GitHub issues and repositories directly from the extension

## Requirements

- VS Code 1.85.0 or higher
- Access to a SolFoundry API instance (default: `http://localhost:8000`)

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `solfoundryBounty.apiUrl` | `http://localhost:8000` | Base URL for the SolFoundry API |
| `solfoundryBounty.authToken` | `""` | JWT auth token for authenticated requests |
| `solfoundryBounty.defaultStatus` | `"open"` | Default status filter for bounty list |

## Commands

| Command | Description |
|---------|-------------|
| `SolFoundry Bounty Browser: Refresh Bounties` | Fetch latest bounties from the API |
| `SolFoundry Bounty Browser: Search Bounties` | Search bounties by title, description, skills |
| `SolFoundry Bounty Browser: Quick Open` | Quick pick a bounty from loaded list |
| `SolFoundry Bounty Browser: Set API URL` | Configure the API base URL |
| `SolFoundry Bounty Browser: Set Auth Token` | Configure authentication token |
| `SolFoundry Bounty Browser: Filter Open` | Show only open bounties |
| `SolFoundry Bounty Browser: Filter All` | Show all bounties |
| `SolFoundry Bounty Browser: Filter T1/T2/T3` | Filter by bounty tier |

## Usage

1. **Configure the API URL**: Press `Ctrl+Shift+P` → "Set SolFoundry API URL"
2. **Browse Bounties**: Click the trophy icon in the activity bar
3. **View Details**: Click a bounty in the sidebar to open the detail panel
4. **Submit a Claim**: Right-click a bounty → "Submit Claim for Bounty"

## Architecture

```
src/
├── extension.ts              # Extension entry point
├── api/
│   ├── client.ts             # HTTP client (mirrors frontend apiClient)
│   └── bounties.ts           # Bounty API functions
├── types/
│   └── bounty.ts             # TypeScript type definitions
├── providers/
│   ├── BountyTreeDataProvider.ts    # Sidebar tree view provider
│   └── BountyDetailProvider.ts      # Webview detail panel
├── commands/
│   └── index.ts              # Command handlers
└── test/
    ├── unit.test.ts          # API and type tests
    └── treeDataProvider.test.ts  # Tree data provider tests
```

## API Compatibility

This extension mirrors the SolFoundry frontend API patterns:

- **Types**: `frontend/src/types/bounty.ts`
- **API Client**: `frontend/src/services/apiClient.ts`
- **Bounty API**: `frontend/src/api/bounties.ts`
- **Bounty Grid**: `frontend/src/components/bounty/BountyGrid.tsx`
- **Submission Form**: `frontend/src/components/bounty/SubmissionForm.tsx`

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Run tests
npm test

# Package extension
npx vsce package
```

## Testing

The extension includes comprehensive unit tests for:
- API client error handling
- Bounty type definitions and validation
- Bounty mapping (funding_token → reward_token)
- Filter and search logic
- Sorting by reward, tier, and date
- API response format handling

## License

MIT
