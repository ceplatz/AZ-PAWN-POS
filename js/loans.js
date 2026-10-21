// Loan data layer: issue, redeem, renew, forfeit. Every money event also writes an immutable transactions record.
import { collection, doc, getDocs, query, orderBy, limit, runTransaction, writeBatch, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { CONFIG } from './config.js';
import { newItemRef, uploadItemPhotos, itemData, initialStatus } from './items.js';
import { renew } from './loan-engine.js';
import { termsFromConfig, summarize, splitCost, todayET } from './loans-logic.js';

export const hasFirearmCollateral = (loan) => (loan.itemSummaries || []).some((i) => i.category === 'Firearm');
const who = () => ({ employeeUid: auth.currentUser?.uid || null, employeeEmail: auth.currentUser?.email || null });
const txRecord = (t) => ({ ...t, date: todayET(), ...who(), createdAt: serverTimestamp() });

export async function listLoans(max = 500) {
  const snap = await getDocs(query(collection(db, 'loans'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Issue a loan. items: [{ f: itemFormValues, blobs: [Blob] }]. Photos upload first (they must succeed), then the
 * ticket number, loan, collateral items and the cash-out record are written in ONE transaction. Needs a connection
 * because ticket numbers must be unique across devices.
 */
export async function createLoan({ customer, principal, method = 'cash', items }) {
  const refs = items.map(() => newItemRef()), loanRef = doc(collection(db, 'loans'));
  const paths = [];
  for (let i = 0; i < items.length; i++) paths.push(await uploadItemPhotos(refs[i].id, items[i].blobs));
  const terms = termsFromConfig(), originDate = todayET();
  let ticketNumber;
  await runTransaction(db, async (tx) => {
    const counter = doc(db, 'counters', 'loanTicket'), snap = await tx.get(counter);
    ticketNumber = snap.exists() ? snap.data().next : CONFIG.ticket.firstNumber;
    tx.set(counter, { next: ticketNumber + 1 });
    items.forEach((it, i) => tx.set(refs[i], itemData({ ...it.f, source: 'pawn-collateral', costBasis: null, loanId: loanRef.id }, paths[i])));
    tx.set(loanRef, {
      ticketNumber, customerId: customer.id, customerName: `${customer.firstName} ${customer.lastName}`, principal, originDate, issuedDate: originDate, terms,
      status: 'active', renewals: 0, history: [], itemIds: refs.map((r) => r.id),
      itemSummaries: items.map((it) => ({ title: it.f.title, category: it.f.category, serial: (it.f.serial || '').trim(), brand: it.f.brand || '', model: it.f.model || '', estValue: it.f.estValue ?? null })),
      policeReport: { status: 'pending' },
      createdBy: auth.currentUser?.uid || null, createdByEmail: auth.currentUser?.email || null, createdAt: serverTimestamp(),
    });
    tx.set(doc(collection(db, 'transactions')), txRecord({ type: 'loan-out', amount: principal, method, loanId: loanRef.id, ticketNumber, customerId: customer.id }));
  });
  return { id: loanRef.id, ticketNumber, originDate, terms };
}

const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || null });
const entry = (type, amount, date) => ({ type, amount, date, by: auth.currentUser?.email || null });

/** Customer pays the payoff; collateral is released. */
export async function redeemLoan(loan, { method = 'cash' } = {}) {
  const asOf = todayET(), s = summarize(loan, asOf);
  if (s.status === 'defaulted') throw new Error('This loan is past forfeiture and cannot be redeemed');
  if (['redeemed', 'forfeited'].includes(loan.status)) throw new Error('This loan is already closed');
  if (CONFIG.firearms.redemptionNeedsTransfer && hasFirearmCollateral(loan)) throw new Error('This loan includes a firearm. Redeem it from the Firearms page so the transfer is recorded.');
  const b = writeBatch(db);
  b.update(doc(db, 'loans', loan.id), { status: 'redeemed', closedDate: asOf, history: [...(loan.history || []), entry('redeemed', s.payoff, asOf)], ...stamp() });
  loan.itemIds.forEach((id) => b.update(doc(db, 'items', id), { status: 'released', ...stamp() }));
  b.set(doc(collection(db, 'transactions')), txRecord({ type: 'redemption', amount: s.payoff, principal: loan.principal, interest: s.interest, method, loanId: loan.id, ticketNumber: loan.ticketNumber, customerId: loan.customerId }));
  await b.commit();
  return { amount: s.payoff };
}

/** Customer pays the accrued interest; the clock restarts with the same principal. */
export async function renewLoan(loan, { method = 'cash' } = {}) {
  const asOf = todayET();
  if (['redeemed', 'forfeited'].includes(loan.status)) throw new Error('This loan is already closed');
  const { loan: next, interestPaid } = renew({ ...loan }, asOf, loan.terms); // throws if defaulted or renewal limit reached
  if (interestPaid <= 0) throw new Error('No interest is due yet, so there is nothing to renew');
  const b = writeBatch(db);
  b.update(doc(db, 'loans', loan.id), { originDate: next.originDate, renewals: next.renewals, status: 'active', history: [...(loan.history || []), entry('renewed', interestPaid, asOf)], ...stamp() });
  b.set(doc(collection(db, 'transactions')), txRecord({ type: 'renewal', amount: interestPaid, method, loanId: loan.id, ticketNumber: loan.ticketNumber, customerId: loan.customerId }));
  await b.commit();
  return { amount: interestPaid, newOrigin: next.originDate };
}

/** Manager/owner only (rules). Defaulted collateral becomes shop inventory at the loan principal as cost basis. */
export async function forfeitLoan(loan) {
  const asOf = todayET();
  if (summarize(loan, asOf).status !== 'defaulted') throw new Error('This loan is not yet eligible for forfeiture');
  const costs = splitCost(loan.principal, loan.itemIds.length); // VERIFY: principal only vs principal + fees (config.loan.forfeitureCostBasis)
  const b = writeBatch(db);
  b.update(doc(db, 'loans', loan.id), { status: 'forfeited', closedDate: asOf, history: [...(loan.history || []), entry('forfeited', 0, asOf)], ...stamp() });
  loan.itemIds.forEach((id, i) => b.update(doc(db, 'items', id), { source: 'forfeited', costBasis: costs[i], acquiredDate: asOf, ...initialStatus('forfeited', asOf), ...stamp() }));
  await b.commit();
}
