# Changelog

All notable changes to `@solfoundry/sdk` will be documented in this file.

## [1.0.0] - 2025-04-09

### Added
- Full API coverage for SolFoundry platform
  - Auth: GitHub OAuth flow, token refresh, user profile
  - Bounties: list, get, create, filter by status/tier/skill/token
  - Submissions: list, create with links
  - Treasury/Escrow: deposit info, verify deposit
  - Review Fees: get fee, verify payment
  - Leaderboard: rankings by time period
  - Stats: platform-wide statistics
- TypeScript types with full JSDoc documentation
- Auto token refresh on 401 responses
- Rate limiting with token bucket algorithm
- Retry with exponential backoff and jitter
- Request timeout support
- Custom `SolFoundryError` with status codes and error details
- Tree-shakeable ESM/CJS dual output
- Comprehensive README with examples for every API
