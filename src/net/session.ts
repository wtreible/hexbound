import type { Room } from 'trystero';
import type { Msg } from './protocol';

// Signaling strategy lives here and only here (docs/DESIGN.md §7.5). Override per
// page load with ?strategy=mqtt or ?strategy=torrent to test fallbacks.
export type Strategy = 'nostr' | 'mqtt' | 'torrent';
export const DEFAULT_STRATEGY: Strategy = 'nostr';
export const APP_ID = 'hexbound-v1';

// Letters only, without lookalikes (I, O) — docs/DESIGN.md §7.2.
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 5;

export function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_ALPHABET.includes(ch)) return null;
  return code;
}

export function strategyFromUrl(): Strategy {
  const s = new URLSearchParams(location.search).get('strategy');
  return s === 'nostr' || s === 'mqtt' || s === 'torrent' ? s : DEFAULT_STRATEGY;
}

// Dynamic imports so only the chosen strategy's code is loaded.
async function loadJoinRoom(strategy: Strategy) {
  switch (strategy) {
    case 'nostr':
      return (await import('trystero')).joinRoom;
    case 'mqtt':
      return (await import('@trystero-p2p/mqtt')).joinRoom;
    case 'torrent':
      return (await import('@trystero-p2p/torrent')).joinRoom;
  }
}

export type Session = {
  roomCode: string;
  strategy: Strategy;
  room: Room;
  send(msg: Msg, target?: string): Promise<void>;
  onMessage: ((msg: Msg, peerId: string) => void) | null;
  leave(): Promise<void>;
};

export async function openSession(roomCode: string, strategy: Strategy): Promise<Session> {
  const joinRoom = await loadJoinRoom(strategy);
  const room = joinRoom({ appId: APP_ID }, roomCode);
  const action = room.makeAction<Msg>('msg');
  const session: Session = {
    roomCode,
    strategy,
    room,
    send: (msg, target) => action.send(msg, target ? { target } : undefined),
    onMessage: null,
    leave: () => room.leave(),
  };
  action.onMessage = (msg, { peerId }) => session.onMessage?.(msg, peerId);
  return session;
}
