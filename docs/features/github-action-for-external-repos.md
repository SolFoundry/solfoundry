# GitHub Action for External Repos
> Last updated: 2026-04-09
## Overview
This feature allows external repositories to install a GitHub Action that automatically converts labeled GitHub issues into SolFoundry bounties, facilitating easier bounty management and reward distribution.
## How It Works
The action is defined in `.github/workflows/bounty-tracker.yml`, which listens for issue events. When an issue with a specific label is created or modified, the action triggers a function in `backend/routes/bounties.js` that processes the issue and posts a bounty based on the defined criteria in `config/bountyConfig.yaml`.
## Configuration
No configuration required.
## Usage
To use this feature, add the GitHub Action to your repository's workflow file and label issues appropriately to trigger bounty creation.
## References
- Closes #855