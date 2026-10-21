// Loads what the alert engine, briefing and reports need. Money records (transactions) are manager/owner only.
import { collection, getDocs, query, orderBy, limit, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { listLoans } from './loans.js';
import { listItems } from './items.js';
import { listPurchases } from './buys.js';
import { computeAlerts } from './alerts-logic.js';
import { todayET } from './dates.js';

export async function loadAlerts(today = todayET()) {
  const [loans, items, purchases] = await Promise.all([listLoans(), listItems(), listPurchases(200).catch(() => [])]);
  return { loans, items, purchases, alerts: computeAlerts({ loans, items, purchases, today }) };
}
/** Transactions with date in [from, to] (inclusive, 'YYYY-MM-DD'). Throws for staff (rules). */
export async function listTransactions(from, to, max = 5000) {
  const snap = await getDocs(query(collection(db, 'transactions'), where('date', '>=', from), where('date', '<=', to), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
