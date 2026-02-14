# Progress

## Iteration Log

### Iteration 1 — Task 1: Initialize Electron project
- Created package.json with name 'esign', main 'main/main.js', all required scripts
- Created directory structure: main/, main/lib/, renderer/, renderer/css/, renderer/js/, assets/fonts/, test/, test/fixtures/
- Installed runtime deps: pdf-lib, @napi-rs/canvas, pdfjs-dist
- Installed dev deps: electron, electron-builder, mocha, chai
- All verification steps passed

### Iteration 2 — Task 2: Download and bundle the 6 handwriting fonts
- Created download-fonts.sh and download-fonts.js scripts
- Downloaded all 6 TTF files from google/fonts GitHub repo (HomemadeApple is under apache/ not ofl/)
- Created main/lib/font-loader.js with FONTS array and loadFontBuffer()
- All verification steps passed

### Iteration 3 — Task 3: Build signature renderer module
- Created main/lib/signature-renderer.js using @napi-rs/canvas
- Registers fonts via GlobalFonts.registerFromPath, measures text, renders to transparent canvas
- Returns { dataUrl, width, height } with PNG base64 data URL
- All verification steps passed

### Iteration 4 — Task 4: Build PDF signer module
- Created main/lib/pdf-signer.js using pdf-lib
- Handles signature elements (embed PNG from dataUrl) and text elements (Helvetica drawText)
- Parses hex colors, clamps coordinates to page bounds
- Created test/fixtures/generate-pdfs.js to generate sample.pdf and multipage.pdf
- All verification steps passed
