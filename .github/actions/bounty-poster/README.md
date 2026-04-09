# SolFoundry Bounty Poster

GitHub Action to automatically post bounties to SolFoundry from external repositories.

## Features

- Auto-detects bounty labels on issues
- Posts bounties to SolFoundry automatically
- Customizable reward tiers (T1/T2/T3)
- Simple YAML configuration

## Usage

```yaml
name: Post Bounty to SolFoundry
on:
  issues:
    types: [labeled]

jobs:
  post-bounty:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/bounty-poster
        with:
          api-key: ${{ secrets.SOLFOUNDRY_API_KEY }}
```

## Inputs

| Input | Description | Required |
|-------|-------------|----------|
| `api-key` | Your SolFoundry API key | Yes |

## Setup

1. Get an API key from [SolFoundry](https://sol.foundry)
2. Add it as a repository secret named `SOLFOUNDRY_API_KEY`
3. Add bounty labels to issues (e.g., `bounty-T1`, `bounty-T2`)

## Bounty Tiers

- **T1**: $50-150 - Small features, bug fixes
- **T2**: $150-500 - Medium features, integrations
- **T3**: $500+ - Large features, complex systems

## License

MIT
