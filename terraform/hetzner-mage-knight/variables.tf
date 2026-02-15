variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "server_type" {
  description = "Hetzner server type"
  type        = string
  default     = "cpx11" # Cheapest x86 server in US: 2 vCPU, 2GB RAM, 40GB disk
}

variable "location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "ash" # Ashburn, Virginia, US
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key for VM access (used for both VM login and GitHub)"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "ssh_private_key_path" {
  description = "Path to SSH private key for GitHub access"
  type        = string
  default     = "~/.ssh/id_ed25519"
}
