/**
 * Entry point: routing, view switching, event wiring
 */

import { API } from './api.js';
import { state, updateUserProfile } from './state.js';
import { $, $$, showLoading, hideLoading, showToast, showModal, closeModal, setFormMessage, debounce } from './utils.js';
import { showLandingPage, showLoginPage, showSignupPage, showAppInterface, handleLogin, handleSignup, handleLogout, checkAuth } from './auth.js';
import { loadDashboard } from './views/dashboard.js';
import { loadMentors, renderMentors } from './views/browse.js';
import { loadSessions, renderSessions } from './views/sessions.js';
import { loadProfile } from './views/profile.js';
import {
  setSessionActionDeps,
  handleRequestSession,
  handleViewFeedback,
  handleSessionStatusUpdate,
  handleLeaveFeedback,
  handleSubmitRequest,
  handleSubmitFeedback,
  handleMeetingLinkSubmit,
  closeViewFeedbackModal,
} from './session-actions.js';

// --- View switching (within app) ---

export function switchView(viewName) {
  // Prevent mentors from accessing Browse
  if (viewName === 'browse' && state.user?.role === 'mentor') {
    showToast('Mentors cannot browse or request sessions. You receive requests from mentees in your Dashboard.', 'info');
    switchView('dashboard');
    return;
  }
  
  state.currentView = viewName;
  $$('.view').forEach((view) => (view.hidden = true));
  const id = `view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`;
  const viewEl = $(`#${id}`);
  if (viewEl) viewEl.hidden = false;
  $$('.sidebar-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === viewName);
  });
  loadViewData(viewName);
}

async function loadViewData(viewName) {
  try {
    showLoading();
    switch (viewName) {
      case 'dashboard':
        await loadDashboard();
        break;
      case 'browse':
        await loadMentors();
        break;
      case 'sessions':
        await loadSessions();
        break;
      case 'profile':
        await loadProfile();
        break;
    }
  } catch (err) {
    showToast(err.message || 'Failed to load data', 'error');
  } finally {
    hideLoading();
  }
}

// --- Routing ---

function getHashRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const path = hash.startsWith('/') ? hash : `/${hash}`;
  const parts = path.split('/').filter(Boolean);
  return { path, parts };
}

function applyRoute(user, { path, parts }) {
  const isApp = path === '/app' || (parts[0] === 'app' && parts.length >= 1);
  const appView = parts[0] === 'app' && parts[1] ? parts[1] : 'dashboard';

  if (user) {
    if (path === '/login' || path === '/signup') {
      window.location.hash = '#/app';
      showAppInterface();
      switchView('dashboard');
      return;
    }
    if (isApp) {
      showAppInterface();
      switchView(['dashboard', 'browse', 'sessions', 'profile'].includes(appView) ? appView : 'dashboard');
      return;
    }
    if (path === '/' || path === '') {
      window.location.hash = '#/app';
      showAppInterface();
      switchView('dashboard');
      return;
    }
    showAppInterface();
    switchView('dashboard');
    return;
  }

  if (path === '/login') {
    showLoginPage();
    return;
  }
  if (path === '/signup') {
    showSignupPage();
    return;
  }
  if (isApp) {
    window.location.hash = '#/';
    showLandingPage();
    return;
  }
  showLandingPage();
}

function setupRouting() {
  window.addEventListener('hashchange', () => {
    const user = state.user;
    const route = getHashRoute();
    applyRoute(user, route);
  });
}

// --- Event listeners ---

function setupEventListeners() {
  setSessionActionDeps({ switchView });

  const formLogin = $('#formLogin');
  const formSignup = $('#formSignup');
  if (formLogin) formLogin.addEventListener('submit', handleLogin);
  if (formSignup) formSignup.addEventListener('submit', handleSignup);

  const btnLogout = $('#btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  const formProfile = $('#formProfile');
  if (formProfile) formProfile.addEventListener('submit', handleProfileUpdate);

  const formRequest = $('#formRequest');
  if (formRequest) formRequest.addEventListener('submit', handleSubmitRequest);

  const formFeedback = $('#formFeedback');
  if (formFeedback) formFeedback.addEventListener('submit', handleSubmitFeedback);

  const formMeetingLink = $('#formMeetingLink');
  if (formMeetingLink) formMeetingLink.addEventListener('submit', handleMeetingLinkSubmit);

  $$('[data-action="close-meeting-link"]').forEach((el) => {
    el.addEventListener('click', () => closeModal('meetingLinkModal'));
  });

  $$('#ratingInput .star').forEach((star) => {
    star.addEventListener('click', () => {
      const rating = star.dataset.rating;
      const form = $('#formFeedback');
      if (form && form.rating) form.rating.value = rating;
      $$('#ratingInput .star').forEach((s, index) => {
        s.classList.toggle('active', index < parseInt(rating, 10));
      });
    });
  });

  $$('[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const view = el.dataset.view;
      if (view) {
        const newHash = `#/app/${view}`;
        if (window.location.hash !== newHash) window.location.hash = newHash;
        switchView(view);
      }
    });
  });

  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      state.currentSessionTab = tab;
      $$('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderSessions();
    });
  });

  const searchInput = $('#searchInput');
  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce((e) => {
        const query = e.target.value;
        const role = $('#roleFilter')?.value || '';
        loadMentors(query, role);
      }, 300)
    );
  }

  const roleFilter = $('#roleFilter');
  if (roleFilter) {
    roleFilter.addEventListener('change', (e) => {
      const role = e.target.value;
      const query = $('#searchInput')?.value || '';
      loadMentors(query, role);
    });
  }

  const btnRefresh = $('#btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      const query = $('#searchInput')?.value || '';
      const role = $('#roleFilter')?.value || '';
      loadMentors(query, role);
    });
  }

  $$('[data-action="go-login"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#/login';
    });
  });

  $$('[data-action="go-signup"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#/signup';
    });
  });

  $$('[data-action="go-home"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#/';
    });
  });

  $$('[data-action="close-request"]').forEach((el) => {
    el.addEventListener('click', () => closeModal('requestModal'));
  });

  $$('[data-action="close-feedback"]').forEach((el) => {
    el.addEventListener('click', () => closeModal('feedbackModal'));
  });

  $$('[data-action="close-view-feedback"]').forEach((el) => {
    el.addEventListener('click', () => closeViewFeedbackModal());
  });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'request-session') {
      handleRequestSession(btn.dataset.userId);
    } else if (action === 'view-feedback') {
      handleViewFeedback(btn.dataset.userId, btn.dataset.userName);
    } else if (action === 'accept-session') {
      handleSessionStatusUpdate(btn.dataset.sessionId, 'accepted');
    } else if (action === 'reject-session') {
      handleSessionStatusUpdate(btn.dataset.sessionId, 'rejected');
    } else if (action === 'complete-session') {
      handleSessionStatusUpdate(btn.dataset.sessionId, 'completed');
    } else if (action === 'leave-feedback') {
      handleLeaveFeedback(btn.dataset.sessionId, btn.dataset.otherName);
    }
  });
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  setFormMessage('profileMessage', '');

  try {
    showLoading();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);

    const { user } = await API.updateProfile(payload);
    updateUserProfile(user);
    setFormMessage('profileMessage', 'Profile updated successfully!', true);
    showToast('Profile updated!', 'success');
  } catch (err) {
    setFormMessage('profileMessage', err.message || 'Failed to update profile');
  } finally {
    hideLoading();
  }
}

// --- Init ---

async function init() {
  setupEventListeners();
  setupRouting();

  try {
    showLoading();

    const user = await checkAuth();

    if (user) {
      updateUserProfile(user);
      const route = getHashRoute();
      applyRoute(user, route);
    } else {
      const route = getHashRoute();
      applyRoute(null, route);
    }
  } catch (err) {
    showLandingPage();
    window.location.hash = '#/';
  } finally {
    hideLoading();
  }
}

init();
