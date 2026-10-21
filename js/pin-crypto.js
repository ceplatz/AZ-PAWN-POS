// PIN hashing + lockout logic. Pure (no Firebase) so it is unit-tested.
// The PIN is a second lock for a shared counter device; real access control is firestore.rules.
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const PIN_LENGTH = 6;
export const MAX_FAILS = 5;
export const LOCK_MS = 5 * 60 * 1000;
export const ITERATIONS = 210000;

export const validPin = (p) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(p);

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

/** New record to store: salted hash plus a clean lockout state. */
export async function makeRecord(pin, iterations = ITERATIONS) {
  if (!validPin(pin)) throw new Error(`PIN must be ${PIN_LENGTH} digits`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), iterations, hash: b64(await derive(pin, salt, iterations)), fails: 0, lockedUntil: 0 };
}

export async function checkPin(pin, rec) {
  if (!validPin(pin) || !rec?.hash) return false;
  const got = await derive(pin, unb64(rec.salt), rec.iterations);
  const want = unb64(rec.hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

/** Lockout state after an attempt. Returns { fails, lockedUntil } to persist. */
export function nextState(rec, ok, now = Date.now()) {
  if (ok) return { fails: 0, lockedUntil: 0 };
  const fails = (rec.fails || 0) + 1;
  return fails >= MAX_FAILS ? { fails: 0, lockedUntil: now + LOCK_MS } : { fails, lockedUntil: 0 };
}
export const lockedMs = (rec, now = Date.now()) => Math.max(0, (rec?.lockedUntil || 0) - now);
