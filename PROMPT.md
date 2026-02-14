# esign — Iteration Prompt

You are an autonomous coding agent building a web-based PDF e-signing application. Each iteration you pick ONE task, implement it, and commit.

## Workflow

1. **Read `tasks.json`** — this is your source of truth. Find the lowest-id task where `"passes": false`.
2. **Read `progress.md`** for context on what happened in previous iterations.
3. **Read `PRD.md`** for detailed design context and specifications.
4. **Implement the task** following the conventions below.
5. **Run the verification steps** listed in the task's `"steps"` array.
6. **Run tests** if test files exist: `npx mocha test/test-sign.js --timeout 10000`.
7. **Update `tasks.json`** — set `"passes": true` for the completed task. **ONLY change the `passes` field. Never edit, remove, or reorder tasks.**
8. **Update `progress.md`** with a log entry for this iteration.
9. **Commit** with descriptive message using `feat:` or `fix:` prefix.

## Rules for tasks.json

- **NEVER** remove or edit task descriptions, steps, categories, or ids.
- **ONLY** change `"passes": false` to `"passes": true` after verifying all steps pass.
- If a task cannot be completed, leave `"passes": false` and log the blocker in `progress.md`.
- JSON format is intentional — treat it as immutable test definitions, not a scratchpad.

## Critical Conventions

### JavaScript Patterns
- Use CommonJS (`require`/`module.exports`) for server-side code (Node.js)
- Use vanilla JS with `window.ModuleName` pattern for browser-side code (no bundler)
- Use `const` by default, `let` only when reassignment is needed, never `var`
- Use async/await for all asynchronous operations (no raw callbacks)
- Error handling: always wrap async route handlers in try/catch, return JSON `{ error: "message" }` with appropriate status codes
- Naming: camelCase for variables/functions, PascalCase for classes/constructors, UPPER_SNAKE for constants
- Use strict equality (`===`) everywhere
- No semicolons (standardjs style) — actually, DO use semicolons for clarity in this project

### File Layout
```
esign/
├── package.json                    # Project manifest, bin field, scripts
├── bin/
│   └── cli.js                      # CLI entry point (#!/usr/bin/env node)
├── server/
│   ├── index.js                    # Express app setup, static serving, exports
│   ├── routes/
│   │   └── api.js                  # API route handlers (render-signature, sign)
│   └── lib/
│       ├── font-loader.js          # Font metadata array and file loading
│       ├── signature-renderer.js   # Canvas-based signature image generation
│       └── pdf-signer.js           # PDF manipulation with pdf-lib
├── server/fonts/                   # Bundled .ttf handwriting fonts (6 files)
├── public/
│   ├── index.html                  # Main HTML page
│   ├── css/
│   │   └── style.css               # All application styles
│   └── js/
│       ├── app.js                  # Main app init, upload, sign & download
│       ├── pdf-viewer.js           # pdf.js rendering of PDF pages
│       ├── placement.js            # Drag, drop, resize element management
│       ├── signature-panel.js      # Signature creation UI
│       └── text-panel.js           # Text field creation UI
└── test/
    ├── test-sign.js                # Mocha/supertest integration tests
    ├── e2e-test.sh                 # End-to-end bash test script
    └── fixtures/
        ├── sample.pdf              # 1-page test PDF
        └── multipage.pdf           # 3-page test PDF
```

### Server Architecture
- Express serves static files from `public/` and API routes under `/api`
- Two API endpoints: `POST /api/render-signature` and `POST /api/sign`
- Stateless design — no database, no sessions, no file storage
- PDF processing happens entirely in memory
- JSON body limit: 50MB (for base64-encoded PDFs)

### Browser Architecture
- No build step, no bundler — vanilla JS loaded via `<script>` tags
- Each module attaches to `window` (e.g., `window.PdfViewer`, `window.Placement`)
- pdf.js loaded from CDN: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs` (or from pdfjs-dist in node_modules served as static)
- Coordinate system: browser uses screen pixels, server uses PDF points. Conversion happens in `placement.js` using the scale factor from `pdf-viewer.js`

### PDF Coordinate System
- PDF coordinates: origin at bottom-left, units are points (1/72 inch)
- Browser coordinates: origin at top-left, units are pixels
- Conversion formula: `pdfX = screenX / scale`, `pdfY = (pageHeightPx - screenY) / scale`
- All element positions sent to the server must be in PDF points

### Dependencies
- `express` — HTTP server and static file serving
- `pdf-lib` — PDF creation and modification (pure JS, no native deps)
- `@napi-rs/canvas` — Canvas API for Node.js (signature rendering with custom fonts)
- `open` — Cross-platform "open URL in browser" utility
- `pdfjs-dist` — PDF.js for browser-side PDF rendering
- `mocha` (dev) — Test runner
- `chai` (dev) — Assertion library
- `supertest` (dev) — HTTP assertion library for Express

### Build & Test Commands
```bash
# Start the server
node bin/cli.js

# Run integration tests
npx mocha test/test-sign.js --timeout 10000

# Run end-to-end test
bash test/e2e-test.sh

# Quick server smoke test
node -e "const {app} = require('./server/index'); console.log('server loaded ok')"
```

### Font Files
The 6 bundled fonts are Google Fonts (OFL licensed). They're downloaded during task 2 via a shell script. The font-loader.js module provides the FONTS array:
```javascript
// Index 0: Dancing Script, 1: Great Vibes, 2: Caveat,
// 3: Sacramento, 4: Pacifico, 5: Homemade Apple
```

### API Contracts
**POST /api/render-signature**
```json
// Request
{ "name": "John Doe", "fontIndex": 0, "fontSize": 48, "color": "#000000" }
// Response 200
{ "dataUrl": "data:image/png;base64,...", "width": 280, "height": 72 }
// Response 400
{ "error": "Name is required" }
```

**POST /api/sign**
```json
// Request
{
  "pdf": "<base64-encoded-pdf>",
  "elements": [
    { "type": "signature", "page": 0, "x": 150, "y": 400, "width": 200, "height": 50, "value": "John Doe", "fontIndex": 2, "fontSize": 48, "color": "#000000" },
    { "type": "text", "page": 0, "x": 150, "y": 350, "width": 200, "height": 20, "value": "2025-01-15", "fontSize": 12, "color": "#000000" }
  ]
}
// Response 200: application/pdf binary
// Response 400: { "error": "..." }
```

## Completion Signal

When ALL tasks have `"passes": true` in tasks.json and final verification is done, write this exact line to progress.md:

```
ALL_TASKS_COMPLETE
```

This signals the loop script to stop.

## Important Notes

- **One task per iteration.** Don't try to do multiple tasks at once.
- **Commit after each task.** Use `git add <specific files>` then `git commit -m "feat: ..."`.
- **If a task fails**, note the issue in progress.md and move on to the next task if possible. Come back to fix it later.
- **Read existing code** before writing. Check what files already exist.
- **Don't modify unrelated code.** Stay focused on the current task.
- **Test after every change.** Run your test/lint commands frequently.
