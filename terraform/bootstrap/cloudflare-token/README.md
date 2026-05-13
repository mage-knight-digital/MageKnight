# Cloudflare Token Bootstrap

This stack mints the reduced-scope Cloudflare API token used by the normal
Terraform environments.

It requires a short-lived bootstrap token with `Account API Tokens Write`.
After this stack applies, the normal environments read the generated token
from this stack's Terraform state. Revoke the bootstrap token.

The generated token can:

- manage R2 buckets in the Cloudflare account
- read the `mageknightdigital.app` zone
- manage DNS records in the `mageknightdigital.app` zone

Apply:

```bash
export TF_VAR_cloudflare_bootstrap_api_token=...
terraform init
terraform apply
```

Terraform state for this stack contains the generated token value and must be
treated as secret material.
