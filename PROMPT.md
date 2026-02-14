# esign — Iteration Prompt

You are an autonomous coding agent building a desktop Electron application for signing PDFs with typed signatures and text fields. Each iteration you pick ONE task, implement it, and commit.

## Workflow

1. **Read `tasks.json`** — this is your source of truth. Find the lowest-id task where `"passes": false`.
2. **Read `progress.md`** for context on what happened in previous iterations.
3. **Read `PRD.md`** for detailed design context and specifications.
4. **Implement the task** following the conventions below.
5. **Run the verification steps** listed in the task's `"steps"` array.
6. **Run tests** if test files exist: `npx mocha test/test-sign.js --timeout 15000`.
7. **Update `tasks.json`** — set `"passes": true` for the completed task. **ONLY change the `passes` field. Never edit, remove, or reorder tasks.**
8. **Update `progress.md`** with a log entry for this iteration.
9. **Commit** with descriptive message using `feat:` or `fix:` prefix.
10. **STOP.** You are done. Do not continue to the next task. Exit immediately after committing. The loop script will start a new process for the next task.

## Rules for tasks.json

- **NEVER** remove or edit task descriptions, steps, categories, or ids.
- **ONLY** change `"passes": false` to `"passes": true` after verifying all steps pass.
- If a task cannot be completed, leave `"passes": false` and log the blocker in `progress.md`.
- JSON format is intentional — treat it as immutable test definitions, not a scratchpad.

## Critical Conventions

### JavaScript Patterns
- Use CommonJS (`require`/`module.exports`) for all main process code (Node.js / Electron main)
- Use vanilla JS for renderer process code — no bundler, no framework
- Renderer modules attach to `window` (e.g., `window.PdfViewer`, `window.Placement`)
- Use `const` by default, `let` only when reassignment is needed, never `var`
- Use async/await for all asynchronous operations
- Use strict equality (`===`) everywhere
- Use semicolons
- Naming: camelCase for variables/functions, PascalCase for classes/module names, UPPER_SNAKE for constants
- Error handling: wrap IPC handlers in try/catch, return structured errors. In renderer, show toast messages to the user.

### Electron Security
- `contextIsolation: true` — always
- `nodeIntegration: false` — always
- All main↔renderer communication goes through `contextBridge` / `ipcRenderer.invoke` / `ipcMain.handle`
- Never expose Node.js APIs directly to the renderer
- The preload script is the only bridge between main and renderer

### File Layout
```
esign/
├── package.json                    # Project manifest, main: main/main.js
├── forge.config.js                 # electron-builder packaging config
├── main/
│   ├── main.js                     # Electron main process (window, menu)
│   ├── preload.js                  # contextBridge exposing electronAPI
│   ├── ipc-handlers.js             # IPC handler registration
│   └── lib/
│       ├── font-loader.js          # FONTS array, loadFontBuffer()
│       ├── signature-renderer.js   # @napi-rs/canvas signature rendering
│       └── pdf-signer.js           # pdf-lib PDF manipulation
├── renderer/
│   ├── index.html                  # Main HTML page
│   ├── css/
│   │   └── style.css               # All styles
│   └── js/
│       ├── app.js                  # App init, file open, sign & save
│       ├── pdf-viewer.js           # pdf.js rendering
│       ├── placement.js            # Drag/drop/resize engine
│       ├── signature-panel.js      # Signature creation UI
│       └── text-panel.js           # Text field creation UI
├── assets/
│   └── fonts/                      # 6 bundled .ttf handwriting fonts
└── test/
    ├── test-sign.js                # Mocha integration tests
    ├── e2e-test.sh                 # End-to-end bash test
    └── fixtures/
        ├── generate-pdfs.js        # Script to generate test PDFs
        ├── sample.pdf              # 1-page test PDF
        └── multipage.pdf           # 3-page test PDF (different page sizes)
```

### IPC Channels
The preload script exposes `window.electronAPI` with these methods:
- `renderSignature({ name, fontIndex, fontSize, color })` → `{ dataUrl, width, height }`
- `signPdf(pdfBytes, elements)` → `Uint8Array` (signed PDF)
- `openFileDialog()` → `{ name, bytes }` or `null`
- `saveFile(bytes, defaultName)` → saved path or `null`

### PDF Coordinate System
- PDF coordinates: origin at **bottom-left**, units are points (1/72 inch)
- Browser coordinates: origin at **top-left**, units are pixels
- Conversion: `pdfX = screenX / scale`, `pdfY = (pageHeightPx - screenY - elementHeight) / scale`
- All element positions sent via IPC must be in PDF points

### Element Data Structure
```json
{
  "type": "signature",
  "page": 0,
  "x": 150,
  "y": 400,
  "width": 200,
  "height": 50,
  "value": "John Doe",
  "fontIndex": 2,
  "fontSize": 48,
  "color": "#000000",
  "dataUrl": "data:image/png;base64,..."
}
```
- `dataUrl` is only present on signature elements and is set by the IPC handler before calling pdf-signer
- Text elements use `value`, `fontSize`, and `color` (drawn with Helvetica by pdf-lib)

### Dependencies
- `electron` ~33.x (dev dependency)
- `electron-builder` ~25.x (dev dependency)
- `pdf-lib` ^1.17.1
- `@napi-rs/canvas` ^0.1.x
- `pdfjs-dist` ^4.x
- `mocha` ^10.x (dev)
- `chai` ^4.x (dev)

### Build & Test Commands
```bash
# Run the Electron app in dev mode
npm start        # → electron .

# Run integration tests (main process modules only, no Electron needed)
npm test         # → mocha test/test-sign.js --timeout 15000

# Run end-to-end test
bash test/e2e-test.sh

# Package for distribution
npm run package  # → electron-builder
```

### Bundled Fonts
6 Google Fonts (OFL license), stored in `assets/fonts/`:
```
Index 0: DancingScript-Regular.ttf  (elegant cursive)
Index 1: GreatVibes-Regular.ttf     (formal script)
Index 2: Caveat-Regular.ttf         (casual handwriting)
Index 3: Sacramento-Regular.ttf     (flowing signature)
Index 4: Pacifico-Regular.ttf       (bold cursive)
Index 5: HomemadeApple-Regular.ttf  (natural handwriting)
```

### Notes on @napi-rs/canvas
- This is a native Node.js addon. It ships prebuilt binaries for common platforms.
- Register fonts with `GlobalFonts.registerFromPath(fontPath, fontFamilyName)` before drawing.
- Create canvas: `const canvas = createCanvas(width, height)`
- Get context: `const ctx = canvas.getContext('2d')`
- Export PNG: `canvas.toBuffer('image/png')` → convert to base64 data URL
- When packaging with electron-builder, add `@napi-rs/canvas` to `asarUnpack` so native `.node` files work.

## Completion Signal

When ALL tasks have `"passes": true` in tasks.json and final verification is done, write this exact line to progress.md:

```
ALL_TASKS_COMPLETE
```

This signals the loop script to stop.

## CRITICAL: One Task Per Invocation

**You MUST stop after completing exactly ONE task.** This is the most important rule.

After you commit, your job is done. Do NOT read the next task. Do NOT continue working. The loop script (`ralph.sh`) will invoke you again in a fresh process with fresh context for the next task. This is by design — it keeps context windows clean and allows progress monitoring between tasks.

**If you complete a task and keep going to the next one, you are violating the core contract of this system.**

## Important Notes

- **ONE task, then STOP.** Complete one task, commit, and exit. Do not proceed to the next task.
- **Commit after each task.** Use `git add <specific files>` then `git commit -m "feat: ..."`.
- **If a task fails**, note the issue in progress.md and move on to the next task if possible. Come back to fix it later.
- **Read existing code** before writing. Check what files already exist.
- **Don't modify unrelated code.** Stay focused on the current task.
- **Test after every change.** Run your test/lint commands frequently.
