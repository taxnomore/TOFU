// Internet server: rooms with a code, isolation, limits against abuse, the
// host's tools (send away, lock) and the cleanup of empty or idle rooms.
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { CLOSE_FINAL, ROOM_LETTERS, normalizeRoomCode } from '../src/shared/net/protocol';
import { TestClient, seat, sleep, startServer, until } from './netHelpers';

type Srv = Awaited<ReturnType<typeof startServer>>;
let srv: Srv | null = null;
const clients: TestClient[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) if (c.ws?.readyState === WebSocket.OPEN) c.close();
  await srv?.close();
  srv = null;
});

async function client(url: string, id: string, pref: 'tofu' | 'human' | 'any' = 'any', headers: Record<string, string> = {}) {
  const c = new TestClient(url, id, [seat(id.slice(0, 8), pref)], headers);
  clients.push(c);
  await c.open();
  return c;
}

/** Creates a room and returns its host and code. */
async function createRoom(s: Srv, id: string, headers: Record<string, string> = {}) {
  const host = await client(s.url('new'), id, 'tofu', headers);
  await until(() => host.lobby, 3000, 'lobby');
  return { host, code: host.welcome!.room };
}

describe('room codes', () => {
  it('typed codes are cleaned; vowels and look-alike letters are not codes', () => {
    expect(normalizeRoomCode(' kzp-tm ')).toBe('KZPTM');
    expect(normalizeRoomCode('KZPTA')).toBeNull();
    expect(normalizeRoomCode('KZPT0')).toBeNull();
    expect(normalizeRoomCode('KZPT')).toBeNull();
    expect(normalizeRoomCode(42)).toBeNull();
    expect([...'AEIOUY01'].some((c) => ROOM_LETTERS.includes(c))).toBe(false);
  });
});

describe('Internet server', () => {
  it('each family has its own room: create, share the code, join, play apart', async () => {
    srv = await startServer({ mode: 'internet', limits: { maxGames: 1 }, room: { countdown: 0.3 } });
    const { host: a, code } = await createRoom(srv, 'alice-0001');
    expect(code).toMatch(new RegExp(`^[${ROOM_LETTERS}]{5}$`));
    expect(a.welcome!.mode).toBe('internet');
    // The addresses of the home network stay private.
    expect(a.welcome!.lanUrls).toEqual([]);
    expect(a.lobby!.hostId).toBe('alice-0001');

    // The code works typed in lower case with a dash.
    const b = await client(srv.url(`${code.slice(0, 2).toLowerCase()}-${code.slice(2)}`), 'bruno-0001', 'human');
    await until(() => a.lobby?.players.length === 2, 3000, 'second player');
    expect(b.welcome!.room).toBe(code);

    // A second family: another code, another lobby.
    const { host: c, code: code2 } = await createRoom(srv, 'chloe-0001');
    expect(code2).not.toBe(code);
    expect(c.lobby!.players.map((p) => p.name)).toEqual(['chloe-00']);
    expect(a.lobby!.players.length).toBe(2);
    expect(srv.manager.rooms.size).toBe(2);

    // Unknown or missing code: a clear message, no retry.
    const d = await client(srv.url(code === 'BCDFG' ? 'BCDFH' : 'BCDFG'), 'david-0001');
    await until(() => d.closedCode, 2000, 'refused');
    expect(d.closedCode).toBe(CLOSE_FINAL.noRoom);
    expect(d.errors[0]).toMatch(/n'existe pas/);
    const e = await client(srv.url(), 'emma-00001');
    await until(() => e.closedCode, 2000, 'refused');
    expect(e.errors[0]).toMatch(/code du salon/);

    // A match in the first room leaves the second one alone.
    a.send({ t: 'start' });
    await until(() => a.start && b.start, 3000, 'start');
    await sleep(200);
    expect(c.start).toBeNull();
    // At most one match at a time on this server: the second family waits.
    c.send({ t: 'start' });
    await until(() => c.errors.length, 2000, 'busy');
    expect(c.errors[0]).toMatch(/très occupé/);
    expect(c.start).toBeNull();
    expect(srv.manager.gamesRunning()).toBe(1);
  }, 15000);

  it('the host can send someone away and close the room to newcomers', async () => {
    srv = await startServer({ mode: 'internet' });
    const { host: a, code } = await createRoom(srv, 'alice-0002');
    const b = await client(srv.url(code), 'intrus-002');
    await until(() => a.lobby?.players.length === 2, 3000, 'intruder in');
    // Only the host can do it.
    b.send({ t: 'kick', key: 'alice-0002:0' });
    b.send({ t: 'lock', locked: true });
    await sleep(150);
    expect(a.closedCode).toBe(0);
    expect(a.lobby!.locked).toBe(false);

    a.send({ t: 'kick', key: 'intrus-002:0' });
    await until(() => b.closedCode, 2000, 'kicked');
    expect(b.closedCode).toBe(CLOSE_FINAL.kicked);
    expect(b.errors.at(-1)).toMatch(/retiré/);
    await until(() => a.lobby?.players.length === 1, 2000, 'lobby without intruder');
    // Coming back with the same tab is refused.
    const b2 = await client(srv.url(code), 'intrus-002');
    await until(() => b2.closedCode, 2000, 'refused again');
    expect(b2.closedCode).toBe(CLOSE_FINAL.kicked);

    // A family member joins, then the host closes the door.
    const c = await client(srv.url(code), 'cousin-002');
    await until(() => a.lobby?.players.length === 2, 2000, 'cousin in');
    a.send({ t: 'lock', locked: true });
    await until(() => c.lobby?.locked, 2000, 'locked');
    const d = await client(srv.url(code), 'stranger02');
    await until(() => d.closedCode, 2000, 'locked out');
    expect(d.errors[0]).toMatch(/fermé/);
    // The cousin reloads the page (same tab id): still welcome.
    c.close();
    await until(() => a.lobby?.players.length === 1, 2000, 'cousin left');
    const c2 = await client(srv.url(code), 'cousin-002');
    await until(() => c2.lobby, 2000, 'cousin back');
    expect(c2.closedCode).toBe(0);
    expect(a.lobby!.players.length).toBe(2);
  }, 15000);

  it('limits: connections per address, rooms per address, wrong codes, rooms in total', async () => {
    srv = await startServer({ mode: 'internet', limits: { maxPerIp: 3, roomsPerIp: 2, badCodesPerIp: 3, maxRooms: 3 } });
    const { code } = await createRoom(srv, 'alice-0003');
    await createRoom(srv, 'bruno-0003');
    // Third room from the same address in 10 minutes: refused.
    const c = await client(srv.url('new'), 'chloe-0003');
    await until(() => c.closedCode, 2000, 'too many rooms');
    expect(c.closedCode).toBe(CLOSE_FINAL.busy);
    expect(c.errors[0]).toMatch(/beaucoup de salons/);
    // Third connection is fine, the fourth from this address is refused.
    await client(srv.url(code), 'david-0003');
    const e = await client(srv.url(code), 'emma-00003');
    await until(() => e.closedCode, 2000, 'too many connections');
    expect(e.errors[0]).toMatch(/Trop de connexions/);

    // Another address (behind the tunnel, given by the proxy header): wrong codes count.
    await srv.close();
    srv = await startServer({ mode: 'internet', trustProxy: true, limits: { badCodesPerIp: 3, maxRooms: 1, maxPerIp: 2 } });
    const h1 = { 'x-forwarded-for': '203.0.113.7' };
    const h2 = { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' };
    const r = await createRoom(srv, 'host-00004', h1);
    for (const bad of ['BBBBB', 'CCCCC', 'DDDDD']) {
      const x = await client(srv.url(bad), `bad-${bad}`, 'any', h2);
      await until(() => x.closedCode, 2000, 'bad code');
    }
    const late = await client(srv.url(r.code), 'late-00004', 'any', h2);
    await until(() => late.closedCode, 2000, 'blocked after wrong codes');
    expect(late.errors[0]).toMatch(/Trop de codes/);
    // The address of the room's family is not blocked.
    const ok = await client(srv.url(r.code), 'fam-000004', 'any', h1);
    await until(() => ok.lobby, 2000, 'family member');
    expect(ok.closedCode).toBe(0);
    // One room in total on this server.
    const other = await client(srv.url('new'), 'other-0004', 'any', { 'x-forwarded-for': '192.0.2.44' });
    await until(() => other.closedCode, 2000, 'server full');
    expect(other.errors[0]).toMatch(/beaucoup de salons/);
  }, 15000);

  it('empty rooms and idle lobbies disappear', async () => {
    srv = await startServer({ mode: 'internet' });
    const { host: a, code } = await createRoom(srv, 'alice-0005');
    const { host: b, code: code2 } = await createRoom(srv, 'bruno-0005');
    a.close();
    await until(() => srv!.manager.rooms.get(code)!.connectedCount() === 0, 2000, 'room empty');
    const L = srv.manager.limits;
    // Still there just after (a reload finds it again)…
    srv.manager.sweep(Date.now() + 1000);
    expect(srv.manager.rooms.has(code)).toBe(true);
    // …gone after the delay; its code no longer works.
    srv.manager.sweep(Date.now() + L.emptyRoomTtl + 1000);
    expect(srv.manager.rooms.has(code)).toBe(false);
    const late = await client(srv.url(code), 'late-00005');
    await until(() => late.closedCode, 2000, 'gone');
    expect(late.errors[0]).toMatch(/n'existe pas/);
    // A lobby where nothing happens for a long time closes, with a message.
    expect(srv.manager.rooms.has(code2)).toBe(true);
    srv.manager.sweep(Date.now() + L.idleLobbyTtl + 1000);
    await until(() => b.closedCode, 2000, 'idle room closed');
    expect(b.errors.at(-1)).toMatch(/sans partie/);
    expect(srv.manager.rooms.size).toBe(0);
  }, 15000);

  it('a page from another site cannot open a connection', async () => {
    srv = await startServer({ mode: 'internet', publicUrl: 'https://tofu.example.org' });
    const tryOrigin = (origin: string) => new Promise<string>((res) => {
      const ws = new WebSocket(srv!.url('new'), { origin, headers: { host: `127.0.0.1:${srv!.port}` } });
      ws.on('open', () => {
        ws.close();
        res('open');
      });
      ws.on('error', (e) => res(String(e.message)));
    });
    expect(await tryOrigin('https://evil.example.com')).toMatch(/403/);
    expect(await tryOrigin(`http://127.0.0.1:${srv.port}`)).toBe('open');
    expect(await tryOrigin('https://tofu.example.org')).toBe('open');
  });

  it('at home, one room for everybody: codes are not needed', async () => {
    srv = await startServer({ mode: 'lan' });
    const a = await client(srv.url(), 'alice-0006');
    const b = await client(srv.url('KZPTM'), 'bruno-0006');
    await until(() => a.lobby?.players.length === 2, 2000, 'same room');
    expect(a.welcome!.mode).toBe('lan');
    expect(a.welcome!.room).toBe('');
    expect(b.welcome!.room).toBe('');
  });
});
