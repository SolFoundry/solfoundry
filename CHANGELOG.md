# Changelog

All notable changes to SolFoundry CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-22

### Added

#### Core Features
- **Bounty Management**
  - `sf bounties list` - List bounties with filters (tier, status, category)
  - `sf bounties search` - Search bounties by keyword
  - `sf bounty get <id>` - Get bounty details
  - `sf bounty claim <id>` - Claim a bounty
  - `sf bounty submit <id> --pr <url>` - Submit work for a bounty

- **Submission Management**
  - `sf submissions list` - List submissions for a bounty
  - `sf submissions review` - Review a submission with score and comment
  - `sf submissions vote` - Vote on submissions (upvote/downvote)
  - `sf submissions distribute` - Distribute rewards

- **User Status**
  - `sf status` - View earnings, active bounties, and tier progress

- **Configuration**
  - `sf config init` - Interactive configuration setup
  - `sf config show` - Display current configuration
  - `sf config set` - Update configuration values
  - Config file: `~/.solfoundry/config.yaml`
  - Environment variable support: `SOLFOUNDRY_API_KEY`, `SOLFOUNDRY_API_URL`

#### Output & Formatting
- Rich terminal formatting with tables and colors
- JSON output support (`--json` flag) for all list commands
- Beautiful status panels and confirmation dialogs
- Color-coded status indicators

#### Developer Experience
- Shell completions (bash, zsh, fish)
- Quick start guide (`sf quickstart`)
- Comprehensive help messages
- Type hints throughout the codebase

#### Testing
- Unit tests for API client
- Unit tests for CLI commands
- Unit tests for configuration management
- Mock-based testing for external dependencies
- pytest configuration included

#### Documentation
- README.md with installation and usage guide
- examples.md with comprehensive examples
- API reference documentation
- Troubleshooting guide

### Technical Details

#### Dependencies
- typer >= 0.9.0 - CLI framework
- click >= 8.0.0 - Command line interface
- pyyaml >= 6.0 - YAML configuration
- requests >= 2.28.0 - HTTP client
- rich >= 13.0.0 - Terminal formatting
- pydantic >= 2.0.0 - Data validation

#### Project Structure
```
solfoundry-cli/
├── solfoundry_cli/
│   ├── __init__.py
│   ├── main.py           # CLI entry point
│   ├── api.py            # API client
│   ├── config.py         # Configuration management
│   ├── formatters.py     # Output formatting
│   └── commands/
│       ├── __init__.py
│       ├── bounties.py   # Bounty list commands
│       ├── bounty.py     # Individual bounty commands
│       ├── submissions.py # Submission management
│       ├── status.py     # User status
│       └── config.py     # Configuration commands
├── tests/
│   ├── test_api.py
│   ├── test_commands.py
│   └── test_config.py
├── pyproject.toml
├── README.md
├── examples.md
├── LICENSE
└── .gitignore
```

#### Code Statistics
- Total lines: ~1,600
- Source files: 11
- Test files: 3
- Test coverage: Comprehensive mock-based tests

### API Endpoints Supported

- `GET /v1/bounties` - List bounties
- `GET /v1/bounties/{id}` - Get bounty details
- `POST /v1/bounties/{id}/claim` - Claim bounty
- `POST /v1/bounties/{id}/submit` - Submit work
- `GET /v1/bounties/{id}/submissions` - List submissions
- `GET /v1/status` - User status
- `GET /v1/submissions/{id}` - Get submission
- `POST /v1/submissions/{id}/review` - Review submission
- `POST /v1/submissions/{id}/vote` - Vote on submission
- `POST /v1/submissions/{id}/distribute` - Distribute reward

### Security

- API key stored in config file or environment variables
- No sensitive data in logs
- Secure credential handling
- HTTPS-only API communication

### Known Issues

- None (initial release)

### Future Enhancements

- [ ] Wallet signature authentication
- [ ] Interactive TUI mode
- [ ] Real-time notifications
- [ ] Bounty analytics and statistics
- [ ] Multi-account support
- [ ] Offline mode with sync
- [ ] Plugin system for extensions

---

## Unreleased

### Planned
- WebSocket support for real-time updates
- Local database for caching
- Advanced filtering options
- Custom output templates
