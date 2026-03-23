variable "do_token" {
  description = "DigitalOcean API token (set via TF_VAR_do_token or -var)"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean region slug"
  type        = string
  default     = "nyc3"
}

variable "project_name" {
  description = "Prefix for named resources"
  type        = string
  default     = "solfoundry"
}

variable "k8s_version" {
  description = "DOKS minor version slug (see: doctl kubernetes options versions)"
  type        = string
  default     = "1.29.1-do.0"
}

variable "node_size" {
  description = "Worker node droplet size"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "node_count" {
  description = "Initial worker count (use cluster autoscaler or HPA for app scaling)"
  type        = number
  default     = 2
}

variable "enable_managed_postgres" {
  description = "Provision a Managed PostgreSQL cluster (billable)"
  type        = bool
  default     = false
}

variable "postgres_size" {
  description = "Managed DB node size slug when enable_managed_postgres = true"
  type        = string
  default     = "db-s-1vcpu-1gb"
}

variable "monthly_budget_alert_usd" {
  description = "Soft cap for monthly spend alerts (documented threshold; set billing alerts in DO UI)"
  type        = number
  default     = 500
}

variable "enable_do_project" {
  description = "Create/link a DigitalOcean Project resource (optional; many teams manage projects manually)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to supported resources"
  type        = list(string)
  default     = ["solfoundry", "terraform"]
}
