// Firebase init. These web config values are identifiers, not secrets; access is enforced by firestore.rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getStorage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyAcGaf1tZ7_O3GkZafNEJUWnofFmyTGByo',
  authDomain: 'statewide-pawn.firebaseapp.com',
  projectId: 'statewide-pawn',
  storageBucket: 'statewide-pawn.firebasestorage.app',
  messagingSenderId: '476917914059',
  appId: '1:476917914059:web:7f1dba575473a0b248be4e',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
// Offline cache so the counter keeps working through an outage (full write outbox comes later).
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

/** Calls cb(user, role) on every auth change. role comes from the roles/{uid} document; null if none assigned. */
export function watchAuth(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null, null);
    let role = null;
    try { role = (await getDoc(doc(db, 'roles', user.uid))).data()?.role ?? null; } catch { /* no access = no role */ }
    cb(user, role);
  });
}
export const login = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const logout = () => signOut(auth);
