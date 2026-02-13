// ===================================
// API Client
// ===================================

const API = {
  async request(path, { method = 'GET', body } = {}) {
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || `Request failed (${res.status})`;
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },

  // Auth
  me: () => API.request('/api/auth/me'),
  signup: (payload) => API.request('/api/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => API.request('/api/auth/login', { method: 'POST', body: payload }),
  logout: () => API.request('/api/auth/logout', { method: 'POST' }),

  // Profile
  getProfile: () => API.request('/api/profile'),
  updateProfile: (payload) => API.request('/api/profile', { method: 'PUT', body: payload }),

  // Users
  listUsers: ({ q = '', role = '' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    const qs = params.toString();
    return API.request(`/api/users${qs ? `?${qs}` : ''}`);
  },

  // Sessions
  listSessions: () => API.request('/api/sessions'),
  createSession: (payload) => API.request('/api/sessions', { method: 'POST', body: payload }),
  updateSessionStatus: (sessionId, status, meetingLink) =>
    API.request(`/api/sessions/${sessionId}/status`, { 
      method: 'PUT', 
      body: { status, meeting_link: meetingLink || '' } 
    }),

  // Feedback
  createFeedback: (sessionId, payload) =>
    API.request(`/api/sessions/${sessionId}/feedback`, { method: 'POST', body: payload }),
  userFeedback: (userId) => API.request(`/api/users/${userId}/feedback`),
};

// ===================================
// State Management
// ===================================

const state = {
  user: null,
  currentView: 'dashboard',
  sessions: [],
  mentors: [],
  currentSessionTab: 'all',
};

// ===================================
// UI Utilities
// ===================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function showToast(message, type = 'info') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoading() {
  $('#loadingOverlay').classList.add('active');
}

function hideLoading() {
  $('#loadingOverlay').classList.remove('active');
}

function showModal(modalId) {
  $(`#${modalId}`).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  $(`#${modalId}`).classList.remove('active');
  document.body.style.overflow = '';
}

function setFormMessage(elementId, message, isSuccess = false) {
  const el = $(`#${elementId}`);
  if (!el) return;

  el.textContent = message;
  el.className = 'form-message';
  if (message) {
    el.classList.add(isSuccess ? 'success' : 'error');
  }
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// ===================================
// View Management (Auth Flow)
// ===================================

/**
 * Show landing page for GUEST users (not logged in)
 * - Shows: Hero, Features, How It Works, CTA
 * - Navbar: Login & Sign Up buttons
 * - Hides: App interface (Dashboard, Browse, Sessions, Profile)
 */
function showLandingPage() {
  $('#landingPage').hidden = false;
  $('#appInterface').hidden = true;
  $('#navGuest').hidden = false;
  $('#navAuth').hidden = true;
  
  console.log('🏠 Landing page shown - User is NOT logged in');
}

/**
 * Show app interface for AUTHENTICATED users (logged in)
 * - Shows: Dashboard, Browse, Sessions, Profile
 * - Navbar: Dashboard, Browse, Sessions, Profile, Logout
 * - Hides: Landing page
 */
function showAppInterface() {
  $('#landingPage').hidden = true;
  $('#appInterface').hidden = false;
  $('#navGuest').hidden = true;
  $('#navAuth').hidden = false;
  
  console.log('✅ App interface shown - User is logged in');
}

function switchView(viewName) {
  state.currentView = viewName;

  // Hide all views
  $$('.view').forEach((view) => (view.hidden = true));

  // Show selected view
  $(`#view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`).hidden = false;

  // Update sidebar active state
  $$('.sidebar-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === viewName);
  });

  // Load view data
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

// ===================================
// User Profile
// ===================================

function updateUserProfile(user) {
  state.user = user;
  $('#userAvatar').textContent = initials(user.name);
  $('#userName').textContent = user.name;
  $('#userRole').textContent = user.role;
}

// ===================================
// Dashboard
// ===================================

async function loadDashboard() {
  const { sessions } = await API.listSessions();
  state.sessions = sessions || [];

  const user = state.user;
  const isMentor = user.role === 'mentor' || user.role === 'both';
  const isMentee = user.role === 'mentee' || user.role === 'both';

  // Calculate stats based on role
  const total = sessions.length;
  let pending = 0;
  let completed = 0;
  let incomingRequests = [];
  let sentRequests = [];

  sessions.forEach((s) => {
    if (s.status === 'pending') pending++;
    if (s.status === 'completed') completed++;
    
    // Separate incoming vs sent requests
    if (s.mentor?.id === user.id) {
      incomingRequests.push(s);
    } else {
      sentRequests.push(s);
    }
  });

  $('#statTotalSessions').textContent = total;
  $('#statPending').textContent = pending;
  $('#statCompleted').textContent = completed;

  // Render role-specific dashboard
  const dashboardContent = $('#dashboardContent');
  
  if (isMentor) {
    // MENTOR VIEW: Show incoming requests
    dashboardContent.innerHTML = `
      <div class="dashboard-section">
        <h2 class="section-heading">Incoming Session Requests</h2>
        <div class="sessions-list" id="incomingRequests">
          ${incomingRequests.length === 0 ? `
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No incoming requests</p>
            </div>
          ` : incomingRequests.slice(0, 5).map((session) => renderSessionCard(session, true)).join('')}
        </div>
      </div>
      
      <div class="dashboard-section">
        <h2 class="section-heading">Recent Activity</h2>
        <div class="activity-list" id="recentActivity">
          ${sessions.slice(0, 5).map((s) => `
            <div class="activity-item">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                  <strong>${escapeHtml(s.topic)}</strong>
                  <div style="font-size: 0.875rem; color: var(--gray-500); margin-top: 4px;">
                    With ${escapeHtml(s.requester?.name || 'Unknown')}
                  </div>
                </div>
                <span class="badge badge-${s.status}">${s.status.toUpperCase()}</span>
              </div>
            </div>
          `).join('') || '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No activity yet</p>'}
        </div>
      </div>
    `;
  } else if (isMentee) {
    // MENTEE VIEW: Show sent requests
    dashboardContent.innerHTML = `
      <div class="dashboard-section">
        <h2 class="section-heading">My Session Requests</h2>
        <div class="sessions-list" id="sentRequests">
          ${sentRequests.length === 0 ? `
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>You haven't requested any sessions yet</p>
              <button class="btn btn-primary" data-view="browse">Browse Mentors</button>
            </div>
          ` : sentRequests.slice(0, 5).map((session) => renderSessionCard(session, false)).join('')}
        </div>
      </div>
      
      <div class="dashboard-section">
        <h2 class="section-heading">Suggested Mentors</h2>
        <div class="mentor-suggestions" id="suggestedMentors">
          <p style="color: var(--gray-500); text-align: center; padding: 20px;">
            <button class="btn btn-primary" data-view="browse">Find Mentors</button>
          </p>
        </div>
      </div>
    `;
  }
}

// Helper to render session card for dashboard
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

// ===================================
// Browse Mentors
// ===================================

async function loadMentors(query = '', role = '') {
  const { users } = await API.listUsers({ q: query, role });
  state.mentors = users || [];

  renderMentors();
}

function renderMentors() {
  const container = $('#mentorsList');
  const emptyState = $('#mentorsEmpty');

  if (state.mentors.length === 0) {
    container.innerHTML = '';
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
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

      // Rating display
      const ratingHtml = mentor.average_rating 
        ? `
          <div class="mentor-rating">
            <span class="stars">★</span>
            <span style="font-weight: 600;">${mentor.average_rating}</span>
            <span style="color: var(--gray-500);">(${mentor.total_reviews} reviews)</span>
          </div>
        `
        : '<div class="mentor-rating" style="color: var(--gray-500); font-size: 0.875rem;">No reviews yet</div>';

      return `
        <div class="mentor-card">
          <div class="mentor-header">
            <div class="mentor-avatar">${initials(mentor.name)}</div>
            <div class="mentor-info">
              <div class="mentor-name">${escapeHtml(mentor.name)}</div>
              <span class="mentor-role">${escapeHtml(mentor.role)}</span>
            </div>
          </div>
          ${ratingHtml}
          <div class="mentor-bio">${escapeHtml(mentor.bio || 'No bio yet.')}</div>
          ${
            allTags.length > 0
              ? `<div class="mentor-tags">${allTags.join('')}</div>`
              : '<div class="mentor-tags"><span class="tag">No skills/interests listed</span></div>'
          }
          <div class="mentor-actions">
            <button class="btn btn-primary" data-action="request-session" data-user-id="${mentor.id}">
              Request Session
            </button>
            <button class="btn btn-outline" data-action="view-feedback" data-user-id="${mentor.id}">
              View Feedback
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ===================================
// Sessions
// ===================================

async function loadSessions() {
  const { sessions } = await API.listSessions();
  state.sessions = sessions || [];
  renderSessions();
}

function renderSessions() {
  const container = $('#sessionsList');
  const emptyState = $('#sessionsEmpty');

  let filteredSessions = state.sessions;

  // Filter by tab
  if (state.currentSessionTab !== 'all') {
    filteredSessions = state.sessions.filter((s) => s.status === state.currentSessionTab);
  }

  if (filteredSessions.length === 0) {
    container.innerHTML = '';
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  container.innerHTML = filteredSessions
    .map((session) => {
      const isMentor = session.mentor?.id === state.user?.id;
      const otherUser = isMentor ? session.requester : session.mentor;
      const canAcceptReject = isMentor && session.status === 'pending';
      const canComplete =
        (session.status === 'accepted' || session.status === 'completed') &&
        (session.mentor?.id === state.user?.id || session.requester?.id === state.user?.id);
      const canFeedback = session.status === 'completed';

      const scheduledTime = session.scheduled_time
        ? new Date(session.scheduled_time).toLocaleString()
        : 'Not scheduled';
      
      // Show meeting link if available
      const meetingLinkHtml = session.meeting_link 
        ? `<div style="margin-top: 8px;">
             <strong>Meeting Link:</strong> 
             <a href="${escapeHtml(session.meeting_link)}" target="_blank" class="link-primary">
               Join Meeting →
             </a>
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
            ${
              canAcceptReject
                ? `
              <button class="btn btn-primary" data-action="accept-session" data-session-id="${session.id}">Accept</button>
              <button class="btn btn-outline" data-action="reject-session" data-session-id="${session.id}">Reject</button>
            `
                : ''
            }
            ${
              canComplete && session.status !== 'completed'
                ? `<button class="btn btn-outline" data-action="complete-session" data-session-id="${session.id}">Mark Completed</button>`
                : ''
            }
            ${
              canFeedback
                ? `<button class="btn btn-primary" data-action="leave-feedback" data-session-id="${session.id}" data-other-name="${escapeHtml(
                    otherUser?.name || ''
                  )}">Leave Feedback</button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');
}

// ===================================
// Profile
// ===================================

async function loadProfile() {
  const { user } = await API.getProfile();
  const form = $('#formProfile');

  form.name.value = user.name || '';
  form.role.value = user.role || 'mentee';
  form.bio.value = user.bio || '';
  form.skills.value = user.skills || '';
  form.interests.value = user.interests || '';
}

// ===================================
// Auth Handlers
// ===================================

/**
 * Handle user login
 * After successful login:
 * 1. Close auth modal
 * 2. Show app interface (hide landing page)
 * 3. Navigate to Dashboard
 */
async function handleLogin(e) {
  e.preventDefault();
  setFormMessage('loginMessage', '');

  try {
    showLoading();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);

    const { user } = await API.login(payload);
    
    // ✅ LOGIN SUCCESS
    console.log('✅ Login successful:', user.name);
    updateUserProfile(user);
    closeModal('authModal');
    showAppInterface();           // Hide landing, show app
    switchView('dashboard');      // Go to dashboard
    showToast('Welcome back!', 'success');
    
    // Reset form
    e.target.reset();
  } catch (err) {
    // ❌ LOGIN FAILED
    console.error('❌ Login failed:', err.message);
    setFormMessage('loginMessage', err.message || 'Login failed');
  } finally {
    hideLoading();
  }
}

/**
 * Handle user signup
 * After successful signup:
 * 1. Close auth modal
 * 2. Show app interface (hide landing page)
 * 3. Navigate to Profile (so they can complete their profile)
 */
async function handleSignup(e) {
  e.preventDefault();
  setFormMessage('signupMessage', '');

  try {
    showLoading();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);

    const { user } = await API.signup(payload);
    
    // ✅ SIGNUP SUCCESS
    console.log('✅ Signup successful:', user.name);
    updateUserProfile(user);
    closeModal('authModal');
    showAppInterface();           // Hide landing, show app
    switchView('profile');        // Go to profile to complete setup
    showToast('Account created successfully!', 'success');
    
    // Reset form
    e.target.reset();
  } catch (err) {
    // ❌ SIGNUP FAILED
    console.error('❌ Signup failed:', err.message);
    setFormMessage('signupMessage', err.message || 'Signup failed');
  } finally {
    hideLoading();
  }
}

/**
 * Handle user logout
 * After logout:
 * 1. Clear all user data
 * 2. Show landing page (hide app interface)
 */
async function handleLogout() {
  try {
    showLoading();
    await API.logout();
    
    // ✅ LOGOUT SUCCESS
    console.log('✅ Logout successful');
    state.user = null;
    state.sessions = [];
    state.mentors = [];
    showLandingPage();            // Show landing, hide app
    showToast('Logged out successfully', 'info');
  } catch (err) {
    // ❌ LOGOUT FAILED
    console.error('❌ Logout failed:', err.message);
    showToast('Logout failed', 'error');
  } finally {
    hideLoading();
  }
}

// ===================================
// Session Actions
// ===================================

async function handleRequestSession(mentorId) {
  const mentor = state.mentors.find((m) => m.id === Number(mentorId));
  if (!mentor) return;

  $('#requestMentorInfo').innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
      <div class="mentor-avatar" style="width: 48px; height: 48px; font-size: 1.125rem;">${initials(mentor.name)}</div>
      <div>
        <div style="font-weight: 600;">${escapeHtml(mentor.name)}</div>
        <div style="font-size: 0.875rem; color: var(--gray-500);">${escapeHtml(mentor.role)}</div>
      </div>
    </div>
  `;

  const form = $('#formRequest');
  form.mentor_id.value = mentor.id;
  form.topic.value = '';
  form.description.value = '';
  form.scheduled_time.value = '';

  showModal('requestModal');
}

async function handleSubmitRequest(e) {
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

    if (state.currentView === 'sessions') {
      await loadSessions();
    }
  } catch (err) {
    setFormMessage('requestMessage', err.message || 'Failed to send request');
  } finally {
    hideLoading();
  }
}

async function handleSessionStatusUpdate(sessionId, status) {
  try {
    let meetingLink = '';
    
    // If accepting, prompt for meeting link
    if (status === 'accepted') {
      meetingLink = prompt('Enter meeting link (Zoom, Google Meet, etc.) - Optional:') || '';
    }
    
    showLoading();
    await API.updateSessionStatus(sessionId, status, meetingLink);
    await loadSessions();
    
    let message = status === 'accepted' 
      ? 'Session accepted! The mentee has been notified.'
      : status === 'rejected' 
      ? 'Session rejected.'
      : 'Session marked as completed!';
    
    showToast(message, 'success');
    
    // Reload dashboard if we're on it
    if (state.currentView === 'dashboard') {
      await loadDashboard();
    }
  } catch (err) {
    showToast(err.message || 'Failed to update session', 'error');
  } finally {
    hideLoading();
  }
}

async function handleLeaveFeedback(sessionId, otherName) {
  $('#feedbackSessionInfo').innerHTML = `
    <div style="font-size: 0.875rem; color: var(--gray-600);">
      Session with <strong>${escapeHtml(otherName)}</strong>
    </div>
  `;

  const form = $('#formFeedback');
  form.session_id.value = sessionId;
  form.rating.value = '5';
  form.comment.value = '';

  // Reset star rating
  $$('#ratingInput .star').forEach((star, index) => {
    star.classList.toggle('active', index < 5);
  });

  showModal('feedbackModal');
}

async function handleSubmitFeedback(e) {
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

async function handleViewFeedback(userId) {
  try {
    showLoading();
    const { feedback } = await API.userFeedback(userId);

    if (!feedback || feedback.length === 0) {
      showToast('No feedback available for this user', 'info');
      return;
    }

    const feedbackText = feedback
      .slice(0, 5)
      .map((f) => `⭐ ${f.rating}/5 - ${f.comment || 'No comment'}`)
      .join('\n');

    alert(`Recent Feedback:\n\n${feedbackText}`);
  } catch (err) {
    showToast(err.message || 'Failed to load feedback', 'error');
  } finally {
    hideLoading();
  }
}

// ===================================
// Profile Update
// ===================================

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

// ===================================
// Event Listeners
// ===================================

function setupEventListeners() {
  // Auth modal tabs
  $$('[data-auth-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.authTab;

      $$('.auth-tab').forEach((t) => t.classList.toggle('active', t === tab));
      $('#panelLogin').hidden = tabName !== 'login';
      $('#panelSignup').hidden = tabName !== 'signup';

      setFormMessage('loginMessage', '');
      setFormMessage('signupMessage', '');
    });
  });

  // Auth forms
  $('#formLogin').addEventListener('submit', handleLogin);
  $('#formSignup').addEventListener('submit', handleSignup);
  $('#btnLogout').addEventListener('click', handleLogout);

  // Profile form
  $('#formProfile').addEventListener('submit', handleProfileUpdate);

  // Request session form
  $('#formRequest').addEventListener('submit', handleSubmitRequest);

  // Feedback form
  $('#formFeedback').addEventListener('submit', handleSubmitFeedback);

  // Star rating
  $$('#ratingInput .star').forEach((star) => {
    star.addEventListener('click', () => {
      const rating = star.dataset.rating;
      $('#formFeedback').rating.value = rating;

      $$('#ratingInput .star').forEach((s, index) => {
        s.classList.toggle('active', index < rating);
      });
    });
  });

  // View switching
  $$('[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const view = el.dataset.view;
      switchView(view);
    });
  });

  // Session tabs
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      state.currentSessionTab = tab;

      $$('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderSessions();
    });
  });

  // Search and filters
  $('#searchInput')?.addEventListener(
    'input',
    debounce((e) => {
      const query = e.target.value;
      const role = $('#roleFilter')?.value || '';
      loadMentors(query, role);
    }, 300)
  );

  $('#roleFilter')?.addEventListener('change', (e) => {
    const role = e.target.value;
    const query = $('#searchInput')?.value || '';
    loadMentors(query, role);
  });

  $('#btnRefresh')?.addEventListener('click', () => {
    const query = $('#searchInput')?.value || '';
    const role = $('#roleFilter')?.value || '';
    loadMentors(query, role);
  });

  // Modal actions
  $$('[data-action="show-login"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showModal('authModal');
      $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.authTab === 'login'));
      $('#panelLogin').hidden = false;
      $('#panelSignup').hidden = true;
    });
  });

  $$('[data-action="show-signup"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showModal('authModal');
      $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.authTab === 'signup'));
      $('#panelLogin').hidden = true;
      $('#panelSignup').hidden = false;
    });
  });

  $$('[data-action="close-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeModal('authModal'));
  });

  $$('[data-action="close-request"]').forEach((el) => {
    el.addEventListener('click', () => closeModal('requestModal'));
  });

  $$('[data-action="close-feedback"]').forEach((el) => {
    el.addEventListener('click', () => closeModal('feedbackModal'));
  });

  // Delegate mentor/session actions
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'request-session') {
      handleRequestSession(btn.dataset.userId);
    } else if (action === 'view-feedback') {
      handleViewFeedback(btn.dataset.userId);
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

// ===================================
// Initialization (App Entry Point)
// ===================================

/**
 * Initialize the application
 * 
 * FLOW:
 * 1. Check if user is already logged in (via session cookie)
 * 2. If logged in → Show app interface (Dashboard)
 * 3. If NOT logged in → Show landing page (Login/Signup)
 */
async function init() {
  setupEventListeners();

  try {
    showLoading();
    
    // Check if user is logged in by calling /api/auth/me
    const { user } = await API.me();

    if (user) {
      // ✅ USER IS LOGGED IN
      console.log('✅ User is authenticated:', user.name);
      updateUserProfile(user);
      showAppInterface();
      switchView('dashboard');  // Default view = Dashboard
    } else {
      // ❌ USER IS NOT LOGGED IN
      console.log('❌ User is NOT authenticated - showing landing page');
      showLandingPage();
    }
  } catch (err) {
    // Error checking auth = treat as not logged in
    console.log('⚠️ Auth check failed - showing landing page');
    showLandingPage();
  } finally {
    hideLoading();
  }
}

// Start the app when page loads
init();