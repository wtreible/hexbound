import { barrows } from './barrows';
import { caves } from './caves';
import { clearing } from './clearing';
import { crossing } from './crossing';
import { crypt } from './crypt';
import { ford } from './ford';
import { keep } from './keep';
import { market } from './market';
import { marsh } from './marsh';
import { meadow } from './meadow';
import { pass } from './pass';
import { ravine } from './ravine';
import { ridge } from './ridge';
import { switchback } from './switchback';
import { terraces } from './terraces';

/** Maps the run draws battles from. Every one needs 4 player and 5 enemy spawns. */
export const BATTLE_MAPS = [
  meadow,
  crossing,
  ridge,
  ravine,
  keep,
  terraces,
  barrows,
  caves,
  marsh,
  market,
  pass,
  ford,
  crypt,
  clearing,
  switchback,
];
