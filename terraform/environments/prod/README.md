# Production Terraform Environment

Creates production Cloudflare/R2 resources and, optionally, the production Hetzner app server.

Apply flow:

1. Apply `../../bootstrap/cloudflare-token` first.
2. Fill in `terraform.tfvars`.
3. Apply with `app_origin_ipv4 = null` and `api_origin_ipv4 = null`.
4. Upload assets to `mageknight/v1/assets/...` with `scripts/publish-assets-r2.sh`.

The Cloudflare provider reads its token from the bootstrap stack's local
Terraform state. `CLOUDFLARE_API_TOKEN` is not required for this environment.

Current production outputs:

- App: `https://play.mageknightdigital.app`
- API health: `https://api.mageknightdigital.app/health`
- Asset base: `https://assets.mageknightdigital.app/mageknight/v1/assets`

Remote state:

- State bucket: `mageknight-terraform-state`
- Backend config template: `backend.hcl.example`
- Requires dashboard-generated R2 S3 API credentials before `terraform init -migrate-state`.
