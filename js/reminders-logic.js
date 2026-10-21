// Recurring staff reminders (pure). reminder: { id, text, time:'HH:MM', days:[0-6] (0=Sunday; empty = every day), active }.
// log entries are keyed `${date}_${reminderId}` once acknowledged.
export function nowET(now = new Date(), tz = 'America/New_York') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(now).map((p) => [p.type, p.value]));
  const date = now.toLocaleDateString('en-CA', { timeZone: tz }), h = parts.hour === '24' ? '00' : parts.hour;
  return { date, time: `${h}:${parts.minute}`, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday) };
}
export const logKey = (date, id) => `${date}_${id}`;
export function dueReminders(reminders, ackedKeys, { date, time, weekday }) {
  const acked = new Set(ackedKeys);
  return reminders.filter((r) => r.active !== false && (!r.days?.length || r.days.includes(weekday)) && r.time <= time && !acked.has(logKey(date, r.id)));
}
export const validReminder = (r) => (!String(r.text ?? '').trim() ? 'Enter the reminder text.' : !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time || '') ? 'Choose a time.' : null);
