/**
 * Session, request, feedback modals and action handlers
 */

import { API } from './api.js';
import { state } from './state.js';
import { $, $$, showModal, closeModal, setFormMessage, showToast, showLoading, hideLoading, escapeHtml, initials, getAvatarColor } from './utils.js';
import { loadSessions } from './views/sessions.js';
import { loadDashboard } from './views/dashboard.js';

let onSwitchView = () => {};

export function setSessionActionDeps(deps) {
  onSwitchView = deps.switchView || (() => {});
}

export function handleRequestSession(mentorId) {
  const mentor = state.mentors.find((m) => m.id === Number(mentorId));
  if (!mentor) return;

  const el = $('#requestMentorInfo');
  if (el) {
    const avatarColor = getAvatarColor(mentor.id);
    el.innerHTML = `
      <div class="request-mentor-preview">
        <div class="mentor-avatar" style="width: 48px; height: 48px; font-size: 1.125rem; background-color: ${avatarColor}; color: #374151;">${initials(mentor.name)}</div>
        <div>
          <div class="request-mentor-name">${escapeHtml(mentor.name)}</div>
          <div class="request-mentor-role">${escapeHtml(mentor.role)}</div>
        </div>
      </div>
    `;
  }

  const form = $('#formRequest');
  if (form) {
    form.mentor_id.value = mentor.id;
    form.topic.value = '';
    form.description.value = '';
    form.scheduled_time.value = '';
  }

  showModal('requestModal');
}

export async function handleSubmitRequest(e) {
  e.preventDefault();
  setFormMessage('requestMessage', '');

  try {
    showLoading();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);

    payload.mentor_id = Number(payload.mentor_id);
    if (!payload.scheduled_time) delete payload.scheduled_time;

    await API.createSession(payload);
    closeModal('requestModal');
    showToast('Session request sent!', 'success');
    onSwitchView('sessions');
  } catch (err) {
    setFormMessage('requestMessage', err.message || 'Failed to send request');
  } finally {
    hideLoading();
  }
}

export async function handleSessionStatusUpdate(sessionId, status) {
  try {
    if (status === 'accepted') {
      const sid = $('#meetingLinkSessionId');
      const input = $('#meetingLinkInput');
      if (sid) sid.value = sessionId;
      if (input) input.value = '';
      showModal('meetingLinkModal');
      return;
    }

    showLoading();
    await API.updateSessionStatus(sessionId, status, '');
    await loadSessions();

    showToast(status === 'rejected' ? 'Session rejected.' : 'Session marked as completed!', 'success');

    if (state.currentView === 'dashboard') {
      await loadDashboard();
    }
  } catch (err) {
    showToast(err.message || 'Failed to update session', 'error');
  } finally {
    hideLoading();
  }
}

export async function handleMeetingLinkSubmit(e) {
  e.preventDefault();

  try {
    showLoading();
    const sessionId = $('#meetingLinkSessionId')?.value;
    const meetingLink = ($('#meetingLinkInput')?.value || '').trim();

    await API.updateSessionStatus(sessionId, 'accepted', meetingLink);
    closeModal('meetingLinkModal');
    await loadSessions();

    showToast('Session accepted! The mentee has been notified.', 'success');

    if (state.currentView === 'dashboard') {
      await loadDashboard();
    }
  } catch (err) {
    showToast(err.message || 'Failed to accept session', 'error');
  } finally {
    hideLoading();
  }
}

export function handleLeaveFeedback(sessionId, otherName) {
  const info = $('#feedbackSessionInfo');
  if (info) {
    info.innerHTML = `<div class="feedback-session-info">Session with <strong>${escapeHtml(otherName)}</strong></div>`;
  }

  const form = $('#formFeedback');
  if (form) {
    form.session_id.value = sessionId;
    form.rating.value = '5';
    form.comment.value = '';
  }

  $$('#ratingInput .star').forEach((star, index) => {
    star.classList.toggle('active', index < 5);
  });

  showModal('feedbackModal');
}

export async function handleSubmitFeedback(e) {
  e.preventDefault();
  setFormMessage('feedbackMessage', '');

  try {
    showLoading();
    const formData = new FormData(e.target);
    const sessionId = formData.get('session_id');
    const payload = {
      rating: Number(formData.get('rating')),
      comment: formData.get('comment'),
    };

    await API.createFeedback(sessionId, payload);
    closeModal('feedbackModal');
    showToast('Feedback submitted!', 'success');
    await loadSessions();
  } catch (err) {
    setFormMessage('feedbackMessage', err.message || 'Failed to submit feedback');
  } finally {
    hideLoading();
  }
}

export function closeViewFeedbackModal() {
  closeModal('viewFeedbackModal');
}

export async function handleViewFeedback(userId, mentorName) {
  try {
    showLoading();
    const { feedback } = await API.userFeedback(userId);

    const subtitle = $('#viewFeedbackSubtitle');
    if (subtitle) subtitle.textContent = mentorName ? `Reviews for ${mentorName}` : 'Reviews from mentees';

    const listEl = $('#viewFeedbackList');
    if (listEl) {
      if (!feedback || feedback.length === 0) {
        listEl.innerHTML = '<div class="feedback-list-empty">No feedback available for this user yet.</div>';
      } else {
        listEl.innerHTML = feedback
          .slice(0, 10)
          .map(
            (f) => `
          <div class="feedback-list-item">
            <div class="feedback-list-header">
              <span class="feedback-list-rating">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span>
              <span class="feedback-list-meta">${f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}</span>
            </div>
            <p class="feedback-list-comment">${escapeHtml(f.comment || 'No comment')}</p>
          </div>
        `
          )
          .join('');
      }
    }

    showModal('viewFeedbackModal');
  } catch (err) {
    showToast(err.message || 'Failed to load feedback', 'error');
  } finally {
    hideLoading();
  }
}
