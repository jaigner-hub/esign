/**
 * Text field creation panel — text input, date shortcuts, and placement
 * Exposes window.TextPanel
 */
(function () {
  'use strict';

  let containerEl = null;
  let textInput = null;
  let fontSizeInput = null;
  let colorInput = null;
  let addBtn = null;

  /**
   * Initialize the text panel UI inside the given container.
   * @param {HTMLElement} el - The container element
   */
  function init(el) {
    containerEl = el;

    // Text input
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Text Value';
    containerEl.appendChild(textLabel);

    textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Enter date, name, etc.';
    textInput.addEventListener('input', onInputChange);
    containerEl.appendChild(textInput);

    // Quick-insert buttons
    const quickLabel = document.createElement('label');
    quickLabel.textContent = 'Quick Insert';
    containerEl.appendChild(quickLabel);

    const quickBtns = document.createElement('div');
    quickBtns.className = 'quick-insert-buttons';

    const todayMDY = document.createElement('button');
    todayMDY.className = 'btn-secondary';
    todayMDY.textContent = 'Today (MM/DD/YYYY)';
    todayMDY.addEventListener('click', function () {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const yyyy = now.getFullYear();
      textInput.value = mm + '/' + dd + '/' + yyyy;
      onInputChange();
    });
    quickBtns.appendChild(todayMDY);

    const todayISO = document.createElement('button');
    todayISO.className = 'btn-secondary';
    todayISO.textContent = 'Today (ISO)';
    todayISO.addEventListener('click', function () {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      textInput.value = yyyy + '-' + mm + '-' + dd;
      onInputChange();
    });
    quickBtns.appendChild(todayISO);

    containerEl.appendChild(quickBtns);

    // Font size
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Font Size';
    containerEl.appendChild(sizeLabel);

    fontSizeInput = document.createElement('input');
    fontSizeInput.type = 'number';
    fontSizeInput.min = '8';
    fontSizeInput.max = '36';
    fontSizeInput.value = '12';
    containerEl.appendChild(fontSizeInput);

    // Color input
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    containerEl.appendChild(colorLabel);

    colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#000000';
    containerEl.appendChild(colorInput);

    // Add to Document button
    const actions = document.createElement('div');
    actions.className = 'panel-actions';

    addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.textContent = 'Add to Document';
    addBtn.disabled = true;
    addBtn.addEventListener('click', onAddToDocument);
    actions.appendChild(addBtn);

    containerEl.appendChild(actions);
  }

  function onInputChange() {
    const value = textInput.value.trim();
    addBtn.disabled = !value;
  }

  function onAddToDocument() {
    const value = textInput.value.trim();
    if (!value) {
      showToast('Please enter text', 'error');
      return;
    }

    const fontSize = parseInt(fontSizeInput.value, 10);
    if (isNaN(fontSize) || fontSize < 8 || fontSize > 36) {
      showToast('Font size must be between 8 and 36', 'error');
      return;
    }

    const currentPageIndex = getCurrentPageIndex();

    window.Placement.addElement(currentPageIndex, 'text', {
      value: value,
      fontSize: fontSize,
      color: colorInput.value
    });

    showToast('Text added to page ' + (currentPageIndex + 1), 'success');
  }

  /**
   * Get the index of the currently most-visible page in the viewer.
   */
  function getCurrentPageIndex() {
    const viewerArea = document.getElementById('viewer-area');
    if (!viewerArea) return 0;

    const pages = document.querySelectorAll('.pdf-page');
    if (pages.length === 0) return 0;

    const viewerRect = viewerArea.getBoundingClientRect();
    const viewerCenter = viewerRect.top + viewerRect.height / 2;
    let closestIndex = 0;
    let closestDist = Infinity;

    for (let i = 0; i < pages.length; i++) {
      const pageRect = pages[i].getBoundingClientRect();
      const pageCenter = pageRect.top + pageRect.height / 2;
      const dist = Math.abs(pageCenter - viewerCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

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

  // Expose on window
  window.TextPanel = {
    init
  };
})();
