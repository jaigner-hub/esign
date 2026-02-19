/**
 * App initialization — file open, wire panels, sign & save flow
 * Web version: uses file input, browser Canvas signatures, pdf-lib for signing
 * Phase 1: Added authentication and freemium gating
 * Phase 2: Email verification
 * Phase 3: Pay-per-signature ($0.99 each)
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

    // Check URL params
    checkCheckoutResult();
    checkEmailVerification();
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
        prefillSignatureName();
        
        // Show verification banner if needed
        if (!currentUser.emailVerified) {
          showVerificationBanner();
        }
      } else {
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
          var tierText = 'Free';
          if (currentUser.usage && currentUser.usage.credits > 0) {
            tierText = currentUser.usage.credits + ' credit' + (currentUser.usage.credits !== 1 ? 's' : '');
          }
          userTier.textContent = tierText;
          userTier.className = 'tier-badge tier-' + currentUser.tier;
        }
      }
    } else {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (signupBtn) signupBtn.classList.remove('hidden');
      if (userMenu) userMenu.classList.add('hidden');
    }
  }

  function prefillSignatureName() {
    var nameInput = document.querySelector("#signature-panel-container input[type=text]");
    if (nameInput && currentUser && currentUser.name && !nameInput.value) {
      nameInput.value = currentUser.name;
      nameInput.dispatchEvent(new Event("input"));
    }
  }

  function updateUsageDisplay() {
    var usageDisplay = document.getElementById('usage-display');
    if (!usageDisplay || !currentUser) return;

    var usage = currentUser.usage;
    if (!usage) return;

    var parts = [];
    if (usage.limit !== null) {
      parts.push('<strong>' + usage.remaining + '</strong> free this month');
    }
    if (usage.credits > 0) {
      parts.push('<strong>' + usage.credits + '</strong> paid credit' + (usage.credits !== 1 ? 's' : ''));
    }

    if (parts.length > 0) {
      usageDisplay.innerHTML = '🖊️ ' + parts.join(' · ');
      usageDisplay.classList.remove('hidden');
      usageDisplay.classList.remove('usage-exceeded', 'usage-warning');
      
      if (usage.remaining === 0 && usage.credits === 0) {
        usageDisplay.classList.add('usage-exceeded');
      } else if (usage.remaining === 0) {
        usageDisplay.classList.add('usage-warning');
      }
    } else {
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
    removeVerificationBanner();
  }

  // ========== EMAIL VERIFICATION ==========

  function showVerificationBanner() {
    removeVerificationBanner(); // avoid duplicates
    var banner = document.createElement('div');
    banner.id = 'verification-banner';
    banner.className = 'verification-banner';
    banner.innerHTML = 
      '<span>📧 Please verify your email to start signing PDFs. Check your inbox!</span>' +
      '<button id="resend-verify-btn" class="btn-secondary btn-small">Resend Email</button>';
    document.body.insertBefore(banner, document.body.firstChild);

    document.getElementById('resend-verify-btn').addEventListener('click', resendVerification);
  }

  function removeVerificationBanner() {
    var existing = document.getElementById('verification-banner');
    if (existing) existing.remove();
  }

  async function resendVerification() {
    var btn = document.getElementById('resend-verify-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    try {
      var response = await fetch(API_BASE + '/auth/resend-verification', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + authToken }
      });

      var data = await response.json();

      if (response.ok) {
        showToast('Verification email sent! Check your inbox.', 'success');
        if (btn) {
          btn.textContent = 'Sent!';
          setTimeout(function() {
            btn.textContent = 'Resend Email';
            btn.disabled = false;
          }, 30000);
        }
      } else {
        showToast(data.error || 'Failed to send email', 'error');
        if (btn) {
          btn.textContent = 'Resend Email';
          btn.disabled = false;
        }
      }
    } catch (err) {
      showToast('Network error', 'error');
      if (btn) {
        btn.textContent = 'Resend Email';
        btn.disabled = false;
      }
    }
  }

  function checkEmailVerification() {
    var urlParams = new URLSearchParams(window.location.search);
    var verifyToken = urlParams.get('verify');
    
    if (verifyToken) {
      verifyEmail(verifyToken);
    }
  }

  async function verifyEmail(token) {
    try {
      var response = await fetch(API_BASE + '/auth/verify?token=' + encodeURIComponent(token));
      var data = await response.json();

      if (response.ok) {
        showToast('✅ Email verified successfully!', 'success');
        removeVerificationBanner();
        // Update user data
        if (currentUser) {
          currentUser.emailVerified = true;
        }
        if (authToken) fetchUser();
      } else {
        showToast(data.error || 'Verification failed', 'error');
      }

      // Clear URL param
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      showToast('Verification failed. Please try again.', 'error');
    }
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

    modal.onclick = function(e) {
      if (e.target === modal) modal.classList.add('hidden');
    };

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
            prefillSignatureName();
            modal.classList.add('hidden');
            
            if (data.needsVerification) {
              showVerificationBanner();
              showToast('Welcome back! Please verify your email to sign PDFs.', 'info');
            } else {
              showToast('Welcome back, ' + (currentUser.name || currentUser.email) + '!', 'success');
            }
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
            
            showVerificationBanner();
            showToast('Welcome to FreeSign! Please check your email to verify your account.', 'success');
            prefillSignatureName();
          } else {
            showToast(data.error || 'Registration failed', 'error');
          }
        } catch (err) {
          showToast('Network error. Please try again.', 'error');
        }
      };
    }
  }

  // ========== PURCHASE MODAL (Pay-per-signature) ==========

  function showPurchaseModal() {
    var modal = document.getElementById('purchase-modal');
    if (!modal) {
      createPurchaseModal();
      modal = document.getElementById('purchase-modal');
    }

    modal.classList.remove('hidden');

    modal.onclick = function(e) {
      if (e.target === modal) modal.classList.add('hidden');
    };

    var closeBtn = document.getElementById('purchase-close');
    if (closeBtn) {
      closeBtn.onclick = function() { modal.classList.add('hidden'); };
    }

    var purchaseBtn = document.getElementById('purchase-sig-btn');
    if (purchaseBtn) {
      purchaseBtn.onclick = async function() {
        if (!currentUser) {
          modal.classList.add('hidden');
          showAuthModal('signup');
          return;
        }

        try {
          purchaseBtn.disabled = true;
          purchaseBtn.textContent = 'Redirecting to checkout...';

          var response = await fetch(API_BASE + '/billing/purchase-signature', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + authToken,
              'Content-Type': 'application/json'
            }
          });

          var data = await response.json();

          if (response.ok && data.url) {
            window.location.href = data.url;
          } else {
            showToast(data.error || 'Failed to start checkout', 'error');
            purchaseBtn.disabled = false;
            purchaseBtn.textContent = 'Purchase for $0.99';
          }
        } catch (err) {
          showToast('Network error. Please try again.', 'error');
          purchaseBtn.disabled = false;
          purchaseBtn.textContent = 'Purchase for $0.99';
        }
      };
    }
  }

  function createPurchaseModal() {
    var modal = document.createElement('div');
    modal.id = 'purchase-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = '\
      <div class="modal-content upgrade-content">\
        <button id="purchase-close" class="modal-close">&times;</button>\
        <h2>🖊️ Need another signature?</h2>\
        <p class="upgrade-limit-msg">You\'ve used all 3 free signatures this month.</p>\
        <div class="upgrade-features">\
          <ul>\
            <li>✅ <strong>1 signature credit</strong> — never expires</li>\
            <li>✅ Use it on any PDF, anytime</li>\
            <li>✅ Secure checkout via Stripe</li>\
          </ul>\
        </div>\
        <div class="upgrade-pricing">\
          <div class="price">$0.99</div>\
          <button id="purchase-sig-btn" class="btn-primary btn-large">Purchase for $0.99</button>\
        </div>\
        <p class="upgrade-footer">One-time payment. No subscription required.</p>\
      </div>\
    ';
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

    if (!currentUser) {
      showAuthModal('signup');
      showToast('Please create an account to sign and save PDFs', 'info');
      return;
    }

    // Check email verification
    if (!currentUser.emailVerified) {
      showToast('Please verify your email before signing documents', 'error');
      showVerificationBanner();
      return;
    }

    try {
      var response = await fetch(API_BASE + '/signatures/check', {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });

      var data = await response.json();

      if (!data.allowed) {
        showPurchaseModal();
        return;
      }

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
        currentUser.usage = recordData.usage;
        updateUsageDisplay();
        updateAuthUI();
        if (recordData.usedCredit) {
          showToast('Used 1 signature credit (' + recordData.usage.credits + ' remaining)', 'info');
        }
        await performSignAndSave(elements);
      } else if (recordResponse.status === 402) {
        showPurchaseModal();
      } else if (recordResponse.status === 403 && recordData.code === 'EMAIL_NOT_VERIFIED') {
        showToast('Please verify your email first', 'error');
        showVerificationBanner();
      } else {
        showToast(recordData.error || 'Failed to record signature', 'error');
      }
    } catch (err) {
      console.error('Usage check failed:', err);
      await performSignAndSave(elements);
    }
  }

  async function performSignAndSave(elements) {
    var loadingOverlay = document.getElementById('loading-overlay');
    try {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');

      var PDFLib = window.PDFLib;
      var pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
      var pages = pdfDoc.getPages();
      var helvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

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

      if (shouldAddWatermark) {
        for (var p = 0; p < pages.length; p++) {
          var pg = pages[p];
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
    if (!currentUser) {
      showAuthModal("signup");
      showToast("Please create an account to use FreeSign", "info");
      return;
    }
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
      showToast('🎉 Signature credit purchased! You can now sign your document.', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
      if (authToken) fetchUser();
    } else if (checkout === 'canceled') {
      showToast('Checkout canceled. You can purchase anytime.', 'info');
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
