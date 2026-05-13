locals {
  assets_hostname = "${var.assets_subdomain}.${var.domain_name}"
  play_hostname   = "${var.play_subdomain}.${var.domain_name}"
  api_hostname    = "${var.api_subdomain}.${var.domain_name}"
}

resource "cloudflare_r2_bucket" "assets" {
  count = var.enable_r2_assets ? 1 : 0

  account_id = var.cloudflare_account_id
  name       = var.assets_bucket_name
  location   = var.assets_bucket_location
}

resource "cloudflare_r2_custom_domain" "assets" {
  count = var.enable_r2_assets ? 1 : 0

  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.assets[0].name
  domain      = local.assets_hostname
  enabled     = true
  zone_id     = var.cloudflare_zone_id
  min_tls     = "1.2"
}

resource "cloudflare_dns_record" "play" {
  count = var.create_app_record ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = local.play_hostname
  type    = "A"
  content = var.app_origin_ipv4
  proxied = true
  ttl     = 1
  comment = "Mage Knight Digital web app origin"
}

resource "cloudflare_dns_record" "api" {
  count = var.create_api_record ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = local.api_hostname
  type    = "A"
  content = var.api_origin_ipv4
  proxied = true
  ttl     = 1
  comment = "Mage Knight Digital API/WebSocket origin"
}

resource "cloudflare_dns_record" "namecheap_email_mx" {
  for_each = var.enable_namecheap_email_forwarding ? var.namecheap_email_mx_records : {}

  zone_id  = var.cloudflare_zone_id
  name     = var.domain_name
  type     = "MX"
  content  = each.value.host
  priority = each.value.priority
  proxied  = false
  ttl      = 1
  comment  = "Namecheap email forwarding"
}

resource "cloudflare_dns_record" "namecheap_email_spf" {
  count = var.enable_namecheap_email_forwarding ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = var.domain_name
  type    = "TXT"
  content = "v=spf1 include:spf.efwd.registrar-servers.com ~all"
  proxied = false
  ttl     = 1
  comment = "Namecheap email forwarding SPF"
}
