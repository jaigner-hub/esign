const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Parses a hex color string (e.g., '#ff0000') into pdf-lib rgb values.
 * @param {string} hex - Hex color string starting with '#'.
 * @returns {{ r: number, g: number, b: number }}
 */
function parseHexColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

/**
 * Signs a PDF by embedding signature images and drawing text elements.
 * @param {Uint8Array|Buffer} pdfBytes - The original PDF file bytes.
 * @param {Array} elements - Array of element objects to embed.
 * @returns {Promise<Uint8Array>} The modified PDF bytes.
 */
async function signPdf(pdfBytes, elements) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const el of elements) {
    // Clamp page index to valid range
    const pageIndex = Math.max(0, Math.min(el.page, pages.length - 1));
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Clamp coordinates to page dimensions
    const x = Math.max(0, Math.min(el.x, pageWidth));
    const y = Math.max(0, Math.min(el.y, pageHeight));

    if (el.type === 'signature') {
      // Decode the base64 PNG from the dataUrl
      const base64Data = el.dataUrl.replace(/^data:image\/png;base64,/, '');
      const pngBytes = Buffer.from(base64Data, 'base64');
      const pngImage = await pdfDoc.embedPng(pngBytes);

      const width = Math.max(1, Math.min(el.width || pngImage.width, pageWidth));
      const height = Math.max(1, Math.min(el.height || pngImage.height, pageHeight));

      page.drawImage(pngImage, {
        x,
        y,
        width,
        height,
      });
    } else if (el.type === 'text') {
      const { r, g, b } = parseHexColor(el.color || '#000000');
      const fontSize = el.fontSize || 12;

      page.drawText(el.value || '', {
        x,
        y,
        size: fontSize,
        font: helvetica,
        color: rgb(r, g, b),
      });
    }
  }

  const modifiedBytes = await pdfDoc.save();
  return new Uint8Array(modifiedBytes);
}

module.exports = { signPdf };
