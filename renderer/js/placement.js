/* Placement Engine - drag, drop, resize elements on PDF pages */
(function () {
  'use strict';

  let elementIdCounter = 0;
  const elements = new Map(); // id -> { el, pageIndex, type, options }

  function init() {
    elementIdCounter = 0;
    elements.clear();
  }

  function addElement(pageIndex, type, options) {
    const id = 'placed-' + (++elementIdCounter);

    // Find the page overlay
    const pageWrapper = document.querySelector(`.pdf-page[data-page-index="${pageIndex}"]`);
    if (!pageWrapper) {
      throw new Error(`Page ${pageIndex} not found`);
    }
    const overlay = pageWrapper.querySelector('.page-overlay');

    // Create element container
    const el = document.createElement('div');
    el.className = 'placed-element';
    el.id = id;
    el.style.left = '50px';
    el.style.top = '50px';

    if (type === 'signature' && options.dataUrl) {
      const img = document.createElement('img');
      img.src = options.dataUrl;
      img.draggable = false;
      el.appendChild(img);
      el.style.width = Math.min(options.width || 200, overlay.offsetWidth - 60) + 'px';
      el.style.height = (options.height || 50) + 'px';
    } else if (type === 'text') {
      const span = document.createElement('span');
      span.className = 'element-text';
      span.textContent = options.value || '';
      span.style.fontSize = (options.fontSize || 12) + 'px';
      span.style.color = options.color || '#000000';
      span.contentEditable = true;
      el.appendChild(span);
      // Auto-size based on text
      el.style.width = 'auto';
      el.style.height = 'auto';
      el.style.minWidth = '60px';
      el.style.minHeight = '20px';
    }

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '\u00D7';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeElement(id);
    });
    el.appendChild(deleteBtn);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    el.appendChild(resizeHandle);

    // Drag support
    setupDrag(el, overlay);

    // Resize support
    setupResize(el, resizeHandle, overlay);

    overlay.appendChild(el);

    elements.set(id, { el, pageIndex, type, options });

    // Notify that elements changed (for enabling Sign & Save button)
    dispatchChangeEvent();

    return id;
  }

  function removeElement(id) {
    const entry = elements.get(id);
    if (entry) {
      entry.el.remove();
      elements.delete(id);
      dispatchChangeEvent();
    }
  }

  function clearAll() {
    for (const [id, entry] of elements) {
      entry.el.remove();
    }
    elements.clear();
    dispatchChangeEvent();
  }

  function getElements() {
    const result = [];
    const scale = window.PdfViewer ? window.PdfViewer.getScale() : 1;

    for (const [id, entry] of elements) {
      const { el, pageIndex, type, options } = entry;

      // Get page dimensions for this specific page
      const pageDims = window.PdfViewer ? window.PdfViewer.getPageDimensions(pageIndex) : null;
      const pageWrapper = document.querySelector(`.pdf-page[data-page-index="${pageIndex}"]`);
      const pageHeightPx = pageWrapper ? pageWrapper.offsetHeight : 0;

      const elLeft = parseFloat(el.style.left) || 0;
      const elTop = parseFloat(el.style.top) || 0;
      const elWidth = el.offsetWidth;
      const elHeight = el.offsetHeight;

      // Convert screen pixels to PDF points
      const pdfX = elLeft / scale;
      const pdfY = (pageHeightPx - elTop - elHeight) / scale;
      const pdfWidth = elWidth / scale;
      const pdfHeight = elHeight / scale;

      const element = {
        type,
        page: pageIndex,
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight,
      };

      if (type === 'signature') {
        element.value = options.name || options.value || '';
        element.fontIndex = options.fontIndex;
        element.fontSize = options.fontSize;
        element.color = options.color;
        element.dataUrl = options.dataUrl;
      } else if (type === 'text') {
        // Get current text from the editable span
        const span = el.querySelector('.element-text');
        element.value = span ? span.textContent : (options.value || '');
        element.fontSize = options.fontSize || 12;
        element.color = options.color || '#000000';
      }

      result.push(element);
    }

    return result;
  }

  function setupDrag(el, overlay) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    el.addEventListener('mousedown', (e) => {
      // Ignore if clicking on delete button, resize handle, or editable text
      if (e.target.classList.contains('delete-btn') ||
          e.target.classList.contains('resize-handle') ||
          e.target.classList.contains('element-text')) {
        return;
      }

      isDragging = true;
      offsetX = e.clientX - el.getBoundingClientRect().left + overlay.getBoundingClientRect().left;
      offsetY = e.clientY - el.getBoundingClientRect().top + overlay.getBoundingClientRect().top;
      el.classList.add('selected');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      let newLeft = e.clientX - offsetX + overlay.scrollLeft;
      let newTop = e.clientY - offsetY + overlay.scrollTop;

      // Constrain within overlay bounds
      const maxLeft = overlay.offsetWidth - el.offsetWidth;
      const maxTop = overlay.offsetHeight - el.offsetHeight;
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        el.classList.remove('selected');
      }
    });
  }

  function setupResize(el, handle, overlay) {
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = el.offsetWidth;
      startHeight = el.offsetHeight;
      e.stopPropagation();
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      let newWidth = startWidth + (e.clientX - startX);
      let newHeight = startHeight + (e.clientY - startY);

      // Minimum size
      newWidth = Math.max(30, newWidth);
      newHeight = Math.max(15, newHeight);

      // Constrain within overlay
      const elLeft = parseFloat(el.style.left) || 0;
      const elTop = parseFloat(el.style.top) || 0;
      newWidth = Math.min(newWidth, overlay.offsetWidth - elLeft);
      newHeight = Math.min(newHeight, overlay.offsetHeight - elTop);

      el.style.width = newWidth + 'px';
      el.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
      }
    });
  }

  function dispatchChangeEvent() {
    document.dispatchEvent(new CustomEvent('placement-changed', {
      detail: { count: elements.size },
    }));
  }

  window.Placement = {
    init,
    addElement,
    removeElement,
    getElements,
    clearAll,
  };
})();
