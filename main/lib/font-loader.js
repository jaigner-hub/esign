const path = require('path');
const fs = require('fs');

const FONTS_DIR = path.join(__dirname, '../../assets/fonts/');

const FONTS = [
  { name: 'DancingScript', label: 'Dancing Script', path: path.join(FONTS_DIR, 'DancingScript-Regular.ttf') },
  { name: 'GreatVibes', label: 'Great Vibes', path: path.join(FONTS_DIR, 'GreatVibes-Regular.ttf') },
  { name: 'Caveat', label: 'Caveat', path: path.join(FONTS_DIR, 'Caveat-Regular.ttf') },
  { name: 'Sacramento', label: 'Sacramento', path: path.join(FONTS_DIR, 'Sacramento-Regular.ttf') },
  { name: 'Pacifico', label: 'Pacifico', path: path.join(FONTS_DIR, 'Pacifico-Regular.ttf') },
  { name: 'HomemadeApple', label: 'Homemade Apple', path: path.join(FONTS_DIR, 'HomemadeApple-Regular.ttf') },
];

/**
 * Reads a font file as a Buffer.
 * @param {number} fontIndex - Index into the FONTS array (0-5).
 * @returns {Buffer} The font file contents.
 */
function loadFontBuffer(fontIndex) {
  if (fontIndex < 0 || fontIndex >= FONTS.length) {
    throw new Error(`Invalid fontIndex: ${fontIndex}. Must be 0-${FONTS.length - 1}.`);
  }
  return fs.readFileSync(FONTS[fontIndex].path);
}

module.exports = { FONTS, loadFontBuffer };
