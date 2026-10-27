import type { HazardId, StatusId } from '../rules/types';

// Display names for rule ids that the UI shows in more than one place.
export const HAZARD_NAMES: Record<HazardId, string> = {
  oil: 'Oil',
  fire: 'Fire',
  trap: 'Trap',
  mine: 'Mine',
};

export const STATUS_NAMES: Record<StatusId, string> = {
  guard: 'Guard',
  pinned: 'Pinned',
  slow: 'Slow',
  haste: 'Haste',
  veil: 'Veil',
  poison: 'Poison',
  blind: 'Blind',
  silence: 'Silence',
  regen: 'Regen',
};
