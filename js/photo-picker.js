// Reusable multi-photo control: camera or device upload, remove, move earlier. Keeps Blobs in order (first = cover).
import { capturePhoto, fileToJpeg } from './camera.js';

export function photoPicker({ grid, addBtn, fileBtn, fileInput, onError = () => {} }) {
  let blobs = [], urls = [];
  const paint = () => {
    urls.forEach(URL.revokeObjectURL); urls = blobs.map((b) => URL.createObjectURL(b));
    grid.innerHTML = urls.map((u, i) => `<div class="ph"><img alt="" src="${u}"><div><button type="button" class="ghost" data-l="${i}" ${i ? '' : 'disabled'}>&larr;</button><button type="button" class="ghost" data-x="${i}">Remove</button></div></div>`).join('');
  };
  grid.onclick = (e) => {
    const l = e.target.dataset.l, x = e.target.dataset.x;
    if (l != null) { const i = +l; [blobs[i - 1], blobs[i]] = [blobs[i], blobs[i - 1]]; }
    if (x != null) blobs.splice(+x, 1);
    paint();
  };
  addBtn.onclick = async () => {
    try { blobs.push(await capturePhoto({ title: `Photo ${blobs.length + 1}` })); paint(); }
    catch (e) { if (e.message !== 'cancelled') onError(`${e.message}. Try "Upload from device".`); }
  };
  fileBtn.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    for (const f of fileInput.files) { try { blobs.push(await fileToJpeg(f)); } catch { onError('Could not read one of those images.'); } }
    fileInput.value = ''; paint();
  };
  return { get blobs() { return blobs; }, clear() { blobs = []; paint(); } };
}
