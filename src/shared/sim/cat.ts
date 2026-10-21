// Autonomous neighborhood cat. Moves on a hand-authored graph (ground paths,
// wall tops, car roofs, the dog flap, the kitchen window...). Flees from Tofu
// to safe perches, may knock things over while fleeing, hisses at barks.
import { CAT, CHAOS, DOG } from '../constants';
import { angleDiff, dist } from '../math';
import { ITEM_TYPES } from '../world/itemTypes';
import { CAT_NODES, CAT_START } from '../world/map';
import type { Game } from './game';
import type { CatState } from './types';

export function initialCat(g: Game): CatState {
  const n = g.world.catNodeIndex.get(CAT_START)!;
  const node = CAT_NODES[n];
  return {
    x: node.x, y: node.y, z: node.z, facing: 0, mode: 'idle', node: n, path: [], edgeFrom: -1, edgeTo: -1,
    edgeT: 0, edgeLen: 1, jump: false, timer: 3, chaseAcc: 0, fleeChaos: 0, barkCd: 0, hissT: 0, speed: 0, stuckT: 0,
  };
}

function edgeUsable(g: Game, door: number, flap: boolean): boolean {
  if (door < 0 || flap) return true;
  return g.state.doors[door].open;
}

/** Dijkstra over the cat graph from `from`. cost(nodeIdx) adds a node penalty. */
function dijkstra(g: Game, from: number, penalty: (n: number) => number): { dist: Float64Array; prev: Int32Array } {
  const N = CAT_NODES.length;
  const d = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  d[from] = 0;
  for (let k = 0; k < N; k++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < best) { best = d[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    for (const l of g.world.catAdj[u]) {
      if (!edgeUsable(g, l.door, l.flap)) continue;
      const nd = d[u] + l.len + (l.jump ? 0.8 : 0) + penalty(l.to);
      if (nd < d[l.to]) {
        d[l.to] = nd;
        prev[l.to] = u;
      }
    }
  }
  return { dist: d, prev };
}

function buildPath(prev: Int32Array, from: number, to: number): number[] {
  const p: number[] = [];
  for (let c = to; c !== -1 && c !== from; c = prev[c]) p.push(c);
  p.reverse();
  return p;
}

function startEdge(g: Game, cat: CatState): void {
  if (!cat.path.length) {
    cat.edgeTo = -1;
    return;
  }
  const next = cat.path.shift()!;
  const link = g.world.catAdj[cat.node].find((l) => l.to === next);
  if (!link || !edgeUsable(g, link.door, link.flap)) {
    // Door closed meanwhile: stop and re-plan later.
    cat.path = [];
    cat.edgeTo = -1;
    cat.timer = 0.3;
    return;
  }
  cat.edgeFrom = cat.node;
  cat.edgeTo = next;
  cat.edgeT = 0;
  cat.edgeLen = link.len;
  cat.jump = link.jump;
  const a = CAT_NODES[cat.edgeFrom];
  const b = CAT_NODES[cat.edgeTo];
  cat.facing = Math.atan2(b.x - a.x, b.z - a.z);
}

function planTo(g: Game, cat: CatState, target: number, penalty: (n: number) => number): boolean {
  const { dist: d, prev } = dijkstra(g, cat.node, penalty);
  if (!isFinite(d[target])) return false;
  cat.path = buildPath(prev, cat.node, target);
  startEdge(g, cat);
  return true;
}

function startFlee(g: Game, cat: CatState): void {
  const tofu = g.tofu;
  const pen = (n: number) => {
    const node = CAT_NODES[n];
    const dd = dist(node.x, node.z, tofu.x, tofu.z);
    return dd < 2.5 ? 30 : dd < 4.5 ? 6 : 0;
  };
  // If mid-edge, finish the edge first (re-plan from its end).
  const from = cat.edgeTo >= 0 ? cat.edgeTo : cat.node;
  const { dist: d, prev } = dijkstra(g, from, pen);
  let best = -1;
  let bestScore = Infinity;
  CAT_NODES.forEach((node, i) => {
    if (!node.perch || !isFinite(d[i])) return;
    const away = dist(node.x, node.z, tofu.x, tofu.z);
    if (away < 1.5) return;
    const score = d[i] - Math.min(away, 12) * 0.35 + g.rng.next() * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  if (best < 0) return;
  const midEdge = cat.edgeTo >= 0;
  cat.path = buildPath(prev, from, best);
  cat.mode = 'flee';
  cat.fleeChaos = 0;
  // Mid-edge: finish the current edge, then follow the new path.
  if (!midEdge) startEdge(g, cat);
  g.emit({ t: 'cat', what: 'flee', x: cat.x, z: cat.z });
}

function pickWander(g: Game, cat: CatState): void {
  const rng = g.rng;
  const candidates: number[] = [];
  CAT_NODES.forEach((n, i) => {
    if (i === cat.node) return;
    if (n.indoor && !rng.chance(0.25)) return;
    const w = n.perch ? 1 : 2;
    for (let k = 0; k < w; k++) candidates.push(i);
  });
  const tofu = g.tofu;
  for (let tries = 0; tries < 6; tries++) {
    const target = rng.pick(candidates);
    const node = CAT_NODES[target];
    // Avoid wandering right into Tofu.
    if (dist(node.x, node.z, tofu.x, tofu.z) < 6) continue;
    const avoid = (n: number) => (dist(CAT_NODES[n].x, CAT_NODES[n].z, tofu.x, tofu.z) < 5 ? 25 : 0);
    if (planTo(g, cat, target, avoid)) {
      cat.mode = 'walk';
      return;
    }
  }
  cat.timer = 1.5;
}

/** Something frightening nearby (the robot vacuum): run to a perch. */
export function scareCat(g: Game): void {
  const cat = g.state.cat;
  if (g.state.phase !== 'play' || cat.mode === 'flee' || cat.y >= 0.35) return;
  startFlee(g, cat);
}

export function updateCat(g: Game, dt: number): void {
  const S = g.state;
  const cat = S.cat;
  const tofu = g.tofu;
  cat.barkCd = Math.max(0, cat.barkCd - dt);
  if (cat.hissT > 0) cat.hissT -= dt;
  const playing = S.phase === 'play';
  const dTofu = dist(cat.x, cat.z, tofu.x, tofu.z);
  const onGround = cat.y < 0.35;
  const moving = cat.edgeTo >= 0;

  // Threat detection.
  if (playing && cat.mode !== 'flee' && onGround) {
    const fast = tofu.sprinting || tofu.zoomT > 0;
    const fear = fast ? CAT.fearRadiusSprint : CAT.fearRadius;
    if (dTofu < fear) startFlee(g, cat);
  }

  // Boop: Tofu got too close to the cat on the ground.
  if (playing && onGround && dTofu < CAT.boopRadius && tofu.stun <= 0 && cat.hissT <= 0) {
    tofu.stun = DOG.boopStun;
    tofu.vx *= -0.3;
    tofu.vz *= -0.3;
    cat.hissT = 1.0;
    g.say(tofu.id, 'Aïe !');
    g.addChaos(CHAOS.boop, 'Coup de patte du chat !', cat.x, cat.z);
    g.emit({ t: 'cat', what: 'boop', x: cat.x, z: cat.z });
    if (cat.mode !== 'flee') startFlee(g, cat);
  }

  // Chase scoring.
  if (playing && cat.mode === 'flee' && dTofu < 7 && tofu.speed > 2.5) {
    const toCatX = (cat.x - tofu.x) / (dTofu || 1);
    const toCatZ = (cat.z - tofu.z) / (dTofu || 1);
    const dot = (tofu.vx * toCatX + tofu.vz * toCatZ) / (tofu.speed || 1);
    if (dot > 0.45) {
      cat.chaseAcc += dt;
      S.stats.catChase += dt;
      g.progressSecret('chat', dt);
      if (cat.fleeChaos < CHAOS.chaseCapPerFlee) {
        const amt = CHAOS.chasePerSec * dt;
        cat.fleeChaos += amt;
        g.addChaos(amt, '', cat.x, cat.z, true);
      }
      if (cat.chaseAcc > 1.2) {
        g.addZoom(tofu, 'chase');
        cat.chaseAcc = -3; // award zoomies at most every few seconds
      }
    }
  }

  // Movement along the current edge.
  if (moving) {
    const speed = cat.mode === 'flee' ? CAT.flee : CAT.walk;
    if (cat.jump) cat.edgeT += dt / CAT.jumpTime;
    else cat.edgeT += (speed * dt) / Math.max(0.1, cat.edgeLen);
    cat.speed = cat.jump ? cat.edgeLen / CAT.jumpTime : speed;
    const a = CAT_NODES[cat.edgeFrom];
    const b = CAT_NODES[cat.edgeTo];
    const t = Math.min(1, cat.edgeT);
    cat.x = a.x + (b.x - a.x) * t;
    cat.z = a.z + (b.z - a.z) * t;
    cat.y = a.y + (b.y - a.y) * t + (cat.jump ? 4 * 0.7 * t * (1 - t) : 0);
    if (cat.mode === 'flee' && !cat.jump && cat.y < 0.3) bumpKnockables(g, cat);
    if (cat.edgeT >= 1) {
      cat.node = cat.edgeTo;
      cat.edgeTo = -1;
      if (cat.path.length) {
        startEdge(g, cat);
      } else {
        const node = CAT_NODES[cat.node];
        if (cat.mode === 'flee' || node.perch) {
          cat.mode = 'perched';
          cat.timer = g.rng.range(CAT.perchRest[0], CAT.perchRest[1]);
          if (playing && dTofu < 9) g.emit({ t: 'cat', what: 'perch', x: cat.x, z: cat.z });
        } else {
          cat.mode = 'idle';
          cat.timer = g.rng.range(CAT.idleRest[0], CAT.idleRest[1]);
        }
      }
    }
    cat.stuckT = 0;
    return;
  }

  cat.speed = 0;
  // Face Tofu when he is around, otherwise keep heading.
  if (dTofu < 8) {
    const want = Math.atan2(tofu.x - cat.x, tofu.z - cat.z);
    cat.facing += angleDiff(cat.facing, want) * Math.min(1, dt * 4);
  }
  cat.timer -= dt;
  if (cat.mode === 'perched' && dTofu < 6.5 && playing) {
    // Stay safe while Tofu is around.
    cat.timer = Math.max(cat.timer, 1.5);
  }
  if (cat.timer <= 0) {
    if (cat.mode === 'flee') cat.mode = 'perched';
    pickWander(g, cat);
  }
  // Watchdog: never stall forever.
  cat.stuckT += dt;
  if (cat.stuckT > 30) {
    cat.stuckT = 0;
    pickWander(g, cat);
  }
}

/** Bark reaction. Returns true if the cat reacted. */
export function catHearsBark(g: Game): boolean {
  const cat = g.state.cat;
  const tofu = g.tofu;
  const d = dist(cat.x, cat.z, tofu.x, tofu.z);
  if (d > 8) return false;
  if (cat.y > 0.35 && cat.edgeTo < 0) {
    cat.hissT = 1.0;
    g.emit({ t: 'cat', what: 'hiss', x: cat.x, z: cat.z });
    if (cat.barkCd <= 0) {
      cat.barkCd = CHAOS.barkCatCd;
      g.addChaos(CHAOS.barkCat, 'Le chat est furieux !', cat.x, cat.z);
      g.addZoom(tofu, 'bark');
    }
    cat.timer = Math.max(cat.timer, 3);
    return true;
  }
  if (cat.mode !== 'flee' && cat.y < 0.35) {
    startFlee(g, cat);
    return true;
  }
  return false;
}

function bumpKnockables(g: Game, cat: CatState): void {
  for (const it of g.state.items) {
    if (it.state !== 'home' || it.knockCd > 0) continue;
    const t = ITEM_TYPES[it.type];
    if (!t.knock || t.knock.push > 0) continue;
    if (Math.abs(it.y - cat.y) > 0.6) continue;
    if (dist(it.x, it.z, cat.x, cat.z) < CAT.bumpRadius + t.size * 0.5) {
      g.knock(it.idx, Math.sin(cat.facing), Math.cos(cat.facing), 4, -2);
    }
  }
}
