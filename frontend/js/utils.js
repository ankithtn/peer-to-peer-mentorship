/**
 * DOM and UI utilities
 */

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => Array.from(document.querySelectorAll(selector));

export function showToast(message, type = 'info') {
  const container = $('#toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function showLoading() {
  const el = $('#loadingOverlay');
  if (el) el.classList.add('active');
}

export function hideLoading() {
  const el = $('#loadingOverlay');
  if (el) el.classList.remove('active');
}

export function showModal(modalId) {
  const el = $(`#${modalId}`);
  if (el) {
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(modalId) {
  const el = $(`#${modalId}`);
  if (el) {
    el.classList.remove('active');
    document.body.style.overflow = '';
  }
}

export function setFormMessage(elementId, message, isSuccess = false) {
  const el = $(`#${elementId}`);
  if (!el) return;

  el.textContent = message;
  el.className = 'form-message';
  if (message) {
    el.classList.add(isSuccess ? 'success' : 'error');
  }
}

export function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Light avatar colors (WhatsApp-style), consistent per user id */
const AVATAR_COLORS = [
  '#E3F2FD', '#E8F5E9', '#FFF3E0', '#FCE4EC', '#F3E5F5',
  '#E0F7FA', '#EFEBE9', '#E8EAF6', '#E0F2F1', '#FFF8E1',
];

export function getAvatarColor(userId) {
  if (userId == null) return AVATAR_COLORS[0];
  const id = typeof userId === 'number' ? userId : parseInt(String(userId), 10) || 0;
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
