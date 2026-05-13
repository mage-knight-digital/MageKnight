output "assets_bucket_name" {
  description = "R2 bucket for public asset packs."
  value       = var.enable_r2_assets ? cloudflare_r2_bucket.assets[0].name : var.assets_bucket_name
}

output "assets_base_url_v1" {
  description = "Pinned asset base URL to use for VITE_ASSETS_BASE_URL after assets are uploaded."
  value       = "https://${local.assets_hostname}/${var.asset_pack_path}"
}

output "assets_hostname" {
  description = "R2 custom domain hostname."
  value       = local.assets_hostname
}

output "play_hostname" {
  description = "Web app hostname."
  value       = local.play_hostname
}

output "api_hostname" {
  description = "API/WebSocket hostname."
  value       = local.api_hostname
}
