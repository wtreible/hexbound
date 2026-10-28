import type { JobDef } from '../rules/types';

// The job tree (docs/DESIGN.md §6; decision 0023), FFT-style: every job has a
// basic attack and a list of abilities learned by spending JP earned in that
// job. Job level comes from total JP earned. Advanced and elite jobs need
// levels in earlier jobs; not every pairing is a job. `growth` is added to a
// unit's base stats each time it levels up in that job (§5.4).

type Learn = [abilityId: string, jp: number];
const learn = (list: Learn[]) => list.map(([abilityId, jp]) => ({ abilityId, jp }));

const defs: JobDef[] = [
  // ===== Starting jobs (tier 1) =====
  {
    id: 'squire', name: 'Squire', tier: 1, requires: [], description: 'Sturdy frontliner with basic grit and self-sufficiency.',
    statMods: { hp: 1.2, mp: 0.5, atk: 1.1, mag: 0.6, def: 1.25, res: 0.9, spd: 1 }, move: 4, jump: 2,
    growth: { hp: 4, mp: 0.5, atk: 1.2, mag: 0.4, def: 1, res: 0.6, spd: 0.15 }, attack: 'strike',
    abilities: learn([['rally-strike', 50], ['throw-stone', 60], ['guard', 80], ['shove', 100], ['accumulate', 120], ['first-aid', 150], ['counter', 200], ['jp-boost', 250], ['last-stand', 500]]),
    equip: ['sword', 'shield'], model: 'capsule',
  },
  {
    id: 'archer', name: 'Archer', tier: 1, requires: [], description: 'Ranged attacker who rewards high ground.',
    statMods: { hp: 0.9, mp: 0.8, atk: 1, mag: 0.7, def: 0.9, res: 0.9, spd: 1.15 }, move: 4, jump: 2,
    growth: { hp: 3, mp: 0.8, atk: 1.1, mag: 0.5, def: 0.6, res: 0.6, spd: 0.25 }, attack: 'shoot',
    abilities: learn([['aim', 50], ['pin-shot', 100], ['charge-shot', 120], ['piercing-shot', 150], ['volley', 200], ['sixth-sense', 200], ['jump-plus', 150], ['eagle-eye', 250], ['rain-of-arrows', 500]]),
    equip: ['bow'], model: 'capsule',
  },
  {
    id: 'mage', name: 'Mage', tier: 1, requires: [], description: 'Elemental damage from range; fragile.',
    statMods: { hp: 0.8, mp: 1.8, atk: 0.6, mag: 1.35, def: 0.8, res: 1.2, spd: 1 }, move: 3, jump: 2,
    growth: { hp: 2.5, mp: 1.5, atk: 0.4, mag: 1.4, def: 0.5, res: 1, spd: 0.15 }, attack: 'staff',
    abilities: learn([['flame', 50], ['frost', 100], ['enfeeble', 120], ['spark', 150], ['inferno', 250], ['mana-well', 200], ['magic-boost', 300], ['meteor', 500]]),
    equip: ['staff', 'rod'], model: 'capsule',
  },
  {
    id: 'acolyte', name: 'Acolyte', tier: 1, requires: [], description: 'Healer and protector.',
    statMods: { hp: 0.9, mp: 1.6, atk: 0.7, mag: 1.2, def: 0.9, res: 1.25, spd: 1 }, move: 3, jump: 2,
    growth: { hp: 3, mp: 1.3, atk: 0.5, mag: 1.2, def: 0.6, res: 1, spd: 0.15 }, attack: 'staff',
    abilities: learn([['mend', 50], ['purify', 80], ['protect', 100], ['shell', 100], ['regen', 120], ['revive', 150], ['grace', 200], ['auto-mend', 250], ['sanctuary', 500]]),
    equip: ['staff'], model: 'capsule',
  },
  {
    id: 'thief', name: 'Thief', tier: 1, requires: [], description: 'Fast skirmisher who strikes from behind.',
    statMods: { hp: 0.9, mp: 0.8, atk: 1.05, mag: 0.7, def: 0.85, res: 0.9, spd: 1.25, evade: 3 }, move: 5, jump: 3,
    growth: { hp: 3, mp: 0.6, atk: 1.1, mag: 0.5, def: 0.6, res: 0.6, spd: 0.3, evade: 0.2 }, attack: 'strike',
    abilities: learn([['steal', 50], ['trip', 80], ['backstab', 100], ['blind-dust', 100], ['smoke', 150], ['vanish-step', 200], ['fleet', 200], ['shadow-step', 500]]),
    equip: ['dagger'], model: 'capsule',
  },
  {
    id: 'chemist', name: 'Chemist', tier: 1, requires: [], description: 'Throws potions and remedies; reliable support.',
    statMods: { hp: 1, mp: 1.2, atk: 0.9, mag: 1, def: 1, res: 1, spd: 1 }, move: 3, jump: 2,
    growth: { hp: 3.5, mp: 1, atk: 0.8, mag: 0.8, def: 0.8, res: 0.8, spd: 0.15 }, attack: 'strike',
    abilities: learn([['potion-toss', 50], ['antidote-toss', 60], ['ether', 80], ['phoenix-draught', 150], ['hi-potion', 200], ['throw-range', 200], ['auto-potion', 250], ['panacea-rain', 500]]),
    equip: ['dagger', 'gun'], model: 'capsule',
  },

  // ===== Advanced jobs (tier 2) =====
  {
    id: 'paladin', name: 'Paladin', tier: 2, requires: [{ job: 'squire', level: 3 }, { job: 'acolyte', level: 2 }], description: 'Holy knight who shields allies.',
    statMods: { hp: 1.25, mp: 0.9, atk: 1.05, mag: 1, def: 1.3, res: 1.2, spd: 0.95 }, move: 3, jump: 2,
    growth: { hp: 4, mp: 1, atk: 1, mag: 0.8, def: 1, res: 1, spd: 0.1 }, attack: 'strike',
    abilities: learn([['holy-strike', 100], ['shield-ally', 100], ['smite', 150], ['consecrate', 200], ['cover', 250], ['holy-bulwark', 600]]),
    equip: ['sword', 'shield'], model: 'capsule',
  },
  {
    id: 'spellblade', name: 'Spellblade', tier: 2, requires: [{ job: 'squire', level: 3 }, { job: 'mage', level: 3 }], description: 'Elemental swordplay fuelled by MP.',
    statMods: { hp: 1.1, mp: 1, atk: 1.15, mag: 1, def: 1.05, res: 1, spd: 1.05 }, move: 4, jump: 2,
    growth: { hp: 3.5, mp: 1, atk: 1.2, mag: 0.9, def: 0.8, res: 0.8, spd: 0.2 }, attack: 'strike',
    abilities: learn([['fire-blade', 100], ['frost-blade', 100], ['thunder-blade', 150], ['drain-blade', 200], ['arcane-edge', 250], ['elemental-fury', 600]]),
    equip: ['sword'], model: 'capsule',
  },
  {
    id: 'oracle', name: 'Oracle', tier: 2, requires: [{ job: 'mage', level: 3 }, { job: 'acolyte', level: 3 }], description: 'Bends the turn order: haste, slow, delay.',
    statMods: { hp: 0.9, mp: 1.7, atk: 0.7, mag: 1.3, def: 0.9, res: 1.3, spd: 1.1 }, move: 3, jump: 2,
    growth: { hp: 2.5, mp: 1.5, atk: 0.4, mag: 1.3, def: 0.6, res: 1.1, spd: 0.25 }, attack: 'staff',
    abilities: learn([['haste', 100], ['slow', 100], ['quicken', 200], ['delay', 200], ['foresight', 250], ['stasis', 600]]),
    equip: ['staff', 'rod'], model: 'capsule',
  },
  {
    id: 'ranger', name: 'Ranger', tier: 2, requires: [{ job: 'archer', level: 3 }, { job: 'thief', level: 2 }], description: 'Traps and long shots.',
    statMods: { hp: 1, mp: 1, atk: 1.1, mag: 0.7, def: 0.95, res: 0.9, spd: 1.15, evade: 1.5 }, move: 4, jump: 3,
    growth: { hp: 3, mp: 0.8, atk: 1.2, mag: 0.5, def: 0.7, res: 0.6, spd: 0.3, evade: 0.1 }, attack: 'shoot',
    abilities: learn([['snare-trap', 100], ['long-shot', 100], ['barbed-arrow', 150], ['hunters-volley', 200], ['pathfinder', 250], ['deadeye', 600]]),
    equip: ['bow'], model: 'capsule',
  },
  {
    id: 'saboteur', name: 'Saboteur', tier: 2, requires: [{ job: 'thief', level: 3 }, { job: 'chemist', level: 3 }], description: 'Mines, oil and poison: zone denial.',
    statMods: { hp: 0.95, mp: 1.1, atk: 1, mag: 0.9, def: 0.9, res: 0.95, spd: 1.15, evade: 2 }, move: 4, jump: 3,
    growth: { hp: 3, mp: 1, atk: 1, mag: 0.7, def: 0.7, res: 0.7, spd: 0.3, evade: 0.2 }, attack: 'strike',
    abilities: learn([['oil-slick', 100], ['sabotage', 120], ['land-mine', 150], ['poison-cloud', 150], ['elusive', 250], ['scorched-earth', 600]]),
    equip: ['dagger'], model: 'capsule',
  },
  {
    id: 'dragoon', name: 'Dragoon', tier: 2, requires: [{ job: 'squire', level: 4 }, { job: 'archer', level: 2 }], description: 'Leaps off the board and crashes down; ignores height.',
    statMods: { hp: 1.15, mp: 0.7, atk: 1.2, mag: 0.6, def: 1.15, res: 0.9, spd: 1 }, move: 4, jump: 4,
    growth: { hp: 3.5, mp: 0.5, atk: 1.3, mag: 0.4, def: 0.9, res: 0.6, spd: 0.15 }, attack: 'strike',
    abilities: learn([['jump', 150], ['spear-sweep', 120], ['dragon-heart', 250], ['leap', 250], ['dragon-dive', 600]]),
    equip: ['sword'], model: 'capsule',
  },
  {
    id: 'monk', name: 'Monk', tier: 2, requires: [{ job: 'squire', level: 2 }, { job: 'acolyte', level: 3 }], description: 'Unarmed fighter who heals with chi.',
    statMods: { hp: 1.15, mp: 0.8, atk: 1.2, mag: 0.8, def: 1, res: 1, spd: 1.1 }, move: 4, jump: 3,
    growth: { hp: 4, mp: 0.6, atk: 1.3, mag: 0.6, def: 0.8, res: 0.8, spd: 0.25 }, attack: 'pummel',
    abilities: learn([['wave-fist', 120], ['chakra', 150], ['second-wind', 200], ['martial-arts', 250], ['swift-feet', 250], ['hundred-fists', 600]]),
    equip: [], model: 'capsule',
  },
  {
    id: 'hexer', name: 'Hexer', tier: 2, requires: [{ job: 'mage', level: 3 }, { job: 'thief', level: 3 }], description: 'Curses, poisons and strips enemy buffs.',
    statMods: { hp: 0.85, mp: 1.6, atk: 0.7, mag: 1.3, def: 0.85, res: 1.2, spd: 1.1 }, move: 4, jump: 2,
    growth: { hp: 2.5, mp: 1.4, atk: 0.5, mag: 1.3, def: 0.5, res: 1, spd: 0.25 }, attack: 'staff',
    abilities: learn([['curse', 100], ['dispel', 120], ['hex-blind', 150], ['doom-bolt', 200], ['malice', 250], ['unravel', 600]]),
    equip: ['staff', 'rod'], model: 'capsule',
  },
  {
    id: 'grenadier', name: 'Grenadier', tier: 2, requires: [{ job: 'archer', level: 3 }, { job: 'chemist', level: 3 }], description: 'Bombs, oil and fire.',
    statMods: { hp: 1, mp: 1, atk: 1.1, mag: 0.8, def: 1, res: 0.9, spd: 1 }, move: 3, jump: 2,
    growth: { hp: 3.5, mp: 0.8, atk: 1.1, mag: 0.6, def: 0.8, res: 0.6, spd: 0.15 }, attack: 'shoot',
    abilities: learn([['frag-bomb', 100], ['oil-flask', 120], ['smoke-bomb', 150], ['firebomb', 200], ['demolitions', 250], ['carpet-bomb', 600]]),
    equip: ['bow', 'gun'], model: 'capsule',
  },
  {
    id: 'seer', name: 'Seer', tier: 2, requires: [{ job: 'archer', level: 3 }, { job: 'acolyte', level: 3 }], description: 'Marks targets and steadies allies.',
    statMods: { hp: 0.9, mp: 1.4, atk: 1, mag: 1.1, def: 0.9, res: 1.2, spd: 1.1 }, move: 4, jump: 2,
    growth: { hp: 3, mp: 1.2, atk: 1, mag: 1, def: 0.6, res: 0.9, spd: 0.25 }, attack: 'shoot',
    abilities: learn([['mark', 80], ['focus', 100], ['blessing', 150], ['true-shot', 200], ['third-eye', 250], ['prophecy', 600]]),
    equip: ['bow', 'staff'], model: 'capsule',
  },

  // ===== Elite jobs (tier 3) =====
  {
    id: 'templar', name: 'Templar', tier: 3, requires: [{ job: 'paladin', level: 4 }, { job: 'mage', level: 3 }], description: 'Holy-magic tank with party-wide wards.',
    statMods: { hp: 1.3, mp: 1.3, atk: 1.05, mag: 1.2, def: 1.3, res: 1.3, spd: 0.95 }, move: 3, jump: 2,
    growth: { hp: 4.5, mp: 1.2, atk: 1, mag: 1.1, def: 1.1, res: 1.1, spd: 0.1 }, attack: 'strike',
    abilities: learn([['holy-lance', 150], ['aegis', 200], ['judgment', 250], ['holy-ward', 300], ['divine-shield', 700]]),
    equip: ['sword', 'shield'], model: 'capsule',
  },
  {
    id: 'chronomancer', name: 'Chronomancer', tier: 3, requires: [{ job: 'oracle', level: 4 }, { job: 'thief', level: 3 }], description: 'Grants extra turns and steals the enemy\'s.',
    statMods: { hp: 0.9, mp: 1.8, atk: 0.7, mag: 1.35, def: 0.9, res: 1.3, spd: 1.25 }, move: 4, jump: 3,
    growth: { hp: 2.5, mp: 1.6, atk: 0.4, mag: 1.4, def: 0.6, res: 1.1, spd: 0.35 }, attack: 'staff',
    abilities: learn([['age', 150], ['time-slip', 200], ['quickstep', 250], ['time-sense', 300], ['time-loop', 700]]),
    equip: ['staff', 'rod'], model: 'capsule',
  },
  {
    id: 'runeknight', name: 'Runeknight', tier: 3, requires: [{ job: 'spellblade', level: 4 }, { job: 'acolyte', level: 3 }], description: 'Inscribes runes that empower allies standing on them.',
    statMods: { hp: 1.2, mp: 1.2, atk: 1.2, mag: 1.15, def: 1.15, res: 1.1, spd: 1.05 }, move: 4, jump: 2,
    growth: { hp: 4, mp: 1, atk: 1.2, mag: 1.1, def: 0.9, res: 0.9, spd: 0.2 }, attack: 'strike',
    abilities: learn([['rune-blade', 120], ['rune-of-power', 150], ['rune-ward', 150], ['runeburst', 250], ['runic-edge', 300], ['runic-storm', 700]]),
    equip: ['sword'], model: 'capsule',
  },

  // ===== Enemy-only jobs (tier 0): the 12+ enemy types (M7) =====
  enemy('grunt', 'Skeletal grunt.', { hp: 1, atk: 1, def: 1, spd: 0.95 }, 4, 2, 'strike', ['rend']),
  enemy('bone-archer', 'Skeletal archer.', { hp: 0.85, atk: 1, def: 0.85, spd: 1.1 }, 4, 2, 'shoot', ['pin-shot', 'aim'], 'sniper'),
  enemy('necromancer', 'Raises the dead and throws shadow.', { hp: 0.85, mp: 1.8, mag: 1.3, def: 0.8, res: 1.2 }, 3, 2, 'staff', ['dark-bolt', 'raise-dead'], 'coward'),
  enemy('wraith', 'Drifts over any terrain; freezing touch.', { hp: 0.9, mag: 1.2, def: 0.7, res: 1.3, spd: 1.2, evade: 4 }, 5, 9, 'chill-touch', [], 'berserker'),
  enemy('ghoul', 'Fast and poisonous.', { hp: 1.05, atk: 1.05, def: 0.9, spd: 1.2 }, 5, 3, 'infectious-bite', []),
  enemy('bone-golem', 'Huge and slow; slams the ground.', { hp: 2.2, atk: 1.3, def: 1.6, res: 0.8, spd: 0.6 }, 3, 1, 'strike', ['ground-slam']),
  enemy('cult-healer', 'Heals and shields the cult.', { hp: 0.9, mp: 1.6, mag: 1.2, res: 1.2 }, 3, 2, 'staff', ['mend', 'protect', 'revive'], 'healer'),
  enemy('shieldbearer', 'Covers allies and bashes foes back.', { hp: 1.4, atk: 0.9, def: 1.6, res: 1.1, spd: 0.85 }, 3, 2, 'strike', ['shield-bash', 'guard'], 'berserker', ['cover']),
  enemy('assassin', 'Strikes from behind, then slips away.', { hp: 0.85, atk: 1.2, def: 0.8, spd: 1.35, evade: 4 }, 5, 3, 'strike', ['backstab', 'smoke', 'blind-dust'], 'coward'),
  enemy('warlock', 'Curses and silences from afar.', { hp: 0.85, mp: 1.7, mag: 1.3, def: 0.8, res: 1.2 }, 3, 2, 'staff', ['curse', 'hex-blind', 'doom-bolt'], 'sniper'),
  enemy('firecaller', 'Hurls fireballs that ignite oil.', { hp: 0.85, mp: 1.7, mag: 1.35, def: 0.8, res: 1.1 }, 3, 2, 'staff', ['fireball', 'flame'], 'sniper'),
  enemy('sniper', 'Long-range marksman on high ground.', { hp: 0.85, atk: 1.15, def: 0.8, spd: 1.05 }, 3, 3, 'shoot', ['long-shot', 'true-shot'], 'sniper'),
  enemy('hexed-knight', 'A cursed knight that strikes back.', { hp: 1.3, atk: 1.2, def: 1.3, res: 1, spd: 0.95 }, 4, 2, 'strike', ['rally-strike', 'shove'], 'boss', ['counter']),
];

/** An enemy-only job: everything it knows is learned for free, so the AI uses it at once. */
function enemy(
  id: string,
  description: string,
  statMods: JobDef['statMods'],
  move: number,
  jump: number,
  attack: string,
  actions: string[],
  ai: NonNullable<JobDef['ai']> = 'berserker',
  passives: string[] = [],
): JobDef {
  const name = id.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
  return {
    id, name, tier: 0, requires: [], description, statMods, move, jump,
    growth: { hp: 3.5, mp: 1, atk: 1.1, mag: 1, def: 0.8, res: 0.8, spd: 0.2 },
    attack, abilities: learn([...actions, ...passives].map((a) => [a, 0])), equip: [], model: 'capsule', ai,
  };
}

export const JOBS: Record<string, JobDef> = Object.fromEntries(defs.map((j) => [j.id, j]));

/** Jobs a player unit can hold (enemy-only jobs excluded). */
export const PLAYER_JOBS = defs.filter((j) => j.tier > 0);
