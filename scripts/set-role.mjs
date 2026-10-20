// One-time/occasional admin script: grant a role to a Firebase user.
// Usage: GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/set-role.mjs user@email.com owner
// Needs `npm i firebase-admin` (kept out of the app, which has no build step).
// Run on your own machine; never commit or paste the key file.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [email, role] = process.argv.slice(2);
if (!email || !['owner', 'manager', 'staff'].includes(role)) {
  console.error('Usage: node scripts/set-role.mjs <email> <owner|manager|staff>'); process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId: 'statewide-pawn' });
const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { role });
console.log(`Set role "${role}" for ${email}. They must sign out and back in.`);
