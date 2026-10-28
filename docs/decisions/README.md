# Design decisions

One file per decision, numbered in the order they were made. `docs/DESIGN.md` is the spec; these records explain the choices made while building it: where the spec was silent or ambiguous, or where we changed it.

**Write one when** you settle something the spec doesn't say, interpret something it says ambiguously, or change it. Use [`0000-template.md`](0000-template.md). Keep it short.

**Status** is `Accepted`, `Temporary` (a dev aid to remove later), `Superseded by NNNN` or `Deprecated`. Don't edit an accepted decision's substance; write a new record that supersedes it, and update `DESIGN.md` if the spec changes.

| # | Decision | Milestone |
|---|---|---|
| [0001](0001-trystero-strategy-packages.md) | Trystero strategies as separate packages, chosen in one place | M0 |
| [0002](0002-lowercase-repo-and-base-path.md) | Lowercase repo name and Pages base path | M0 |
| [0003](0003-grid-and-movement-conventions.md) | Grid, facing and movement conventions | M1 |
| [0004](0004-ct-timeline-and-phases.md) | CT carry, phase order and status timing | M2 |
| [0005](0005-combat-formulas.md) | Hit chance and damage formulas | M2 |
| [0006](0006-downed-knockback-and-effects.md) | Downed units, knockback and the M2 effect set | M2 |
| [0007](0007-berserker-ai.md) | Berserker AI scoring and its first-mover weakness | M2 |
| [0008](0008-defer-networking-milestone.md) | Defer networking (M3) until after the art pass (order updated by 0025) | M4 |
| [0009](0009-job-progression.md) | Job progression: ranks, unlocks and the camp test harness (superseded by 0023) | M4 |
| [0010](0010-resolve-and-ultimates.md) | Resolve and ultimates | M4 |
| [0011](0011-hazards-statuses-and-traps.md) | Hazards, new statuses and traps | M4 |
| [0012](0012-passives-reactions-and-first-hybrids.md) | Passives, reactions and the first hybrid kits (superseded by 0023) | M4 |
| [0013](0013-ignite-combo.md) | Ignite combo rules | M4 |
| [0014](0014-small-test-battles.md) | Temporary: quick 2v2 test battles on a half-size map | M4 |
| [0015](0015-run-structure-levels-and-hp.md) | Run structure, levelling and HP between battles | M5 |
| [0016](0016-economy-gear-and-shrines.md) | Gold, gear, consumables, shop and shrines | M5 |
| [0017](0017-objectives-charge-spells-and-statuses.md) | Objectives, charge-time spells and more statuses | M5 |
| [0018](0018-rounds-and-the-downed-countdown.md) | Rounds, and 3 full rounds before a downed unit is lost | M5 |
| [0019](0019-cautious-and-escort-ai.md) | Cautious and escort AI presets, and auto-play | M5 |
| [0020](0020-enemy-difficulty-scaling.md) | Enemies deal half damage and have half HP | M5 |
| [0021](0021-art-pass.md) | Art pass: models, textures, sound and UI skin | M6 |
| [0022](0022-sound-and-ui-scaling.md) | Synthesized spell sounds and a UI that scales with the screen | M7 |
| [0023](0023-fft-job-system.md) | FFT-style job system: learn abilities with JP, a job tree, four ability slots | M7 |
| [0024](0024-meta-progression-and-relics.md) | Meta progression: starting jobs, Codex, relics and shrine unlocks | M7 |
| [0025](0025-m7-combos-enemies-and-maps.md) | M7 before M3; new combos, enemies, AI presets and maps | M7 |
