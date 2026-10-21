// Mark pending purchases/loans as reported to the police (manager/owner).
import { doc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';

export async function markReported(records, ref = '') {
  const b = writeBatch(db), report = { status: 'reported', at: new Date().toISOString(), by: auth.currentUser.email, ref: ref.trim() };
  for (const r of records) b.update(doc(db, r.kind === 'buy' ? 'purchases' : 'loans', r.source.id), { policeReport: report, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
  await b.commit();
}
