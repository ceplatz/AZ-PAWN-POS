// Item (inventory) data layer. Money is integer cents. Photos live in Storage at items/{id}/{n}.jpg.
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy, limit, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { db, storage, auth } from './firebase.js';

export * from './item-logic.js';
import { initialStatus } from './item-logic.js';

export async function listItems(max = 500) {
  const snap = await getDocs(query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export const getItem = async (id) => ({ id, ...(await getDoc(doc(db, 'items', id))).data() });
export const photoUrl = (path) => getDownloadURL(ref(storage, path));

/** f: form values (cents already parsed); blobs: ordered photo Blobs. Photos upload first and must succeed. */
export async function saveItem(f, blobs = []) {
  const r = doc(collection(db, 'items')), paths = [];
  for (let i = 0; i < blobs.length; i++) {
    paths.push(`items/${r.id}/${i + 1}.jpg`);
    await uploadBytes(ref(storage, paths[i]), blobs[i], { contentType: 'image/jpeg' });
  }
  const today = new Date().toISOString().slice(0, 10);
  await setDoc(r, {
    title: f.title, category: f.category, brand: f.brand || '', model: f.model || '', condition: f.condition,
    serial: (f.serial || '').trim(), notes: f.notes || '', location: f.location || '',
    source: f.source, costBasis: f.costBasis, askPrice: f.askPrice ?? null, photos: paths,
    acquiredDate: today, isFirearm: f.category === 'Firearm', ...initialStatus(f.source, today),
    createdBy: auth.currentUser?.uid || null, createdByEmail: auth.currentUser?.email || null, createdAt: serverTimestamp(),
  });
  return { id: r.id };
}
/** Fields a manager/owner may change after intake (staff cannot; see inventory.html). */
export const updateItem = (id, patch) => updateDoc(doc(db, 'items', id), { ...patch, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || null });
