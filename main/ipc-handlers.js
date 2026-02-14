const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderSignature } = require('./lib/signature-renderer');
const { signPdf } = require('./lib/pdf-signer');

function registerHandlers(mainWindow) {
  ipcMain.handle('render-signature', async (_event, opts) => {
    try {
      const result = await renderSignature(opts);
      return result;
    } catch (err) {
      throw new Error(`Failed to render signature: ${err.message}`);
    }
  });

  ipcMain.handle('sign-pdf', async (_event, pdfBytes, elements) => {
    try {
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
