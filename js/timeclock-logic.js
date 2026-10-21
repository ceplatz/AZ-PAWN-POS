// Time clock math (pure). Entries: { employeeEmail, date, inAt (ISO), outAt (ISO|null) }.
export const hoursBetween = (inAt, outAt) => Math.max(0, (Date.parse(outAt) - Date.parse(inAt)) / 3600000);
export const openEntry = (entries, uid) => entries.find((e) => e.employeeUid === uid && !e.outAt) || null;

/** Hours per employee in [from, to] (by entry date). Open entries count up to `nowIso` and are flagged. */
export function hoursByEmployee(entries, from, to, nowIso = new Date().toISOString()) {
  const out = {};
  for (const e of entries.filter((x) => x.date >= from && x.date <= to)) {
    const o = (out[e.employeeEmail] ||= { email: e.employeeEmail, hours: 0, shifts: 0, open: false });
    o.hours += hoursBetween(e.inAt, e.outAt || nowIso); o.shifts++; if (!e.outAt) o.open = true;
  }
  return Object.values(out).sort((a, b) => b.hours - a.hours);
}
export const fmtHours = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
/** Entries that look wrong: a shift over `maxHours` (probably forgot to clock out). */
export const suspicious = (entries, nowIso, maxHours = 14) => entries.filter((e) => hoursBetween(e.inAt, e.outAt || nowIso) > maxHours);
