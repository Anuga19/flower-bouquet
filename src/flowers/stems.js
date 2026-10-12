// Stems, stem leaves and the loose greenery sprays around the rim.
// A stem template runs from the head (origin) down -Y for STEM_LEN and is
// stretched per stem to reach the tie point.

import * as THREE from 'three';
import { Geo, addPetal, addTube, addBlob, placeM, profile, col, vary, gradient, frameM } from './geo.js';
import { eucalyptusPair } from './heads.js';
import { TAU, noise2 } from '../util.js';

export const STEM_LEN = 3;

const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const jit = (rng, a) => (rng() - 0.5) * 2 * a;

function leaf(g, rng, M, o) {
  addPetal(g, M, {
    nu: 6, nv: 9, cup: 0.5, fold: 0.22, edgeNoise: 0.05, ruffle: 0.012, ruffleFreq: 2,
    midPos: 0.5, seed: rng() * 99, uv: [0.08, 0.02, 0.92, 0.98], edgeLight: 0.05,
    base: vary(o.dark, rng, 0.015, 0.05, 0.03), mid: vary(o.light, rng, 0.015, 0.05, 0.03), tip: vary(o.light, rng, 0.015, 0.05, 0.04),
    ...o,
  });
}

// Compound leaf: a petiole with a terminal leaflet and side pairs.
function compound(g, rng, M, o) {
  const pl = o.petiole;
  addTube(g, M, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, pl * 0.5, 0.01), new THREE.Vector3(0, pl, 0)], () => 0.008, gradient(o.dark, o.light), 4);
  leaf(g, rng, M.clone().multiply(T(0, pl, 0)).multiply(new THREE.Matrix4().makeRotationY(Math.PI)), { ...o, length: o.length, width: o.width });
  for (let p = 0; p < o.pairs; p++) {
    for (const s of [-1, 1]) {
      const m = M.clone().multiply(T(0, pl * (0.75 - p * 0.4), 0))
        .multiply(new THREE.Matrix4().makeRotationZ(s * (1.05 + jit(rng, 0.2))))
        .multiply(new THREE.Matrix4().makeRotationY(Math.PI + jit(rng, 0.3)));
      leaf(g, rng, m, { ...o, length: o.length * 0.8, width: o.width * 0.8 });
    }
  }
}

const LEAVES = {
  rose(g, rng, at) {
    const o = { dark: col('#183416'), light: col('#3c6a2a'), length: 0.24, width: 0.15, profile: profile(0.8, 0.8, 0.15), serrate: 0.14, serrateFreq: 13, petiole: 0.2, pairs: 1 };
    for (const d of [0.32 + rng() * 0.1, 0.62 + rng() * 0.15, 0.95]) {
      const p = at(d);
      compound(g, rng, T(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationY(rng() * TAU)).multiply(new THREE.Matrix4().makeRotationX(0.9 + jit(rng, 0.25))), o);
    }
  },
  peony(g, rng, at) {
    const o = { dark: col('#1d3f1c'), light: col('#467a32'), length: 0.34, width: 0.13, profile: profile(0.85, 1.0, 0.12), petiole: 0.16, pairs: 1, bend: (t) => 0.5 * t };
    for (const d of [0.22 + rng() * 0.08, 0.55 + rng() * 0.12, 0.9]) {
      const p = at(d);
      compound(g, rng, T(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationY(rng() * TAU)).multiply(new THREE.Matrix4().makeRotationX(1.0 + jit(rng, 0.25))), o);
    }
  },
  tulip(g, rng, at) {
    const o = { dark: col('#4f7d5f'), light: col('#86ad8c'), profile: profile(0.7, 1.0, 0.3), cup: 0.9, fold: 0.3, nv: 12 };
    const az = rng() * TAU;
    [1.25, 1.0].forEach((d, i) => {
      const p = at(d), curl = 0.5 + rng() * 0.5;
      leaf(g, rng, T(p.x, p.y, p.z).multiply(placeM(az + i * (Math.PI + jit(rng, 0.5)), 0.2 + rng() * 0.12, 0.02, 0)), {
        ...o, length: 1.05 + rng() * 0.25, width: 0.2 + rng() * 0.05, bend: (t) => curl * t * t, twist: jit(rng, 0.5),
      });
    });
  },
  lily(g, rng, at) {
    const o = { dark: col('#255a22'), light: col('#4c8a38'), profile: profile(0.8, 1.1, 0.2), cup: 0.6 };
    for (let i = 0; i < 9; i++) {
      const p = at(0.2 + i * 0.13), droop = 0.4 + rng() * 0.6;
      leaf(g, rng, T(p.x, p.y, p.z).multiply(placeM(i * 2.4 + jit(rng, 0.3), 0.85 + jit(rng, 0.25), 0.02, 0)), {
        ...o, length: 0.36 + rng() * 0.14, width: 0.07 + rng() * 0.02, bend: (t) => droop * t,
      });
    }
  },
  sunflower(g, rng, at) {
    const o = { dark: col('#24481a'), light: col('#4d7a2c'), profile: profile(0.62, 0.85, 0.32), serrate: 0.07, serrateFreq: 16, ruffle: 0.03, cup: 0.4 };
    [0.42 + rng() * 0.1, 0.8 + rng() * 0.1].forEach((d, i) => {
      const p = at(d), droop = 0.5 + rng() * 0.5;
      const M = T(p.x, p.y, p.z).multiply(placeM(rng() * TAU, 1.0 + jit(rng, 0.2), 0.03, 0));
      addTube(g, M, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.14, 0)], () => 0.013, gradient(o.dark, o.light), 4);
      leaf(g, rng, M.clone().multiply(T(0, 0.13, 0)), { ...o, length: 0.5 - i * 0.06, width: 0.4 - i * 0.05, bend: (t) => droop * t });
    });
  },
  daisy(g, rng, at) {
    const o = { dark: col('#2c5a22'), light: col('#5a8c3c'), profile: profile(1.3, 0.8, 0.15), edgeNoise: 0.12 };
    for (let i = 0; i < 4; i++) {
      const p = at(0.3 + i * 0.2);
      leaf(g, rng, T(p.x, p.y, p.z).multiply(placeM(rng() * TAU, 0.9 + jit(rng, 0.3), 0.01, 0)), {
        ...o, length: 0.17 + rng() * 0.06, width: 0.055, bend: (t) => 0.5 * t,
      });
    }
  },
  lavender(g, rng, at) {
    const o = { dark: col('#5d7560'), light: col('#8fa58c'), profile: profile(0.8, 0.7, 0.3), cup: 0.8, fold: 0 };
    for (let i = 0; i < 8; i++) {
      const p = at(0.45 + Math.floor(i / 2) * 0.17);
      leaf(g, rng, T(p.x, p.y, p.z).multiply(placeM(i * Math.PI + Math.floor(i / 2) * 1.5, 0.55 + jit(rng, 0.2), 0.008, 0)), {
        ...o, nu: 3, nv: 6, length: 0.24 + rng() * 0.1, width: 0.028, bend: (t) => 0.4 * t,
      });
    }
  },
  eucalyptus(g, rng, at) {
    for (let i = 0; i < 3; i++) {
      const p = at(0.12 + i * 0.2);
      eucalyptusPair(g, rng, T(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationY(i * Math.PI / 2 + jit(rng, 0.3))), 0.26 - i * 0.03);
    }
  },
};

const STEM_STYLE = {
  sunflower: { r: 0.06, top: '#5d8a3a', bot: '#3f6a2a', bow: 0.05 },
  peony: { r: 0.034, top: '#4a7a36', bot: '#3a5f2c', bow: 0.08 },
  rose: { r: 0.03, top: '#3f6a2c', bot: '#35522a', bow: 0.08 },
  lily: { r: 0.034, top: '#4f8a3c', bot: '#3a6a2c', bow: 0.06 },
  tulip: { r: 0.034, top: '#8fb86a', bot: '#6f9a55', bow: 0.12 },
  daisy: { r: 0.016, top: '#5d8c3c', bot: '#4a7430', bow: 0.12 },
  lavender: { r: 0.012, top: '#73876a', bot: '#5f7558', bow: 0.1 },
  eucalyptus: { r: 0.02, top: '#77806a', bot: '#6a6a55', bow: 0.1 },
};

export function buildStem(rng, type) {
  const g = new Geo();
  const st = STEM_STYLE[type];
  const n = 18, bx = jit(rng, st.bow), bz = jit(rng, st.bow), seed = Math.floor(rng() * 1000);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * 1.04;
    const f = Math.pow(Math.sin(Math.PI * Math.min(s, 1)), 2);
    pts.push(new THREE.Vector3(bx * f + 0.012 * noise2(s * 5, 1, seed) * f, -s * STEM_LEN, bz * f + 0.012 * noise2(s * 5, 7, seed) * f));
  }
  const cTop = col(st.top), cBot = col(st.bot), c = new THREE.Color();
  addTube(g, undefined, pts,
    (t) => st.r * (0.82 + 0.3 * t + 0.07 * noise2(t * 9, 3, seed)),
    (t) => c.copy(cTop).lerp(cBot, t).multiplyScalar(1 + 0.08 * noise2(t * 14, 5, seed)), 6);
  const at = (d) => {
    const f = (d / (STEM_LEN * 1.04)) * (n - 1), i0 = Math.min(n - 2, Math.floor(f));
    return pts[i0].clone().lerp(pts[i0 + 1], f - i0);
  };
  LEAVES[type](g, rng, at);
  return g.build();
}

// Greenery spray for the ring around the bouquet: a short stem (growing +Y
// from the origin) with pointed glossy leaves.
export function buildGreenery(rng) {
  const g = new Geo();
  const len = 1.0, bow = jit(rng, 0.12);
  const pts = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector3(bow * t * t, len * t, 0.1 * t * t)); }
  const dark = col('#1c3d1e'), light = col('#3f7436');
  addTube(g, undefined, pts, (t) => 0.014 - 0.007 * t, gradient(col('#3a5a2a'), col('#4f7a3a')), 5);
  const o = { dark, light, profile: profile(0.75, 0.95, 0.15), cup: 0.5, nv: 9 };
  for (let i = 0; i < 6; i++) {
    const f = 0.3 + i * 0.13, idx = f * 8, i0 = Math.min(7, Math.floor(idx));
    const p = pts[i0].clone().lerp(pts[i0 + 1], idx - i0), droop = 0.2 + rng() * 0.6;
    leaf(g, rng, frameM(p, pts[i0 + 1].clone().sub(pts[i0])).multiply(placeM(i * Math.PI + jit(rng, 0.5), 0.75 + jit(rng, 0.25), 0.01, 0, jit(rng, 0.3))), {
      ...o, length: 0.42 + rng() * 0.14, width: 0.17 + rng() * 0.05, bend: (t) => droop * t,
    });
  }
  leaf(g, rng, frameM(pts[8], new THREE.Vector3(bow, 1, 0.2)).multiply(new THREE.Matrix4().makeRotationY(rng() * TAU)), { ...o, length: 0.45, width: 0.18, bend: (t) => 0.3 * t });
  return g.build();
}

// Baby's breath: a wiry sprig (growing +Y from the origin, about 1 long)
// that forks into fine twigs, each ending in a tiny white bloom.
export function buildBabysBreath(rng) {
  const g = new Geo();
  const stemC = gradient(col('#5f7f4a'), col('#8fa878'));
  const white = col('#ffffff'), cream = col('#e9ecd6'), bud = col('#b9c79a');
  const up = new THREE.Vector3(0, 1, 0);
  const twig = (from, dir, len, depth) => {
    const side = new THREE.Vector3(dir.z, 0.2, -dir.x).normalize();
    const bow = jit(rng, 0.12) * len;
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      pts.push(from.clone().addScaledVector(dir, len * t).addScaledVector(side, bow * Math.sin(t * Math.PI)));
    }
    addTube(g, undefined, pts, (t) => (0.007 - 0.0035 * t) * (depth ? 0.6 : 1), stemC, 4);
    const tip = pts[4];
    if (depth >= 2) {
      // bloom: a small ruffled ball, some still in bud
      const open = rng() < 0.8, r = open ? 0.032 + rng() * 0.016 : 0.016;
      addBlob(g, T(tip.x, tip.y, tip.z), r, r * 0.8, r, gradient(open ? cream : bud, open ? white : cream), 6, 3);
      return;
    }
    const forks = depth === 0 ? 5 : 3 + Math.floor(rng() * 2);
    for (let i = 0; i < forks; i++) {
      const f = depth === 0 ? 0.45 + (i / forks) * 0.55 : 0.5 + rng() * 0.5;
      const idx = f * 4, i0 = Math.min(3, Math.floor(idx));
      const p = pts[i0].clone().lerp(pts[i0 + 1], idx - i0);
      const az = i * 2.4 + jit(rng, 0.6), lean = 0.55 + rng() * 0.5;
      const d = new THREE.Vector3(Math.sin(az) * Math.sin(lean), Math.cos(lean), Math.cos(az) * Math.sin(lean));
      d.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)).normalize();
      twig(p, d, len * (depth === 0 ? 0.42 : 0.5) * (0.7 + rng() * 0.6), depth + 1);
    }
  };
  twig(new THREE.Vector3(), up, 1, 0);
  return g.build();
}
