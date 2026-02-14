/**
 * Signature creation panel — font selection, preview, and placement
 * Exposes window.SignaturePanel
 */
(function () {
  'use strict';

  const FONT_FAMILIES = [
    { name: 'Dancing Script', css: "'Dancing Script', cursive" },
    { name: 'Great Vibes', css: "'Great Vibes', cursive" },
    { name: 'Caveat', css: "'Caveat', cursive" },
    { name: 'Sacramento', css: "'Sacramento', cursive" },
    { name: 'Pacifico', css: "'Pacifico', cursive" },
    { name: 'Homemade Apple', css: "'Homemade Apple', cursive" }
  ];

  let containerEl = null;
  let nameInput = null;
  let fontSizeSlider = null;
  let fontSizeLabel = null;
  let colorInput = null;
  let previewBtn = null;
  let addBtn = null;
  let previewArea = null;
  let selectedFontIndex = 0;
  let fontBoxes = [];
  let lastPreview = null; // { dataUrl, width, height }
  let previewTimer = null;

  /**
   * Initialize the signature panel UI inside the given container.
   * @param {HTMLElement} el - The container element
   */
  function init(el) {
    containerEl = el;
    lastPreview = null;

    // Name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Your Name';
    containerEl.appendChild(nameLabel);

    nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Type your name';
    nameInput.addEventListener('input', onNameChange);
    containerEl.appendChild(nameInput);

    // Font preview grid
    const fontLabel = document.createElement('label');
    fontLabel.textContent = 'Font Style';
    containerEl.appendChild(fontLabel);

    const grid = document.createElement('div');
    grid.className = 'font-preview-grid';
    fontBoxes = [];

    for (let i = 0; i < FONT_FAMILIES.length; i++) {
      const box = document.createElement('div');
      box.className = 'font-preview-box';
      if (i === selectedFontIndex) {
        box.classList.add('selected');
      }
      box.style.fontFamily = FONT_FAMILIES[i].css;
      box.textContent = 'Signature';
      box.dataset.fontIndex = i;
      box.addEventListener('click', function () {
        selectFont(i);
      });
      grid.appendChild(box);
      fontBoxes.push(box);
    }

    containerEl.appendChild(grid);

    // Font size slider
    const sizeLabel = document.createElement('label');
    fontSizeLabel = document.createElement('span');
    fontSizeLabel.textContent = '48';
    sizeLabel.textContent = 'Font Size: ';
    sizeLabel.appendChild(fontSizeLabel);
    containerEl.appendChild(sizeLabel);

    fontSizeSlider = document.createElement('input');
    fontSizeSlider.type = 'range';
    fontSizeSlider.min = '24';
    fontSizeSlider.max = '72';
    fontSizeSlider.value = '48';
    fontSizeSlider.addEventListener('input', function () {
      fontSizeLabel.textContent = fontSizeSlider.value;
      autoPreview();
    });
    containerEl.appendChild(fontSizeSlider);

    // Color input
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    containerEl.appendChild(colorLabel);

    colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#000000';
    colorInput.addEventListener('input', function () {
      autoPreview();
    });
    containerEl.appendChild(colorInput);

    // Preview area
    previewArea = document.createElement('div');
    previewArea.className = 'signature-preview';
    previewArea.innerHTML = '<span style="color:#999;font-size:12px;">Preview will appear here</span>';
    containerEl.appendChild(previewArea);

    // Action buttons
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

  function selectFont(index) {
    selectedFontIndex = index;
    for (let i = 0; i < fontBoxes.length; i++) {
      fontBoxes[i].classList.toggle('selected', i === index);
    }
    autoPreview();
  }

  function onNameChange() {
    const name = nameInput.value.trim();
    // Update font preview boxes with the typed name
    for (let i = 0; i < fontBoxes.length; i++) {
      fontBoxes[i].textContent = name || 'Signature';
    }
    autoPreview();
  }

  function clearPreview() {
    lastPreview = null;
    addBtn.disabled = true;
    previewArea.innerHTML = '<span style="color:#999;font-size:12px;">Type your name above</span>';
  }

  function autoPreview() {
    clearPreview();
    if (previewTimer) clearTimeout(previewTimer);
    const name = nameInput.value.trim();
    if (!name) return;
    previewTimer = setTimeout(function () {
      renderPreview(name);
    }, 300);
  }

  async function renderPreview(name) {
    const opts = {
      name: name,
      fontIndex: selectedFontIndex,
      fontSize: parseInt(fontSizeSlider.value, 10),
      color: colorInput.value
    };

    try {
      const result = await window.electronAPI.renderSignature(opts);
      // Only apply if name hasn't changed during render
      if (nameInput.value.trim() !== name) return;
      lastPreview = result;

      previewArea.innerHTML = '';
      const img = document.createElement('img');
      img.src = result.dataUrl;
      previewArea.appendChild(img);

      addBtn.disabled = false;
    } catch (err) {
      showToast('Failed to render signature: ' + err.message, 'error');
      clearPreview();
    }
  }

  function onAddToDocument() {
    if (!lastPreview) return;

    const name = nameInput.value.trim();
    if (!name) {
      showToast('Please enter your name', 'error');
      return;
    }

    // Determine current page (first visible page or page 0)
    const currentPageIndex = getCurrentPageIndex();

    window.Placement.addElement(currentPageIndex, 'signature', {
      dataUrl: lastPreview.dataUrl,
      width: lastPreview.width,
      height: lastPreview.height,
      name: name,
      fontIndex: selectedFontIndex,
      fontSize: parseInt(fontSizeSlider.value, 10),
      color: colorInput.value
    });

    showToast('Signature added to page ' + (currentPageIndex + 1), 'success');
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
  window.SignaturePanel = {
    init
  };
})();
