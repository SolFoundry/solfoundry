# SolFoundry Bounties - VS Code Extension

A VS Code extension for browsing and claiming SolFoundry bounties directly in your editor sidebar.

## Features

- **Sidebar bounty browser**: View all open bounties in the VS Code activity bar
- **Filter by language**: Filter bounties by programming language (Rust, TypeScript, Solidity, etc.)
- **Filter by tier**: Filter by T1, T2, or T3 bounty tiers
- **Filter by status**: View open, in-review, completed, or all bounties
- **Filter by reward**: Set min/max reward amount filters
- **Search**: Search bounties by title, description, or skills
- **One-click claim**: Claim bounties directly from VS Code
- **Bounty details webview**: View full bounty details in a rich webview panel

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Open in VS Code and press F5 to debug, or:
   - Run `npx vsce package` to create a `.vsix` file
   - Install with `code --install-extension solfoundry-bounties-0.1.0.vsix`

## Configuration

### API URL
- Default: `https://solfoundry.xyz`
- Configure via `solfoundry.apiUrl` in VS Code settings

### Access Token
- Get your token via GitHub OAuth at solfoundry.xyz
- Configure via `solfoundry.accessToken` in VS Code settings

## Usage

1. Open the SolFoundry view in the Activity Bar (left sidebar)
2. Browse open bounties
3. Click the filter icons to filter by language, tier, or status
4. Click on a bounty to view details
5. Click "Claim Bounty" to open the bounty in your browser and claim it

## Commands

| Command | Description |
|---------|-------------|
| `solfoundry.refreshBounties` | Refresh the bounty list |
| `solfoundry.configureApiUrl` | Configure the API URL |
| `solfoundry.searchBounties` | Search bounties |
| `solfoundry.openBountyInBrowser` | Open bounty in browser |
| `solfoundry.claimBounty` | Claim a bounty |

## API

The extension connects to the SolFoundry API:
- List bounties: `GET /api/bounties`
- Search bounties: `GET /api/bounties/search`

## License

MIT
