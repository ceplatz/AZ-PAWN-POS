// Recurring reminders + the "done" log (who acknowledged which reminder on which day).
import { collection, doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { logKey } from './reminders-logic.js';

const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
export const listReminders = async () => rows(await getDocs(query(collection(db, 'reminders'), limit(200)))).sort((a, b) => (a.time < b.time ? -1 : 1));
export const addReminder = (r) => addDoc(collection(db, 'reminders'), { text: r.text.trim(), time: r.time, days: r.days || [], active: true, createdBy: auth.currentUser.email, createdAt: serverTimestamp() });
export const setActive = (id, active) => updateDoc(doc(db, 'reminders', id), { active });
export const removeReminder = (id) => deleteDoc(doc(db, 'reminders', id));
export const ackedKeys = async (date) => rows(await getDocs(query(collection(db, 'reminderLog'), where('date', '==', date), limit(300)))).map((x) => x.key);
export const ack = (r, date) => setDoc(doc(db, 'reminderLog', logKey(date, r.id)), { key: logKey(date, r.id), reminderId: r.id, text: r.text, date, ackedBy: auth.currentUser.email, ackedAt: new Date().toISOString() });
