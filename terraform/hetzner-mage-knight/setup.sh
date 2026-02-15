#!/bin/bash
set -e

echo "=== Mage Knight Hetzner VM Setup ==="
echo ""

# Check for terraform
if ! command -v terraform &> /dev/null; then
    echo "ERROR: Terraform not found. Install from https://www.terraform.io/downloads"
    exit 1
fi

# Check for HCLOUD_TOKEN
if [ -z "$HCLOUD_TOKEN" ]; then
    echo "ERROR: HCLOUD_TOKEN environment variable not set"
    echo ""
    echo "Please set it:"
    echo "  export HCLOUD_TOKEN='your-token-here'"
    echo ""
    echo "Or create terraform.tfvars:"
    echo "  hcloud_token = \"your-token-here\""
    exit 1
fi

# Create tfvars if it doesn't exist
if [ ! -f terraform.tfvars ]; then
    echo "Creating terraform.tfvars..."
    cat > terraform.tfvars <<EOF
hcloud_token = "$HCLOUD_TOKEN"
EOF
fi

echo "Initializing Terraform..."
terraform init

echo ""
echo "Planning infrastructure..."
terraform plan

echo ""
read -p "Apply this configuration? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
    terraform apply -auto-approve
    echo ""
    echo "=== Setup Complete ==="
    echo ""
    terraform output
    echo ""
    echo "Wait ~2-3 minutes for cloud-init to complete setup."
    echo "Then connect with: $(terraform output -raw ssh_command)"
else
    echo "Cancelled."
fi
