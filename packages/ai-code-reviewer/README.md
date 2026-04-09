# AI Code Review GitHub App

AI-powered code review for SolFoundry bounties.

## Features

- Automated PR review with AI suggestions
- Code quality scoring
- Security vulnerability detection
- Style consistency checks
- Inline comments on pull requests

## Setup

1. Install the GitHub App on your repository
2. Configure `.env` with your API keys
3. AI reviews happen automatically on every PR

## Configuration

Copy `.env.example` to `.env` and fill in:
- `OPENAI_API_KEY` - For AI analysis
- `GITHUB_APP_ID` - GitHub App credentials
- `GITHUB_PRIVATE_KEY` - App private key

## Usage

Once installed, the bot will:
1. Comment on new PRs with initial review
2. Analyze code changes
3. Suggest improvements
4. Score code quality (1-10)

## Bounty

Closes #848
