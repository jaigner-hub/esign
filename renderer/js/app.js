/**
 * App initialization — file open, wire panels, sign & save flow
 * Must be loaded last after PdfViewer, Placement, SignaturePanel, TextPanel
 * Uses browser Canvas API for signatures, pdf-lib for PDF signing.
 * In Tauri: uses window.__TAURI__.core.invoke for file dialogs.
 * In browser: uses <input type="file"> and blob download as fallback.
 */
(function () {
  'use strict';

  let originalPdfBytes = null;
  let originalFilename = null;

  function isTauri() {
    return typeof window.__TAURI__ !== 'undefined';
  }

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
  }

  /**
   * Open a PDF file via Tauri file dialog (desktop) or file input (browser).
   */
  async function openPdfDialog() {
    try {
      if (isTauri()) {
        const result = await window.__TAURI__.core.invoke('open_pdf');
        if (!result) return; // user cancelled
        const bytes = new Uint8Array(result.bytes);
        await loadPdf(bytes, result.name);
      } else {
        // Browser fallback: hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,application/pdf';
        input.onchange = async function () {
          if (!input.files || !input.files[0]) return;
          const file = input.files[0];
          try {
            const arrayBuffer = await file.arrayBuffer();
            await loadPdf(new Uint8Array(arrayBuffer), file.name);
          } catch (err) {
            showToast('Failed to load PDF: ' + err.message, 'error');
          }
        };
        input.click();
      }
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
   * Collect elements, sign the PDF with pdf-lib, and save.
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
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');

      // Sign with pdf-lib (runs entirely in-browser / in-webview)
      const PDFLib = window.PDFLib;
      const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
      const pages = pdfDoc.getPages();
      const helvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const pageIndex = Math.max(0, Math.min(el.page, pages.length - 1));
        const page = pages[pageIndex];
        const pageSize = page.getSize();
        const x = Math.max(0, Math.min(el.x, pageSize.width));
        const y = Math.max(0, Math.min(el.y, pageSize.height));

        if (el.type === 'signature' && el.dataUrl) {
          const base64Data = el.dataUrl.replace(/^data:image\/png;base64,/, '');
          const binaryString = atob(base64Data);
          const pngBytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            pngBytes[j] = binaryString.charCodeAt(j);
          }
          const pngImage = await pdfDoc.embedPng(pngBytes);
          const width = Math.max(1, Math.min(el.width || pngImage.width, pageSize.width));
          const height = Math.max(1, Math.min(el.height || pngImage.height, pageSize.height));
          page.drawImage(pngImage, { x, y, width, height });

        } else if (el.type === 'text') {
          const color = el.color || '#000000';
          const r = parseInt(color.slice(1, 3), 16) / 255;
          const g = parseInt(color.slice(3, 5), 16) / 255;
          const b = parseInt(color.slice(5, 7), 16) / 255;
          page.drawText(el.value || '', {
            x,
            y,
            size: el.fontSize || 12,
            font: helvetica,
            color: PDFLib.rgb(r, g, b)
          });
        }
      }

      const signedBytes = await pdfDoc.save();
      const defaultName = 'signed-' + (originalFilename || 'document.pdf');

      if (isTauri()) {
        // Save via Tauri file dialog
        const savedPath = await window.__TAURI__.core.invoke('save_pdf', {
          bytes: Array.from(signedBytes),
          defaultName: defaultName
        });
        if (savedPath) {
          showToast('Saved to: ' + savedPath, 'success');
        }
      } else {
        // Browser fallback: trigger blob download
        const blob = new Blob([signedBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Downloaded: ' + defaultName, 'success');
      }
    } catch (err) {
      showToast('Failed to sign PDF: ' + err.message, 'error');
    } finally {
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
