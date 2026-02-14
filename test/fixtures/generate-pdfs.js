const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([612, 792]); // US Letter
  page.drawText('Sample PDF Document', {
    x: 50,
    y: 700,
    size: 24,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
  page.drawText('This is a test PDF for esign.', {
    x: 50,
    y: 660,
    size: 14,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText('Sign here: ___________________________', {
    x: 50,
    y: 200,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  const outPath = path.join(__dirname, 'sample.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Generated ${outPath}`);
}

async function generateMultipagePdf() {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Page 1: US Letter (612 x 792)
  const page1 = pdfDoc.addPage([612, 792]);
  page1.drawText('Page 1 — US Letter (612 x 792)', {
    x: 50,
    y: 700,
    size: 18,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
  page1.drawText('Sign here: ___________________________', {
    x: 50,
    y: 200,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  // Page 2: A4 (595.28 x 841.89)
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText('Page 2 — A4 (595.28 x 841.89)', {
    x: 50,
    y: 780,
    size: 18,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
  page2.drawText('Date: ________________', {
    x: 50,
    y: 200,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  // Page 3: US Legal (612 x 1008)
  const page3 = pdfDoc.addPage([612, 1008]);
  page3.drawText('Page 3 — US Legal (612 x 1008)', {
    x: 50,
    y: 950,
    size: 18,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
  page3.drawText('Witness: ___________________________', {
    x: 50,
    y: 200,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  const outPath = path.join(__dirname, 'multipage.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Generated ${outPath}`);
}

async function main() {
  await generateSamplePdf();
  await generateMultipagePdf();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
