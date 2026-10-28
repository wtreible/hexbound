import { ABILITIES } from '../data/abilities';
import { JOBS } from '../data/jobs';
import { RELICS } from '../data/relics';
import { relicUnlocked, type Profile } from '../rules/profile';
import { button, el, screen } from './dom';

// The Codex (docs/DESIGN.md §6.7): every player job by tier. Jobs a unit has
// held or unlocked show their abilities and JP prices; the rest show only
// what opens them. Relics list their unlock hints.

const TIER_NAMES = ['', 'Starting jobs', 'Advanced jobs', 'Master jobs'];
const KIND_NAMES: Record<string, string> = { action: 'Action', reaction: 'Reaction', support: 'Support', movement: 'Movement', ultimate: 'Ultimate' };

export function mountCodex(root: HTMLElement, profile: Profile, onBack: () => void): { dispose(): void } {
  const s = screen(root, 'codex-screen');
  const panel = el('div', 'panel codex-panel');
  const seen = Object.values(JOBS).filter((j) => j.tier > 0 && profile.seenJobs.includes(j.id)).length;
  const total = Object.values(JOBS).filter((j) => j.tier > 0).length;
  panel.append(
    el('h2', '', 'Codex'),
    el('p', 'hint', `${seen}/${total} jobs discovered · ${profile.runs} runs · ${profile.wins} wins`),
    button('Back', onBack, { className: 'codex-back' }),
  );

  for (const tier of [1, 2, 3]) {
    panel.append(el('h3', '', TIER_NAMES[tier]!));
    const grid = el('div', 'codex-grid');
    for (const j of Object.values(JOBS).filter((x) => x.tier === tier)) {
      const known = profile.seenJobs.includes(j.id);
      const card = el('details', known ? 'codex-job' : 'codex-job unknown');
      const needs = j.requires.map((r) => `${JOBS[r.job]!.name} Lv ${r.level}`).join(', ');
      const summary = el('summary');
      summary.append(el('span', 'name', known ? j.name : '???'));
      if (profile.masteredJobs.includes(j.id)) summary.append(el('span', 'mastered', '★ Mastered'));
      if (tier === 1 && profile.startingJobs.includes(j.id)) summary.append(el('span', 'tag', 'Draftable'));
      card.append(summary);
      if (needs) card.append(el('div', 'needs', `Needs ${needs}`));
      if (known) {
        card.append(el('div', 'desc', j.description));
        const list = el('div', 'codex-abilities');
        for (const { abilityId, jp } of j.abilities) {
          const a = ABILITIES[abilityId]!;
          const row = el('div', 'codex-ability');
          row.title = a.description;
          row.append(el('span', 'kind', KIND_NAMES[a.kind] ?? a.kind), el('span', 'label', a.name), el('span', 'detail', `${jp} JP`));
          list.append(row);
        }
        card.append(list);
      }
      grid.append(card);
    }
    panel.append(grid);
  }

  panel.append(el('h3', '', 'Relics'));
  const relics = el('div', 'codex-relics');
  for (const r of RELICS.filter((x) => x.id !== 'none')) {
    const open = relicUnlocked(profile, r);
    relics.append(el('div', open ? 'codex-relic' : 'codex-relic unknown', open ? `${r.name}: ${r.description}` : `??? · ${r.unlock?.hint ?? ''}`));
  }
  panel.append(relics);
  s.append(panel);
  return { dispose: () => s.remove() };
}
