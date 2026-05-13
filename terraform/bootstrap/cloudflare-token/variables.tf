variable "cloudflare_bootstrap_api_token" {
  description = "Short-lived Cloudflare account token with Account API Tokens Write permission. Revoke after bootstrap apply."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID."
  type        = string
  default     = "dda00d5415786eed42e96d0440148710"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for mageknightdigital.app."
  type        = string
  default     = "6c09067e2c998b2d388998d1f4438da9"
}

variable "token_name" {
  description = "Name for the scoped Terraform Cloudflare token."
  type        = string
  default     = "terraform-mage-knight"
}

variable "token_expires_on" {
  description = "Expiration timestamp for the scoped Terraform token."
  type        = string
  default     = "2027-05-13T23:59:59Z"
}
