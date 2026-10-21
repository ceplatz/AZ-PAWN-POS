// Camera helpers: take a photo, or scan a PDF417 barcode. Each opens its own full-screen sheet.
// Needs HTTPS (GitHub Pages is) and the user's permission. Rejects with Error('cancelled') if dismissed.
let zxing;
const loadZXing = () => (zxing ||= new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  s.onload = () => res(window.ZXing); s.onerror = () => rej(new Error('Could not load the scanner library'));
  document.head.appendChild(s);
}));

function sheet(title, snapLabel) {
  const dlg = document.createElement('dialog');
  dlg.className = 'cam';
  dlg.innerHTML = `<div class="cam-in"><h3></h3><video playsinline muted autoplay></video><p class="cam-msg"></p>
    <div class="cam-bar"><button type="button" class="ghost" data-x>Cancel</button>${snapLabel ? `<button type="button" class="gold" data-snap>${snapLabel}</button>` : ''}</div></div>`;
  dlg.querySelector('h3').textContent = title;
  document.body.appendChild(dlg); dlg.showModal();
  return { dlg, video: dlg.querySelector('video'), msg: dlg.querySelector('.cam-msg'),
    snap: dlg.querySelector('[data-snap]'), cancel: dlg.querySelector('[data-x]') };
}

async function openStream(ui, facing) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not available on this device or connection');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 } }, audio: false });
  ui.video.srcObject = stream; await ui.video.play().catch(() => {});
  return stream;
}

/** Take one photo; resolves a JPEG Blob scaled so the long edge is at most maxEdge. */
export function capturePhoto({ title = 'Take photo', facing = 'environment', maxEdge = 1600 } = {}) {
  return new Promise(async (resolve, reject) => {
    const ui = sheet(title, 'Capture'); let stream;
    const done = (fn, v) => { stream?.getTracks().forEach((t) => t.stop()); ui.dlg.close(); ui.dlg.remove(); fn(v); };
    ui.cancel.onclick = () => done(reject, new Error('cancelled'));
    try { stream = await openStream(ui, facing); } catch (e) { return done(reject, e); }
    ui.snap.onclick = () => {
      const w = ui.video.videoWidth, h = ui.video.videoHeight, k = Math.min(1, maxEdge / Math.max(w, h));
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(ui.video, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? done(resolve, b) : done(reject, new Error('Could not capture the photo'))), 'image/jpeg', 0.82);
    };
  });
}

/** Scan a PDF417 barcode; resolves the raw text. Uses the browser's built-in detector when present, else ZXing. */
export function scanBarcode({ title = 'Scan the barcode on the BACK of the ID' } = {}) {
  return new Promise(async (resolve, reject) => {
    const ui = sheet(title, null); let stream, timer, reader;
    const done = (fn, v) => { clearInterval(timer); reader?.reset(); stream?.getTracks().forEach((t) => t.stop()); ui.dlg.close(); ui.dlg.remove(); fn(v); };
    ui.cancel.onclick = () => done(reject, new Error('cancelled'));
    ui.msg.textContent = 'Hold the back of the ID steady, barcode in view, good light.';
    try {
      if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('pdf417')) {
        stream = await openStream(ui, 'environment');
        const det = new BarcodeDetector({ formats: ['pdf417'] });
        timer = setInterval(async () => { try { const r = await det.detect(ui.video); if (r[0]?.rawValue) done(resolve, r[0].rawValue); } catch { /* keep trying */ } }, 250);
      } else {
        const Z = await loadZXing();
        stream = await openStream(ui, 'environment');
        reader = new Z.BrowserPDF417Reader();
        reader.decodeFromStream(stream, ui.video, (res) => { if (res) done(resolve, res.getText()); });
      }
    } catch (e) { done(reject, e); }
  });
}

/** Downscale an image file picked from the device (fallback when the live camera is unavailable). */
export async function fileToJpeg(file, maxEdge = 1600) {
  const bmp = await createImageBitmap(file), k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that image'))), 'image/jpeg', 0.82));
}
