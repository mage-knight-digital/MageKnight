#!/bin/bash
# Sync assets to/from Backblaze B2
#
# Usage:
#   ./scripts/sync-assets.sh upload        # Upload assets to B2
#   ./scripts/sync-assets.sh download      # Download assets from B2
#   ./scripts/sync-assets.sh upload --all  # Upload assets + _local
#   ./scripts/sync-assets.sh download --all # Download assets + _local

set -e

BUCKET="mageknight"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ASSETS_DIR="$PROJECT_DIR/packages/client/public/assets"
LOCAL_DIR="$PROJECT_DIR/_local"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for b2 CLI
if ! command -v b2 &> /dev/null; then
    echo -e "${RED}Error: b2 CLI not found${NC}"
    echo ""
    echo "Install with: brew install b2-tools"
    echo "Or: pip install b2"
    exit 1
fi

# Check for credentials
if [[ -z "$B2_APPLICATION_KEY_ID" || -z "$B2_APPLICATION_KEY" ]]; then
    echo -e "${RED}Error: B2 credentials not set${NC}"
    echo ""
    echo "Make sure these are in your environment:"
    echo "  export B2_APPLICATION_KEY_ID=\"...\""
    echo "  export B2_APPLICATION_KEY=\"...\""
    exit 1
fi

upload() {
    local include_local=$1

    echo -e "${GREEN}Uploading assets to B2...${NC}"
    b2 sync --delete "$ASSETS_DIR" "b2://$BUCKET/assets"

    if [[ "$include_local" == "true" && -d "$LOCAL_DIR" ]]; then
        echo -e "${GREEN}Uploading _local to B2...${NC}"
        b2 sync --delete "$LOCAL_DIR" "b2://$BUCKET/_local"
    fi

    echo -e "${GREEN}Done!${NC}"
}

backup() {
    local dir=$1
    local name=$2

    if [[ -d "$dir" ]]; then
        local backup_dir="$PROJECT_DIR/.backups"
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_path="$backup_dir/${name}_${timestamp}"

        mkdir -p "$backup_dir"
        echo -e "${YELLOW}Backing up $name to $backup_path...${NC}"
        cp -r "$dir" "$backup_path"
    fi
}

download() {
    local include_local=$1

    # Backup before downloading
    backup "$ASSETS_DIR" "assets"
    if [[ "$include_local" == "true" ]]; then
        backup "$LOCAL_DIR" "_local"
    fi

    echo -e "${GREEN}Downloading assets from B2...${NC}"
    mkdir -p "$ASSETS_DIR"
    b2 sync --delete "b2://$BUCKET/assets" "$ASSETS_DIR"

    if [[ "$include_local" == "true" ]]; then
        echo -e "${GREEN}Downloading _local from B2...${NC}"
        mkdir -p "$LOCAL_DIR"
        b2 sync --delete "b2://$BUCKET/_local" "$LOCAL_DIR"
    fi

    echo -e "${GREEN}Done!${NC}"
}

# Parse arguments
COMMAND=$1
INCLUDE_LOCAL="false"

if [[ "$2" == "--all" ]]; then
    INCLUDE_LOCAL="true"
fi

case $COMMAND in
    upload)
        upload "$INCLUDE_LOCAL"
        ;;
    download)
        download "$INCLUDE_LOCAL"
        ;;
    *)
        echo "Usage: $0 [upload|download] [--all]"
        echo ""
        echo "Commands:"
        echo "  upload     Upload local assets to B2"
        echo "  download   Download assets from B2"
        echo ""
        echo "Options:"
        echo "  --all      Include _local directory (rulebooks, sprites staging)"
        exit 1
        ;;
esac
