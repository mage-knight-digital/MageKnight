#!/bin/bash
# Sync assets to/from Backblaze B2 with optimized delta sync
#
# Usage:
#   ./scripts/sync-assets.sh upload           # Upload changed assets to B2
#   ./scripts/sync-assets.sh download         # Download changed assets from B2
#   ./scripts/sync-assets.sh upload --all     # Include _local directory
#   ./scripts/sync-assets.sh download --all   # Include _local directory
#   ./scripts/sync-assets.sh upload --dry-run # Preview what would be transferred
#   ./scripts/sync-assets.sh upload --force   # Upload even if B2 has files you don't
#   ./scripts/sync-assets.sh status           # Show what would sync (both dirs)
#
# Optimizations:
#   - Delta sync: Only transfers files where SIZE differs (not timestamps)
#   - Excludes temp/backup files (.bak, .tmp, .DS_Store)
#   - Parallel transfers for speed

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
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Sync options for bandwidth optimization
# --compare-versions size: Only sync if file SIZE differs (ignores timestamps)
#   This is key for multi-machine workflows where timestamps vary
# --exclude-regex: Skip temp/backup files
SYNC_OPTS=(
    --compare-versions size
    --exclude-regex '.*\.(bak|tmp|DS_Store)$'
    --exclude-regex '.*/\..*'
)

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

# Check for files that would be deleted from B2 (indicates you should pull first)
check_upload_conflicts() {
    local local_dir=$1
    local remote_path=$2
    local force=$3

    if [[ "$force" == "true" ]]; then
        return 0
    fi

    # Do a dry-run to see what would be deleted
    local deletes
    deletes=$(b2 sync "${SYNC_OPTS[@]}" --dry-run --delete "$local_dir" "$remote_path" 2>&1 | grep "^delete" || true)
    local count=0
    if [[ -n "$deletes" ]]; then
        count=$(echo "$deletes" | wc -l | tr -d ' ')
    fi

    if [[ $count -gt 0 ]]; then
        echo -e "${RED}⚠️  Warning: Upload would delete $count file(s) from B2 that you don't have locally:${NC}"
        echo "$deletes" | head -10
        if [[ $count -gt 10 ]]; then
            echo "  ... and $((count - 10)) more"
        fi
        echo ""
        echo -e "${YELLOW}This usually means you forgot to pull first. Run:${NC}"
        echo "  $0 download"
        echo ""
        echo -e "${YELLOW}Or use --force to override:${NC}"
        echo "  $0 upload --force"
        return 1
    fi
    return 0
}

# Show local directory sizes
show_sizes() {
    echo -e "${CYAN}Local sizes:${NC}"
    if [[ -d "$ASSETS_DIR" ]]; then
        echo -e "  assets: $(du -sh "$ASSETS_DIR" 2>/dev/null | cut -f1)"
    fi
    if [[ -d "$LOCAL_DIR" ]]; then
        echo -e "  _local: $(du -sh "$LOCAL_DIR" 2>/dev/null | cut -f1)"
    fi
    echo ""
}

upload() {
    local include_local=$1
    local dry_run=$2
    local force=$3
    local extra_opts=()

    if [[ "$dry_run" == "true" ]]; then
        extra_opts+=(--dry-run)
        echo -e "${YELLOW}DRY RUN - No files will be transferred${NC}"
        echo ""
    fi

    show_sizes

    # Check for conflicts (files in B2 that we don't have locally)
    if [[ "$dry_run" != "true" ]]; then
        echo -e "${CYAN}Checking for conflicts...${NC}"
        if ! check_upload_conflicts "$ASSETS_DIR" "b2://$BUCKET/assets" "$force"; then
            exit 1
        fi
        if [[ "$include_local" == "true" && -d "$LOCAL_DIR" ]]; then
            if ! check_upload_conflicts "$LOCAL_DIR" "b2://$BUCKET/_local" "$force"; then
                exit 1
            fi
        fi
        echo -e "${GREEN}No conflicts detected.${NC}"
        echo ""
    fi

    echo -e "${GREEN}Syncing assets to B2...${NC}"
    echo -e "${CYAN}(Only files with different sizes will transfer)${NC}"
    echo ""
    b2 sync "${SYNC_OPTS[@]}" "${extra_opts[@]}" --delete "$ASSETS_DIR" "b2://$BUCKET/assets"

    if [[ "$include_local" == "true" && -d "$LOCAL_DIR" ]]; then
        echo ""
        echo -e "${GREEN}Syncing _local to B2...${NC}"
        b2 sync "${SYNC_OPTS[@]}" "${extra_opts[@]}" --delete "$LOCAL_DIR" "b2://$BUCKET/_local"
    fi

    echo ""
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
    local dry_run=$2
    local extra_opts=()

    if [[ "$dry_run" == "true" ]]; then
        extra_opts+=(--dry-run)
        echo -e "${YELLOW}DRY RUN - No files will be transferred${NC}"
        echo ""
    else
        # Only backup on actual downloads
        backup "$ASSETS_DIR" "assets"
        if [[ "$include_local" == "true" ]]; then
            backup "$LOCAL_DIR" "_local"
        fi
    fi

    show_sizes

    echo -e "${GREEN}Syncing assets from B2...${NC}"
    echo -e "${CYAN}(Only files with different sizes will transfer)${NC}"
    echo ""
    mkdir -p "$ASSETS_DIR"
    b2 sync "${SYNC_OPTS[@]}" "${extra_opts[@]}" --delete "b2://$BUCKET/assets" "$ASSETS_DIR"

    if [[ "$include_local" == "true" ]]; then
        echo ""
        echo -e "${GREEN}Syncing _local from B2...${NC}"
        mkdir -p "$LOCAL_DIR"
        b2 sync "${SYNC_OPTS[@]}" "${extra_opts[@]}" --delete "b2://$BUCKET/_local" "$LOCAL_DIR"
    fi

    echo ""
    echo -e "${GREEN}Done!${NC}"
}

status() {
    echo -e "${CYAN}Checking what would sync...${NC}"
    echo ""

    show_sizes

    echo -e "${YELLOW}=== UPLOAD preview (local → B2) ===${NC}"
    echo ""
    b2 sync "${SYNC_OPTS[@]}" --dry-run --delete "$ASSETS_DIR" "b2://$BUCKET/assets" 2>&1 || true

    if [[ -d "$LOCAL_DIR" ]]; then
        echo ""
        echo -e "${YELLOW}_local:${NC}"
        b2 sync "${SYNC_OPTS[@]}" --dry-run --delete "$LOCAL_DIR" "b2://$BUCKET/_local" 2>&1 || true
    fi

    echo ""
    echo -e "${YELLOW}=== DOWNLOAD preview (B2 → local) ===${NC}"
    echo ""
    b2 sync "${SYNC_OPTS[@]}" --dry-run --delete "b2://$BUCKET/assets" "$ASSETS_DIR" 2>&1 || true

    if [[ -d "$LOCAL_DIR" ]]; then
        echo ""
        echo -e "${YELLOW}_local:${NC}"
        b2 sync "${SYNC_OPTS[@]}" --dry-run --delete "b2://$BUCKET/_local" "$LOCAL_DIR" 2>&1 || true
    fi
}

# Parse arguments
COMMAND=$1
INCLUDE_LOCAL="false"
DRY_RUN="false"
FORCE="false"

shift || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            INCLUDE_LOCAL="true"
            shift
            ;;
        --dry-run|-n)
            DRY_RUN="true"
            shift
            ;;
        --force|-f)
            FORCE="true"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

case $COMMAND in
    upload|up|u)
        upload "$INCLUDE_LOCAL" "$DRY_RUN" "$FORCE"
        ;;
    download|down|d)
        download "$INCLUDE_LOCAL" "$DRY_RUN"
        ;;
    status|s)
        status
        ;;
    *)
        echo "Usage: $0 [upload|download|status] [options]"
        echo ""
        echo "Commands:"
        echo "  upload, up, u      Sync local assets to B2 (only changed files)"
        echo "  download, down, d  Sync assets from B2 (only changed files)"
        echo "  status, s          Preview what would sync in both directions"
        echo ""
        echo "Options:"
        echo "  --all              Include _local directory"
        echo "  --dry-run, -n      Preview changes without transferring"
        echo "  --force, -f        Upload even if B2 has files you don't have locally"
        echo ""
        echo "Examples:"
        echo "  $0 up              # Quick upload at end of day"
        echo "  $0 down            # Sync to another machine"
        echo "  $0 status          # See what's different"
        echo "  $0 up --dry-run    # Preview upload"
        echo "  $0 up --force      # Upload even with conflicts (use carefully!)"
        echo ""
        echo "Bandwidth optimization:"
        echo "  - Only files with DIFFERENT SIZES are transferred"
        echo "  - Timestamps are ignored (safe across machines)"
        echo "  - Temp files (.bak, .tmp, .DS_Store) excluded"
        exit 1
        ;;
esac
