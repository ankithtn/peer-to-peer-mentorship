/**
 * Application state
 */

import { $, initials, getAvatarColor } from './utils.js';

export const state = {
  user: null,
  currentView: 'dashboard',
  sessions: [],
  mentors: [],
  currentSessionTab: 'all',
};

export function updateUserProfile(user) {
  state.user = user;
  const avatar = $('#userAvatar');
  const nameEl = $('#userName');
  const roleEl = $('#userRole');
  if (avatar) {
    avatar.textContent = initials(user?.name);
    avatar.style.backgroundColor = getAvatarColor(user?.id);
    avatar.style.color = '#374151';
  }
  if (nameEl) nameEl.textContent = user?.name ?? '—';
  if (roleEl) roleEl.textContent = user?.role ?? '—';
}
