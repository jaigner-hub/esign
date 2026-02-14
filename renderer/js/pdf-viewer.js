/* PDF Viewer - renders PDF pages using pdf.js */
(function () {
  'use strict';

  let containerEl = null;
  let pdfDoc = null;
  let scale = 1;
  const pageDimensions = []; // { width, height } in PDF points per page

  const MAX_WIDTH = 800;

  function init(el) {
    containerEl = el;
  }

  async function loadPdf(uint8Array) {
    if (!containerEl) {
      throw new Error('PdfViewer not initialized. Call init() first.');
    }

    // pdfjsLib is loaded as a module in index.html; it should be available on window
    // For module-based loading, we may need to wait for it
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('pdf.js library not loaded');
    }

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    pdfDoc = await loadingTask.promise;

    await renderAllPages();
  }

  async function renderAllPages() {
    containerEl.innerHTML = '';
    pageDimensions.length = 0;

    const pageCount = pdfDoc.numPages;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });

      // Store original PDF dimensions
      pageDimensions.push({
        width: viewport.width,
        height: viewport.height,
      });

      // Calculate scale to fit max width
      const pageScale = MAX_WIDTH / viewport.width;
      const scaledViewport = page.getViewport({ scale: pageScale });

      // Update global scale (use first page scale as reference)
      if (i === 1) {
        scale = pageScale;
      }

      // Create page wrapper
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page';
      pageWrapper.setAttribute('data-page-index', i - 1);
      pageWrapper.style.width = scaledViewport.width + 'px';
      pageWrapper.style.height = scaledViewport.height + 'px';

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Create overlay for placing elements
      const overlay = document.createElement('div');
      overlay.className = 'page-overlay';

      pageWrapper.appendChild(canvas);
      pageWrapper.appendChild(overlay);
      containerEl.appendChild(pageWrapper);

      // Render page
      const ctx = canvas.getContext('2d');
      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      }).promise;
    }
  }

  function getPageDimensions(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pageDimensions.length) {
      return null;
    }
    return pageDimensions[pageIndex];
  }

  function getScale() {
    return scale;
  }

  function getPageCount() {
    return pdfDoc ? pdfDoc.numPages : 0;
  }

  window.PdfViewer = {
    init,
    loadPdf,
    renderAllPages,
    getPageDimensions,
    getScale,
    getPageCount,
  };
})();
