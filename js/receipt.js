// Printable purchase receipt. Prints as a DRAFT until the owner has verified ticket/receipt content in Settings.
import { CONFIG } from './config.js';
import { fmtMoney } from './item-logic.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const us = (d) => (d ? `${d.slice(5, 7)}/${d.slice(8)}/${d.slice(0, 4)}` : '');

export function buyReceiptHtml({ purchase: p, customer, ids = {}, cfg = CONFIG }) {
  const a = customer.address || {}, s = cfg.shop, draft = !cfg.compliance.verified, noText = !cfg.ticket.receiptStatement.trim();
  const missing = (v, label) => (v ? esc(v) : `<b class="warn">[${label} not set]</b>`);
  const hold = (i) => (i.holdUntil ? `Held until ${us(i.holdUntil)}` : i.status === 'on-hold' ? '<b class="warn">hold period not set</b>' : 'No hold');
  return `<div class="ticket">
    ${draft ? '<p class="draft">DRAFT: NOT VERIFIED FOR LEGAL USE. Owner and counsel must review this form before it is given to a customer.</p>' : ''}
    <h1>${esc(s.name)}</h1>
    <p>${missing(s.address, 'shop address')} &middot; License: ${missing(s.licenseNumbers.pawn, 'license #')}</p>
    <h2>PURCHASE RECEIPT #${p.receiptNumber}</h2>
    <table>
      <tr><th>Date</th><td>${us(p.date)}</td><th>Employee</th><td>${esc(p.createdByEmail || '')}</td></tr>
      <tr><th>Seller</th><td>${esc(customer.firstName)} ${esc(customer.middleName || '')} ${esc(customer.lastName)}</td><th>DOB</th><td>${us(customer.dob)}</td></tr>
      <tr><th>Address</th><td colspan="3">${esc(a.street)}, ${esc(a.city)}, ${esc(a.state)} ${esc(a.zip)}</td></tr>
      <tr><th>ID</th><td colspan="3">${esc(ids.idType)} ${esc(ids.idNumber)} (${esc(ids.idState)}) exp ${us(ids.idExpiry)}</td></tr>
    </table>
    <h3>Items purchased</h3>
    <table class="items"><tr><th>#</th><th>Description</th><th>Serial</th><th>Resale hold</th><th>Price paid</th></tr>
      ${p.itemSummaries.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.title)} (${esc(i.category)})${i.brand || i.model ? '<br>' + esc(`${i.brand} ${i.model}`.trim()) : ''}</td><td>${esc(i.serial)}</td><td>${hold(i)}</td><td>${fmtMoney(i.price)}</td></tr>`).join('')}
      <tr><th colspan="4" style="text-align:right">TOTAL PAID (${esc(p.method)})</th><td><b>${fmtMoney(p.total)}</b></td></tr>
    </table>
    <div class="disc"><h3>Seller statement</h3>${noText ? '<p class="warn"><b>[SELLER OWNERSHIP STATEMENT NOT CONFIGURED: VERIFY WITH COUNSEL]</b></p>' : `<p>${esc(cfg.ticket.receiptStatement)}</p>`}</div>
    <p class="sig">Seller signature: ______________________________ &nbsp; Date: ____________</p>
  </div>`;
}

/** Retail sale receipt (no DRAFT banner; missing shop info is shown as red placeholders). */
export function saleReceiptHtml({ sale: x, customer = null, cfg = CONFIG }) {
  const s = cfg.shop, missing = (v, label) => (v ? esc(v) : `<b class="warn">[${label} not set]</b>`);
  const rate = x.taxRate == null ? '<b class="warn">[tax rate not set]</b>' : `${(x.taxRate * 100).toFixed(3).replace(/\.?0+$/, '')}%`;
  return `<div class="ticket">
    <h1>${esc(s.name)}</h1>
    <p>${missing(s.address, 'shop address')}${s.phone ? ' &middot; ' + esc(s.phone) : ''}</p>
    <h2>SALES RECEIPT #${x.receiptNumber}</h2>
    <table><tr><th>Date</th><td>${us(x.date)}</td><th>Cashier</th><td>${esc(x.createdByEmail || '')}</td></tr>
      ${customer ? `<tr><th>Customer</th><td colspan="3">${esc(customer.firstName)} ${esc(customer.lastName)}</td></tr>` : ''}</table>
    <table class="items"><tr><th>#</th><th>Item</th><th>Serial</th><th>Price</th></tr>
      ${x.lines.map((l, n) => `<tr><td>${n + 1}</td><td>${esc(l.title)}</td><td>${esc(l.serial)}</td><td>${fmtMoney(l.price)}</td></tr>`).join('')}
      <tr><th colspan="3" style="text-align:right">Subtotal</th><td>${fmtMoney(x.subtotal)}</td></tr>
      <tr><th colspan="3" style="text-align:right">Sales tax (${rate})</th><td>${fmtMoney(x.tax)}</td></tr>
      <tr><th colspan="3" style="text-align:right">TOTAL (${esc(x.method)})</th><td><b>${fmtMoney(x.total)}</b></td></tr>
      ${x.tendered != null ? `<tr><th colspan="3" style="text-align:right">Cash tendered</th><td>${fmtMoney(x.tendered)}</td></tr><tr><th colspan="3" style="text-align:right">Change</th><td>${fmtMoney(x.tendered - x.total)}</td></tr>` : ''}
    </table>
    <p>Thank you for shopping at ${esc(s.name)}.</p>
  </div>`;
}
