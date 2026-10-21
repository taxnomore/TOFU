// Input devices: keyboard (full, left half, right half), gamepads, touch.
// Every device produces the same RawInput so gameplay never cares which one.
import { BTN_BARK, BTN_INTERACT, BTN_SIT, BTN_SPECIAL, BTN_SPRINT } from '../../shared/constants';

export interface RawInput {
  /** Movement stick: x right, y up (forward). */
  mx: number;
  my: number;
  /** Camera yaw change (radians this frame). */
  yaw: number;
  pitch: number;
  zoom: number;
  buttons: number;
  pause: boolean;
  tactical: boolean;
}

export function emptyRaw(): RawInput {
  return { mx: 0, my: 0, yaw: 0, pitch: 0, zoom: 0, buttons: 0, pause: false, tactical: false };
}

export interface InputDevice {
  readonly id: string;
  readonly kind: 'keyboard' | 'gamepad' | 'touch';
  readonly label: string;
  poll(dt: number): RawInput;
  /** Was any button pressed since last check (for "press to join"). */
  anyPressed(): boolean;
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

const down = new Set<string>();
const pressedOnce = new Set<string>();
let keyboardInstalled = false;

export function installKeyboard() {
  if (keyboardInstalled) return;
  keyboardInstalled = true;
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (!down.has(e.code)) pressedOnce.add(e.code);
    down.add(e.code);
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    down.delete(e.code);
  });
  window.addEventListener('blur', () => down.clear());
}

const GAME_KEYS = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'ShiftLeft', 'ShiftRight', 'Slash', 'Period', 'Comma',
]);

export interface KeyMap {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  interact: string[];
  sprint: string[];
  special: string[];
  bark: string[];
  sit: string[];
  camLeft: string[];
  camRight: string[];
  zoomIn: string[];
  zoomOut: string[];
  tactical: string[];
  pause: string[];
}

export const KEYMAPS: Record<'full' | 'left' | 'right', KeyMap> = {
  full: {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    interact: ['Space', 'Enter'], sprint: ['ShiftLeft', 'ShiftRight'], special: ['KeyF'], bark: ['KeyR'], sit: ['KeyC'],
    camLeft: ['KeyQ'], camRight: ['KeyE'], zoomIn: ['Equal', 'NumpadAdd'], zoomOut: ['Minus', 'NumpadSubtract'],
    tactical: ['KeyV', 'Tab'], pause: ['Escape', 'KeyP'],
  },
  left: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    interact: ['Space'], sprint: ['ShiftLeft'], special: ['KeyF'], bark: ['KeyR'], sit: ['KeyC'],
    camLeft: ['KeyQ'], camRight: ['KeyE'], zoomIn: [], zoomOut: [], tactical: ['KeyV'], pause: ['Escape'],
  },
  right: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    interact: ['Enter', 'NumpadEnter', 'Numpad0'], sprint: ['ShiftRight', 'ControlRight'], special: ['Slash', 'Numpad1'],
    bark: ['Period', 'Numpad2'], sit: ['Comma', 'Numpad3'], camLeft: ['KeyO', 'Numpad4'], camRight: ['KeyP', 'Numpad6'],
    zoomIn: [], zoomOut: [], tactical: ['Numpad5'], pause: ['Backspace'],
  },
};

function anyDown(codes: string[]) {
  for (const c of codes) if (down.has(c)) return true;
  return false;
}
function anyOnce(codes: string[]) {
  let r = false;
  for (const c of codes) if (pressedOnce.has(c)) r = true;
  return r;
}

/** Consumes one-shot key presses at the end of a frame. */
export function endFrame() {
  pressedOnce.clear();
}

export function keyDown(code: string): boolean {
  return down.has(code);
}

export function keyPressed(code: string): boolean {
  return pressedOnce.has(code);
}

export class KeyboardDevice implements InputDevice {
  readonly kind = 'keyboard' as const;
  private mouseYaw = 0;
  private mousePitch = 0;
  private wheel = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(readonly id: string, readonly label: string, readonly map: KeyMap, mouseTarget?: HTMLElement) {
    installKeyboard();
    if (mouseTarget) {
      mouseTarget.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      });
      window.addEventListener('pointerup', () => (this.dragging = false));
      window.addEventListener('pointermove', (e) => {
        if (!this.dragging || e.pointerType !== 'mouse') return;
        this.mouseYaw -= (e.clientX - this.lastX) * 0.006;
        this.mousePitch += (e.clientY - this.lastY) * 0.004;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      });
      mouseTarget.addEventListener('wheel', (e) => {
        this.wheel += Math.sign(e.deltaY) * 0.8;
        e.preventDefault();
      }, { passive: false });
      mouseTarget.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  poll(dt: number): RawInput {
    const m = this.map;
    const r = emptyRaw();
    r.mx = (anyDown(m.right) ? 1 : 0) - (anyDown(m.left) ? 1 : 0);
    r.my = (anyDown(m.up) ? 1 : 0) - (anyDown(m.down) ? 1 : 0);
    const l = Math.hypot(r.mx, r.my);
    if (l > 1) {
      r.mx /= l;
      r.my /= l;
    }
    if (anyDown(m.interact)) r.buttons |= BTN_INTERACT;
    if (anyDown(m.sprint)) r.buttons |= BTN_SPRINT;
    if (anyDown(m.special)) r.buttons |= BTN_SPECIAL;
    if (anyDown(m.bark)) r.buttons |= BTN_BARK;
    if (anyDown(m.sit)) r.buttons |= BTN_SIT;
    r.yaw = this.mouseYaw + ((anyDown(m.camLeft) ? 1 : 0) - (anyDown(m.camRight) ? 1 : 0)) * 2.2 * dt;
    r.pitch = this.mousePitch;
    r.zoom = this.wheel + ((anyDown(m.zoomOut) ? 1 : 0) - (anyDown(m.zoomIn) ? 1 : 0)) * 6 * dt;
    this.mouseYaw = 0;
    this.mousePitch = 0;
    this.wheel = 0;
    r.pause = anyOnce(m.pause);
    r.tactical = anyOnce(m.tactical);
    return r;
  }

  anyPressed(): boolean {
    const m = this.map;
    return anyOnce([...m.interact, ...m.up, ...m.down, ...m.left, ...m.right]);
  }
}

// ---------------------------------------------------------------------------
// Gamepads (standard mapping)
// ---------------------------------------------------------------------------

function dead(x: number, y: number, dz = 0.2): [number, number] {
  const l = Math.hypot(x, y);
  if (l < dz) return [0, 0];
  const k = Math.min(1, (l - dz) / (1 - dz)) / l;
  return [x * k, y * k];
}

export function listGamepads(): Gamepad[] {
  try {
    return (navigator.getGamepads?.() ?? []).filter((g): g is Gamepad => !!g && g.connected);
  } catch {
    return [];
  }
}

export class GamepadDevice implements InputDevice {
  readonly kind = 'gamepad' as const;
  private prev: boolean[] = [];
  constructor(readonly id: string, readonly label: string, readonly index: number) {}

  private pad(): Gamepad | null {
    try {
      const p = navigator.getGamepads?.()[this.index];
      return p && p.connected ? p : null;
    } catch {
      return null;
    }
  }

  get connected(): boolean {
    return !!this.pad();
  }

  poll(dt: number): RawInput {
    const r = emptyRaw();
    const p = this.pad();
    if (!p) return r;
    const b = (i: number) => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
    const once = (i: number) => b(i) && !this.prev[i];
    let [mx, my] = dead(p.axes[0] ?? 0, p.axes[1] ?? 0);
    if (b(14)) mx = -1;
    if (b(15)) mx = 1;
    if (b(12)) my = -1;
    if (b(13)) my = 1;
    r.mx = mx;
    r.my = -my;
    const [lx, ly] = dead(p.axes[2] ?? 0, p.axes[3] ?? 0, 0.22);
    r.yaw = -lx * 2.6 * dt + ((b(4) ? 1 : 0) - (b(5) ? 1 : 0)) * 2.2 * dt;
    r.pitch = ly * 1.4 * dt;
    if (b(0)) r.buttons |= BTN_INTERACT;
    if (b(6) || b(7) || b(10)) r.buttons |= BTN_SPRINT;
    if (b(2)) r.buttons |= BTN_SPECIAL;
    if (b(1)) r.buttons |= BTN_BARK;
    if (b(3)) r.buttons |= BTN_SIT;
    r.pause = once(9);
    r.tactical = once(8);
    this.prev = p.buttons.map((_, i) => b(i));
    return r;
  }

  anyPressed(): boolean {
    const p = this.pad();
    if (!p) return false;
    const now = p.buttons.map((x) => x.pressed);
    const res = now.some((v, i) => v && !this.prev[i]);
    this.prev = now;
    return res;
  }
}

// ---------------------------------------------------------------------------
// Touch (virtual stick + big buttons)
// ---------------------------------------------------------------------------

export class TouchDevice implements InputDevice {
  readonly kind = 'touch' as const;
  readonly id = 'touch';
  readonly label = 'Écran tactile';
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stick = { x: 0, y: 0 };
  private camId: number | null = null;
  private camLast = { x: 0, y: 0 };
  private camYaw = 0;
  private camPitch = 0;
  private held = 0;
  private pauseFlag = false;
  readonly el: HTMLDivElement;
  private knob: HTMLDivElement;
  private base: HTMLDivElement;
  private buttons: Map<number, HTMLButtonElement> = new Map();

  constructor(parent: HTMLElement, role: 'tofu' | 'human') {
    this.el = document.createElement('div');
    this.el.className = 'touch-layer';
    this.base = document.createElement('div');
    this.base.className = 'touch-stick';
    this.knob = document.createElement('div');
    this.knob.className = 'touch-knob';
    this.base.appendChild(this.knob);
    this.el.appendChild(this.base);
    const pad = document.createElement('div');
    pad.className = 'touch-buttons';
    const mk = (cls: string, label: string, bit: number) => {
      const b = document.createElement('button');
      b.className = 'tbtn ' + cls;
      b.innerHTML = label;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.setPointerCapture(e.pointerId);
        this.held |= bit;
        b.classList.add('on');
      });
      const up = (e: PointerEvent) => {
        e.preventDefault();
        this.held &= ~bit;
        b.classList.remove('on');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      pad.appendChild(b);
      this.buttons.set(bit, b);
      return b;
    };
    mk('t-action', '<span>✋</span><small>Action</small>', BTN_INTERACT);
    mk('t-sprint', '<span>💨</span><small>Courir</small>', BTN_SPRINT);
    mk('t-special', role === 'tofu' ? '<span>🌀</span><small>Zoomies</small>' : '<span>🦴</span><small>Friandise</small>', BTN_SPECIAL);
    mk('t-bark', role === 'tofu' ? '<span>🗯️</span><small>Wouf</small>' : '<span>📣</span><small>Appeler</small>', BTN_BARK);
    if (role === 'tofu') mk('t-sit', '<span>🐾</span><small>Assis</small>', BTN_SIT);
    this.el.appendChild(pad);
    const pause = document.createElement('button');
    pause.className = 'tbtn t-pause';
    pause.textContent = '⏸';
    pause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.pauseFlag = true;
    });
    this.el.appendChild(pause);
    parent.appendChild(this.el);

    this.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const w = window.innerWidth;
      if (e.clientX < w * 0.45 && this.stickId === null) {
        this.stickId = e.pointerId;
        this.stickOrigin = { x: e.clientX, y: e.clientY };
        this.stick = { x: 0, y: 0 };
        this.base.style.left = `${e.clientX}px`;
        this.base.style.top = `${e.clientY}px`;
        this.base.classList.add('active');
      } else if (this.camId === null) {
        this.camId = e.pointerId;
        this.camLast = { x: e.clientX, y: e.clientY };
      }
    });
    const move = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) {
        const R = 60;
        let dx = e.clientX - this.stickOrigin.x;
        let dy = e.clientY - this.stickOrigin.y;
        const l = Math.hypot(dx, dy);
        if (l > R) {
          dx *= R / l;
          dy *= R / l;
        }
        this.stick = { x: dx / R, y: -dy / R };
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (e.pointerId === this.camId) {
        this.camYaw -= (e.clientX - this.camLast.x) * 0.008;
        this.camPitch += (e.clientY - this.camLast.y) * 0.004;
        this.camLast = { x: e.clientX, y: e.clientY };
      }
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) {
        this.stickId = null;
        this.stick = { x: 0, y: 0 };
        this.knob.style.transform = '';
        this.base.classList.remove('active');
      }
      if (e.pointerId === this.camId) this.camId = null;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  setSpecialLabel(html: string) {
    const b = this.buttons.get(BTN_SPECIAL);
    if (b) b.innerHTML = html;
  }

  setReady(bit: number, ready: boolean) {
    const b = this.buttons.get(bit);
    if (b) b.classList.toggle('ready', ready);
  }

  poll(): RawInput {
    const r = emptyRaw();
    const dzx = Math.abs(this.stick.x) < 0.12 ? 0 : this.stick.x;
    const dzy = Math.abs(this.stick.y) < 0.12 ? 0 : this.stick.y;
    r.mx = dzx;
    r.my = dzy;
    r.buttons = this.held;
    r.yaw = this.camYaw;
    r.pitch = this.camPitch;
    this.camYaw = 0;
    this.camPitch = 0;
    r.pause = this.pauseFlag;
    this.pauseFlag = false;
    return r;
  }

  anyPressed(): boolean {
    return this.held !== 0;
  }

  dispose() {
    this.el.remove();
  }
}

/** Human readable key label, adapted to AZERTY keyboards for French players. */
export function keyLabel(code: string): string {
  const azerty = isAzerty();
  const map: Record<string, string> = {
    Space: 'Espace', ShiftLeft: 'Maj', ShiftRight: 'Maj D', Enter: 'Entrée', Escape: 'Échap', Tab: 'Tab',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ControlRight: 'Ctrl D', Backspace: '⌫',
    NumpadEnter: 'Entrée', Numpad0: '0 (pavé)',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) {
    const k = code.slice(3);
    if (azerty) {
      const az: Record<string, string> = { Q: 'A', W: 'Z', A: 'Q', Z: 'W', M: ',' };
      return az[k] ?? k;
    }
    return k;
  }
  const punct: Record<string, string> = azerty
    ? { Slash: '!', Period: ':', Comma: ';', Semicolon: 'M', Minus: ')', Equal: '=' }
    : { Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Minus: '-', Equal: '=' };
  if (punct[code]) return punct[code];
  return code.replace('Digit', '').replace('Numpad', 'Pavé ');
}

let azertyCache: boolean | null = null;
export function isAzerty(): boolean {
  if (azertyCache !== null) return azertyCache;
  azertyCache = /^fr/i.test(navigator.language || '') && !/CA/i.test(navigator.language || '');
  try {
    const kb = (navigator as unknown as { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
    kb?.getLayoutMap().then((m) => {
      const q = m.get('KeyQ');
      if (q) azertyCache = q.toLowerCase() === 'a';
    }).catch(() => undefined);
  } catch {
    /* not supported */
  }
  return azertyCache;
}
