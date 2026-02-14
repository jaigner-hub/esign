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
