# CLI Commands

## `solfoundry bounties`

List bounties from the marketplace.

```bash
solfoundry bounties [options]

Options:
  -s, --status <status>  Filter by status (default: "open")
                         Values: open | in_progress | completed | disputed
  -t, --tier <tier>      Filter by tier: 1, 2, or 3
  -l, --limit <n>        Number of results (default: 20, max: 100)
  --json                 Output raw JSON
```

**Examples:**

```bash
solfoundry bounties
solfoundry bounties --tier 2
solfoundry bounties --status completed --limit 5
solfoundry bounties --json | jq '.bounties[].title'
```

---

## `solfoundry status <bounty-id>`

Check the status and escrow state of a specific bounty.

```bash
solfoundry status <bounty-id> [options]

Arguments:
  bounty-id   UUID or identifier of the bounty

Options:
  --json      Output raw JSON
```

**Examples:**

```bash
solfoundry status 3e4a8f12-...
solfoundry status abc123 --json
```

---

## `solfoundry profile <github-username>`

View a contributor's reputation, stats, badges, and wallet.

```bash
solfoundry profile <github-username> [options]

Arguments:
  github-username   The contributor's GitHub username

Options:
  --json            Output raw JSON
```

**Examples:**

```bash
solfoundry profile octocat
solfoundry profile alice --json | jq '.reputation_score'
```

---

## `solfoundry verify <tx-hash>`

Verify on-chain bounty completion by querying the Solana blockchain.

```bash
solfoundry verify <tx-hash> [options]

Arguments:
  tx-hash         Solana transaction signature (87-88 base58 characters)

Options:
  --rpc <url>     Solana RPC endpoint (default: https://api.mainnet-beta.solana.com)
  --json          Output raw JSON
```

**Examples:**

```bash
solfoundry verify 5KtPn1LGuxhFiw...
solfoundry verify <sig> --rpc https://rpc.helius.xyz/?api-key=xxx
solfoundry verify <sig> --json
```

**Exit codes:**
- `0` — Transaction confirmed, no errors
- `1` — Not found, not confirmed, or on-chain error
