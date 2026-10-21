// WebGL renderer wrapper: one canvas, one scene, N viewports (split screen
// uses scissor rectangles). Shadows are computed once per frame.
import * as THREE from 'three';
import { inHouse } from '../../shared/world/map';
import { DEFAULT_VARIANT, Variant } from '../../shared/world/variants';
import { cutUniforms, materials } from './materials';
import { skyTexture } from './textures';
import { WorldMeshes, buildWorld } from './worldView';

export type Quality = 'high' | 'medium' | 'low';

export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  world!: WorldMeshes;
  quality: Quality;
  /** Ambiance the world is currently built for. */
  variant: Variant = DEFAULT_VARIANT;
  private shadowsDirty = true;

  constructor(readonly canvas: HTMLCanvasElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: quality !== 'low', powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(0xd9e9f0, 60, 140);

    this.hemi = new THREE.HemisphereLight(0xe6f3ff, 0xb59b74, 1.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    this.sun.position.set(-22, 38, 26);
    this.sun.target.position.set(0, 0, -3);
    this.scene.add(this.sun.target);
    if (quality !== 'low') {
      this.sun.castShadow = true;
      const s = this.sun.shadow;
      s.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048);
      const cam = s.camera as THREE.OrthographicCamera;
      cam.left = -44;
      cam.right = 44;
      cam.top = 40;
      cam.bottom = -40;
      cam.near = 5;
      cam.far = 120;
      s.bias = -0.0004;
      s.normalBias = 0.03;
      s.radius = 2;
    }
    this.scene.add(this.sun);
    this.buildWorld();
  }

  private buildWorld() {
    const mats = materials(this.renderer.capabilities.getMaxAnisotropy());
    this.world = buildWorld(mats, this.quality, this.variant);
    this.scene.add(this.world.root);
    if (this.quality === 'low') {
      this.world.root.traverse((o) => {
        (o as THREE.Mesh).castShadow = false;
      });
    }
    this.shadowsDirty = true;
  }

  /** Switches the ambiance: seasonal world, sky, fog and light. */
  setVariant(v: Variant) {
    if (v === this.variant) return;
    this.variant = v;
    this.scene.remove(this.world.root);
    this.world.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.buildWorld();
    (this.scene.background as THREE.Texture | null)?.dispose();
    this.scene.background = skyTexture(v);
    const look = LOOKS[v];
    (this.scene.fog as THREE.Fog).color.setHex(look.fog);
    this.sun.color.setHex(look.sun);
    this.sun.intensity = look.sunI;
    this.hemi.color.setHex(look.sky);
    this.hemi.groundColor.setHex(look.ground);
    this.hemi.intensity = look.hemiI;
  }

  setSize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
  }

  /** Must be called once per frame before rendering viewports. */
  beginFrame() {
    this.shadowsDirty = true;
    this.renderer.setScissorTest(false);
  }

  renderView(cam: THREE.PerspectiveCamera, rect: ViewRect, focus: THREE.Vector3, cutOn = true) {
    const r = this.renderer;
    const pr = r.getPixelRatio();
    const H = r.domElement.height / pr;
    // three.js viewports use a bottom-left origin.
    r.setViewport(rect.x, H - rect.y - rect.h, rect.w, rect.h);
    r.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h);
    r.setScissorTest(true);
    cutUniforms.uCutCam.value.copy(cam.position);
    cutUniforms.uCutTarget.value.copy(focus);
    cutUniforms.uCutOn.value = cutOn ? 1 : 0;
    this.world.roof.visible = !inHouse(focus.x, focus.z);
    if (this.shadowsDirty && r.shadowMap.enabled) {
      r.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    r.render(this.scene, cam);
  }
}

/** Light and fog of each ambiance. */
const LOOKS: Record<Variant, { fog: number; sun: number; sunI: number; sky: number; ground: number; hemiI: number }> = {
  ete: { fog: 0xd9e9f0, sun: 0xfff1dc, sunI: 2.4, sky: 0xe6f3ff, ground: 0xb59b74, hemiI: 1.55 },
  marche: { fog: 0xd9e9f0, sun: 0xfff1dc, sunI: 2.4, sky: 0xe6f3ff, ground: 0xb59b74, hemiI: 1.55 },
  automne: { fog: 0xeadcc2, sun: 0xffd2a0, sunI: 2.25, sky: 0xf2e6d0, ground: 0xb08860, hemiI: 1.5 },
  hiver: { fog: 0xe8eef3, sun: 0xeaf2ff, sunI: 1.9, sky: 0xeef4fb, ground: 0xc9d2dc, hemiI: 1.75 },
};

export function detectQuality(): Quality {
  try {
    const saved = localStorage.getItem('tofu.quality');
    if (saved === 'high' || saved === 'medium' || saved === 'low') return saved;
  } catch {
    /* storage unavailable */
  }
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && !matchMedia('(pointer:fine)').matches);
  if (mobile || softwareRendering()) return 'low';
  return 'high';
}

/** True when the browser draws 3D without the graphics card (much slower). */
function softwareRendering(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}
