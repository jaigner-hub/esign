/**
 * App initialization — file open, wire panels, sign & save flow
 * Web version: uses file input, browser Canvas signatures, pdf-lib for signing
 * Phase 1: Added authentication and freemium gating
 */
(function () {
  'use strict';

  var originalPdfBytes = null;
  var originalFilename = null;
  var fileInput = document.getElementById('file-input');
  var currentUser = null;
  var authToken = localStorage.getItem('freesign_token');
  var API_BASE = '/api'; // Proxied through nginx

  // Initialize app
  function initialize() {
    var pdfContainer = document.getElementById('pdf-container');
    if (pdfContainer) window.PdfViewer.init(pdfContainer);

    window.Placement.init();

    var sigContainer = document.getElementById('signature-panel-container');
    if (sigContainer) window.SignaturePanel.init(sigContainer);

    var textContainer = document.getElementById('text-panel-container');
    if (textContainer) window.TextPanel.init(textContainer);

    // Wire up Open PDF buttons
    var headerOpenBtn = document.getElementById('header-open-btn');
    var dropZoneOpenBtn = document.getElementById('drop-zone-open-btn');

    if (headerOpenBtn) headerOpenBtn.addEventListener('click', function() { fileInput.click(); });
    if (dropZoneOpenBtn) dropZoneOpenBtn.addEventListener('click', function() { fileInput.click(); });

    // File input change handler
    fileInput.addEventListener('change', function(e) {
      var files = e.target.files;
      if (files && files.length > 0) {
        handleDroppedFiles(files);
      }
      fileInput.value = '';
    });

    // Drag and drop
    var dropZone = document.getElementById('drop-zone');
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

    // Sign & Save
    var signSaveBtn = document.getElementById('sign-save-btn');
    if (signSaveBtn) signSaveBtn.addEventListener('click', onSignAndSaveClick);

    // Auth buttons
    var loginBtn = document.getElementById('auth-login-btn');
    var signupBtn = document.getElementById('auth-signup-btn');
    var logoutBtn = document.getElementById('auth-logout-btn');
    
    if (loginBtn) loginBtn.addEventListener('click', showAuthModal);
    if (signupBtn) signupBtn.addEventListener('click', function() { showAuthModal('signup'); });
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Check for existing auth
    if (authToken) {
      fetchUser();
    } else {
      updateAuthUI();
    }

    // Check for Stripe checkout result
    checkCheckoutResult();
  }

  // ========== AUTHENTICATION ==========

  async function fetchUser() {
    try {
      var response = await fetch(API_BASE + '/auth/me', {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      
      if (response.ok) {
        var data = await response.json();
        currentUser = data.user;
        currentUser.usage = data.usage;
        updateAuthUI();
        updateUsageDisplay();
      } else {
        // Token expired or invalid
        logout();
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  }

  function updateAuthUI() {
    var loginBtn = document.getElementById('auth-login-btn');
    var signupBtn = document.getElementById('auth-signup-btn');
    var userMenu = document.getElementById('user-menu');
    var userEmail = document.getElementById('user-email');
    var userTier = document.getElementById('user-tier');

    if (currentUser) {
      if (loginBtn) loginBtn.classList.add('hidden');
      if (signupBtn) signupBtn.classList.add('hidden');
      if (userMenu) {
        userMenu.classList.remove('hidden');
        if (userEmail) userEmail.textContent = currentUser.name || currentUser.email;
        if (userTier) {
          userTier.textContent = currentUser.tier === 'free' ? 'Free' : 'Pro';
          userTier.className = 'tier-badge tier-' + currentUser.tier;
        }
      }
    } else {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (signupBtn) signupBtn.classList.remove('hidden');
      if (userMenu) userMenu.classList.add('hidden');
    }
  }

  function updateUsageDisplay() {
    var usageDisplay = document.getElementById('usage-display');
    if (!usageDisplay || !currentUser) return;

    var usage = currentUser.usage;
    if (usage && usage.limit !== null) {
      usageDisplay.innerHTML = 'Signatures: <strong>' + usage.used + '/' + usage.limit + '</strong> this month';
      usageDisplay.classList.remove('hidden');
      
      if (usage.remaining === 0) {
        usageDisplay.classList.add('usage-exceeded');
      } else if (usage.remaining <= 1) {
        usageDisplay.classList.add('usage-warning');
      }
    } else if (currentUser.tier !== 'free') {
      usageDisplay.innerHTML = '<strong>Unlimited</strong> signatures';
      usageDisplay.classList.remove('hidden');
    }
  }

  function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('freesign_token');
    updateAuthUI();
    var usageDisplay = document.getElementById('usage-display');
    if (usageDisplay) usageDisplay.classList.add('hidden');
  }

  // ========== AUTH MODAL ==========

  function showAuthModal(mode) {
    mode = mode || 'login';
    var modal = document.getElementById('auth-modal');
    var loginForm = document.getElementById('login-form');
    var signupForm = document.getElementById('signup-form');
    var loginTab = document.getElementById('login-tab');
    var signupTab = document.getElementById('signup-tab');

    if (!modal) return;

    modal.classList.remove('hidden');

    function showTab(tab) {
      if (tab === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
      } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        loginTab.classList.remove('active');
        signupTab.classList.add('active');
      }
    }

    loginTab.onclick = function() { showTab('login'); };
    signupTab.onclick = function() { showTab('signup'); };

    showTab(mode);

    // Close modal on backdrop click
    modal.onclick = function(e) {
      if (e.target === modal) modal.classList.add('hidden');
    };

    // Handle forms
    var loginSubmit = document.getElementById('login-submit');
    var signupSubmit = document.getElementById('signup-submit');

    if (loginSubmit) {
      loginSubmit.onclick = async function() {
        var email = document.getElementById('login-email').value;
        var password = document.getElementById('login-password').value;
        
        try {
          var response = await fetch(API_BASE + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });

          var data = await response.json();

          if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('freesign_token', authToken);
            updateAuthUI();
            updateUsageDisplay();
            modal.classList.add('hidden');
            showToast('Welcome back, ' + (currentUser.name || currentUser.email) + '!', 'success');
          } else {
            showToast(data.error || 'Login failed', 'error');
          }
        } catch (err) {
          showToast('Network error. Please try again.', 'error');
        }
      };
    }

    if (signupSubmit) {
      signupSubmit.onclick = async function() {
        var name = document.getElementById('signup-name').value;
        var email = document.getElementById('signup-email').value;
        var password = document.getElementById('signup-password').value;
        
        if (password.length < 6) {
          showToast('Password must be at least 6 characters', 'error');
          return;
        }

        try {
          var response = await fetch(API_BASE + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
          });

          var data = await response.json();

          if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('freesign_token', authToken);
            updateAuthUI();
            updateUsageDisplay();
            modal.classList.add('hidden');
            showToast('Welcome to FreeSign!', 'success');
          } else {
            showToast(data.error || 'Registration failed', 'error');
          }
        } catch (err) {
          showToast('Network error. Please try again.', 'error');
        }
      };
    }
  }

  // ========== UPGRADE MODAL ==========

  function showUpgradeModal() {
    var modal = document.getElementById('upgrade-modal');
    if (!modal) {
      // Create upgrade modal if it doesn't exist
      createUpgradeModal();
      modal = document.getElementById('upgrade-modal');
    }

    modal.classList.remove('hidden');

    // Close on backdrop click
    modal.onclick = function(e) {
      if (e.target === modal) modal.classList.add('hidden');
    };

    // Close button
    var closeBtn = document.getElementById('upgrade-close');
    if (closeBtn) {
      closeBtn.onclick = function() { modal.classList.add('hidden'); };
    }

    // Upgrade button
    var upgradeBtn = document.getElementById('upgrade-pro-btn');
    if (upgradeBtn) {
      upgradeBtn.onclick = async function() {
        if (!currentUser) {
          modal.classList.add('hidden');
          showAuthModal('signup');
          return;
        }

        try {
          upgradeBtn.disabled = true;
          upgradeBtn.textContent = 'Redirecting to Stripe...';

          var response = await fetch(API_BASE + '/billing/checkout', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + authToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan: 'pro' })
          });

          var data = await response.json();

          if (response.ok && data.url) {
            window.location.href = data.url;
          } else {
            showToast(data.error || 'Failed to start checkout', 'error');
            upgradeBtn.disabled = false;
            upgradeBtn.textContent = 'Upgrade to Pro - $9.99/month';
          }
        } catch (err) {
          showToast('Network error. Please try again.', 'error');
          upgradeBtn.disabled = false;
          upgradeBtn.textContent = 'Upgrade to Pro - $9.99/month';
        }
      };
    }
  }

  function createUpgradeModal() {
    var modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content upgrade-content">
        <button id="upgrade-close" class="modal-close">&times;</button>
        <h2>🚀 Upgrade to Pro</h2>
        <p class="upgrade-limit-msg">You've reached your monthly limit of 3 free signatures.</p>
        <div class="upgrade-features">
          <h3>Pro includes:</h3>
          <ul>
            <li>✅ <strong>Unlimited</strong> signatures</li>
            <li>✅ Draw your signature</li>
            <li>✅ Upload signature image</li>
            <li>✅ No watermark on signed PDFs</li>
            <li>✅ Save signature profiles</li>
          </ul>
        </div>
        <div class="upgrade-pricing">
          <div class="price">$9.99<span>/month</span></div>
          <button id="upgrade-pro-btn" class="btn-primary btn-large">Upgrade to Pro</button>
        </div>
        <p class="upgrade-footer">Cancel anytime. 30-day money-back guarantee.</p>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ========== SIGN & SAVE (with gating) ==========

  async function onSignAndSaveClick() {
    if (!originalPdfBytes) {
      showToast('No PDF loaded', 'error');
      return;
    }

    var elements = window.Placement.getElements();
    if (elements.length === 0) {
      showToast('Add at least one signature or text field first', 'error');
      return;
    }

    // If not logged in, prompt to login/signup
    if (!currentUser) {
      showAuthModal('signup');
      showToast('Please create an account to sign and save PDFs', 'info');
      return;
    }

    // Check usage limit
    try {
      var response = await fetch(API_BASE + '/signatures/check', {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });

      var data = await response.json();

      if (!data.allowed) {
        showUpgradeModal();
        return;
      }

      // Record the signature and proceed with download
      var recordResponse = await fetch(API_BASE + '/signatures/record', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ documentName: originalFilename })
      });

      var recordData = await recordResponse.json();

      if (recordResponse.ok) {
        // Update local usage
        currentUser.usage = recordData.usage;
        updateUsageDisplay();
        
        // Proceed with signing
        await performSignAndSave(elements);
      } else if (recordResponse.status === 402) {
        showUpgradeModal();
      } else {
        showToast(recordData.error || 'Failed to record signature', 'error');
      }
    } catch (err) {
      console.error('Usage check failed:', err);
      // Allow signing anyway if backend is down (graceful degradation)
      await performSignAndSave(elements);
    }
  }

  /**
   * Actually sign the PDF and trigger download
   */
  async function performSignAndSave(elements) {
    var loadingOverlay = document.getElementById('loading-overlay');
    try {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');

      var PDFLib = window.PDFLib;
      var pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
      var pages = pdfDoc.getPages();
      var helvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

      // Add watermark for free tier
      var shouldAddWatermark = !currentUser || currentUser.tier === 'free';

      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var pageIndex = Math.max(0, Math.min(el.page, pages.length - 1));
        var page = pages[pageIndex];
        var pageSize = page.getSize();
        var x = Math.max(0, Math.min(el.x, pageSize.width));
        var y = Math.max(0, Math.min(el.y, pageSize.height));

        if (el.type === 'signature' && el.dataUrl) {
          var base64Data = el.dataUrl.replace(/^data:image\/png;base64,/, '');
          var binaryString = atob(base64Data);
          var pngBytes = new Uint8Array(binaryString.length);
          for (var j = 0; j < binaryString.length; j++) {
            pngBytes[j] = binaryString.charCodeAt(j);
          }
          var pngImage = await pdfDoc.embedPng(pngBytes);
          var width = Math.max(1, Math.min(el.width || pngImage.width, pageSize.width));
          var height = Math.max(1, Math.min(el.height || pngImage.height, pageSize.height));
          page.drawImage(pngImage, { x: x, y: y, width: width, height: height });
        } else if (el.type === 'text') {
          var color = el.color || '#000000';
          var r = parseInt(color.slice(1, 3), 16) / 255;
          var g = parseInt(color.slice(3, 5), 16) / 255;
          var b = parseInt(color.slice(5, 7), 16) / 255;
          page.drawText(el.value || '', {
            x: x,
            y: y,
            size: el.fontSize || 12,
            font: helvetica,
            color: PDFLib.rgb(r, g, b)
          });
        }
      }

      // Add watermark for free users
      if (shouldAddWatermark) {
        for (var p = 0; p < pages.length; p++) {
          var pg = pages[p];
          var sz = pg.getSize();
          pg.drawText('Signed with FreeSign.ink', {
            x: 20,
            y: 20,
            size: 8,
            font: helvetica,
            color: PDFLib.rgb(0.5, 0.5, 0.5)
          });
        }
      }

      var signedBytes = await pdfDoc.save();
      var defaultName = 'signed-' + (originalFilename || 'document.pdf');

      // Trigger download
      var blob = new Blob([signedBytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Signed PDF downloaded as ' + defaultName, 'success');
    } catch (err) {
      showToast('Failed to sign PDF: ' + err.message, 'error');
    } finally {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  }

  // ========== FILE HANDLING ==========

  function handleDroppedFiles(files) {
    if (!files || files.length === 0) return;
    var file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please drop a PDF file', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        var bytes = new Uint8Array(reader.result);
        await loadPdf(bytes, file.name);
      } catch (err) {
        showToast('Failed to load PDF: ' + err.message, 'error');
      }
    };
    reader.onerror = function () { showToast('Failed to read file', 'error'); };
    reader.readAsArrayBuffer(file);
  }

  async function loadPdf(bytes, filename) {
    originalPdfBytes = bytes.slice();
    originalFilename = filename;
    window.Placement.clearAll();
    await window.PdfViewer.loadPdf(bytes);

    var dropZone = document.getElementById('drop-zone');
    var workspace = document.getElementById('workspace');
    var actionBar = document.getElementById('action-bar');
    if (dropZone) dropZone.classList.add('hidden');
    if (workspace) workspace.classList.remove('hidden');
    if (actionBar) actionBar.classList.remove('hidden');
    showToast('Loaded: ' + filename, 'success');
  }

  // ========== CHECKOUT HANDLING ==========

  function checkCheckoutResult() {
    var urlParams = new URLSearchParams(window.location.search);
    var checkout = urlParams.get('checkout');
    
    if (checkout === 'success') {
      showToast('🎉 Welcome to Pro! Your subscription is active.', 'success');
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      // Refresh user data
      if (authToken) fetchUser();
    } else if (checkout === 'canceled') {
      showToast('Checkout canceled. You can upgrade anytime.', 'info');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // ========== UTILITIES ==========

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

  // Initialize
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
