// Owner <-> counter messages (pure). audience: 'all' (everyone) or 'managers' (owner/manager only).
const isMgr = (role) => role === 'owner' || role === 'manager';
export const visibleTo = (msg, role) => msg.audience === 'all' || isMgr(role);
export const unreadCount = (msgs, uid, role) => msgs.filter((m) => visibleTo(m, role) && m.fromUid !== uid && !(m.readBy || []).includes(uid)).length;
export const audienceFor = (role, choice) => (isMgr(role) ? (choice === 'managers' ? 'managers' : 'all') : choice === 'all' ? 'all' : 'managers');
