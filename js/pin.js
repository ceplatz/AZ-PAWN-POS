// Firestore side of the owner PIN: one document per user at pins/{uid}.
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { makeRecord, checkPin, nextState, lockedMs } from './pin-crypto.js';

const ref = (uid) => doc(db, 'pins', uid);
export const hasPin = async (uid) => (await getDoc(ref(uid))).exists();
export const setPin = async (uid, pin) => setDoc(ref(uid), await makeRecord(pin));

/** Returns { ok, lockedMs }. Persists failure counts so reloading can't reset the lockout. */
export async function verifyPin(uid, pin) {
  const snap = await getDoc(ref(uid));
  const rec = snap.data();
  const wait = lockedMs(rec);
  if (wait) return { ok: false, lockedMs: wait };
  const ok = await checkPin(pin, rec);
  const next = nextState(rec, ok);
  if (next.fails !== (rec.fails || 0) || next.lockedUntil !== (rec.lockedUntil || 0)) await updateDoc(ref(uid), next);
  return { ok, lockedMs: lockedMs(next) };
}
