variable "server_name" {
  description = "Hetzner server name."
  type        = string
  default     = "mage-knight-digital-app"
}

variable "environment" {
  description = "Environment label."
  type        = string
  default     = "prod"
}

variable "server_type" {
  description = "Hetzner server type."
  type        = string
  default     = "cpx21"
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

variable "app_domain" {
  description = "Hostname serving the static web app."
  type        = string
  default     = "play.mageknightdigital.app"
}

variable "api_domain" {
  description = "Hostname proxying mk-server."
  type        = string
  default     = "api.mageknightdigital.app"
}

variable "assets_base_url" {
  description = "Pinned CDN asset base URL injected into the client build."
  type        = string
  default     = "https://assets.mageknightdigital.app/mageknight/v1/assets"
}

variable "server_port" {
  description = "Local port for mk-server."
  type        = number
  default     = 3030
}

variable "deploy_interval_sec" {
  description = "How often systemd checks for main branch updates."
  type        = number
  default     = 60
}
