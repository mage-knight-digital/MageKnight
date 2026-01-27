#!/bin/bash
# Installs GitHub CLI (gh) if not already available
# Used by SessionStart hook for Claude Code sessions

set -e

GH_VERSION="2.63.2"
INSTALL_DIR="$HOME/.local/bin"

# Ensure ~/.local/bin is in PATH for this session and future sessions
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    export PATH="$INSTALL_DIR:$PATH"
    # Add to .bashrc if not already there
    if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$HOME/.bashrc" 2>/dev/null; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    fi
fi

# Check if gh is already installed and working
if command -v gh &> /dev/null || [ -x "$INSTALL_DIR/gh" ]; then
    echo "gh CLI already installed"
    exit 0
fi

echo "Installing gh CLI v$GH_VERSION..."

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download and extract gh
curl -sL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" | tar xz -C /tmp

# Move binary to install directory
mv "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" "$INSTALL_DIR/"

# Verify installation
if [ -x "$INSTALL_DIR/gh" ]; then
    echo "gh CLI installed successfully to $INSTALL_DIR/gh"
else
    echo "Warning: gh CLI installation may have failed"
fi

# Clean up
rm -rf "/tmp/gh_${GH_VERSION}_linux_amd64"

exit 0
