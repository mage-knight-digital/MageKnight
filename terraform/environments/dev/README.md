# Development Terraform Environment

Creates development Cloudflare/R2 resources and, optionally, a development Hetzner app server.

Apply `../../bootstrap/cloudflare-token` first. This environment reads the
Cloudflare provider token from the bootstrap stack's local Terraform state.
`CLOUDFLARE_API_TOKEN` is not required for this environment.

Remote state:

- State bucket: `mageknight-terraform-state`
- Backend config template: `backend.hcl.example`
- Requires dashboard-generated R2 S3 API credentials before `terraform init -migrate-state`.

Defaults:

- app: `dev.mageknightdigital.app`
- API: `api-dev.mageknightdigital.app`
- assets: `assets-dev.mageknightdigital.app`
- R2 bucket: `mageknight-assets-dev`
