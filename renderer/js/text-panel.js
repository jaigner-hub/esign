/* Text Panel - text field creation UI */
(function () {
  'use strict';

  let containerEl = null;

  function init(el) {
    containerEl = el;
    buildUI();
  }

  function buildUI() {
    const html = `
      <label for="text-value">Text</label>
      <input type="text" id="text-value" placeholder="Enter date, name, etc.">

      <div class="quick-insert-row">
        <button class="btn" id="text-date-mmddyyyy">Today (MM/DD/YYYY)</button>
        <button class="btn" id="text-date-iso">Today (ISO)</button>
      </div>

      <label for="text-font-size">Font Size</label>
      <input type="number" id="text-font-size" min="8" max="36" value="12">

      <label for="text-color">Color</label>
      <input type="color" id="text-color" value="#000000">

      <button class="btn btn-primary" id="text-add-btn">Add to Document</button>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    containerEl.appendChild(wrapper);

    // Quick insert: MM/DD/YYYY
    document.getElementById('text-date-mmddyyyy').addEventListener('click', () => {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const yyyy = now.getFullYear();
      document.getElementById('text-value').value = `${mm}/${dd}/${yyyy}`;
    });

    // Quick insert: ISO date
    document.getElementById('text-date-iso').addEventListener('click', () => {
      const now = new Date();
      document.getElementById('text-value').value = now.toISOString().split('T')[0];
    });

    // Add to document
    document.getElementById('text-add-btn').addEventListener('click', handleAdd);
  }

  function handleAdd() {
    const value = document.getElementById('text-value').value.trim();
    if (!value) {
      showToast('Please enter some text', 'error');
      return;
    }

    const fontSize = parseInt(document.getElementById('text-font-size').value, 10) || 12;
    const color = document.getElementById('text-color').value;

    const currentPage = getCurrentPageIndex();

    window.Placement.addElement(currentPage, 'text', {
      value,
      fontSize,
      color,
    });
  }

  function getCurrentPageIndex() {
    const pages = document.querySelectorAll('.pdf-page');
    const container = document.getElementById('viewer-container');
    if (!container || pages.length === 0) return 0;

    const containerRect = container.getBoundingClientRect();
    const containerMid = containerRect.top + containerRect.height / 2;

    let closestIdx = 0;
    let closestDist = Infinity;

    pages.forEach((page, idx) => {
      const rect = page.getBoundingClientRect();
      const pageMid = rect.top + rect.height / 2;
      const dist = Math.abs(pageMid - containerMid);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    return closestIdx;
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

  window.TextPanel = {
    init,
  };
})();
