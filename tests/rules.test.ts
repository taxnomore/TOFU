import { describe, expect, it } from 'vitest';
import { faceTo, hold, makeGame, place, press, steps, walk } from './helpers';
import { BTN_BARK, BTN_SPECIAL, BTN_SPRINT } from '../src/shared/constants';
import { ITEM_TYPES } from '../src/shared/world/itemTypes';
import { CAT_NODES, PUDDLES } from '../src/shared/world/map';
import { listInteractions } from '../src/shared/sim/interactions';
import { Game } from '../src/shared/sim/game';

describe('laundry theft and recovery', () => {
  it('Tofu steals a sock, carries it to the garden, a human returns it to the hamper', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const human = g.state.chars[1];
    // Tofu next to the hamper (2.95, -5.45), looking at it.
    place(tofu, 2.95, -4.75, faceTo(2.95, -4.75, 2.95, -5.45));
    const inter = listInteractions(g, tofu)[0];
    expect(inter.kind).toBe('take');
    press(g, tofu.id);
    expect(tofu.hold.length).toBe(1);
    const sock = g.state.items[tofu.hold[0]];
    expect(ITEM_TYPES[sock.type].category).toBe('laundry');
    expect(g.state.chaos).toBeGreaterThanOrEqual(4);
    expect(sock.disturbed).toBe(true);

    // Teleport into the garden and drop it.
    place(tofu, -8, 9, 0);
    steps(g, 2);
    press(g, tofu.id);
    expect(sock.state).toBe('free');
    steps(g, 7); // let rules re-evaluate
    const cleanBefore = g.state.cleanliness;
    expect(cleanBefore).toBeLessThan(100);

    // Human picks it up.
    place(human, sock.x, sock.z - 0.8, 0);
    press(g, human.id);
    expect(human.hold).toContain(sock.idx);
    // Human returns it to the hamper.
    place(human, 2.95, -4.7, Math.PI);
    press(g, human.id);
    expect(sock.state).toBe('stored');
    expect(sock.disturbed).toBe(false);
    steps(g, 7);
    expect(g.state.cleanliness).toBe(100);
  });

  it('a human can take the stolen item from Tofu mouth', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const human = g.state.chars[1];
    place(tofu, 2.95, -4.75, Math.PI);
    press(g, tofu.id);
    expect(tofu.hold.length).toBe(1);
    const item = tofu.hold[0];
    place(tofu, 0, 3, 0);
    place(human, 0, 2.1, 0);
    const best = listInteractions(g, human)[0];
    expect(best.kind).toBe('take_dog');
    press(g, human.id);
    expect(tofu.hold.length).toBe(0);
    expect(human.hold).toContain(item);
    expect(tofu.noPickup).toBeGreaterThan(0);
  });

  it('clothesline job completes when the 4 pieces reach the hamper', () => {
    const g = makeGame();
    const human = g.state.chars[1];
    const task = g.state.tasks.find((t) => t.kind === 'linge')!;
    expect(task.done).toBe(false);
    for (const id of ['linge_1', 'linge_2', 'linge_3', 'linge_4']) {
      const it = g.itemById(id)!;
      place(human, it.x, it.z + 0.7, Math.PI);
      press(g, human.id);
      expect(human.hold).toContain(it.idx);
      place(human, 2.95, -4.7, Math.PI);
      press(g, human.id);
      expect(it.state).toBe('stored');
    }
    steps(g, 7);
    expect(task.done).toBe(true);
    expect(task.progress).toBe(4);
  });
});

describe('mud, knocks and cleaning', () => {
  it('muddy paws leave prints indoors that humans can clean', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const human = g.state.chars[1];
    const p = PUDDLES[0];
    place(tofu, p.x, p.z, 0);
    steps(g, 2);
    expect(tofu.mud).toBe(1);
    // Run through the living room.
    place(tofu, -1, 3.5, Math.PI / 2);
    walk(g, tofu.id, 1, 0, 1.0);
    steps(g, 20);
    place(tofu, -8, 15, 0);
    tofu.mud = 0;
    const mud = g.state.messes.filter((m) => m.kind === 'mud');
    expect(mud.length).toBeGreaterThan(0);
    expect(g.state.stats.mudPrints).toBeGreaterThan(3);
    steps(g, 7);
    expect(g.state.cleanliness).toBeLessThan(100);
    // Clean every mud cell.
    for (const m of mud) {
      place(human, m.x, m.z, 0);
      hold(g, human.id, 2.0);
    }
    expect(g.state.messes.filter((m) => m.kind === 'mud').length).toBe(0);
  });

  it('humans can wipe Tofu paws', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const human = g.state.chars[1];
    tofu.mud = 1;
    place(tofu, 0, 3, 0);
    place(human, 0, 2.1, 0);
    expect(listInteractions(g, human)[0].kind).toBe('paws');
    press(g, human.id);
    expect(tofu.mud).toBe(0);
  });

  it('Tofu running into a plant knocks it over and a human restores it', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const human = g.state.chars[1];
    const plant = g.itemById('plante_salon')!;
    place(tofu, plant.x - 2.5, plant.z, Math.PI / 2);
    walk(g, tofu.id, 1, 0, 1.0);
    steps(g, 90);
    expect(plant.state).toBe('knocked');
    const mess = g.state.messes.find((m) => m.item === plant.idx)!;
    expect(mess).toBeTruthy();
    expect(g.state.chaos).toBeGreaterThan(4);
    place(human, mess.x - 0.9, mess.z, Math.PI / 2);
    hold(g, human.id, 3);
    expect(plant.state).toBe('home');
    expect(g.state.messes.find((m) => m.item === plant.idx)).toBeUndefined();
  });

  it('tipping the street bin spills the trash bag (job undone) and cleaning restores the bin', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const human = g.state.chars[1];
    const bag = g.itemById('sac_poubelle')!;
    const bin = g.itemById('bin_rue')!;
    // Put the bag in the street bin.
    place(human, bag.x, bag.z - 0.6, 0);
    press(g, human.id);
    expect(human.hold).toContain(bag.idx);
    place(human, 4.8, -12.6, Math.PI);
    hold(g, human.id, 0.7);
    expect(bag.state).toBe('stored');
    // Tofu pushes the bin from the sidewalk.
    place(tofu, 4.8, -14.9, 0);
    place(human, 0, 0, 0);
    hold(g, tofu.id, 1.0);
    expect(bin.state).not.toBe('home');
    steps(g, 120);
    expect(bin.state).toBe('knocked');
    expect(bag.state).toBe('free');
    const mess = g.state.messes.find((m) => m.item === bin.idx)!;
    place(human, mess.x, mess.z - 0.6, 0);
    hold(g, human.id, 3);
    expect(bin.state).toBe('home');
  });
});

describe('cat', () => {
  it('flees from Tofu to a perch', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const cat = g.state.cat;
    place(tofu, cat.x + 3, cat.z, 0);
    steps(g, 2);
    expect(cat.mode).toBe('flee');
    steps(g, 60 * 8);
    expect(['perched', 'walk', 'idle']).toContain(cat.mode);
    const node = CAT_NODES[cat.node];
    expect(node).toBeTruthy();
  });

  it('barking at a perched cat gives chaos', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const cat = g.state.cat;
    // Put the cat on the car roof perch.
    const idx = g.world.catNodeIndex.get('a_car_roof')!;
    const n = CAT_NODES[idx];
    cat.node = idx;
    cat.x = n.x;
    cat.y = n.y;
    cat.z = n.z;
    cat.mode = 'perched';
    cat.timer = 10;
    cat.edgeTo = -1;
    place(tofu, n.x - 2.0, n.z, Math.PI / 2);
    const before = g.state.chaos;
    press(g, tofu.id, BTN_BARK);
    expect(g.state.chaos).toBeGreaterThan(before + 2);
  });
});

describe('abilities', () => {
  it('zoomies need a full meter', () => {
    const g = makeGame();
    const tofu = g.tofu;
    press(g, tofu.id, BTN_SPECIAL);
    expect(tofu.zoomT).toBe(0);
    tofu.zoom = 1;
    press(g, tofu.id, BTN_SPECIAL);
    expect(tofu.zoomT).toBeGreaterThan(0);
  });

  it('a thrown treat lures Tofu who drops what he carries', () => {
    const g = makeGame();
    const tofu = g.tofu;
    const human = g.state.chars[1];
    place(tofu, 2.95, -4.75, Math.PI);
    press(g, tofu.id);
    expect(tofu.hold.length).toBe(1);
    place(tofu, 0, 3.5, 0);
    place(human, -3, 4.5, Math.PI / 2);
    press(g, human.id, BTN_SPECIAL);
    steps(g, 60);
    expect(tofu.hold.length).toBe(0);
    steps(g, 60 * 3);
    expect(tofu.lureKind).toBe('');
    expect(tofu.lureImmune).toBeGreaterThan(0);
  });

  it('sprinting drains stamina', () => {
    const g = makeGame();
    const human = g.state.chars[1];
    place(human, -20, 0, 0);
    walk(g, human.id, 0, 1, 1.0, BTN_SPRINT);
    expect(human.stamina).toBeLessThan(0.9);
  });
});

describe('win conditions', () => {
  it('Tofu wins when chaos reaches the goal', () => {
    const g = makeGame();
    g.addChaos(150, 'test', 0, 0);
    steps(g, 1);
    expect(g.state.phase).toBe('end');
    expect(g.state.winner).toBe('tofu');
  });

  it('Tofu wins when time runs out', () => {
    const g = makeGame({ duration: 2 });
    steps(g, 60 * 3);
    expect(g.state.winner).toBe('tofu');
    expect(g.state.endReason).toBe('time');
  });

  it('humans win when every job is done and the house is clean (after the guests countdown)', () => {
    const g = makeGame();
    const S = g.state;
    const st = (id: string) => g.world.stationIndex.get(id)!;
    const store = (itemId: string, stationId: string) => {
      const it = g.itemById(itemId)!;
      g.removeFromStation(it);
      g.putInStation(it, st(stationId));
    };
    for (const t of S.tasks) {
      switch (t.kind) {
        case 'linge': for (const id of ['linge_1', 'linge_2', 'linge_3', 'linge_4']) store(id, 'panier_linge'); break;
        case 'jouets': for (const id of ['jouet_nounours', 'jouet_voiture', 'jouet_canard', 'jouet_dino']) store(id, 'coffre_jouets'); break;
        case 'table': store('vaisselle', 'table_salon'); break;
        case 'gouter': store('croissants', 'table_jardin'); break;
        case 'poubelle': store('sac_poubelle', 'poubelle_rue'); break;
        case 'courrier': store('courrier', 'console'); break;
        case 'lit': g.stationById('lit')!.made = true; break;
        case 'fleurs': g.stationById('massif_est')!.watered = true; g.stationById('massif_sud')!.watered = true; break;
      }
    }
    steps(g, 10);
    expect(S.tasks.every((t) => t.done)).toBe(true);
    expect(S.guestsT).toBeGreaterThan(0);
    steps(g, 60 * 9);
    expect(S.phase).toBe('end');
    expect(S.winner).toBe('humans');
  });

  it('same seed gives the same jobs and secrets (deterministic rematch)', () => {
    const a = makeGame({ seed: 7 });
    const b = makeGame({ seed: 7 });
    expect(a.state.tasks.map((t) => t.kind)).toEqual(b.state.tasks.map((t) => t.kind));
    expect(a.state.secrets.map((t) => t.id)).toEqual(b.state.secrets.map((t) => t.id));
    const c = new Game({ ...a.cfg });
    expect(c.state.items.map((i) => i.state)).toEqual(a.state.items.map((i) => i.state));
  });
});
