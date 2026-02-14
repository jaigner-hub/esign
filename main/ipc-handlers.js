const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderSignature } = require('./lib/signature-renderer');
const { signPdf } = require('./lib/pdf-signer');

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_ELEMENTS = 100;
const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function validateSignatureOpts(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('Invalid signature options');
  }
  if (!opts.name || typeof opts.name !== 'string' || opts.name.trim().length === 0) {
    throw new Error('Name must be a non-empty string');
  }
  if (opts.name.length > 200) {
    throw new Error('Name must be under 200 characters');
  }
  if (!Number.isInteger(opts.fontIndex) || opts.fontIndex < 0 || opts.fontIndex > 5) {
    throw new Error('fontIndex must be an integer between 0 and 5');
  }
  if (typeof opts.fontSize !== 'number' || opts.fontSize < 8 || opts.fontSize > 200) {
    throw new Error('fontSize must be a number between 8 and 200');
  }
  if (!COLOR_REGEX.test(opts.color)) {
    throw new Error('color must be a valid hex color string (e.g., #000000)');
  }
}

function validateSignPdfInput(pdfBytes, elements) {
  if (!pdfBytes || !(pdfBytes instanceof Array || ArrayBuffer.isView(pdfBytes) || Buffer.isBuffer(pdfBytes))) {
    throw new Error('pdfBytes must be a Buffer or Uint8Array');
  }
  if (pdfBytes.length === 0) {
    throw new Error('pdfBytes must not be empty');
  }
  if (pdfBytes.length > MAX_PDF_SIZE) {
    throw new Error('PDF file exceeds maximum size of 50MB');
  }
  if (!Array.isArray(elements) || elements.length === 0) {
    throw new Error('elements must be a non-empty array');
  }
  if (elements.length > MAX_ELEMENTS) {
    throw new Error(`Too many elements (max ${MAX_ELEMENTS})`);
  }
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el || typeof el !== 'object') {
      throw new Error(`Element ${i} is invalid`);
    }
    if (el.type !== 'signature' && el.type !== 'text') {
      throw new Error(`Element ${i} has invalid type: ${el.type}`);
    }
    if (typeof el.page !== 'number' || el.page < 0) {
      throw new Error(`Element ${i} has invalid page index`);
    }
  }
}

function registerHandlers(mainWindow) {
  ipcMain.handle('render-signature', async (_event, opts) => {
    try {
      // Input validation
      validateSignatureOpts(opts);
      const result = await renderSignature(opts);
      return result;
    } catch (err) {
      throw new Error(`Failed to render signature: ${err.message}`);
    }
  });

  ipcMain.handle('sign-pdf', async (_event, pdfBytes, elements) => {
    try {
      // Input validation
      validateSignPdfInput(pdfBytes, elements);

      // For each signature element, render the signature first and attach dataUrl
      for (const el of elements) {
        if (el.type === 'signature' && !el.dataUrl) {
          const rendered = await renderSignature({
            name: el.value,
            fontIndex: el.fontIndex,
            fontSize: el.fontSize,
            color: el.color,
          });
          el.dataUrl = rendered.dataUrl;
          if (!el.width) el.width = rendered.width;
          if (!el.height) el.height = rendered.height;
        }
      }

      const result = await signPdf(Buffer.from(pdfBytes), elements);
      return new Uint8Array(result);
    } catch (err) {
      throw new Error(`Failed to sign PDF: ${err.message}`);
    }
  });

  ipcMain.handle('open-file-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      const bytes = fs.readFileSync(filePath);
      return {
        name: path.basename(filePath),
        bytes: new Uint8Array(bytes),
      };
    } catch (err) {
      throw new Error(`Failed to open file: ${err.message}`);
    }
  });

  ipcMain.handle('save-file', async (_event, bytes, defaultName) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName || 'signed.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      fs.writeFileSync(result.filePath, Buffer.from(bytes));
      return result.filePath;
    } catch (err) {
      throw new Error(`Failed to save file: ${err.message}`);
    }
  });
}

module.exports = { registerHandlers };
