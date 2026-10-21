// Network play on the newer places: the host picks the park, every client
// builds the same park and the computer players move in it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestClient, seat, startServer, until } from './netHelpers';

let srv: Awaited<ReturnType<typeof startServer>>;
let url = '';

beforeAll(async () => {
  srv = await startServer({ mode: 'lan', room: { countdown: 0.2 } });
  url = srv.url();
});

afterAll(async () => {
  await srv.close();
});

describe('a LAN game in the park', () => {
  it('sends the place to every client and plays there', async () => {
    const a = new TestClient(url, 'client-park-a', [seat('Alice', 'human')]);
    const b = new TestClient(url, 'client-park-b', [seat('Bruno', 'human')]);
    await a.open();
    await b.open();
    await until(() => b.lobby?.players.length === 2, 4000, 'lobby');
    a.send({ t: 'settings', settings: { map: 'parc', variant: 'automne' } });
    await until(() => b.lobby?.settings.map === 'parc' && b.lobby.settings.variant === 'automne', 2000, 'park chosen');
    a.send({ t: 'start' });
    await until(() => a.start && b.start, 4000, 'start');
    expect(b.start!.cfg.map).toBe('parc');
    expect(b.state!.items.some((it) => it.id === 'cadeau_1')).toBe(true);
    expect(b.state!.items.some((it) => it.id === 'feuilles_1' && it.state === 'home')).toBe(true);
    expect(b.state!.tasks[0].kind).toBe('parc.cadeaux');
    // Tofu is played by the computer: he leaves his basket on the picnic deck.
    await until(() => b.state?.phase === 'play', 3000, 'play phase');
    const t0 = { x: b.state!.chars[0].x, z: b.state!.chars[0].z };
    await until(() => Math.hypot(b.state!.chars[0].x - t0.x, b.state!.chars[0].z - t0.z) > 1, 5000, 'Tofu moves');
    a.close();
    b.close();
  });
});
