#!/bin/bash
# Download the 6 Google Fonts TTF files from the google/fonts GitHub repo
# Note: Can also be run via: node assets/fonts/download-fonts.js

FONT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="https://raw.githubusercontent.com/google/fonts/main"

declare -A FONTS
FONTS["DancingScript-Regular.ttf"]="ofl/dancingscript/DancingScript%5Bwght%5D.ttf"
FONTS["GreatVibes-Regular.ttf"]="ofl/greatvibes/GreatVibes-Regular.ttf"
FONTS["Caveat-Regular.ttf"]="ofl/caveat/Caveat%5Bwght%5D.ttf"
FONTS["Sacramento-Regular.ttf"]="ofl/sacramento/Sacramento-Regular.ttf"
FONTS["Pacifico-Regular.ttf"]="ofl/pacifico/Pacifico-Regular.ttf"
FONTS["HomemadeApple-Regular.ttf"]="apache/homemadeapple/HomemadeApple-Regular.ttf"

for dest in "${!FONTS[@]}"; do
  src="${FONTS[$dest]}"
  url="${BASE_URL}/${src}"
  echo "Downloading ${dest}..."
  curl -fsSL -o "${FONT_DIR}/${dest}" "${url}"
  if [ $? -ne 0 ]; then
    echo "Failed to download ${dest}"
    exit 1
  fi
done

echo "All fonts downloaded successfully."
