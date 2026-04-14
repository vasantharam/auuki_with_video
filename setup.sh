#!/usr/bin/env bash
# Auuki setup + launcher — Mac and Linux
# Usage: bash setup.sh

set -e

REPO_URL="https://github.com/vasantharam/auuki_with_video.git"
REPO_DIR="auuki_with_video"
PORT=3000

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}  Auuki — indoor cycling app${NC}"
echo "  ============================="
echo ""

# ── git ──────────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
    echo -e "${RED}Git is not installed.${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  Install it by running:  xcode-select --install"
    else
        echo "  Install it by running:  sudo apt install git"
        echo "  (or your distro's package manager equivalent)"
    fi
    exit 1
fi

# ── clone or update ───────────────────────────────────────────────────────────
if [ -d "$REPO_DIR/.git" ]; then
    echo -e "${GREEN}Updating Auuki...${NC}"
    git -C "$REPO_DIR" pull --ff-only
else
    echo -e "${GREEN}Downloading Auuki...${NC}"
    git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"

# ── find a server ─────────────────────────────────────────────────────────────
serve_python3() {
    python3 -m http.server "$PORT" --directory dist --bind 127.0.0.1
}
serve_node() {
    # npx serve handles range requests and correct MIME types
    npx --yes serve dist --listen "$PORT" --no-clipboard
}
serve_fallback() {
    echo ""
    echo -e "${RED}No suitable server found.${NC}"
    echo ""
    echo "  Please install Python 3 and try again:"
    echo "    Mac:    https://www.python.org/downloads/"
    echo "    Linux:  sudo apt install python3"
    echo ""
    exit 1
}

echo ""
echo -e "${GREEN}Starting Auuki on http://localhost:${PORT}${NC}"
echo "  Press Ctrl+C to stop."
echo ""

# open browser in background after a short delay
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 1.5 && open "http://localhost:${PORT}") &
elif command -v xdg-open &>/dev/null; then
    (sleep 1.5 && xdg-open "http://localhost:${PORT}") &
fi

if command -v python3 &>/dev/null; then
    serve_python3
elif command -v node &>/dev/null && command -v npm &>/dev/null; then
    serve_node
else
    serve_fallback
fi
