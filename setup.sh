#!/usr/bin/env bash
# Auuki launcher — Mac and Linux
# First run: downloads and extracts the app, then starts it.
# To update: delete the auuki_with_video-main folder and run again.

ZIP_URL="https://github.com/vasantharam/auuki_with_video/archive/refs/heads/main.zip"
APP_DIR="auuki_with_video-main"
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

# ── download and extract if not present ───────────────────────────────────────
if [ ! -d "$APP_DIR" ]; then
    echo -e "${GREEN}Downloading Auuki (this may take a moment)...${NC}"

    if command -v curl &>/dev/null; then
        curl -L --progress-bar -o auuki.zip "$ZIP_URL"
    elif command -v wget &>/dev/null; then
        wget -q --show-progress -O auuki.zip "$ZIP_URL"
    else
        echo -e "${RED}curl or wget is required to download Auuki.${NC}"
        echo "Install curl:  sudo apt install curl   (Linux)"
        echo "              brew install curl        (Mac)"
        exit 1
    fi

    echo "Extracting..."
    unzip -q auuki.zip
    rm auuki.zip
    echo -e "${GREEN}Done.${NC}"
    echo ""
fi

cd "$APP_DIR"

# ── find a server ─────────────────────────────────────────────────────────────
echo -e "${GREEN}Starting Auuki on http://localhost:${PORT}${NC}"
echo "  Press Ctrl+C to stop."
echo -e "  ${YELLOW}To update: delete the '${APP_DIR}' folder and run this script again.${NC}"
echo ""

# open browser in background
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 1.5 && open "http://localhost:${PORT}") &
elif command -v xdg-open &>/dev/null; then
    (sleep 1.5 && xdg-open "http://localhost:${PORT}") &
fi

if command -v python3 &>/dev/null; then
    python3 -m http.server "$PORT" --directory dist --bind 127.0.0.1
elif command -v python &>/dev/null; then
    cd dist && python -m SimpleHTTPServer "$PORT"
elif command -v npx &>/dev/null; then
    npx --yes serve dist --listen "$PORT" --no-clipboard
else
    echo -e "${RED}No server found. Please install Python 3 and try again:${NC}"
    echo "  Mac:    https://www.python.org/downloads/"
    echo "  Linux:  sudo apt install python3"
    exit 1
fi
