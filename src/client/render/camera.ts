// Third-person follow camera. Walls between camera and player are handled by
// the see-through shader, so the camera never gets "trapped" behind walls.
import * as THREE from 'three';
import { clamp, damp, lerpAngle } from '../../shared/math';
import type { Rect } from '../../shared/world/mapTypes';

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260);
  yaw = Math.PI;
  pitch = 0.86;
  dist = 8.6;
  tactical = false;
  autoFollow = false;
  readonly target = new THREE.Vector3();
  readonly focus = new THREE.Vector3();
  private initialized = false;
  private shake = 0;
  /** Screen shake on big crashes (can be turned off in the settings). */
  static shakeOn = true;
  /** Playable area of the current map (the camera stays above it). */
  static bounds: Rect = { x0: -30, z0: -30, x1: 30, z1: 30 };

  /** Unit forward vector on the ground plane (x,z). */
  forward(): { x: number; z: number } {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  /** Converts a stick vector (right, up) into a world-space movement vector. */
  toWorld(sx: number, sy: number): { x: number; z: number } {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    return { x: s * sy - c * sx, z: c * sy + s * sx };
  }

  addShake(a: number) {
    if (!CameraRig.shakeOn) return;
    this.shake = Math.min(0.4, this.shake + a);
  }

  update(dt: number, px: number, pz: number, opts: { yawInput: number; pitchInput: number; zoomInput: number; facing?: number; moving?: boolean; height?: number }) {
    this.yaw += opts.yawInput;
    this.pitch = clamp(this.pitch + opts.pitchInput, 0.55, 1.28);
    this.dist = clamp(this.dist + opts.zoomInput, 6, 15);
    if (this.autoFollow && opts.moving && opts.facing !== undefined && Math.abs(opts.yawInput) < 1e-4) {
      // Gently swing behind the character.
      this.yaw = lerpAngle(this.yaw, opts.facing, damp(0.8, dt));
    }
    const h = opts.height ?? 0.8;
    if (!this.initialized) {
      this.target.set(px, h, pz);
      this.initialized = true;
    }
    const k = damp(9, dt);
    this.target.x += (px - this.target.x) * k;
    this.target.z += (pz - this.target.z) * k;
    this.target.y += (h - this.target.y) * k;
    const pitch = this.tactical ? 1.32 : this.pitch;
    const dist = this.tactical ? 24 : this.dist;
    const cp = Math.cos(pitch);
    let cx = this.target.x - Math.sin(this.yaw) * cp * dist;
    let cz = this.target.z - Math.cos(this.yaw) * cp * dist;
    const cy = this.target.y + Math.sin(pitch) * dist;
    // Keep the camera above the playable world (no peeking from the void).
    const B = CameraRig.bounds;
    cx = clamp(cx, B.x0 - 8, B.x1 + 8);
    cz = clamp(cz, B.z0 - 8, B.z1 + 10);
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.5);
      sx = (Math.random() - 0.5) * this.shake * 0.4;
      sy = (Math.random() - 0.5) * this.shake * 0.4;
    }
    this.camera.position.set(cx + sx, cy + sy, cz);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
    this.focus.set(px, 0.9, pz);
  }

  setAspect(a: number) {
    if (Math.abs(this.camera.aspect - a) > 1e-3) {
      this.camera.aspect = a;
      // Wider field of view on narrow split-screen viewports.
      this.camera.fov = a < 1.1 ? 62 : 50;
      this.camera.updateProjectionMatrix();
    }
  }
}
