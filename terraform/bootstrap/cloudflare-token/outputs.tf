output "cloudflare_api_token_id" {
  value = cloudflare_account_token.terraform_mage_knight.id
}

output "cloudflare_api_token" {
  value     = cloudflare_account_token.terraform_mage_knight.value
  sensitive = true
}
