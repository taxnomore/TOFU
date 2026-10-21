// New mischief: leaking watering can, chain reactions, and the ambiances
// (autumn leaves, winter snow, market day).
import { describe, expect, it } from 'vitest';
import { faceTo, hold, makeGame, place, press, steps, walk } from './helpers';
import { BAGUETTE_RESPAWN, CAN, DOG } from '../src/shared/constants';
import { listInteractions } from '../src/shared/sim/interactions';
import { chooseSecrets } from '../src/shared/sim/rules';
import { CAT_NODES, ITEMS, STATIONS } from '../src/shared/world/map';
import { Rng } from '../src/shared/math';
import { getWorld } from '../src/shared/sim/world';
import type { Game } from '../src/shared/sim/game';
import type { InputFrame } from '../src/shared/sim/types';

const prints = (g: Game, kind: string) => g.state.messes.filter((m) => m.kind === kind).reduce((n, m) => n + m.prints.length / 3, 0);

/** Press the action button choosing a given interaction. */
function pressPick(g: Game, id: number, kind: string, target: number) {
  const inp: (InputFrame | undefined)[] = [];
  inp[id] = { mx: 0, mz: 0, buttons: 1, pick: { kind, target } };
  g.step(inp);
  inp[id] = { mx: 0, mz: 0, buttons: 0 };
  g.step(inp);
}

function cleanAll(g: Game, id: number, kind: string, seconds: number) {
  const human = g.state.chars[id];
  for (const m of g.state.messes.filter((x) => x.kind === kind)) {
    place(human, m.x, m.z, 0);
    hold(g, id, seconds);
  }
}

describe('leaking watering can', () => {
  it('Tofu steals it, it leaks drops on the floors, humans mop and refill it', () => {
    const g = makeGame();
    const S = g.state;
    const tofu = g.tofu;
    const human = S.chars[1];
    const can = g.itemById('arrosoir')!;
    expect(can.charge).toBe(2);
    place(tofu, can.x, can.z - 0.6, 0);
    const grab = listInteractions(g, tofu).find((i) => i.kind === 'pickup' && i.target === can.idx);
    expect(grab?.label).toBe("Attraper l'arrosoir");
    press(g, tofu.id);
    expect(tofu.hold).toContain(can.idx);
    const chaos0 = S.chaos;
    // Through the living room: a trail of drops.
    place(tofu, -3.5, 1.5, Math.PI / 2);
    walk(g, tofu.id, 1, 0, 1.6);
    expect(prints(g, 'wet')).toBeGreaterThan(8);
    expect(S.stats.drops).toBeGreaterThan(8);
    expect(can.charge).toBeLessThan(2);
    expect(S.chaos).toBeGreaterThan(chaos0);
    steps(g, 7);
    expect(S.cleanliness).toBeLessThan(100);
    // Outside on the lawn it still loses water, without marks.
    const drops = S.stats.drops;
    const charge = can.charge;
    place(tofu, -8, 12, Math.PI / 2);
    walk(g, tofu.id, 1, 0, 1);
    expect(S.stats.drops).toBe(drops);
    expect(can.charge).toBeLessThan(charge);
    // Until it is empty.
    for (let i = 0; i < 8 && can.charge > 0; i++) {
      place(tofu, -8, 12 + (i % 2) * 2, Math.PI / 2);
      walk(g, tofu.id, 1, 0, 2);
    }
    expect(can.charge).toBe(0);
    // The human takes it back, mops the drops and refills it at the tap.
    place(tofu, 0, 12, 0);
    place(human, 0, 11.1, 0);
    press(g, human.id);
    expect(human.hold).toContain(can.idx);
    place(tofu, -10, 18, 0);
    cleanAll(g, human.id, 'wet', 1.2);
    expect(S.messes.filter((m) => m.kind === 'wet').length).toBe(0);
    const tap = STATIONS.find((s) => s.id === 'robinet')!;
    place(human, tap.x, tap.z + 0.6, Math.PI);
    expect(listInteractions(g, human)[0].kind).toBe('fill');
    hold(g, human.id, 1.1);
    expect(can.charge).toBe(2);
  });

  it('a sprinting human slips on the drops', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const human = g.state.chars[1];
    const can = g.itemById('arrosoir')!;
    place(tofu, can.x, can.z - 0.6, 0);
    press(g, tofu.id);
    place(tofu, -3.5, 1.5, Math.PI / 2);
    walk(g, tofu.id, 1, 0, 1.6);
    place(tofu, -10, 18, 0);
    const wet = g.state.messes.find((m) => m.kind === 'wet' && m.prints.length >= 9)!;
    place(human, wet.x - 1.5, wet.z, Math.PI / 2);
    human.stamina = 1;
    walk(g, human.id, 1, 0, 0.6, 2 /* BTN_SPRINT */);
    expect(g.state.stats.slips).toBeGreaterThan(0);
  });
});

describe('chain reactions', () => {
  it('the cat fleeing onto the kitchen counter knocks the mug over: full points for Tofu', () => {
    const g = makeGame();
    const S = g.state;
    const tofu = g.tofu;
    const human = S.chars[1];
    const mug = g.itemById('tasse')!;
    // Tofu cannot reach it himself.
    place(tofu, mug.x, -4.7, Math.PI);
    expect(listInteractions(g, tofu).some((i) => i.target === mug.idx && i.kind === 'knock')).toBe(false);
    // The cat jumps from the kitchen floor onto the counter, Tofu right behind.
    const idx = (id: string) => CAT_NODES.findIndex((n) => n.id === id);
    const cat = S.cat;
    const from = idx('h_kitchen');
    const to = idx('h_counter');
    Object.assign(cat, { node: from, edgeFrom: from, edgeTo: to, edgeT: 0, jump: true, mode: 'flee', path: [], x: CAT_NODES[from].x, z: CAT_NODES[from].z, y: 0 });
    cat.edgeLen = Math.hypot(CAT_NODES[to].x - CAT_NODES[from].x, CAT_NODES[to].z - CAT_NODES[from].z);
    place(tofu, -3.5, -1.5, Math.PI);
    const chaos0 = S.chaos;
    steps(g, 40);
    expect(mug.state === 'air' || mug.state === 'knocked').toBe(true);
    expect(S.stats.chains).toBe(1);
    expect(S.chaos - chaos0).toBeGreaterThanOrEqual(3);
    steps(g, 90);
    expect(mug.state).toBe('knocked');
    const coffee = S.messes.find((m) => m.kind === 'coffee')!;
    expect(coffee).toBeTruthy();
    // A human mops it: the mug is back on the counter.
    place(tofu, -10, 18, 0);
    // (Next to it: teleporting into the counter would count as a sprint and make her slip.)
    place(human, coffee.x, -4.5, Math.PI);
    hold(g, human.id, 1.8);
    expect(mug.state).toBe('home');
    expect(mug.y).toBeCloseTo(0.92, 5);
  });

  it('without Tofu around, the cat knocking something is only a small accident', () => {
    const g = makeGame();
    const S = g.state;
    const idx = (id: string) => CAT_NODES.findIndex((n) => n.id === id);
    const from = idx('h_counter');
    const to = idx('h_window');
    Object.assign(S.cat, { node: from, edgeFrom: from, edgeTo: to, edgeT: 0, jump: true, mode: 'flee', path: [], x: CAT_NODES[from].x, z: CAT_NODES[from].z, y: CAT_NODES[from].y });
    S.cat.edgeLen = 0.6;
    place(g.tofu, -10, 18, 0);
    const pot = g.itemById('basilic')!;
    steps(g, 30);
    expect(pot.state === 'air' || pot.state === 'knocked').toBe(true);
    expect(S.stats.chains).toBe(0);
    steps(g, 90);
    expect(S.messes.some((m) => m.kind === 'soil')).toBe(true);
  });

  it('a ball thrown in the living room knocks the vase over (human accident)', () => {
    const g = makeGame();
    const S = g.state;
    const human = S.chars[1];
    const ball = g.itemById('balle')!;
    const vase = g.itemById('vase_salon')!;
    // Between the sofa and the coffee table, flying toward the vase.
    Object.assign(ball, { state: 'air', x: vase.x - 0.8, z: vase.z, y: 0.5, vx: 7, vz: 0, vy: 0.5, by: human.id, bounces: 0 });
    place(g.tofu, -10, 18, 0);
    steps(g, 20);
    expect(vase.state === 'air' || vase.state === 'knocked').toBe(true);
    expect(vase.by).toBe(human.id);
    expect(S.stats.humanAccidents).toBe(1);
  });

  it('the robot vacuum switched on by Tofu makes chain reactions', () => {
    const g = makeGame();
    const S = g.state;
    const tofu = g.tofu;
    const v = S.vacuum;
    place(tofu, v.x, v.z + 0.7, Math.PI);
    press(g, tofu.id);
    expect(v.by).toBe(tofu.id);
    place(tofu, -10, 15, 0);
    const plant = g.itemById('plante_salon')!;
    Object.assign(v, { x: plant.x - 0.9, z: plant.z, facing: Math.PI / 2, turnT: 5 });
    steps(g, 60);
    expect(plant.state === 'air' || plant.state === 'knocked').toBe(true);
    expect(S.stats.chains).toBe(1);
  });
});

describe('autumn', () => {
  it('leaf piles exist only in autumn', () => {
    const summer = makeGame();
    const autumn = makeGame({ variant: 'automne' });
    for (const id of ['feuilles_jardin_o', 'feuilles_square']) {
      expect(summer.itemById(id)!.state).toBe('gone');
      expect(autumn.itemById(id)!.state).toBe('home');
    }
    expect(autumn.state.secrets.some((s) => s.id === 'feuilles')).toBe(true);
    expect(summer.state.secrets.some((s) => s.id === 'feuilles')).toBe(false);
  });

  it('Tofu runs through a pile: leaves everywhere, in his fur, then in the house; humans rake', () => {
    const g = makeGame({ variant: 'automne' });
    const S = g.state;
    const tofu = g.tofu;
    const human = S.chars[1];
    const pile = g.itemById('feuilles_jardin_o')!;
    place(tofu, pile.x - 2, pile.z, Math.PI / 2);
    walk(g, tofu.id, 1, 0, 0.8);
    expect(pile.state === 'air' || pile.state === 'knocked').toBe(true);
    expect(S.stats.leavesScattered).toBe(1);
    expect(tofu.pawKind).toBe('leaves');
    expect(tofu.mud).toBeGreaterThanOrEqual(DOG.leafPaws - 0.05);
    expect(S.secrets.find((s) => s.id === 'feuilles')!.progress).toBe(1);
    steps(g, 60);
    const scattered = S.messes.find((m) => m.kind === 'leaves')!;
    expect(scattered).toBeTruthy();
    // In the house he sheds leaves.
    place(tofu, -3.5, 1.5, Math.PI / 2);
    walk(g, tofu.id, 1, 0, 1.2);
    expect(prints(g, 'leaf_trail')).toBeGreaterThan(3);
    expect(prints(g, 'mud')).toBe(0);
    place(tofu, -10, 18, 0);
    // Raking puts the pile back.
    place(human, scattered.x, scattered.z, 0);
    hold(g, human.id, 2.2);
    expect(pile.state).toBe('home');
    cleanAll(g, human.id, 'leaf_trail', 1.2);
    expect(S.messes.some((m) => m.kind === 'leaf_trail')).toBe(false);
  });
});

describe('winter', () => {
  it('the snow wets the paws: wet prints indoors, not on the cleared street', () => {
    const g = makeGame({ variant: 'hiver' });
    const S = g.state;
    const tofu = g.tofu;
    place(tofu, -6, 12, 0);
    walk(g, tofu.id, 1, 0, 0.3);
    expect(tofu.pawKind).toBe('snow');
    expect(tofu.mud).toBeCloseTo(DOG.snowPaws, 2);
    place(tofu, -3.5, 1.5, Math.PI / 2);
    walk(g, tofu.id, 1, 0, 1.2);
    expect(prints(g, 'wet')).toBeGreaterThan(3);
    expect(prints(g, 'mud')).toBe(0);
    // Summer: the same walk leaves nothing.
    const summer = makeGame();
    place(summer.tofu, -6, 12, 0);
    walk(summer, summer.tofu.id, 1, 0, 0.3);
    expect(summer.tofu.mud).toBe(0);
    // The street is cleared.
    const g2 = makeGame({ variant: 'hiver' });
    place(g2.tofu, -6, -19.5, Math.PI / 2);
    walk(g2, g2.tofu.id, 1, 0, 0.5);
    expect(g2.tofu.mud).toBe(0);
    void S;
  });

  it('Tofu pushes a snowman over; a human rebuilds it', () => {
    const g = makeGame({ variant: 'hiver' });
    const S = g.state;
    const tofu = g.tofu;
    const human = S.chars[1];
    const sm = g.itemById('bonhomme_jardin')!;
    expect(sm.state).toBe('home');
    expect(g.itemById('bonhomme_square')!.state).toBe('home');
    expect(makeGame().itemById('bonhomme_jardin')!.state).toBe('gone');
    place(tofu, sm.x, sm.z - 0.95, 0);
    const push = listInteractions(g, tofu).find((i) => i.target === sm.idx);
    expect(push?.kind).toBe('push_bin');
    expect(push?.label).toBe('Renverser le bonhomme de neige');
    hold(g, tofu.id, 0.9);
    expect(sm.state === 'air' || sm.state === 'knocked').toBe(true);
    expect(S.stats.snowmen).toBe(1);
    expect(S.secrets.find((s) => s.id === 'bonhomme')!.progress).toBe(1);
    steps(g, 90);
    const snow = S.messes.find((m) => m.kind === 'snow')!;
    expect(snow).toBeTruthy();
    place(tofu, -10, 18, 0);
    place(human, snow.x, snow.z, 0);
    expect(listInteractions(g, human)[0].label).toBe('Refaire le bonhomme');
    hold(g, human.id, 2.7);
    expect(sm.state).toBe('home');
  });
});

describe('market day', () => {
  it('stalls and goods exist only on market day (and the stalls are solid)', () => {
    const summer = makeGame();
    const market = makeGame({ variant: 'marche' });
    const si = STATIONS.findIndex((s) => s.id === 'etal_fromage');
    expect(summer.state.stations[si].disabled).toBe(true);
    expect(market.state.stations[si].disabled).toBe(false);
    expect(summer.itemById('marche_fromage')!.state).toBe('gone');
    const cheese = market.itemById('marche_fromage')!;
    expect(cheese.state).toBe('stored');
    expect(cheese.station).toBe(si);
    const s = STATIONS[si];
    expect(getWorld('marche').humanNav.isFree(s.x, s.z)).toBe(false);
    expect(getWorld('ete').humanNav.isFree(s.x, s.z)).toBe(true);
    expect(market.state.secrets.some((x) => x.id === 'marche')).toBe(true);
  });

  it('Tofu steals the saucisson and eats it; it comes back on its stall later', () => {
    const g = makeGame({ variant: 'marche' });
    const S = g.state;
    const tofu = g.tofu;
    const saucisson = g.itemById('marche_saucisson')!;
    const stall = STATIONS[saucisson.station];
    place(tofu, stall.x, stall.z + 0.75, Math.PI);
    const take = listInteractions(g, tofu).find((i) => i.kind === 'take' && i.target === saucisson.idx);
    expect(take?.label).toBe('Voler le saucisson');
    const chaos0 = S.chaos;
    press(g, tofu.id);
    expect(tofu.hold).toContain(saucisson.idx);
    expect(S.chaos - chaos0).toBeCloseTo(3, 5);
    expect(S.stats.marketStolen).toBe(1);
    place(tofu, -22, 14, 0);
    hold(g, tofu.id, DOG.eatTime + 0.1);
    expect(saucisson.state).toBe('gone');
    steps(g, 60 * (BAGUETTE_RESPAWN + 1));
    expect(saucisson.state).toBe('stored');
    expect(STATIONS[saucisson.station].id).toBe('etal_charcuterie');
  });

  it('a human gives the stolen cheese back to its stall', () => {
    const g = makeGame({ variant: 'marche' });
    const S = g.state;
    const tofu = g.tofu;
    const human = S.chars[1];
    const cheese = g.itemById('marche_fromage')!;
    const stall = STATIONS[cheese.station];
    place(tofu, stall.x, stall.z + 0.75, Math.PI);
    press(g, tofu.id);
    place(tofu, -20, 14, 0);
    pressPick(g, tofu.id, 'drop', cheese.idx);
    expect(cheese.state).toBe('free');
    steps(g, 7);
    expect(S.cleanliness).toBeLessThan(100);
    place(human, cheese.x, cheese.z - 0.7, 0);
    press(g, human.id);
    expect(human.hold).toContain(cheese.idx);
    // The wrong stall does not take it.
    const other = STATIONS.find((s) => s.id === 'etal_charcuterie')!;
    place(human, other.x, other.z + 0.8, Math.PI);
    expect(listInteractions(g, human).some((i) => i.kind === 'store')).toBe(false);
    place(human, stall.x, stall.z + 0.8, Math.PI);
    const store = listInteractions(g, human).find((i) => i.kind === 'store');
    expect(store?.label).toBe('Rendre le fromage au marchand');
    press(g, human.id);
    expect(cheese.state).toBe('stored');
    steps(g, 7);
    expect(S.cleanliness).toBe(100);
  });

  it('the apple crate tips over into rolling apples', () => {
    const g = makeGame({ variant: 'marche' });
    const tofu = g.tofu;
    const crate = g.itemById('cageot')!;
    place(tofu, crate.x, crate.z + 0.9, Math.PI);
    press(g, tofu.id);
    steps(g, 90);
    expect(crate.state).toBe('knocked');
    expect(g.state.messes.some((m) => m.kind === 'apples')).toBe(true);
  });
});

describe('ambiance setup', () => {
  it('each ambiance offers its own secret challenge', () => {
    for (const [v, id] of [['automne', 'feuilles'], ['hiver', 'bonhomme'], ['marche', 'marche']] as const) {
      for (let seed = 1; seed < 6; seed++) {
        const s = chooseSecrets(new Rng(seed), 1, v);
        expect(s.length).toBe(3);
        expect(s.map((x) => x.id)).toContain(id);
      }
    }
    for (let seed = 1; seed < 20; seed++) {
      const ids = chooseSecrets(new Rng(seed), 1, 'ete').map((x) => x.id);
      expect(ids.some((x) => ['feuilles', 'bonhomme', 'marche'].includes(x))).toBe(false);
    }
  });

  it('absent objects are not interactive and do not count', () => {
    const g = makeGame();
    for (const p of ITEMS.filter((i) => i.only && !i.only.includes('ete'))) {
      const it = g.itemById(p.id)!;
      expect(it.state).toBe('gone');
      expect(it.respawnT).toBe(0);
    }
    steps(g, 7);
    expect(g.state.cleanliness).toBe(100);
    void CAN;
    void faceTo;
  });
});
