/**
 * Placement engine — drag, drop, resize elements on PDF pages
 * Exposes window.Placement
 */
(function () {
  'use strict';

  let nextId = 1;
  const elements = {}; // id → { id, el, pageIndex, type, options }
  let dragState = null;
  let resizeState = null;

  /**
   * Initialize the placement engine.
   */
  function init() {
    nextId = 1;
    // Clear any existing elements
    clearAll();

    // Global mousemove and mouseup for drag/resize
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Add a placed element to a specific page overlay.
   * @param {number} pageIndex - 0-based page index
   * @param {string} type - 'signature' or 'text'
   * @param {object} options - element options
   * @returns {string} element id
   */
  function addElement(pageIndex, type, options) {
    const overlay = getPageOverlay(pageIndex);
    if (!overlay) {
      throw new Error('Page overlay not found for page ' + pageIndex);
    }

    const id = 'el-' + nextId++;
    const el = document.createElement('div');
    el.className = 'placed-element';
    el.dataset.elementId = id;
    el.dataset.type = type;

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'element-delete';
    deleteBtn.textContent = '\u00D7';
    deleteBtn.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      removeElement(id);
    });
    el.appendChild(deleteBtn);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      startResize(id, e);
    });
    el.appendChild(resizeHandle);

    // Content
    if (type === 'signature' && options.dataUrl) {
      const img = document.createElement('img');
      img.src = options.dataUrl;
      img.draggable = false;
      img.style.width = '100%';
      img.style.height = '100%';
      el.appendChild(img);

      // Set initial size from rendered signature dimensions
      const scale = window.PdfViewer ? window.PdfViewer.getScale() : 1;
      const width = options.width ? options.width * scale : 200;
      const height = options.height ? options.height * scale : 50;
      el.style.width = width + 'px';
      el.style.height = height + 'px';
    } else if (type === 'text') {
      const textSpan = document.createElement('span');
      textSpan.className = 'element-text';
      textSpan.contentEditable = 'false';
      textSpan.textContent = options.value || 'Text';
      textSpan.style.fontSize = (options.fontSize || 12) + 'px';
      textSpan.style.color = options.color || '#000000';
      textSpan.style.pointerEvents = 'none';
      textSpan.style.userSelect = 'none';
      el.appendChild(textSpan);

      // Double-click to edit text, single-click drags
      el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        textSpan.contentEditable = 'true';
        textSpan.style.pointerEvents = 'auto';
        textSpan.style.userSelect = 'auto';
        textSpan.focus();
      });
      textSpan.addEventListener('blur', function () {
        textSpan.contentEditable = 'false';
        textSpan.style.pointerEvents = 'none';
        textSpan.style.userSelect = 'none';
      });

      // Set initial size
      el.style.width = 'auto';
      el.style.height = 'auto';
      el.style.minWidth = '50px';
      el.style.minHeight = '20px';
    }

    // Position near center of overlay by default
    const overlayRect = overlay.getBoundingClientRect();
    const left = Math.max(0, (overlayRect.width / 2) - 100);
    const top = Math.max(0, (overlayRect.height / 2) - 25);
    el.style.left = left + 'px';
    el.style.top = top + 'px';

    // Drag handler on the element itself
    el.addEventListener('mousedown', function (e) {
      if (e.target === resizeHandle) return;
      e.preventDefault();
      startDrag(id, e);
    });

    overlay.appendChild(el);

    elements[id] = {
      id,
      el,
      pageIndex,
      type,
      options
    };

    // Enable sign & save button
    updateSignButton();

    return id;
  }

  /**
   * Remove an element by id.
   */
  function removeElement(id) {
    const entry = elements[id];
    if (!entry) return;
    entry.el.remove();
    delete elements[id];
    updateSignButton();
  }

  /**
   * Get all placed elements with positions converted to PDF points.
   * @returns {Array} elements in PDF coordinate format
   */
  function getElements() {
    const result = [];
    const scale = window.PdfViewer ? window.PdfViewer.getScale() : 1;

    for (const id of Object.keys(elements)) {
      const entry = elements[id];
      const el = entry.el;
      const pageIndex = entry.pageIndex;

      // Get page dimensions in PDF points for this specific page
      const dims = window.PdfViewer ? window.PdfViewer.getPageDimensions(pageIndex) : null;
      if (!dims) continue;

      const pageHeightPx = dims.height * scale;

      // Element position/size in pixels
      const elementLeft = parseFloat(el.style.left) || 0;
      const elementTop = parseFloat(el.style.top) || 0;
      const elementWidth = el.offsetWidth;
      const elementHeight = el.offsetHeight;

      // Convert to PDF coordinates (bottom-left origin)
      const pdfX = elementLeft / scale;
      const pdfY = (pageHeightPx - elementTop - elementHeight) / scale;
      const pdfWidth = elementWidth / scale;
      const pdfHeight = elementHeight / scale;

      const elem = {
        type: entry.type,
        page: pageIndex,
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight
      };

      if (entry.type === 'signature') {
        elem.value = entry.options.name || '';
        elem.fontIndex = entry.options.fontIndex !== undefined ? entry.options.fontIndex : 0;
        elem.fontSize = entry.options.fontSize || 48;
        elem.color = entry.options.color || '#000000';
        elem.dataUrl = entry.options.dataUrl || '';
      } else if (entry.type === 'text') {
        // Get current text from the editable span
        const textSpan = el.querySelector('.element-text');
        elem.value = textSpan ? textSpan.textContent : (entry.options.value || '');
        elem.fontSize = entry.options.fontSize || 12;
        elem.color = entry.options.color || '#000000';
      }

      result.push(elem);
    }

    return result;
  }

  /**
   * Remove all placed elements.
   */
  function clearAll() {
    for (const id of Object.keys(elements)) {
      const entry = elements[id];
      entry.el.remove();
    }
    for (const key of Object.keys(elements)) {
      delete elements[key];
    }
    updateSignButton();
  }

  // ===== Drag Implementation =====

  function startDrag(id, e) {
    const entry = elements[id];
    if (!entry) return;

    const el = entry.el;
    const rect = el.getBoundingClientRect();

    // Select element
    deselectAll();
    el.classList.add('selected');

    dragState = {
      id,
      el,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      overlay: el.parentElement
    };
  }

  function onMouseMove(e) {
    if (dragState) {
      handleDrag(e);
    } else if (resizeState) {
      handleResize(e);
    }
  }

  function handleDrag(e) {
    const { el, offsetX, offsetY, overlay } = dragState;
    const overlayRect = overlay.getBoundingClientRect();

    let left = e.clientX - overlayRect.left - offsetX;
    let top = e.clientY - overlayRect.top - offsetY;

    // Constrain within overlay bounds
    const maxLeft = overlayRect.width - el.offsetWidth;
    const maxTop = overlayRect.height - el.offsetHeight;
    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));

    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function onMouseUp() {
    dragState = null;
    resizeState = null;
  }

  // ===== Resize Implementation =====

  function startResize(id, e) {
    const entry = elements[id];
    if (!entry) return;

    const el = entry.el;

    // Select element
    deselectAll();
    el.classList.add('selected');

    resizeState = {
      id,
      el,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: el.offsetWidth,
      startHeight: el.offsetHeight,
      overlay: el.parentElement
    };
  }

  function handleResize(e) {
    const { el, startX, startY, startWidth, startHeight, overlay } = resizeState;
    const overlayRect = overlay.getBoundingClientRect();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Minimum size 30x15
    let newWidth = Math.max(30, startWidth + dx);
    let newHeight = Math.max(15, startHeight + dy);

    // Constrain within overlay
    const left = parseFloat(el.style.left) || 0;
    const top = parseFloat(el.style.top) || 0;
    newWidth = Math.min(newWidth, overlayRect.width - left);
    newHeight = Math.min(newHeight, overlayRect.height - top);

    el.style.width = newWidth + 'px';
    el.style.height = newHeight + 'px';
  }

  // ===== Helpers =====

  function getPageOverlay(pageIndex) {
    const pageWrapper = document.querySelector('.pdf-page[data-page-index="' + pageIndex + '"]');
    if (!pageWrapper) return null;
    return pageWrapper.querySelector('.page-overlay');
  }

  function deselectAll() {
    const selected = document.querySelectorAll('.placed-element.selected');
    for (let i = 0; i < selected.length; i++) {
      selected[i].classList.remove('selected');
    }
  }

  function updateSignButton() {
    const btn = document.getElementById('sign-save-btn');
    if (!btn) return;
    btn.disabled = Object.keys(elements).length === 0;
  }

  // Expose on window
  window.Placement = {
    init,
    addElement,
    removeElement,
    getElements,
    clearAll
  };
})();
