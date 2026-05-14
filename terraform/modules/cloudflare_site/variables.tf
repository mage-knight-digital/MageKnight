variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the R2 bucket."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for mageknightdigital.app."
  type        = string
}

variable "domain_name" {
  description = "Root domain managed by this stack."
  type        = string
  default     = "mageknightdigital.app"
}

variable "assets_bucket_name" {
  description = "R2 bucket name for public game assets."
  type        = string
  default     = "mageknight-assets"
}

variable "enable_r2_assets" {
  description = "Whether to manage the R2 bucket and assets custom domain."
  type        = bool
  default     = true
}

variable "assets_bucket_location" {
  description = "R2 location hint."
  type        = string
  default     = "enam"
}

variable "assets_subdomain" {
  description = "Subdomain used for the R2 custom domain."
  type        = string
  default     = "assets"
}

variable "asset_pack_path" {
  description = "Versioned asset path under the assets hostname."
  type        = string
  default     = "mageknight/v1/assets"
}

variable "assets_cors_allowed_origins" {
  description = "Browser origins allowed to fetch R2-hosted game assets."
  type        = list(string)
  default     = ["https://play.mageknightdigital.app"]
}

variable "play_subdomain" {
  description = "Subdomain for the web app."
  type        = string
  default     = "play"
}

variable "api_subdomain" {
  description = "Subdomain for the API/WebSocket server."
  type        = string
  default     = "api"
}

variable "app_origin_ipv4" {
  description = "Optional IPv4 origin for play.<domain>. Leave null until the app host is ready."
  type        = string
  default     = null
}

variable "create_app_record" {
  description = "Whether to create the play app DNS record."
  type        = bool
  default     = false
}

variable "api_origin_ipv4" {
  description = "Optional IPv4 origin for api.<domain>. Leave null until the API host is ready."
  type        = string
  default     = null
}

variable "create_api_record" {
  description = "Whether to create the API/WebSocket DNS record."
  type        = bool
  default     = false
}

variable "enable_namecheap_email_forwarding" {
  description = "Whether to manage Namecheap email forwarding MX/SPF records in Cloudflare."
  type        = bool
  default     = true
}

variable "namecheap_email_mx_records" {
  description = "Namecheap email forwarding MX records imported from the registrar defaults."
  type = map(object({
    host     = string
    priority = number
  }))
  default = {
    eforward1 = {
      host     = "eforward1.registrar-servers.com"
      priority = 10
    }
    eforward2 = {
      host     = "eforward2.registrar-servers.com"
      priority = 10
    }
    eforward3 = {
      host     = "eforward3.registrar-servers.com"
      priority = 10
    }
    eforward4 = {
      host     = "eforward4.registrar-servers.com"
      priority = 15
    }
    eforward5 = {
      host     = "eforward5.registrar-servers.com"
      priority = 20
    }
  }
}
