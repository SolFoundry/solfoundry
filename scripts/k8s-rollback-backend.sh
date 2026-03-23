#!/usr/bin/env bash
# One-command rollback for the backend Deployment (undo last rollout).
# Usage:
#   ./scripts/k8s-rollback-backend.sh [namespace]
# Requires kubectl context pointing at the target cluster (e.g. after doctl kubeconfig save).

set -euo pipefail

NS="${1:-production}"
DEPLOY="${K8S_BACKEND_DEPLOYMENT:-solfoundry-backend}"

echo "==> Rollout history (last 5)"
kubectl rollout history "deployment/$DEPLOY" -n "$NS" | tail -6

echo "==> kubectl rollout undo"
kubectl rollout undo "deployment/$DEPLOY" -n "$NS"

echo "==> Wait for rollout"
kubectl rollout status "deployment/$DEPLOY" -n "$NS" --timeout=300s

echo "Rollback complete."
