# Credits

Every third-party asset used in Hexbound Company is listed here with its author, source URL and license (see docs/DESIGN.md §2, §9.2). Add a line in the same commit that adds the asset. Licence texts that ship with the packs are copied to `public/licenses/`.

## Art

| Asset | Used for | Author | Source | License |
|---|---|---|---|---|
| KayKit Character Pack: Adventurers 1.0 (Knight, Barbarian, Mage, Rogue, Rogue Hooded; sword, staff, crossbow, dagger and round shield props) | Player units, the escort Pilgrim, weapons attached to skeletons | Kay Lousberg | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 (`public/licenses/kaykit-adventurers.txt`) |
| KayKit Character Pack: Skeletons 1.0 (Warrior, Mage, Rogue, Minion) | Enemy units | Kay Lousberg | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 | CC0 1.0 (`public/licenses/kaykit-skeletons.txt`) |

The models in `public/models/` are reduced copies (unused animations removed, meshopt-compressed) built by `npm run models` from the packs above. Tile textures (`src/render/textures.ts`) and run map icons (`src/ui/icons.ts`) are drawn in code for this project.

## Audio

| Asset | Used for | Author | Source | License |
|---|---|---|---|---|
| RPG Audio (knifeSlice, chop, cloth1, handleCoins, bookFlip1, drawKnife1) | Swings, whooshes, coins, page turns | Kenney | https://kenney.nl/assets/rpg-audio | CC0 1.0 (`public/licenses/kenney-rpg-audio.txt`) |
| Impact Sounds (impactPlate_heavy_000, impactMetal_medium_000, impactPlank_medium_000, footstep_grass_000–002) | Hits, falls, footsteps | Kenney | https://kenney.nl/assets/impact-sounds | CC0 1.0 (`public/licenses/kenney-impact-sounds.txt`) |
| Interface Sounds (click_002, select_002, confirmation_001, error_002, glass_002, maximize_003, bong_001) | UI clicks, victory and defeat, magic, healing | Kenney | https://kenney.nl/assets/interface-sounds | CC0 1.0 (`public/licenses/kenney-interface-sounds.txt`) |
| Medieval: Exploration | Map and menu music | RandomMind | https://opengameart.org/content/medieval-exploration | CC0 |
| Medieval: Battle | Battle music | RandomMind | https://opengameart.org/content/medieval-battle | CC0 |

## Fonts

| Asset | Author | Source | License |
|---|---|---|---|
| Cinzel (headings), via `@fontsource/cinzel` | Natanael Gama | https://fonts.google.com/specimen/Cinzel | SIL Open Font License 1.1 |
| Alegreya (body text), via `@fontsource/alegreya` | Huerta Tipográfica | https://fonts.google.com/specimen/Alegreya | SIL Open Font License 1.1 |

## Code dependencies

Runtime libraries are listed in `package.json`: Three.js (MIT, including its meshopt decoder), Trystero (MIT), and the Fontsource packages above. Build tools: gltf-transform (MIT) and meshoptimizer (MIT).
