import * as pdfjsLib from '../../node_modules/pdfjs-dist/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
window.pdfjsLib = pdfjsLib;
window.dispatchEvent(new Event('pdfjsReady'));
