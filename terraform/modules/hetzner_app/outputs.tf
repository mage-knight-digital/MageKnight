output "server_ipv4" {
  description = "Public IPv4 address for Cloudflare play/api A records."
  value       = hcloud_server.app.ipv4_address
}

output "server_ipv6" {
  description = "Public IPv6 address."
  value       = hcloud_server.app.ipv6_address
}

output "ssh_command" {
  description = "SSH command for the app server."
  value       = "ssh root@${hcloud_server.app.ipv4_address}"
}

output "app_origin_record" {
  description = "Set cloudflare-assets app_origin_ipv4 to this value."
  value       = hcloud_server.app.ipv4_address
}

output "api_origin_record" {
  description = "Set cloudflare-assets api_origin_ipv4 to this value."
  value       = hcloud_server.app.ipv4_address
}

