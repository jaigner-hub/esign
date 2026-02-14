const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  renderSignature: (opts) => ipcRenderer.invoke('render-signature', opts),
  signPdf: (pdfBytes, elements) => ipcRenderer.invoke('sign-pdf', pdfBytes, elements),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFile: (bytes, defaultName) => ipcRenderer.invoke('save-file', bytes, defaultName),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (_event, data) => callback(data)),
});
