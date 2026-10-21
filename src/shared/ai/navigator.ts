// Path following for AI characters: A* on the nav grid, door handling,
// stuck detection with side-steps and re-planning.
import { DOORS } from '../world/map';
import type { NavGrid, PathPoint } from '../world/nav';
import type { Game } from '../sim/game';
import type { Character } from '../sim/types';
import { Rng } from '../math';

export interface Steer {
  mx: number;
  mz: number;
  /** Within reach of the goal. */
  arrived: boolean;
  /** Closed door blocking the way (index) or -1. */
  door: number;
  /** No path found / persistently stuck. */
  failed: boolean;
  dist: number;
}

export class Navigator {
  path: PathPoint[] = [];
  goalX = 0;
  goalZ = 0;
  hasGoal = false;
  reach = 0.5;
  private repathT = 0;
  private checkT = 0;
  private lastX = 0;
  private lastZ = 0;
  private stuck = 0;
  private sideT = 0;
  private sideX = 0;
  private sideZ = 0;
  failures = 0;

  constructor(readonly g: Game, readonly id: number, readonly rng: Rng) {}

  get me(): Character {
    return this.g.state.chars[this.id];
  }

  get grid(): NavGrid {
    return this.me.role === 'tofu' ? this.g.world.dogNav : this.g.world.humanNav;
  }

  doorCost = (i: number): number => {
    if (this.g.state.doors[i].open) return 0;
    if (this.me.role === 'human') return 1.5;
    return DOORS[i].dogCanPush ? 3 : Infinity;
  };

  setGoal(x: number, z: number, reach = 0.5, force = false) {
    const moved = Math.hypot(x - this.goalX, z - this.goalZ);
    this.reach = reach;
    if (!this.hasGoal || force || moved > 0.8) {
      this.goalX = x;
      this.goalZ = z;
      this.hasGoal = true;
      this.repathT = 0;
      if (moved > 2 || force) {
        this.failures = 0;
        this.stuck = 0;
      }
    } else {
      this.goalX = x;
      this.goalZ = z;
    }
  }

  clear() {
    this.hasGoal = false;
    this.path = [];
  }

  private replan() {
    const me = this.me;
    const p = this.grid.findPath(me.x, me.z, this.goalX, this.goalZ, this.doorCost);
    if (!p) {
      this.path = [];
      this.failures++;
      this.repathT = 0.6;
      return;
    }
    this.path = p;
    this.repathT = 1.2 + this.rng.next() * 0.4;
  }

  update(dt: number): Steer {
    const me = this.me;
    const res: Steer = { mx: 0, mz: 0, arrived: false, door: -1, failed: false, dist: 0 };
    if (!this.hasGoal) return res;
    const d = Math.hypot(this.goalX - me.x, this.goalZ - me.z);
    res.dist = d;
    if (d <= this.reach) {
      res.arrived = true;
      return res;
    }
    // Direct line of sight to the goal: skip the planner.
    const direct = d < 6 && this.grid.lineClear(me.x, me.z, this.goalX, this.goalZ, this.doorCost);
    this.repathT -= dt;
    if (!direct && (this.repathT <= 0 || !this.path.length)) this.replan();
    if (!direct && !this.path.length) {
      res.failed = this.failures > 3;
      return res;
    }
    while (this.path.length > 1 && Math.hypot(this.path[0].x - me.x, this.path[0].z - me.z) < 0.45) this.path.shift();
    const tx = direct ? this.goalX : this.path[0].x;
    const tz = direct ? this.goalZ : this.path[0].z;
    let dx = tx - me.x;
    let dz = tz - me.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    // Closed door just ahead?
    const look = Math.min(1.4, l);
    for (let s = 0.2; s <= look; s += 0.2) {
      const i = this.grid.cellOf(me.x + dx * s, me.z + dz * s);
      if (i < 0) break;
      const di = this.grid.doorAt[i];
      if (di >= 0 && !this.g.state.doors[di].open) {
        res.door = di;
        break;
      }
    }
    // Stuck detection.
    this.checkT -= dt;
    if (this.checkT <= 0) {
      const moved = Math.hypot(me.x - this.lastX, me.z - this.lastZ);
      this.lastX = me.x;
      this.lastZ = me.z;
      this.checkT = 0.6;
      if (moved < 0.25 && !me.act && res.door < 0) {
        this.stuck++;
        if (this.stuck >= 2) {
          // Side-step perpendicular to the way forward and re-plan.
          const side = this.rng.next() < 0.5 ? -1 : 1;
          this.sideX = -dz * side;
          this.sideZ = dx * side;
          this.sideT = 0.45;
          this.repathT = 0;
        }
        if (this.stuck > 7) res.failed = true;
      } else if (moved > 0.6) {
        this.stuck = 0;
      }
    }
    if (this.sideT > 0) {
      this.sideT -= dt;
      res.mx = this.sideX * 0.8 + dx * 0.3;
      res.mz = this.sideZ * 0.8 + dz * 0.3;
      return res;
    }
    const slow = Math.min(1, Math.max(0.45, d / 1.2));
    res.mx = dx * slow;
    res.mz = dz * slow;
    return res;
  }
}
