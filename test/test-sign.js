const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const { renderSignature } = require('../main/lib/signature-renderer');
const { signPdf } = require('../main/lib/pdf-signer');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Ensure test fixtures exist
before(async function () {
  this.timeout(15000);
  if (!fs.existsSync(path.join(FIXTURES_DIR, 'sample.pdf')) ||
      !fs.existsSync(path.join(FIXTURES_DIR, 'multipage.pdf'))) {
    require('./fixtures/generate-pdfs');
    // Wait a moment for files to be written
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
});

describe('signature-renderer', function () {
  this.timeout(15000);

  it('should render a signature with valid input', async function () {
    const result = await renderSignature({
      name: 'Test User',
      fontIndex: 0,
      fontSize: 48,
      color: '#000000',
    });

    expect(result).to.be.an('object');
    expect(result.dataUrl).to.be.a('string');
    expect(result.dataUrl).to.match(/^data:image\/png;base64,/);
    expect(result.width).to.be.a('number').and.to.be.greaterThan(0);
    expect(result.height).to.be.a('number').and.to.be.greaterThan(0);
  });

  it('should throw an error for empty name', async function () {
    try {
      await renderSignature({
        name: '',
        fontIndex: 0,
        fontSize: 48,
        color: '#000000',
      });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err.message).to.include('non-empty');
    }
  });

  it('should render with each fontIndex 0-5', async function () {
    for (let i = 0; i < 6; i++) {
      const result = await renderSignature({
        name: 'Font Test',
        fontIndex: i,
        fontSize: 48,
        color: '#000000',
      });
      expect(result.dataUrl).to.match(/^data:image\/png;base64,/);
      expect(result.width).to.be.greaterThan(0);
      expect(result.height).to.be.greaterThan(0);
    }
  });
});

describe('pdf-signer', function () {
  this.timeout(15000);

  let samplePdf;
  let multipagePdf;

  before(function () {
    samplePdf = fs.readFileSync(path.join(FIXTURES_DIR, 'sample.pdf'));
    multipagePdf = fs.readFileSync(path.join(FIXTURES_DIR, 'multipage.pdf'));
  });

  it('should sign a PDF with a text element and return valid PDF', async function () {
    const result = await signPdf(samplePdf, [{
      type: 'text',
      page: 0,
      x: 100,
      y: 700,
      width: 200,
      height: 20,
      value: 'Hello World',
      fontSize: 12,
      color: '#000000',
    }]);

    expect(result).to.be.instanceOf(Uint8Array);
    expect(result.length).to.be.greaterThan(0);
    // Check PDF header
    const header = String.fromCharCode(result[0], result[1], result[2], result[3]);
    expect(header).to.equal('%PDF');
  });

  it('should sign a PDF with a signature element', async function () {
    // Pre-render a signature
    const rendered = await renderSignature({
      name: 'John Doe',
      fontIndex: 2,
      fontSize: 48,
      color: '#000000',
    });

    const result = await signPdf(samplePdf, [{
      type: 'signature',
      page: 0,
      x: 150,
      y: 100,
      width: rendered.width,
      height: rendered.height,
      value: 'John Doe',
      fontIndex: 2,
      fontSize: 48,
      color: '#000000',
      dataUrl: rendered.dataUrl,
    }]);

    expect(result).to.be.instanceOf(Uint8Array);
    const header = String.fromCharCode(result[0], result[1], result[2], result[3]);
    expect(header).to.equal('%PDF');
  });

  it('should handle elements on different pages of multipage PDF', async function () {
    const result = await signPdf(multipagePdf, [
      { type: 'text', page: 0, x: 50, y: 50, width: 200, height: 20, value: 'Page 1 text', fontSize: 14, color: '#ff0000' },
      { type: 'text', page: 1, x: 50, y: 50, width: 200, height: 20, value: 'Page 2 text', fontSize: 14, color: '#00ff00' },
      { type: 'text', page: 2, x: 50, y: 50, width: 200, height: 20, value: 'Page 3 text', fontSize: 14, color: '#0000ff' },
    ]);

    expect(result).to.be.instanceOf(Uint8Array);
    expect(result.length).to.be.greaterThan(0);
  });

  it('should clamp out-of-range page index without error', async function () {
    const result = await signPdf(samplePdf, [{
      type: 'text',
      page: 999,
      x: 100,
      y: 100,
      width: 200,
      height: 20,
      value: 'Out of range',
      fontSize: 12,
      color: '#000000',
    }]);

    expect(result).to.be.instanceOf(Uint8Array);
    expect(result.length).to.be.greaterThan(0);
  });
});
