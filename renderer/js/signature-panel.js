/* Signature Panel - signature creation UI */
(function () {
  'use strict';

  const FONT_FAMILIES = [
    { css: "'Dancing Script', cursive", label: 'Dancing Script' },
    { css: "'Great Vibes', cursive", label: 'Great Vibes' },
    { css: "'Caveat', cursive", label: 'Caveat' },
    { css: "'Sacramento', cursive", label: 'Sacramento' },
    { css: "'Pacifico', cursive", label: 'Pacifico' },
    { css: "'Homemade Apple', cursive", label: 'Homemade Apple' },
  ];

  let containerEl = null;
  let selectedFontIndex = 0;
  let previewResult = null; // { dataUrl, width, height }

  function init(el) {
    containerEl = el;
    buildUI();
  }

  function buildUI() {
    const html = `
      <label for="sig-name">Your Name</label>
      <input type="text" id="sig-name" placeholder="Type your name..." maxlength="200">

      <label>Font Style</label>
      <div class="font-preview-grid" id="sig-font-grid"></div>

      <label for="sig-font-size">Font Size: <span id="sig-font-size-val">48</span></label>
      <input type="range" id="sig-font-size" min="24" max="72" value="48">

      <label for="sig-color">Color</label>
      <input type="color" id="sig-color" value="#000000">

      <button class="btn btn-primary" id="sig-preview-btn">Preview</button>

      <div class="signature-preview" id="sig-preview-area">
        <span style="color:#999; font-size:12px;">Preview will appear here</span>
      </div>

      <button class="btn btn-primary" id="sig-add-btn" disabled>Add to Document</button>
    `;

    // Append after the h3
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    containerEl.appendChild(wrapper);

    // Build font grid
    const fontGrid = document.getElementById('sig-font-grid');
    FONT_FAMILIES.forEach((font, idx) => {
      const box = document.createElement('div');
      box.className = 'font-preview-box' + (idx === 0 ? ' selected' : '');
      box.style.fontFamily = font.css;
      box.textContent = 'Signature';
      box.dataset.fontIndex = idx;
      box.title = font.label;
      box.addEventListener('click', () => {
        document.querySelectorAll('.font-preview-box').forEach(b => b.classList.remove('selected'));
        box.classList.add('selected');
        selectedFontIndex = idx;
        previewResult = null;
        document.getElementById('sig-add-btn').disabled = true;
      });
      fontGrid.appendChild(box);
    });

    // Live update font previews as user types
    const nameInput = document.getElementById('sig-name');
    nameInput.addEventListener('input', () => {
      const name = nameInput.value || 'Signature';
      document.querySelectorAll('.font-preview-box').forEach(box => {
        box.textContent = name;
      });
      previewResult = null;
      document.getElementById('sig-add-btn').disabled = true;
    });

    // Font size slider
    const fontSizeSlider = document.getElementById('sig-font-size');
    fontSizeSlider.addEventListener('input', () => {
      document.getElementById('sig-font-size-val').textContent = fontSizeSlider.value;
      previewResult = null;
      document.getElementById('sig-add-btn').disabled = true;
    });

    // Preview button
    document.getElementById('sig-preview-btn').addEventListener('click', handlePreview);

    // Add to document button
    document.getElementById('sig-add-btn').addEventListener('click', handleAdd);
  }

  async function handlePreview() {
    const name = document.getElementById('sig-name').value.trim();
    if (!name) {
      showToast('Please enter your name', 'error');
      return;
    }

    const fontSize = parseInt(document.getElementById('sig-font-size').value, 10);
    const color = document.getElementById('sig-color').value;

    try {
      const result = await window.electronAPI.renderSignature({
        name,
        fontIndex: selectedFontIndex,
        fontSize,
        color,
      });

      previewResult = result;
      const previewArea = document.getElementById('sig-preview-area');
      previewArea.innerHTML = `<img src="${result.dataUrl}" alt="Signature preview">`;
      document.getElementById('sig-add-btn').disabled = false;
    } catch (err) {
      showToast('Failed to preview signature: ' + err.message, 'error');
    }
  }

  function handleAdd() {
    if (!previewResult) return;

    const name = document.getElementById('sig-name').value.trim();
    const fontSize = parseInt(document.getElementById('sig-font-size').value, 10);
    const color = document.getElementById('sig-color').value;

    // Determine current visible page (default to 0)
    const currentPage = getCurrentPageIndex();

    window.Placement.addElement(currentPage, 'signature', {
      dataUrl: previewResult.dataUrl,
      width: previewResult.width,
      height: previewResult.height,
      name,
      fontIndex: selectedFontIndex,
      fontSize,
      color,
    });
  }

  function getCurrentPageIndex() {
    // Find the page most visible in the viewer
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

  window.SignaturePanel = {
    init,
  };
})();
