import { PROTOCOL_VERSION } from '../net/protocol';
import {
  generateRoomCode,
  normalizeRoomCode,
  openSession,
  strategyFromUrl,
  type Session,
} from '../net/session';

// M0 networking smoke test: host or join a room code, then every connected
// tab pings the others every few seconds and logs what it receives.
const PING_INTERVAL_MS = 3000;

export function mountLobby(root: HTMLElement): void {
  const el = document.createElement('div');
  el.className = 'panel lobby';
  el.innerHTML = `
    <h1>Hexbound Company</h1>
    <div class="row">
      <button data-host>Host</button>
      <input data-code placeholder="CODE" maxlength="5" autocomplete="off" />
      <button data-join>Join</button>
    </div>
    <div class="status" data-status></div>
    <pre class="log" data-log></pre>
  `;
  root.appendChild(el);

  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const hostBtn = q<HTMLButtonElement>('[data-host]');
  const joinBtn = q<HTMLButtonElement>('[data-join]');
  const codeInput = q<HTMLInputElement>('[data-code]');
  const statusEl = q('[data-status]');
  const logEl = q('[data-log]');

  const strategy = strategyFromUrl();
  statusEl.textContent = `Signaling: ${strategy}`;

  const log = (line: string) => {
    const stamp = new Date().toLocaleTimeString();
    console.log(`[net] ${line}`);
    logEl.textContent += `${stamp}  ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  };

  const start = async (roomCode: string) => {
    hostBtn.disabled = joinBtn.disabled = codeInput.disabled = true;
    codeInput.value = roomCode;
    statusEl.textContent = `Room ${roomCode} · signaling: ${strategy} · connecting…`;
    // Keep the code in the URL so a second tab can be opened by copying it.
    const url = new URL(location.href);
    url.searchParams.set('room', roomCode);
    history.replaceState(null, '', url);

    let session: Session;
    try {
      session = await openSession(roomCode, strategy);
    } catch (err) {
      statusEl.textContent = `Failed to open session: ${String(err)}`;
      log(`error: ${String(err)}`);
      return;
    }
    wireSession(session, (peers) => {
      statusEl.textContent = `Room ${roomCode} · signaling: ${strategy} · peers: ${peers}`;
    }, log);
  };

  hostBtn.addEventListener('click', () => void start(generateRoomCode()));
  joinBtn.addEventListener('click', () => {
    const code = normalizeRoomCode(codeInput.value);
    if (code) void start(code);
    else statusEl.textContent = 'Room codes are 5 letters.';
  });
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn.click();
  });

  const fromUrl = new URLSearchParams(location.search).get('room');
  const code = fromUrl && normalizeRoomCode(fromUrl);
  if (code) void start(code);
}

function wireSession(
  session: Session,
  onPeerCount: (n: number) => void,
  log: (line: string) => void,
): void {
  const peers = new Set<string>();
  let n = 0;

  session.room.onPeerJoin = (peerId) => {
    peers.add(peerId);
    onPeerCount(peers.size);
    log(`peer joined ${peerId}`);
    void session.send(
      { t: 'hello', v: PROTOCOL_VERSION, profileId: 'dev', name: 'dev' },
      peerId,
    );
  };
  session.room.onPeerLeave = (peerId) => {
    peers.delete(peerId);
    onPeerCount(peers.size);
    log(`peer left ${peerId}`);
  };
  session.onMessage = (msg, peerId) => {
    switch (msg.t) {
      case 'hello':
        log(`hello from ${peerId} (protocol v${msg.v})`);
        break;
      case 'ping':
        log(`ping #${msg.n} from ${peerId} (${Date.now() - msg.sentAt}ms)`);
        break;
    }
  };

  setInterval(() => {
    if (peers.size === 0) return;
    void session.send({ t: 'ping', n: ++n, sentAt: Date.now() });
  }, PING_INTERVAL_MS);

  log(`joined room ${session.roomCode}, waiting for peers…`);
}
