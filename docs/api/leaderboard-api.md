# Leaderboard API

Complete reference for leaderboard-related endpoints.

## Overview

The leaderboard ranks contributors by $FNDRY earned. Features:

- Time period filtering (week, month, all-time)
- Tier and category filters
- Top 3 podium with extra metadata
- Caching for performance

## Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard` | Get leaderboard |

## Get Leaderboard

Retrieve ranked list of contributors.

### Request

```http
GET /api/leaderboard?period=week&tier=1&category=frontend&limit=50
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | string | No | Time period: week, month, all (default: all) |
| `tier` | string | No | Filter by tier: 1, 2, 3 |
| `category` | string | No | Filter by category |
| `limit` | integer | No | Results per page (default: 20, max: 100) |
| `offset` | integer | No | Pagination offset (default: 0) |

### Time Periods

| Period | Description |
|--------|-------------|
| `week` | Last 7 days |
| `month` | Last 30 days |
| `all` | All time (default) |

### Tier Filters

| Filter | Description |
|--------|-------------|
| `1` | Tier 1 bounties only |
| `2` | Tier 2 bounties only |
| `3` | Tier 3 bounties only |

### Category Filters

| Filter | Description |
|--------|-------------|
| `frontend` | Frontend work |
| `backend` | Backend work |
| `security` | Security work |
| `docs` | Documentation |
| `devops` | DevOps/Infrastructure |

### Response

```json
{
  "period": "week",
  "total": 150,
  "offset": 0,
  "limit": 20,
  "top3": [
    {
      "rank": 1,
      "username": "topdev",
      "display_name": "Top Developer",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345",
      "total_earned": 5000.0,
      "bounties_completed": 5,
      "reputation_score": 850,
      "wallet_address": "ABC123...",
      "meta": {
        "medal": "🥇",
        "join_date": "2024-01-01T00:00:00Z",
        "best_bounty_title": "Implement core escrow contract",
        "best_bounty_earned": 2000.0
      }
    },
    {
      "rank": 2,
      "username": "rustmaster",
      "display_name": "Rust Master",
      "avatar_url": "https://avatars.githubusercontent.com/u/67890",
      "total_earned": 4500.0,
      "bounties_completed": 4,
      "reputation_score": 800,
      "wallet_address": "DEF456...",
      "meta": {
        "medal": "🥈",
        "join_date": "2024-01-15T00:00:00Z",
        "best_bounty_title": "Optimize transaction processing",
        "best_bounty_earned": 1500.0
      }
    },
    {
      "rank": 3,
      "username": "solanabuilder",
      "display_name": "Solana Builder",
      "avatar_url": "https://avatars.githubusercontent.com/u/11111",
      "total_earned": 4000.0,
      "bounties_completed": 6,
      "reputation_score": 750,
      "wallet_address": "GHI789...",
      "meta": {
        "medal": "🥉",
        "join_date": "2024-02-01T00:00:00Z",
        "best_bounty_title": "Implement token staking",
        "best_bounty_earned": 1200.0
      }
    }
  ],
  "entries": [
    {
      "rank": 1,
      "username": "topdev",
      "display_name": "Top Developer",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345",
      "total_earned": 5000.0,
      "bounties_completed": 5,
      "reputation_score": 850,
      "wallet_address": "ABC123..."
    },
    {
      "rank": 2,
      "username": "rustmaster",
      "display_name": "Rust Master",
      "avatar_url": "https://avatars.githubusercontent.com/u/67890",
      "total_earned": 4500.0,
      "bounties_completed": 4,
      "reputation_score": 800,
      "wallet_address": "DEF456..."
    }
  ]
}
```

## Response Fields

### Leaderboard Entry

| Field | Type | Description |
|-------|------|-------------|
| `rank` | integer | Position on leaderboard |
| `username` | string | GitHub username |
| `display_name` | string | Display name |
| `avatar_url` | string | Profile picture URL |
| `total_earned` | float | Total $FNDRY earned |
| `bounties_completed` | integer | Number of bounties completed |
| `reputation_score` | integer | Reputation points |
| `wallet_address` | string | Solana wallet address (truncated) |

### Top 3 Metadata

Extra information for the podium positions:

| Field | Type | Description |
|-------|------|-------------|
| `medal` | string | Medal emoji (🥇🥈🥉) |
| `join_date` | datetime | When they joined |
| `best_bounty_title` | string | Title of highest earning bounty |
| `best_bounty_earned` | float | Amount earned from best bounty |

## Examples

### Weekly Leaderboard

```bash
curl "https://api.solfoundry.org/api/leaderboard?period=week"
```

### Tier 1 Only

```bash
curl "https://api.solfoundry.org/api/leaderboard?tier=1"
```

### Frontend Category

```bash
curl "https://api.solfoundry.org/api/leaderboard?category=frontend&period=month"
```

### Pagination

```bash
curl "https://api.solfoundry.org/api/leaderboard?limit=50&offset=50"
```

## Caching

Results are cached for 60 seconds for performance. Use the `X-RateLimit-Remaining` header to check cache status.

## WebSocket Updates

Subscribe to leaderboard changes via WebSocket:

```javascript
const ws = new WebSocket('wss://api.solfoundry.org/ws');

ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['leaderboard']
}));

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.event === 'leaderboard:changed') {
    console.log('Leaderboard changed:', message.data.changes);
    // Refresh leaderboard
  }
};
```

## Rate Limit

| Endpoint | Rate Limit |
|----------|------------|
| GET /api/leaderboard | 100 requests/minute |

## Best Practices

1. **Cache responses** - 60-second TTL recommended
2. **Use filters** - Narrow results with tier/category
3. **Subscribe to WebSocket** - For real-time updates
4. **Display top 3 prominently** - Highlight podium positions

## UI Implementation

### Leaderboard Table

```javascript
async function renderLeaderboard() {
  const response = await fetch('/api/leaderboard?period=week');
  const data = await response.json();
  
  // Render top 3 podium
  const podium = document.getElementById('podium');
  data.top3.forEach((entry, i) => {
    podium.innerHTML += `
      <div class="podium-item rank-${i + 1}">
        <span class="medal">${entry.meta.medal}</span>
        <img src="${entry.avatar_url}" alt="${entry.display_name}">
        <h3>${entry.display_name}</h3>
        <p>${entry.total_earned.toLocaleString()} $FNDRY</p>
      </div>
    `;
  });
  
  // Render table
  const table = document.getElementById('leaderboard-table');
  data.entries.forEach(entry => {
    table.innerHTML += `
      <tr>
        <td>#${entry.rank}</td>
        <td><img src="${entry.avatar_url}"> ${entry.display_name}</td>
        <td>${entry.total_earned.toLocaleString()} $FNDRY</td>
        <td>${entry.bounties_completed}</td>
      </tr>
    `;
  });
}
```