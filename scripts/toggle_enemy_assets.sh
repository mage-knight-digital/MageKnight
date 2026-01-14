#!/bin/bash
# Toggle between original and upscaled enemy assets
# Usage: ./scripts/toggle_enemy_assets.sh [original|upscaled|status]

ASSETS_DIR="packages/client/public/assets"
ENEMIES_DIR="$ASSETS_DIR/enemies"
ORIGINAL_DIR="$ASSETS_DIR/enemies-original"
UPSCALED_DIR="$ASSETS_DIR/enemies-upscaled"

# Check current state by looking for a marker file
get_current_state() {
    if [ -f "$ENEMIES_DIR/.upscaled" ]; then
        echo "upscaled"
    else
        echo "original"
    fi
}

case "${1:-status}" in
    status)
        echo "Current enemy assets: $(get_current_state)"
        ;;
    original)
        if [ "$(get_current_state)" = "original" ]; then
            echo "Already using original assets"
            exit 0
        fi
        echo "Switching to original assets..."
        rm -f "$ENEMIES_DIR/.upscaled"
        # Move current (upscaled) to upscaled backup
        rm -rf "$UPSCALED_DIR"
        mv "$ENEMIES_DIR" "$UPSCALED_DIR"
        # Move original to active
        mv "$ORIGINAL_DIR" "$ENEMIES_DIR"
        echo "Done! Using original assets"
        ;;
    upscaled)
        if [ "$(get_current_state)" = "upscaled" ]; then
            echo "Already using upscaled assets"
            exit 0
        fi
        echo "Switching to upscaled assets..."
        # Move current (original) to original backup
        rm -rf "$ORIGINAL_DIR"
        mv "$ENEMIES_DIR" "$ORIGINAL_DIR"
        # Move upscaled to active
        mv "$UPSCALED_DIR" "$ENEMIES_DIR"
        touch "$ENEMIES_DIR/.upscaled"
        echo "Done! Using upscaled assets"
        ;;
    *)
        echo "Usage: $0 [original|upscaled|status]"
        exit 1
        ;;
esac
