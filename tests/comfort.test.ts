// Comfort options that live outside the browser page: gamepad remapping
// (bindings, saved copy, polling) works with a fake gamepad and storage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BTN_BARK, BTN_INTERACT, BTN_SPRINT } from '../src/shared/constants';
import { GamepadDevice, PADMAP, bindPad, loadPadmap, padButtonLabel, resetPadmap } from '../src/client/input/devices';

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

/** A standard-mapping gamepad with these buttons held. */
function pad(...held: number[]) {
  return {
    connected: true,
    index: 0,
    id: 'Test pad',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i), value: held.includes(i) ? 1 : 0 })),
  };
}

let current = pad();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', fakeStorage);
  vi.stubGlobal('navigator', { getGamepads: () => [current] });
  resetPadmap();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gamepad remapping', () => {
  it('a button does one thing: binding it takes it from the other action', () => {
    expect(PADMAP.interact).toEqual([0]);
    expect(PADMAP.bark).toEqual([1]);
    bindPad('interact', 1);
    expect(PADMAP.interact).toEqual([1]);
    expect(PADMAP.bark).toEqual([]);
    // Swap finished: bark goes to the old Action button.
    bindPad('bark', 0);
    expect(PADMAP.bark).toEqual([0]);
    expect(PADMAP.interact).toEqual([1]);
    // Sprint keeps its other triggers; its main button changes.
    bindPad('sprint', 5);
    expect(PADMAP.sprint).toEqual([5, 6, 10]);
    expect(PADMAP.camRight).toEqual([]);
    // The d-pad always moves: it cannot be bound.
    bindPad('pause', 12);
    expect(PADMAP.pause).toEqual([9]);
  });

  it('the game reads the new buttons', () => {
    const dev = new GamepadDevice('pad0', 'Manette', 0);
    current = pad(0);
    expect(dev.poll(1 / 60).buttons & BTN_INTERACT).toBeTruthy();
    bindPad('interact', 3);
    current = pad(0);
    expect(dev.poll(1 / 60).buttons).toBe(0);
    current = pad(3);
    expect(dev.poll(1 / 60).buttons & BTN_INTERACT).toBeTruthy();
    bindPad('bark', 7);
    current = pad(7);
    const r = dev.poll(1 / 60);
    expect(r.buttons & BTN_BARK).toBeTruthy();
    // RT left sprint; LT still sprints.
    expect(r.buttons & BTN_SPRINT).toBe(0);
    current = pad(6);
    expect(dev.poll(1 / 60).buttons & BTN_SPRINT).toBeTruthy();
    // Pause fires once per press.
    bindPad('pause', 2);
    current = pad(2);
    expect(dev.poll(1 / 60).pause).toBe(true);
    expect(dev.poll(1 / 60).pause).toBe(false);
  });

  it('is saved in this browser and malformed saves are ignored', () => {
    bindPad('interact', 2);
    const saved = store.get('tofu.padmap')!;
    expect(JSON.parse(saved).interact).toEqual([2]);
    resetPadmap();
    store.set('tofu.padmap', saved);
    loadPadmap();
    expect(PADMAP.interact).toEqual([2]);
    expect(PADMAP.special).toEqual([]);
    resetPadmap();
    store.set('tofu.padmap', JSON.stringify({ interact: [13], bark: ['x'], sit: [3, 4, 5, 6, 7], pause: 'Start' }));
    loadPadmap();
    expect(PADMAP.interact).toEqual([0]);
    expect(PADMAP.bark).toEqual([1]);
    expect(PADMAP.sit).toEqual([3, 4, 5]);
    expect(PADMAP.pause).toEqual([9]);
    store.set('tofu.padmap', '{not json');
    expect(() => loadPadmap()).not.toThrow();
  });

  it('names the buttons like on the gamepad', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(padButtonLabel)).toEqual(['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start']);
    expect(padButtonLabel(20)).toBe('B20');
  });
});
