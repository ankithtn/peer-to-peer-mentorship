/**
 * Browse mentors view
 */

import { API } from '../api.js';
import { state } from '../state.js';
import { $, escapeHtml, initials, getAvatarColor } from '../utils.js';

export async function loadMentors(query = '', role = '') {
  const { users } = await API.listUsers({ q: query, role });
  state.mentors = users || [];
  renderMentors();
}

export function renderMentors() {
  const container = $('#mentorsList');
  const emptyState = $('#mentorsEmpty');

  if (!container) return;

  if (state.mentors.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  container.innerHTML = state.mentors
    .map((mentor) => {
      const skills = (mentor.skills || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      const interests = (mentor.interests || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);

      const allTags = [
        ...skills.map((s) => `<span class="tag tag-skill">${escapeHtml(s)}</span>`),
        ...interests.map((i) => `<span class="tag">${escapeHtml(i)}</span>`),
      ];

      const ratingHtml = mentor.average_rating
        ? `
          <div class="mentor-rating">
            <span class="stars">★</span>
            <span class="mentor-rating-value">${mentor.average_rating}</span>
            <span class="mentor-reviews">(${mentor.total_reviews} reviews)</span>
            ${mentor.experience_years != null && mentor.experience_years !== '' ? `<span class="mentor-exp">${escapeHtml(String(mentor.experience_years))} yrs exp</span>` : ''}
          </div>
        `
        : `<div class="mentor-rating mentor-rating-none">No reviews yet${mentor.experience_years != null && mentor.experience_years !== '' ? ` · ${escapeHtml(String(mentor.experience_years))} yrs exp` : ''}</div>`;

      const avatarColor = getAvatarColor(mentor.id);

      return `
        <div class="mentor-card">
          <div class="mentor-header">
            <div class="mentor-avatar" style="background-color: ${avatarColor}; color: #374151;">${initials(mentor.name)}</div>
            <div class="mentor-info">
              <div class="mentor-name">${escapeHtml(mentor.name)}</div>
              <span class="mentor-role">${escapeHtml(mentor.role)}</span>
            </div>
          </div>
          ${ratingHtml}
          <div class="mentor-bio">${escapeHtml(mentor.bio || 'No bio yet.')}</div>
          <div class="mentor-tags">${allTags.length > 0 ? allTags.join('') : '<span class="tag">No skills/interests listed</span>'}</div>
          <div class="mentor-actions">
            <button class="btn btn-primary" data-action="request-session" data-user-id="${mentor.id}">Request Session</button>
            <button class="btn btn-outline" data-action="view-feedback" data-user-id="${mentor.id}" data-user-name="${escapeHtml(mentor.name)}">View Feedback</button>
          </div>
        </div>
      `;
    })
    .join('');
}
