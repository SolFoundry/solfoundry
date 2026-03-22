# Changelog

All notable changes to the `@solfoundry/sdk` package will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-22

### Added

- Core `HttpClient` with connection management, configurable timeouts, and request/response logging.
- Exponential backoff retry logic with jitter for transient failures (429, 502, 503, 504).
- Token-bucket rate limiter to stay within API quotas.
- `BountyClient` for bounty CRUD, search, submissions, and autocomplete.
- `EscrowClient` for escrow lifecycle management (fund, release, refund, status).
- `ContributorClient` for contributor profiles, stats, and health checks.
- `GitHubClient` for listing bounty issues, checking claim status, and verifying completion.
- `EventSubscriber` for real-time WebSocket event subscriptions with auto-reconnect.
- Solana helpers: PDA derivation, account deserialization, SPL token transaction building.
- Full TypeScript type definitions mirroring all backend Pydantic models.
- Typed error hierarchy mapping to backend HTTP status codes and error codes.
- Both ESM and CJS builds for maximum compatibility.
- JSDoc documentation on all public methods and types.
- Comprehensive Vitest test suite with >95% coverage.
