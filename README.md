# AZ Pawn of Salem: Pawn & Firearms Retail Platform

Vanilla HTML/CSS/JS (no build step) on Firebase (Firestore, Auth, Storage), hosted on GitHub Pages. Installable PWA.

**Start with `docs/PLATFORM-REVIEW.md`**: screens by role, the legal VERIFY checklist, firearms scope, known limits, and the owner's turn-on checklist.

- `js/config.js`: defaults for every shop and legal parameter (overridden by Settings in the app). Every legal value is flagged VERIFY.
- `js/*-logic.js`: pure, tested logic (loans, sales, firearms, alerts, reports, cash, ...).
- `firestore.rules`, `storage.rules`: access control source of truth. Publish them after every change.
- Run tests: `npm test` (Node 20+, no dependencies).

This software supports recordkeeping; it does not by itself make a shop legally compliant.
