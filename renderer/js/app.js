/* App - initialization, file open, sign & save flow */
(function () {
  'use strict';

  let originalPdfBytes = null;
  let originalFilename = null;

  document.addEventListener('DOMContentLoaded', () => {
    // Initialize modules
    window.PdfViewer.init(document.getElementById('pdf-pages'));
    window.Placement.init();
    window.SignaturePanel.init(document.getElementById('signature-panel-container'));
    window.TextPanel.init(document.getElementById('text-panel-container'));

    // File open buttons
    document.getElementById('header-open-btn').addEventListener('click', openFile);
    document.getElementById('drop-zone-open-btn').addEventListener('click', openFile);

    // Drag and drop on drop zone
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].name.toLowerCase().endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = () => {
          const bytes = new Uint8Array(reader.result);
          loadPdfIntoViewer(files[0].name, bytes);
        };
        reader.readAsArrayBuffer(files[0]);
      } else {
        showToast('Please drop a PDF file', 'error');
      }
    });

    // Sign & Save button
    document.getElementById('sign-save-btn').addEventListener('click', signAndSave);

    // Listen for placement changes to enable/disable Sign & Save
    document.addEventListener('placement-changed', (e) => {
      const btn = document.getElementById('sign-save-btn');
      btn.disabled = e.detail.count === 0;
    });

    // Listen for file opened from menu
    if (window.electronAPI && window.electronAPI.onFileOpened) {
      window.electronAPI.onFileOpened((data) => {
        loadPdfIntoViewer(data.name, new Uint8Array(data.bytes));
      });
    }
  });

  async function openFile() {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (result) {
        loadPdfIntoViewer(result.name, new Uint8Array(result.bytes));
      }
    } catch (err) {
      showToast('Failed to open file: ' + err.message, 'error');
    }
  }

  async function loadPdfIntoViewer(name, bytes) {
    try {
      originalPdfBytes = bytes;
      originalFilename = name;

      await window.PdfViewer.loadPdf(bytes);
      window.Placement.clearAll();

      // Show workspace, hide drop zone
      document.getElementById('drop-zone').classList.add('hidden');
      document.getElementById('workspace').classList.remove('hidden');
      document.getElementById('action-bar').classList.remove('hidden');
      document.getElementById('sign-save-btn').disabled = true;
    } catch (err) {
      showToast('Failed to load PDF: ' + err.message, 'error');
    }
  }

  async function signAndSave() {
    const elements = window.Placement.getElements();
    if (elements.length === 0) {
      showToast('No elements placed on the document', 'error');
      return;
    }

    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    try {
      const signedBytes = await window.electronAPI.signPdf(
        Array.from(originalPdfBytes),
        elements
      );

      const defaultName = 'signed-' + originalFilename;
      const savedPath = await window.electronAPI.saveFile(
        Array.from(signedBytes),
        defaultName
      );

      if (savedPath) {
        showToast('Document saved to ' + savedPath, 'success');
      }
    } catch (err) {
      showToast('Failed to sign PDF: ' + err.message, 'error');
    } finally {
      loadingOverlay.classList.add('hidden');
    }
  }

  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
})();
