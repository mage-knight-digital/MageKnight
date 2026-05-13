provider "cloudflare" {
  api_token = var.cloudflare_bootstrap_api_token
}

locals {
  permission_groups = {
    dns_read  = "82e64a83756745bbbb1c9c2701bf816b"
    dns_write = "4755a26eedb94da69e1066d98aa820be"
    r2_read   = "b4992e1108244f5d8bfbd5744320c2e1"
    r2_write  = "bf7481a1826f439697cb59a20b22293e"
    zone_read = "c8fed203ed3043cba015a93ad1616f1f"
  }
}

resource "cloudflare_account_token" "terraform_mage_knight" {
  account_id = var.cloudflare_account_id
  name       = var.token_name
  expires_on = var.token_expires_on

  policies = [
    {
      effect = "allow"
      resources = jsonencode({
        "com.cloudflare.api.account.${var.cloudflare_account_id}" = "*"
      })
      permission_groups = [
        { id = local.permission_groups.r2_read },
        { id = local.permission_groups.r2_write },
      ]
    },
    {
      effect = "allow"
      resources = jsonencode({
        "com.cloudflare.api.account.zone.${var.cloudflare_zone_id}" = "*"
      })
      permission_groups = [
        { id = local.permission_groups.zone_read },
        { id = local.permission_groups.dns_read },
        { id = local.permission_groups.dns_write },
      ]
    },
  ]
}
