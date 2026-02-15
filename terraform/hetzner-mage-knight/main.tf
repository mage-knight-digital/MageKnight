terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
  required_version = ">= 1.0"
}

provider "hcloud" {
  token = var.hcloud_token
}

# Look up existing SSH key or create new one
data "hcloud_ssh_keys" "existing" {}

locals {
  ssh_key_content    = trimspace(file(var.ssh_public_key_path))
  existing_key_match = [for k in data.hcloud_ssh_keys.existing.ssh_keys : k if trimspace(k.public_key) == local.ssh_key_content]
  use_existing_key   = length(local.existing_key_match) > 0
  ssh_key_id         = local.use_existing_key ? local.existing_key_match[0].id : hcloud_ssh_key.mage_knight[0].id
}

resource "hcloud_ssh_key" "mage_knight" {
  count = local.use_existing_key ? 0 : 1

  name       = "mage-knight-vm-${formatdate("YYYYMMDD-hhmm", timestamp())}"
  public_key = local.ssh_key_content

  lifecycle {
    ignore_changes = [name]
  }
}

# Create the server
resource "hcloud_server" "mage_knight_dev" {
  name        = "mage-knight-dev"
  server_type = var.server_type
  location    = var.location
  image       = "ubuntu-24.04"

  ssh_keys = [local.ssh_key_id]

  user_data = templatefile("${path.module}/cloud-init.yaml", {
    base64_github_ssh_private_key = base64encode(file(var.ssh_private_key_path))
    github_ssh_public_key          = trimspace(file(var.ssh_public_key_path))
  })

  public_net {
    ipv4_enabled = true
    ipv6_enabled = false
  }

  labels = {
    project = "mage-knight"
    env     = "dev"
  }
}
