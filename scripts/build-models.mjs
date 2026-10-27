// Builds the game's character models from the downloaded KayKit packs
// (docs/DESIGN.md §9.3, decision 0021). Keeps only the animations the game
// plays, prunes and deduplicates, and compresses with meshopt so each file
// fits the 1.5 MB budget.
//
//   npm run models -- <adventurers-dir> <skeletons-dir>
//
// The source folders hold the .glb files from the KayKit Adventurers and
// Skeletons character packs (CC0, see CREDITS.md). Output: public/models/.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Must match the clip names used in src/render/models.ts.
const KEEP = new Set([
  'Idle', 'Walking_A', 'Hit_A', 'Death_A', 'Death_A_Pose', 'Cheer', 'Use_Item',
  '1H_Melee_Attack_Chop', '1H_Ranged_Shoot', '2H_Ranged_Shoot', 'Spellcast_Shoot', 'Spellcast_Raise',
]);

const SOURCES = {
  adventurers: ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'],
  skeletons: ['Skeleton_Warrior', 'Skeleton_Mage', 'Skeleton_Rogue', 'Skeleton_Minion'],
};
/** Loose weapon props (Adventurers pack, .gltf + .bin + texture) attached to skeleton hands. */
const WEAPONS = ['sword_1handed', 'staff', 'crossbow_1handed', 'dagger', 'shield_round'];

// IK and control helpers are animated in the source rig but don't deform the
// mesh in three.js; channels that never leave the rest pose change nothing.
// Dropping both cuts thousands of accessors, which dominate the file size.
const HELPER = /IK|control-/;
const REST = { translation: 'getTranslation', rotation: 'getRotation', scale: 'getScale' };

function trimChannels(doc) {
  for (const anim of doc.getRoot().listAnimations()) {
    for (const channel of anim.listChannels()) {
      const node = channel.getTargetNode();
      const sampler = channel.getSampler();
      const out = sampler?.getOutput();
      const drop = !node || !out || HELPER.test(node.getName()) || atRest(node, channel.getTargetPath(), out);
      if (drop) {
        channel.dispose();
        if (sampler && !sampler.listParents().some((p) => p.propertyType === 'AnimationChannel')) sampler.dispose();
      }
    }
  }
}

function atRest(node, path, output) {
  const getter = REST[path];
  if (!getter) return false;
  const rest = node[getter]();
  const size = output.getElementSize();
  const value = [];
  for (let i = 0; i < output.getCount(); i++) {
    output.getElement(i, value);
    for (let k = 0; k < size; k++) if (Math.abs(value[k] - rest[k]) > 1e-4) return false;
  }
  return true;
}

const [advDir, skelDir] = process.argv.slice(2);
if (!advDir || !skelDir) {
  console.error('usage: npm run models -- <adventurers-dir> <skeletons-dir>');
  process.exit(1);
}
const outDir = 'public/models';
mkdirSync(outDir, { recursive: true });

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const [pack, names] of Object.entries(SOURCES)) {
  const dir = pack === 'adventurers' ? advDir : skelDir;
  for (const name of names) {
    const doc = await io.read(join(dir, `${name}.glb`));
    for (const anim of doc.getRoot().listAnimations()) {
      if (KEEP.has(anim.getName())) continue;
      // Samplers outlive their animation unless disposed too, and keep their accessors alive.
      for (const sampler of anim.listSamplers()) sampler.dispose();
      anim.dispose();
    }
    await doc.transform(resample());
    trimChannels(doc);
    await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const out = join(outDir, `${name.toLowerCase()}.glb`);
    await io.write(out, doc);
    const kb = Math.round(statSync(out).size / 1024);
    console.log(`${out}  ${kb} KB  (${doc.getRoot().listAnimations().length} clips)`);
    if (kb > 1536) console.warn(`  over the 1.5 MB budget`);
  }
}

mkdirSync(join(outDir, 'weapons'), { recursive: true });
for (const name of WEAPONS) {
  const doc = await io.read(join(advDir, `${name}.gltf`));
  await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = join(outDir, 'weapons', `${name}.glb`);
  await io.write(out, doc);
  console.log(`${out}  ${Math.round(statSync(out).size / 1024)} KB`);
}
