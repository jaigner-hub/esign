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

async function main() {
  await generateSamplePdf();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
