// Purchase data layer: buy items outright from a customer. One transaction writes the receipt number, purchase record,
// inventory items (cost basis = price paid, hold per Settings) and the cash-out record. Needs a connection (unique receipt numbers).
import { collection, doc, getDocs, query, orderBy, limit, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { CONFIG } from './config.js';
import { newItemRef, uploadItemPhotos, itemData, initialStatus } from './items.js';
import { todayET } from './loans-logic.js';
import { totalPaid, hasFirearm } from './buy-logic.js';

export async function listPurchases(max = 50) {
  const snap = await getDocs(query(collection(db, 'purchases'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** lines: [{ f: validated item fields incl. costBasis (cents), blobs: [Blob] }] */
export async function createPurchase({ customer, lines, method = 'cash' }) {
  const refs = lines.map(() => newItemRef()), pRef = doc(collection(db, 'purchases')), paths = [];
  for (let i = 0; i < lines.length; i++) paths.push(await uploadItemPhotos(refs[i].id, lines[i].blobs));
  const date = todayET(), total = totalPaid(lines), hold = initialStatus('bought', date, CONFIG.compliance.resaleHoldDays);
  let receiptNumber;
  const summaries = lines.map((l) => ({ title: l.f.title, category: l.f.category, serial: (l.f.serial || '').trim(), brand: l.f.brand || '', model: l.f.model || '',
    price: l.f.costBasis, status: hold.status, holdUntil: hold.holdUntil }));
  await runTransaction(db, async (tx) => {
    const counter = doc(db, 'counters', 'buyReceipt'), snap = await tx.get(counter);
    receiptNumber = snap.exists() ? snap.data().next : CONFIG.ticket.firstBuyNumber;
    tx.set(counter, { next: receiptNumber + 1 });
    lines.forEach((l, i) => tx.set(refs[i], itemData({ ...l.f, source: 'bought', purchaseId: pRef.id }, paths[i])));
    tx.set(pRef, { receiptNumber, customerId: customer.id, customerName: `${customer.firstName} ${customer.lastName}`, total, method, date,
      itemIds: refs.map((r) => r.id), itemSummaries: summaries, hasFirearm: hasFirearm(lines), policeReport: { status: 'pending' },
      createdBy: auth.currentUser?.uid || null, createdByEmail: auth.currentUser?.email || null, createdAt: serverTimestamp() });
    tx.set(doc(collection(db, 'transactions')), { type: 'buy', amount: total, method, purchaseId: pRef.id, receiptNumber, customerId: customer.id, date,
      employeeUid: auth.currentUser?.uid || null, employeeEmail: auth.currentUser?.email || null, createdAt: serverTimestamp() });
  });
  return { id: pRef.id, receiptNumber, date, total, itemSummaries: summaries, method, createdByEmail: auth.currentUser?.email || '' };
}
