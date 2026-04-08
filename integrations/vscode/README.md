# SolFoundry Bounties - VS Code Extension

Browse, filter, and claim [SolFoundry](https://solfoundry.vercel.app) bounties directly from VS Code.

## Features

- **Sidebar Tree View** — Browse all available bounties in the VS Code sidebar
- **Tier Icons** — Visual tier indicators (T1/T2/T3) with color coding
- **Filtering** — Filter bounties by tier, status, reward token, or skill/keyword
- **Claim Bounties** — Claim bounties without leaving your IDE
- **Status Bar** — See the total number of open bounties at a glance
- **Browser Integration** — Open bounty details in your default browser
- **Auto-refresh** — Configurable auto-refresh interval

## Screenshots

> *Screenshots coming soon*

### Sidebar View
Browse all bounties organized in a clean tree view with expandable details.

### Filter Dialog
Quick-pick filters for tier, status, reward token, and skills.

## Installation

### From VSIX
1. Download the latest `.vsix` from [Releases](https://github.com/SolFoundry/solfoundry/releases)
2. In VS Code, run `Extensions: Install from VSIX...` from the Command Palette
3. Select the downloaded file

### From Source
```bash
cd integrations/vscode
npm install
npm run build
# Then install the generated .vsix
npx vsce package
code --install-extension solfoundry-bounties-*.vsix
```

## Getting Started

1. Open the SolFoundry icon in the Activity Bar (left sidebar)
2. Click the refresh icon to load bounties
3. Optionally set your API key: `SolFoundry: Set API Key` from the Command Palette
4. Browse, filter, and claim!

## Commands

| Command | Description |
|---------|-------------|
| `SolFoundry: Refresh Bounties` | Reload the bounty list |
| `SolFoundry: Filter Bounties` | Open filter dialog |
| `SolFoundry: Clear Filters` | Remove all active filters |
| `SolFoundry: Claim Bounty` | Claim the selected bounty |
| `SolFoundry: Open in Browser` | Open bounty in default browser |
| `SolFoundry: Set API Key` | Store your SolFoundry API key |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `solfoundry.apiUrl` | `https://solfoundry.vercel.app` | SolFoundry API base URL |
| `solfoundry.autoRefreshInterval` | `0` | Auto-refresh interval in minutes (0 = disabled) |

## Development

```bash
# Install dependencies
npm install

# Watch mode
npm run watch

# Build for production
npm run build

# Package as VSIX
npm run package
```

Press `F5` in VS Code to launch the Extension Development Host.

## License

MIT
