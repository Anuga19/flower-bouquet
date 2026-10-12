// Flower head builders, one per type. Each returns a merged geometry in a
// local frame where the origin is the top of the stem and +Y is the way the
// flower faces. Every petal draws its own size, angle and droop from the rng,
// so each built variant is different.

import * as THREE from 'three';
import { Geo, addPetal, addTube, addBlob, addCone, placeM, profile, circleProfile, col, vary, gradient, frameM } from './geo.js';
import { GOLDEN_ANGLE, TAU, lerp, smoothstep } from '../util.js';

const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const jit = (rng, a) => (rng() - 0.5) * 2 * a;

function calyx(g, rng, { r = 0.06, h = 0.08, y = -0.04, sepals = 5, len = 0.2, wid = 0.07, open = 1.9, dark = '#274a1c', light = '#5c8a3a' }) {
  const cd = col(dark), cl = col(light);
  addBlob(g, T(0, y, 0), r, h, r, gradient(cd, cl), 7, 4);
  for (let i = 0; i < sepals; i++) {
    addPetal(g, placeM(i * TAU / sepals + jit(rng, 0.2), open + jit(rng, 0.25), r * 0.6, y + h * 0.3), {
      length: len * (0.85 + rng() * 0.3), width: wid, nu: 4, nv: 5, profile: profile(0.8, 1.2, 0.3),
      cup: 0.6, bend: (t) => 0.7 * t * t, base: cd, mid: cl, tip: cl, seed: rng() * 99,
    });
  }
}

/* Rose: petals follow one spiral. Tight and upright at the centre, opening
   and rolling their edges back toward the outside. */
export function buildRose(rng, variant) {
  const g = new Geo();
  const pal = [
    ['#4f0716', '#a80f2e', '#d23a58'],
    ['#5c0a24', '#b9163f', '#e2587a'],
    ['#430512', '#96102a', '#c43350'],
  ][variant % 3].map(col);
  const n = 30 + Math.floor(rng() * 8);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const open = lerp(0.04, 1.08, Math.pow(k, 1.45)) + jit(rng, 0.07);
    const tipCurl = lerp(0.0, 1.5, Math.pow(k, 1.1)) * (0.6 + rng() * 0.7);
    const inward = lerp(0.1, 0.62, k);
    addPetal(g, placeM(i * GOLDEN_ANGLE + jit(rng, 0.3), open, lerp(0.004, 0.055, k), lerp(0.1, 0, Math.pow(k, 0.6)), jit(rng, 0.12)), {
      length: lerp(0.25, 0.43, Math.pow(k, 0.7)) * (0.9 + rng() * 0.2),
      width: lerp(0.19, 0.52, k) * (0.9 + rng() * 0.2),
      nu: 8, nv: 10,
      profile: profile(1.35, 0.55, 0.14),
      cup: lerp(2.7, 1.15, k),
      bend: (t) => -inward * Math.sin(t * Math.PI * 0.5) + tipCurl * smoothstep(0.62, 1, t),
      ruffle: 0.012 + k * 0.012, ruffleFreq: 2.2, edgeNoise: 0.06, tipIrreg: 0.05, tipNotch: rng() * 0.05,
      base: vary(pal[0], rng), mid: vary(pal[1], rng), tip: vary(pal[2], rng, 0.01, 0.05, 0.06),
      midPos: 0.45, shade: lerp(0.8, 1.05, k), seed: rng() * 99,
    });
  }
  calyx(g, rng, { r: 0.07, h: 0.09, y: -0.05, len: 0.24, wid: 0.075, open: 2.0 });
  return g.build();
}

/* Peony: a ruffled tuft packed at the centre on the same spiral, inside a
   bowl of big guard petals. */
export function buildPeony(rng, variant) {
  const g = new Geo();
  const pal = [
    ['#b8306a', '#e2709a', '#f6bccf'],
    ['#c4407a', '#ea86a9', '#f9cddb'],
    ['#ad2860', '#da6690', '#f2adc4'],
  ][variant % 3].map(col);
  const n = 58 + Math.floor(rng() * 10);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const open = lerp(0.06, 1.28, Math.pow(k, 1.2)) + jit(rng, 0.12);
    const inward = lerp(1.0, 0.75, k) * (0.8 + rng() * 0.4);
    addPetal(g, placeM(i * GOLDEN_ANGLE + jit(rng, 0.35), open, lerp(0.005, 0.07, k), lerp(0.12, 0, k), jit(rng, 0.25)), {
      length: lerp(0.2, 0.46, Math.pow(k, 0.8)) * (0.85 + rng() * 0.3),
      width: lerp(0.14, 0.5, k) * (0.85 + rng() * 0.3),
      nu: 8, nv: 10,
      profile: profile(1.5, 0.5, 0.12),
      cup: lerp(1.9, 1.05, k),
      bend: (t) => -inward * t + 0.25 * smoothstep(0.75, 1, t),
      ruffle: 0.025 + rng() * 0.025, ruffleFreq: 2 + rng() * 1.5, edgeNoise: 0.08,
      tipIrreg: 0.06, tipNotch: 0.02 + rng() * 0.07, twist: jit(rng, 0.15),
      base: vary(pal[0], rng, 0.015, 0.08, 0.05), mid: vary(pal[1], rng), tip: vary(pal[2], rng, 0.01, 0.05, 0.03),
      midPos: 0.4, shade: lerp(0.86, 1.04, k), seed: rng() * 99,
    });
  }
  calyx(g, rng, { r: 0.085, h: 0.08, y: -0.05, len: 0.2, wid: 0.12, open: 1.75 });
  return g.build();
}

/* Tulip: six overlapping petals that leave the stem outward, then curve up
   and close into a cup. */
export function buildTulip(rng, variant) {
  const g = new Geo();
  const pal = [
    ['#d9c545', '#e9552a', '#f6913f'],
    ['#dccb50', '#f08a25', '#fbc04a'],
    ['#cdb840', '#dc3f3a', '#f1705a'],
  ][variant % 3].map(col);
  for (let i = 0; i < 6; i++) {
    const inner = i < 3;
    const open = 0.98 + jit(rng, 0.05);
    const close = open + (inner ? 0.2 : 0.1) + jit(rng, 0.05);
    const flick = 0.1 + rng() * 0.18;
    addPetal(g, placeM((i % 3) * TAU / 3 + (inner ? 0 : Math.PI / 3) + jit(rng, 0.1), open, inner ? 0.018 : 0.03, inner ? 0.012 : 0, jit(rng, 0.08)), {
      length: (inner ? 0.5 : 0.53) * (0.94 + rng() * 0.12), width: (inner ? 0.34 : 0.38) * (0.94 + rng() * 0.12),
      nu: 8, nv: 10,
      profile: profile(0.85, 0.72, 0.2),
      cup: 1.95,
      bend: (t) => -close * (1 - Math.pow(1 - t, 2.8)) + flick * smoothstep(0.78, 1, t),
      ruffle: 0.006, edgeNoise: 0.03, tipIrreg: 0.03,
      base: vary(pal[0], rng), mid: vary(pal[1], rng), tip: vary(pal[2], rng),
      midPos: 0.32, edgeLight: 0.25, seed: rng() * 99,
    });
  }
  addBlob(g, T(0, -0.01, 0), 0.045, 0.04, 0.045, gradient(col('#6b9a55'), col('#b9c45a')), 6, 3);
  return g.build();
}

/* Lily: six tepals that open as a trumpet and curve back on themselves,
   six stamens with anthers, one pistil. */
export function buildLily(rng, variant) {
  const g = new Geo();
  const pal = [
    ['#a9bd5a', '#f2a9c2', '#fff3f6'],
    ['#b3c463', '#f7c6d5', '#ffffff'],
    ['#a3b650', '#ee98b6', '#ffe9ef'],
  ][variant % 3].map(col);
  for (let i = 0; i < 6; i++) {
    const inner = i < 3;
    const recurve = 1.75 + rng() * 0.55;
    addPetal(g, placeM((i % 3) * TAU / 3 + (inner ? 0 : Math.PI / 3) + jit(rng, 0.1), 0.42 + jit(rng, 0.08), 0.03, 0, jit(rng, 0.15)), {
      length: (0.7 + rng() * 0.1), width: inner ? 0.27 : 0.2,
      nu: 8, nv: 14,
      profile: profile(0.8, 1.05, 0.1),
      cup: 0.55, fold: -0.22,
      bend: (t) => 0.5 * t + recurve * Math.pow(t, 2.3),
      ruffle: 0.022, ruffleFreq: 4, edgeNoise: 0.04, twist: jit(rng, 0.25),
      base: pal[0], mid: vary(pal[1], rng), tip: vary(pal[2], rng, 0.01, 0.03, 0.02),
      midPos: 0.3, seed: rng() * 99,
    });
  }
  const fil = gradient(col('#cfdc9a'), col('#eef0cf'));
  const rust = gradient(col('#6f2a08'), col('#b0581a'));
  for (let i = 0; i < 6; i++) {
    const az = i * TAU / 6 + jit(rng, 0.2), len = 0.46 + rng() * 0.08, spread = 0.16 + rng() * 0.06;
    const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push(new THREE.Vector3(dir.x * spread * t * t, len * t, dir.z * spread * t * t));
    }
    addTube(g, undefined, pts, () => 0.007, fil, 4);
    const m = frameM(pts[6], dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.2 + jit(rng, 0.5)).setY(jit(rng, 0.4)));
    addBlob(g, m, 0.017, 0.055, 0.017, rust, 5, 3);
  }
  const ppts = [];
  for (let k = 0; k <= 6; k++) { const t = k / 6; ppts.push(new THREE.Vector3(0.03 * t * t, 0.58 * t, 0.02 * t)); }
  addTube(g, undefined, ppts, (t) => 0.012 - 0.003 * t, gradient(col('#b7c873'), col('#dfe6b0')), 5);
  addBlob(g, T(ppts[6].x, ppts[6].y, ppts[6].z), 0.028, 0.02, 0.028, gradient(col('#8a9a45'), col('#5d3b52')), 6, 3);
  addBlob(g, T(0, -0.02, 0), 0.05, 0.05, 0.05, gradient(col('#4f7f3a'), col('#a9bd5a')), 6, 3);
  return g.build();
}

/* Sunflower: seed disc laid out by phyllotaxis (golden angle spiral), two
   layers of ray petals, green bracts behind. */
export function buildSunflower(rng, variant) {
  const g = new Geo();
  const R = 0.24;
  const domeY = (r) => 0.045 * (1 - (r / R) * (r / R));
  const dark = col('#24140a'), midc = col('#3d2410'), centre = col('#6f6a1f');
  // disc base
  g.grid(20, 5, (s, t, o) => {
    const a = s * TAU, r = R * t;
    o.x = r * Math.cos(a); o.y = domeY(r) - 0.004; o.z = r * Math.sin(a);
    o.r = dark.r; o.g = dark.g; o.b = dark.b; o.u = 0.01; o.v = 0.01;
  }, undefined, { wrapU: true });
  const N = 360;
  const cOuter = col('#8a5714'), cPollen = col('#dba51c'), cGreenTip = col('#9a9a34');
  for (let i = 0; i < N; i++) {
    const f = (i + 0.5) / N, r = R * Math.sqrt(f), a = i * GOLDEN_ANGLE;
    const size = lerp(0.008, 0.017, f) * (0.85 + rng() * 0.3);
    const pos = new THREE.Vector3(r * Math.cos(a), domeY(r), r * Math.sin(a));
    const dir = new THREE.Vector3(Math.cos(a) * f * 0.5, 1, Math.sin(a) * f * 0.5);
    let cb, ct;
    if (f < 0.16) { cb = centre; ct = cGreenTip; }
    else if (f < 0.62) { cb = dark; ct = midc; }
    else { cb = midc; ct = rng() < 0.75 ? cPollen : cOuter; }
    addCone(g, frameM(pos, dir), size, size * lerp(1.2, 2.3, f), cb, ct, 5);
  }
  const pal = [
    ['#b55a00', '#e39200', '#f6bd12'],
    ['#a85000', '#dc8600', '#f0b008'],
    ['#bd6400', '#ea9d06', '#f9c626'],
  ][variant % 3].map(col);
  const ray = (count, len, open, y0, offset) => {
    for (let i = 0; i < count; i++) {
      const droop = rng() * 0.5;
      addPetal(g, placeM(offset + i * TAU / count + jit(rng, 0.09), open + jit(rng, 0.14), R * 0.94, y0, jit(rng, 0.25)), {
        length: len * (0.85 + rng() * 0.3), width: 0.125 * (0.85 + rng() * 0.3),
        nu: 5, nv: 8,
        profile: profile(0.75, 1.15, 0.28),
        cup: 0.35, fold: 0.28,
        bend: (t) => 0.15 * t + droop * t * t,
        ruffle: 0.012, ruffleFreq: 2, edgeNoise: 0.05, twist: jit(rng, 0.45),
        base: vary(pal[0], rng), mid: vary(pal[1], rng), tip: vary(pal[2], rng),
        midPos: 0.35, seed: rng() * 99,
      });
    }
  };
  const count = 19 + Math.floor(rng() * 4);
  ray(count, 0.37, 1.34, 0.0, 0);
  ray(count - 2, 0.4, 1.5, -0.014, Math.PI / count);
  // bracts and the green back of the head
  const bd = col('#2c531c'), bl = col('#5f8c38');
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 14; i++) {
      addPetal(g, placeM(i * TAU / 14 + row * 0.22 + jit(rng, 0.1), 1.7 + row * 0.35 + jit(rng, 0.1), R * 0.9, -0.03 - row * 0.015), {
        length: 0.17 + row * 0.05 + rng() * 0.04, width: 0.085, nu: 4, nv: 5, profile: profile(0.7, 1.3, 0.35),
        cup: 0.5, bend: (t) => 0.3 * t, base: bd, mid: bl, tip: bl, seed: rng() * 99,
      });
    }
  }
  addBlob(g, T(0, -0.045, 0), R * 1.02, 0.085, R * 1.02, gradient(bd, bl), 12, 5);
  return g.build();
}

/* Daisy: many thin white rays around a domed yellow centre. */
export function buildDaisy(rng) {
  const g = new Geo();
  const R = 0.068;
  const domeY = (r) => 0.034 * (1 - (r / R) * (r / R));
  const y0c = col('#b98a08'), y1c = col('#f4c81c'), y2c = col('#ffe35a'), gc = col('#a8a824');
  g.grid(12, 3, (s, t, o) => {
    const a = s * TAU, r = R * t;
    o.x = r * Math.cos(a); o.y = domeY(r) - 0.003; o.z = r * Math.sin(a);
    o.r = y0c.r; o.g = y0c.g; o.b = y0c.b; o.u = 0.01; o.v = 0.01;
  }, undefined, { wrapU: true });
  const N = 90;
  for (let i = 0; i < N; i++) {
    const f = (i + 0.5) / N, r = R * Math.sqrt(f), a = i * GOLDEN_ANGLE;
    const size = lerp(0.005, 0.0085, f);
    addCone(g, frameM(new THREE.Vector3(r * Math.cos(a), domeY(r), r * Math.sin(a)), new THREE.Vector3(Math.cos(a) * f * 0.6, 1, Math.sin(a) * f * 0.6)),
      size, size * 1.5, f < 0.15 ? gc : y0c, f < 0.15 ? y1c : (rng() < 0.5 ? y1c : y2c), 4);
  }
  const wb = col('#d9dcb4'), wm = col('#f7f7f0'), wt = col('#ffffff');
  const count = 24 + Math.floor(rng() * 8);
  for (let layer = 0; layer < 2; layer++) {
    const c = layer === 0 ? count : Math.floor(count * 0.6);
    for (let i = 0; i < c; i++) {
      const droop = rng() * 0.45;
      addPetal(g, placeM(i * TAU / c + layer * 0.13 + jit(rng, 0.08), 1.36 + layer * 0.12 + jit(rng, 0.12), R * 0.9, -layer * 0.006, jit(rng, 0.2)), {
        length: 0.185 * (0.85 + rng() * 0.3), width: 0.05 * (0.85 + rng() * 0.3),
        nu: 4, nv: 7,
        profile: profile(0.8, 0.55, 0.3),
        cup: 0.3, fold: 0.2, tipNotch: 0.05,
        bend: (t) => 0.1 * t + droop * t * t,
        edgeNoise: 0.04, twist: jit(rng, 0.3),
        base: wb, mid: vary(wm, rng, 0, 0.01, 0.02), tip: wt, midPos: 0.22, edgeLight: 0, seed: rng() * 99,
      });
    }
  }
  calyx(g, rng, { r: 0.06, h: 0.035, y: -0.03, sepals: 10, len: 0.07, wid: 0.03, open: 1.75 });
  return g.build();
}

/* Lavender: three spikes per stem, each a stack of bud whorls that thins
   toward the bottom. */
export function buildLavender(rng) {
  const g = new Geo();
  const stemC = gradient(col('#73876a'), col('#8a8fa0'));
  const calyxC = col('#4f4489'), budC = col('#7d63c6'), openC = col('#ab93ea');
  const spike = (origin, dir, len, bow) => {
    const pts = [];
    const side = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push(origin.clone().addScaledVector(dir, len * t).addScaledVector(side, bow * Math.sin(t * Math.PI * 0.8) * len));
    }
    addTube(g, undefined, pts, (t) => 0.011 - 0.005 * t, stemC, 4);
    const whorls = 9 + Math.floor(rng() * 3);
    for (let w = 0; w < whorls; w++) {
      // gaps widen toward the bottom of the spike
      const f = 1 - Math.pow(w / whorls, 1.5) * 0.66;
      const idx = f * 8, i0 = Math.min(7, Math.floor(idx)), ft = idx - i0;
      const p = pts[i0].clone().lerp(pts[i0 + 1], ft);
      const tan = pts[i0 + 1].clone().sub(pts[i0]).normalize();
      const size = lerp(0.6, 1.1, Math.min(1, w / 3)) * (0.9 + rng() * 0.2);
      const buds = 5 + Math.floor(rng() * 3);
      const M0 = frameM(p, tan, rng() * TAU);
      for (let b = 0; b < buds; b++) {
        const m = M0.clone().multiply(placeM(b * TAU / buds + jit(rng, 0.25), 0.55 + jit(rng, 0.25), 0.012, jit(rng, 0.012)));
        const top = rng() < 0.3 ? openC : budC;
        addBlob(g, m.multiply(T(0, 0.03 * size, 0)), 0.019 * size, 0.04 * size, 0.019 * size, gradient(calyxC, top), 5, 3);
      }
    }
    addBlob(g, frameM(pts[8], dir).multiply(T(0, 0.02, 0)), 0.014, 0.03, 0.014, gradient(calyxC, budC), 5, 3);
  };
  const up = new THREE.Vector3(0, 1, 0);
  spike(new THREE.Vector3(0, -0.02, 0), up, 0.78 + rng() * 0.12, jit(rng, 0.06));
  for (let i = 0; i < 2; i++) {
    const az = rng() * TAU, lean = 0.24 + rng() * 0.14;
    const dir = new THREE.Vector3(Math.sin(az) * Math.sin(lean), Math.cos(lean), Math.cos(az) * Math.sin(lean));
    spike(new THREE.Vector3(0, -0.3 - rng() * 0.1, 0), dir, 0.82 + rng() * 0.16, jit(rng, 0.08));
  }
  return g.build();
}

// Round silver-dollar leaf pair, shared by the eucalyptus head and its stem.
export function eucalyptusPair(g, rng, M, size) {
  const b = col('#5f7f70'), m = col('#88a998'), t = col('#aecabb');
  for (let s = 0; s < 2; s++) {
    const len = size * (0.85 + rng() * 0.3);
    addPetal(g, M.clone().multiply(placeM(s * Math.PI + jit(rng, 0.25), 1.0 + jit(rng, 0.3), 0.012, 0, jit(rng, 0.4))), {
      length: len, width: len * (0.92 + rng() * 0.12), nu: 6, nv: 8,
      profile: circleProfile, spacing: 'both', cup: 0.45 + rng() * 0.3, fold: 0.1,
      bend: (x) => 0.35 * x, edgeNoise: 0.05, ruffle: 0.01,
      base: vary(b, rng, 0.02, 0.05, 0.03), mid: vary(m, rng, 0.02, 0.05, 0.04), tip: vary(t, rng, 0.02, 0.05, 0.04),
      midPos: 0.4, seed: rng() * 99, uv: [0.1, 0.05, 0.9, 0.95],
    });
  }
}

/* Eucalyptus: round sage leaves in opposite pairs along an arching branch. */
export function buildEucalyptus(rng) {
  const g = new Geo();
  const len = 1.15 + rng() * 0.25, arc = 0.25 + rng() * 0.3, az = rng() * TAU;
  const side = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
  const pts = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    pts.push(new THREE.Vector3(0, len * t * (1 - 0.12 * t * arc), 0).addScaledVector(side, arc * len * t * t * 0.6));
  }
  addTube(g, undefined, pts, (t) => 0.016 - 0.01 * t, gradient(col('#77806a'), col('#93a892')), 5);
  const nodes = 9;
  for (let i = 0; i < nodes; i++) {
    const f = 0.06 + (i / (nodes - 1)) * 0.94;
    const idx = f * 10, i0 = Math.min(9, Math.floor(idx));
    const p = pts[i0].clone().lerp(pts[i0 + 1], idx - i0);
    const tan = pts[i0 + 1].clone().sub(pts[i0]).normalize();
    eucalyptusPair(g, rng, frameM(p, tan, i * Math.PI / 2 + jit(rng, 0.4)), lerp(0.3, 0.13, f));
  }
  return g.build();
}
