const { GlobalFonts, createCanvas } = require('@napi-rs/canvas');
const { FONTS } = require('./font-loader');

// Track which fonts have been registered to avoid re-registering
const registeredFonts = new Set();

/**
 * Renders a signature as a PNG image using the specified handwriting font.
 * @param {Object} opts
 * @param {string} opts.name - The name to render as a signature.
 * @param {number} [opts.fontIndex=0] - Index into the FONTS array (0-5).
 * @param {number} [opts.fontSize=48] - Font size in pixels.
 * @param {string} [opts.color='#000000'] - Hex color string.
 * @returns {Promise<{dataUrl: string, width: number, height: number}>}
 */
async function renderSignature({ name, fontIndex = 0, fontSize = 48, color = '#000000' }) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Signature name must be a non-empty string');
  }

  if (fontIndex < 0 || fontIndex >= FONTS.length) {
    throw new Error(`Invalid fontIndex: ${fontIndex}. Must be 0-${FONTS.length - 1}.`);
  }

  const font = FONTS[fontIndex];

  // Register the font if not already registered
  if (!registeredFonts.has(fontIndex)) {
    GlobalFonts.registerFromPath(font.path, font.name);
    registeredFonts.add(fontIndex);
  }

  // Measure text with a temporary canvas
  const measureCanvas = createCanvas(1, 1);
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `${fontSize}px ${font.name}`;
  const metrics = measureCtx.measureText(name);

  const padding = 20;
  const width = Math.ceil(metrics.width) + padding;
  const height = Math.ceil(fontSize * 1.5);

  // Create the actual canvas with correct dimensions
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw text
  ctx.font = `${fontSize}px ${font.name}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(name, padding / 2, fontSize * 0.15);

  // Export as PNG data URL
  const pngBuffer = canvas.toBuffer('image/png');
  const base64 = pngBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  return { dataUrl, width, height };
}

module.exports = { renderSignature };
