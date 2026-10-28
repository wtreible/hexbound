import { newProfile, PROFILE_VERSION, type Profile } from './rules/profile';

// Meta progression storage (docs/DESIGN.md §6.7, §11). Wrapped like save.ts:
// without storage the profile just doesn't persist. A profile from another
// PROFILE_VERSION starts over.

const PROFILE_KEY = 'hexbound:profile';

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return newProfile();
    const profile = JSON.parse(raw) as Profile;
    return profile.version === PROFILE_VERSION ? profile : newProfile();
  } catch (err) {
    console.warn('[profile] could not load the profile', err);
    return newProfile();
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.warn('[profile] could not save the profile', err);
  }
}
