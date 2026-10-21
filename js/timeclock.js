// Time clock data layer. Staff clock themselves in/out; managers can read all and correct entries (with a note).
import { collection, doc, getDocs, addDoc, updateDoc, query, where, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { todayET } from './dates.js';
import { hoursByEmployee } from './timeclock-logic.js';

const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
export const myEntries = async (uid, max = 200) => rows(await getDocs(query(collection(db, 'timeEntries'), where('employeeUid', '==', uid), limit(max)))).sort((a, b) => (a.inAt < b.inAt ? 1 : -1));
export const allEntries = async (from, to, max = 5000) => rows(await getDocs(query(collection(db, 'timeEntries'), where('date', '>=', from), where('date', '<=', to), limit(max)))).sort((a, b) => (a.inAt < b.inAt ? 1 : -1));
export const clockIn = () => addDoc(collection(db, 'timeEntries'), { employeeUid: auth.currentUser.uid, employeeEmail: auth.currentUser.email, date: todayET(), inAt: new Date().toISOString(), outAt: null, createdAt: serverTimestamp() });
export const clockOut = (entry) => updateDoc(doc(db, 'timeEntries', entry.id), { outAt: new Date().toISOString() });
/** Manager correction. The original times stay recoverable only through this note, so require one. */
export const adjustEntry = (id, { inAt, outAt, note }) => updateDoc(doc(db, 'timeEntries', id), { inAt, outAt: outAt || null, note, adjustedBy: auth.currentUser.email, adjustedAt: new Date().toISOString() });
/** { email: hours } for reports (managers only). */
export async function hoursByEmail(from, to) { return Object.fromEntries(hoursByEmployee(await allEntries(from, to), from, to).map((x) => [x.email, x.hours])); }
