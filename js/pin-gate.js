// Shared PIN prompt used by the hub and the Settings page. askPin() resolves true on success, false if cancelled,
// and rejects if the server can't be reached. "Unlocked" is remembered per browser tab for 10 minutes (a convenience;
// real access control is firestore.rules).
import { hasPin, setPin, verifyPin } from './pin.js';
import { PIN_LENGTH } from './pin-crypto.js';

const KEY = 'pinUnlockedAt', IDLE_MS = 10 * 60 * 1000;
export const isUnlocked = () => { try { return Date.now() - Number(sessionStorage.getItem(KEY)) < IDLE_MS; } catch { return false; } };
export const markUnlocked = () => { try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } };
export const clearUnlocked = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
export { IDLE_MS };

const TITLES = { enter: ['Enter PIN', 'Owner area is locked'], create: ['Create your PIN', `Choose ${PIN_LENGTH} digits`], confirm: ['Confirm PIN', 'Enter it once more'] };

export async function askPin(uid, { change = false } = {}) {
  const mode0 = change ? 'create' : (await hasPin(uid)) ? 'enter' : 'create';
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<div class="pinbox"><h3></h3><p class="hint" data-hint></p><div class="dots"></div><p class="hint" data-msg role="alert" style="color:var(--bad)"></p>
      <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Cancel', 0, '⌫'].map((k) => `<button type="button" data-k="${k}" class="${typeof k === 'string' ? 'sm' : ''}">${k}</button>`).join('')}</div></div>`;
    document.body.appendChild(dlg);
    const q = (s) => dlg.querySelector(s), st = { buf: '', mode: mode0, first: '', busy: false };
    let settled = false;
    const finish = (v) => { if (settled) return; settled = true; dlg.close(); dlg.remove(); resolve(v); };
    const paint = () => {
      q('.dots').innerHTML = Array.from({ length: PIN_LENGTH }, (_, i) => `<i class="${i < st.buf.length ? 'on' : ''}"></i>`).join('');
      [q('h3').textContent, q('[data-hint]').textContent] = TITLES[st.mode];
    };
    const fail = (t) => { q('[data-msg]').textContent = t; const d = q('.dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); };
    async function complete() {
      const code = st.buf; st.buf = ''; st.busy = true; paint();
      try {
        if (st.mode === 'create') { st.first = code; st.mode = 'confirm'; }
        else if (st.mode === 'confirm') {
          if (code !== st.first) { st.mode = 'create'; fail('PINs did not match. Start again.'); }
          else { await setPin(uid, code); markUnlocked(); return finish(true); }
        } else {
          const r = await verifyPin(uid, code);
          if (r.ok) { markUnlocked(); return finish(true); }
          fail(r.lockedMs ? `Too many tries. Locked for ${Math.ceil(r.lockedMs / 60000)} min.` : 'Incorrect PIN');
        }
      } catch { fail('Something went wrong. Check your connection.'); }
      st.busy = false; paint();
    }
    function press(k) {
      if (st.busy) return; q('[data-msg]').textContent = '';
      if (k === 'Cancel') return finish(false);
      if (k === '⌫') st.buf = st.buf.slice(0, -1);
      else if (/^\d$/.test(k) && st.buf.length < PIN_LENGTH) st.buf += k;
      paint(); if (st.buf.length === PIN_LENGTH) complete();
    }
    q('.keys').onclick = (e) => { const b = e.target.closest('button'); if (b) press(b.dataset.k); };
    dlg.addEventListener('keydown', (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });
    paint(); dlg.showModal();
  });
}
