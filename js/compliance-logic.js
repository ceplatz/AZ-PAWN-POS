// Police / stolen-property reporting queue (pure). The exact required fields and the reporting vendor's import format
// (LeadsOnline, BWI, local PD...) are NOT confirmed: this builds a generic, complete CSV; map it to the vendor format after verifying.
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** records: purchases and loans with policeReport.status === 'pending'. */
export const pending = (purchases, loans) => [
  ...purchases.filter((p) => p.policeReport?.status === 'pending').map((p) => ({ kind: 'buy', ref: `Receipt ${p.receiptNumber}`, date: p.date, customerId: p.customerId, customerName: p.customerName, amount: p.total, items: p.itemSummaries, source: p })),
  ...loans.filter((l) => l.policeReport?.status === 'pending').map((l) => ({ kind: 'pawn', ref: `Ticket ${l.ticketNumber}`, date: l.issuedDate || l.originDate, customerId: l.customerId, customerName: l.customerName, amount: l.principal, items: l.itemSummaries, source: l })),
].sort((a, b) => (a.date < b.date ? -1 : 1));

/** One CSV row per item (what reporting services want: person + ID + item + serial). */
export function reportCsv(records, people) {
  const head = ['Type', 'Reference', 'Date', 'Amount', 'Last name', 'First name', 'DOB', 'Address', 'ID type', 'ID number', 'ID state', 'Item', 'Category', 'Brand', 'Model', 'Serial'];
  const rows = records.flatMap((r) => { const c = people[r.customerId] || {}, a = c.address || {}, i = c.ids || {};
    return (r.items?.length ? r.items : [{}]).map((it) => [r.kind === 'buy' ? 'Purchase' : 'Pawn', r.ref, r.date, (r.amount / 100).toFixed(2), c.lastName, c.firstName, c.dob, [a.street, a.city, a.state, a.zip].filter(Boolean).join(', '), i.idType, i.idNumber, i.idState, it.title, it.category, it.brand, it.model, it.serial]); });
  return [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}
