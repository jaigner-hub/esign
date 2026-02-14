const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderSignature } = require('./lib/signature-renderer');
const { signPdf } = require('./lib/pdf-signer');

/**
 * Registers all IPC handlers for main↔renderer communication.
 * @param {Electron.BrowserWindow} mainWindow
 */
function registerHandlers(mainWindow) {
  // Render a signature image from typed text
  ipcMain.handle('render-signature', async (_event, opts) => {
    try {
      const result = await renderSignature(opts);
      return result;
    } catch (err) {
      throw new Error(`Failed to render signature: ${err.message}`);
    }
  });

  // Sign a PDF with placed elements (signatures + text)
  ipcMain.handle('sign-pdf', async (_event, pdfBytes, elements) => {
    try {
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

      const result = await signPdf(Buffer.from(pdfBytes), elements);
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
