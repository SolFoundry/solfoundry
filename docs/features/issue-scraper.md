
# GitHub Issue Scraper

This tool automatically pulls bounty-labeled issues from GitHub into the SolFoundry dashboard, enabling better issue tracking and management.

## Overview

The GitHub Issue Scraper is designed to:
- Automatically fetch issues labeled with "bounty" from GitHub repositories
- Integrate these issues with the SolFoundry dashboard
- Provide a unified view of all bounty-related issues across projects
- Enable efficient tracking and management of bounty opportunities

## How it Works

The GitHub Issue Scraper follows this workflow:

1. **Configuration**: The scraper is configured with GitHub repository details and authentication credentials
2. **Polling**: The scraper periodically checks configured repositories for new issues
3. **Filtering**: It identifies issues with the "bounty" label
4. **Integration**: Validated bounty issues are imported into the SolFoundry system
5. **Notification**: Admins and relevant stakeholders are notified about new bounty opportunities

The scraper uses GitHub's API to fetch issues, which provides reliable and up-to-date information about bounty opportunities.

## Configuration

To configure the GitHub Issue Scraper, you need to:

1. **Set up GitHub credentials**:
   - Create a GitHub personal access token with appropriate permissions
   - Store the token securely in your environment variables or configuration files

2. **Configure repository settings**:
   ```yaml
   # Example configuration in solfoundry-config.yaml
   github_issue_scraper:
     enabled: true
     repositories:
       - name: "solana-labs/solana"
         label: "bounty"
         poll_interval: 3600  # seconds
       - name: "solana-labs/anchor"
         label: "bounty"
         poll_interval: 3600
     token: "${GITHUB_TOKEN}"
   ```

3. **Required configuration parameters**:
   - `enabled`: Boolean flag to enable/disable the scraper
   - `repositories`: List of repositories to monitor
     - `name`: GitHub repository URL or name
     - `label`: Issue label to filter for bounties
     - `poll_interval`: How often to check for new issues (in seconds)
   - `token`: GitHub personal access token with `repo` scope

4. **Environment variables**:
   - `GITHUB_TOKEN`: Your GitHub personal access token

## Integration with SolFoundry

Once configured, the scraper will:
- Import bounty issues into the SolFoundry dashboard
- Create corresponding bounty records
- Link issues to existing projects or create new ones
- Update the dashboard with new bounty opportunities

The scraper runs as part of the SolFoundry background services and can be managed through the standard SolFoundry configuration and monitoring systems.
