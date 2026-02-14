/**
 * Auth flow: landing, full-page login/signup, app interface
 */

import { API } from './api.js';
import { state, updateUserProfile } from './state.js';
import { $, $$, setFormMessage, showToast, showLoading, hideLoading } from './utils.js';

function setPageVisibility(landing, loginPage, signupPage, app) {
  const l = $('#landingPage');
  const login = $('#loginPage');
  const signup = $('#signupPage');
  const appEl = $('#appInterface');
  const navGuest = $('#navGuest');
  const navAuth = $('#navAuth');

  [l, login, signup, appEl].forEach((el) => {
    if (el) el.classList.remove('active');
  });
  if (l && landing) l.classList.add('active');
  if (login && loginPage) login.classList.add('active');
  if (signup && signupPage) signup.classList.add('active');
  if (appEl && app) appEl.classList.add('active');

  if (navGuest) navGuest.hidden = !!app;
  if (navAuth) navAuth.hidden = !app;
}

export function showLandingPage() {
  setPageVisibility(true, false, false, false);
}

export function showLoginPage() {
  setPageVisibility(false, true, false, false);
  setFormMessage('loginMessage', '');
}

export function showSignupPage() {
  setPageVisibility(false, false, true, false);
  setFormMessage('signupMessage', '');
}

export function showAppInterface() {
  setPageVisibility(false, false, false, true);
}

export async function handleLogin(e) {
  e.preventDefault();
  setFormMessage('loginMessage', '');

  try {
    showLoading();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);

    const { user } = await API.login(payload);

    updateUserProfile(user);
    showAppInterface();
    showToast('Welcome back!', 'success');
    e.target.reset();

    const hash = window.location.hash;
    if (hash.startsWith('#/app')) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = '#/app';
    }
  } catch (err) {
    setFormMessage('loginMessage', err.message || 'Login failed');
  } finally {
    hideLoading();
  }
}

export async function handleSignup(e) {
  e.preventDefault();
  setFormMessage('signupMessage', '');

  try {
    showLoading();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);

    const { user } = await API.signup(payload);

    updateUserProfile(user);
    showAppInterface();
    showToast('Account created successfully!', 'success');
    e.target.reset();

    window.location.hash = '#/app/profile';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (err) {
    setFormMessage('signupMessage', err.message || 'Signup failed');
  } finally {
    hideLoading();
  }
}

export async function handleLogout() {
  try {
    showLoading();
    await API.logout();

    state.user = null;
    state.sessions = [];
    state.mentors = [];
    showLandingPage();
    showToast('Logged out successfully', 'info');
    window.location.hash = '#/';
  } catch (err) {
    showToast('Logout failed', 'error');
  } finally {
    hideLoading();
  }
}

export async function checkAuth() {
  try {
    const { user } = await API.me();
    return user;
  } catch {
    return null;
  }
}
