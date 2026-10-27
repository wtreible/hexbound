import * as THREE from 'three';
import { faceToward, planTurn } from '../rules/ai';
import { areaTiles, previewAct, targetTiles, type TargetPreview } from '../rules/combat';
import { indexOf, neighbors, pathTo, posOf, reachable, tileAt, type Reach } from '../rules/grid';
import { ability, effectiveStats, jobOf } from '../rules/jobs';
import { HAZARD_NAMES, STATUS_NAMES } from './names';
import { applyIntent } from '../rules/reducer';
import type { Rng } from '../rules/rng';
import type { GameEvent, GameState, Intent, Unit } from '../rules/types';
import { findUnit, isEnemy, unitAt } from '../rules/units';
import { createBoard, type HighlightKind } from '../render/board';
import { createFx } from '../render/fx';
import type { SceneHandle } from '../render/scene';
import { createUnits } from '../render/units';
import { ACTION_KEYS, listActions, mountActionMenu, rankLine, sameAction, type ActionKey } from './actionMenu';
import { mountTimeline } from './timeline';

// Solo battle. In the player phase, pick an active unit (gold ring),
// then choose actions from the numbered command bar (or keys 1-9, 0, -, =): Move and
// click a blue tile, an ability and click a target, Wait and click a
// direction to face. Enemies then act through the AI. Every change goes
// through applyIntent so M3 can route it through the host. Q/E rotate, wheel
// or Z/X zoom, Esc or right-click backs out.

type Mode =
  | { kind: 'command'; unitId: string }
  | { kind: 'move'; unitId: string }
  | { kind: 'target'; unitId: string; abilityId: string }
  | { kind: 'facing'; unitId: string }
  | { kind: 'busy' }
  | { kind: 'over' };

const ENEMY_STEP_MS = 280;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BattleView = { dispose(): void };

/**
 * Mounts a battle on the shared scene and UI root. `onDone` gets the final
 * state when the player leaves the result screen; call dispose() afterwards.
 */
export function mountBattle(
  view: SceneHandle,
  appRoot: HTMLElement,
  initial: GameState,
  rng: Rng,
  onDone: (final: GameState) => void,
): BattleView {
  let state = initial;
  let mode: Mode = { kind: 'busy' };
  let hovered: number | null = null;

  // Everything this battle adds lives under these two roots, so dispose() is just removal.
  const world = new THREE.Group();
  view.scene.add(world);
  const uiRoot = document.createElement('div');
  appRoot.appendChild(uiRoot);
  const listeners = new AbortController();
  const { signal } = listeners;

  const { grid } = state;
  const board = createBoard(world, grid);
  const units = createUnits(world, grid);
  const fx = createFx(uiRoot, view.camera, view.renderer.domElement);
  units.sync(state.units);
  board.setHazards(state.hazards);
  view.lookAt(board.center);

  const timeline = mountTimeline(uiRoot);
  const menu = mountActionMenu(uiRoot, (key) => chooseAction(key));
  const hud = document.createElement('div');
  hud.className = 'panel hud';
  const banner = document.createElement('div');
  banner.className = 'banner';
  banner.hidden = true;
  uiRoot.append(hud, banner);

  const unit = (id: string) => findUnit(state.units, id)!;
  const activeEntry = (id: string) => (state.turn.phase === 'over' ? undefined : state.turn.active.find((a) => a.unitId === id));
  const activeIds = () => (state.turn.phase === 'player' ? state.turn.active.map((a) => a.unitId) : []);
  const selectedId = () => ('unitId' in mode ? mode.unitId : null);

  /** Where a freshly selected unit starts: Move until it has moved, then facing once it has done both. */
  const defaultMode = (unitId: string): Mode => {
    const entry = activeEntry(unitId);
    if (!entry?.moved) return { kind: 'move', unitId };
    return entry.acted ? { kind: 'facing', unitId } : { kind: 'command', unitId };
  };

  const chooseAction = (key: ActionKey) => {
    const id = selectedId();
    const entry = id ? activeEntry(id) : undefined;
    if (!id || !entry || mode.kind === 'busy' || mode.kind === 'over') return;
    const action = listActions(unit(id), entry).find((a) => sameAction(a.key, key));
    if (!action || action.disabled) return;
    if (mode.kind === 'facing') units.setFacing(id, unit(id).facing);
    if (key === 'move') mode = { kind: 'move', unitId: id };
    else if (key === 'wait') mode = { kind: 'facing', unitId: id };
    else mode = { kind: 'target', unitId: id, abilityId: key.abilityId };
    refresh();
  };

  // --- what the board shows for the current mode ---

  let reachCache: { key: string; reach: Reach } | null = null;
  const reachFor = (u: Unit): Reach => {
    const key = JSON.stringify([u.id, state.units.map((x) => [x.pos, x.dead, x.downedTurns])]);
    if (reachCache?.key !== key) reachCache = { key, reach: reachable(grid, state.units, u, effectiveStats(u)) };
    return reachCache.reach;
  };

  const targetPreview = (): TargetPreview[] => {
    if (mode.kind !== 'target' || hovered === null) return [];
    const u = unit(mode.unitId);
    const a = ability(mode.abilityId);
    const p = posOf(grid, hovered);
    if (!targetTiles(grid, a, u).some((t) => t.x === p.x && t.y === p.y)) return [];
    return previewAct(grid, state.units, u, a, p);
  };

  const refresh = () => {
    const highlights = new Map<number, HighlightKind>();
    const m = mode;
    if (m.kind === 'move') {
      const reach = reachFor(unit(m.unitId));
      for (const [i, node] of reach) highlights.set(i, node.canStop ? 'reach' : 'pass');
      const target = hovered !== null ? reach.get(hovered) : undefined;
      if (target?.canStop) for (const p of pathTo(grid, reach, target.pos)) highlights.set(indexOf(grid, p), 'path');
    } else if (m.kind === 'target') {
      const u = unit(m.unitId);
      const a = ability(m.abilityId);
      const tiles = targetTiles(grid, a, u);
      for (const p of tiles) highlights.set(indexOf(grid, p), 'range');
      const hp = hovered !== null ? posOf(grid, hovered) : null;
      if (hp && tiles.some((t) => t.x === hp.x && t.y === hp.y)) {
        for (const p of areaTiles(grid, a, u.pos, hp)) highlights.set(indexOf(grid, p), 'area');
      }
    } else if (m.kind === 'facing') {
      const u = unit(m.unitId);
      for (const n of neighbors(grid, u.pos)) highlights.set(indexOf(grid, n), 'facing');
      if (hovered !== null) units.setFacing(u.id, faceToward(u.pos, posOf(grid, hovered)));
    }
    board.setHighlights(highlights);
    board.setCursor(hovered !== null ? posOf(grid, hovered) : null);

    const sel = selectedId();
    units.setRings(sel, activeIds());
    board.setSelection(sel ? unit(sel).pos : null);
    const entry = sel ? activeEntry(sel) : undefined;
    const picked: ActionKey | null =
      m.kind === 'move' ? 'move' : m.kind === 'facing' ? 'wait' : m.kind === 'target' ? { abilityId: m.abilityId } : null;
    if (sel && entry) menu.show(unit(sel), entry, picked);
    else menu.hide();
    renderHud();
  };

  const renderHud = () => {
    const lines: { text: string; cls?: string }[] = [];
    if (hovered !== null) {
      const p = posOf(grid, hovered);
      const tile = tileAt(grid, p)!;
      const hazard = state.hazards.find((h) => h.pos.x === p.x && h.pos.y === p.y);
      const hazardText = hazard ? ` · ${HAZARD_NAMES[hazard.id]} (${hazard.rounds} rounds)` : '';
      lines.push({ text: `Tile ${p.x},${p.y} · ${tile.terrain} · height ${tile.height}${hazardText}` });
      const u = unitAt(state.units, p.x, p.y);
      if (u) {
        const s = effectiveStats(u);
        const statuses = u.statuses.map((x) => STATUS_NAMES[x.id]).join(', ');
        const downed = u.downedTurns !== undefined ? ` · DOWNED (${u.downedTurns} turns)` : '';
        const owner = isEnemy(u) ? ' (enemy)' : ` (${u.ownerId})`;
        lines.push({ text: `${u.name} · ${jobOf(u).name}${owner}${downed}${isEnemy(u) ? '' : ` · ${rankLine(u, u.job)}`}` });
        lines.push({ text: `HP ${u.hp}/${s.hp} · MP ${u.mp}/${s.mp} · Resolve ${u.resolve} · CT ${u.ct} · Move ${s.move} · Jump ${s.jump}${statuses ? ` · ${statuses}` : ''}` });
      }
    }
    for (const p of targetPreview()) {
      const parts = [];
      if (p.damage) parts.push(`${p.damage} dmg`);
      if (p.heal) parts.push(`+${p.heal} HP`);
      if (p.revive) parts.push('revive');
      if (!parts.length) parts.push('no effect');
      const chance = p.hitChance < 1 ? ` (${Math.round(p.hitChance * 100)}%)` : '';
      lines.push({ text: `→ ${p.unit.name}: ${parts.join(', ')}${chance}${p.downs ? ' · KO' : ''}`, cls: 'preview' });
    }
    const hints: Record<Mode['kind'], string> = {
      command: 'Pick an action (number keys) · Q/E rotate · wheel zoom',
      move: 'Click a blue tile to move · Esc back',
      target: 'Click an orange tile to use it · Esc back',
      facing: 'Click a direction to face and end the turn · Esc back',
      busy: '',
      over: '',
    };
    if (hints[mode.kind]) lines.push({ text: hints[mode.kind], cls: 'hint' });
    hud.hidden = lines.length === 0;
    hud.replaceChildren(
      ...lines.map(({ text, cls }) => {
        const div = document.createElement('div');
        div.textContent = text;
        if (cls) div.className = cls;
        return div;
      }),
    );
  };

  const showBanner = async (text: string, ms: number) => {
    banner.textContent = text;
    banner.hidden = false;
    await sleep(ms);
    banner.hidden = true;
  };

  // --- applying intents and playing back their events ---

  const popAt = (unitId: string, text: string, kind: Parameters<typeof fx.popup>[2]) => {
    const p = units.headPosition(unitId);
    if (p) fx.popup(p, text, kind);
  };

  const play = async (events: GameEvent[]) => {
    let impacts = false;
    for (const e of events) {
      switch (e.type) {
        case 'moved':
          await units.animateMove(e.unitId, e.path, unit(e.unitId).facing);
          break;
        case 'faced':
          units.setFacing(e.unitId, e.facing);
          break;
        case 'acted':
          popAt(e.unitId, ability(e.abilityId).name, 'info');
          await sleep(250);
          break;
        case 'damaged':
          popAt(e.unitId, String(e.amount), 'damage');
          impacts = true;
          break;
        case 'missed':
          popAt(e.unitId, 'Miss', 'miss');
          impacts = true;
          break;
        case 'healed':
          popAt(e.unitId, `+${e.amount}`, 'heal');
          impacts = true;
          break;
        case 'status':
          popAt(e.unitId, `${e.added ? '+' : '−'}${STATUS_NAMES[e.status]}`, 'info');
          break;
        case 'pushed':
          await units.animateMove(e.unitId, [e.from, e.to], unit(e.unitId).facing, { turn: false });
          break;
        case 'downed':
        case 'revived':
        case 'died':
          units.sync(state.units);
          popAt(e.unitId, e.type === 'downed' ? 'Down!' : e.type === 'revived' ? 'Revived' : 'Lost', 'info');
          impacts = true;
          break;
        case 'down-tick':
          popAt(e.unitId, `${e.turnsLeft} turns left`, 'info');
          break;
        case 'mp':
          if (e.amount) popAt(e.unitId, `${e.amount > 0 ? '+' : ''}${e.amount} MP`, 'info');
          break;
        case 'ct':
          popAt(e.unitId, `${e.delta > 0 ? '+' : ''}${e.delta} CT`, 'info');
          break;
        case 'hazard':
          board.setHazards(state.hazards);
          break;
        case 'triggered':
          popAt(e.unitId, HAZARD_NAMES[e.hazard], 'info');
          await sleep(200);
          break;
        case 'countered':
          popAt(e.unitId, 'Counter', 'info');
          await sleep(250);
          break;
        case 'covered':
          popAt(e.unitId, 'Cover', 'info');
          await sleep(250);
          break;
        case 'combo':
          await showBanner(ability(e.comboId).name + '!', 600);
          break;
        case 'jp':
          popAt(e.unitId, `+${e.amount} JP${e.rankUp ? (e.rank >= 3 ? ' · Mastered!' : ` · Rank ${e.rank}!`) : ''}`, 'info');
          break;
        case 'phase':
          if (impacts) await sleep(500);
          impacts = false;
          units.sync(state.units);
          await showBanner(e.phase === 'player' ? 'Player Phase' : 'Enemy Phase', 700);
          break;
        case 'battle-over':
        case 'turn-ended':
          break;
      }
    }
    if (impacts) await sleep(600);
  };

  const dispatch = async (intent: Intent): Promise<boolean> => {
    const result = applyIntent(state, intent, rng);
    if ('error' in result) {
      console.warn(`[battle] rejected ${intent.type} for ${intent.unitId}: ${result.error}`);
      return false;
    }
    state = result.state;
    await play(result.events);
    units.sync(state.units);
    board.setHazards(state.hazards);
    timeline.update(state);
    return true;
  };

  /** Runs one player intent, then hands control to the next phase. */
  const run = async (intents: Intent[], afterUnit: string) => {
    mode = { kind: 'busy' };
    refresh();
    for (const intent of intents) if (!(await dispatch(intent))) break;
    await settle(afterUnit);
  };

  /** Picks the mode for whatever phase the state is now in. */
  const settle = async (preferUnit?: string) => {
    while (state.turn.phase === 'enemy') {
      const unitId = state.turn.active[0]!.unitId;
      refresh();
      for (const intent of planTurn(state, unitId)) {
        await sleep(ENEMY_STEP_MS);
        // A rejected AI intent must not stall the battle: end that unit's turn.
        if (!(await dispatch(intent))) {
          await dispatch({ type: 'wait', unitId });
          break;
        }
        if (state.turn.phase !== 'enemy' || state.turn.active[0]?.unitId !== unitId) break;
      }
    }
    if (state.turn.phase === 'over') {
      mode = { kind: 'over' };
      refresh();
      showResult(state.turn.winner);
      return;
    }
    const ids = activeIds();
    const next = preferUnit && ids.includes(preferUnit) ? preferUnit : ids[0]!;
    mode = defaultMode(next);
    refresh();
  };

  const showResult = (winner: 'player' | 'enemy') => {
    const panel = document.createElement('div');
    panel.className = 'panel result';
    const title = document.createElement('h2');
    title.textContent = winner === 'player' ? 'Victory' : 'Defeat';
    const lost = state.units.filter((u) => !isEnemy(u) && u.dead).map((u) => u.name);
    const detail = document.createElement('p');
    detail.textContent = lost.length ? `Lost for good: ${lost.join(', ')}` : 'No one was lost.';
    const again = document.createElement('button');
    again.textContent = 'Return to camp';
    again.addEventListener('click', () => onDone(state));
    panel.append(title, detail, again);
    uiRoot.appendChild(panel);
  };

  // Esc / right-click: drop the picked action and return to the bar.
  const back = () => {
    if (mode.kind === 'move' || mode.kind === 'target' || mode.kind === 'facing') {
      const u = unit(mode.unitId);
      units.setFacing(u.id, u.facing);
      mode = { kind: 'command', unitId: u.id };
      refresh();
    }
  };

  // --- input ---

  const onClick = (i: number | null) => {
    if (i === null) return;
    const p = posOf(grid, i);
    const occupant = unitAt(state.units, p.x, p.y);
    const m = mode;
    // Clicking another ready unit switches to it (unless aiming at it).
    if ((m.kind === 'command' || m.kind === 'move') && occupant && occupant.id !== m.unitId && activeIds().includes(occupant.id)) {
      units.setFacing(m.unitId, unit(m.unitId).facing);
      mode = defaultMode(occupant.id);
      refresh();
      return;
    }
    switch (m.kind) {
      case 'move': {
        const node = reachFor(unit(m.unitId)).get(i);
        if (node?.canStop && occupant?.id !== m.unitId) void run([{ type: 'move', unitId: m.unitId, to: p }], m.unitId);
        return;
      }
      case 'target': {
        const u = unit(m.unitId);
        if (targetTiles(grid, ability(m.abilityId), u).some((t) => t.x === p.x && t.y === p.y)) {
          void run([{ type: 'act', unitId: u.id, abilityId: m.abilityId, target: p }], u.id);
        }
        return;
      }
      case 'facing': {
        const u = unit(m.unitId);
        const facing = faceToward(u.pos, p);
        void run([{ type: 'face', unitId: u.id, facing }, { type: 'wait', unitId: u.id }], u.id);
        return;
      }
    }
  };

  // Picking: a unit's body wins over the tile behind it, so tall units on
  // low tiles stay clickable from every camera angle.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickAt = (e: PointerEvent | MouseEvent): number | null => {
    const rect = view.renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, view.camera);
    const unitId = units.pick(raycaster);
    const u = unitId ? findUnit(state.units, unitId) : undefined;
    return u ? indexOf(grid, u.pos) : board.pick(raycaster);
  };

  // Re-pick every frame from the last pointer position so the cursor and
  // previews follow the board while the camera rotates under a still mouse.
  let pointer: PointerEvent | null = null;
  view.onFrame = (dt) => {
    units.update(dt);
    const i = pointer ? pickAt(pointer) : null;
    if (i !== hovered) {
      hovered = i;
      refresh();
    }
  };

  const canvas = view.renderer.domElement;
  canvas.addEventListener(
    'pointermove',
    (e) => {
      pointer = e;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerleave',
    () => {
      pointer = null;
    },
    { signal },
  );
  canvas.addEventListener('click', (e) => onClick(pickAt(e)), { signal });
  canvas.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
      back();
    },
    { signal },
  );
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.zoom(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false, signal },
  );
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key.toLowerCase()) {
      case 'q':
        view.rotate(-1);
        break;
      case 'e':
        view.rotate(1);
        break;
      case 'z':
        view.zoom(1);
        break;
      case 'x':
        view.zoom(-1);
        break;
      case 'w':
        chooseAction('wait');
        break;
      case 'escape':
        back();
        break;
      default: {
        // Number keys (then 0, -, =) pick the matching command bar action.
        const index = ACTION_KEYS.indexOf(e.key);
        const id = selectedId();
        const entry = id ? activeEntry(id) : undefined;
        if (index < 0 || !id || !entry) break;
        const action = listActions(unit(id), entry)[index];
        if (action) chooseAction(action.key);
      }
    }
  }, { signal });

  timeline.update(state);
  void settle();

  return {
    dispose() {
      listeners.abort();
      view.onFrame = null;
      view.scene.remove(world);
      uiRoot.remove();
    },
  };
}
