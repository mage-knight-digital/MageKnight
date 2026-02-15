# Hetzner Mage Knight Development Server

Terraform configuration to provision a Hetzner Cloud VM for running the Mage Knight development server and Python SDK simulations.

## Prerequisites

1. **Hetzner Cloud API Token**: Get from https://console.hetzner.cloud/
2. **Terraform**: Install from https://www.terraform.io/downloads
3. **SSH Key**: Ensure `~/.ssh/id_hetzner` and `~/.ssh/id_hetzner.pub` exist (already added to your GitHub account)

## Quick Start

### 1. Configure Variables

```bash
cd terraform/hetzner-mage-knight
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and add your Hetzner Cloud token:
```hcl
hcloud_token = "your-actual-token-here"
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan and Apply

```bash
# Preview changes
terraform plan

# Create infrastructure
terraform apply
```

Type `yes` when prompted to confirm.

### 4. Get Connection Info

After apply completes, you'll see outputs:
```bash
terraform output
```

Example output:
```
server_ip = "65.108.123.45"
ssh_command = "ssh -i ~/.ssh/id_hetzner root@65.108.123.45"
```

## What Gets Provisioned

- **Server**: cx22 (2 vCPU, 4GB RAM, ~$6.50/month) in Ashburn, VA
- **OS**: Ubuntu 24.04 LTS
- **Software**: Bun, Python 3, Git, build tools
- **Repo**: Cloned from `git@github.com:mage-knight-digital/MageKnight.git`
- **Service**: `mage-knight-server.service` running `bun run dev:server` on port 3001

## Connecting to the Server

```bash
# Use the SSH command from outputs
ssh -i ~/.ssh/id_hetzner root@<SERVER_IP>
```

## Verifying Setup

Once connected via SSH:

```bash
# Check if dev server is running
systemctl status mage-knight-server

# View server logs
journalctl -u mage-knight-server -f

# Manually test build
cd /root/MageKnight
bun run build

# Test python SDK sim (make sure dev server is running first)
cd /root/MageKnight/packages/python-sdk
source venv/bin/activate
mage-knight-run-sweep --start-seed 40000 --end-seed 40001 --no-undo
```

## Managing the Server

```bash
# Stop server
systemctl stop mage-knight-server

# Start server
systemctl start mage-knight-server

# Restart server
systemctl restart mage-knight-server

# Pull latest changes and rebuild
cd /root/MageKnight
git pull
bun install
bun run build
systemctl restart mage-knight-server
```

## Accessing the Dev Server

The dev server runs on port 3001 (WebSocket) and 3002 (Bootstrap HTTP API).

To access from your local machine, you can either:

### Option 1: SSH Tunnel
```bash
ssh -i ~/.ssh/id_hetzner -L 3001:localhost:3001 -L 3002:localhost:3002 root@<SERVER_IP>
```

Then connect to `ws://localhost:3001` from your local client.

### Option 2: Firewall Rule (if needed)
The server has no firewall configured by default, so ports should be accessible directly at `ws://<SERVER_IP>:3001`.

## Cost Management

- **cx22**: ~$6.50/month
- **cx11**: ~$4.15/month (1 vCPU, 2GB RAM) - may struggle with builds

### Downgrade to cx11 (if builds work)

Edit `terraform.tfvars`:
```hcl
server_type = "cx11"
```

Then:
```bash
terraform apply
```

**Note**: Downgrading requires server recreation (destroys and recreates).

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

Type `yes` when prompted. This will:
- Delete the server
- Remove the SSH key from Hetzner
- Stop all charges

## Troubleshooting

### Cloud-init logs
```bash
# View cloud-init progress
tail -f /var/log/cloud-init-output.log

# Check cloud-init status
cloud-init status
```

### Setup script logs
```bash
# The setup script output is in cloud-init logs
cat /var/log/cloud-init-output.log
```

### GitHub SSH issues
```bash
# Test GitHub connection
ssh -T git@github.com

# Should see: "Hi <username>! You've successfully authenticated..."
```

### Dev server not starting
```bash
# Check service status
systemctl status mage-knight-server

# View detailed logs
journalctl -u mage-knight-server -n 100 --no-pager
```

## Files

- `main.tf` - Main Terraform configuration
- `variables.tf` - Input variables
- `outputs.tf` - Output values
- `cloud-init.yaml` - VM initialization script
- `terraform.tfvars` - Your configuration (gitignored)
