// Procedural textures and the shared materials.
// One material per flower type, one for all stems and leaves, so every stem
// of a type renders from the same program and texture set.

import * as THREE from 'three';
import { mulberry32, noise2, fbm2 } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function grain(ctx, w, h, amount, seed) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const n = 1 + amount * (fbm2(x / 37, y / 53, seed, 3) * 0.7 + noise2(x / 3, y / 7, seed + 9) * 0.3);
      d[k] *= n; d[k + 1] *= n; d[k + 2] *= n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Veins fan out from the petal base (v = 0 is the base, v = 1 the tip).
function petalCanvas({ spots = false } = {}) {
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d');
  const rng = mulberry32(spots ? 77 : 31);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  ctx.lineCap = 'round';
  // canvas y is flipped against v, so the base is the bottom edge.
  for (let i = 0; i < 46; i++) {
    const f = (i + rng() * 0.8) / 46;
    const x1 = S * (f * 1.5 - 0.25);
    const x0 = S * (0.5 + (f - 0.5) * 0.35);
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + rng() * 0.09})`;
    ctx.lineWidth = 0.6 + rng() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, S * 1.05);
    ctx.bezierCurveTo(x0 + (x1 - x0) * 0.2, S * 0.7, x1 + (rng() - 0.5) * 12, S * 0.35, x1, -4);
    ctx.stroke();
  }
  if (spots) {
    // lily throat: a pale centre stripe and dark freckles on the lower half
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0.4, 'rgba(120,150,40,0)');
    g.addColorStop(0.5, 'rgba(120,150,40,0.28)');
    g.addColorStop(0.6, 'rgba(120,150,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, S * 0.25, S, S * 0.75);
    for (let i = 0; i < 150; i++) {
      const v = Math.pow(rng(), 1.5) * 0.62;
      const x = S * (0.5 + (rng() - 0.5) * (0.25 + v * 0.75));
      const y = S * (1 - 0.08 - v);
      ctx.fillStyle = `rgba(125,18,60,${0.5 + rng() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.6 + rng() * 2.2, 2.2 + rng() * 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  grain(ctx, S, S, 0.07, spots ? 5 : 3);
  // plain corner for parts that are not petals (stamens, seeds, calyx)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, S - 10, 10, 10);
  return c;
}

// Leaf: pale midrib and side veins on a darker blade.
function leafCanvas() {
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d');
  const rng = mulberry32(11);
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 0.14, 21);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(S / 2, S); ctx.lineTo(S / 2, 0); ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const y = S * (0.95 - i * 0.085);
    for (const dir of [-1, 1]) {
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + rng() * 0.2})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(S / 2, y);
      ctx.quadraticCurveTo(S / 2 + dir * S * 0.25, y - S * 0.05, S / 2 + dir * S * 0.5, y - S * 0.22);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#e4e4e4';
  ctx.fillRect(0, S - 10, 10, 10);
  return c;
}

function noiseCanvas(seed, lo, hi) {
  const S = 128, c = canvas(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = fbm2(x / 14, y / 22, seed, 4) * 0.5 + 0.5;
      const v = Math.round(255 * (lo + (hi - lo) * n));
      const k = (y * S + x) * 4;
      d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Crumpled paper: flat facets with a random tilt, split by creases.
function crinkleCanvas() {
  const S = 512, c = canvas(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  const layers = [{ cells: 4, w: 0.7, seed: 3 }, { cells: 9, w: 0.3, seed: 8 }];
  const rnd = (x, y, s) => noise2(x * 13.37 + 0.5, y * 7.77 + 0.5, s) * 0.5 + 0.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let nx = 0, ny = 0;
      for (const L of layers) {
        const px = (x / S) * L.cells, py = (y / S) * L.cells;
        const cx = Math.floor(px), cy = Math.floor(py);
        let f1 = 9, f2 = 9, tx = 0, ty = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const gx = cx + i, gy = cy + j;
            const wx = ((gx % L.cells) + L.cells) % L.cells, wy = ((gy % L.cells) + L.cells) % L.cells;
            const fx = gx + rnd(wx, wy, L.seed), fy = gy + rnd(wx, wy, L.seed + 1);
            const dd = Math.hypot(px - fx, py - fy);
            if (dd < f1) {
              f2 = f1; f1 = dd;
              tx = rnd(wx, wy, L.seed + 2) - 0.5; ty = rnd(wx, wy, L.seed + 3) - 0.5;
            } else if (dd < f2) f2 = dd;
          }
        }
        const crease = Math.max(0, 1 - (f2 - f1) * 14);
        nx += L.w * (tx * 0.9 + crease * crease * tx * 2.6);
        ny += L.w * (ty * 0.9 + crease * crease * ty * 2.6);
      }
      nx += noise2(x / 2.1, y / 2.1, 90) * 0.05;
      ny += noise2(x / 2.1, y / 2.1, 91) * 0.05;
      const nz = 1, len = Math.hypot(nx, ny, nz);
      const k = (y * S + x) * 4;
      d[k] = (nx / len * 0.5 + 0.5) * 255;
      d[k + 1] = (ny / len * 0.5 + 0.5) * 255;
      d[k + 2] = (nz / len * 0.5 + 0.5) * 255;
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Bouquet-space helpers shared by the patched shaders. vBq is the fragment
// position relative to the tie point, before the bouquet is tilted or spun.
// uWrapA = (neck, flare, front, back), uWrapB = (drop, dome height, disc, sag);
// the bouquet refreshes them every frame.
export const wrapUniforms = {
  uWrapA: { value: new THREE.Vector4(0.25, 0.4, 1.5, 2) },
  uWrapB: { value: new THREE.Vector4(1.2, 2, 1, 0.3) },
};

const BQ_VERTEX_PARS = `#include <common>
varying vec3 vBq;`;
const BQ_VERTEX = `#include <begin_vertex>
#ifdef USE_INSTANCING
  vBq = ( instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
#else
  vBq = transformed;
#endif`;

// Mirrors wrapRadius() and the rim shapes in wrapper.js (without the fine
// noise, which the margin covers).
const BQ_FRAGMENT_PARS = `#include <common>
varying vec3 vBq;
uniform vec4 uWrapA;
uniform vec4 uWrapB;
float bqTri( float x ) { return 1.0 - abs( 2.0 * fract( x ) - 1.0 ); }
float bqRadius( float y, float ang, float k ) {
  float r = uWrapA.x + y * uWrapA.y;
  float env = ( 1.0 - exp( -y * 7.0 ) ) * exp( -y * 0.8 );
  r += env * ( uWrapA.x / 0.25 ) * ( 0.05 * bqTri( ang * 1.9 + k ) + 0.03 * bqTri( ang * 3.3 + 1.7 * k ) - 0.035 );
  r += 0.055 * y * ( bqTri( ang * 1.15 + k * 2.1 ) - 0.5 ) * ( 1.0 + uWrapA.y ) + 0.02 * y * ( bqTri( ang * 2.9 + k ) - 0.5 );
  return r;
}
// True where a leaf would be sticking out through the paper. Leaves may
// still hang a little way over the top edge (spill).
bool bqThroughPaper( vec3 p ) {
  if ( p.y < 0.02 ) return false;
  const float spill = 0.12;
  float a = atan( p.x, p.z );
  float rr = length( p.xz );
  float margin = 0.06 + 0.03 * p.y;
  float sF = ( a - 0.12 ) / 1.8;
  float topF = uWrapA.z * ( 0.92 + 0.2 * pow( min( abs( sF ), 1.0 ), 1.6 ) );
  float t = clamp( ( p.y + uWrapB.x ) / ( topF + uWrapB.x ), 0.0, 1.0 );
  sF = ( a - 0.12 ) / mix( 2.05, 1.6, t );
  if ( abs( sF ) <= 1.0 && p.y < topF - spill && rr > bqRadius( p.y, a, 1.0 ) + 0.016 - margin ) return true;
  float ab = a < 0.0 ? a + 6.2831853 : a;
  float sB = ( ab - 3.14159265 ) / 2.8;
  float topB = uWrapA.w * ( 1.0 - 0.5 * pow( abs( sB ), 2.2 ) );
  if ( abs( sB ) <= 1.0 && p.y < topB - spill && rr > bqRadius( p.y, ab, 0.0 ) - margin ) return true;
  return false;
}
// Cheap occlusion: stems and leaves get darker the deeper they sit under
// the dome of flower heads.
float bqShade( vec3 p ) {
  float dome = uWrapB.y - uWrapB.w * dot( p.xz, p.xz ) / uWrapB.z;
  return mix( 0.3, 1.0, smoothstep( -1.25, -0.1, p.y - dome ) );
}`;

/*
 * Shader add-ons for the plant materials.
 *   transl  thin petals let some light through. Real transmission would need
 *           an extra render pass, so this adds a back-scatter term to each
 *           direct light: light on the far side of a petal tints the near side.
 *   clip    drop fragments that would poke out through the paper wrap.
 *   shade   darken toward the inside of the bouquet.
 */
function patch(mat, { transl = 0, clip = false, shade = false } = {}) {
  mat.userData.clip = clip;
  mat.onBeforeCompile = (shader) => {
    if (clip || shade) {
      shader.uniforms.uWrapA = wrapUniforms.uWrapA;
      shader.uniforms.uWrapB = wrapUniforms.uWrapB;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', BQ_VERTEX_PARS)
        .replace('#include <begin_vertex>', BQ_VERTEX);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', BQ_FRAGMENT_PARS);
      if (clip) shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'void main() {\n  if ( bqThroughPaper( vBq ) ) discard;');
      if (shade) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= bqShade( vBq );');
    }
    if (transl) {
      shader.uniforms.uTransl = { value: transl };
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_physical_pars_fragment>',
        `#include <lights_physical_pars_fragment>
        uniform float uTransl;
        void RE_Direct_Thin( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
          RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          float back = saturate( dot( -geometryNormal, directLight.direction ) );
          reflectedLight.directDiffuse += back * uTransl * directLight.color * material.diffuseColor * RECIPROCAL_PI;
        }
        #undef RE_Direct
        #define RE_Direct RE_Direct_Thin`,
      );
    }
  };
  mat.customProgramCacheKey = () => `plant:${transl ? 1 : 0}${clip ? 1 : 0}${shade ? 1 : 0}`;
  return mat;
}

export function createMaterials() {
  const petalTex = tex(petalCanvas());
  const lilyTex = tex(petalCanvas({ spots: true }));
  const leafTex = tex(leafCanvas());
  const roughTex = tex(noiseCanvas(4, 0.72, 1), { srgb: false, repeat: true });

  const petal = (o, transl = 0.45, map = petalTex, extra = {}) => patch(new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map,
    bumpMap: map,
    bumpScale: 0.6,
    roughnessMap: roughTex,
    side: THREE.DoubleSide,
    sheenRoughness: 0.55,
    ...o,
  }), { transl, ...extra });

  const heads = {
    rose: petal({ roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color('#d8405f') }, 0.3),
    peony: petal({ roughness: 0.66, sheen: 0.22, sheenColor: new THREE.Color('#f7b6cb') }, 0.5),
    tulip: petal({ roughness: 0.42, sheen: 0.25, sheenColor: new THREE.Color('#ffd9b0') }, 0.5),
    lily: petal({ roughness: 0.45, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') }, 0.5, lilyTex),
    sunflower: petal({ roughness: 0.7, sheen: 0.15, sheenColor: new THREE.Color('#f6c84a') }, 0.3),
    daisy: petal({ roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') }, 0.5),
    lavender: petal({ roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color('#c9b8ff'), bumpScale: 0 }, 0.15),
    eucalyptus: petal({ roughness: 0.78, sheen: 0.8, sheenColor: new THREE.Color('#dfeee8'), sheenRoughness: 0.7, map: leafTex, bumpMap: leafTex }, 0.3, leafTex, { clip: true }),
  };

  // baby's breath: same look as daisy petals, but kept inside the paper
  const breath = petal({ roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') }, 0.5, petalTex, { clip: true });

  const green = petal({
    roughness: 0.5, sheen: 0.2, sheenColor: new THREE.Color('#cfe8b0'), map: leafTex, bumpMap: leafTex, bumpScale: 0.8,
  }, 0.4, leafTex, { clip: true, shade: true });

  // shadow pass for the clipped materials, so hidden leaf parts cast nothing
  const clipDepth = patch(new THREE.MeshDepthMaterial(), { clip: true });

  const crinkle = tex(crinkleCanvas(), { srgb: false, repeat: true });

  const paperOuter = new THREE.MeshStandardMaterial({
    roughness: 0.94, metalness: 0, normalMap: crinkle, normalScale: new THREE.Vector2(0.6, 0.6),
    side: THREE.FrontSide, envMapIntensity: 0.6,
  });
  const paperInner = new THREE.MeshStandardMaterial({
    roughness: 0.97, metalness: 0, normalMap: crinkle, normalScale: new THREE.Vector2(0.5, 0.5),
    side: THREE.BackSide, envMapIntensity: 0.6,
  });
  paperOuter.shadowSide = THREE.DoubleSide;

  // Satin: low roughness along the weave, strong sheen, stretched highlights.
  const ribbon = new THREE.MeshPhysicalMaterial({
    roughness: 0.34, metalness: 0, sheen: 1, sheenRoughness: 0.3, anisotropy: 0.6,
    side: THREE.DoubleSide,
  });

  return { heads, green, breath, clipDepth, paperOuter, paperInner, ribbon };
}
