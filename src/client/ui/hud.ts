// In-game HUD (DOM). One shared top bar + one panel per local viewport.
import * as THREE from 'three';
import { BTN_BARK, BTN_INTERACT, BTN_SIT, BTN_SPECIAL, BTN_SPRINT, DOG, HUMAN } from '../../shared/constants';
import type { Game } from '../../shared/sim/game';
import { listInteractions } from '../../shared/sim/interactions';
import { objectivesFor } from '../../shared/sim/objectives';
import { SECRET_DEFS, TASK_DEFS } from '../../shared/sim/rules';
import type { Character, GameEvent, GameState } from '../../shared/sim/types';
import { ITEM_TYPES, MESS_TYPES } from '../../shared/world/itemTypes';
import { BUILDINGS, DOORS, PROPS, STATIONS, WALLS, ZONES, WORLD_BOUNDS, zoneAt } from '../../shared/world/map';
import { Variant, presentIn } from '../../shared/world/variants';
import type { InputDevice, PadAction } from '../input/devices';
import { KEYMAPS, PADMAP, keyLabel, padButtonLabel } from '../input/devices';
import { HUMAN_LOOKS } from '../render/characters';
import type { LocalPlayer } from '../runtime/session';
import { wallThickness } from '../../shared/world/colliders';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function fmtTime(s: number): string {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function playerColor(c: Character): string {
  if (c.role === 'tofu') return '#f2a93b';
  const col = HUMAN_LOOKS[c.avatar % HUMAN_LOOKS.length].shirt;
  return '#' + col.toString(16).padStart(6, '0');
}

/** Button glyph for a device. */
export function glyph(dev: InputDevice | undefined, button: number): string {
  if (!dev) return '';
  const kind = (dev as { activeKind?: InputDevice['kind'] }).activeKind ?? dev.kind;
  if (kind === 'gamepad') {
    const a = ({ [BTN_INTERACT]: 'interact', [BTN_SPRINT]: 'sprint', [BTN_SPECIAL]: 'special', [BTN_BARK]: 'bark', [BTN_SIT]: 'sit' } as Record<number, PadAction>)[button];
    const b = a ? PADMAP[a][0] : undefined;
    return b === undefined ? '—' : padButtonLabel(b);
  }
  if (kind === 'touch') {
    return ({ [BTN_INTERACT]: '✋', [BTN_SPRINT]: '💨', [BTN_SPECIAL]: '★', [BTN_BARK]: '🗯️', [BTN_SIT]: '🐾' } as Record<number, string>)[button] ?? '?';
  }
  const map = dev.id.includes('right') ? KEYMAPS.right : dev.id.includes('left') ? KEYMAPS.left : KEYMAPS.full;
  const codes = button === BTN_INTERACT ? map.interact : button === BTN_SPRINT ? map.sprint : button === BTN_SPECIAL ? map.special : button === BTN_BARK ? map.bark : map.sit;
  return codes.length ? keyLabel(codes[0]) : '—';
}

// ---------------------------------------------------------------------------
// Event messages
// ---------------------------------------------------------------------------

export interface Toast {
  text: string;
  kind: 'good' | 'bad' | 'info' | 'big';
}

export function eventToast(e: GameEvent, viewer: Character, S: GameState): Toast | null {
  const dog = viewer.role === 'tofu';
  const itemName = (i: number) => ITEM_TYPES[S.items[i]?.type]?.name ?? 'un objet';
  switch (e.t) {
    case 'steal':
      return dog ? null : { text: `🐶 Tofu a pris ${itemName(e.item)} !`, kind: 'bad' };
    case 'vacuum':
      if (!e.on) return e.by === viewer.id ? { text: "🤖 Aspirateur éteint : il rentre à sa base.", kind: 'info' } : null;
      if (S.chars[e.by]?.role === 'tofu') return dog ? { text: '🤖 Vrrrr ! L\'aspirateur part en balade !', kind: 'good' } : { text: "🤖 Tofu a allumé l'aspirateur robot !", kind: 'bad' };
      return { text: "🤖 L'aspirateur nettoie… et bouscule tout !", kind: 'info' };
    case 'paper':
      return dog ? { text: '🧻 Ça se déroule tout seul !', kind: 'good' } : { text: '🧻 Tofu déroule le papier toilette !', kind: 'bad' };
    case 'recover':
      return e.id === viewer.id ? { text: `👍 Tu as repris ${itemName(e.item)} !`, kind: 'good' } : dog ? { text: `😤 On t'a repris ${itemName(e.item)} !`, kind: 'bad' } : null;
    case 'knock':
      if (e.by === -2) return { text: '🐈 Le chat a tout renversé !', kind: dog ? 'good' : 'bad' };
      if (e.by === -4) return { text: "🤖 L'aspirateur a tout renversé !", kind: dog ? 'good' : 'bad' };
      if (S.chars[e.by]?.role === 'human') return { text: `😅 ${S.chars[e.by].name} a fait tomber quelque chose !`, kind: dog ? 'good' : 'bad' };
      return dog ? null : { text: `💥 Tofu a renversé ${itemName(e.item)} !`, kind: 'bad' };
    case 'task': {
      const t = S.tasks[e.idx];
      const title = TASK_DEFS[t.kind].title;
      if (dog) return e.done ? { text: `😒 Les humains ont fini : ${title}`, kind: 'bad' } : { text: `😈 Tâche gâchée : ${title}`, kind: 'good' };
      return e.done ? { text: `✅ ${title} : fait !`, kind: 'good' } : { text: `❌ Tofu a gâché : ${title}`, kind: 'bad' };
    }
    case 'secret': {
      const s = S.secrets[e.idx];
      const def = SECRET_DEFS.find((d) => d.id === s.id)!;
      return dog ? { text: `🤫 Défi secret réussi : ${def.text} (+20)`, kind: 'big' } : { text: '🤫 Tofu a réussi un défi secret…', kind: 'bad' };
    }
    case 'guests':
      return e.on ? { text: '🔔 Ding dong ! Les invités arrivent !', kind: 'big' } : { text: '😱 Oh non ! La maison n\'est plus prête !', kind: 'bad' };
    case 'zoomies':
      return e.on ? { text: dog ? '🌀 ZOOMIES !' : '🌀 Attention : Tofu fait des zoomies !', kind: dog ? 'big' : 'bad' } : null;
    case 'lured':
      return dog ? { text: e.kind === 'treat' ? '🦴 Une friandise ! Impossible de résister…' : '🎾 La balle ! La balle !', kind: 'info' } : { text: e.kind === 'treat' ? '🦴 Tofu a vu la friandise !' : '🎾 Tofu court après la balle !', kind: 'good' };
    case 'muddy':
      return dog ? { text: '🐾 Pattes pleines de boue ! Va dans la maison…', kind: 'info' } : { text: '🐾 Tofu s\'est roulé dans la boue !', kind: 'bad' };
    case 'paws':
      return dog ? { text: '🧽 On t\'a essuyé les pattes !', kind: 'bad' } : e.by === viewer.id ? { text: '🧽 Pattes propres !', kind: 'good' } : null;
    case 'eat':
      if (e.item < 0) return null;
      return dog ? { text: `😋 Miam : ${itemName(e.item)} !`, kind: 'good' } : { text: `😱 Tofu a mangé ${itemName(e.item)} !`, kind: 'bad' };
    case 'slip':
      return { text: `🍌 ${S.chars[e.id].name} a glissé !`, kind: dog ? 'good' : 'bad' };
    case 'startle':
      return e.id === viewer.id ? { text: '😱 WOUF ! Tu as sursauté !', kind: 'bad' } : null;
    case 'cat':
      if (e.what === 'boop') return dog ? { text: '🐈 Pfff ! Coup de patte du chat !', kind: 'info' } : null;
      return null;
    case 'carrier':
      if (e.what === 'arrive') return dog ? { text: '📮 La factrice passe dans la rue !', kind: 'info' } : null;
      if (e.what === 'scared') return { text: '📮 Tofu a fait peur à la factrice !', kind: dog ? 'good' : 'bad' };
      return null;
    case 'innocent':
      return dog ? { text: '😇 Qui, moi ? (+3)', kind: 'good' } : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Top bar (shared by all viewports)
// ---------------------------------------------------------------------------

export class TopBar {
  readonly el = el('div', 'topbar');
  private timer = el('div', 'tb-timer');
  private chaos = el('div', 'meter chaos');
  private chaosFill = el('div', 'fill');
  private chaosText = el('span');
  private clean = el('div', 'meter clean');
  private cleanFill = el('div', 'fill');
  private cleanText = el('span');
  private cleanGoal = el('div', 'goal');
  private guests = el('div', 'tb-guests');
  private last = '';

  constructor(parent: HTMLElement) {
    this.chaos.append(el('b', '', '😈'), this.chaosFill, this.chaosText);
    this.clean.append(el('b', '', '✨'), this.cleanFill, this.cleanGoal, this.cleanText);
    this.el.append(this.chaos, this.timer, this.clean, this.guests);
    parent.appendChild(this.el);
  }

  update(S: GameState) {
    const remaining = S.duration - S.time;
    const key = `${Math.ceil(remaining)}|${Math.floor(S.chaos)}|${Math.round(S.cleanliness)}|${S.guestsT > 0 ? Math.ceil(S.guestsT) : 0}|${S.phase}`;
    if (key === this.last) return;
    this.last = key;
    this.timer.textContent = fmtTime(remaining);
    this.timer.classList.toggle('hurry', remaining < 30 && S.phase === 'play');
    const cp = Math.min(1, S.chaos / S.chaosGoal);
    this.chaosFill.style.width = `${cp * 100}%`;
    this.chaosText.innerHTML = `<i>Bêtises</i>${Math.floor(S.chaos)} / ${S.chaosGoal}`;
    this.chaos.classList.toggle('danger', cp > 0.8);
    this.cleanFill.style.width = `${S.cleanliness}%`;
    this.cleanGoal.style.left = `${S.cleanGoal}%`;
    this.cleanText.innerHTML = `<i>Propreté</i>${Math.round(S.cleanliness)} %`;
    this.clean.classList.toggle('low', S.cleanliness < S.cleanGoal);
    this.guests.style.display = S.guestsT > 0 ? '' : 'none';
    if (S.guestsT > 0) this.guests.textContent = `🔔 Les invités arrivent dans ${Math.ceil(S.guestsT)} s !`;
  }
}

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------

const mapCanvas = new Map<Variant, HTMLCanvasElement>();
const MAP_SCALE = 4;
/** Lawn color of the minimap per ambiance. */
const MAP_LAWN: Record<Variant, [string, string]> = {
  ete: ['#86b867', '#5d8a4a'], marche: ['#86b867', '#5d8a4a'], automne: ['#a7a95a', '#7d7d44'], hiver: ['#e9eef3', '#c9d3dc'],
};

function mapBase(variant: Variant): HTMLCanvasElement {
  const cached = mapCanvas.get(variant);
  if (cached) return cached;
  const B = WORLD_BOUNDS;
  const w = Math.ceil((B.x1 - B.x0) * MAP_SCALE);
  const h = Math.ceil((B.z1 - B.z0) * MAP_SCALE);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = MAP_LAWN[variant][0];
  ctx.fillRect(0, 0, w, h);
  const P = (x: number, z: number) => [(x - B.x0) * MAP_SCALE, (z - B.z0) * MAP_SCALE] as const;
  const rect = (x0: number, z0: number, x1: number, z1: number, col: string) => {
    const [a, b] = P(x0, z0);
    const [cc, d] = P(x1, z1);
    ctx.fillStyle = col;
    ctx.fillRect(a, b, cc - a, d - b);
  };
  const floorCol: Record<string, string> = { rue: '#6b6f76', trottoir_s: '#c9c3b8', trottoir_n: '#c9c3b8', boulangerie: '#d8c9b0', allee: '#d6c8a8', terrasse: '#d9cfbd' };
  for (const z of [...ZONES].reverse()) {
    if (z.indoor) rect(z.x0, z.z0, z.x1, z.z1, '#f3e6cf');
    else if (floorCol[z.id]) rect(z.x0, z.z0, z.x1, z.z1, floorCol[z.id]);
  }
  for (const b of BUILDINGS) rect(b.x0, b.z0, b.x1, b.z1, '#b9a88f');
  // Market stalls.
  for (const p of PROPS) {
    if (p.type !== 'market_stall' || !presentIn(p.only, variant)) continue;
    rect(p.x - 1.1, p.z - 0.45, p.x + 1.1, p.z + 0.45, '#e2a03f');
  }
  ctx.strokeStyle = '#4b3b2e';
  for (const wdef of WALLS) {
    const t = wallThickness(wdef);
    ctx.lineWidth = Math.max(1.5, t * MAP_SCALE);
    ctx.strokeStyle = wdef.style === 'hedge' ? '#3f7a32' : wdef.style.startsWith('house') ? '#4b3b2e' : '#8a7a62';
    const [a, b] = P(wdef.x0, wdef.z0);
    const [cc, d] = P(wdef.x1, wdef.z1);
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(cc, d);
    ctx.stroke();
  }
  // Door gaps in light color.
  ctx.lineWidth = 3;
  for (const d of DOORS) {
    ctx.strokeStyle = '#f3e6cf';
    const [a, b] = P(d.axis === 'x' ? d.x - d.width / 2 : d.x, d.axis === 'x' ? d.z : d.z - d.width / 2);
    const [cc, dd] = P(d.axis === 'x' ? d.x + d.width / 2 : d.x, d.axis === 'x' ? d.z : d.z + d.width / 2);
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(cc, dd);
    ctx.stroke();
  }
  mapCanvas.set(variant, c);
  return c;
}

export class Minimap {
  readonly canvas = el('canvas', 'minimap');
  private ctx: CanvasRenderingContext2D;
  private size = 150;

  constructor(parent: HTMLElement) {
    this.ctx = this.canvas.getContext('2d')!;
    parent.appendChild(this.canvas);
  }

  draw(S: GameState, me: Character, yaw: number, objectives: { x: number; z: number }[], size: number, variant: Variant = 'ete') {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.size !== size || this.canvas.width !== Math.round(size * dpr)) {
      this.size = size;
      this.canvas.width = Math.round(size * dpr);
      this.canvas.height = Math.round(size * dpr);
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
    }
    const ctx = this.ctx;
    const W = this.canvas.width;
    const base = mapBase(variant);
    const B = WORLD_BOUNDS;
    const viewMeters = 34;
    const k = W / viewMeters;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = MAP_LAWN[variant][1];
    ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    // Camera forward is "up": rotate so that the yaw direction points up.
    ctx.rotate(Math.PI + yaw);
    const toMap = (x: number, z: number) => [(x - me.x) * k, (z - me.z) * k] as const;
    ctx.save();
    ctx.scale(k / MAP_SCALE, k / MAP_SCALE);
    ctx.drawImage(base, (B.x0 - me.x) * MAP_SCALE, (B.z0 - me.z) * MAP_SCALE);
    ctx.restore();
    // Messes.
    for (const m of S.messes) {
      const [x, y] = toMap(m.x, m.z);
      ctx.fillStyle = m.kind === 'mud' ? '#7a4f2e' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(x, y, 3.2 * (W / 150), 0, Math.PI * 2);
      ctx.fill();
    }
    // Objectives.
    for (const o of objectives) {
      const [x, y] = toMap(o.x, o.z);
      ctx.strokeStyle = '#2e86de';
      ctx.lineWidth = 2.2 * (W / 150);
      ctx.beginPath();
      ctx.arc(x, y, 4.5 * (W / 150), 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cat.
    {
      const [x, y] = toMap(S.cat.x, S.cat.z);
      ctx.fillStyle = '#2d2d33';
      ctx.beginPath();
      ctx.arc(x, y, 3 * (W / 150), 0, Math.PI * 2);
      ctx.fill();
    }
    // Characters.
    for (const c of S.chars) {
      const [x, y] = toMap(c.x, c.z);
      const r = (c.id === me.id ? 6 : 5) * (W / 150);
      ctx.fillStyle = playerColor(c);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * (W / 150);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (c.id === me.id) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const fx = Math.sin(c.facing);
        const fz = Math.cos(c.facing);
        ctx.moveTo(x + fx * r * 2, y + fz * r * 2);
        ctx.lineTo(x + fz * r * 0.8, y - fx * r * 0.8);
        ctx.lineTo(x - fz * r * 0.8, y + fx * r * 0.8);
        ctx.fill();
      }
      if (c.role === 'tofu' && c.hold.length) {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(x + r, y - r, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    // North marker (world -z), drawn upright.
    const phi = Math.PI + yaw;
    const rN = W / 2 - 12 * (W / 150);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(11 * (W / 150))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', W / 2 + Math.sin(phi) * rN, W / 2 - Math.cos(phi) * rN);
  }
}

// ---------------------------------------------------------------------------
// Per-player HUD
// ---------------------------------------------------------------------------

interface Floater {
  el: HTMLElement;
  x: number;
  y: number;
  z: number;
  t: number;
  max: number;
  follow?: number;
  rise: number;
}

const tmpV = new THREE.Vector3();

export class PlayerHud {
  readonly el = el('div', 'vp');
  private badge = el('div', 'vp-badge');
  private list = el('div', 'vp-list');
  private prompt = el('div', 'vp-prompt');
  private promptKey = el('kbd');
  private promptText = el('span');
  private ring = el('div', 'ring');
  private bars = el('div', 'vp-bars');
  private stam = el('div', 'bar stam');
  private stamFill = el('div', 'fill');
  private zoom = el('div', 'bar zoom');
  private zoomFill = el('div', 'fill');
  private zoomLabel = el('span');
  private treats = el('div', 'treats');
  private toasts = el('div', 'vp-toasts');
  private floats = el('div', 'vp-floats');
  private arrows = el('div', 'vp-arrows');
  private tip = el('div', 'vp-tip');
  private status = el('div', 'vp-status');
  minimap: Minimap;
  private floaters: Floater[] = [];
  private listKey = '';
  private arrowEls: HTMLElement[] = [];
  private tipQueue: string[] = [];
  private tipT = 0;
  private shownTips: Set<string>;
  /** Tips can be turned off in the settings. */
  static tipsOn = true;

  constructor(parent: HTMLElement, readonly lp: LocalPlayer) {
    this.prompt.append(this.ring, this.promptKey, this.promptText);
    this.stam.append(this.stamFill);
    this.zoom.append(this.zoomFill, this.zoomLabel);
    this.bars.append(this.stam, this.zoom, this.treats);
    this.el.append(this.badge, this.list, this.status, this.floats, this.arrows, this.prompt, this.bars, this.toasts, this.tip);
    this.minimap = new Minimap(this.el);
    parent.appendChild(this.el);
    try {
      this.shownTips = new Set(JSON.parse(localStorage.getItem('tofu.tips') ?? '[]'));
    } catch {
      this.shownTips = new Set();
    }
  }

  layout(rect: { x: number; y: number; w: number; h: number }, compact: boolean, underBar = false) {
    this.el.classList.toggle('under-bar', underBar);
    const s = this.el.style;
    s.left = `${rect.x}px`;
    s.top = `${rect.y}px`;
    s.width = `${rect.w}px`;
    s.height = `${rect.h}px`;
    this.el.classList.toggle('compact', compact);
  }

  toast(t: Toast) {
    const e = el('div', `toast ${t.kind}`, t.text);
    this.toasts.prepend(e);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild?.remove();
    setTimeout(() => e.classList.add('out'), t.kind === 'big' ? 3200 : 2400);
    setTimeout(() => e.remove(), t.kind === 'big' ? 3700 : 2900);
  }

  /** Floating text at a world position (rises and fades). */
  floatText(text: string, x: number, y: number, z: number, cls: string, follow?: number) {
    const e = el('div', `float ${cls}`, text);
    this.floats.appendChild(e);
    this.floaters.push({ el: e, x, y, z, t: 0, max: cls.includes('bubble') ? 2.0 : 1.4, follow, rise: cls.includes('bubble') ? 0 : 0.9 });
    if (this.floaters.length > 14) {
      const f = this.floaters.shift();
      f?.el.remove();
    }
  }

  tipOnce(id: string, text: string) {
    if (!PlayerHud.tipsOn || this.shownTips.has(id)) return;
    this.shownTips.add(id);
    try {
      // Split screen: every view adds its own tips to the saved list.
      const saved = new Set(JSON.parse(localStorage.getItem('tofu.tips') ?? '[]') as string[]);
      saved.add(id);
      localStorage.setItem('tofu.tips', JSON.stringify([...saved]));
    } catch {
      /* ignore */
    }
    this.tipQueue.push(text);
  }

  /** Shows every tip again (settings). */
  resetTips() {
    this.shownTips.clear();
  }

  update(dt: number, g: Game, S: GameState, cam: THREE.PerspectiveCamera, headPos: (id: number, out: THREE.Vector3) => THREE.Vector3) {
    const me = S.chars[this.lp.charId];
    if (!me) return;
    const dev = this.lp.device;
    const rect = this.lp.rect;
    const compact = rect.w < 700 || rect.h < 420;
    const dog = me.role === 'tofu';
    // Badge.
    const who = dog ? '🐶 Tofu' : '🧑 ' + me.name;
    const nameHtml = `<i style="background:${playerColor(me)}"></i>${this.lp.spectator ? `👀 Spectateur · ${who}` : who}`;
    if (this.badge.innerHTML !== nameHtml) this.badge.innerHTML = nameHtml;
    // Task / secret list.
    let listHtml = '';
    if (dog) {
      listHtml = '<h4>Défis secrets</h4>' + S.secrets.map((s) => {
        const d = SECRET_DEFS.find((q) => q.id === s.id)!;
        const prog = s.goal > 1 ? ` <em>${Math.floor(s.progress)}/${s.goal}</em>` : '';
        return `<div class="${s.done ? 'done' : ''}">${s.done ? '✅' : d.icon} ${d.text}${s.done ? '' : prog}</div>`;
      }).join('');
    } else {
      listHtml = '<h4>À faire avant les invités</h4>' + S.tasks.map((t) => {
        const d = TASK_DEFS[t.kind];
        const prog = t.total > 1 ? ` <em>${t.progress}/${t.total}</em>` : '';
        return `<div class="${t.done ? 'done' : ''}">${t.done ? '✅' : d.icon} ${d.title}${t.done ? '' : prog}</div>`;
      }).join('') + `<div class="cleanreq ${S.cleanliness >= S.cleanGoal ? 'done' : ''}">${S.cleanliness >= S.cleanGoal ? '✅' : '🧹'} Maison propre (${S.cleanGoal} % min.)</div>`;
    }
    if (listHtml !== this.listKey) {
      this.listKey = listHtml;
      this.list.innerHTML = listHtml;
    }
    // Prompt.
    const inter = S.phase === 'play' && !this.lp.spectator ? listInteractions(g, me)[0] : undefined;
    this.bars.style.display = this.lp.spectator ? 'none' : '';
    if (inter) {
      this.prompt.style.display = '';
      const k = glyph(dev, BTN_INTERACT);
      if (this.promptKey.textContent !== k) this.promptKey.textContent = k;
      const label = inter.hold > 0 ? `${inter.label} (maintenir)` : inter.label;
      if (this.promptText.textContent !== label) this.promptText.textContent = label;
      const act = me.act;
      const p = act ? Math.min(1, act.t / Math.max(0.01, act.dur)) : 0;
      this.ring.style.setProperty('--p', `${p * 360}deg`);
      this.ring.style.display = act ? '' : 'none';
    } else {
      this.prompt.style.display = 'none';
    }
    // Bars.
    this.stamFill.style.width = `${me.stamina * 100}%`;
    this.stam.classList.toggle('tired', me.exhausted);
    if (dog) {
      this.zoom.style.display = '';
      this.treats.style.display = 'none';
      const z = me.zoomT > 0 ? me.zoomT / DOG.zoomiesTime : me.zoom;
      this.zoomFill.style.width = `${z * 100}%`;
      const ready = me.zoom >= 1 && me.zoomT <= 0;
      this.zoom.classList.toggle('ready', ready);
      const zl = me.zoomT > 0 ? 'ZOOMIES !' : ready ? `Zoomies prêts ! [${glyph(dev, BTN_SPECIAL)}]` : 'Zoomies';
      if (this.zoomLabel.textContent !== zl) this.zoomLabel.textContent = zl;
    } else {
      this.zoom.style.display = 'none';
      this.treats.style.display = '';
      const hasBall = me.hold.some((i) => S.items[i].type === 'ball');
      const th = hasBall ? `🎾 Lancer la balle [${glyph(dev, BTN_SPECIAL)}]` : `🦴 × ${me.treats} [${glyph(dev, BTN_SPECIAL)}]`;
      if (this.treats.textContent !== th) this.treats.textContent = th;
      this.treats.classList.toggle('empty', !hasBall && me.treats <= 0);
    }
    // Status line (lured, stunned, carrying...).
    let status = '';
    if (me.lureKind) status = me.lureKind === 'treat' ? '🦴 Trop tentant…' : '🎾 La balle !';
    else if (me.stun > 0) status = dog ? '💫 Aïe…' : '💫 Oups…';
    else if (dog && me.mud > 0.05) {
      const what = me.pawKind === 'snow' ? '❄️ Pattes mouillées' : me.pawKind === 'leaves' ? '🍂 Feuilles dans les poils' : '🐾 Boue';
      status = `${what} : ${Math.round(me.mud * 100)} %`;
    }
    else if (!dog && me.hold.length) status = '🧺 ' + me.hold.map((i) => ITEM_TYPES[S.items[i].type].short).join(', ');
    if (this.status.textContent !== status) this.status.textContent = status;
    this.status.style.display = status ? '' : 'none';

    // Objectives (humans) for arrows + minimap.
    const objectives = dog ? [] : objectivesFor(g, me);
    const mm = compact ? Math.max(90, Math.min(130, rect.h * 0.26)) : 150;
    this.minimap.draw(S, me, this.lp.rig.yaw, objectives, mm, g.variant);

    // Off-screen arrows.
    const targets: { x: number; z: number; cls: string; icon: string }[] = [];
    if (!dog) {
      const tofu = S.chars.find((c) => c.role === 'tofu')!;
      if (tofu.hold.length) targets.push({ x: tofu.x, z: tofu.z, cls: 'red', icon: '🐶' });
      let best = objectives[0];
      let bd = Infinity;
      for (const o of objectives) {
        const d = Math.hypot(o.x - me.x, o.z - me.z);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best && bd > 2.5) targets.push({ x: best.x, z: best.z, cls: 'blue', icon: TASK_DEFS[best.task].icon });
      // Nearest mess.
      let mb: { x: number; z: number } | null = null;
      let md = Infinity;
      for (const m of S.messes) {
        const d = Math.hypot(m.x - me.x, m.z - me.z);
        if (d < md) {
          md = d;
          mb = m;
        }
      }
      if (mb && md > 3 && md < 30) targets.push({ x: mb.x, z: mb.z, cls: 'orange', icon: '🧹' });
    } else {
      const d = Math.hypot(S.cat.x - me.x, S.cat.z - me.z);
      if (d < 26 && d > 4) targets.push({ x: S.cat.x, z: S.cat.z, cls: 'grey', icon: '🐈' });
    }
    this.drawArrows(targets, cam, rect);

    // Floaters.
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t >= f.max) {
        f.el.remove();
        this.floaters.splice(i, 1);
        continue;
      }
      if (f.follow !== undefined) headPos(f.follow, tmpV);
      else tmpV.set(f.x, f.y, f.z);
      tmpV.y += f.rise * f.t;
      tmpV.project(cam);
      const visible = tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
      f.el.style.display = visible ? '' : 'none';
      if (visible) {
        const sx = (tmpV.x * 0.5 + 0.5) * rect.w;
        const sy = (-tmpV.y * 0.5 + 0.5) * rect.h;
        f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
        f.el.style.opacity = String(Math.min(1, (f.max - f.t) / 0.4));
      }
    }

    // Tips.
    this.tipT -= dt;
    if (this.tipT <= 0) {
      const next = this.tipQueue.shift();
      if (next) {
        this.tip.innerHTML = next;
        this.tip.classList.add('show');
        this.tipT = 6;
      } else {
        this.tip.classList.remove('show');
      }
    }
    this.contextTips(S, me, dev, inter?.kind);
  }

  private drawArrows(targets: { x: number; z: number; cls: string; icon: string }[], cam: THREE.PerspectiveCamera, rect: { w: number; h: number }) {
    while (this.arrowEls.length < targets.length) {
      const a = el('div', 'arrow');
      this.arrows.appendChild(a);
      this.arrowEls.push(a);
    }
    this.arrowEls.forEach((a, i) => {
      const t = targets[i];
      if (!t) {
        a.style.display = 'none';
        return;
      }
      tmpV.set(t.x, 0.8, t.z).project(cam);
      const behind = tmpV.z > 1;
      let x = tmpV.x;
      let y = tmpV.y;
      if (behind) {
        x = -x;
        y = -y;
      }
      const onScreen = !behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.85;
      if (onScreen) {
        // Marker above the target.
        a.style.display = '';
        a.className = `arrow onscreen ${t.cls}`;
        a.innerHTML = `<span>${t.icon}</span>`;
        const sx = (x * 0.5 + 0.5) * rect.w;
        const sy = (-y * 0.5 + 0.5) * rect.h;
        a.style.transform = `translate(${sx}px, ${sy - 30}px) translate(-50%, -100%)`;
        return;
      }
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x /= m;
      y /= m;
      const sx = (x * 0.45 + 0.5) * rect.w;
      const sy = (-y * 0.42 + 0.5) * rect.h;
      const ang = Math.atan2(-y, x);
      a.style.display = '';
      a.className = `arrow ${t.cls}`;
      a.innerHTML = `<b style="transform:rotate(${ang}rad)">➤</b><span>${t.icon}</span>`;
      a.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
    });
  }

  private contextTips(S: GameState, me: Character, dev: InputDevice, interKind?: string) {
    if (S.phase !== 'play') return;
    const A = glyph(dev, BTN_INTERACT);
    if (me.role === 'tofu') {
      this.tipOnce('tofu-start', `Tu es <b>Tofu</b> ! Fais des bêtises pour remplir la barre 😈. Vole des chaussettes, renverse des pots, poursuis le chat… Bouton <kbd>${A}</kbd> pour agir.`);
      if (interKind === 'take' || interKind === 'pickup') this.tipOnce('tofu-take', `Appuie sur <kbd>${A}</kbd> pour l'attraper dans ta gueule, puis va le cacher dans ton panier ou dans la rue !`);
      if (me.mud > 0.5 && me.pawKind === 'mud') this.tipOnce('tofu-mud', 'Pattes boueuses ! Cours dans la maison pour laisser des traces 🐾.');
      if (me.mud > 0.2 && me.pawKind === 'snow') this.tipOnce('tofu-snow', 'Pattes pleines de neige ! Dans la maison, elles laissent des traces mouillées 💧.');
      if (me.mud > 0.3 && me.pawKind === 'leaves') this.tipOnce('tofu-leaves', 'Des feuilles plein les poils ! Rentre vite les semer dans la maison 🍂.');
      if (me.hold.some((i) => S.items[i]?.type === 'watering_can')) this.tipOnce('tofu-can', "L'arrosoir fuit ! Cours dans la maison pour mettre de l'eau partout 💧.");
      if (S.items.some((it) => it.type === 'leaf_pile' && it.state === 'home')) this.tipOnce('tofu-pile', 'Automne : fonce dans les tas de feuilles pour les éparpiller 🍂.');
      if (S.items.some((it) => it.type === 'snowman' && it.state === 'home')) this.tipOnce('tofu-snowman', `Hiver : maintiens <kbd>${A}</kbd> contre un bonhomme de neige pour le démolir ⛄.`);
      if (S.stations.some((st) => !st.disabled && STATIONS[st.idx].kind === 'market')) this.tipOnce('tofu-market', 'Jour de marché sur le square : fromage, saucisson et poulet rôti t\'attendent 🧀. Passe par le trou de la haie !');
      if (me.zoom >= 1) this.tipOnce('tofu-zoom', `Zoomies prêts ! Appuie sur <kbd>${glyph(dev, BTN_SPECIAL)}</kbd> pour foncer et tout renverser 🌀.`);
      if (interKind === 'push_door') this.tipOnce('tofu-door', `Porte fermée : maintiens <kbd>${A}</kbd> pour la pousser.`);
      if (S.time > 25) this.tipOnce('tofu-sit', `Astuce : reste immobile ou appuie sur <kbd>${glyph(dev, BTN_SIT)}</kbd> pour t'asseoir l'air innocent 😇. <kbd>${glyph(dev, BTN_BARK)}</kbd> pour aboyer !`);
    } else {
      this.tipOnce('human-start', `Préparez la maison avant l'arrivée des invités ! Suivez la liste et gardez la maison propre. Bouton <kbd>${A}</kbd> pour agir.`);
      if (S.chars.some((c) => c.role === 'tofu' && c.hold.length)) this.tipOnce('human-steal', `Tofu a volé quelque chose ! Rattrape-le et appuie sur <kbd>${A}</kbd> pour le reprendre.`);
      if (S.messes.length) this.tipOnce('human-mess', `Un désordre ! Maintiens <kbd>${A}</kbd> à côté pour nettoyer 🧹.`);
      if (S.time > 20) this.tipOnce('human-treat', `Lance une friandise avec <kbd>${glyph(dev, BTN_SPECIAL)}</kbd> : Tofu ne peut pas résister et lâche ce qu'il porte 🦴.`);
      if (interKind === 'door') this.tipOnce('human-door', 'Ferme les portes ! Tofu doit les pousser longtemps pour passer.');
      if (S.chars.some((c) => c.role === 'tofu' && c.hold.some((i) => S.items[i]?.type === 'watering_can'))) this.tipOnce('human-can', "Tofu a pris l'arrosoir et il fuit ! Les traces d'eau sèchent toutes seules, mais attention, ça glisse.");
      if (S.stations.some((st) => !st.disabled && STATIONS[st.idx].kind === 'market') && S.time > 30) this.tipOnce('human-market', 'Jour de marché : si Tofu vole sur un étal, rapportez la marchandise au bon marchand.');
      if (S.time > 60) this.tipOnce('human-sprint', `Maintiens <kbd>${glyph(dev, BTN_SPRINT)}</kbd> pour courir… mais attention aux flaques et aux jouets par terre !`);
    }
  }

  dispose() {
    this.el.remove();
  }
}

/** Mess label for markers. */
export function messLabel(kind: keyof typeof MESS_TYPES): string {
  return MESS_TYPES[kind].name;
}

export { HUMAN, STATIONS, zoneAt };
