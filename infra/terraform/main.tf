# SolFoundry core cloud footprint on DigitalOcean (aligns with .github/workflows/deploy.yml).
# Apply: cd infra/terraform && terraform init && terraform plan -var="do_token=$DIGITALOCEAN_TOKEN"

resource "digitalocean_vpc" "main" {
  name   = "${var.project_name}-vpc"
  region = var.region
}

resource "digitalocean_kubernetes_cluster" "main" {
  name    = "${var.project_name}-k8s"
  region  = var.region
  version = var.k8s_version
  vpc_uuid = digitalocean_vpc.main.id

  tags = var.tags

  node_pool {
    name       = "${var.project_name}-workers"
    size       = var.node_size
    node_count = var.node_count
    auto_scale = true
    min_nodes  = max(1, var.node_count - 1)
    max_nodes  = var.node_count + 4
    tags       = var.tags
  }

  maintenance_policy {
    start_time = "04:00"
    day        = "sunday"
  }
}

resource "digitalocean_database_cluster" "postgres" {
  count = var.enable_managed_postgres ? 1 : 0

  name       = "${var.project_name}-pg"
  engine     = "pg"
  version    = "16"
  size       = var.postgres_size
  region     = var.region
  node_count = 1
  private_network_uuid = digitalocean_vpc.main.id
  tags       = var.tags
}

resource "digitalocean_database_firewall" "postgres" {
  count = var.enable_managed_postgres ? 1 : 0

  cluster_id = digitalocean_database_cluster.postgres[0].id

  rule {
    type  = "k8s"
    value = digitalocean_kubernetes_cluster.main.id
  }
}

resource "digitalocean_project" "main" {
  count = var.enable_do_project ? 1 : 0

  name        = title(var.project_name)
  description = "SolFoundry production resources"
  purpose     = "Web Application"
  environment = "Production"
}

resource "digitalocean_project_resources" "attached" {
  count = var.enable_do_project ? 1 : 0

  project = digitalocean_project.main[0].id
  resources = concat(
    [digitalocean_kubernetes_cluster.main.urn],
    var.enable_managed_postgres ? [digitalocean_database_cluster.postgres[0].urn] : []
  )
}
