# 0016. Gold, gear, consumables, shop and shrines

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M5 (stage 2)

## Context

The spec mentions gear and consumables (Shop), swapping equipment (Camp), random events (Shrine) and grave looting, but defines no item system. `JobDef.equip` lists weapon tags.

## Decision

- **Gold:** start with 50. Battles pay 25 / 45 / 80 (battle / elite / boss) × the act.
- **Gear:** three slots (weapon, armor, accessory) adding flat stats after job multipliers. A weapon needs a tag in the job's `equip` list; armor and accessories fit anyone. Items are tiered 1–3 by act (`src/data/items.ts`). Unequipped gear sits in a shared **stash**. Equipping happens at Camp. A job change that can't use the current weapon puts it back in the stash.
- **Consumables:** a shared party inventory (start: 2 Potions). Potion, Ether, Antidote and Phoenix Feather. In battle any unit can use one as its action, from an **Items** section of the command bar. They're tagged `throw`, so the Chemist's Throw Range +2 extends them. What isn't used carries over.
- **Shop:** 4 random gear pieces of the act's tier (one each) plus all consumables (unlimited). No selling yet.
- **Shrines:** data-driven events (`src/data/shrines.ts`) with 2–3 choices. Outcomes: gold ±, heal or hurt everyone by % of max HP (hurting never kills), JP for everyone, an item, or a level for a random unit. A choice that costs gold is disabled when the party can't pay.
- **Graves:** when a player unit dies, a player unit that ends its move on the grave loots one of its items (weapon first) into the stash. The rest of the fallen unit's gear is lost.
- **Map weights:** battle 46, elite 14, camp 12, recruit 10, shop 9, shrine 9.

## Consequences

- The AI never uses consumables. Items are a human advantage.
- In 30 simulated quick runs, parties ended with about 470 gold on average, so prices may need raising once shops are used by humans.
- Code: `src/rules/items.ts`, `src/rules/run.ts` (`buy`, `equip`, `changeLoadout`, `chooseShrine`), reducer item use and looting.
