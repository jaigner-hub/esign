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

### Iteration 5 — Task 5: Create Electron main process and preload
- Created main/main.js with BrowserWindow, contextIsolation, application menu (Open PDF, Quit)
- Created main/preload.js with contextBridge exposing electronAPI (renderSignature, signPdf, openFileDialog, saveFile)
- All verification steps passed

### Iteration 6 — Task 6: Register IPC handlers
- Created main/ipc-handlers.js with registerHandlers(mainWindow) function
- Handlers: render-signature, sign-pdf (renders signatures first then embeds), open-file-dialog, save-file
- All handlers wrapped in try/catch with descriptive error messages
- All verification steps passed

### Iteration 7 — Task 7: Create main HTML page
- Created renderer/index.html with header, drop zone, workspace (sidebar + viewer), action bar
- Configured pdf.js workerSrc to local pdfjs-dist path
- Included all renderer JS scripts and CSS link
- All verification steps passed

### Iteration 8 — Task 8: Create CSS styles
- Created renderer/css/style.css with full application styling
- Header (#1a1a2e), drop zone, workspace flexbox layout, PDF page containers, element overlays
- Resize handles, action bar, loading spinner, toast notifications
- All verification steps passed

### Iteration 9 — Task 9: Implement PDF viewer
- Created renderer/js/pdf-viewer.js with PdfViewer module
- Uses pdfjsLib.getDocument, renders all pages as canvases with overlay divs
- Stores per-page dimensions in PDF points, calculates scale to fit max 800px width
- All verification steps passed

### Iteration 10 — Task 10: Implement placement engine
- Created renderer/js/placement.js with Placement module
- addElement creates draggable/resizable divs with delete buttons and resize handles
- Mouse-based drag constrained to overlay, resize with min 30x15
- getElements() converts screen pixels to PDF points (Y-axis flip)
- All verification steps passed

### Iteration 11 — Task 11: Build signature panel
- Created renderer/js/signature-panel.js with SignaturePanel module
- Name input, 6 font preview boxes (live update), font size slider, color picker
- Preview button calls electronAPI.renderSignature, Add button calls Placement.addElement
- All verification steps passed

### Iteration 12 — Task 12: Build text field panel
- Created renderer/js/text-panel.js with TextPanel module
- Text input, quick-insert date buttons (MM/DD/YYYY and ISO), font size, color
- Add to Document button calls Placement.addElement
- All verification steps passed
