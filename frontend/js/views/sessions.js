/**
 * Sessions view
 */

import { API } from '../api.js';
import { state } from '../state.js';
import { $, $$, escapeHtml } from '../utils.js';
import { canAcceptRejectSession, canCompleteSession, canLeaveFeedback } from '../permissions.js';

export async function loadSessions() {
  const { sessions } = await API.listSessions();
  state.sessions = sessions || [];
  renderSessions();
}

export function renderSessions() {
  const container = $('#sessionsList');
  const emptyState = $('#sessionsEmpty');

  if (!container) return;

  let filteredSessions = state.sessions;
  if (state.currentSessionTab !== 'all') {
    filteredSessions = state.sessions.filter((s) => s.status === state.currentSessionTab);
  }

  if (filteredSessions.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  const user = state.user;

  container.innerHTML = filteredSessions
    .map((session) => {
      const isMentor = session.mentor?.id === user?.id;
      const otherUser = isMentor ? session.requester : session.mentor;
      const canAcceptReject = canAcceptRejectSession(user, session);
      const canComplete = canCompleteSession(user, session) && session.status !== 'completed';
      const canFeedback = canLeaveFeedback(session);

      const scheduledTime = session.scheduled_time
        ? new Date(session.scheduled_time).toLocaleString()
        : 'Not scheduled';

      const meetingLinkHtml = session.meeting_link
        ? `<div class="session-meeting-link">
             <strong>Meeting Link:</strong>
             <a href="${escapeHtml(session.meeting_link)}" target="_blank" rel="noopener noreferrer" class="link-primary">Join Meeting →</a>
           </div>`
        : '';

      return `
        <div class="session-card">
          <div class="session-header">
            <div>
              <div class="session-title">${escapeHtml(session.topic)}</div>
              <div class="session-meta">
                With ${escapeHtml(otherUser?.name || 'Unknown')} • ${scheduledTime}
              </div>
            </div>
            <span class="badge badge-${session.status}">${session.status.toUpperCase()}</span>
          </div>
          <div class="session-description">${escapeHtml(session.description || 'No description provided.')}</div>
          ${meetingLinkHtml}
          <div class="session-actions">
            ${canAcceptReject ? `
              <button class="btn btn-primary" data-action="accept-session" data-session-id="${session.id}">Accept</button>
              <button class="btn btn-outline" data-action="reject-session" data-session-id="${session.id}">Reject</button>
            ` : ''}
            ${canComplete ? `<button class="btn btn-outline" data-action="complete-session" data-session-id="${session.id}">Mark Completed</button>` : ''}
            ${canFeedback ? `<button class="btn btn-primary" data-action="leave-feedback" data-session-id="${session.id}" data-other-name="${escapeHtml(otherUser?.name || '')}">Leave Feedback</button>` : ''}
          </div>
        </div>
      `;
    })
    .join('');
}
