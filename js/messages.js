// Owner <-> counter messages. Staff only ever query audience == 'all' (rules); managers see everything.
import { collection, doc, getDocs, addDoc, updateDoc, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { audienceFor } from './messages-logic.js';

export async function listMessages(role, max = 100) {
  const mgr = role === 'owner' || role === 'manager', c = collection(db, 'messages');
  const q = mgr ? query(c, orderBy('createdAt', 'desc'), limit(max)) : query(c, where('audience', '==', 'all'), limit(max));
  return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}
export const sendMessage = (role, text, choice) => addDoc(collection(db, 'messages'), { text: text.trim(), audience: audienceFor(role, choice), fromUid: auth.currentUser.uid, fromEmail: auth.currentUser.email, fromRole: role, sentAt: new Date().toISOString(), readBy: [auth.currentUser.uid], createdAt: serverTimestamp() });
export const markRead = (m) => updateDoc(doc(db, 'messages', m.id), { readBy: [...(m.readBy || []), auth.currentUser.uid] });
