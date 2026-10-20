# Statewide: Pawn & Firearms Retail Platform

Vanilla HTML/CSS/JS, no build step. Backend: Firestore + Auth + Storage (not yet wired).

- `js/config.js`: all shop and legal parameters. Every legal value is flagged VERIFY.
- `js/loan-engine.js`: pawn loan math (integer cents), pure and tested.
- `index.html`: hub scaffold (placeholder flows).
- `firestore.rules`: access-control skeleton.

Run tests: `npm test` (Node 20+, no dependencies).

This software supports recordkeeping; it does not by itself make a shop legally compliant.
