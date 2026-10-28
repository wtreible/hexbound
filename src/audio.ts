// Sound (docs/DESIGN.md §9; decisions 0021, 0022). Physical effects are short
// CC0 clips (Kenney) decoded once through Web Audio; magic is synthesized
// (shimmers, bursts, chimes) since no sample pack had good spell sounds;
// music is one streamed, looping <audio> track (OpenGameArt, CC0). Browsers
// only allow sound after a user gesture, so playback is unlocked by the first
// click or key. Mute is a per-browser preference kept in localStorage.

const SFX = {
  swing: ['knifeSlice.ogg', 'chop.ogg'],
  draw: ['drawKnife1.ogg'],
  whoosh: ['cloth1.ogg'],
  hit: ['impactPlate_heavy_000.ogg', 'impactMetal_medium_000.ogg'],
  down: ['impactPlank_medium_000.ogg'],
  step: ['footstep_grass_000.ogg', 'footstep_grass_001.ogg', 'footstep_grass_002.ogg'],
  coins: ['handleCoins.ogg'],
  page: ['bookFlip1.ogg'],
  click: ['click_002.ogg'],
  select: ['select_002.ogg'],
  victory: ['confirmation_001.ogg'],
  defeat: ['error_002.ogg'],
  gong: ['bong_001.ogg'],
} as const;

/** Sounds made in Web Audio rather than played from a file. */
const SYNTH = ['cast', 'spellHit', 'heal'] as const;

export type Sfx = keyof typeof SFX | (typeof SYNTH)[number];
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

  /** A short tone with an attack/decay envelope. */
  const tone = (freq: number, start: number, dur: number, type: OscillatorType, peak: number, glideTo?: number) => {
    const t = ctx!.currentTime + start;
    const osc = ctx!.createOscillator();
    const env = ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(gain!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  /** Filtered noise, for whooshes and bursts. */
  const noise = (start: number, dur: number, from: number, to: number, peak: number) => {
    const t = ctx!.currentTime + start;
    const length = Math.ceil(ctx!.sampleRate * dur);
    const buf = ctx!.createBuffer(1, length, ctx!.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx!.createBufferSource();
    src.buffer = buf;
    const filter = ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const env = ctx!.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + dur * 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(gain!);
    src.start(t);
  };

  const synth: Record<(typeof SYNTH)[number], () => void> = {
    // A rising shimmer: a sweep of air under three detuned partials.
    cast() {
      noise(0, 0.5, 600, 3200, 0.35);
      for (const [f, d] of [[523, 0], [659, 0.06], [784, 0.12]] as const) tone(f, d, 0.45, 'sine', 0.12, f * 1.5);
    },
    // A soft magical impact: a low whump with a bright crackle.
    spellHit() {
      tone(180, 0, 0.35, 'sine', 0.5, 70);
      noise(0, 0.25, 4000, 900, 0.3);
      tone(1046, 0.02, 0.2, 'triangle', 0.08);
    },
    // A rising three-note chime.
    heal() {
      for (const [f, d] of [[784, 0], [988, 0.08], [1175, 0.16]] as const) tone(f, d, 0.6, 'sine', 0.14);
    },
  };

  return {
    play(name: Sfx) {
      if (muted || !ctx || !gain) return;
      if (name in synth) {
        synth[name as keyof typeof synth]();
        return;
      }
      const files = SFX[name as keyof typeof SFX];
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
