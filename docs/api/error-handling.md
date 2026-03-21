# Error Handling

Understanding and handling API errors.

## Error Response Format

All errors follow a consistent format:

```json
{
  "detail": "Error message describing the issue"
}
```

For validation errors, additional information is provided:

```json
{
  "detail": [
    {
      "loc": ["body", "title"],
      "msg": "ensure this value has at least 1 characters",
      "type": "value_error.any_str.min_length"
    }
  ]
}
```

## HTTP Status Codes

### Success Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Successful with no response body |

### Client Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limit exceeded |

### Server Error Codes

| Code | Description |
|------|-------------|
| 500 | Internal Server Error - Server-side error |
| 502 | Bad Gateway - Upstream service error |
| 503 | Service Unavailable - Temporary unavailability |

## Common Errors

### 400 Bad Request

**Cause**: Invalid request body or parameters

```json
{
  "detail": "Invalid JSON"
}
```

**Solution**: Check request format and data types

### 401 Unauthorized

**Cause**: Missing or invalid authentication

```json
{
  "detail": "Missing authentication credentials"
}
```

```json
{
  "detail": "Invalid authentication token"
}
```

**Solution**: Include valid authentication header

### 403 Forbidden

**Cause**: Authenticated but not authorized

```json
{
  "detail": "You don't have permission to access this resource"
}
```

**Solution**: Check user permissions and resource ownership

### 404 Not Found

**Cause**: Resource doesn't exist

```json
{
  "detail": "Bounty not found"
}
```

```json
{
  "detail": "Contributor not found"
}
```

**Solution**: Verify resource ID exists

### 409 Conflict

**Cause**: Resource already exists or conflict with state

```json
{
  "detail": "Username 'developer' already exists"
}
```

**Solution**: Use different identifier or check existing resource

### 422 Unprocessable Entity

**Cause**: Validation error

```json
{
  "detail": [
    {
      "loc": ["body", "tier"],
      "msg": "ensure this value is less than or equal to 3",
      "type": "value_error.number.not_le"
    }
  ]
}
```

**Solution**: Fix validation errors in request data

### 429 Too Many Requests

**Cause**: Rate limit exceeded

```json
{
  "detail": "Rate limit exceeded. Retry after 60 seconds."
}
```

**Solution**: Implement exponential backoff and retry

### 500 Internal Server Error

**Cause**: Unexpected server error

```json
{
  "detail": "An unexpected error occurred"
}
```

**Solution**: Retry request, contact support if persistent

## Error Codes Reference

### Authentication Errors

| Code | Message | Solution |
|------|---------|----------|
| `AUTH_001` | Missing authentication credentials | Include Authorization header |
| `AUTH_002` | Invalid authentication token | Refresh or re-authenticate |
| `AUTH_003` | Token has expired | Refresh token |
| `AUTH_004` | Invalid user ID format | Use valid UUID |

### Bounty Errors

| Code | Message | Solution |
|------|---------|----------|
| `BOUNTY_001` | Bounty not found | Check bounty ID |
| `BOUNTY_002` | Invalid bounty tier | Use tier 1, 2, or 3 |
| `BOUNTY_003` | Invalid bounty status | Use valid status |
| `BOUNTY_004` | Invalid category | Use valid category |
| `BOUNTY_005` | Bounty already claimed | Find another bounty |
| `BOUNTY_006` | Bounty deadline passed | Find open bounty |

### Contributor Errors

| Code | Message | Solution |
|------|---------|----------|
| `CONTRIB_001` | Contributor not found | Check contributor ID |
| `CONTRIB_002` | Username already exists | Choose different username |
| `CONTRIB_003` | Invalid username format | Use alphanumeric, _, - |
| `CONTRIB_004` | Insufficient reputation | Complete more bounties |

### Notification Errors

| Code | Message | Solution |
|------|---------|----------|
| `NOTIF_001` | Notification not found | Check notification ID |
| `NOTIF_002` | Cannot access other user's notifications | Use own user ID |

## Handling Validation Errors

Validation errors include the location and type of error:

```json
{
  "detail": [
    {
      "loc": ["body", "title"],
      "msg": "ensure this value has at least 1 characters",
      "type": "value_error.any_str.min_length"
    },
    {
      "loc": ["body", "tier"],
      "msg": "ensure this value is less than or equal to 3",
      "type": "value_error.number.not_le"
    }
  ]
}
```

### Common Validation Types

| Type | Description |
|------|-------------|
| `value_error.any_str.min_length` | String too short |
| `value_error.any_str.max_length` | String too long |
| `value_error.number.not_ge` | Number too small |
| `value_error.number.not_le` | Number too large |
| `value_error.missing` | Required field missing |
| `type_error.integer` | Expected integer |
| `type_error.str` | Expected string |

## Error Handling Best Practices

### 1. Check Status Codes

```python
import requests

response = requests.get('https://api.solfoundry.org/api/bounties/invalid-id')

if response.status_code == 200:
    # Success
    data = response.json()
elif response.status_code == 404:
    # Not found
    print("Bounty not found")
elif response.status_code >= 500:
    # Server error - retry
    print("Server error, retrying...")
else:
    # Other error
    error = response.json()
    print(f"Error: {error['detail']}")
```

### 2. Handle Rate Limits

```python
import time
import requests

def make_request(url, max_retries=3):
    for attempt in range(max_retries):
        response = requests.get(url)
        
        if response.status_code == 429:
            # Rate limited - wait and retry
            retry_after = int(response.headers.get('Retry-After', 60))
            time.sleep(retry_after)
            continue
        
        return response
    
    raise Exception("Max retries exceeded")
```

### 3. Validate Input Locally

```python
def create_bounty(title, tier, reward):
    # Validate before sending
    if not title or len(title) < 1:
        raise ValueError("Title is required")
    if tier not in [1, 2, 3]:
        raise ValueError("Tier must be 1, 2, or 3")
    if reward < 50:
        raise ValueError("Minimum reward is 50 $FNDRY")
    
    # Send request
    return requests.post('https://api.solfoundry.org/api/bounties', json={
        'title': title,
        'tier': tier,
        'reward_amount': reward
    })
```

### 4. Log Errors

```python
import logging

logging.basicConfig(level=logging.ERROR)

def handle_api_error(response):
    if response.status_code >= 400:
        error = response.json()
        logging.error(f"API Error {response.status_code}: {error}")
        return error
    return None
```

## Retry Strategy

For transient errors, implement exponential backoff:

```python
import time
import random

def exponential_backoff(attempt, base_delay=1, max_delay=60):
    delay = min(base_delay * (2 ** attempt) + random.random(), max_delay)
    time.sleep(delay)

def make_request_with_retry(url, max_attempts=5):
    for attempt in range(max_attempts):
        response = requests.get(url)
        
        if response.status_code < 500:
            return response
        
        exponential_backoff(attempt)
    
    raise Exception("Max retries exceeded")
```

## Support

If you encounter persistent errors:

1. Check the [API Status](https://status.solfoundry.org)
2. Review the error details
3. Search [GitHub Issues](https://github.com/SolFoundry/solfoundry/issues)
4. Contact support with:
   - Error message
   - Request details (URL, body)
   - Timestamp
   - Your user ID