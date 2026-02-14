const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function parseHexColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

async function signPdf(pdfBytes, elements) {
  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes);
  } catch (err) {
    if (err.message && (err.message.includes('encrypt') || err.message.includes('password'))) {
      throw new Error('This PDF is encrypted/password-protected and cannot be signed');
    }
    throw new Error(`Failed to load PDF: ${err.message}`);
  }

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

    if (el.type === 'signature' && el.dataUrl) {
      try {
        // Decode base64 PNG from dataUrl
        const base64Data = el.dataUrl.replace(/^data:image\/png;base64,/, '');
        const pngBytes = Buffer.from(base64Data, 'base64');
        const pngImage = await pdfDoc.embedPng(pngBytes);

        // Clamp width/height to remaining page space
        const drawWidth = Math.max(1, Math.min(el.width || pngImage.width, pageWidth - x));
        const drawHeight = Math.max(1, Math.min(el.height || pngImage.height, pageHeight - y));

        page.drawImage(pngImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
      } catch (err) {
        throw new Error(`Failed to embed signature on page ${pageIndex}: ${err.message}`);
      }
    } else if (el.type === 'text') {
      try {
        const color = el.color ? parseHexColor(el.color) : rgb(0, 0, 0);
        const fontSize = Math.max(1, Math.min(el.fontSize || 12, 200));

        page.drawText(el.value || '', {
          x,
          y,
          size: fontSize,
          font: helvetica,
          color,
        });
      } catch (err) {
        throw new Error(`Failed to draw text on page ${pageIndex}: ${err.message}`);
      }
    }
  }

  return pdfDoc.save();
}

module.exports = { signPdf };
