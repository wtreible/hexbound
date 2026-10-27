// Sound (docs/DESIGN.md §9; decision 0021). Effects are short CC0 clips
// (Kenney) decoded once through Web Audio; music is one streamed, looping
// <audio> track (OpenGameArt, CC0). Browsers only allow sound after a user
// gesture, so playback is unlocked by the first click or key. Mute is a
// per-browser preference kept in localStorage.

const SFX = {
  swing: ['knifeSlice.ogg', 'chop.ogg'],
  draw: ['drawKnife1.ogg'],
  whoosh: ['cloth1.ogg'],
  hit: ['impactPlate_heavy_000.ogg', 'impactMetal_medium_000.ogg'],
  down: ['impactPlank_medium_000.ogg'],
  step: ['footstep_grass_000.ogg', 'footstep_grass_001.ogg', 'footstep_grass_002.ogg'],
  magic: ['glass_002.ogg'],
  heal: ['maximize_003.ogg'],
  coins: ['handleCoins.ogg'],
  page: ['bookFlip1.ogg'],
  click: ['click_002.ogg'],
  select: ['select_002.ogg'],
  victory: ['confirmation_001.ogg'],
  defeat: ['error_002.ogg'],
  gong: ['bong_001.ogg'],
} as const;

export type Sfx = keyof typeof SFX;
export type Track = 'exploration' | 'battle';

const TRACKS: Record<Track, string> = {
  exploration: 'medieval-exploration.mp3',
  battle: 'medieval-battle.mp3',
};

const MUTE_KEY = 'hexbound:muted';
const SFX_VOLUME = 0.5;
const MUSIC_VOLUME = 0.3;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function createAudio() {
  const base = `${import.meta.env.BASE_URL}audio/`;
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  let muted = readMuted();
  let unlocked = false;
  let wanted: Track | null = null;
  const music = new Audio();
  music.loop = true;
  music.preload = 'none';
  music.volume = MUSIC_VOLUME;
  let playing: Track | null = null;

  const buffer = (file: string) => {
    let b = buffers.get(file);
    if (!b) {
      b = fetch(`${base}sfx/${file}`)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx!.decodeAudioData(data))
        .catch(() => null);
      buffers.set(file, b);
    }
    return b;
  };

  const startMusic = () => {
    if (!unlocked || muted || !wanted) {
      music.pause();
      return;
    }
    if (playing !== wanted) {
      playing = wanted;
      music.src = `${base}music/${TRACKS[wanted]}`;
    }
    void music.play().catch(() => undefined);
  };

  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = SFX_VOLUME;
    gain.connect(ctx.destination);
    startMusic();
  };
  for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, unlock, { once: true, capture: true });

  return {
    play(name: Sfx) {
      if (muted || !ctx || !gain) return;
      const files = SFX[name];
      const file = files[Math.floor(Math.random() * files.length)]!;
      void buffer(file).then((b) => {
        if (!b || !ctx || !gain) return;
        const source = ctx.createBufferSource();
        source.buffer = b;
        source.connect(gain);
        source.start();
      });
    },
    music(track: Track | null) {
      wanted = track;
      startMusic();
    },
    get muted() {
      return muted;
    },
    setMuted(value: boolean) {
      muted = value;
      try {
        localStorage.setItem(MUTE_KEY, value ? '1' : '0');
      } catch {
        // Not remembered, but still applies for this session.
      }
      startMusic();
    },
  };
}

export const audio = createAudio();
