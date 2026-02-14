#!/bin/bash
# End-to-end test for esign
# Exercises the full signing pipeline without Electron

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "=== esign E2E Test ==="

# Step 1: Generate test fixtures
echo ""
echo "--- Step 1: Generate test PDF fixtures ---"
node test/fixtures/generate-pdfs.js
echo "Fixtures generated."

# Step 2: Run mocha unit/integration tests
echo ""
echo "--- Step 2: Run mocha tests ---"
npx mocha test/test-sign.js --timeout 15000
echo "Mocha tests passed."

# Step 3: Full pipeline test
echo ""
echo "--- Step 3: Full pipeline test ---"
node -e "
const fs = require('fs');
const path = require('path');
const { renderSignature } = require('./main/lib/signature-renderer');
const { signPdf } = require('./main/lib/pdf-signer');

async function run() {
  // Load sample PDF
  const pdfBytes = fs.readFileSync('./test/fixtures/sample.pdf');
  console.log('Loaded sample.pdf (' + pdfBytes.length + ' bytes)');

  // Render a signature
  const sig = await renderSignature({
    name: 'E2E Test User',
    fontIndex: 0,
    fontSize: 48,
    color: '#1a1a2e',
  });
  console.log('Rendered signature: ' + sig.width + 'x' + sig.height + ' pixels');

  // Sign the PDF with both signature and text elements
  const signedBytes = await signPdf(pdfBytes, [
    {
      type: 'signature',
      page: 0,
      x: 150,
      y: 100,
      width: sig.width,
      height: sig.height,
      value: 'E2E Test User',
      fontIndex: 0,
      fontSize: 48,
      color: '#1a1a2e',
      dataUrl: sig.dataUrl,
    },
    {
      type: 'text',
      page: 0,
      x: 150,
      y: 70,
      width: 200,
      height: 20,
      value: '2024-01-15',
      fontSize: 12,
      color: '#000000',
    },
  ]);
  console.log('Signed PDF: ' + signedBytes.length + ' bytes');

  // Write output
  const outputPath = './test/fixtures/output-signed.pdf';
  fs.writeFileSync(outputPath, signedBytes);
  console.log('Wrote signed PDF to ' + outputPath);

  // Verify output starts with %PDF
  const header = String.fromCharCode(signedBytes[0], signedBytes[1], signedBytes[2], signedBytes[3]);
  if (header !== '%PDF') {
    throw new Error('Output does not start with %%PDF header. Got: ' + header);
  }
  console.log('Output verified: starts with %%PDF header');

  // Cleanup
  fs.unlinkSync(outputPath);
  console.log('Cleaned up output file');
}

run().then(() => {
  console.log('Full pipeline test PASSED');
}).catch((err) => {
  console.error('Full pipeline test FAILED:', err.message);
  process.exit(1);
});
"

echo ""
echo "=== ALL E2E TESTS PASSED ==="
exit 0
