# SolFoundry GitHub Action — Post Bounties

A GitHub Action that watches your repository for issues labeled as bounties and
automatically creates them on the SolFoundry platform (`POST /api/bounties`).
External repositories install this Action so contributors can open a bounty issue
in their own repo and have it sync to SolFoundry with a single label.

## Solves Bounty #855 — Tier 2 (500K $FNDRY)

## Features

- **Label detection** — runs only on issues with the `bounty` label plus a
  `tier-1` / `tier-2` / `tier-3` label.
- **Reward auto-parsing** — reads `500K $FNDRY`, `500 FNDRY`, or
  `Reward: 1000` from the issue body and sets `reward_amount` / `reward_token`.
- **YAML workflow setup** — one `uses: .../post-bounty@main` line, one repo
  secret, done.
- **Customizable tiers and thresholds** — override defaults for reward amount,
  token, tier, and label scheme via `with:` inputs.
- **Idempotent sync** — adds a `solfoundry-synced` label on success so
  repeated `labeled` events do not re-create the bounty.
- **Dry-run mode** — `dry_run: true` logs the payload without calling the API.
- **No language runtime** — pure Python 3 (available on every `ubuntu-latest`),
  no Node / npm install, no container build.

## Quick start

1. Add the SolFoundry API key to the repo as a secret
   (`SOLFOUNDRY_TOKEN`). Set `SOLFOUNDRY_API_URL` if your instance is not
   `https://solfoundry.dev`.
2. Copy `.github/workflows/post-bounty-external.yml` into the repo.
3. Open an issue with the labels `bounty` and `tier-2` and write the reward
   (e.g. `500K $FNDRY`) in the body.

When the labels are applied, the workflow calls
`POST https://solfoundry.dev/api/bounties` with:

```json
{
  "title": "🏭 Bounty T2: My Feature",
  "description": "...",
  "reward_amount": 500000,
  "reward_token": "FNDRY",
  "tier": "T2",
  "github_repo_url": "https://github.com/owner/repo",
  "github_issue_url": "https://github.com/owner/repo/issues/1"
}
```

## Inputs

| Input                  | Default                 | Description                                         |
|------------------------|-------------------------|-----------------------------------------------------|
| `solfoundry_token`     | *(empty)*               | Bearer token for the SolFoundry API.                |
| `solfoundry_api_url`   | `https://solfoundry.dev`| SolFoundry API base URL.                            |
| `bounty_labels`        | `bounty,tier-1,tier-2,tier-3` | Comma-separated labels to recognise.     |
| `require_tier_label`   | `false`                 | Skip issues that lack a `tier-*` label.             |
| `label_skip`           | `solfoundry-synced`     | Label added on success so re-runs skip the issue.   |
| `default_reward_amount`| `1000`                  | Fallback reward when not parsed from the body.      |
| `default_reward_token` | `FNDRY`                 | Fallback reward token (`USDC` or `FNDRY`).          |
| `default_tier`         | `T1`                    | Fallback tier when no `tier-*` label is present.    |
| `auto_sync_label`      | `true`                  | Add `label_skip` on successful sync.                |
| `dry_run`              | `false`                 | Log the payload only; never call the API.           |
| `gh_token`             | `github.token`          | GitHub PAT to add the synced label.                 |

## Workflow usage

```yaml
on:
  issues:
    types: [opened, labeled]

jobs:
  post-bounty:
    if: contains(join(github.event.issue.labels.*.name, ','), 'bounty') &&
        contains(join(github.event.issue.labels.*.name, ','), 'tier-')
    runs-on: ubuntu-latest
    steps:
      - uses: SolFoundry/solfoundry/.github/actions/post-bounty@main
        with:
          solfoundry_token: ${{ secrets.SOLFOUNDRY_TOKEN }}
          require_tier_label: true
```

## SolFoundry API contract

This action posts to `POST /api/bounties`. The payload maps directly to the
`BountyCreatePayload` the SolFoundry frontend uses (`frontend/src/types/bounty.ts`):

- `title` (string)
- `description` (string) — the issue body
- `reward_amount` (number)
- `reward_token` (`USDC` | `FNDRY`)
- `tier` (`T1` | `T2` | `T3`)
- `github_repo_url` (string)
- `github_issue_url` (string)
- `deadline` (string, optional)
- `skills` (string[], optional)

## Testing

```bash
# dry run against a sample payload
DRY_RUN=true bash .github/actions/post-bounty/action.yml
```

## License

Same license as the SolFoundry project.
