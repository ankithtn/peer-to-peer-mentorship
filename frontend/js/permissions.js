/**
 * Role and permission helpers (single source of truth for RBAC)
 */

export function getRoleFlags(user) {
  if (!user?.role) return { isMentor: false, isMentee: false };
  const r = user.role.toLowerCase();
  return {
    isMentor: r === 'mentor' || r === 'both',
    isMentee: r === 'mentee' || r === 'both',
  };
}

export function canAcceptRejectSession(user, session) {
  if (!user || !session) return false;
  return session.mentor?.id === user.id && session.status === 'pending';
}

export function canCompleteSession(user, session) {
  if (!user || !session) return false;
  return (
    (session.status === 'accepted' || session.status === 'completed') &&
    session.requester?.id === user.id
  );
}

export function canLeaveFeedback(session) {
  return session?.status === 'completed';
}
