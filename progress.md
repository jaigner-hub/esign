# Progress

## Iteration Log

### Task 1 — Initialize Electron project (2026-02-14)
- Created directory structure: main/, main/lib/, renderer/, renderer/css/, renderer/js/, assets/fonts/, test/, test/fixtures/
- package.json already existed with correct name, version, main, and scripts
- All dependencies already installed (pdf-lib, @napi-rs/canvas, pdfjs-dist, electron, electron-builder, mocha, chai)
- Downgraded chai from v6 (ESM-only) to v4 for CommonJS compatibility with mocha tests
- Downgraded pdfjs-dist from v5 to v4 to match project conventions
- Both verification steps pass: package.json check and directory listing

### Task 2 — Download and bundle the 6 handwriting fonts (2026-02-14)
- Created assets/fonts/download-fonts.sh to download 6 Google Fonts from google/fonts GitHub repo
- DancingScript and Caveat only available as variable fonts in the repo; downloaded variable TTFs and renamed to -Regular.ttf (work fine with @napi-rs/canvas)
- HomemadeApple is under apache/ license directory, not ofl/
- All 6 fonts downloaded successfully: DancingScript, GreatVibes, Caveat, Sacramento, Pacifico, HomemadeApple
- Created main/lib/font-loader.js with FONTS array (6 entries) and loadFontBuffer(fontIndex) function
- Both verification steps pass: FONTS.length === 6 and 6 .ttf files in assets/fonts/

### Task 3 — Build signature renderer module (2026-02-14)
- Created main/lib/signature-renderer.js with async renderSignature({ name, fontIndex, fontSize, color })
- Uses @napi-rs/canvas: registers fonts via GlobalFonts.registerFromPath, measures text width, creates transparent canvas (width from metrics + 20px padding, height = fontSize * 1.5), draws text, exports as PNG data URL
- Caches font registrations to avoid re-registering on repeated calls
- Defaults: fontSize=48, color='#000000'
- Returns { dataUrl, width, height } where dataUrl is data:image/png;base64,...
- Validates name is non-empty string, fontIndex is in valid range
- Verified with all 6 font indices, empty name error case, and task verification step

### Task 4 — Build PDF signer module using pdf-lib (2026-02-14)
- Created main/lib/pdf-signer.js with async signPdf(pdfBytes, elements) function
- Uses pdf-lib: loads PDF, embeds Helvetica for text elements, embeds PNG for signature elements
- Parses hex color strings to rgb values for text drawing
- Clamps page index to valid range (0 to pageCount-1) and coordinates to page dimensions
- Handles both signature elements (base64 PNG dataUrl → embedPng → drawImage) and text elements (drawText with Helvetica)
- Created test/fixtures/generate-pdfs.js to generate sample.pdf (1-page US Letter with placeholder text)
- Generated test/fixtures/sample.pdf successfully
- Verified: text element signing produces valid PDF, signature element signing produces valid PDF with %PDF- header
