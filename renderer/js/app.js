/**
 * App initialization — file open, wire panels, sign & save flow
 * Must be loaded last after PdfViewer, Placement, SignaturePanel, TextPanel
 */
(function () {
  'use strict';

  let originalPdfBytes = null;
  let originalFilename = null;

  function initialize() {
    // Initialize PdfViewer
    const pdfContainer = document.getElementById('pdf-container');
    if (pdfContainer) {
      window.PdfViewer.init(pdfContainer);
    }

    // Initialize Placement engine
    window.Placement.init();

    // Initialize sidebar panels
    const sigContainer = document.getElementById('signature-panel-container');
    if (sigContainer) {
      window.SignaturePanel.init(sigContainer);
    }

    const textContainer = document.getElementById('text-panel-container');
    if (textContainer) {
      window.TextPanel.init(textContainer);
    }

    // Wire up Open PDF buttons
    const headerOpenBtn = document.getElementById('header-open-btn');
    const dropZoneOpenBtn = document.getElementById('drop-zone-open-btn');

    if (headerOpenBtn) {
      headerOpenBtn.addEventListener('click', openPdfDialog);
    }
    if (dropZoneOpenBtn) {
      dropZoneOpenBtn.addEventListener('click', openPdfDialog);
    }

    // Wire up drag-and-drop on the drop zone
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        handleDroppedFiles(e.dataTransfer.files);
      });
    }

    // Wire up Sign & Save button
    const signSaveBtn = document.getElementById('sign-save-btn');
    if (signSaveBtn) {
      signSaveBtn.addEventListener('click', signAndSave);
    }

    // Listen for menu-triggered Open PDF
    if (window.electronAPI && window.electronAPI.onMenuOpenPdf) {
      window.electronAPI.onMenuOpenPdf(function () {
        openPdfDialog();
      });
    }
  }

  /**
   * Open PDF via the Electron file dialog.
   */
  async function openPdfDialog() {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (!result) return; // user cancelled

      const bytes = new Uint8Array(result.bytes);
      await loadPdf(bytes, result.name);
    } catch (err) {
      showToast('Failed to open PDF: ' + err.message, 'error');
    }
  }

  /**
   * Handle files dropped onto the drop zone.
   */
  function handleDroppedFiles(files) {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please drop a PDF file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const bytes = new Uint8Array(reader.result);
        await loadPdf(bytes, file.name);
      } catch (err) {
        showToast('Failed to load PDF: ' + err.message, 'error');
      }
    };
    reader.onerror = function () {
      showToast('Failed to read file', 'error');
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Load a PDF into the viewer and switch to workspace view.
   */
  async function loadPdf(bytes, filename) {
    originalPdfBytes = bytes.slice();
    originalFilename = filename;

    // Clear any previously placed elements
    window.Placement.clearAll();

    // Load into the viewer
    await window.PdfViewer.loadPdf(bytes);

    // Switch from drop zone to workspace view
    const dropZone = document.getElementById('drop-zone');
    const workspace = document.getElementById('workspace');
    const actionBar = document.getElementById('action-bar');

    if (dropZone) dropZone.classList.add('hidden');
    if (workspace) workspace.classList.remove('hidden');
    if (actionBar) actionBar.classList.remove('hidden');

    showToast('Loaded: ' + filename, 'success');
  }

  /**
   * Collect elements, sign the PDF, and save.
   */
  async function signAndSave() {
    if (!originalPdfBytes) {
      showToast('No PDF loaded', 'error');
      return;
    }

    const elements = window.Placement.getElements();
    if (elements.length === 0) {
      showToast('Add at least one signature or text field first', 'error');
      return;
    }

    const loadingOverlay = document.getElementById('loading-overlay');

    try {
      // Show loading overlay
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');

      // Sign the PDF
      const signedBytes = await window.electronAPI.signPdf(
        Array.from(originalPdfBytes),
        elements
      );

      // Determine default filename
      const defaultName = 'signed-' + (originalFilename || 'document.pdf');

      // Save the file
      const savedPath = await window.electronAPI.saveFile(
        Array.from(signedBytes),
        defaultName
      );

      if (savedPath) {
        showToast('Saved to: ' + savedPath, 'success');
      }
    } catch (err) {
      showToast('Failed to sign PDF: ' + err.message, 'error');
    } finally {
      // Hide loading overlay
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  }

  /**
   * Show a toast notification.
   */
  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('fade-out');
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // Initialize when DOM is ready, but wait for pdf.js to load too
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForPdfJs);
  } else {
    waitForPdfJs();
  }

  function waitForPdfJs() {
    if (window.pdfjsLib) {
      initialize();
    } else {
      window.addEventListener('pdfjsReady', initialize);
    }
  }
})();
