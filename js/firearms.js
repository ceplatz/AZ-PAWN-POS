// Firearms data layer: A&D book entries, transfers (4473/NICS record), and the atomic sale/pawn-return paths.
// SUPPORTS recordkeeping only. Append-only: entries/transfers are never edited or deleted; a disposition is added once.
import { collection, doc, getDocs, query, orderBy, limit, where, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { db, storage, auth } from './firebase.js';
import { CONFIG } from './config.js';
import { todayET } from './dates.js';
import { blockedReason, computeTotals } from './sell-logic.js';
import { summarize } from './loans-logic.js';
import { validateAcquisition } from './firearms-logic.js';

const who = () => ({ uid: auth.currentUser?.uid || null, email: auth.currentUser?.email || null });
const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: who().uid });
const snapList = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));

export const listFirearmItems = async () => snapList(await getDocs(query(collection(db, 'items'), where('isFirearm', '==', true), limit(500))));
export const listAD = async (max = 2000) => snapList(await getDocs(query(collection(db, 'adBook'), orderBy('entryNumber', 'desc'), limit(max))));
export const listTransfers = async (max = 500) => snapList(await getDocs(query(collection(db, 'firearmTransfers'), orderBy('createdAt', 'desc'), limit(max))));

/** Add the acquisition side of the A&D book for one firearm item. */
export async function createAcquisition(item, form) {
  const v = validateAcquisition(form); if (!v.ok) throw new Error(v.errors[0]);
  const eRef = doc(collection(db, 'adBook')); let entryNumber;
  await runTransaction(db, async (tx) => {
    const cRef = doc(db, 'counters', 'adBook'), [c, it] = await Promise.all([tx.get(cRef), tx.get(doc(db, 'items', item.id))]);
    if (it.data()?.adEntryId) throw new Error('This firearm already has an A&D entry.');
    entryNumber = c.exists() ? c.data().next : 1;
    tx.set(cRef, { next: entryNumber + 1 });
    tx.set(eRef, { entryNumber, itemId: item.id, itemTitle: item.title, acq: v.value, disp: null, createdBy: who().uid, createdByEmail: who().email, createdAt: serverTimestamp() });
    tx.update(doc(db, 'items', item.id), { adEntryId: eRef.id, adEntryNumber: entryNumber, firearmType: v.value.type, ...stamp() });
  });
  return { id: eRef.id, entryNumber };
}

const transferDoc = (kind, p, extra) => ({
  kind, itemId: p.item.id, adEntryId: p.item.adEntryId, firearmType: p.item.firearmType, serial: p.item.serial || '', title: p.item.title,
  buyerId: p.buyer.id, buyerName: `${p.buyer.firstName} ${p.buyer.lastName}`, buyerDob: p.buyer.dob,
  buyerAddress: [p.buyer.address?.street, p.buyer.address?.city, p.buyer.address?.state, p.buyer.address?.zip].filter(Boolean).join(', '),
  idType: p.ids.idType || '', idNumber: p.ids.idNumber || '', idState: p.ids.idState || '', idExpiry: p.ids.idExpiry || '',
  nicsResult: 'Proceed', nicsNumber: p.form.nicsNumber.trim(), nicsAt: p.form.nicsAt || '', idVerified: true, form4473Done: true,
  checks: CONFIG.firearms.checklist.map((text, i) => ({ text, done: !!p.form.checks?.[i] })), notes: p.form.notes || '', imagePath: p.imagePath || null,
  date: todayET(), createdBy: who().uid, createdByEmail: who().email, createdAt: serverTimestamp(), ...extra });
const dispOf = (p, id, date) => ({ date, name: `${p.buyer.firstName} ${p.buyer.lastName}`, address: transferDoc('', p, {}).buyerAddress,
  idRef: `${p.ids.idType || 'ID'} ${p.ids.idState || ''} ${p.ids.idNumber || ''}`.trim(), nicsNumber: p.form.nicsNumber.trim(), transferId: id });

async function uploadImage(id, blob) {
  if (!blob) return null; const path = `firearms/${id}/4473.jpg`;
  await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' }); return path;
}

/** Sell a firearm: transfer record + A&D disposition + sale + money record + item sold, all or nothing. */
export async function createFirearmSale(p) { // { item, price, buyer, ids, form, method, tendered, imageBlob }
  const date = todayET(), sRef = doc(collection(db, 'sales')), taxRate = CONFIG.shop.taxRate ?? null, totals = computeTotals([p.price], taxRate);
  p.imagePath = await uploadImage(sRef.id, p.imageBlob); let receiptNumber;
  await runTransaction(db, async (tx) => {
    const cRef = doc(db, 'counters', 'saleReceipt'), iRef = doc(db, 'items', p.item.id);
    const [c, it] = await Promise.all([tx.get(cRef), tx.get(iRef)]), cur = it.data(), why = !cur || (cur.isFirearm ? (['for-sale'].includes(cur.status) || (cur.status === 'on-hold' && cur.holdUntil && cur.holdUntil <= date) ? null : 'not sellable') : 'not a firearm item');
    if (why) throw new Error(`"${p.item.title}" is no longer available to sell (${why}).`);
    const aRef = doc(db, 'adBook', cur.adEntryId), a = await tx.get(aRef);
    if (!a.exists() || a.data().disp) throw new Error('This firearm already has a disposition in the A&D book.');
    receiptNumber = c.exists() ? c.data().next : CONFIG.ticket.firstSaleNumber; tx.set(cRef, { next: receiptNumber + 1 });
    tx.set(doc(db, 'firearmTransfers', sRef.id), transferDoc('sale', { ...p, item: { ...p.item, ...cur, id: p.item.id } }, { saleId: sRef.id }));
    tx.update(aRef, { disp: dispOf(p, sRef.id, date), ...stamp() });
    tx.update(iRef, { status: 'sold', soldDate: date, soldPrice: p.price, saleId: sRef.id, ...stamp() });
    tx.set(sRef, { receiptNumber, date, lines: [{ itemId: p.item.id, title: p.item.title, category: 'Firearm', serial: cur.serial || '', price: p.price, costBasis: cur.costBasis ?? null, source: cur.source || null, createdBy: cur.createdBy || null }],
      ...totals, taxRate, method: p.method, tendered: p.method === 'cash' ? p.tendered ?? null : null, firearm: true, customerId: p.buyer.id, customerName: `${p.buyer.firstName} ${p.buyer.lastName}`,
      createdBy: who().uid, createdByEmail: who().email, createdAt: serverTimestamp() });
    tx.set(doc(collection(db, 'transactions')), { type: 'sale', amount: totals.total, subtotal: totals.subtotal, tax: totals.tax, method: p.method, saleId: sRef.id, receiptNumber, customerId: p.buyer.id, date,
      employeeUid: who().uid, employeeEmail: who().email, createdAt: serverTimestamp() });
  });
  return { id: sRef.id, receiptNumber, date, lines: [{ title: p.item.title, serial: p.item.serial || '', price: p.price }], ...totals, taxRate, method: p.method, tendered: p.method === 'cash' ? p.tendered ?? null : null, createdByEmail: who().email || '' };
}

/** Return a pawned firearm to its owner on redemption (needs a transfer record when settings require it). One firearm per loan in-app. */
export async function createFirearmRedeem(p) { // { loan, item, buyer, ids, form, method, imageBlob }
  const date = todayET(), tRef = doc(collection(db, 'firearmTransfers'));
  p.imagePath = await uploadImage(tRef.id, p.imageBlob);
  await runTransaction(db, async (tx) => {
    const lRef = doc(db, 'loans', p.loan.id), iRef = doc(db, 'items', p.item.id), [l, it] = await Promise.all([tx.get(lRef), tx.get(iRef)]);
    const loan = { id: p.loan.id, ...l.data() }, cur = it.data(), s = loan.status && summarize(loan, date);
    if (!l.exists() || ['redeemed', 'forfeited'].includes(loan.status) || s.status === 'defaulted') throw new Error('This loan can no longer be redeemed.');
    if (cur.status !== 'collateral-active') throw new Error('This firearm is not currently held as collateral.');
    const aRef = doc(db, 'adBook', cur.adEntryId), a = await tx.get(aRef); if (!a.exists() || a.data().disp) throw new Error('This firearm already has a disposition in the A&D book.');
    tx.set(tRef, transferDoc('redemption', { ...p, item: { ...p.item, ...cur, id: p.item.id } }, { loanId: loan.id, ticketNumber: loan.ticketNumber }));
    tx.update(aRef, { disp: dispOf(p, tRef.id, date), ...stamp() });
    loan.itemIds.forEach((id) => tx.update(doc(db, 'items', id), { status: 'released', ...(id === p.item.id ? { releaseTransferId: tRef.id } : {}), ...stamp() }));
    tx.update(lRef, { status: 'redeemed', closedDate: date, history: [...(loan.history || []), { type: 'redeemed', amount: s.payoff, date, by: who().email }], ...stamp() });
    tx.set(doc(collection(db, 'transactions')), { type: 'redemption', amount: s.payoff, principal: loan.principal, interest: s.interest, method: p.method, loanId: loan.id, ticketNumber: loan.ticketNumber, customerId: loan.customerId, date,
      employeeUid: who().uid, employeeEmail: who().email, createdAt: serverTimestamp() });
  });
  return { id: tRef.id };
}

/** Log a NICS result that is NOT Proceed (denied/delayed/cancelled): the transfer does not happen but the attempt is kept. */
export async function logCheck({ item, buyer, form }) {
  await runTransaction(db, async (tx) => tx.set(doc(collection(db, 'firearmChecks')), { itemId: item.id, serial: item.serial || '', buyerId: buyer.id, buyerName: `${buyer.firstName} ${buyer.lastName}`,
    nicsResult: form.nicsResult, nicsNumber: (form.nicsNumber || '').trim(), notes: form.notes || '', date: todayET(), createdBy: who().uid, createdByEmail: who().email, createdAt: serverTimestamp() }));
}
