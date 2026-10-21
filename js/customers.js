// Customer data layer. Split on purpose:
//   customers/{id}    - what staff need day to day (name, DOB, address, phone, ID last 4)
//   customerIds/{id}  - full ID number, expiry and image paths; OWNER-READ-ONLY (see firestore.rules)
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy, limit, where, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { db, storage, auth } from './firebase.js';

const norm = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
/** Lets us spot a repeat customer without exposing the ID number to staff. */
export async function idHash(state, number) {
  const bytes = new TextEncoder().encode(`${String(state).toUpperCase()}|${norm(number)}`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listCustomers(max = 500) {
  const snap = await getDocs(query(collection(db, 'customers'), orderBy('lastNameLower'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function findByIdHash(h) {
  const snap = await getDocs(query(collection(db, 'customers'), where('idHash', '==', h), limit(1)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export const ageOn = (dob, today = new Date().toISOString().slice(0, 10)) => {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};

/** photos: { front, back, customer } Blobs (all optional). Photo uploads need a connection and must succeed first. */
export async function saveCustomer(f, photos = {}) {
  const dup = await findByIdHash(await idHash(f.idState, f.idNumber));
  if (dup) return { duplicate: dup };
  const ref0 = doc(collection(db, 'customers')), id = ref0.id, paths = {};
  for (const [k, blob] of Object.entries(photos)) {
    if (!blob) continue;
    paths[k] = `customers/${id}/${k}.jpg`;
    await uploadBytes(ref(storage, paths[k]), blob, { contentType: 'image/jpeg' });
  }
  const who = { createdBy: auth.currentUser?.uid || null, createdByEmail: auth.currentUser?.email || null, createdAt: serverTimestamp() };
  await setDoc(ref0, {
    firstName: f.firstName, middleName: f.middleName || '', lastName: f.lastName, lastNameLower: f.lastName.toLowerCase(),
    dob: f.dob, phone: f.phone || '', email: f.email || '',
    address: { street: f.street || '', city: f.city || '', state: f.state || '', zip: f.zip || '' },
    idState: f.idState.toUpperCase(), idLast4: norm(f.idNumber).slice(-4), idHash: await idHash(f.idState, f.idNumber),
    flags: { police: false, doNotBuy: false }, hasPhotos: Object.keys(paths).length > 0, ...who,
  });
  await setDoc(doc(db, 'customerIds', id), { idType: f.idType, idNumber: f.idNumber, idState: f.idState.toUpperCase(), idExpiry: f.idExpiry || '', photos: paths, ...who });
  return { id };
}

/** Customer plus ID details; ID photo URLs only resolve for the owner (storage rules), others get none. */
export async function getCustomer(id, { withPhotos = false } = {}) {
  const [c, i] = await Promise.all([getDoc(doc(db, 'customers', id)), getDoc(doc(db, 'customerIds', id))]);
  const ids = i.data() || {}, urls = {};
  if (withPhotos) for (const [k, path] of Object.entries(ids.photos || {})) { try { urls[k] = await getDownloadURL(ref(storage, path)); } catch { /* no access */ } }
  return { id, ...c.data(), ids, photoUrls: urls };
}
/** Contact fields any staff member may change (matches firestore.rules). */
export async function updateContact(id, f) {
  await updateDoc(doc(db, 'customers', id), { phone: f.phone || '', email: f.email || '',
    address: { street: f.street || '', city: f.city || '', state: (f.state || '').toUpperCase(), zip: f.zip || '' },
    updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || null });
}
/** Owner only (rules enforce it). */
export async function setFlags(id, flags) { await updateDoc(doc(db, 'customers', id), { flags, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || null }); }
