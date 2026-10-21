// Common session interface used by the app (local or network).
import type { GameEvent, GameState } from '../../shared/sim/types';
import type { InputDevice, RawInput } from '../input/devices';
import { CameraRig } from '../render/camera';
import type { PrevSnapshot } from '../render/gameView';
import type { ViewRect } from '../render/renderer';

export interface LocalPlayer {
  /** Index in the local player list (0..2). */
  slot: number;
  charId: number;
  device: InputDevice;
  rig: CameraRig;
  rect: ViewRect;
  raw: RawInput | null;
  name: string;
}

export interface Session {
  readonly kind: 'local' | 'net';
  state: GameState;
  locals: LocalPlayer[];
  /** Interpolation info for the view. */
  alpha: number;
  prev?: PrevSnapshot;
  paused: boolean;
  update(dt: number): void;
  drainEvents(): GameEvent[];
  dispose(): void;
  /** Restart with the same players (rematch). */
  rematch?(rotateTofu: boolean): void;
}

export function makeRig(): CameraRig {
  return new CameraRig();
}
