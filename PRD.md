# PRD: esign

## Overview

esign is a free, open-source, web-based PDF e-signing application. It solves the problem that no free software exists that is both easy to use and allows users to place signatures on PDF documents. The target audience is anyone who needs to sign PDFs without paying for Adobe Acrobat or similar commercial tools.

The application runs as a single self-contained Node.js server that serves a web UI. Users open it in their browser, upload a PDF, visually place signatures and text fields on pages, then download the signed PDF. The goal is zero-friction: one command to install and run, cross-platform (Windows, macOS, Linux), no accounts, no cloud — everything stays local.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser UI                     │
│  ┌───────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ PDF Viewer │ │ Sig Editor │ │ Text Editor  │  │
│  │ (pdf.js)  │ │ (canvas)   │ │ (overlay)    │  │
│  └─────┬─────┘ └─────┬──────┘ └──────┬───────┘  │
│        │              │               │          │
│        └──────────┬───┴───────────────┘          │
│                   │                              │
│         ┌────────────────────┐                   │
│         │  Placement Engine  │                   │
│         │  (drag & drop,     │                   │
│         │   resize, page     │                   │
│         │   coordinates)     │                   │
│         └────────┬───────────┘                   │
│                  │ POST /api/sign                 │
└──────────────────┼───────────────────────────────┘
                   │ JSON payload:
                   │ { pdf: base64, elements: [...] }
                   ▼
┌──────────────────────────────────────────────────┐
│               Node.js Server (Express)           │
│  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ Static Files  │  │   /api/sign endpoint    │   │
│  │ (serves UI)   │  │   - receives PDF +      │   │
│  │               │  │     element placements   │   │
│  └──────────────┘  │   - generates sig images │   │
│                     │   - embeds into PDF      │   │
│                     │   - returns signed PDF   │   │
│                     └────────┬────────────────┘   │
│                              │                    │
│  ┌───────────────────────────┴──────────────────┐ │
│  │            pdf-lib (PDF manipulation)         │ │
│  │            canvas (signature rendering)       │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Data flow:**
1. User uploads PDF → browser renders it with pdf.js
2. User creates signature (typed with font selection) or text fields
3. User drags/resizes elements onto PDF pages
4. User clicks "Sign & Download" → browser sends PDF + placement data to server
5. Server renders signature images, embeds them into PDF with pdf-lib, returns signed PDF
6. Browser triggers download of the signed PDF

## Key Design Decisions

- **Language:** JavaScript (Node.js backend + vanilla JS frontend). No framework for the frontend to keep it simple and dependency-light. The entire UI is served as static files by Express.
- **PDF rendering (browser):** pdf.js for rendering PDF pages as canvas elements in the viewer
- **PDF manipulation (server):** pdf-lib — pure JavaScript, no native dependencies, works on all platforms
- **Signature rendering (server):** @napi-rs/canvas (node-canvas alternative with prebuilt binaries) for rendering signature text with fonts into PNG images that get embedded into the PDF
- **Fonts:** Bundle 6 handwriting/script Google Fonts as .ttf files for signature generation
- **No database:** Everything is stateless. PDFs are processed in memory and returned immediately.
- **No accounts/auth:** This is a local tool. No login, no cloud storage.
- **Single command install:** `npx esign` or `npm install -g esign && esign` — opens browser automatically
- **Port:** Default 3000, configurable via `PORT` env var

## Signature Generation

The signature feature lets users type their name and select from bundled handwriting fonts. The server renders the text onto a transparent canvas and returns a PNG data URL for preview. On final signing, the same rendered image is embedded into the PDF.

**Bundled fonts (Google Fonts, OFL license):**
1. Dancing Script (elegant cursive)
2. Great Vibes (formal script)
3. Caveat (casual handwriting)
4. Sacramento (flowing signature)
5. Pacifico (bold cursive)
6. Homemade Apple (natural handwriting)

**API endpoint for preview:**
```
POST /api/render-signature
Body: { "name": "John Doe", "fontIndex": 0, "fontSize": 48, "color": "#000000" }
Response: { "dataUrl": "data:image/png;base64,..." , "width": 280, "height": 60 }
```

## PDF Viewer & Placement Engine

The browser renders each PDF page using pdf.js onto a canvas. An overlay div sits on top of each page canvas, allowing users to place draggable/resizable elements.

**Element types:**
1. **Signature** — rendered signature image, draggable and resizable
2. **Text** — editable text field (for dates, printed names, etc.), configurable font size and color

**Element data structure (sent to server):**
```json
{
  "type": "signature" | "text",
  "page": 0,
  "x": 150,
  "y": 400,
  "width": 200,
  "height": 50,
  "value": "John Doe" | "2025-01-15",
  "fontIndex": 2,
  "fontSize": 48,
  "color": "#000000"
}
```

Coordinates are in PDF points (1/72 inch), relative to the bottom-left corner of the page (PDF coordinate system). The browser translates from screen pixels to PDF points using the page dimensions from pdf.js.

## Signing Endpoint

```
POST /api/sign
Content-Type: application/json
Body: {
  "pdf": "<base64-encoded PDF>",
  "elements": [ ...element objects as above... ]
}
Response: application/pdf (binary stream of the signed PDF)
```

**Server processing:**
1. Decode base64 PDF, load with pdf-lib
2. For each element:
   - If signature: render text with the selected font onto canvas → PNG → embed as image in PDF at specified coordinates
   - If text: draw text directly onto the PDF page using pdf-lib's text drawing with a standard font (Helvetica)
3. Save modified PDF to buffer, return as response

## File Layout

```
esign/
├── package.json
├── bin/
│   └── cli.js              # CLI entry point: parses args, starts server, opens browser
├── server/
│   ├── index.js             # Express server setup, static file serving
│   ├── routes/
│   │   └── api.js           # /api/sign and /api/render-signature routes
│   ├── lib/
│   │   ├── pdf-signer.js    # PDF manipulation with pdf-lib
│   │   └── signature-renderer.js  # Font rendering with canvas
│   └── fonts/               # Bundled .ttf font files
│       ├── DancingScript-Regular.ttf
│       ├── GreatVibes-Regular.ttf
│       ├── Caveat-Regular.ttf
│       ├── Sacramento-Regular.ttf
│       ├── Pacifico-Regular.ttf
│       └── HomemadeApple-Regular.ttf
├── public/
│   ├── index.html           # Main page
│   ├── css/
│   │   └── style.css        # All styles
│   └── js/
│       ├── app.js            # Main application logic, state management
│       ├── pdf-viewer.js     # PDF rendering with pdf.js
│       ├── placement.js      # Drag & drop, resize, coordinate conversion
│       ├── signature-panel.js # Signature creation UI
│       └── text-panel.js     # Text field creation UI
└── test/
    ├── test-sign.js          # Integration tests for signing endpoint
    └── fixtures/
        └── sample.pdf        # Test PDF file
```

## Edge Cases

- **Large PDFs:** Limit upload size to 50MB. Return 413 if exceeded.
- **Encrypted/password-protected PDFs:** pdf-lib cannot modify these. Detect and return a clear error message.
- **Empty signature name:** Validate on both client and server. Reject if empty.
- **Elements placed outside page bounds:** Clamp coordinates to page dimensions on the server.
- **Multi-page PDFs:** Support placing elements on any page. The viewer must render all pages with navigation.
- **Browser compatibility:** Target modern browsers (Chrome, Firefox, Safari, Edge — last 2 versions). No IE support.
- **Port conflicts:** If port 3000 is in use, try 3001-3010 sequentially, then fail with a clear message.
- **No fonts loaded:** If font files are missing, fall back to a default sans-serif and warn the user.
- **Concurrent requests:** Stateless design means no concurrency issues. Each request processes independently.
- **pdf.js version pinning:** Use pdfjs-dist from npm, pin the version to avoid breaking changes.
