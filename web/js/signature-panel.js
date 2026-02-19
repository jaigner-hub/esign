/**
 * Signature creation panel — font selection, preview, and placement
 * Web version: renders signatures using browser Canvas API
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
  let addBtn = null;
  let previewArea = null;
  let selectedFontIndex = 0;
  let fontBoxes = [];
  let lastPreview = null;
  let previewTimer = null;

  function init(el) {
    containerEl = el;
    lastPreview = null;

    var nameLabel = document.createElement('label');
    nameLabel.textContent = 'Your Name';
    containerEl.appendChild(nameLabel);

    nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Type your name';
    nameInput.addEventListener('input', onNameChange);
    containerEl.appendChild(nameInput);

    var fontLabel = document.createElement('label');
    fontLabel.textContent = 'Font Style';
    containerEl.appendChild(fontLabel);

    var grid = document.createElement('div');
    grid.className = 'font-preview-grid';
    fontBoxes = [];

    for (var i = 0; i < FONT_FAMILIES.length; i++) {
      var box = document.createElement('div');
      box.className = 'font-preview-box';
      if (i === selectedFontIndex) box.classList.add('selected');
      box.style.fontFamily = FONT_FAMILIES[i].css;
      box.textContent = 'Signature';
      box.dataset.fontIndex = i;
      (function(idx) {
        box.addEventListener('click', function () { selectFont(idx); });
      })(i);
      grid.appendChild(box);
      fontBoxes.push(box);
    }
    containerEl.appendChild(grid);

    var sizeLabel = document.createElement('label');
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

    var colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    containerEl.appendChild(colorLabel);

    colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#000000';
    colorInput.addEventListener('input', function () { autoPreview(); });
    containerEl.appendChild(colorInput);

    previewArea = document.createElement('div');
    previewArea.className = 'signature-preview';
    previewArea.innerHTML = '<span style="color:#999;font-size:12px;">Preview will appear here</span>';
    containerEl.appendChild(previewArea);

    var actions = document.createElement('div');
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
    for (var i = 0; i < fontBoxes.length; i++) {
      fontBoxes[i].classList.toggle('selected', i === index);
    }
    autoPreview();
  }

  function onNameChange() {
    var name = nameInput.value.trim();
    for (var i = 0; i < fontBoxes.length; i++) {
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
    var name = nameInput.value.trim();
    if (!name) return;
    previewTimer = setTimeout(function () {
      renderPreview(name);
    }, 300);
  }

  /**
   * Render signature using browser Canvas API
   */
  function renderPreview(name) {
    var font = FONT_FAMILIES[selectedFontIndex];
    var fontSize = parseInt(fontSizeSlider.value, 10);
    var color = colorInput.value;

    var fontString = fontSize + 'px ' + font.css;
    var padding = 4;

    // Measure text
    var measureCanvas = document.createElement('canvas');
    measureCanvas.width = 1;
    measureCanvas.height = 1;
    var measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = fontString;
    var metrics = measureCtx.measureText(name);

    var ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize);
    var descent = Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.4);
    var textWidth = Math.ceil(metrics.width);
    var width = textWidth + padding * 2;
    var height = ascent + descent + padding;

    // Render
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');

    ctx.font = fontString;
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(name, padding / 2, ascent + padding / 2);

    var dataUrl = canvas.toDataURL('image/png');

    // Check name hasn't changed
    if (nameInput.value.trim() !== name) return;

    lastPreview = { dataUrl: dataUrl, width: width, height: height };

    previewArea.innerHTML = '';
    var img = document.createElement('img');
    img.src = dataUrl;
    previewArea.appendChild(img);

    addBtn.disabled = false;
  }

  function onAddToDocument() {
    if (!lastPreview) return;

    var name = nameInput.value.trim();
    if (!name) {
      showToast('Please enter your name', 'error');
      return;
    }

    var currentPageIndex = getCurrentPageIndex();

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

  function getCurrentPageIndex() {
    var viewerArea = document.getElementById('viewer-area');
    if (!viewerArea) return 0;
    var pages = document.querySelectorAll('.pdf-page');
    if (pages.length === 0) return 0;
    var viewerRect = viewerArea.getBoundingClientRect();
    var viewerCenter = viewerRect.top + viewerRect.height / 2;
    var closestIndex = 0;
    var closestDist = Infinity;
    for (var i = 0; i < pages.length; i++) {
      var pageRect = pages[i].getBoundingClientRect();
      var pageCenter = pageRect.top + pageRect.height / 2;
      var dist = Math.abs(pageCenter - viewerCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }
    return closestIndex;
  }

  function showToast(message, type) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('fade-out');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  window.SignaturePanel = { init: init };
})();
