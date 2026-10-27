# Hexbound Company — Design & Handoff Document

> A co-op tactics roguelike for 2–4 players, played in the browser and hosted for free on GitHub Pages.
> FFT-style job system, 15 hybrid classes, chibi 3D units on blocky height-mapped grids.

This document is the source of truth for starting the build. A fresh Claude Code session should read it in full, then work through **§12 Milestones** in order. Each milestone has acceptance criteria. Don't start a milestone until the previous one meets its criteria.

---

## 1. Pillars

1. **Combine jobs into hybrids.** The class grid is what players explore. Every pair of base jobs makes something new.
2. **Co-op is the default.** Simultaneous planning, cross-player combo abilities, a shared run. Solo play is co-op with one player.
3. **Short runs, permanent stakes.** A run is 45–60 minutes. Units can die permanently. Meta-unlocks expand options, not raw power.
4. **Zero infrastructure.** Static files on GitHub Pages. No game server, no accounts, no paid services.
5. **The FFT feel.** Orthographic isometric camera that rotates in 90° steps, height tiers that matter, a CT-style turn timeline, chibi proportions.

## 2. Hard constraints

| Constraint | Consequence |
|---|---|
| Hosted on GitHub Pages (static only) | No Node server. Multiplayer is **peer-to-peer over WebRTC**, and the **host's browser is authoritative**. |
| Free assets only | Prefer CC0. CC-BY is allowed with attribution. Avoid CC-BY-SA/GPL art unless we accept the share-alike terms. Every asset gets a line in `CREDITS.md`. |
| No ripped or derivative Square Enix assets | "FFT vibe" comes from camera, proportions, palette and UI layout, never from copied sprites, names, music or the FFT logo/font. Job names like "Squire" and "Chemist" are generic words, but avoid FFT-unique terms (e.g. "Ivalice", "Zodiac Braves", "Brave/Faith" as stat names). |
| Runs in a browser tab | Target 60fps on a mid laptop with integrated graphics; keep the draw budget small (≤ 16 units, ≤ 20×20 maps). |

## 3. Tech stack

- **Language:** TypeScript (strict).
- **Build:** Vite. `base: '/hexbound/'` in `vite.config.ts` for project Pages (must match the repo name).
- **Rendering:** Three.js with an `OrthographicCamera`. Glb models loaded via `GLTFLoader`; animations via `AnimationMixer`.
- **UI:** Plain DOM overlay (HTML/CSS) over the canvas for menus, turn timeline, ability lists and tooltips. Recommend Preact if components grow; don't start with a framework.
- **Networking:** [Trystero](https://github.com/dmotz/trystero), which handles WebRTC with serverless signaling over public Nostr relays, MQTT or BitTorrent trackers. Fallback: PeerJS using its free public broker.
- **State:** Plain serializable objects. No classes in game state. Easy to diff, send over the network and save.
- **RNG:** Seeded PRNG (e.g. `mulberry32` or `sfc32`, ~10 lines, write it ourselves).
- **Tests:** Vitest for `rules/`. Rules code must be testable without a DOM or WebGL.
- **Deploy:** GitHub Actions, using `actions/upload-pages-artifact` and `actions/deploy-pages`, on push to `main`.

**Assumption to verify early (M0):** Trystero's default signaling strategy works from a `github.io` origin without extra config. If it doesn't, try another strategy (`mqtt`, `torrent`) before falling back to PeerJS.

## 4. Repository layout

```
hexbound/
  DESIGN.md            ← this file
  CLAUDE.md            ← short pointer + conventions (create in M0)
  CREDITS.md           ← every third-party asset: name, author, URL, license
  index.html
  vite.config.ts
  public/
    models/            ← .glb characters, props
    tiles/             ← tile textures / tile models
    audio/
  src/
    rules/             ← PURE game logic. No DOM, no Three.js, no network.
      types.ts
      rng.ts
      grid.ts          ← tiles, height, pathfinding, line of sight
      turn.ts          ← CT timeline, phases
      combat.ts        ← damage, hit chance, facing, height modifiers
      abilities.ts     ← ability resolution engine (effects pipeline)
      jobs.ts          ← JP, mastery, unlock checks
      ai.ts            ← enemy action scoring
      run.ts           ← run map generation, nodes, rewards
      reducer.ts       ← applyIntent(state, intent) -> { state, events }
    data/              ← JSON/TS data, no logic
      jobs.ts
      abilities.ts
      enemies.ts
      maps/            ← hand-authored battle map templates
    net/
      session.ts       ← host/join, room codes, peer list
      protocol.ts      ← message types + version
      host.ts          ← authoritative loop
      client.ts        ← intent sender, state receiver, prediction for previews
    render/
      scene.ts         ← camera, lights, rotation
      board.ts         ← tile meshes, highlights, cursor
      units.ts         ← model loading, animation, facing
      fx.ts            ← hit numbers, spell effects
    ui/
      hud.ts, timeline.ts, actionMenu.ts, runMap.ts, lobby.ts, camp.ts
    main.ts
  tests/
```

**Rule:** `src/rules` imports nothing from `render`, `ui` or `net`. Everything else may import `rules`.

## 5. Game structure

### 5.1 Run flow
```
Lobby → Squad draft → Run map (≈12 nodes, 3 acts) → Boss → Results → (meta unlocks)
```
- **Squad:** 4 units total, split across players (1 player: 4 units; 2 players: 2 each; 3 players: 2/1/1 + host picks; 4 players: 1 each).
- **Run map:** Slay-the-Spire-style branching DAG, 3 acts × 4–5 rows. Players **vote** on the next node; ties are broken by the host.
- **Node types:**
  - **Battle:** standard skirmish.
  - **Elite:** harder battle with better rewards.
  - **Camp:** change jobs, rest (heal 50%), swap equipment.
  - **Shop:** gear and consumables, paid from shared gold.
  - **Recruit:** replace a dead unit; the recruit joins at the squad's average level minus 1.
  - **Shrine:** a random event with a choice.
  - **Boss:** end of each act.

### 5.2 Battle flow
1. **Deploy phase:** players place units on highlighted start tiles.
2. **Timeline:** every unit has `ct` (charge time). Each tick adds `speed` to `ct`. A unit at ≥ 100 is ready.
3. **Player phase:** all ready player units act during **simultaneous planning** (see §7.3). Each unit can **Move** and **Act** once, in either order, then pick a facing. Waiting without moving or acting leaves more CT for the next turn (`ct` carries over 60, or 80 if the unit didn't move or act).
4. **Enemy phase:** ready enemies act in CT order.
5. **Objectives:** Rout (defeat all), Leader (defeat the marked enemy), Escort, Hold (control tiles for N rounds), Escape (reach an exit).
6. **Downed units:** at 0 HP a unit is downed and shows a 3-turn counter. Revive before it runs out or the unit is **permanently lost** (it becomes a grave marker that can be looted for one item).

### 5.3 Combat math (starting values; tune later)
- `damage = max(1, round((atk_or_mag * power) - def_or_res) * modifiers)`
- **Height:** +10% damage per height tier the attacker is above the target (cap +30%). Bows and guns get +1 range per 2 tiers above.
- **Facing:** attacks from the side get +15% hit and +10% damage. From behind: +30% hit and +25% damage.
- **Base hit:** 90% for physical, 100% for most magic. Evasion is modified by facing.
- **Spells with a charge time:** they resolve after N ticks on the targeted **tiles**, not on the unit, so targets can walk out of the area (FFT-style). Show these as a ground marker and on the timeline.

### 5.4 Stats
`hp, mp, atk, mag, def, res, spd, move, jump, evade`. Each job applies multipliers to a unit's base stats plus a fixed move/jump value. Level-ups add base stats according to the unit's **current** job's growth table (the FFT idea: what you level as matters, lightly).

## 6. Job system

### 6.1 Slots
Each unit has:
- **Primary job:** sets the unit's stats, the primary action set and what equipment it can use.
- **Secondary action set:** any action set from a job this unit has reached Rank 1 in.
- **Passive:** one learned passive from any job (reactions such as Counter, and supports such as +1 Move).
- **Ultimate:** each mastered job grants one ultimate, which uses a "Resolve" meter that fills as the unit takes or deals damage. You equip one ultimate at a time.

### 6.2 Progression
- **JP** are earned per action taken in battle (+8 to +12) plus a battle clear bonus (+20), credited to the unit's current job.
- **Ranks:** 0 → 1 (60 JP) → 2 (150 JP) → **Mastered** (300 JP). Each rank unlocks abilities in that job.
- **Tuning target:** a base job can be mastered in about 3 battles, which gives 2–3 job changes per unit per run.
- Job changes happen **only at Camp nodes**.

### 6.3 Base jobs (6)

| Job | Role | Action set (Rank 0 / 1 / 2) | Passive | Ultimate |
|---|---|---|---|---|
| **Squire** | Frontline | Rally Strike / Guard / Shove (knockback 1) | Counter | Last Stand |
| **Archer** | Ranged physical | Aim / Pin Shot (−move) / Volley (AoE) | Eagle Eye (+1 range) | Rain of Arrows |
| **Mage** | Ranged magic | Flame / Frost (slow) / Spark (chain) | Mana Well (+MP regen) | Meteor |
| **Acolyte** | Healer | Mend / Purify / Revive | Grace (heal +20%) | Sanctuary |
| **Thief** | Mobility | Steal / Backstab / Smoke (evade zone) | Fleet (+1 move) | Shadow Step |
| **Chemist** | Items | Potion Toss / Ether / Phoenix Draught | Throw Range +2 | Panacea Rain |

### 6.4 Hybrid classes (15)
Unlocked for a unit when it has **mastered both** parent jobs. Each hybrid has its own action set (4 abilities), one passive and one ultimate, and can use either parent's action set as its secondary.

| Parents | Hybrid | Identity |
|---|---|---|
| Squire + Archer | **Dragoon** | Jump attacks that leave the board and land N ticks later; ignores height. |
| Squire + Mage | **Spellblade** | Weapon strikes that carry an element; drains MP to boost damage. |
| Squire + Acolyte | **Paladin** | Takes hits meant for adjacent allies; holy damage. |
| Squire + Thief | **Duelist** | Ripostes and position swaps; punishes isolated enemies. |
| Squire + Chemist | **Field Medic** | Heals while moving; drags downed allies to safety. |
| Archer + Mage | **Arcane Archer** | Elemental arrows; spells that use bow range and line of sight. |
| Archer + Acolyte | **Seer** | Reveals intents, predicts enemy actions, buffs hit chance. |
| Archer + Thief | **Ranger** | Traps; sets up overwatch shots that fire when enemies move. |
| Archer + Chemist | **Grenadier** | Thrown and fired bombs; terrain hazards (fire, oil). |
| Mage + Acolyte | **Oracle** | Time magic: Haste, Slow, Stop, CT manipulation. |
| Mage + Thief | **Hexer** | Curses, damage over time, lifting buffs from enemies. |
| Mage + Chemist | **Alchemist** | Converts items into spells; transmutes terrain tiles. |
| Acolyte + Thief | **Monk** | Unarmed combos; chi heals; extra Move. |
| Acolyte + Chemist | **Apothecary** | Stronger, longer-lasting buffs; cleanses everything. |
| Thief + Chemist | **Saboteur** | Mines, oil slicks, poison clouds; zone denial. |

### 6.5 Prestige classes (tier 3, ship 4 first)
Unlocked by mastering a hybrid plus the one listed base job.

| Requirement | Prestige | Identity |
|---|---|---|
| Paladin + Mage | **Templar** | Holy-magic tank; party-wide shields. |
| Ranger + Chemist | **Beastmaster** | Tames a defeated enemy as a pet unit for the battle. |
| Oracle + Thief | **Chronomancer** | Takes an extra turn; rewinds one unit's last action. |
| Spellblade + Acolyte | **Runeknight** | Writes runes on tiles; ally weapons pick up the rune's effect. |

### 6.6 Cross-player combos (multiplayer only)
These trigger only when the two units are **controlled by different players**, so they need coordination. Show them in the planning preview with a link icon.

| Combo | Trigger | Effect |
|---|---|---|
| **Channel** | A Spellblade attacks while next to an ally Mage who planned a spell this phase | The spell is delivered through the strike: single target, +50% damage, no charge time. |
| **Ignite** | A Grenadier or Mage fire ability hits a Saboteur's oil tile | The oil explodes in a radius-2 AoE and leaves burning terrain for 2 rounds. |
| **Pincer** | Two allies attack the same target from opposite sides in the same phase | Both hits count as attacks from behind. |
| **Aegis Link** | A Paladin guards an ally who is being healed by an Acolyte line unit | The heal is mirrored onto the Paladin. |
| **Volley Mark** | A Seer marks a target, then an Archer line unit fires at it | The shot can't miss and pierces to the next enemy. |

Start with these 5. They're data-driven (§8), so you can add more later without changing engine code.

### 6.7 Meta progression (between runs, stored in `localStorage`)
- When a base job is mastered for the first time in any run, it's added to the pool of starting jobs. New profiles start with Squire, Archer and Acolyte.
- When a hybrid is unlocked for the first time, its codex entry and art appear in the Codex screen.
- New shrine events and new starting relics (minor perks, not stat inflation).
- In multiplayer, each player's own profile controls which jobs **they** can draft.

## 7. Multiplayer

### 7.1 Topology
- **Host-authoritative peer-to-peer star.** The host's browser runs `rules/reducer.ts` and owns the canonical state. Clients send **intents**; the host validates them, applies them and broadcasts **events plus a state hash** (with a full snapshot on join or desync).
- Solo play is the host with zero peers. **The same code path runs offline.** This is important: it means single-player always exercises the networking logic.

### 7.2 Session
- The host clicks *Host*, which generates a 5-character room code (letters only, no lookalike characters such as O/0 or I/1). Joining means entering the code.
- Trystero `joinRoom({ appId: 'hexbound-v1' }, roomCode)`.
- Build a **lobby** showing players, ready state and the squad draft.
- **Disconnect:** the AI takes over that player's units. Rejoining with the same profile ID returns control.
- **Host leaves:** the run ends for everyone, but autosave lets the host resume later (clients rejoin with the same code). Host migration is **out of scope**.

### 7.3 Simultaneous planning
- During the player phase each player plans actions for their ready units. A plan is a list of intents that hasn't been committed yet.
- Plans are broadcast as **previews**: other players see a ghost path, the target tiles and the predicted outcome.
- When every player has hit **Ready**, the host resolves plans in timeline order (CT order, ties broken by player-slot order). It then checks for cross-player combos and broadcasts the results.
- If a plan becomes invalid during resolution (for example its target is already dead), the unit falls back to a **retarget prompt** for that player only. Everyone else watches.

### 7.4 Protocol (`net/protocol.ts`)
```ts
type Msg =
  | { t: 'hello'; v: number; profileId: string; name: string }
  | { t: 'snapshot'; state: GameState; hash: string }
  | { t: 'plan'; playerId: string; intents: Intent[] }    // preview only
  | { t: 'ready'; playerId: string; ready: boolean }
  | { t: 'commit'; playerId: string; intents: Intent[] }
  | { t: 'events'; seq: number; events: GameEvent[]; hash: string }
  | { t: 'vote'; playerId: string; nodeId: string }
  | { t: 'resync-request' };
```
- `v` is the protocol version. If the client and host don't match, the client gets a "please refresh" message.
- After applying `events`, the client compares its state hash with `hash`. On a mismatch it sends `resync-request`.

### 7.5 Known risks
- **NAT traversal:** public STUN servers are free, but TURN servers are not. Some combinations of networks (symmetric NAT, strict corporate Wi-Fi) will fail to connect. Show a clear error, and document that one player can try a phone hotspot. Paid TURN is out of scope.
- **Public signaling relays** can be slow or go down. Make the Trystero strategy configurable in one place.

## 8. Data model (sketch for `rules/types.ts`)

```ts
type JobId = string;      // 'squire', 'spellblade', ...
type AbilityId = string;

interface JobDef {
  id: JobId;
  name: string;
  tier: 1 | 2 | 3;
  requires: JobId[];                 // [] for base, two for hybrid, [hybrid, base] for prestige
  statMods: Partial<Record<Stat, number>>;
  move: number; jump: number;
  growth: Partial<Record<Stat, number>>;
  actionSet: { abilityId: AbilityId; rank: 0 | 1 | 2 | 3 }[];
  passives: AbilityId[];
  ultimate: AbilityId;
  equip: EquipTag[];
  model: string;                     // key into asset manifest
}

interface AbilityDef {
  id: AbilityId;
  name: string;
  kind: 'action' | 'passive' | 'ultimate' | 'combo';
  cost?: { mp?: number; item?: string; resolve?: number };
  range: { min: number; max: number; los: boolean; heightBonus?: boolean };
  area: { shape: 'single' | 'cross' | 'diamond' | 'line' | 'cone'; size: number };
  chargeTicks?: number;              // >0 = delayed, targets tiles
  effects: Effect[];                 // pipeline, resolved in order
  trigger?: ComboTrigger;            // for kind === 'combo' and reactions
  tags: string[];                    // 'fire', 'physical', 'holy', ...
}

type Effect =
  | { type: 'damage'; stat: 'atk' | 'mag'; power: number; element?: Element }
  | { type: 'heal'; stat: 'mag'; power: number }
  | { type: 'status'; status: StatusId; chance: number; duration: number }
  | { type: 'push'; distance: number }
  | { type: 'terrain'; terrain: TerrainId; duration: number }
  | { type: 'ct'; delta: number }
  | { type: 'revive'; hpPct: number }
  | { type: 'summon'; enemyId: string };

interface Unit {
  id: string; ownerId: string | 'enemy';
  name: string; level: number;
  base: Record<Stat, number>;
  hp: number; mp: number; ct: number; resolve: number;
  pos: { x: number; y: number }; facing: 0 | 1 | 2 | 3;
  job: JobId; secondary?: JobId; passive?: AbilityId; ultimate?: AbilityId;
  jp: Record<JobId, number>;          // JP per job
  statuses: { id: StatusId; turns: number }[];
  downedTurns?: number;
}

type Intent =
  | { type: 'move'; unitId: string; to: Pos }
  | { type: 'act'; unitId: string; abilityId: AbilityId; target: Pos }
  | { type: 'face'; unitId: string; facing: 0 | 1 | 2 | 3 }
  | { type: 'wait'; unitId: string };

// rules/reducer.ts
function applyIntent(state: GameState, intent: Intent, rng: Rng):
  { state: GameState; events: GameEvent[] } | { error: string };
```

**Rule:** abilities never contain custom code. If a new ability needs a new behavior, add a new `Effect` type to the pipeline. This keeps the 15 hybrids and their combos cheap to build.

**Grid and movement conventions (settled in M1):**
- Grid coordinates are `{ x, y }`, stored row-major (`tiles[y * width + x]`). In world space, grid `y` maps to `z`.
- Facing: `0` north (−y), `1` east (+x), `2` south (+y), `3` west (−x). After a move, a unit faces along its last step.
- Movement is 4-directional BFS, one step per tile. A step is legal when the height difference, **up or down**, is at most `jump` (in tiers). Water isn't walkable.
- Units can pass through allies (same `ownerId`) but not stop on them, and cannot pass through other owners' units.
- Map templates in `src/data/maps/` are rows of characters: `'0'`–`'9'` is height in tiers, `'~'` is water. Land terrain comes from height for now.

## 9. Art, audio and assets

### 9.1 Visual target
- **Camera:** orthographic, at about 30° elevation, rotating in 90° steps with Q/E and a smooth 250ms tween. Zoom in 3 steps.
- **Maps:** blocky tiles with height tiers (one tier = 0.5 tile height), a top texture plus darker side faces, like FFT's chunky dioramas.
- **Units:** chibi low-poly characters (big head, short body), about 1 tile tall. Show a floating job icon above the unit's head when it's selected.
- **Palette:** warm, desaturated earth tones, parchment-colored UI panels with a thin gold border, serif headings. Pick fonts from Google Fonts with OFL licenses (e.g. *Cinzel* for headings, *Alegreya* for body text).
- **Hit numbers:** they float up and bounce, using the FFT-style white-with-outline look.

### 9.2 Asset sources (all must be verified at download time)
These are starting points I believe are CC0. **Check the license file in every download** before committing it, and record it in `CREDITS.md`.

| Source | What to use | Expected license |
|---|---|---|
| **KayKit** by Kay Lousberg (kaylousberg.itch.io) | *Adventurers* character pack (knight, mage, rogue, barbarian, rigged and animated), *Skeletons* for enemies, *Dungeon Remastered* / *Medieval* for props | CC0 |
| **Quaternius** (quaternius.com) | Low-poly RPG characters and monsters, animated; nature and props | CC0 |
| **Kenney** (kenney.nl) | Tile textures, UI panels and icons (*Game Icons*, *UI Pack RPG Expansion*), sound effects (*RPG Audio*, *Impact Sounds*) | CC0 |
| **game-icons.net** | Ability and job icons (SVG) | CC-BY 3.0, so **attribution required** |
| **OpenGameArt.org** | Music (filter by CC0/CC-BY), extra SFX | Varies; check each asset |
| **Poly Pizza** (poly.pizza) | Filler props | Varies per model (CC0/CC-BY); check each |

**Getting variety for 21+ job looks from a few base models:**
- Recolor materials per job: tint the base model's material using a per-job palette in `data/jobs.ts`.
- Swap attachments: put a weapon or hat glb on the hand or head bone (KayKit and Quaternius rigs have named bones). A hybrid uses one parent's body plus the other parent's weapon, so the combination is visible on the model.
- Tier 3 classes get a cape or aura particle effect.

### 9.3 Asset pipeline
- `public/models/manifest.json` maps logical keys to file paths and the bone names used for attachments.
- Keep each glb ≤ 1.5 MB. Run `gltf-transform` (npm `@gltf-transform/cli`) for meshopt compression and texture resize as an npm script.
- Add placeholder colored capsules in M1 so rendering never blocks on assets.

## 10. Enemy AI (`rules/ai.ts`)
- For each ready enemy, enumerate every (reachable tile × ability × target) combination and score it:
  `score = expectedDamage * w1 + kills * w2 + healingValue * w3 - dangerAtTile * w4 + objectiveValue * w5`
- `dangerAtTile` is the sum of the max damage player units could deal to that tile next turn (cache this per phase).
- Each enemy archetype has its own weight preset (berserker, coward, healer, sniper, boss).
- Budget: < 50ms per enemy turn on a 20×20 map. Prune options with movement range first.
- The same AI controls disconnected players' units, using a "cautious ally" preset.

## 11. Persistence & deploy
- **Saves:** `localStorage['hexbound:profile']` holds meta unlocks, name and profile ID. `localStorage['hexbound:run']` holds the host's current run state plus seed, autosaved after every battle and node. Wrap every access in try/catch.
- **Version field** on saves. On a mismatch, discard the run save and keep the profile.
- **Deploy:** `.github/workflows/deploy.yml` runs `npm ci && npm test && npm run build` and then deploys `dist/` to Pages. Set Pages source to "GitHub Actions" in the repo settings.

## 12. Milestones

Each milestone ends in a playable, deployed build.

**M0: Skeleton & deploy**
- Vite + TS + Three.js project, `CLAUDE.md`, `CREDITS.md`, GitHub Actions deploy.
- Trystero smoke test: two browser tabs on the deployed `github.io` URL join the same room code and exchange a ping.
- *Done when:* the live URL shows a rotating cube, and two tabs log each other's pings.

**M1: Board & movement (hot-seat)**
- Grid with height, orthographic camera with 90° rotation, tile picking with the mouse.
- BFS movement range that respects `move` and `jump`, path preview, placeholder capsule units.
- *Done when:* you can select a unit, see its reachable tiles, move it, and rotate the camera without picking breaking.

**M2: Combat core**
- CT timeline, Move/Act/Face/Wait, basic attack, damage, height and facing modifiers, downed and permadeath rules.
- 3 base jobs (Squire, Archer, Acolyte) defined as data, using the effect pipeline.
- Basic AI with the berserker preset.
- Vitest coverage for damage math, pathfinding, the timeline and the reducer.
- *Done when:* a solo 4v4 Rout battle can be won or lost from start to finish.

**M3: Networked battle**
- Host/client sessions, lobby, intents → events → state hash flow, snapshot on join.
- Simultaneous planning with ghost previews and Ready-up.
- AI takeover on disconnect, rejoin.
- *Done when:* two players on different networks finish a battle together on the live URL, and a forced desync (devtools) recovers.

**M4: Jobs & progression**
- All 6 base jobs, JP, ranks, mastery, the secondary slot, passives, ultimates and Resolve.
- First 5 hybrids: Paladin, Spellblade, Oracle, Ranger, Saboteur.
- First 2 cross-player combos: Channel and Ignite.
- *Done when:* a unit can master two jobs over several test battles (use a debug JP button) and switch to the hybrid.

**M5: The run**
- Run map DAG, voting, Camp/Shop/Recruit/Shrine nodes, 3 acts, 3 bosses.
- Delayed (charge-time) spells resolving on tiles, the rest of the status effects, all 5 objective types.
- Autosave and resume.
- *Done when:* a full 2-player run from lobby to final boss can be played and resumed after a host refresh.

**M6: Art pass**
- Swap capsules for KayKit/Quaternius models, recolors and attachments, animations (idle, walk, attack, cast, hit, downed).
- Tile textures, UI skin, fonts, SFX, music.
- *Done when:* screenshots look the way §9.1 describes.

**M7: Content complete**
- All 15 hybrids, 4 prestige classes, all 5 cross-player combos.
- Meta progression and the Codex screen.
- 12+ enemy types, 15+ map templates.
- *Done when:* balance passes are the only work left.

## 13. Out of scope (for now)
- PvP. Planned as a later mode that reuses the battle engine with a squad draft from the class grid.
- Host migration, paid TURN servers, accounts, cloud saves, mobile touch controls (keep layouts from breaking on small screens, but don't design for touch).

## 14. Open questions
1. **Square or hex grid?** This doc assumes square (true to FFT). The name "Hexbound" refers to curses, not the grid shape.
2. **Should units carry between runs** (a roster) or should every run start fresh? Currently: fresh units, with meta unlocks only.
3. ~~**Repo name and Pages URL.**~~ Resolved: the repo is `wtreible/hexbound` (lowercase, since Pages URLs are case-sensitive), served at `https://wtreible.github.io/hexbound/` (`base: '/hexbound/'`). The game's title stays "Hexbound".

## 15. Conventions for the Claude Code session
- Read this file first. Keep it updated when a decision changes; don't let code and doc drift apart.
- `src/rules` stays pure and fully unit-tested. Run `npm test` before every commit.
- New content (jobs, abilities, enemies, combos) goes in `src/data` and must not require engine changes. If it does, extend the effect pipeline first.
- Every asset added gets a `CREDITS.md` line in the same commit.
- Test multiplayer with two browser tabs locally (`npm run dev`), then on the live URL before calling a networking milestone done.
