const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const { renderSignature } = require('../main/lib/signature-renderer');
const { signPdf } = require('../main/lib/pdf-signer');

const samplePdfPath = path.join(__dirname, 'fixtures', 'sample.pdf');
const multipagePdfPath = path.join(__dirname, 'fixtures', 'multipage.pdf');

describe('signature-renderer', function () {
  it('returns dataUrl, width > 0, height > 0 for valid input', async function () {
    const result = await renderSignature({ name: 'Test User', fontIndex: 0, fontSize: 48, color: '#000000' });
    expect(result).to.have.property('dataUrl');
    expect(result.dataUrl).to.be.a('string').that.includes('data:image/png;base64,');
    expect(result).to.have.property('width');
    expect(result.width).to.be.greaterThan(0);
    expect(result).to.have.property('height');
    expect(result.height).to.be.greaterThan(0);
  });

  it('throws an error for empty name', async function () {
    try {
      await renderSignature({ name: '', fontIndex: 0, fontSize: 48, color: '#000000' });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err.message).to.include('non-empty');
    }
  });

  it('succeeds with each fontIndex 0-5', async function () {
    for (let i = 0; i < 6; i++) {
      const result = await renderSignature({ name: 'Font Test', fontIndex: i, fontSize: 48, color: '#000000' });
      expect(result.dataUrl).to.include('data:image/png;base64,');
      expect(result.width).to.be.greaterThan(0);
      expect(result.height).to.be.greaterThan(0);
    }
  });
});

describe('pdf-signer', function () {
  let samplePdf;
  let multipagePdf;

  before(function () {
    samplePdf = fs.readFileSync(samplePdfPath);
    multipagePdf = fs.readFileSync(multipagePdfPath);
  });

  it('signs sample.pdf with a text element and returns valid PDF', async function () {
    const result = await signPdf(samplePdf, [{
      type: 'text',
      page: 0,
      x: 100,
      y: 700,
      width: 200,
      height: 20,
      value: 'Hello World',
      fontSize: 12,
      color: '#000000'
    }]);
    expect(result).to.be.an.instanceOf(Uint8Array);
    expect(result.length).to.be.greaterThan(0);
    // Check %PDF header
    const header = String.fromCharCode(result[0], result[1], result[2], result[3], result[4]);
    expect(header).to.equal('%PDF-');
  });

  it('signs sample.pdf with a signature element and returns valid PDF', async function () {
    // Pre-render a signature to get a dataUrl
    const sig = await renderSignature({ name: 'John Doe', fontIndex: 2, fontSize: 48, color: '#000000' });

    const result = await signPdf(samplePdf, [{
      type: 'signature',
      page: 0,
      x: 150,
      y: 400,
      width: sig.width,
      height: sig.height,
      dataUrl: sig.dataUrl
    }]);
    expect(result).to.be.an.instanceOf(Uint8Array);
    expect(result.length).to.be.greaterThan(0);
    const header = String.fromCharCode(result[0], result[1], result[2], result[3], result[4]);
    expect(header).to.equal('%PDF-');
  });

  it('signs multipage.pdf with elements on different pages', async function () {
    const sig = await renderSignature({ name: 'Multi Test', fontIndex: 1, fontSize: 36, color: '#0000ff' });

    const result = await signPdf(multipagePdf, [
      { type: 'text', page: 0, x: 100, y: 100, width: 200, height: 20, value: 'Page 1 text', fontSize: 12, color: '#000000' },
      { type: 'signature', page: 1, x: 100, y: 300, width: sig.width, height: sig.height, dataUrl: sig.dataUrl },
      { type: 'text', page: 2, x: 100, y: 100, width: 200, height: 20, value: 'Page 3 text', fontSize: 14, color: '#ff0000' }
    ]);
    expect(result).to.be.an.instanceOf(Uint8Array);
    expect(result.length).to.be.greaterThan(0);
    const header = String.fromCharCode(result[0], result[1], result[2], result[3], result[4]);
    expect(header).to.equal('%PDF-');
  });

  it('clamps out-of-range page index without error', async function () {
    const result = await signPdf(samplePdf, [{
      type: 'text',
      page: 999,
      x: 100,
      y: 700,
      width: 200,
      height: 20,
      value: 'Out of range page',
      fontSize: 12,
      color: '#000000'
    }]);
    expect(result).to.be.an.instanceOf(Uint8Array);
    expect(result.length).to.be.greaterThan(0);
    const header = String.fromCharCode(result[0], result[1], result[2], result[3], result[4]);
    expect(header).to.equal('%PDF-');
  });
});
