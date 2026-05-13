# Terraform

This directory uses a module + environment layout:

- `bootstrap/cloudflare-token/` uses a short-lived bootstrap token to mint the reduced-scope Cloudflare token used by the environments.
- `modules/cloudflare_site/` manages Cloudflare DNS and an R2 asset bucket/custom domain.
- `modules/hetzner_app/` manages a Hetzner app VM that serves the client and mk-server behind Caddy.
- `environments/dev/` creates the dev instance using the modules.
- `environments/prod/` creates the prod instance using the modules.

Do not commit real `terraform.tfvars`, `backend.hcl`, state files, or plans — all are gitignored.

The normal environments read the Cloudflare provider token from
`bootstrap/cloudflare-token/terraform.tfstate` (local backend). That file contains
the generated token value and must be treated as secret material — back it up securely.

## Apply order for a fresh account

### Step 0 — Create the Terraform state bucket (one-time, manual)

The state bucket is infrastructure-for-infrastructure. Create it once with wrangler;
it is never managed by Terraform itself.

```bash
bunx wrangler r2 bucket create mageknight-terraform-state
```

R2 encrypts all bucket contents at rest automatically (AES-256). No additional config needed.

Then create a scoped R2 API token for Terraform to read/write that bucket:

1. Cloudflare dashboard → R2 → **Manage R2 API Tokens** → **Create API Token**
2. Permissions: **Object Read & Write**, scope to bucket `mageknight-terraform-state`
3. Copy the **Access Key ID** and **Secret Access Key** (shown once)

For each environment, copy `backend.hcl.example` → `backend.hcl` and paste those credentials:

```bash
cp terraform/environments/prod/backend.hcl.example terraform/environments/prod/backend.hcl
# edit backend.hcl — fill in access_key and secret_key
```

### Step 1 — Bootstrap the Cloudflare token

```bash
TF_VAR_cloudflare_bootstrap_api_token=<short-lived-token-with-account-api-tokens-write> \
  terraform -chdir=terraform/bootstrap/cloudflare-token apply
```

This writes `bootstrap/cloudflare-token/terraform.tfstate` locally. Back this file up
somewhere secure (e.g. 1Password). Revoke the bootstrap token in the Cloudflare dashboard.

### Step 2 — Initialize an environment with remote state

```bash
terraform -chdir=terraform/environments/prod init \
  -backend-config=backend.hcl
```

If migrating existing local state:

```bash
terraform -chdir=terraform/environments/prod init \
  -backend-config=backend.hcl \
  -migrate-state
```

After a successful migration, delete the local state files:

```bash
rm terraform/environments/prod/terraform.tfstate \
   terraform/environments/prod/terraform.tfstate.backup \
   terraform/environments/prod/tfplan*
```

### Step 3 — Apply

```bash
terraform -chdir=terraform/environments/prod apply \
  -var-file=terraform.tfvars
```

### Step 4 — Upload the first asset pack

```bash
source ~/.zshrc
scripts/publish-assets-r2.sh
```

## Assets

Production assets are served from:

```text
https://assets.mageknightdigital.app/mageknight/v1/assets
```

Override `R2_BUCKET`, `R2_PREFIX`, or `ASSETS_DIR` to publish another environment or version.

## Day-to-day applies

```bash
terraform -chdir=terraform/environments/prod plan \
  -backend-config=backend.hcl \
  -var-file=terraform.tfvars \
  -out=tfplan

terraform -chdir=terraform/environments/prod apply tfplan
```

## Chicken-and-egg Q&A

**Q: Why isn't `mageknight-terraform-state` managed by Terraform?**
The state bucket must exist before any Terraform backend can be initialized. Creating it
via Terraform would require somewhere to store that state — a circular dependency. One-time
`wrangler r2 bucket create` breaks the cycle cleanly.

**Q: Is the state bucket encrypted?**
Yes. Cloudflare R2 encrypts all stored objects with AES-256 at rest by default. The bucket
is also private (no public access) — only the scoped R2 API token can read or write it.

**Q: What about the bootstrap state file?**
`bootstrap/cloudflare-token/terraform.tfstate` lives on disk (gitignored) and contains the
long-lived Cloudflare API token. Keep it out of the repo and back it up in a secrets manager.
It rarely changes — only when the token is rotated.
