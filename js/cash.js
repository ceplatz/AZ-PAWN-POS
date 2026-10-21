// Cash management data layer (manager/owner). Counts are permanent records; expenses/payouts are money records.
import { collection, getDocs, addDoc, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { todayET } from './dates.js';

export async function listCounts(max = 120) { return (await getDocs(query(collection(db, 'drawerCounts'), orderBy('createdAt', 'desc'), limit(max)))).docs.map((d) => ({ id: d.id, ...d.data() })); }
export const saveCount = (c) => addDoc(collection(db, 'drawerCounts'), { ...c, date: todayET(), at: new Date().toISOString(), countedBy: auth.currentUser.email, createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
/** type: 'expense' | 'payout'. Cash only for now (comes out of the drawer). */
export const recordOutflow = ({ type, amount, category, note }) => addDoc(collection(db, 'transactions'), { type, amount, method: 'cash', category, note, date: todayET(), employeeUid: auth.currentUser.uid, employeeEmail: auth.currentUser.email, createdAt: serverTimestamp() });
