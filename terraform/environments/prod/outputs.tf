output "assets_base_url_v1" {
  value = module.cloudflare_site.assets_base_url_v1
}

output "assets_hostname" {
  value = module.cloudflare_site.assets_hostname
}

output "app_server_ipv4" {
  value = var.create_app_server ? module.hetzner_app[0].server_ipv4 : null
}

output "ssh_command" {
  value = var.create_app_server ? module.hetzner_app[0].ssh_command : null
}

