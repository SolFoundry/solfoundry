# Integration Guide

## How It Works

```
GitHub Issue (labeled) → GitHub Action → Tier Detection → Label Matching → SolFoundry API → Bounty Posted
```

### Flow

1. **Trigger**: Issue is labeled with a trigger label (e.g., `bounty`)
2. **Detection**: Action detects the label and extracts issue metadata
3. **Tier Analysis**: Determines bounty tier from labels
4. **Reward Calculation**: Calculates reward based on tier
5. **API Call**: Posts to SolFoundry with source attribution
6. **Feedback**: Sets outputs for downstream steps

### API Mapping

| GitHub Issue Field | SolFoundry Bounty Field |
|-------------------|------------------------|
| `title` | `title` |
| `body` | `description` (with source attribution) |
| `labels` (tier-*) | `tier` (1, 2, 3) |
| `labels` (any) | `tags` |
| `repository` | `metadata.source_repo` |
| `number` | `metadata.source_issue` |
| `html_url` | `metadata.source_url` |

## Deployment

### Option 1: Use as Action (Recommended)
```yaml
uses: jshaofa-ui/solfoundry-github-action@v1
```

### Option 2: Self-Hosted
1. Fork this repository
2. Run `npm run package` to bundle
3. Reference your fork:
```yaml
uses: your-username/solfoundry-github-action@main
```

## Rate Limiting

The action respects SolFoundry API rate limits:
- Default: 10 requests/second
- Retry on 429 with exponential backoff
- Max 3 retries

## Troubleshooting

### Issue: "No issue found in payload"
**Cause**: Action triggered by non-issue event
**Fix**: Ensure workflow triggers on `issues` events

### Issue: "HTTP 401 Unauthorized"
**Cause**: Invalid or missing API key
**Fix**: Verify `SOLFOUNDRY_API_KEY` secret is set correctly

### Issue: "HTTP 429 Too Many Requests"
**Cause**: Rate limit exceeded
**Fix**: Action automatically retries. If persistent, reduce trigger frequency.

### Issue: Bounty not posted despite matching label
**Cause**: Label doesn't match trigger pattern
**Fix**: Check label names match your `labels` input (case-insensitive)

## Monitoring

### Workflow Logs
```
🚀 SolFoundry Bounty Poster starting...
   Trigger labels: bounty, solfoundry
   Default tier: 2
   Default reward: 500,000 $FNDRY
   Dry run: false
📋 Processing issue #42: Implement search API
✅ Matched labels: bounty
📊 Detected tier: 2
💰 Bounty reward: 500,000 $FNDRY
✅ Bounty posted successfully! ID: bounty-abc123
```

### Outputs
Check workflow outputs for:
- `bounty_posted`: `true`/`false`
- `bounty_id`: SolFoundry bounty ID
- `bounty_url`: Link to posted bounty
