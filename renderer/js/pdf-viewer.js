/**
 * PDF Viewer module — renders PDF pages using pdf.js
 * Exposes window.PdfViewer
 */
(function () {
  'use strict';

  let containerEl = null;
  let pdfDoc = null;
  let currentScale = 1;
  const pageDimensions = []; // { width, height } in PDF points per page

  const MAX_WIDTH = 800; // max render width in pixels

  /**
   * Initialize the viewer with a container element.
   */
  function init(el) {
    containerEl = el;
  }

  /**
   * Load a PDF from a Uint8Array and render all pages.
   */
  async function loadPdf(uint8Array) {
    if (!containerEl) {
      throw new Error('PdfViewer not initialized — call init() first');
    }
    if (!window.pdfjsLib) {
      throw new Error('pdf.js not loaded');
    }

    // Clear previous content
    containerEl.innerHTML = '';
    pageDimensions.length = 0;

    const loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
    pdfDoc = await loadingTask.promise;

    await renderAllPages();
  }

  /**
   * Render every page of the loaded PDF into the container.
   */
  async function renderAllPages() {
    if (!pdfDoc) {
      return;
    }

    containerEl.innerHTML = '';
    pageDimensions.length = 0;

    const numPages = pdfDoc.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });

      // Store original PDF dimensions (in points)
      pageDimensions.push({
        width: viewport.width,
        height: viewport.height
      });

      // Calculate scale to fit container (max MAX_WIDTH px)
      const containerWidth = Math.min(containerEl.clientWidth || MAX_WIDTH, MAX_WIDTH);
      const scale = containerWidth / viewport.width;
      currentScale = scale;

      const scaledViewport = page.getViewport({ scale });

      // Create page wrapper
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page';
      pageWrapper.dataset.pageIndex = String(i - 1);
      pageWrapper.style.width = scaledViewport.width + 'px';
      pageWrapper.style.height = scaledViewport.height + 'px';

      // Create canvas for PDF rendering
      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Create overlay div for placed elements
      const overlay = document.createElement('div');
      overlay.className = 'page-overlay';

      pageWrapper.appendChild(canvas);
      pageWrapper.appendChild(overlay);
      containerEl.appendChild(pageWrapper);

      // Render the page onto the canvas
      const ctx = canvas.getContext('2d');
      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport
      }).promise;
    }
  }

  /**
   * Get the PDF-point dimensions for a specific page.
   */
  function getPageDimensions(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pageDimensions.length) {
      return null;
    }
    return pageDimensions[pageIndex];
  }

  /**
   * Get the current render scale factor.
   */
  function getScale() {
    return currentScale;
  }

  /**
   * Get the total number of pages in the loaded PDF.
   */
  function getPageCount() {
    return pdfDoc ? pdfDoc.numPages : 0;
  }

  // Expose on window
  window.PdfViewer = {
    init,
    loadPdf,
    renderAllPages,
    getPageDimensions,
    getScale,
    getPageCount
  };
})();
