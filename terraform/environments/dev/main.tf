terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.19"
    }
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.50"
    }
  }

  backend "s3" {
    # Credentials supplied via -backend-config=backend.hcl (gitignored).
    # Copy backend.hcl.example → backend.hcl and fill in access_key / secret_key.
  }
}

provider "cloudflare" {
  api_token = data.terraform_remote_state.cloudflare_token.outputs.cloudflare_api_token
}

provider "hcloud" {
  token = var.hcloud_token
}

data "terraform_remote_state" "cloudflare_token" {
  backend = "local"

  config = {
    path = "${path.module}/../../bootstrap/cloudflare-token/terraform.tfstate"
  }
}

locals {
  domain_name               = "mageknightdigital.app"
  asset_pack_path           = "mageknight/dev/assets"
  assets_base_url           = "https://assets-dev.${local.domain_name}/${local.asset_pack_path}"
  created_app_server_ipv4   = try(module.hetzner_app[0].server_ipv4, null)
  effective_app_origin_ipv4 = var.app_origin_ipv4 != null ? var.app_origin_ipv4 : local.created_app_server_ipv4
  effective_api_origin_ipv4 = var.api_origin_ipv4 != null ? var.api_origin_ipv4 : local.created_app_server_ipv4
}

module "cloudflare_site" {
  source = "../../modules/cloudflare_site"

  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id

  domain_name        = local.domain_name
  assets_bucket_name = "mageknight-assets-dev"
  enable_r2_assets   = var.enable_r2_assets
  assets_subdomain   = "assets-dev"
  asset_pack_path    = local.asset_pack_path
  play_subdomain     = "dev"
  api_subdomain      = "api-dev"
  app_origin_ipv4    = local.effective_app_origin_ipv4
  create_app_record  = var.app_origin_ipv4 != null || var.create_app_server
  api_origin_ipv4    = local.effective_api_origin_ipv4
  create_api_record  = var.api_origin_ipv4 != null || var.create_app_server
}

module "hetzner_app" {
  count  = var.create_app_server ? 1 : 0
  source = "../../modules/hetzner_app"

  server_name         = "mage-knight-digital-dev"
  environment         = "dev"
  server_type         = var.server_type
  location            = var.location
  ssh_public_key_path = var.ssh_public_key_path
  ssh_allowed_ips     = var.ssh_allowed_ips
  repo_url            = var.repo_url
  repo_branch         = var.repo_branch
  app_domain          = "dev.${local.domain_name}"
  api_domain          = "api-dev.${local.domain_name}"
  ghcr_token          = var.ghcr_token
}
