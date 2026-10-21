// Printable pawn ticket. Prints clearly as a DRAFT until the owner/counsel have verified the legal content.
import { CONFIG } from './config.js';
import { maturityDate, forfeitureDate } from './loan-engine.js';
import { fmtMoney } from './item-logic.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const us = (d) => (d ? `${d.slice(5, 7)}/${d.slice(8)}/${d.slice(0, 4)}` : '');

export function ticketHtml({ loan, customer, ids = {}, cfg = CONFIG }) {
  const t = loan.terms, a = customer.address || {}, s = cfg.shop;
  const draft = !cfg.compliance.verified, noText = !cfg.ticket.disclosureText.trim();
  const missing = (v, label) => (v ? esc(v) : `<b class="warn">[${label} not set]</b>`);
  return `<div class="ticket">
    ${draft ? '<p class="draft">DRAFT: NOT VERIFIED FOR LEGAL USE. Owner and counsel must review this form before it is given to a customer.</p>' : ''}
    <h1>${esc(s.name)}</h1>
    <p>${missing(s.address, 'shop address')} &middot; Pawn license: ${missing(s.licenseNumbers.pawn, 'license #')}</p>
    <h2>PAWN TICKET #${loan.ticketNumber}</h2>
    <table>
      <tr><th>Date</th><td>${us(loan.originDate)}</td><th>Employee</th><td>${esc(loan.createdByEmail || '')}</td></tr>
      <tr><th>Customer</th><td>${esc(customer.firstName)} ${esc(customer.middleName || '')} ${esc(customer.lastName)}</td><th>DOB</th><td>${us(customer.dob)}</td></tr>
      <tr><th>Address</th><td colspan="3">${esc(a.street)}, ${esc(a.city)}, ${esc(a.state)} ${esc(a.zip)}</td></tr>
      <tr><th>ID</th><td colspan="3">${esc(ids.idType)} ${esc(ids.idNumber)} (${esc(ids.idState)}) exp ${us(ids.idExpiry)}</td></tr>
    </table>
    <h3>Collateral</h3>
    <table class="items"><tr><th>#</th><th>Description</th><th>Brand / model</th><th>Serial</th></tr>
      ${loan.itemSummaries.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.title)} (${esc(i.category)})</td><td>${esc(`${i.brand} ${i.model}`.trim())}</td><td>${esc(i.serial)}</td></tr>`).join('')}
    </table>
    <table>
      <tr><th>Amount loaned</th><td>${fmtMoney(loan.principal)}</td><th>Interest</th><td>${(t.monthlyRate * 100).toFixed(2).replace(/\.00$/, '')}% per month</td></tr>
      <tr><th>Maturity date</th><td>${us(maturityDate(loan, t))}</td><th>Forfeited after</th><td>${us(forfeitureDate(loan, t))}</td></tr>
    </table>
    <div class="disc"><h3>Disclosures</h3>${noText ? '<p class="warn"><b>[REQUIRED STATE DISCLOSURES NOT CONFIGURED: VERIFY WITH COUNSEL]</b></p>' : `<p>${esc(cfg.ticket.disclosureText)}</p>`}</div>
    <p class="sig">Customer signature: ______________________________ &nbsp; Date: ____________</p>
  </div>`;
}

/** Shared print stylesheet (screen-hidden; on print only the ticket shows). */
export const TICKET_CSS = `
  #printArea { display:none; }
  @media print { body > *:not(#printArea) { display:none !important; } #printArea { display:block !important; }
    body { background:#fff !important; } .ticket, .ticket * { color:#000 !important; } }
  .ticket { font:13px/1.4 Arial,sans-serif; max-width:720px; margin:0 auto; padding:16px; background:#fff; color:#000; }
  .ticket h1 { margin:0; text-align:center; font-size:22px; } .ticket h2 { text-align:center; margin:6px 0 10px; } .ticket h3 { margin:12px 0 4px; font-size:14px; }
  .ticket p { margin:4px 0; } .ticket table { width:100%; border-collapse:collapse; margin:6px 0; }
  .ticket th, .ticket td { border:1px solid #444; padding:5px 7px; text-align:left; vertical-align:top; } .ticket th { background:#eee; width:16%; }
  .ticket .draft { border:2px solid #b00; font-weight:bold; padding:6px; text-align:center; } .ticket .warn { color:#b00 !important; }
  .ticket .sig { margin-top:26px; }`;
