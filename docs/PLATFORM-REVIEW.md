# AZ Pawn of Salem platform: review guide

Everything below is built and tested in a browser against a fake Firebase. **Nothing has been tested against the live Firebase security rules**
(see "Not yet tested"). This software supports good recordkeeping; it does not by itself make the shop legally compliant.

## 1. Screens and who can use them

| Screen | File | Staff | Manager | Owner |
|---|---|:-:|:-:|:-:|
| Home hub (alerts, reminders, messages, time clock) | `index.html` | yes | yes | yes |
| PAWN: issue a loan, print ticket | `pawn.html` | yes | yes | yes |
| LOANS: redeem, renew, reprint | `loans.html` | yes | yes | yes |
| Forfeit a loan to inventory | `loans.html` | no | yes | yes |
| BUY: purchase with receipt | `buy.html` | yes | yes | yes |
| SELL: retail sale, tax, change, scan | `sell.html` | yes | yes | yes |
| INVENTORY | `inventory.html` | add/view (no cost shown) | edit, release holds | all |
| CUSTOMERS (ID capture, detail) | `customers.html` | yes (sees ID number) | yes | yes + flags + ID photos |
| FIREARMS: A&D book, 4473/NICS, transfers | `firearms.html` | yes | yes | yes |
| Print tags (barcodes) | `tags.html` | yes | yes | yes |
| Time clock | `timeclock.html` | own shifts | all shifts, corrections | all |
| Messages | `messages.html` | yes | yes | yes |
| Briefing, Report of the Day | `briefing.html`, `daily.html` | no | yes | yes |
| Reports & insights (loans, inventory, sales, customers, employees) | `reports.html` | no | yes | yes |
| Cash management (counts, expenses) | `cash.html` | no | yes | yes |
| Reminders (set up) | `reminders.html` | no | yes | yes |
| Police-report queue | `compliance.html` | no | yes | yes |
| Live dashboard (installable) | `owner-live.html` | no | yes | yes |
| Settings | `settings.html` | no | no | yes (PIN) |

The owner area on the hub is PIN-protected (6 digits, salted hash, lockout after 5 wrong tries, relocks after 10 idle minutes).

## 2. Money and loan rules (all from Settings; nothing hardcoded)

- Interest, term, accrual mode, grace days, renewals: **Settings > Pawn loan terms**. Defaults match the owner's Nov 1 example
  ($100 -> $125 Dec 1 -> $150 Jan 1; defaults Jan 2). Each loan keeps the terms it was issued under.
- Tax rate: **Settings > Shop**. Tax is computed on the sale subtotal, rounded half-up to the cent.
- All dates use **Eastern time**, never the device's UTC date.
- Every money event is a permanent `transactions` record (loan-out, redemption, renewal, buy, sale, expense, payout).

## 3. VERIFY checklist (owner + Connecticut attorney + ATF guidance)

None of these is a confirmed legal value. Each is blank or a flagged default until you set and verify it in **Settings**.

| # | Item | Where | Default now |
|---|---|---|---|
| 1 | Interest rate per month | Settings > Loan terms | 25% (owner's figure; unverified) |
| 2 | Loan term, grace days, renewals allowed | Settings > Loan terms | 2 months, 0 days, no limit |
| 3 | Accrual method (completed vs started month vs per-day) | Settings > Loan terms | completed month (matches the owner's example) |
| 4 | Forfeited-item cost basis (principal only vs plus fees) | code: `forfeitureCostBasis` | principal, split evenly across items |
| 5 | Pawn ticket legal disclosure text | Settings > Ticket | empty (red placeholder prints) |
| 6 | Purchase receipt seller statement | Settings > Ticket | empty (red placeholder prints) |
| 7 | Shop address, pawn license #, FFL # | Settings > Shop | empty |
| 8 | Sales tax rate and rounding method | Settings > Shop | empty (sales warn about $0 tax) |
| 9 | Resale hold period (days) | Settings > Compliance | empty (items stay On hold until a manager releases them) |
| 10 | Minimum age to pawn / sell to the shop | Settings > Compliance | not enforced |
| 11 | Police reporting: who must be reported, when, in what format | `compliance.html` | generic CSV; vendor format not mapped |
| 12 | Firearm transfer checklist (e.g. CT permit, waiting period) | Settings > Firearms | empty |
| 13 | Minimum buyer age: handgun / long gun | Settings > Firearms | not enforced |
| 14 | Multiple-handgun alert window | Settings > Firearms | off |
| 15 | Whether pawned firearms returned to the customer need a transfer record | Settings > Firearms | yes (conservative) |
| 16 | A&D firearm type list and entry fields vs the format you must keep | `js/config.js` `firearms.types`, A&D form | generic ATF-style fields |
| 17 | Record retention periods | not built | n/a |

Printed tickets and receipts carry a red **DRAFT** banner until Settings has the license, address, disclosure text and receipt statement filled in
and "Ticket and receipt content verified" is ticked. The A&D/transfer screens show a banner until "Firearms settings verified" is ticked.

## 4. Firearms: what the app does and does not do

Does: builds an append-only A&D book (sequential entry numbers, one disposition per firearm), records Form 4473 completion, the NICS result and
transaction number, your own required-steps checklist, an optional 4473 photo, and blocks a transfer unless NICS = Proceed. The database rules
refuse to mark a firearm sold (or return a pawned firearm) without a matching "Proceed" transfer record written in the same transaction.
Blocked checks (Denied/Delayed/Cancelled) are logged. A&D book exports to CSV and prints.

Does not: replace Form 4473, run the NICS check, decide what the law requires, handle trade-ins, layaways, multi-firearm pawn returns
(a loan with more than one firearm must be completed in your existing process), correction entries, or ATF reporting forms.

## 5. Data model (Firestore collections)

`customers` (staff-visible profile) and `customerIds` (full ID; staff may read, owner may edit); `items`; `loans`; `purchases`; `sales`; `transactions`
(append-only); `adBook`, `firearmTransfers`, `firearmChecks` (append-only); `counters` (ticket/receipt/A&D numbers); `config/settings` + `settingsLog`;
`roles` (who is owner/manager/staff, set in the console); `pins` (own PIN only); `timeEntries`; `drawerCounts`; `messages`; `reminders`, `reminderLog`.
Storage: `customers/*` ID photos (owner only), `items/*` photos (staff), `firearms/*` 4473 scans (owner/manager).

## 6. Known limits (honest list)

- **Online only for transactions.** Issuing loans, buying, selling and firearm transfers use database transactions (unique numbers, no double sales),
  so they need a connection. The app shell loads offline (installable PWA) but a full offline write outbox is **not** built.
- **Cost hiding is UI-level.** Staff screens hide cost and margin, but cost is stored on items and sale lines the rules let staff read.
  A determined employee using browser tools could see it. Splitting costs into an owner-only collection is the fix if that matters.
- **Roles are one per account.** A shared counter login means one identity for the time clock and attribution; give each employee their own account.
- **Per-item tax exemptions, layaway, trade-ins, returns/voids, partial loan payments, multi-location** are not built.
- **Camera barcode scanning of licenses** depends on the browser (built-in detector on Android/Chrome/Mac; a library fallback elsewhere). A handheld scanner is the reliable path.
- **Reports** read up to 2,000 records per collection; a large history would need paging or server-side rollups.
- **Marketing/CRM contact tools**, SMS/email, customer-facing screens: not built.
- Public GitHub repo while building: history is permanently public; keep real data and legal text out until it is private again.

## 7. Not yet tested

- Firestore and Storage security rules against a real project (they are written carefully but only reviewed by reading, not run in the emulator).
- Real camera scanning of a driver's license; a real label printer; a real receipt printer.
- Everything on an actual tablet at the counter, and on slow connections.
- Behavior with more than a few hundred records.

## 8. Deploying and turning it on (owner checklist)

1. Publish `firestore.rules` (Firestore > Rules) and `storage.rules` (Storage > Rules) every time they change.
2. Authentication: Email/Password on, self sign-up off. Create each employee; add a `roles/{uid}` document with `role` = owner / manager / staff.
3. Settings: fill the shop block first, then work down the VERIFY checklist above with counsel.
4. Install the app on tablets (browser menu > Install) and the Live dashboard on the owner's phone.
5. Run the print tests: a pawn ticket, a buy receipt, a sales receipt, a tag, on the real printers.

## 9. Tests

`npm test` runs 70+ automated tests: loan math (owner's worked example), settings validation, seller checks, firearm checks, alerts, reports and
scorecards, cash, messages, reminders, police CSV, barcode encoding, dates. Browser tests (fake Firebase + fake camera) cover every screen flow.
