const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function parseHexColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

async function signPdf(pdfBytes, elements) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const el of elements) {
    const pageIndex = Math.max(0, Math.min(el.page, pages.length - 1));
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Clamp coordinates to page dimensions
    const x = Math.max(0, Math.min(el.x, pageWidth));
    const y = Math.max(0, Math.min(el.y, pageHeight));

    if (el.type === 'signature' && el.dataUrl) {
      // Decode base64 PNG from dataUrl
      const base64Data = el.dataUrl.replace(/^data:image\/png;base64,/, '');
      const pngBytes = Buffer.from(base64Data, 'base64');
      const pngImage = await pdfDoc.embedPng(pngBytes);

      const drawWidth = Math.min(el.width || pngImage.width, pageWidth - x);
      const drawHeight = Math.min(el.height || pngImage.height, pageHeight - y);

      page.drawImage(pngImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      });
    } else if (el.type === 'text') {
      const color = el.color ? parseHexColor(el.color) : rgb(0, 0, 0);
      const fontSize = el.fontSize || 12;

      page.drawText(el.value || '', {
        x,
        y,
        size: fontSize,
        font: helvetica,
        color,
      });
    }
  }

  return pdfDoc.save();
}

module.exports = { signPdf };
