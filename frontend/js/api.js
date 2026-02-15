/**
 * API client
 */

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

  me: () => API.request('/api/auth/me'),
  signup: (payload) => API.request('/api/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => API.request('/api/auth/login', { method: 'POST', body: payload }),
  logout: () => API.request('/api/auth/logout', { method: 'POST' }),

  getProfile: () => API.request('/api/profile'),
  updateProfile: (payload) => API.request('/api/profile', { method: 'PUT', body: payload }),

  listUsers: ({ q = '', role = '' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    const qs = params.toString();
    return API.request(`/api/users${qs ? `?${qs}` : ''}`);
  },

  listSessions: () => API.request('/api/sessions'),
  createSession: (payload) => API.request('/api/sessions', { method: 'POST', body: payload }),
  updateSessionStatus: (sessionId, status, meetingLink) =>
    API.request(`/api/sessions/${sessionId}/status`, {
      method: 'PUT',
      body: { status, meeting_link: meetingLink || '' },
    }),

  createFeedback: (sessionId, payload) =>
    API.request(`/api/sessions/${sessionId}/feedback`, { method: 'POST', body: payload }),
  userFeedback: (userId) => API.request(`/api/users/${userId}/feedback`),
};

export { API };
