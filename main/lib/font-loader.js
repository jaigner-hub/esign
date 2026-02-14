const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, '../../assets/fonts/');

const FONTS = [
  { name: 'DancingScript', label: 'Dancing Script', path: path.join(FONT_DIR, 'DancingScript-Regular.ttf') },
  { name: 'GreatVibes', label: 'Great Vibes', path: path.join(FONT_DIR, 'GreatVibes-Regular.ttf') },
  { name: 'Caveat', label: 'Caveat', path: path.join(FONT_DIR, 'Caveat-Regular.ttf') },
  { name: 'Sacramento', label: 'Sacramento', path: path.join(FONT_DIR, 'Sacramento-Regular.ttf') },
  { name: 'Pacifico', label: 'Pacifico', path: path.join(FONT_DIR, 'Pacifico-Regular.ttf') },
  { name: 'HomemadeApple', label: 'Homemade Apple', path: path.join(FONT_DIR, 'HomemadeApple-Regular.ttf') },
];

function loadFontBuffer(fontIndex) {
  if (fontIndex < 0 || fontIndex >= FONTS.length) {
    throw new Error(`Invalid fontIndex: ${fontIndex}. Must be 0-${FONTS.length - 1}.`);
  }
  return fs.readFileSync(FONTS[fontIndex].path);
}

module.exports = { FONTS, loadFontBuffer };
