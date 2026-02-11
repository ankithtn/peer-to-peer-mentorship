const API = {
  async request(path, { method = "GET", body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "include",
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
  },
  me() {
    return this.request("/api/auth/me");
  },
  signup(payload) {
    return this.request("/api/auth/signup", { method: "POST", body: payload });
  },
  login(payload) {
    return this.request("/api/auth/login", { method: "POST", body: payload });
  },
  logout() {
    return this.request("/api/auth/logout", { method: "POST" });
  },
  getProfile() {
    return this.request("/api/profile");
  },
  updateProfile(payload) {
    return this.request("/api/profile", { method: "PUT", body: payload });
  },
  listUsers({ q = "", role = "" } = {}) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    const qs = params.toString();
    return this.request(`/api/users${qs ? `?${qs}` : ""}`);
  },
  listSessions() {
    return this.request("/api/sessions");
  },
  createSession(payload) {
    return this.request("/api/sessions", { method: "POST", body: payload });
  },
  updateSessionStatus(sessionId, status) {
    return this.request(`/api/sessions/${sessionId}/status`, {
      method: "PUT",
      body: { status },
    });
  },
  createFeedback(sessionId, payload) {
    return this.request(`/api/sessions/${sessionId}/feedback`, {
      method: "POST",
      body: payload,
    });
  },
  userFeedback(userId) {
    return this.request(`/api/users/${userId}/feedback`);
  },
};

const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));

function setMsg(target, text, ok = false) {
  target.textContent = text || "";
  target.classList.toggle("ok", !!ok);
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function tagify(csv) {
  return (csv || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function badge(status) {
  const s = status || "pending";
  const cls = {
    pending: "badge badge--pending",
    accepted: "badge badge--accepted",
    rejected: "badge badge--rejected",
    completed: "badge badge--completed",
  }[s] || "badge";
  return `<span class="${cls}">${s.toUpperCase()}</span>`;
}

let state = {
  me: null,
  view: "browse",
  profiles: [],
  sessions: [],
};

function showAuthedUI(authed) {
  el("#viewAuth").hidden = authed;
  el("#viewApp").hidden = !authed;
  el("#navAuthed").hidden = !authed;
}

function switchView(view) {
  state.view = view;
  el("#viewTitle").textContent =
    view === "browse" ? "Browse" : view === "sessions" ? "Sessions" : "My Profile";
  el("#viewBrowse").hidden = view !== "browse";
  el("#viewSessions").hidden = view !== "sessions";
  el("#viewProfile").hidden = view !== "profile";
  el("#searchInput").disabled = view !== "browse";
  el("#roleFilter").disabled = view !== "browse";
}

function renderMe() {
  const me = state.me;
  el("#meName").textContent = me?.name || "—";
  el("#meMeta").textContent = me ? `${me.role} • ${me.email}` : "—";
  el("#meAvatar").textContent = initials(me?.name);
}

function renderProfiles() {
  const list = el("#profilesList");
  list.innerHTML = "";

  if (!state.profiles.length) {
    el("#profilesEmpty").hidden = false;
    return;
  }
  el("#profilesEmpty").hidden = true;

  for (const u of state.profiles) {
    const skills = tagify(u.skills);
    const interests = tagify(u.interests);
    const tags = [...skills.map((t) => `<span class="tag tag--orange">${escapeHtml(t)}</span>`)]
      .concat(interests.map((t) => `<span class="tag">${escapeHtml(t)}</span>`))
      .slice(0, 10)
      .join("");

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item__top">
        <div>
          <div class="item__title">${escapeHtml(u.name)} <span class="tag">${escapeHtml(u.role)}</span></div>
          <div class="item__meta">${escapeHtml(u.email)}</div>
        </div>
        <button class="btn btn--primary" data-action="request" data-user="${u.id}">Request</button>
      </div>
      <div class="item__body">${escapeHtml(u.bio || "No bio yet.")}</div>
      <div class="item__tags">${tags || `<span class="muted">No skills/interests listed.</span>`}</div>
      <div class="item__actions">
        <button class="btn" data-action="view-feedback" data-user="${u.id}">View feedback</button>
      </div>
      <div class="form__msg" data-msg></div>
    `;
    list.appendChild(item);
  }
}

function renderSessions() {
  const list = el("#sessionsList");
  list.innerHTML = "";

  if (!state.sessions.length) {
    el("#sessionsEmpty").hidden = false;
    return;
  }
  el("#sessionsEmpty").hidden = true;

  for (const s of state.sessions) {
    const isMentor = s.mentor?.id === state.me?.id;
    const other = isMentor ? s.requester : s.mentor;

    const canAcceptReject = isMentor && s.status === "pending";
    const canComplete =
      (s.status === "accepted" || s.status === "completed") &&
      (s.mentor?.id === state.me?.id || s.requester?.id === state.me?.id);
    const canFeedback = s.status === "completed";

    const when = s.scheduled_time ? new Date(s.scheduled_time).toLocaleString() : "Not scheduled";

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item__top">
        <div>
          <div class="item__title">${escapeHtml(s.topic)} ${badge(s.status)}</div>
          <div class="item__meta">With ${escapeHtml(other?.name || "—")} • ${escapeHtml(when)}</div>
        </div>
      </div>
      <div class="item__body">${escapeHtml(s.description || "—")}</div>
      <div class="item__actions">
        ${
          canAcceptReject
            ? `
              <button class="btn btn--primary" data-action="accept" data-session="${s.id}">Accept</button>
              <button class="btn" data-action="reject" data-session="${s.id}">Reject</button>
            `
            : ""
        }
        ${
          canComplete && s.status !== "completed"
            ? `<button class="btn" data-action="complete" data-session="${s.id}">Mark completed</button>`
            : ""
        }
        ${
          canFeedback
            ? `<button class="btn btn--primary" data-action="feedback" data-session="${s.id}" data-other="${other?.name || ""}">Leave feedback</button>`
            : ""
        }
      </div>
      <div class="form__msg" data-msg></div>
    `;
    list.appendChild(item);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshProfiles() {
  const q = el("#searchInput").value.trim();
  const role = el("#roleFilter").value;
  const { users } = await API.listUsers({ q, role });
  state.profiles = users || [];
  renderProfiles();
}

async function refreshSessions() {
  const { sessions } = await API.listSessions();
  state.sessions = sessions || [];
  renderSessions();
}

async function loadProfileForm() {
  const { user } = await API.getProfile();
  const form = el("#formProfile");
  form.name.value = user.name || "";
  form.role.value = user.role || "mentee";
  form.bio.value = user.bio || "";
  form.skills.value = user.skills || "";
  form.interests.value = user.interests || "";
}

function setupTabs() {
  els(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      els(".tab").forEach((x) => x.classList.remove("tab--active"));
      t.classList.add("tab--active");
      const which = t.dataset.tab;
      el("#tabLogin").hidden = which !== "login";
      el("#tabSignup").hidden = which !== "signup";
      setMsg(el("#msgLogin"), "");
      setMsg(el("#msgSignup"), "");
    }),
  );
}

function setupNav() {
  els("[data-view]").forEach((b) =>
    b.addEventListener("click", async () => {
      const view = b.dataset.view;
      switchView(view);
      if (view === "browse") await refreshProfiles().catch(() => {});
      if (view === "sessions") await refreshSessions().catch(() => {});
      if (view === "profile") await loadProfileForm().catch(() => {});
    }),
  );
}

function setupAuth() {
  el("#formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = el("#msgLogin");
    setMsg(msg, "");
    try {
      const payload = Object.fromEntries(new FormData(e.target));
      const { user } = await API.login(payload);
      state.me = user;
      renderMe();
      showAuthedUI(true);
      switchView("browse");
      await refreshProfiles();
      setMsg(msg, "");
    } catch (err) {
      setMsg(msg, err.message || "Login failed.");
    }
  });

  el("#formSignup").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = el("#msgSignup");
    setMsg(msg, "");
    try {
      const payload = Object.fromEntries(new FormData(e.target));
      const { user } = await API.signup(payload);
      state.me = user;
      renderMe();
      showAuthedUI(true);
      switchView("profile");
      await loadProfileForm();
      setMsg(msg, "Account created. Update your profile anytime.", true);
    } catch (err) {
      setMsg(msg, err.message || "Signup failed.");
    }
  });

  el("#btnLogout").addEventListener("click", async () => {
    await API.logout().catch(() => {});
    state = { ...state, me: null, profiles: [], sessions: [] };
    showAuthedUI(false);
  });
}

function setupControls() {
  el("#btnRefresh").addEventListener("click", async () => {
    if (state.view === "browse") await refreshProfiles().catch(() => {});
    if (state.view === "sessions") await refreshSessions().catch(() => {});
  });

  el("#searchInput").addEventListener("input", debounce(() => refreshProfiles().catch(() => {}), 200));
  el("#roleFilter").addEventListener("change", () => refreshProfiles().catch(() => {}));

  el("#formProfile").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = el("#msgProfile");
    setMsg(msg, "");
    try {
      const payload = Object.fromEntries(new FormData(e.target));
      const { user } = await API.updateProfile(payload);
      state.me = user;
      renderMe();
      setMsg(msg, "Profile saved.", true);
    } catch (err) {
      setMsg(msg, err.message || "Could not save profile.");
    }
  });
}

function setupListActions() {
  el("#profilesList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const card = e.target.closest(".item");
    const msg = card?.querySelector("[data-msg]");

    if (btn.dataset.action === "request") {
      const userId = btn.dataset.user;
      const user = state.profiles.find((x) => String(x.id) === String(userId));
      openRequestDialog(user);
      return;
    }

    if (btn.dataset.action === "view-feedback") {
      const userId = btn.dataset.user;
      setMsg(msg, "");
      try {
        const { feedback } = await API.userFeedback(userId);
        const text =
          !feedback?.length
            ? "No feedback yet."
            : feedback
                .slice(0, 3)
                .map((f) => `★${f.rating} — ${f.comment || "(no comment)"}`)
                .join("  |  ");
        setMsg(msg, text, true);
      } catch (err) {
        setMsg(msg, err.message || "Could not load feedback.");
      }
    }
  });

  el("#sessionsList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const card = e.target.closest(".item");
    const msg = card?.querySelector("[data-msg]");
    const sessionId = btn.dataset.session;

    try {
      setMsg(msg, "");
      if (btn.dataset.action === "accept") {
        await API.updateSessionStatus(sessionId, "accepted");
        await refreshSessions();
        return;
      }
      if (btn.dataset.action === "reject") {
        await API.updateSessionStatus(sessionId, "rejected");
        await refreshSessions();
        return;
      }
      if (btn.dataset.action === "complete") {
        await API.updateSessionStatus(sessionId, "completed");
        await refreshSessions();
        return;
      }
      if (btn.dataset.action === "feedback") {
        openFeedbackDialog(sessionId, btn.dataset.other || "");
      }
    } catch (err) {
      setMsg(msg, err.message || "Action failed.");
    }
  });
}

function openRequestDialog(user) {
  const dlg = el("#dlgRequest");
  const msg = el("#msgRequest");
  setMsg(msg, "");
  if (!user) return;
  el("#requestMentorLine").textContent = `To: ${user.name} (${user.role})`;
  const form = el("#formRequest");
  form.mentor_id.value = user.id;
  form.topic.value = "";
  form.description.value = "";
  form.scheduled_time.value = "";
  dlg.showModal();
}

function openFeedbackDialog(sessionId, otherName) {
  const dlg = el("#dlgFeedback");
  setMsg(el("#msgFeedback"), "");
  el("#feedbackLine").textContent = otherName ? `For session with ${otherName}` : "—";
  const form = el("#formFeedback");
  form.session_id.value = sessionId;
  form.rating.value = "5";
  form.comment.value = "";
  dlg.showModal();
}

function setupDialogs() {
  el("#btnCancelRequest").addEventListener("click", () => el("#dlgRequest").close());
  el("#btnCancelFeedback").addEventListener("click", () => el("#dlgFeedback").close());

  el("#formRequest").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = el("#msgRequest");
    setMsg(msg, "");
    try {
      const payload = Object.fromEntries(new FormData(e.target));
      payload.mentor_id = Number(payload.mentor_id);
      if (!payload.scheduled_time) delete payload.scheduled_time;
      const { session } = await API.createSession(payload);
      setMsg(msg, "Request sent.", true);
      el("#dlgRequest").close();
      if (state.view === "sessions") {
        await refreshSessions();
      }
      // light refresh so users see it quickly
      await refreshSessions().catch(() => {});
      switchView("sessions");
    } catch (err) {
      setMsg(msg, err.message || "Could not create session.");
    }
  });

  el("#formFeedback").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = el("#msgFeedback");
    setMsg(msg, "");
    try {
      const payload = Object.fromEntries(new FormData(e.target));
      const sessionId = payload.session_id;
      delete payload.session_id;
      const { feedback } = await API.createFeedback(sessionId, payload);
      setMsg(msg, `Feedback submitted (★${feedback.rating}).`, true);
      el("#dlgFeedback").close();
      await refreshSessions().catch(() => {});
    } catch (err) {
      setMsg(msg, err.message || "Could not submit feedback.");
    }
  });
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function init() {
  setupTabs();
  setupNav();
  setupAuth();
  setupControls();
  setupListActions();
  setupDialogs();

  try {
    const { user } = await API.me();
    if (user) {
      state.me = user;
      renderMe();
      showAuthedUI(true);
      switchView("browse");
      await refreshProfiles();
    } else {
      showAuthedUI(false);
    }
  } catch {
    showAuthedUI(false);
  }
}

init();

