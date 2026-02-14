/**
 * Dashboard view: role-based content (mentor / mentee / both)
 */

import { API } from '../api.js';
import { state } from '../state.js';
import { $, $$, escapeHtml, showLoading, hideLoading } from '../utils.js';
import { getRoleFlags } from '../permissions.js';

function renderSessionCard(session, showActions) {
  const otherUser = session.requester;
  const canAcceptReject = showActions && session.status === 'pending';

  return `
    <div class="session-card">
      <div class="session-header">
        <div>
          <div class="session-title">${escapeHtml(session.topic)}</div>
          <div class="session-meta">
            From ${escapeHtml(otherUser?.name || 'Unknown')}
            ${session.scheduled_time ? ' • ' + new Date(session.scheduled_time).toLocaleString() : ''}
          </div>
        </div>
        <span class="badge badge-${session.status}">${session.status.toUpperCase()}</span>
      </div>
      <div class="session-description">${escapeHtml(session.description || 'No description provided.')}</div>
      ${canAcceptReject ? `
        <div class="session-actions">
          <button class="btn btn-primary" data-action="accept-session" data-session-id="${session.id}">Accept</button>
          <button class="btn btn-outline" data-action="reject-session" data-session-id="${session.id}">Reject</button>
        </div>
      ` : ''}
    </div>
  `;
}

export async function loadDashboard() {
  const sessionsRes = await API.listSessions();
  const sessions = sessionsRes.sessions || [];
  state.sessions = sessions;

  const user = state.user;
  if (!user) return;

  const { isMentor, isMentee } = getRoleFlags(user);

  let pending = 0;
  let completed = 0;
  const incomingRequests = [];
  const sentRequests = [];

  sessions.forEach((s) => {
    if (s.status === 'pending') pending++;
    if (s.status === 'completed') completed++;
    if (s.mentor?.id === user.id) {
      incomingRequests.push(s);
    } else {
      sentRequests.push(s);
    }
  });

  const statTotal = $('#statTotalSessions');
  const statPending = $('#statPending');
  const statCompleted = $('#statCompleted');
  if (statTotal) statTotal.textContent = sessions.length;
  if (statPending) statPending.textContent = pending;
  if (statCompleted) statCompleted.textContent = completed;

  const dashboardContent = $('#dashboardContent');
  if (!dashboardContent) return;

  const emptyActivity = '<p class="empty-activity">No activity yet</p>';

  if (isMentor && isMentee) {
    dashboardContent.innerHTML = `
      <div class="dashboard-section">
        <h2 class="section-heading">Incoming Session Requests</h2>
        <div class="sessions-list" id="incomingRequests">
          ${incomingRequests.length === 0 ? `
            <div class="empty-state">
              <p>No incoming requests</p>
            </div>
          ` : incomingRequests.slice(0, 5).map((s) => renderSessionCard(s, true)).join('')}
        </div>
      </div>
      <div class="dashboard-section">
        <h2 class="section-heading">My Session Requests</h2>
        <div class="sessions-list" id="sentRequests">
          ${sentRequests.length === 0 ? `
            <div class="empty-state">
              <p>You haven't requested any sessions yet</p>
              <button class="btn btn-primary" data-view="browse">Browse Mentors</button>
            </div>
          ` : sentRequests.slice(0, 5).map((s) => renderSessionCard(s, false)).join('')}
        </div>
      </div>
      <div class="dashboard-section">
        <h2 class="section-heading">Recent Activity</h2>
        <div class="activity-list">
          ${sessions.length === 0 ? emptyActivity : sessions.slice(0, 5).map((s) => `
            <div class="activity-item">
              <div class="activity-row">
                <div>
                  <strong>${escapeHtml(s.topic)}</strong>
                  <div class="activity-meta">With ${escapeHtml(s.requester?.name || 'Unknown')}</div>
                </div>
                <span class="badge badge-${s.status}">${s.status.toUpperCase()}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (isMentor) {
    dashboardContent.innerHTML = `
      <div class="dashboard-section">
        <h2 class="section-heading">Incoming Session Requests</h2>
        <div class="sessions-list" id="incomingRequests">
          ${incomingRequests.length === 0 ? `
            <div class="empty-state"><p>No incoming requests</p></div>
          ` : incomingRequests.slice(0, 5).map((s) => renderSessionCard(s, true)).join('')}
        </div>
      </div>
      <div class="dashboard-section">
        <h2 class="section-heading">Recent Activity</h2>
        <div class="activity-list">
          ${sessions.length === 0 ? emptyActivity : sessions.slice(0, 5).map((s) => `
            <div class="activity-item">
              <div class="activity-row">
                <div>
                  <strong>${escapeHtml(s.topic)}</strong>
                  <div class="activity-meta">With ${escapeHtml(s.requester?.name || 'Unknown')}</div>
                </div>
                <span class="badge badge-${s.status}">${s.status.toUpperCase()}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    dashboardContent.innerHTML = `
      <div class="dashboard-section">
        <h2 class="section-heading">My Session Requests</h2>
        <div class="sessions-list" id="sentRequests">
          ${sentRequests.length === 0 ? `
            <div class="empty-state">
              <p>You haven't requested any sessions yet</p>
              <button class="btn btn-primary" data-view="browse">Browse Mentors</button>
            </div>
          ` : sentRequests.slice(0, 5).map((s) => renderSessionCard(s, false)).join('')}
        </div>
      </div>
      <div class="dashboard-section">
        <h2 class="section-heading">Suggested Mentors</h2>
        <div class="mentor-suggestions">
          <p class="suggestions-cta">
            <button class="btn btn-primary" data-view="browse">Find Mentors</button>
          </p>
        </div>
      </div>
    `;
  }
}
