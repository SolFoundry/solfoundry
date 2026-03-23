# Automaton

This directory is reserved for higher-level deployment automation (CI glue, release orchestration).

Concrete assets for the Phase 3 bounty live alongside it:

- `infra/terraform` — DigitalOcean VPC, DOKS cluster, optional managed Postgres
- `infra/k8s` — Kubernetes manifests (for example HPA)
- `monitoring/` — Docker Compose stack (Prometheus, Grafana, Loki, Alertmanager, Blackbox)
- `scripts/` — Rollback, backup, and Anchor verification helpers
- `docs/deployment-and-monitoring.md` — Architecture, procedures, and monitoring guide
- `docs/runbooks/incident-response.md` — Incident response
