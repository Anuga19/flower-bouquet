// The bouquet itself: owns the list of stems, eases them toward the layout,
// and draws them. Every (flower type, variant, part) is one InstancedMesh, so
// 40 stems cost a handful of draw calls and the seed discs, lavender buds and
// eucalyptus leaves are all instanced with their flower.

import * as THREE from 'three';
import { TYPES, VARIANTS, getVariants, getGreenery, getBabysBreath, STEM_LEN } from './flowers/index.js';
import { createStem, layout, dimensions, findGaps, SAG } from './arrangement.js';
import { wrapUniforms } from './materials.js';
import { createWrapper } from './wrapper.js';
import { LIMITS, FILLERS } from './config.js';
import { GOLDEN_ANGLE, clamp, lerp, easeOutBack, easeOutCubic, mulberry32 } from './util.js';

const MAX = LIMITS.maxStems + 16; // room for stems that are still shrinking away
const GREENS = 26;
const FILL = 42; // foliage tucked under the heads so gaps show leaves, not bare stems
const Y = new THREE.Vector3(0, 1, 0);

export function createBouquet(materials) {
  const group = new THREE.Group();
  const wrapper = createWrapper(materials);
  group.add(wrapper.group);

  const stems = [];
  let target = dimensions(0, 0);
  const dim = { ...target };
  let dimsSettled = false;

  const pools = new Map();
  function pool(key, geometry, material) {
    let p = pools.get(key);
    if (!p) {
      p = new THREE.InstancedMesh(geometry, material, MAX);
      p.castShadow = true; p.receiveShadow = true; p.frustumCulled = false;
      p.count = 0;
      p.setColorAt(0, new THREE.Color(1, 1, 1));
      if (material.userData.clip) p.customDepthMaterial = materials.clipDepth;
      group.add(p);
      pools.set(key, p);
    }
    return p;
  }

  // cut stem ends that show under the wrap
  const endGeo = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, -0.5, 0);
  const ends = pool('ends', endGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }));

  // greenery ring slots; any prefix of the golden-angle sequence is evenly spread
  const greens = [];
  const grng = mulberry32(4242);
  for (let i = 0; i < GREENS; i++) {
    greens.push({ az: i * GOLDEN_ANGLE + 0.4, grow: 0, variant: i % 3, roll: grng() * 6.28, lean: (grng() - 0.5) * 0.14, len: 0.85 + grng() * 0.35, phase: grng() * 6.28 });
  }

  const fills = [];
  for (let i = 0; i < FILL; i++) {
    fills.push({ variant: (i * 2 + 1) % 3, roll: grng() * 6.28, jx: (grng() - 0.5) * 0.3, jz: (grng() - 0.5) * 0.3, len: 0.95 + grng() * 0.4, phase: grng() * 6.28 });
  }
  let fill = 0;
  let hold = 0; // seconds the foliage waits before growing in (entrance)

  // baby's breath sprigs; each eases toward a gap found by the layout
  const SPRIGS = 14;
  const sprigs = [];
  for (let i = 0; i < SPRIGS; i++) {
    sprigs.push({ u: 0, v: 0, cu: 0, cv: 0, on: false, grow: 0, variant: i % 3, roll: grng() * 6.28, len: 0.8 + grng() * 0.3, rise: grng() * 0.14, phase: grng() * 6.28 });
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const P = new THREE.Vector3(), B = new THREE.Vector3(), dir = new THREE.Vector3(), axis = new THREE.Vector3();
  const out = new THREE.Vector3(), scl = new THREE.Vector3(), c = new THREE.Color();

  function relayout() {
    target = layout(stems);
    dimsSettled = false;
    const want = FILLERS.babysBreath && target.n >= 3 ? Math.min(SPRIGS, Math.round(2 + target.n * 0.35)) : 0;
    const gaps = findGaps(stems, target.disc, want);
    sprigs.forEach((sp, i) => {
      const gap = gaps[i];
      if (gap) {
        sp.u = gap.u; sp.v = gap.v;
        if (!sp.on) { sp.cu = gap.u; sp.cv = gap.v; }
      }
      sp.on = !!gap;
    });
  }

  function put(p, pos, quat, sx, sy, sz, tint) {
    const i = p.count++;
    m4.compose(pos, quat, scl.set(sx, sy, sz));
    p.setMatrixAt(i, m4);
    if (tint) p.setColorAt(i, tint);
  }

  return {
    group,
    wrapper,
    get dim() { return dim; },
    get stems() { return stems; },

    count(type) { return stems.filter((s) => !s.dying && (!type || s.type === type)).length; },

    add(type, instant = false) {
      const s = createStem(type);
      if (instant) s.grow = 1;
      stems.push(s);
      relayout();
    },

    // Removes the newest stem of the type.
    remove(type) {
      for (let i = stems.length - 1; i >= 0; i--) {
        if (stems[i].type === type && !stems[i].dying) { stems[i].dying = true; break; }
      }
      relayout();
    },

    // Jump straight to the settled state (first load, reduced motion).
    settle() {
      for (let i = stems.length - 1; i >= 0; i--) {
        const s = stems[i];
        if (s.dying) stems.splice(i, 1);
        else { s.grow = 1; s.cu = s.u; s.cv = s.v; }
      }
      Object.assign(dim, target);
      for (const g of greens) g.grow = -1; // recomputed below
      for (const sp of sprigs) { sp.grow = sp.on ? 1 : 0; sp.cu = sp.u; sp.cv = sp.v; }
      wrapper.update(dim);
    },

    // Entrance for a bouquet someone received: the wrap is there, foliage
    // grows in, then the flowers rise one after another from the middle out.
    reveal() {
      this.settle();
      const live = [...stems].sort((a, b) => Math.hypot(a.u, a.v) - Math.hypot(b.u, b.v));
      const gap = Math.min(0.11, 2.4 / Math.max(live.length, 1));
      live.forEach((s, i) => { s.grow = -(0.55 + i * gap); });
      for (const g of greens) g.grow = 0;
      for (const sp of sprigs) sp.grow = 0;
      fill = 0;
      hold = 0.15;
    },

    // Advance animations and refill the instance buffers.
    // Returns true while anything is still moving.
    update(dt, time, opts) {
      const { sway, tilt, spinSpeed } = opts;
      let moving = false;

      // bouquet dimensions ease toward the layout's
      if (!dimsSettled) {
        const k = 1 - Math.exp(-dt * 5);
        let diff = 0;
        for (const key of ['L', 'disc', 'theta', 'neck', 'drop', 'back', 'front', 'flare']) {
          diff += Math.abs(target[key] - dim[key]);
          dim[key] = lerp(dim[key], target[key], k);
        }
        dim.n = target.n;
        if (diff < 5e-4) { Object.assign(dim, target); dimsSettled = true; }
        moving = true;
      }
      wrapUniforms.uWrapA.value.set(dim.neck, dim.flare, dim.front, dim.back);
      wrapUniforms.uWrapB.value.set(dim.drop, dim.L, dim.disc, SAG);
      wrapper.update(dim);
      if (wrapper.animate(dt, time, sway, tilt, spinSpeed)) moving = true;

      for (const p of pools.values()) p.count = 0;

      const neckSpread = dim.neck * 0.62 / dim.disc;
      const kPos = 1 - Math.exp(-dt * 5);

      for (let i = stems.length - 1; i >= 0; i--) {
        const s = stems[i];
        if (s.dying) {
          s.grow -= dt / 0.45;
          moving = true;
          if (s.grow <= 0) { stems.splice(i, 1); continue; }
        } else if (s.grow < 1) {
          s.grow = Math.min(1, s.grow + dt / 1.0);
          moving = true;
          if (s.grow <= 0) continue; // still waiting its turn
        }
        if (Math.abs(s.u - s.cu) + Math.abs(s.v - s.cv) > 1e-4) {
          s.cu = lerp(s.cu, s.u, kPos); s.cv = lerp(s.cv, s.v, kPos);
          moving = true;
        } else { s.cu = s.u; s.cv = s.v; }

        const def = TYPES[s.type];
        const variants = getVariants(s.type);
        const v = variants[s.variant % VARIANTS];

        // disc position -> point on the dome; the stem runs there from the tie
        const rr = Math.hypot(s.cu, s.cv);
        const az = Math.atan2(s.cu, s.cv);
        const sw = sway ? 1 : 0;
        B.set(s.cu * neckSpread, 0.02, s.cv * neckSpread);
        dir.set(
          s.cu + s.tilt[0] * 0.5 + sw * 0.03 * Math.sin(time * 0.9 + s.phase),
          (dim.L - SAG * rr * rr / dim.disc) * (1 + s.height),
          s.cv + s.tilt[1] * 0.5 + sw * 0.03 * Math.cos(time * 0.7 + s.phase * 1.3),
        ).sub(B);
        const len = dir.length();
        dir.divideScalar(len);

        // new stems rise out of the wrap; removed stems shrink back into it
        let rise, size;
        if (s.dying) { rise = lerp(0.75, 1, s.grow); size = easeOutCubic(s.grow); }
        else { rise = lerp(0.3, 1, easeOutCubic(s.grow)); size = lerp(0.25, 1, easeOutBack(clamp(s.grow * 1.15, 0, 1))); }

        P.copy(B).addScaledVector(dir, len * rise);
        q.setFromUnitVectors(Y, dir);
        q2.setFromAxisAngle(Y, s.roll);
        q.multiply(q2);
        c.setRGB(s.tint[0], s.tint[1], s.tint[2]);

        put(pool(`${s.type}:${s.variant}:stem`, v.stem, materials.green), P, q, size, (len * rise) / STEM_LEN, size, null);

        // head tips outward from the stem (or a random way near the centre)
        const edge = clamp(rr / 0.5, 0, 1);
        out.set(
          lerp(Math.sin(s.nodAz), Math.sin(az), edge), 0,
          lerp(Math.cos(s.nodAz), Math.cos(az), edge),
        ).normalize();
        axis.copy(dir).addScaledVector(out, Math.tan(s.nod * (0.5 + 0.5 * edge))).normalize();
        q.setFromUnitVectors(Y, axis).multiply(q2);
        const hs = s.scale * size;
        put(pool(`${s.type}:${s.variant}:head`, v.head, materials.heads[s.type]), P, q, hs, hs, hs, c);

        // cut end below the tie
        q.identity();
        const er = (0.014 + def.radius * 0.035) * Math.min(1, s.grow * 2);
        c.set(def.stem).multiplyScalar(0.8 + s.cut * 0.3);
        put(ends, B, q, er, dim.drop + 0.08 + s.cut * 0.14, er, c);
      }

      if (hold > 0) { hold -= dt; moving = true; }
      const gdt = hold > 0 ? 0 : dt; // foliage clock

      // greenery ring just inside the paper
      const wanted = dim.n === 0 ? 0 : clamp(Math.round(5 + dim.n * 0.65), 6, GREENS);
      const greenGeo = getGreenery();
      greens.forEach((g, i) => {
        const on = i < wanted ? 1 : 0;
        if (g.grow < 0) g.grow = on;
        if (g.grow !== on) {
          g.grow = clamp(g.grow + (on ? gdt / (0.9 + (i % 5) * 0.12) : -gdt / 0.5), 0, 1);
          moving = true;
        }
        if (g.grow <= 0) return;
        const e = easeOutCubic(g.grow);
        const sz = g.len * clamp(dim.L / 3.3, 0.6, 1.05) * e;
        const sw = sway ? 0.02 * Math.sin(time * 0.8 + g.phase) : 0;
        // Two staggered rings just inside the paper: the outer one spills over
        // the rim, the inner one stands up and screens the stems behind it.
        const inner = i % 2 === 1;
        const gy = (dim.L - SAG * dim.disc - (inner ? 0.85 : 0.6) * sz) * lerp(0.5, 1, e);
        // never let a base sit outside the paper cone
        const rho = clamp(dim.disc - (inner ? 0.85 : 0.3) + g.lean, 0.1, Math.max(0.1, dim.neck + gy * dim.flare - (inner ? 0.35 : 0.22)));
        P.set(Math.sin(g.az) * rho, gy, Math.cos(g.az) * rho);
        dir.copy(P).normalize();
        dir.x += sw;
        axis.copy(dir).addScaledVector(out.set(Math.sin(g.az), 0, Math.cos(g.az)), inner ? 0.03 : 0.12).normalize();
        q.setFromUnitVectors(Y, axis);
        q2.setFromAxisAngle(Y, g.roll);
        q.multiply(q2);
        put(pool(`green:${g.variant}`, greenGeo[g.variant], materials.green), P, q, sz, sz, sz, null);
      });

      // filler foliage spread under the dome on a golden-angle spiral
      const fillTarget = dim.n === 0 ? 0 : Math.min(FILL, 2 + dim.n * 1.15);
      if (Math.abs(fill - fillTarget) > 1e-3) {
        fill = lerp(fill, fillTarget, 1 - Math.exp(-gdt * 4));
        moving = true;
      } else fill = fillTarget;
      for (let i = 0; i < Math.min(FILL, Math.ceil(fill)); i++) {
        const f = fills[i];
        const e = clamp(fill - i, 0, 1);
        const len = f.len * clamp(dim.L / 3.3, 0.6, 1.05);
        const sz = len * e;
        const rho = dim.disc * 0.9 * Math.sqrt((i + 0.5) / Math.max(fill, 1));
        const fy = Math.max(dim.L - SAG * rho * rho / dim.disc - 1.38 * len, 0.15);
        const az = i * GOLDEN_ANGLE + 1.1;
        let x = Math.sin(az) * rho + f.jx, z = Math.cos(az) * rho + f.jz;
        // keep the base inside the paper cone
        const room = Math.max(0.05, dim.neck + fy * dim.flare - 0.12 - 0.42 * len), r2 = Math.hypot(x, z);
        if (r2 > room) { x *= room / r2; z *= room / r2; }
        P.set(x, fy, z);
        dir.copy(P).normalize();
        if (sway) dir.x += 0.015 * Math.sin(time * 0.85 + f.phase);
        q.setFromUnitVectors(Y, dir.normalize());
        q2.setFromAxisAngle(Y, f.roll);
        q.multiply(q2);
        put(pool(`green:${f.variant}`, greenGeo[f.variant], materials.green), P, q, sz, sz, sz, null);
      }

      // baby's breath: blooms sit level with the heads, in the gaps
      const breathGeo = FILLERS.babysBreath ? getBabysBreath() : null;
      const kS = 1 - Math.exp(-dt * 4);
      for (const sp of sprigs) {
        const on = sp.on ? 1 : 0;
        if (sp.grow !== on) { sp.grow = clamp(sp.grow + (on ? gdt / 1.4 : -gdt / 0.4), 0, 1); moving = true; }
        if (sp.grow <= 0 || !breathGeo) continue;
        if (Math.abs(sp.u - sp.cu) + Math.abs(sp.v - sp.cv) > 1e-3) { sp.cu = lerp(sp.cu, sp.u, kS); sp.cv = lerp(sp.cv, sp.v, kS); moving = true; }
        const rr = Math.hypot(sp.cu, sp.cv), e = easeOutCubic(sp.grow);
        const top = dim.L - SAG * rr * rr / dim.disc + 0.02 + sp.rise;
        dir.set(sp.cu, top, sp.cv).normalize();
        if (sway) dir.x += 0.02 * Math.sin(time * 1.1 + sp.phase);
        dir.normalize();
        const len = sp.len * clamp(dim.L / 3.0, 0.55, 1);
        const sz = len * e;
        P.set(sp.cu, top, sp.cv).addScaledVector(dir, -len * lerp(1.5, 1, e));
        q.setFromUnitVectors(Y, dir);
        q2.setFromAxisAngle(Y, sp.roll);
        q.multiply(q2);
        put(pool(`breath:${sp.variant}`, breathGeo[sp.variant], materials.breath), P, q, sz, sz, sz, null);
      }

      for (const p of pools.values()) {
        p.instanceMatrix.needsUpdate = true;
        if (p.instanceColor) p.instanceColor.needsUpdate = true;
      }
      return moving;
    },
  };
}
