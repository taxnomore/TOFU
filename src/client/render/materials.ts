// Shared materials. The "occluder" material cuts a see-through cylinder between
// the camera and the local player, so walls, roofs, hedges and trees never hide
// the action (works per viewport in split screen).
import * as THREE from 'three';
import type { FloorKind } from '../../shared/world/types';
import { floorTexture } from './textures';

export const cutUniforms = {
  uCutCam: { value: new THREE.Vector3(0, 50, 0) },
  uCutTarget: { value: new THREE.Vector3() },
  uCutRadius: { value: 1.9 },
  uCutOn: { value: 1 },
  /** Horizontal radius around the player where camera-side walls are lowered. */
  uCutWide: { value: 7.5 },
  /** Height above which camera-side occluders are removed near the player. */
  uCutHeight: { value: 1.05 },
  uCutInner: { value: new THREE.Color(0x9a8a76) },
};

const CUT_FRAG_HEAD = /* glsl */ `
varying vec3 vCutWorld;
uniform vec3 uCutCam;
uniform vec3 uCutTarget;
uniform float uCutRadius;
uniform float uCutOn;
uniform float uCutWide;
uniform float uCutHeight;
uniform vec3 uCutInner;
float cutBayer(vec2 p) {
  // Interleaved gradient noise: cheap screen-space dithering.
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
`;

const CUT_FRAG_MAIN = /* glsl */ `
  if (uCutOn > 0.5) {
    vec3 ab = uCutTarget - uCutCam;
    float L = length(ab);
    vec3 dir = ab / max(L, 0.001);
    vec3 ap = vCutWorld - uCutCam;
    float t = dot(ap, dir);
    float dith = cutBayer(gl_FragCoord.xy);
    if (t > 0.0 && t < L - 0.45) {
      float d = length(ap - dir * t);
      float r = uCutRadius * (0.75 + 0.25 * smoothstep(0.0, L, t));
      if (d < r - 0.35 * dith) discard;
    }
    // Dollhouse view: lower occluders standing between the player and the camera.
    vec2 tc = uCutCam.xz - uCutTarget.xz;
    float tcl = length(tc);
    if (tcl > 0.01 && vCutWorld.y > uCutHeight) {
      vec2 rel = vCutWorld.xz - uCutTarget.xz;
      float side = dot(rel, tc / tcl);
      if (side > -0.3 && length(rel) < uCutWide - 0.6 * dith) discard;
    }
  }
`;

/** Wall caps: only visible exactly where the dollhouse cut lowers the walls. */
const CAP_FRAG_MAIN = /* glsl */ `
  {
    if (uCutOn < 0.5) discard;
    vec2 tc = uCutCam.xz - uCutTarget.xz;
    float tcl = length(tc);
    if (tcl < 0.01) discard;
    vec2 rel = vCutWorld.xz - uCutTarget.xz;
    float side = dot(rel, tc / tcl);
    float dith = cutBayer(gl_FragCoord.xy);
    if (!(side > -0.3 && length(rel) < uCutWide - 0.6 * dith)) discard;
  }
`;

export function applyCapShader(mat: THREE.Material): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCutCam = cutUniforms.uCutCam;
    shader.uniforms.uCutTarget = cutUniforms.uCutTarget;
    shader.uniforms.uCutRadius = cutUniforms.uCutRadius;
    shader.uniforms.uCutOn = cutUniforms.uCutOn;
    shader.uniforms.uCutWide = cutUniforms.uCutWide;
    shader.uniforms.uCutHeight = cutUniforms.uCutHeight;
    shader.uniforms.uCutInner = cutUniforms.uCutInner;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCutWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CUT_FRAG_HEAD)
      .replace('void main() {', 'void main() {\n' + CAP_FRAG_MAIN);
  };
  mat.customProgramCacheKey = () => 'tofu-cap';
}

export function applyCutout(mat: THREE.Material): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCutCam = cutUniforms.uCutCam;
    shader.uniforms.uCutTarget = cutUniforms.uCutTarget;
    shader.uniforms.uCutRadius = cutUniforms.uCutRadius;
    shader.uniforms.uCutOn = cutUniforms.uCutOn;
    shader.uniforms.uCutWide = cutUniforms.uCutWide;
    shader.uniforms.uCutHeight = cutUniforms.uCutHeight;
    shader.uniforms.uCutInner = cutUniforms.uCutInner;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCutWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CUT_FRAG_HEAD)
      .replace('void main() {', 'void main() {\n' + CUT_FRAG_MAIN);
  };
  mat.customProgramCacheKey = () => 'tofu-cutout';
}

export interface Materials {
  vc: THREE.MeshLambertMaterial;
  vcCut: THREE.MeshLambertMaterial;
  cap: THREE.MeshBasicMaterial;
  glass: THREE.MeshLambertMaterial;
  glassCut: THREE.MeshLambertMaterial;
  mud: THREE.MeshPhongMaterial;
  water: THREE.MeshPhongMaterial;
  floors: Map<FloorKind, THREE.MeshLambertMaterial>;
  floor(kind: FloorKind): THREE.MeshLambertMaterial;
  basic(color: number): THREE.MeshBasicMaterial;
  sign(tex: THREE.Texture): THREE.MeshLambertMaterial;
}

let shared: Materials | null = null;

export function materials(maxAniso = 4): Materials {
  if (shared) return shared;
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true });
  const vcCut = new THREE.MeshLambertMaterial({ vertexColors: true });
  applyCutout(vcCut);
  const cap = new THREE.MeshBasicMaterial({ vertexColors: true });
  applyCapShader(cap);
  const glass = new THREE.MeshLambertMaterial({ color: 0xcfeaf6, transparent: true, opacity: 0.32, depthWrite: false });
  const glassCut = glass.clone();
  applyCutout(glassCut);
  const mud = new THREE.MeshPhongMaterial({ color: 0x5a3f2a, shininess: 70, specular: 0x4a4a4a });
  const water = new THREE.MeshPhongMaterial({ color: 0x8cc8ea, transparent: true, opacity: 0.62, shininess: 110, specular: 0xffffff, depthWrite: false });
  const floors = new Map<FloorKind, THREE.MeshLambertMaterial>();
  const basicCache = new Map<number, THREE.MeshBasicMaterial>();
  shared = {
    vc, vcCut, cap, glass, glassCut, mud, water, floors,
    floor(kind) {
      let m = floors.get(kind);
      if (!m) {
        const { tex } = floorTexture(kind, maxAniso);
        m = new THREE.MeshLambertMaterial({ map: tex, transparent: kind === 'crosswalk' });
        if (kind === 'crosswalk') m.depthWrite = false;
        floors.set(kind, m);
      }
      return m;
    },
    basic(color) {
      let m = basicCache.get(color);
      if (!m) {
        m = new THREE.MeshBasicMaterial({ color });
        basicCache.set(color, m);
      }
      return m;
    },
    sign(tex) {
      return new THREE.MeshLambertMaterial({ map: tex });
    },
  };
  return shared;
}
