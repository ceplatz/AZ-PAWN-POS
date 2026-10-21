// Settings data layer: one document config/settings, plus an append-only change log.
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';

export async function loadSettingsDoc() { return (await getDoc(doc(db, 'config', 'settings'))).data() || null; }

export async function saveSettings(value) {
  const before = await loadSettingsDoc(), by = { updatedBy: auth.currentUser?.uid || null, updatedByEmail: auth.currentUser?.email || null };
  const verified = { ...value.verified, by: auth.currentUser?.email || null, at: new Date().toISOString() };
  const after = { ...value, verified, ...by, updatedAt: serverTimestamp() };
  const b = writeBatch(db);
  b.set(doc(db, 'config', 'settings'), after);
  b.set(doc(collection(db, 'settingsLog')), { at: serverTimestamp(), by: by.updatedBy, byEmail: by.updatedByEmail, before, after: value });
  await b.commit();
  return after;
}
