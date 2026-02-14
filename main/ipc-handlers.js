const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderSignature } = require('./lib/signature-renderer');
const { signPdf } = require('./lib/pdf-signer');

const MAX_NAME_LENGTH = 200;
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_ELEMENTS = 100;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates render-signature input options.
 * Throws a descriptive error on invalid input.
 */
function validateSignatureOpts(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('Signature options must be an object');
  }
  const { name, fontIndex, fontSize, color } = opts;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Signature name must be a non-empty string');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Signature name must be under ${MAX_NAME_LENGTH} characters`);
  }

  if (fontIndex !== undefined) {
    if (!Number.isInteger(fontIndex) || fontIndex < 0 || fontIndex > 5) {
      throw new Error('fontIndex must be an integer between 0 and 5');
    }
  }

  if (fontSize !== undefined) {
    if (typeof fontSize !== 'number' || fontSize < 8 || fontSize > 200) {
      throw new Error('fontSize must be a number between 8 and 200');
    }
  }

  if (color !== undefined) {
    if (typeof color !== 'string' || !HEX_COLOR_RE.test(color)) {
      throw new Error('color must be a hex color string (e.g. #000000)');
    }
  }
}

/**
 * Validates a single element for the sign-pdf handler.
 */
function validateElement(el, index) {
  if (!el || typeof el !== 'object') {
    throw new Error(`Element at index ${index} must be an object`);
  }
  if (el.type !== 'signature' && el.type !== 'text') {
    throw new Error(`Element at index ${index} must have type 'signature' or 'text'`);
  }
  if (typeof el.page !== 'number' || !Number.isInteger(el.page) || el.page < 0) {
    throw new Error(`Element at index ${index} must have a non-negative integer page`);
  }
  if (typeof el.x !== 'number' || typeof el.y !== 'number') {
    throw new Error(`Element at index ${index} must have numeric x and y coordinates`);
  }

  if (el.type === 'signature') {
    if (typeof el.value !== 'string' || el.value.trim().length === 0) {
      throw new Error(`Signature element at index ${index} must have a non-empty value`);
    }
    if (el.fontIndex !== undefined && (!Number.isInteger(el.fontIndex) || el.fontIndex < 0 || el.fontIndex > 5)) {
      throw new Error(`Signature element at index ${index} has invalid fontIndex`);
    }
  }

  if (el.type === 'text') {
    if (typeof el.value !== 'string' || el.value.length === 0) {
      throw new Error(`Text element at index ${index} must have a non-empty value`);
    }
  }

  if (el.fontSize !== undefined) {
    if (typeof el.fontSize !== 'number' || el.fontSize < 1 || el.fontSize > 200) {
      throw new Error(`Element at index ${index} has invalid fontSize`);
    }
  }

  if (el.color !== undefined) {
    if (typeof el.color !== 'string' || !HEX_COLOR_RE.test(el.color)) {
      throw new Error(`Element at index ${index} has invalid color format`);
    }
  }
}

/**
 * Registers all IPC handlers for main↔renderer communication.
 * @param {Electron.BrowserWindow} mainWindow
 */
function registerHandlers(mainWindow) {
  // Render a signature image from typed text
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

  // Sign a PDF with placed elements (signatures + text)
  ipcMain.handle('sign-pdf', async (_event, pdfBytes, elements) => {
    try {
      // Validate pdfBytes
      if (!pdfBytes || !(pdfBytes instanceof Uint8Array || Buffer.isBuffer(pdfBytes) || Array.isArray(pdfBytes))) {
        throw new Error('pdfBytes must be a Buffer, Uint8Array, or array of bytes');
      }
      const buf = Buffer.from(pdfBytes);
      if (buf.length === 0) {
        throw new Error('pdfBytes must not be empty');
      }
      if (buf.length > MAX_PDF_SIZE) {
        throw new Error(`PDF size exceeds the ${MAX_PDF_SIZE / (1024 * 1024)}MB limit`);
      }

      // Validate elements
      if (!Array.isArray(elements) || elements.length === 0) {
        throw new Error('elements must be a non-empty array');
      }
      if (elements.length > MAX_ELEMENTS) {
        throw new Error(`Too many elements (max ${MAX_ELEMENTS})`);
      }

      // Validate each element
      for (let i = 0; i < elements.length; i++) {
        validateElement(elements[i], i);
      }

      // For each signature element, render the signature and attach the dataUrl
      for (const el of elements) {
        if (el.type === 'signature') {
          const rendered = await renderSignature({
            name: el.value,
            fontIndex: el.fontIndex,
            fontSize: el.fontSize,
            color: el.color
          });
          el.dataUrl = rendered.dataUrl;
        }
      }

      const result = await signPdf(buf, elements);
      return result;
    } catch (err) {
      throw new Error(`Failed to sign PDF: ${err.message}`);
    }
  });

  // Open a file dialog to select a PDF
  ipcMain.handle('open-file-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open PDF',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      const bytes = fs.readFileSync(filePath);
      const name = path.basename(filePath);

      return { name, bytes: new Uint8Array(bytes) };
    } catch (err) {
      throw new Error(`Failed to open file: ${err.message}`);
    }
  });

  // Save signed PDF to disk
  ipcMain.handle('save-file', async (_event, bytes, defaultName) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Signed PDF',
        defaultPath: defaultName || 'signed.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
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
