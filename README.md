# esign

A free, open-source desktop app for signing PDFs. No accounts, no cloud, no subscriptions — everything stays on your machine.

Open a PDF, type your name to generate a handwriting-style signature, place it on the page, and save. That's it.

## Features

- **Typed signatures** rendered in 6 handwriting fonts (Dancing Script, Great Vibes, Caveat, Sacramento, Pacifico, Homemade Apple)
- **Text fields** for dates, printed names, or any annotation
- **Drag and resize** placed elements on any page
- **Multi-page PDF** support with per-page placement
- **Live preview** — signature renders automatically as you type
- **Portable build** — single `.exe` on Windows, no installer needed
- Works on Windows, macOS, and Linux

## Quick Start

```bash
npm install
npm start
```

## Building

```bash
npm run package
```

Produces a portable executable in the `dist/` folder.

## How It Works

- **Renderer process**: Vanilla JS + pdf.js for viewing PDFs in-browser
- **Main process**: Node.js handles signature rendering (`@napi-rs/canvas`) and PDF modification (`pdf-lib`)
- Communication via Electron IPC with `contextBridge` (context isolation enabled)

Fonts are bundled in `assets/fonts/` and registered at render time. No network requests are made.

## Usage

1. Open a PDF (button or drag-and-drop)
2. Type your name — the signature preview updates live
3. Pick a font, size, and color
4. Click **Add to Document** to place it on the current page
5. Drag to position, resize as needed
6. Optionally add text fields from the Text panel
7. Click **Sign & Save** to export

Double-click a placed text field to edit its content.

## License

MIT
