# PRD: esign

## Overview

esign is a free, open-source desktop application for signing PDF documents. It solves the problem that no free, easy-to-use software exists for attaching signatures to PDFs without relying on hosted services or expensive commercial tools like Adobe Acrobat. The target audience is anyone who needs to sign PDFs locally — freelancers, small businesses, individuals dealing with contracts or forms.

The application is built with Electron and vanilla JavaScript. It runs as a native desktop app on Windows, macOS, and Linux. Users open a PDF, generate a signature from typed text rendered in handwriting fonts, optionally add text fields (dates, printed names), place elements visually on the document, and export the signed PDF. Everything stays local — no accounts, no cloud, no network requests.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  ┌──────────────┐  ┌────────────────────────────────┐   │
│  │  main.js      │  │  ipcMain handlers              │   │
│  │  (window      │  │  - render-signature             │   │
│  │   setup,      │  │  - sign-pdf                     │   │
│  │   menus)      │  │  - open-file-dialog             │   │
│  └──────────────┘  └────────┬───────────────────────┘   │
│                              │                           │
│  ┌───────────────────────────┴────────────────────────┐  │
│  │           Backend Modules (Node.js)                 │  │
│  │  ┌──────────────────┐  ┌────────────────────────┐  │  │
│  │  │ signature-        │  │ pdf-signer.js           │  │  │
│  │  │ renderer.js       │  │ (pdf-lib: embed images, │  │  │
│  │  │ (@napi-rs/canvas) │  │  draw text, save PDF)   │  │  │
│  │  └──────────────────┘  └────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │ IPC (contextBridge)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Electron Renderer Process               │
│  ┌───────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │ PDF Viewer │ │ Sig Panel  │ │ Text Panel           │  │
│  │ (pdf.js)  │ │ (font pick,│ │ (date, printed name) │  │
│  │           │ │  preview)  │ │                      │  │
│  └─────┬─────┘ └─────┬──────┘ └──────┬───────────────┘  │
│        └──────────┬───┴───────────────┘                  │
│         ┌─────────┴──────────┐                           │
│         │  Placement Engine  │                           │
│         │  (drag, drop,      │                           │
│         │   resize, coords)  │                           │
│         └────────────────────┘                           │
└─────────────────────────────────────────────────────────┘
```

**Data flow:**
1. User opens PDF via file dialog or drag-and-drop → renderer loads it with pdf.js
2. User creates signature (typed name + font selection) → main process renders via canvas → returns PNG data URL
3. User drags signature/text elements onto PDF pages
4. User clicks "Sign & Save" → renderer sends PDF bytes + element placements to main process via IPC
5. Main process renders final signature images, embeds into PDF with pdf-lib, returns signed PDF buffer
6. Renderer triggers "Save As" dialog, writes signed PDF to disk

## Key Design Decisions

- **Framework:** Electron — produces native installers for Windows/macOS/Linux, bundles Node.js runtime, no external server needed
- **Packaging:** electron-builder — generates .exe (NSIS installer), .dmg, .AppImage/.deb
- **Frontend:** Vanilla JavaScript, no framework. Keeps bundle small and dependency-light.
- **PDF rendering (renderer):** pdfjs-dist for rendering PDF pages in the viewer
- **PDF manipulation (main):** pdf-lib — pure JavaScript, no native dependencies
- **Signature rendering (main):** @napi-rs/canvas for rendering signature text with custom fonts into PNG images
- **IPC:** Electron contextBridge/ipcRenderer for secure communication between renderer and main process (contextIsolation: true, nodeIntegration: false)
- **Fonts:** Bundle 6 handwriting/script Google Fonts as .ttf files
- **No network:** The app makes zero network requests. Everything is local.
- **No database/state:** PDFs are processed in memory. No persistent storage needed.

## Signature Generation

Users type their name and select from 6 bundled handwriting fonts. The main process renders the text onto a transparent canvas and returns a PNG data URL for preview and embedding.

**Bundled fonts (Google Fonts, OFL license):**
1. Dancing Script (elegant cursive)
2. Great Vibes (formal script)
3. Caveat (casual handwriting)
4. Sacramento (flowing signature)
5. Pacifico (bold cursive)
6. Homemade Apple (natural handwriting)

**IPC channel: `render-signature`**
```
Request:  { name: string, fontIndex: 0-5, fontSize: 24-72, color: string }
Response: { dataUrl: string, width: number, height: number }
```

## PDF Viewer & Placement Engine

The renderer process uses pdf.js to render each PDF page as a canvas. An overlay div on top of each page canvas allows placing draggable/resizable elements.

**Element types:**
1. **Signature** — rendered signature image, draggable and resizable
2. **Text** — editable text field (dates, printed names), configurable font size and color

**Element data structure (sent to main process for signing):**
```json
{
  "type": "signature | text",
  "page": 0,
  "x": 150,
  "y": 400,
  "width": 200,
  "height": 50,
  "value": "John Doe",
  "fontIndex": 2,
  "fontSize": 48,
  "color": "#000000"
}
```

Coordinates are in PDF points (1/72 inch), origin at bottom-left (PDF native). The placement engine converts from screen pixels to PDF points using the render scale and page dimensions.

## Signing (Main Process)

**IPC channel: `sign-pdf`**
```
Request:  { pdfBytes: Uint8Array, elements: Element[] }
Response: Uint8Array (signed PDF bytes)
```

**Processing:**
1. Load PDF with pdf-lib
2. For each signature element: render text with the selected font via @napi-rs/canvas → PNG → embed as image
3. For each text element: draw text directly with pdf-lib using Helvetica
4. Serialize modified PDF, return bytes

## File Layout

```
esign/
├── package.json
├── forge.config.js              # electron-builder / Electron Forge config
├── main/
│   ├── main.js                  # Electron main process entry point
│   ├── preload.js               # contextBridge exposing IPC to renderer
│   ├── ipc-handlers.js          # IPC handler registration (render-signature, sign-pdf)
│   └── lib/
│       ├── font-loader.js       # FONTS array, loadFont(path) utility
│       ├── signature-renderer.js # Canvas-based signature image generation
│       └── pdf-signer.js        # PDF manipulation with pdf-lib
├── renderer/
│   ├── index.html               # Main HTML page
│   ├── css/
│   │   └── style.css            # All styles
│   └── js/
│       ├── app.js               # App init, file open, sign & save flow
│       ├── pdf-viewer.js        # pdf.js PDF rendering
│       ├── placement.js         # Drag & drop, resize, coordinate conversion
│       ├── signature-panel.js   # Signature creation UI
│       └── text-panel.js        # Text field creation UI
├── assets/
│   └── fonts/                   # Bundled .ttf font files (6 files)
│       ├── DancingScript-Regular.ttf
│       ├── GreatVibes-Regular.ttf
│       ├── Caveat-Regular.ttf
│       ├── Sacramento-Regular.ttf
│       ├── Pacifico-Regular.ttf
│       └── HomemadeApple-Regular.ttf
└── test/
    ├── test-sign.js             # Integration tests for signing logic
    ├── e2e-test.sh              # End-to-end test script
    └── fixtures/
        ├── sample.pdf           # 1-page test PDF
        └── multipage.pdf        # 3-page test PDF
```

## Edge Cases

- **Large PDFs:** Limit to 50MB. Show error dialog if exceeded.
- **Encrypted/password-protected PDFs:** pdf-lib throws on these. Detect and show clear error message.
- **Empty signature name:** Validate on renderer side before sending IPC. Reject if empty.
- **Elements placed outside page bounds:** Clamp coordinates to page dimensions in pdf-signer.js.
- **Multi-page PDFs:** Support placing elements on any page. Viewer renders all pages with scroll.
- **No fonts loaded:** If font files are missing at runtime, show error on startup.
- **File save conflicts:** Use Electron's "Save As" dialog — user picks the path, no conflict.
- **Drag-and-drop files:** Accept .pdf files dropped onto the app window.
- **Multiple windows:** Not supported. Single-window application.
- **pdf.js worker:** Bundle the pdf.js worker file and configure workerSrc to load from local path (no CDN).
