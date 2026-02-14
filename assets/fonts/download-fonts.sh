#!/usr/bin/env bash
# Downloads the 6 bundled handwriting fonts from the google/fonts GitHub repo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="https://raw.githubusercontent.com/google/fonts/main"

# Some fonts are now variable-weight only in the Google repo.
# We download the variable font TTF and rename to -Regular.ttf.
# They work fine as standard TTFs with @napi-rs/canvas.

echo "Downloading DancingScript-Regular.ttf (variable font) ..."
curl -fsSL "$BASE_URL/ofl/dancingscript/DancingScript%5Bwght%5D.ttf" -o "$SCRIPT_DIR/DancingScript-Regular.ttf"

echo "Downloading GreatVibes-Regular.ttf ..."
curl -fsSL "$BASE_URL/ofl/greatvibes/GreatVibes-Regular.ttf" -o "$SCRIPT_DIR/GreatVibes-Regular.ttf"

echo "Downloading Caveat-Regular.ttf (variable font) ..."
curl -fsSL "$BASE_URL/ofl/caveat/Caveat%5Bwght%5D.ttf" -o "$SCRIPT_DIR/Caveat-Regular.ttf"

echo "Downloading Sacramento-Regular.ttf ..."
curl -fsSL "$BASE_URL/ofl/sacramento/Sacramento-Regular.ttf" -o "$SCRIPT_DIR/Sacramento-Regular.ttf"

echo "Downloading Pacifico-Regular.ttf ..."
curl -fsSL "$BASE_URL/ofl/pacifico/Pacifico-Regular.ttf" -o "$SCRIPT_DIR/Pacifico-Regular.ttf"

echo "Downloading HomemadeApple-Regular.ttf ..."
curl -fsSL "$BASE_URL/apache/homemadeapple/HomemadeApple-Regular.ttf" -o "$SCRIPT_DIR/HomemadeApple-Regular.ttf"

echo "All 6 fonts downloaded."
ls -la "$SCRIPT_DIR"/*.ttf
