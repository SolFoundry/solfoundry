output "kubernetes_cluster_id" {
  description = "DOKS cluster ID for doctl kubernetes cluster kubeconfig save"
  value       = digitalocean_kubernetes_cluster.main.id
}

output "kubernetes_endpoint" {
  description = "API server endpoint"
  value       = digitalocean_kubernetes_cluster.main.endpoint
}

output "vpc_id" {
  value = digitalocean_vpc.main.id
}

output "managed_postgres_host" {
  description = "Private hostname when enable_managed_postgres is true"
  value       = try(digitalocean_database_cluster.postgres[0].private_host, null)
}

output "cost_alert_note" {
  description = "Configure billing alerts in DO control panel to match monthly_budget_alert_usd"
  value       = "Set alert at https://cloud.digitalocean.com/account/billing for ~$${var.monthly_budget_alert_usd}/mo"
}
