// Pure "Report of the Day": money events for one date, from the transactions records. Money in cents.
const blank = () => ({ count: 0, amount: 0 });
const add = (o, amt) => { o.count++; o.amount += amt; };
const METHODS = ['cash', 'card'];

export function dailyReport(txs, date) {
  const day = txs.filter((t) => t.date === date);
  const r = { date, sales: { ...blank(), subtotal: 0, tax: 0, byMethod: {} }, buys: blank(), loansOut: blank(), redemptions: { ...blank(), principal: 0, interest: 0 }, renewals: blank(),
    expenses: blank(), payouts: blank(), cash: { in: 0, out: 0, net: 0 }, card: { in: 0, out: 0, net: 0 }, byEmployee: {}, transactions: day.length };
  const emp = (t) => (r.byEmployee[t.employeeEmail || 'unknown'] ||= { sales: blank(), buys: blank(), loansOut: blank(), redemptions: blank(), renewals: blank() });
  for (const t of day) {
    const m = METHODS.includes(t.method) ? t.method : 'card', amt = t.amount || 0, bucket = r[m];
    switch (t.type) {
      case 'sale': add(r.sales, amt); r.sales.subtotal += t.subtotal || 0; r.sales.tax += t.tax || 0; r.sales.byMethod[t.method] = (r.sales.byMethod[t.method] || 0) + amt; add(emp(t).sales, amt); bucket.in += amt; break;
      case 'redemption': add(r.redemptions, amt); r.redemptions.principal += t.principal || 0; r.redemptions.interest += t.interest || 0; add(emp(t).redemptions, amt); bucket.in += amt; break;
      case 'renewal': add(r.renewals, amt); add(emp(t).renewals, amt); bucket.in += amt; break;
      case 'buy': add(r.buys, amt); add(emp(t).buys, amt); bucket.out += amt; break;
      case 'loan-out': add(r.loansOut, amt); add(emp(t).loansOut, amt); bucket.out += amt; break;
      case 'expense': add(r.expenses, amt); bucket.out += amt; break;
      case 'payout': add(r.payouts, amt); bucket.out += amt; break;
      default: break;
    }
  }
  r.cash.net = r.cash.in - r.cash.out; r.card.net = r.card.in - r.card.out;
  r.interestIncome = r.redemptions.interest + r.renewals.amount;
  return r;
}
