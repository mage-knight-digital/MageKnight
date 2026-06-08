#!/usr/bin/env bash
set -euo pipefail

bundle_dir="${1:-packages/client/dist}"

if [ ! -d "$bundle_dir" ]; then
  echo "Client bundle directory not found: $bundle_dir" >&2
  exit 1
fi

bundle_files=$(find "$bundle_dir" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' \))

if grep -E 'ws://localhost|wss://localhost|http://localhost|127\.0\.0\.1:3030' $bundle_files >/dev/null; then
  echo "Production client bundle contains localhost server references." >&2
  grep -n -E 'ws://localhost|wss://localhost|http://localhost|127\.0\.0\.1:3030' $bundle_files >&2
  exit 1
fi

if grep -E 'Download the React DevTools for a better development experience|react[.-]development|react-dom[.-]development' $bundle_files >/dev/null; then
  echo "Production client bundle contains React development-mode references." >&2
  grep -n -E 'Download the React DevTools for a better development experience|react[.-]development|react-dom[.-]development' $bundle_files >&2
  exit 1
fi

if ! grep 'wss://api.mageknightdigital.app/ws' $bundle_files >/dev/null; then
  echo "Production client bundle does not contain the expected API WebSocket URL." >&2
  exit 1
fi
