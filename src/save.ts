import { RUN_VERSION, type RunState } from './rules/run';

// Autosave for the current run (docs/DESIGN.md §11). Storage can be missing,
// full or blocked (private windows), so every access is wrapped; a failed
// save just means no resume. Saves from another RUN_VERSION are discarded.

const RUN_KEY = 'hexbound:run';

export function saveRun(run: RunState): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch (err) {
    console.warn('[save] could not save the run', err);
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    if (run.version !== RUN_VERSION) {
      localStorage.removeItem(RUN_KEY);
      return null;
    }
    return run;
  } catch (err) {
    console.warn('[save] could not load the run', err);
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
