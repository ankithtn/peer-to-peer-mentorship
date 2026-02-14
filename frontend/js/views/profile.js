/**
 * Profile view
 */

import { API } from '../api.js';
import { $ } from '../utils.js';

export async function loadProfile() {
  const { user } = await API.getProfile();
  const form = $('#formProfile');
  if (!form) return;

  form.name.value = user.name || '';
  form.role.value = user.role || 'mentee';
  form.bio.value = user.bio || '';
  form.skills.value = user.skills || '';
  form.interests.value = user.interests || '';
  form.experience.value = user.experience || '';
  const expYearsEl = form.querySelector('[name="experience_years"]');
  if (expYearsEl) expYearsEl.value = user.experience_years != null && user.experience_years !== '' ? String(user.experience_years) : '';

  const experienceSection = $('#experienceSection');
  if (experienceSection) {
    experienceSection.style.display = user.role === 'mentor' || user.role === 'both' ? 'block' : 'none';
  }
}
