output "server_ip" {
  description = "Public IP address of the server"
  value       = hcloud_server.mage_knight_dev.ipv4_address
}

output "server_name" {
  description = "Name of the server"
  value       = hcloud_server.mage_knight_dev.name
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ~/.ssh/id_ed25519 root@${hcloud_server.mage_knight_dev.ipv4_address}"
}

output "server_status" {
  description = "Server status"
  value       = hcloud_server.mage_knight_dev.status
}
