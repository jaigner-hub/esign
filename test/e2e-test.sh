#!/usr/bin/env bash
# End-to-end test script for esign signing pipeline.
# Exercises: fixture generation → mocha tests → full pipeline (load PDF, render signature, sign, write output, verify).
# Exits 0 on success, 1 on failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
OUTPUT_FILE="$FIXTURES_DIR/output-signed.pdf"

# Cleanup on exit
cleanup() {
  if [ -f "$OUTPUT_FILE" ]; then
    rm -f "$OUTPUT_FILE"
  fi
}
trap cleanup EXIT

echo "=== esign end-to-end test ==="
echo ""

# Step 1: Generate PDF fixtures
echo "--- Step 1: Generating PDF fixtures ---"
node "$FIXTURES_DIR/generate-pdfs.js"
if [ ! -f "$FIXTURES_DIR/sample.pdf" ] || [ ! -f "$FIXTURES_DIR/multipage.pdf" ]; then
  echo "FAIL: PDF fixtures not generated"
  exit 1
fi
echo "OK: PDF fixtures exist"
echo ""

# Step 2: Run mocha unit/integration tests
echo "--- Step 2: Running mocha tests ---"
cd "$PROJECT_DIR"
npx mocha test/test-sign.js --timeout 15000
echo "OK: Mocha tests passed"
echo ""

# Step 3: Full pipeline — load PDF, render signature, sign with both signature + text, write output, verify
echo "--- Step 3: Full signing pipeline ---"
node -e "
const fs = require('fs');
const path = require('path');

const { renderSignature } = require('./main/lib/signature-renderer');
const { signPdf } = require('./main/lib/pdf-signer');

async function run() {
  // Load sample PDF
  const samplePath = path.join('test', 'fixtures', 'sample.pdf');
  const pdfBytes = fs.readFileSync(samplePath);
  console.log('  Loaded sample.pdf (' + pdfBytes.length + ' bytes)');

  // Render a signature
  const sig = await renderSignature({ name: 'Jane Doe', fontIndex: 3, fontSize: 48, color: '#000055' });
  console.log('  Rendered signature: ' + sig.width + 'x' + sig.height + ' px');

  // Sign the PDF with both a signature and a text element
  const elements = [
    {
      type: 'signature',
      page: 0,
      x: 100,
      y: 200,
      width: sig.width,
      height: sig.height,
      dataUrl: sig.dataUrl
    },
    {
      type: 'text',
      page: 0,
      x: 100,
      y: 150,
      width: 200,
      height: 20,
      value: 'Signed on 2026-02-14',
      fontSize: 12,
      color: '#333333'
    }
  ];

  const signedBytes = await signPdf(pdfBytes, elements);
  console.log('  Signed PDF: ' + signedBytes.length + ' bytes');

  // Write output
  const outputPath = path.join('test', 'fixtures', 'output-signed.pdf');
  fs.writeFileSync(outputPath, signedBytes);
  console.log('  Wrote output to ' + outputPath);

  // Verify output starts with %PDF header
  const header = String.fromCharCode(signedBytes[0], signedBytes[1], signedBytes[2], signedBytes[3], signedBytes[4]);
  if (header !== '%PDF-') {
    console.error('  FAIL: Output does not start with %%PDF- header (got: ' + header + ')');
    process.exit(1);
  }
  console.log('  Verified: output starts with %%PDF- header');

  // Verify output is larger than input (has added content)
  if (signedBytes.length <= pdfBytes.length) {
    console.error('  FAIL: Signed PDF is not larger than original');
    process.exit(1);
  }
  console.log('  Verified: signed PDF is larger than original (' + signedBytes.length + ' > ' + pdfBytes.length + ')');
}

run().then(() => {
  console.log('  Pipeline: OK');
}).catch((err) => {
  console.error('  Pipeline FAIL: ' + err.message);
  process.exit(1);
});
"
echo ""

echo "=== All e2e tests passed ==="
exit 0
