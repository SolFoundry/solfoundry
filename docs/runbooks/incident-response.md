# Incident response runbook

Use this with `docs/deployment-and-monitoring.md` for tooling paths and architecture.

## Severity guide

- **SEV1** — Complete outage, data loss risk, or security incident.
- **SEV2** — Degraded experience, partial outage, elevated error rate.
- **SEV3** — Single dependency flaky, non-customer-visible.

## Roles

- **Incident lead** — coordinates, communicates status.
- **On-call engineer** — executes mitigations (Kubernetes, DB, Solana, CI).

## Communication

- Internal: Slack / Discord channel used by the core team.
- Customer-facing: status page or social post when SEV1/SEV2 affects users.
- Wire Alertmanager to Slack, Telegram, or PagerDuty (see `monitoring/alertmanager/alertmanager.yml`).

## Common scenarios

### 1. API returns 5xx or health is degraded

**Symptoms:** Grafana panel “API scrape (up)” is 0; `/health` reports `database` or `redis` disconnected.

**Checks:**

1. `kubectl get pods -n production` — restarts, image pull errors.
2. Logs: Grafana → Loki → filter `backend` container, or `kubectl logs deployment/solfoundry-backend -n production`.
3. Postgres: connection string, pool exhaustion (`solfoundry_db_pool_overflow` high in Prometheus).
4. Redis: `REDIS_URL`, network policy, memory eviction.

**Mitigation:**

- Roll back last deploy: `./scripts/k8s-rollback-backend.sh production`.
- Scale replicas temporarily: `kubectl scale deployment/solfoundry-backend -n production --replicas=3`.
- If DB overloaded, reduce traffic at edge or increase pool size (`DB_POOL_SIZE`, `DB_POOL_MAX_OVERFLOW`) after confirming DB capacity.

### 2. Solana RPC unhealthy

**Symptoms:** Alert `SolanaRpcUnhealthy`; `solfoundry_solana_rpc_up == 0`; Blackbox JSON-RPC probe fails.

**Checks:**

1. Confirm RPC URL in app env (`SOLANA_RPC_URL`).
2. Try `curl` JSON-RPC `getHealth` against the same URL from a jump host.
3. Check provider status (Helius, Triton, public RPC, etc.).

**Mitigation:**

- Fail over to a secondary RPC endpoint (config change + rollout).
- Reduce synchronous on-chain calls if a feature is hammering RPC.

### 3. Queue / pipeline backlog

**Symptoms:** `solfoundry_redis_queue_length` high; processing lag in reviews or webhooks.

**Checks:**

1. Confirm `OBSERVABILITY_REDIS_QUEUE_KEYS` matches real Redis list keys.
2. Inspect workers or cron jobs that drain those lists.
3. Redis memory and evictions.

**Mitigation:**

- Scale worker processes (if separate from API).
- Temporarily pause producers (feature flag / webhook disable) while clearing backlog.

### 4. Failed Anchor / program deploy

**Symptoms:** CI red on `Deploy to Devnet`; verification step fails.

**Checks:**

1. Workflow logs for `anchor deploy` and `verify-devnet-programs.sh`.
2. Deploy wallet balance on the target cluster.
3. `solana program show <id> --url devnet` for each program in `Anchor.toml`.

**Mitigation:**

- Fix and re-run workflow, or run `./scripts/anchor-program-upgrade.sh` locally with proper key material.
- If a bad upgrade landed, `./scripts/anchor-program-rollback.sh <last-good-tag>` from a clean tree.

### 5. Database corruption or bad migration

**Symptoms:** migration job failed mid-way; constraint errors; elevated DB errors.

**Mitigation:**

- Stop writes (scale API to 0 or maintenance mode) for SEV1.
- Restore from latest verified backup or managed snapshot; run `scripts/postgres-restore-test.sh` regularly against dumps to keep the procedure fresh.
- Re-apply migrations from a known state with DBA review.

### 6. Cost spike

**Symptoms:** billing alert from DigitalOcean or cloud provider.

**Checks:**

1. DO dashboard → usage by resource.
2. Kubernetes: `kubectl top nodes`, `kubectl top pods -A`.
3. New unmanaged resources outside Terraform.

**Mitigation:**

- Scale down node pool max, replicas, or non-prod environments.
- Enable or tighten Terraform `max_nodes` and HPA `maxReplicas`.

## Post-incident

- Short blameless retro for SEV1/SEV2.
- Track actions: dashboard gaps, missing alerts, runbook updates, automation (scripts/CI).
