# Bounty API

Complete reference for bounty-related endpoints.

## Overview

Bounties are paid work opportunities on SolFoundry. The Bounty API allows you to:

- Search and filter bounties
- Get bounty details
- Create new bounties
- Track bounty status

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bounties/search` | Search and filter bounties |
| GET | `/api/bounties/autocomplete` | Get search suggestions |
| GET | `/api/bounties/{id}` | Get bounty details |
| POST | `/api/bounties` | Create a new bounty |
| PATCH | `/api/bounties/{id}` | Update a bounty |
| DELETE | `/api/bounties/{id}` | Delete a bounty |

## Search Bounties

Full-text search with filters.

### Request

```http
GET /api/bounties/search?q=smart+contract&tier=1&status=open
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | No | Full-text search query |
| `tier` | integer | No | Filter by tier (1, 2, or 3) |
| `category` | string | No | Filter by category |
| `status` | string | No | Filter by status |
| `reward_min` | float | No | Minimum reward amount |
| `reward_max` | float | No | Maximum reward amount |
| `skills` | string | No | Comma-separated skills |
| `sort` | string | No | Sort order (default: newest) |
| `skip` | integer | No | Pagination offset (default: 0) |
| `limit` | integer | No | Results per page (default: 20, max: 100) |

### Sort Options

| Value | Description |
|-------|-------------|
| `newest` | Most recently created (default) |
| `reward_high` | Highest reward first |
| `reward_low` | Lowest reward first |
| `deadline` | Soonest deadline first |
| `popularity` | Most viewed first |

### Response

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Implement wallet connection component",
      "description": "Create a React component for Solana wallet connection...",
      "tier": 1,
      "category": "frontend",
      "status": "open",
      "reward_amount": 200.0,
      "reward_token": "FNDRY",
      "deadline": "2024-01-15T00:00:00Z",
      "skills": ["react", "typescript", "solana"],
      "popularity": 42,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 25,
  "skip": 0,
  "limit": 20
}
```

### Examples

#### Basic Search

```bash
curl "https://api.solfoundry.org/api/bounties/search?q=wallet"
```

#### Filter by Tier and Status

```bash
curl "https://api.solfoundry.org/api/bounties/search?tier=1&status=open"
```

#### Filter by Reward Range

```bash
curl "https://api.solfoundry.org/api/bounties/search?reward_min=100&reward_max=500"
```

#### Filter by Skills

```bash
curl "https://api.solfoundry.org/api/bounties/search?skills=rust,anchor,solana"
```

#### Sort by Reward

```bash
curl "https://api.solfoundry.org/api/bounties/search?sort=reward_high"
```

#### Pagination

```bash
curl "https://api.solfoundry.org/api/bounties/search?skip=20&limit=20"
```

## Autocomplete

Get search suggestions as users type.

### Request

```http
GET /api/bounties/autocomplete?q=sm
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 2 chars) |
| `limit` | integer | No | Max suggestions (default: 10, max: 20) |

### Response

```json
{
  "suggestions": [
    {"text": "smart contract", "type": "skill"},
    {"text": "Smart contract audit tool", "type": "title"},
    {"text": "smart_contract", "type": "category"}
  ]
}
```

## Get Bounty

Retrieve details for a specific bounty.

### Request

```http
GET /api/bounties/550e8400-e29b-41d4-a716-446655440000
```

### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Implement wallet connection component",
  "description": "Create a React component for Solana wallet connection using Phantom wallet adapter. The component should:\n\n1. Display connect/disconnect button\n2. Show wallet address when connected\n3. Handle connection errors gracefully\n4. Support multiple wallet adapters",
  "tier": 1,
  "category": "frontend",
  "status": "open",
  "reward_amount": 200.0,
  "reward_token": "FNDRY",
  "deadline": "2024-01-15T00:00:00Z",
  "skills": ["react", "typescript", "solana"],
  "github_issue_url": "https://github.com/SolFoundry/solfoundry/issues/123",
  "github_issue_number": 123,
  "github_repo": "SolFoundry/solfoundry",
  "claimant_id": null,
  "winner_id": null,
  "popularity": 42,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 404 | Bounty not found |

## Create Bounty

Create a new bounty.

### Request

```http
POST /api/bounties
Content-Type: application/json

{
  "title": "Implement wallet connection component",
  "description": "Create a React component for Solana wallet connection",
  "tier": 1,
  "category": "frontend",
  "reward_amount": 200.0,
  "deadline": "2024-01-15T00:00:00Z",
  "skills": ["react", "typescript", "solana"],
  "github_issue_url": "https://github.com/SolFoundry/solfoundry/issues/123"
}
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Bounty title (1-255 chars) |
| `description` | string | Yes | Full description |
| `tier` | integer | Yes | Difficulty tier (1-3) |
| `category` | string | Yes | Work category |
| `reward_amount` | float | Yes | $FNDRY reward |
| `reward_token` | string | No | Token symbol (default: FNDRY) |
| `deadline` | datetime | No | Submission deadline |
| `skills` | array | No | Required skills |
| `github_issue_url` | string | No | GitHub issue URL |
| `github_issue_number` | integer | No | GitHub issue number |
| `github_repo` | string | No | GitHub repository |

### Response

Returns the created bounty with `201 Created` status.

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid bounty data |
| 422 | Validation error |

## Update Bounty

Update an existing bounty.

### Request

```http
PATCH /api/bounties/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "status": "claimed"
}
```

### Request Body

All fields are optional. Only provided fields will be updated.

## Delete Bounty

Delete a bounty permanently.

### Request

```http
DELETE /api/bounties/550e8400-e29b-41d4-a716-446655440000
```

### Response

Returns `204 No Content` on success.

## Bounty Tiers

### Tier 1 (Simple)

- **Reward**: 50 - 500 $FNDRY
- **Deadline**: 72 hours
- **Access**: Open race (anyone can submit)
- **Typical Tasks**: Bug fixes, documentation, small features

### Tier 2 (Medium)

- **Reward**: 500 - 5,000 $FNDRY
- **Deadline**: 7 days
- **Access**: Requires 4+ merged Tier 1 bounties
- **Typical Tasks**: Module implementation, integrations

### Tier 3 (Complex)

- **Reward**: 5,000 - 50,000 $FNDRY
- **Deadline**: 14-30 days
- **Access**: Requires 3+ merged Tier 2 bounties
- **Typical Tasks**: Major features, new subsystems

## Bounty Status

### Status Lifecycle

```
open → claimed → completed
  │        │
  └────────┴──→ cancelled
```

| Status | Description |
|--------|-------------|
| `open` | Available for anyone to work on |
| `claimed` | Assigned to a contributor |
| `completed` | Work finished and merged |
| `cancelled` | No longer available |

## Categories

| Category | Description |
|----------|-------------|
| `frontend` | UI/UX, React, Vue, CSS, HTML |
| `backend` | API, database, services, Python |
| `smart_contract` | Solana programs, Anchor, Rust |
| `documentation` | Docs, guides, README, tutorials |
| `testing` | Unit tests, integration tests, E2E |
| `infrastructure` | DevOps, CI/CD, deployment, Docker |
| `other` | Miscellaneous tasks |

## Rate Limit

| Endpoint | Rate Limit |
|----------|------------|
| GET /search | 100 requests/minute |
| GET /autocomplete | 100 requests/minute |
| GET /{id} | 100 requests/minute |
| POST / | 30 requests/minute |
| PATCH /{id} | 30 requests/minute |
| DELETE /{id} | 30 requests/minute |

## Best Practices

1. **Use pagination** - Don't request more than 100 items per page
2. **Filter early** - Use query parameters to narrow results
3. **Cache results** - Bounty lists don't change frequently
4. **Handle deadlines** - Show countdown timers for urgency
5. **Include skills** - Help users find relevant bounties