#!/usr/bin/env bash
set -euo pipefail

ASSETS_DIR="${ASSETS_DIR:-packages/client/public/assets}"
R2_BUCKET="${R2_BUCKET:-mageknight-assets-prod}"
R2_PREFIX="${R2_PREFIX:-mageknight/v1/assets}"
INCLUDE_MUSIC="${INCLUDE_MUSIC:-0}"

if [ ! -d "$ASSETS_DIR" ]; then
  echo "Assets directory not found: $ASSETS_DIR" >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ -f "terraform/bootstrap/cloudflare-token/terraform.tfstate" ]; then
    export CLOUDFLARE_API_TOKEN="$(
      terraform -chdir=terraform/bootstrap/cloudflare-token output -raw cloudflare_api_token
    )"
  else
    echo "CLOUDFLARE_API_TOKEN or bootstrap Terraform state is required" >&2
    exit 1
  fi
fi

find_assets() {
  if [ "$INCLUDE_MUSIC" = "1" ] || [ "$INCLUDE_MUSIC" = "true" ]; then
    find "$ASSETS_DIR" -type f -print0
  else
    find "$ASSETS_DIR" -path "$ASSETS_DIR/audio/music" -prune -o -type f -print0
  fi
}

total=$(find_assets | tr '\0' '\n' | wc -l | tr -d ' ')
if [ "$INCLUDE_MUSIC" = "1" ] || [ "$INCLUDE_MUSIC" = "true" ]; then
  echo "Publishing assets from $ASSETS_DIR, including experimental music."
else
  echo "Publishing assets from $ASSETS_DIR, excluding experimental music in audio/music."
fi

count=0

find_assets | while IFS= read -r -d '' file; do
  rel=${file#"$ASSETS_DIR"/}
  key="$R2_PREFIX/$rel"
  count=$((count + 1))
  printf '[%s/%s] %s\n' "$count" "$total" "$key"
  bunx wrangler r2 object put "$R2_BUCKET/$key" --file "$file" --remote >/dev/null
done
