import { describe, expect, it } from 'vitest';
import { createAI } from '../src/shared/ai/ai';
import { PROTOCOL_VERSION, parseClientMsg } from '../src/shared/net/protocol';
import { SnapshotEncoder, applySnap } from '../src/shared/net/snapshot';
import { Game } from '../src/shared/sim/game';
import { applyMovement } from '../src/shared/sim/movement';
import type { GameEvent, GameState, Item } from '../src/shared/sim/types';
import { makeGame } from './helpers';

/** Item fields the client needs (timers and held positions follow other data). */
function itemView(it: Item) {
  const held = it.state === 'held';
  return {
    state: it.state, holder: it.holder, station: it.station, type: it.type,
    x: held ? 0 : it.x, y: held ? 0 : it.y, z: held ? 0 : it.z, rot: held ? 0 : it.rot,
    guarded: it.guardT > 0,
  };
}

describe('delta snapshots', () => {
  it('rebuild the server state on the client during a full AI match', () => {
    const g = new Game({
      seed: 11, duration: 240, noCountdown: true, difficulty: 1,
      players: [
        { role: 'tofu', name: 'Tofu', avatar: 0, ai: true },
        { role: 'human', name: 'Maman', avatar: 0, ai: true },
        { role: 'human', name: 'Papa', avatar: 1, ai: true },
      ],
    });
    const ais = g.state.chars.map((c) => createAI(g, c.id, 1));
    const enc = new SnapshotEncoder();
    enc.resetTo(g.state);
    const client: GameState = JSON.parse(JSON.stringify(g.state));
    let pending: GameEvent[] = [];
    let received = 0;
    let checks = 0;
    const compare = () => {
      const S = g.state;
      expect(client.tick).toBe(S.tick);
      expect(client.phase).toBe(S.phase);
      expect(client.chaos).toBeCloseTo(S.chaos, 6);
      expect(client.chars).toEqual(S.chars);
      expect(client.items.map(itemView)).toEqual(S.items.map(itemView));
      // Mess age is a server-only timer.
      expect(client.messes.map((m) => ({ ...m, age: 0 }))).toEqual(S.messes.map((m) => ({ ...m, age: 0 })));
      expect(client.stations).toEqual(S.stations);
      expect(client.doors.map((d) => d.open)).toEqual(S.doors.map((d) => d.open));
      expect(client.tasks).toEqual(S.tasks);
      expect(client.secrets).toEqual(S.secrets);
      expect(client.treats).toEqual(S.treats);
      expect(client.vacuum).toEqual(S.vacuum);
      checks++;
    };
    const ended = (): boolean => g.state.phase === 'end';
    for (let t = 1; t <= 60 * 240 && !ended(); t++) {
      g.step(ais.map((a) => a.think()));
      pending.push(...g.drainEvents());
      if (g.state.tick % 3 === 0 || ended()) {
        // Through JSON, like the WebSocket.
        const d = JSON.parse(JSON.stringify(enc.delta(g.state, pending)));
        received += d.ev.length;
        pending = [];
        applySnap(client, d);
        if (g.state.tick % 600 === 0 || ended()) compare();
      }
    }
    expect(checks).toBeGreaterThan(3);
    expect(received).toBeGreaterThan(50);
    expect(client.stats).toEqual(g.state.stats);
  }, 60000);
});

describe('client message validation', () => {
  it('rejects malformed messages and clamps inputs', () => {
    expect(parseClientMsg('nope')).toBeNull();
    expect(parseClientMsg('{"t":"in","f":"x"}')).toBeNull();
    expect(parseClientMsg('{"t":"in","f":[[0,1,"a",0,0]]}')).toBeNull();
    expect(parseClientMsg('{"t":"hello","v":999,"clientId":"abcdef","seats":[]}')).toBeNull();
    expect(parseClientMsg(`{"t":"hello","v":${PROTOCOL_VERSION},"clientId":"<script>","seats":[]}`)).toBeNull();
    // An older page (version 1) is told to reload instead of joining.
    expect(parseClientMsg('{"t":"hello","v":1,"clientId":"abcdef","seats":[]}')).toBeNull();
    expect(parseClientMsg('{"t":"teleport","x":5}')).toBeNull();
    const m = parseClientMsg('{"t":"in","f":[[0,1,50,50,4095]]}');
    expect(m?.t).toBe('in');
    if (m?.t !== 'in') return;
    const [, , mx, mz, b] = m.f[0];
    expect(Math.hypot(mx, mz)).toBeLessThanOrEqual(1.0000001);
    expect(b).toBe(31);
    const h = parseClientMsg(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, clientId: 'abcd1234', seats: [{ name: '<b>Zoé</b>'.repeat(5), avatar: 99, pref: 'boss' }] }));
    expect(h?.t).toBe('hello');
    if (h?.t !== 'hello') return;
    expect(h.seats[0].name).not.toContain('<');
    expect(h.seats[0].name.length).toBeLessThanOrEqual(16);
    expect(h.seats[0].avatar).toBe(3);
    expect(h.seats[0].pref).toBe('any');
    const s = parseClientMsg('{"t":"settings","settings":{"duration":5,"difficulty":9,"fillAI":"yes"}}');
    expect(s).toEqual({ t: 'settings', settings: { duration: 60, difficulty: 2 } });
    // Host tools: a key of bounded length, a plain yes or no.
    expect(parseClientMsg('{"t":"kick","key":5}')).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'kick', key: 'x'.repeat(500) }))).toEqual({ t: 'kick', key: 'x'.repeat(64) });
    expect(parseClientMsg('{"t":"lock","locked":"yes"}')).toEqual({ t: 'lock', locked: false });
  });
});

describe('client-side prediction', () => {
  it('replays the same movement as the server', () => {
    const g = makeGame({}, 1);
    const c = g.state.chars[1];
    const copy = { ...c, hold: [...c.hold] };
    const ctx = { world: g.world, doors: g.state.doors, items: g.state.items };
    const inputs = [];
    for (let i = 0; i < 120; i++) inputs.push({ mx: Math.sin(i / 20), mz: 0.8, buttons: i > 60 ? 2 : 0 });
    for (const inp of inputs) {
      const arr = [];
      arr[1] = inp;
      g.step(arr);
      applyMovement(copy, inp, 1 / 60, ctx);
    }
    expect(copy.x).toBeCloseTo(c.x, 6);
    expect(copy.z).toBeCloseTo(c.z, 6);
    expect(copy.stamina).toBeCloseTo(c.stamina, 6);
  });
});
