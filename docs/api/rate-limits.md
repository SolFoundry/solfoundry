# Rate Limits

Understanding and handling API rate limits.

## Overview

Rate limits protect the API from abuse and ensure fair access for all users. Each endpoint group has specific limits.

## Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312800
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

## Rate Limits by Endpoint

### Bounty Endpoints

| Endpoint | Anonymous | Authenticated |
|----------|-----------|---------------|
| GET /api/bounties/search | 60/min | 100/min |
| GET /api/bounties/autocomplete | 60/min | 100/min |
| GET /api/bounties/{id} | 60/min | 100/min |
| POST /api/bounties | N/A | 30/min |
| PATCH /api/bounties/{id} | N/A | 30/min |
| DELETE /api/bounties/{id} | N/A | 30/min |

### Contributor Endpoints

| Endpoint | Anonymous | Authenticated |
|----------|-----------|---------------|
| GET /api/contributors | 60/min | 100/min |
| GET /api/contributors/{id} | 60/min | 100/min |
| POST /api/contributors | 10/min | 30/min |
| PATCH /api/contributors/{id} | N/A | 30/min |
| DELETE /api/contributors/{id} | N/A | 30/min |

### Notification Endpoints

| Endpoint | Anonymous | Authenticated |
|----------|-----------|---------------|
| GET /api/notifications | N/A | 60/min |
| GET /api/notifications/unread-count | N/A | 60/min |
| PATCH /api/notifications/{id}/read | N/A | 60/min |
| POST /api/notifications/read-all | N/A | 60/min |
| POST /api/notifications | N/A | 100/min (internal) |

### Leaderboard Endpoints

| Endpoint | Anonymous | Authenticated |
|----------|-----------|---------------|
| GET /api/leaderboard | 100/min | 100/min |

### Webhook Endpoints

| Endpoint | Rate Limit |
|----------|------------|
| POST /api/webhooks/github | Unlimited* |

*GitHub controls the webhook rate from their side.

### Health Check

| Endpoint | Rate Limit |
|----------|------------|
| GET /health | 1000/min |

## Rate Limit Windows

All rate limits use a **sliding window** of 1 minute.

### Example

If your limit is 100 requests/minute:

- At 10:00:00, you have 100 requests available
- At 10:00:30, you use 1 request (99 remaining)
- At 10:01:30, the 10:00:30 request "expires" and you get 1 back

## Exceeding Rate Limits

When you exceed the rate limit, you receive a `429 Too Many Requests` response:

```json
{
  "detail": "Rate limit exceeded. Retry after 30 seconds."
}
```

The response includes a `Retry-After` header:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 30

{
  "detail": "Rate limit exceeded. Retry after 30 seconds."
}
```

## Handling Rate Limits

### Check Headers

```javascript
async function makeRequest(url) {
  const response = await fetch(url);
  
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  
  console.log(`Rate limit: ${remaining}/${limit}`);
  console.log(`Resets at: ${new Date(reset * 1000)}`);
  
  return response;
}
```

### Implement Retry Logic

```python
import time
import requests

def make_request_with_retry(url, max_retries=3):
    for attempt in range(max_retries):
        response = requests.get(url)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            print(f"Rate limited. Waiting {retry_after} seconds...")
            time.sleep(retry_after)
            continue
        
        return response
    
    raise Exception("Max retries exceeded")
```

### Exponential Backoff

```python
import time
import random

def exponential_backoff_request(url, max_retries=5):
    for attempt in range(max_retries):
        response = requests.get(url)
        
        if response.status_code != 429:
            return response
        
        # Exponential backoff with jitter
        delay = min((2 ** attempt) + random.random(), 60)
        time.sleep(delay)
    
    raise Exception("Rate limit exceeded after max retries")
```

### Request Batching

Batch multiple operations to reduce API calls:

```javascript
// Instead of multiple individual requests
for (const id of ids) {
  await fetch(`/api/bounties/${id}`);
}

// Use search with multiple IDs (if supported)
// or batch locally
const results = await Promise.all(
  ids.map(id => fetch(`/api/bounties/${id}`))
);
```

## Rate Limit Best Practices

### 1. Cache Responses

```javascript
const cache = new Map();

async function getBounty(id) {
  if (cache.has(id)) {
    return cache.get(id);
  }
  
  const response = await fetch(`/api/bounties/${id}`);
  const data = await response.json();
  
  cache.set(id, data);
  return data;
}
```

### 2. Use Pagination Efficiently

```python
# Bad: Many small requests
for i in range(0, 1000, 10):
    response = requests.get(f'/api/bounties/search?skip={i}&limit=10')

# Good: Fewer larger requests
for i in range(0, 1000, 100):
    response = requests.get(f'/api/bounties/search?skip={i}&limit=100')
```

### 3. Monitor Rate Limits

```javascript
class RateLimitMonitor {
  constructor() {
    this.limits = {};
  }
  
  update(endpoint, headers) {
    this.limits[endpoint] = {
      limit: parseInt(headers.get('X-RateLimit-Limit')),
      remaining: parseInt(headers.get('X-RateLimit-Remaining')),
      reset: new Date(parseInt(headers.get('X-RateLimit-Reset')) * 1000)
    };
    
    if (this.limits[endpoint].remaining < 10) {
      console.warn(`Low rate limit for ${endpoint}: ${this.limits[endpoint].remaining} remaining`);
    }
  }
}
```

### 4. Implement Request Queues

```javascript
class RequestQueue {
  constructor(rateLimit = 100) {
    this.queue = [];
    this.requestsThisMinute = 0;
    this.rateLimit = rateLimit;
  }
  
  async add(requestFn) {
    if (this.requestsThisMinute >= this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, 60000));
      this.requestsThisMinute = 0;
    }
    
    this.requestsThisMinute++;
    return requestFn();
  }
}
```

## Rate Limit Errors

### 429 Response

```json
{
  "detail": "Rate limit exceeded. Retry after 30 seconds."
}
```

### Handling 429

```python
def handle_rate_limit(response):
    if response.status_code == 429:
        retry_after = int(response.headers.get('Retry-After', 60))
        time.sleep(retry_after)
        return True  # Should retry
    return False  # Should not retry
```

## Increasing Rate Limits

### For Authenticated Users

Authentication automatically increases your rate limits. See the rate limit tables above.

### For Applications

For applications requiring higher limits:

1. Contact support@solfoundry.org
2. Provide:
   - Application description
   - Expected request volume
   - Use case justification
3. We'll review and provide custom limits

## Rate Limit Calculation

Rate limits are calculated per:

- **IP Address** for anonymous requests
- **User ID** for authenticated requests
- **API Key** for server-to-server requests

### Example Scenarios

#### Anonymous User

- IP: 192.168.1.1
- Limit: 60 requests/minute for GET endpoints
- Cannot access POST/PATCH/DELETE endpoints

#### Authenticated User

- User ID: 550e8400-...
- Limit: 100 requests/minute for GET endpoints
- Limit: 30 requests/minute for POST/PATCH/DELETE

#### Multiple Users from Same IP

Each user has their own rate limit, even from the same IP.

## Monitoring Your Usage

### API Response Headers

Always check the rate limit headers in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 1705312800
```

### Dashboard

View your API usage in the SolFoundry dashboard:
- Go to Settings > API Usage
- See requests per day
- See rate limit warnings
- View error logs