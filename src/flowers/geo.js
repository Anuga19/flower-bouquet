// Small geometry toolkit used by every flower builder.
// Everything is merged into one indexed BufferGeometry per flower part, with
// vertex colours carrying the petal gradients.

import * as THREE from 'three';
import { TAU, noise2, smoothstep, lerp } from '../util.js';

const _nm = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const IDENTITY = new THREE.Matrix4();

export const col = (hex) => new THREE.Color(hex);

// Shift a colour slightly in HSL so no two petals share a flat tone.
export function vary(color, rng, dh = 0.015, ds = 0.06, dl = 0.05) {
  const c = color.clone();
  c.offsetHSL((rng() - 0.5) * 2 * dh, (rng() - 0.5) * 2 * ds, (rng() - 0.5) * 2 * dl);
  return c;
}

export class Geo {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.uv = [];
    this.idx = [];
  }

  // fn(s, t, out) fills out.{x,y,z,r,g,b,u,v} for s,t in [0,1].
  // Normals come from the grid itself so every petal is smooth-shaded.
  grid(nu, nv, fn, M = IDENTITY, { wrapU = false } = {}) {
    const base = this.p.length / 3;
    const cols = nu + 1, rows = nv + 1;
    const P = new Float32Array(cols * rows * 3);
    const N = new Float32Array(cols * rows * 3);
    const o = { x: 0, y: 0, z: 0, r: 1, g: 1, b: 1, u: 0, v: 0 };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        fn(i / nu, j / nv, o);
        const k = (j * cols + i) * 3;
        P[k] = o.x; P[k + 1] = o.y; P[k + 2] = o.z;
        this.c.push(o.r, o.g, o.b);
        this.uv.push(o.u, o.v);
      }
    }
    const addFace = (a, b, c) => {
      const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
      const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az;
      const e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      for (const q of [a, b, c]) { N[q * 3] += nx; N[q * 3 + 1] += ny; N[q * 3 + 2] += nz; }
      this.idx.push(base + a, base + b, base + c);
    };
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
        addFace(a, b, c);
        addFace(b, d, c);
      }
    }
    if (wrapU) {
      for (let j = 0; j < rows; j++) {
        const a = (j * cols) * 3, b = (j * cols + nu) * 3;
        for (let q = 0; q < 3; q++) { const s = N[a + q] + N[b + q]; N[a + q] = s; N[b + q] = s; }
      }
    }
    _nm.getNormalMatrix(M);
    for (let k = 0; k < cols * rows; k++) {
      _v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(M);
      this.p.push(_v.x, _v.y, _v.z);
      _v.set(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]);
      if (_v.lengthSq() < 1e-20) _v.set(0, 1, 0);
      _v.applyMatrix3(_nm).normalize();
      this.n.push(_v.x, _v.y, _v.z);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// Width profile along a petal. p moves the widest point (p > 1 pushes it to
// the tip), q rounds (q < 1) or sharpens (q > 1) the outline, b is the width
// left at the base.
export const profile = (p = 1, q = 1, b = 0.1) => (t) =>
  Math.pow(Math.max(0, Math.sin(Math.PI * (b + (1 - b) * Math.pow(t, p)))), q);

export const circleProfile = (t) => 2 * Math.sqrt(Math.max(0, t * (1 - t)));

// Matrix that puts a petal (grown along +Y, front face +Z) on a flower:
// front faces the flower axis, tilted `open` radians away from it.
export function placeM(az, open, r0 = 0, y0 = 0, roll = 0) {
  const m = new THREE.Matrix4().makeRotationY(az);
  m.multiply(new THREE.Matrix4().makeTranslation(0, y0, r0));
  m.multiply(new THREE.Matrix4().makeRotationX(open));
  m.multiply(new THREE.Matrix4().makeRotationY(Math.PI + roll));
  return m;
}

const NO_UV = [0, 0, 1, 1];

/*
 * One petal or leaf.
 *   length, width      size
 *   profile(t)         half-width factor along the length
 *   cup                arc angle (rad) the petal wraps across its width
 *   bend(t)            lengthwise angle; positive curls back, negative curls in
 *   ruffle, ruffleFreq noise-driven waves along the edge
 *   edgeNoise          uneven outline
 *   serrate            saw-tooth outline (leaves)
 *   tipNotch, tipIrreg notched or ragged tip
 *   fold               V-crease along the midrib
 *   twist              twist around the midrib
 *   base, mid, tip     gradient colours (dark base to light tip)
 */
export function addPetal(geo, M, o) {
  const {
    length: L, width: W, nu = 6, nv = 8, cup = 0, cupFn, bend, ruffle = 0, ruffleFreq = 3,
    edgeNoise = 0, serrate = 0, serrateFreq = 14, tipNotch = 0, tipIrreg = 0, twist = 0, fold = 0,
    base, mid, tip, midPos = 0.5, seed = 0, shade = 1, uv = NO_UV, edgeLight = 0.12,
  } = o;
  const prof = o.profile || profile(1, 0.6, 0.1);
  // Rows are packed toward the tip (and the base for round leaves) so a
  // rounded outline stays smooth instead of ending in a blunt fan.
  const TT = new Float32Array(nv + 1);
  for (let j = 0; j <= nv; j++) {
    const t = j / nv;
    TT[j] = o.spacing === 'both' ? (1 - Math.cos(Math.PI * t)) / 2 : 1 - Math.pow(1 - t, o.tipBias || 1.7);
  }
  const my = new Float32Array(nv + 1), mz = new Float32Array(nv + 1), ang = new Float32Array(nv + 1);
  let y = 0, z = 0;
  for (let j = 0; j <= nv; j++) {
    const a = bend ? bend(TT[j]) : 0;
    ang[j] = a;
    if (j > 0) {
      const am = (ang[j - 1] + a) / 2, ds = L * (TT[j] - TT[j - 1]);
      y += Math.cos(am) * ds;
      z -= Math.sin(am) * ds;
    }
    my[j] = y; mz[j] = z;
  }
  const phase = (seed * 12.9898) % TAU;
  const si = Math.floor(seed * 1000) | 0;
  geo.grid(nu, nv, (s, tGrid, out) => {
    const j = Math.round(tGrid * nv), t = TT[j], u = s * 2 - 1, a = ang[j];
    const ca = Math.cos(a), sa = Math.sin(a);
    let w = W * 0.5 * prof(t) * (1 + edgeNoise * noise2(t * 4.3 + u * 0.7, seed * 1.7, si + 11));
    if (serrate) w *= 1 - serrate * (1 - Math.abs(2 * ((t * serrateFreq) % 1) - 1));
    const psi = cup * (cupFn ? cupFn(t) : 1);
    let x, zc;
    if (Math.abs(psi) > 1e-3) {
      const h = psi * 0.5, R = w / h;
      x = R * Math.sin(h * u);
      zc = R * (1 - Math.cos(h * u));
    } else {
      x = w * u; zc = 0;
    }
    zc += fold * w * Math.abs(u);
    if (ruffle) {
      zc += ruffle * u * u * smoothstep(0.1, 0.9, t) *
        (Math.sin(t * ruffleFreq * TAU + phase + u * 1.7) * 0.7 + noise2(u * 2.5 + seed, t * ruffleFreq * 1.5, si + 5) * 0.9);
    }
    if (twist) {
      const r = twist * t, cr = Math.cos(r), sr = Math.sin(r);
      const x2 = x * cr - zc * sr;
      zc = x * sr + zc * cr; x = x2;
    }
    const dl = L * t * t * t * (tipIrreg * noise2(u * 2.2, seed * 3.1, si + 23) - tipNotch * Math.exp(-u * u / 0.06));
    out.x = x;
    out.y = my[j] + sa * zc + ca * dl;
    out.z = mz[j] + ca * zc - sa * dl;
    if (t < midPos) _c.copy(base).lerp(mid, t / midPos);
    else _c.copy(mid).lerp(tip, (t - midPos) / (1 - midPos));
    _c.lerp(tip, edgeLight * u * u);
    const m = shade * (1 + 0.07 * noise2(u * 3.1 + seed * 5, t * 4.7, si + 41));
    out.r = _c.r * m; out.g = _c.g * m; out.b = _c.b * m;
    out.u = lerp(uv[0], uv[2], s);
    out.v = lerp(uv[1], uv[3], t);
  }, M);
}

// Tube along a list of points with a radius that can change along the way.
export function addTube(geo, M, pts, radiusFn, colorFn, radial = 6, uvPoint = [0.01, 0.01]) {
  const n = pts.length;
  const T = [], N = [], B = [];
  const prev = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const t = new THREE.Vector3().subVectors(pts[Math.min(k + 1, n - 1)], pts[Math.max(k - 1, 0)]).normalize();
    const nn = new THREE.Vector3();
    if (k === 0) {
      nn.set(1, 0, 0);
      if (Math.abs(t.x) > 0.9) nn.set(0, 0, 1);
    } else nn.copy(prev);
    nn.addScaledVector(t, -nn.dot(t)).normalize();
    prev.copy(nn);
    T.push(t); N.push(nn); B.push(new THREE.Vector3().crossVectors(t, nn));
  }
  geo.grid(radial, n - 1, (s, t, out) => {
    const k = Math.round(t * (n - 1)), a = s * TAU, r = radiusFn(t);
    const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
    out.x = pts[k].x + N[k].x * ca + B[k].x * sa;
    out.y = pts[k].y + N[k].y * ca + B[k].y * sa;
    out.z = pts[k].z + N[k].z * ca + B[k].z * sa;
    const c = colorFn(t);
    out.r = c.r; out.g = c.g; out.b = c.b;
    out.u = uvPoint[0]; out.v = uvPoint[1];
  }, M, { wrapU: true });
}

// Low-poly ellipsoid: buds, calyxes, anthers.
export function addBlob(geo, M, rx, ry, rz, colorFn, nu = 6, nv = 4, uvPoint = [0.01, 0.01]) {
  geo.grid(nu, nv, (s, t, out) => {
    const a = -s * TAU, ph = Math.PI * t, sp = Math.sin(ph);
    out.x = rx * sp * Math.cos(a);
    out.y = -ry * Math.cos(ph);
    out.z = rz * sp * Math.sin(a);
    const c = colorFn(t);
    out.r = c.r; out.g = c.g; out.b = c.b;
    out.u = uvPoint[0]; out.v = uvPoint[1];
  }, M, { wrapU: true });
}

// Small cone: sunflower and daisy disc florets.
export function addCone(geo, M, r, h, cBase, cTip, sides = 5, uvPoint = [0.01, 0.01]) {
  geo.grid(sides, 1, (s, t, out) => {
    const a = -s * TAU, rr = r * (1 - t);
    out.x = rr * Math.cos(a); out.y = h * t; out.z = rr * Math.sin(a);
    const c = t < 0.5 ? cBase : cTip;
    out.r = c.r; out.g = c.g; out.b = c.b;
    out.u = uvPoint[0]; out.v = uvPoint[1];
  }, M, { wrapU: true });
}

export const gradient = (a, b) => {
  const c = new THREE.Color();
  return (t) => c.copy(a).lerp(b, t);
};

// Matrix that moves to `pos` and points local +Y along `dir`.
const _q = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
export function frameM(pos, dir, spin = 0) {
  _q.setFromUnitVectors(Y, _v.copy(dir).normalize());
  const m = new THREE.Matrix4().compose(pos, _q, new THREE.Vector3(1, 1, 1));
  if (spin) m.multiply(new THREE.Matrix4().makeRotationY(spin));
  return m;
}
