locals {
  bootstrap_script = templatefile("${path.module}/templates/bootstrap.sh.tftpl", {
    repo_url            = var.repo_url
    repo_branch         = var.repo_branch
    app_domain          = var.app_domain
    api_domain          = var.api_domain
    assets_base_url     = var.assets_base_url
    server_port         = var.server_port
    deploy_interval_sec = var.deploy_interval_sec
  })
}

resource "hcloud_ssh_key" "app" {
  name       = "${var.server_name}-ssh"
  public_key = trimspace(file(var.ssh_public_key_path))
}

resource "hcloud_firewall" "app" {
  name = "${var.server_name}-firewall"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = var.ssh_allowed_ips
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "app" {
  name        = var.server_name
  server_type = var.server_type
  location    = var.location
  image       = "ubuntu-24.04"
  ssh_keys    = [hcloud_ssh_key.app.id]
  user_data   = local.bootstrap_script

  firewall_ids = [hcloud_firewall.app.id]

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  labels = {
    project = "mage-knight-digital"
    role    = "app"
    env     = var.environment
  }

  lifecycle {
    ignore_changes = [user_data]
  }
}
