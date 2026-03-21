# Contributor API

Complete reference for contributor-related endpoints.

## Overview

Contributors are users who complete bounties on SolFoundry. The Contributor API allows you to:

- List and search contributors
- Get contributor profiles
- Create and update profiles
- Track reputation and earnings

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contributors` | List contributors |
| POST | `/api/contributors` | Create profile |
| GET | `/api/contributors/{id}` | Get contributor |
| PATCH | `/api/contributors/{id}` | Update profile |
| DELETE | `/api/contributors/{id}` | Delete profile |

## List Contributors

Get a paginated list of contributors with optional filtering.

### Request

```http
GET /api/contributors?search=sol&skills=rust,solana&limit=20
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Search by username or display name |
| `skills` | string | No | Comma-separated skill filter |
| `badges` | string | No | Comma-separated badge filter |
| `skip` | integer | No | Pagination offset (default: 0) |
| `limit` | integer | No | Results per page (default: 20, max: 100) |

### Response

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "soldev",
      "display_name": "Sol Developer",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345",
      "skills": ["rust", "solana", "anchor"],
      "badges": ["tier-1-veteran", "early-contributor"],
      "stats": {
        "total_contributions": 25,
        "total_bounties_completed": 10,
        "total_earnings": 5000.0,
        "reputation_score": 850
      }
    }
  ],
  "total": 150,
  "skip": 0,
  "limit": 20
}
```

### Examples

#### Search by Name

```bash
curl "https://api.solfoundry.org/api/contributors?search=developer"
```

#### Filter by Skills

```bash
curl "https://api.solfoundry.org/api/contributors?skills=rust,solana,anchor"
```

#### Filter by Badges

```bash
curl "https://api.solfoundry.org/api/contributors?badges=tier-3-veteran"
```

## Create Contributor

Create a new contributor profile.

### Request

```http
POST /api/contributors
Content-Type: application/json

{
  "username": "soldev",
  "display_name": "Sol Developer",
  "email": "sol@example.com",
  "bio": "Building on Solana",
  "skills": ["rust", "solana"],
  "social_links": {
    "twitter": "@soldev",
    "github": "soldev"
  }
}
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Unique username (3-50 chars) |
| `display_name` | string | Yes | Display name (1-100 chars) |
| `email` | string | No | Email address |
| `avatar_url` | string | No | Profile picture URL |
| `bio` | string | No | Biography text |
| `skills` | array | No | Technical skills |
| `badges` | array | No | Achievement badges |
| `social_links` | object | No | Social media links |

### Response

Returns `201 Created` with the created profile.

### Error Responses

| Status | Description |
|--------|-------------|
| 409 | Username already exists |
| 422 | Validation error |

## Get Contributor

Retrieve detailed information about a contributor.

### Request

```http
GET /api/contributors/550e8400-e29b-41d4-a716-446655440000
```

### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "soldev",
  "display_name": "Sol Developer",
  "email": "sol@example.com",
  "avatar_url": "https://avatars.githubusercontent.com/u/12345",
  "bio": "Building the future on Solana",
  "skills": ["rust", "solana", "anchor", "typescript"],
  "badges": ["tier-1-veteran", "early-contributor", "first-pr"],
  "social_links": {
    "twitter": "@soldev",
    "github": "soldev"
  },
  "stats": {
    "total_contributions": 25,
    "total_bounties_completed": 10,
    "total_earnings": 5000.0,
    "reputation_score": 850
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T00:00:00Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 404 | Contributor not found |

## Update Contributor

Update an existing contributor profile.

### Request

```http
PATCH /api/contributors/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "display_name": "Senior Sol Developer",
  "bio": "Building the future on Solana and beyond"
}
```

### Request Body

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| `display_name` | string | Display name |
| `email` | string | Email address |
| `avatar_url` | string | Profile picture URL |
| `bio` | string | Biography text |
| `skills` | array | Technical skills |
| `badges` | array | Achievement badges |
| `social_links` | object | Social media links |

> **Note**: Username cannot be changed after creation.

## Delete Contributor

Delete a contributor profile permanently.

### Request

```http
DELETE /api/contributors/550e8400-e29b-41d4-a716-446655440000
```

### Response

Returns `204 No Content` on success.

> **Warning**: This action is irreversible.

## Profile Fields

### Stats Object

| Field | Type | Description |
|-------|------|-------------|
| `total_contributions` | integer | Total PR contributions |
| `total_bounties_completed` | integer | Completed bounties |
| `total_earnings` | float | Total $FNDRY earned |
| `reputation_score` | integer | Reputation points |

### Available Badges

| Badge | Description |
|-------|-------------|
| `first-pr` | First PR merged |
| `tier-1-veteran` | 10+ Tier 1 bounties |
| `tier-2-veteran` | 5+ Tier 2 bounties |
| `tier-3-veteran` | 3+ Tier 3 bounties |
| `early-contributor` | Contributed in first month |
| `top-10` | Top 10 leaderboard |
| `top-3` | Top 3 leaderboard |

## Rate Limit

| Endpoint | Rate Limit |
|----------|------------|
| GET /api/contributors | 100 requests/minute |
| GET /api/contributors/{id} | 100 requests/minute |
| POST /api/contributors | 30 requests/minute |
| PATCH /api/contributors/{id} | 30 requests/minute |
| DELETE /api/contributors/{id} | 30 requests/minute |

## Best Practices

1. **Cache profiles** - Contributor data doesn't change frequently
2. **Use search** - Filter by skills to find relevant contributors
3. **Update incrementally** - Only send changed fields
4. **Include skills** - Help others find you for bounties