const { PDFDocument, StandardFonts, rgb, PageSizes } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage(PageSizes.Letter);
  const { width, height } = page.getSize();

  page.drawText('Sample PDF Document', {
    x: 50,
    y: height - 50,
    size: 24,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  page.drawText('This is a test document for esign.', {
    x: 50,
    y: height - 100,
    size: 14,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText('Signature: ___________________________', {
    x: 50,
    y: 100,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  page.drawText('Date: _______________', {
    x: 50,
    y: 70,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(__dirname, 'sample.pdf'), pdfBytes);
  console.log('Generated sample.pdf');
}

async function generateMultipagePdf() {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Page 1: Letter size (612 x 792)
  const page1 = pdfDoc.addPage(PageSizes.Letter);
  page1.drawText('Page 1 (Letter)', {
    x: 50,
    y: page1.getSize().height - 50,
    size: 20,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  // Page 2: A4 size (595.28 x 841.89)
  const page2 = pdfDoc.addPage(PageSizes.A4);
  page2.drawText('Page 2 (A4)', {
    x: 50,
    y: page2.getSize().height - 50,
    size: 20,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  // Page 3: Legal size (612 x 1008)
  const page3 = pdfDoc.addPage(PageSizes.Legal);
  page3.drawText('Page 3 (Legal)', {
    x: 50,
    y: page3.getSize().height - 50,
    size: 20,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(__dirname, 'multipage.pdf'), pdfBytes);
  console.log('Generated multipage.pdf');
}

async function main() {
  await generateSamplePdf();
  await generateMultipagePdf();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
