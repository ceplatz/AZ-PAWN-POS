// Sales data layer. One transaction: receipt number, re-verify every item is still sellable, mark sold, write the sale
// and money records. Two staff can never sell the same item, and a held item can't be sold.
import { collection, doc, getDocs, query, orderBy, limit, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { CONFIG } from './config.js';
import { todayET } from './dates.js';
import { blockedReason, computeTotals } from './sell-logic.js';

export async function listSales(max = 50) {
  const snap = await getDocs(query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listSellable(max = 500) {
  const snap = await getDocs(query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(max)));
  const today = todayET();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((i) => !blockedReason(i, today) || i.isFirearm && ['for-sale', 'on-hold'].includes(i.status));
}

/** lines: [{ item, price (cents) }]. tendered: cents or null (cash only). */
export async function createSale({ lines, customer = null, method = 'cash', tendered = null }) {
  const date = todayET(), taxRate = CONFIG.shop.taxRate ?? null, totals = computeTotals(lines.map((l) => l.price), taxRate);
  const sRef = doc(collection(db, 'sales')), who = { uid: auth.currentUser?.uid || null, email: auth.currentUser?.email || null };
  let receiptNumber, saved;
  await runTransaction(db, async (tx) => {
    const counter = doc(db, 'counters', 'saleReceipt');
    const [cSnap, ...snaps] = await Promise.all([tx.get(counter), ...lines.map((l) => tx.get(doc(db, 'items', l.item.id)))]);
    snaps.forEach((sn, i) => {
      const it = sn.data(), why = it && blockedReason(it, date);
      if (!it || why) throw new Error(`"${lines[i].item.title}" is no longer available to sell${why ? ' (' + why + ')' : ''}.`);
    });
    receiptNumber = cSnap.exists() ? cSnap.data().next : CONFIG.ticket.firstSaleNumber;
    tx.set(counter, { next: receiptNumber + 1 });
    saved = snaps.map((sn) => sn.data());
    lines.forEach((l) => tx.update(doc(db, 'items', l.item.id), { status: 'sold', soldDate: date, soldPrice: l.price, saleId: sRef.id, updatedAt: serverTimestamp(), updatedBy: who.uid }));
    const costed = lines.map((l, i) => ({ itemId: l.item.id, title: l.item.title, category: l.item.category, serial: l.item.serial || '', price: l.price, costBasis: saved[i].costBasis ?? null, source: saved[i].source || null, createdBy: saved[i].createdBy || null }));
    tx.set(sRef, { receiptNumber, date, lines: costed, ...totals, taxRate, method, tendered: method === 'cash' ? tendered : null,
      customerId: customer?.id || null, customerName: customer ? `${customer.firstName} ${customer.lastName}` : '', createdBy: who.uid, createdByEmail: who.email, createdAt: serverTimestamp() });
    tx.set(doc(collection(db, 'transactions')), { type: 'sale', amount: totals.total, subtotal: totals.subtotal, tax: totals.tax, method, saleId: sRef.id, receiptNumber,
      customerId: customer?.id || null, date, employeeUid: who.uid, employeeEmail: who.email, createdAt: serverTimestamp() });
  });
  return { id: sRef.id, receiptNumber, date, lines: lines.map((l) => ({ title: l.item.title, serial: l.item.serial || '', price: l.price })), ...totals, taxRate, method,
    tendered: method === 'cash' ? tendered : null, createdByEmail: who.email || '' };
}
