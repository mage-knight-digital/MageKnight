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

variable "hcloud_token" {
  description = "Hetzner Cloud API token."
  type        = string
  sensitive   = true
}

variable "create_app_server" {
  description = "Whether to create the Hetzner app server."
  type        = bool
  default     = true
}

variable "enable_r2_assets" {
  description = "Whether to create the Cloudflare R2 bucket and custom domain."
  type        = bool
  default     = true
}

variable "app_origin_ipv4" {
  description = "IPv4 origin for dev.mageknightdigital.app. Leave null until the app server exists."
  type        = string
  default     = null
}

variable "api_origin_ipv4" {
  description = "IPv4 origin for api-dev.mageknightdigital.app. Leave null until the app server exists."
  type        = string
  default     = null
}

variable "server_type" {
  description = "Hetzner server type."
  type        = string
  default     = "cpx11"
}

variable "location" {
  description = "Hetzner datacenter location."
  type        = string
  default     = "ash"
}

variable "ssh_public_key_path" {
  description = "Local SSH public key path for root login."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "ssh_allowed_ips" {
  description = "CIDR ranges allowed to SSH to the VM."
  type        = list(string)
  default     = ["0.0.0.0/0", "::/0"]
}

variable "repo_url" {
  description = "Public Git repository URL."
  type        = string
  default     = "https://github.com/mage-knight-digital/MageKnight.git"
}

variable "repo_branch" {
  description = "Branch deployed by the VM."
  type        = string
  default     = "main"
}

variable "ghcr_token" {
  description = "GitHub PAT with read:packages scope for pulling GHCR images. Leave null for public packages."
  type        = string
  sensitive   = true
  default     = null
}
