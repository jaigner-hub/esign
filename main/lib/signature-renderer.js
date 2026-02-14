const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { FONTS } = require('./font-loader');

const registeredFonts = new Set();

async function renderSignature({ name, fontIndex, fontSize = 48, color = '#000000' }) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Name must be a non-empty string');
  }
  if (fontIndex < 0 || fontIndex >= FONTS.length) {
    throw new Error(`Invalid fontIndex: ${fontIndex}. Must be 0-${FONTS.length - 1}.`);
  }

  const font = FONTS[fontIndex];

  // Register font if not already registered
  if (!registeredFonts.has(fontIndex)) {
    GlobalFonts.registerFromPath(font.path, font.name);
    registeredFonts.add(fontIndex);
  }

  // Measure text width using a temporary canvas
  const measureCanvas = createCanvas(1, 1);
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `${fontSize}px "${font.name}"`;
  const metrics = measureCtx.measureText(name);

  const padding = 20;
  const width = Math.ceil(metrics.width) + padding;
  const height = Math.ceil(fontSize * 1.5);

  // Create the actual canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Transparent background (default)
  ctx.clearRect(0, 0, width, height);

  // Draw text
  ctx.font = `${fontSize}px "${font.name}"`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(name, padding / 2, height / 2);

  // Export as PNG data URL
  const pngBuffer = canvas.toBuffer('image/png');
  const base64 = pngBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  return { dataUrl, width, height };
}

module.exports = { renderSignature };
