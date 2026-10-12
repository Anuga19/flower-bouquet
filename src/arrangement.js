// Layout: where each stem sits in the bouquet.
//
// Stems are placed on a flat disc first. New stems enter on a golden-angle
// spiral, then a relaxation pass pulls everything toward the centre (focal
// flowers hardest) and pushes overlapping heads apart. The disc is then
// wrapped onto a dome: distance from the centre becomes the angle a stem
// leans away from the bouquet axis.

import { TYPES } from './flowers/index.js';
import { GOLDEN_ANGLE, mulberry32 } from './util.js';

let serial = 0;
const HEAD_SCALE = 1.22; // overall flower size against the wrap

export function createStem(type) {
  const id = ++serial;
  const rng = mulberry32(id * 7919 + 13);
  const def = TYPES[type];
  return {
    id, type,
    variant: Math.floor(rng() * 3),
    roll: rng() * Math.PI * 2,
    scale: HEAD_SCALE * (def.scale[0] + rng() * (def.scale[1] - def.scale[0])),
    radius: HEAD_SCALE * def.radius * (0.74 + rng() * 0.16), // uneven spacing; heads may just touch
    height: (rng() - 0.5) * 0.14 + def.lift,
    nod: def.nod * (0.6 + rng() * 0.8),
    nodAz: rng() * Math.PI * 2,
    tilt: [(rng() - 0.5) * 0.16, (rng() - 0.5) * 0.16],
    tint: [0.9 + rng() * 0.14, 0.9 + rng() * 0.14, 0.9 + rng() * 0.14],
    phase: rng() * Math.PI * 2,
    cut: rng(),
    u: 0, v: 0, placed: false, // target position on the disc
    cu: 0, cv: 0, // eased position
    grow: 0, dying: false,
  };
}

// Relax the disc positions in place and return the bouquet dimensions.
export function layout(stems) {
  const live = stems.filter((s) => !s.dying);
  const n = live.length;
  let spread = 0;
  for (const s of live) if (s.placed) spread = Math.max(spread, Math.hypot(s.u, s.v));
  for (const s of live) {
    if (s.placed) continue;
    const a = s.id * GOLDEN_ANGLE, r = (1 - TYPES[s.type].pull ** 2) * (spread + 0.3) + 0.05;
    s.u = Math.cos(a) * r; s.v = Math.sin(a) * r;
  }
  // Each round: a fixed step toward the centre (bigger for focal flowers),
  // then push overlapping heads apart. The pull packs the disc tightly, the
  // push keeps heads from passing through each other.
  const weight = (s) => 0.08 + 2 * TYPES[s.type].pull ** 3;
  const relax = (ITER, even = false) => {
    for (let it = 0; it < ITER; it++) {
      const step = 0.05 * (1 - 0.6 * it / ITER);
      for (const s of live) {
        const d = Math.hypot(s.u, s.v);
        if (d < 1e-5) continue;
        const f = Math.min(step * (even ? 0.7 : 0.12 + TYPES[s.type].pull ** 2), d) / d;
        s.u -= s.u * f; s.v -= s.v * f;
      }
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < n; i++) {
          const a = live[i];
          for (let j = i + 1; j < n; j++) {
            const b = live[j];
            let dx = b.u - a.u, dy = b.v - a.v;
            let d = Math.hypot(dx, dy);
            const min = a.radius + b.radius;
            if (d >= min) continue;
            if (d < 1e-4) { dx = Math.cos(a.id * 2.4 + b.id); dy = Math.sin(a.id * 2.4 + b.id); d = 1; }
            // heavier (more focal) flowers hold their ground
            const wa = weight(a), wb = weight(b);
            const push = (min - d) / d;
            const fa = wb / (wa + wb), fb = wa / (wa + wb);
            a.u -= dx * push * fa; a.v -= dy * push * fa;
            b.u += dx * push * fb; b.v += dy * push * fb;
          }
        }
      }
    }
  };

  relax(300);
  // Focal flowers belong in the middle. Packing alone cannot reorder stems
  // that are already jammed together, so swap any pair where a filler sits
  // further in than a more focal flower, then let the disc settle again.
  let swapped = false;
  for (let round = 0; round < 80; round++) {
    let best = 0, bi = -1, bj = -1;
    for (let i = 0; i < n; i++) {
      const a = live[i], pa = TYPES[a.type].pull, ra = Math.hypot(a.u, a.v);
      for (let j = 0; j < n; j++) {
        const b = live[j], dp = pa - TYPES[b.type].pull;
        if (dp < 0.05) continue;
        const dr = ra - Math.hypot(b.u, b.v);
        if (dr < 0.2) continue;
        if (dp * dr > best) { best = dp * dr; bi = i; bj = j; }
      }
    }
    if (bi < 0) break;
    const a = live[bi], b = live[bj];
    [a.u, b.u] = [b.u, a.u];
    [a.v, b.v] = [b.v, a.v];
    swapped = true;
  }
  if (swapped) relax(160);
  // last pass pulls everything in evenly so fillers close up the outer ring
  relax(220, true);

  // Bouquet radius. Focal heads must fit inside it; a few wispy fillers are
  // allowed to hang past it so one stray sprig does not widen the whole wrap.
  let disc = 0;
  const reach = [];
  for (const s of live) {
    const r = Math.hypot(s.u, s.v);
    reach.push(r + s.radius);
    if (TYPES[s.type].pull >= 0.5) disc = Math.max(disc, r + s.radius * 0.8);
    if (!s.placed) { s.cu = s.u; s.cv = s.v; s.placed = true; }
  }
  reach.sort((a, b) => a - b);
  if (n) disc = Math.max(disc, reach[Math.floor((n - 1) * 0.8)]);
  return dimensions(n, disc);
}

// Size of everything that depends on how full the bouquet is.
// The disc is the bouquet seen from above: a head at disc position (u, v)
// ends up at that horizontal offset, on a shallow dome of height L.
export const SAG = 0.36; // how far the rim of the dome sits below its top, per unit of disc radius

export function dimensions(n, disc) {
  disc = Math.max(disc, 0.5);
  const L = Math.max(1.7 + 0.018 * n, disc / 1.1 + SAG * disc); // tie point to the top of the dome
  const rim = L - SAG * disc; // height of the outer ring of heads
  const neck = 0.14 + 0.03 * Math.sqrt(n) + 0.035 * disc; // wrap radius at the ribbon
  return {
    n, L, disc, neck,
    theta: Math.atan(disc / rim), // lean of the outermost stems
    drop: 1.2 + 0.012 * n, // wrap length below the ribbon
    back: rim + 0.16, // back sheet height
    front: rim - 0.08, // front sheet height
    flare: Math.max((disc - 0.22 - neck) / rim, 0.12), // cone slope: paper ends just inside the outer heads
  };
}

// Open spots between heads, best first, for tucking in filler sprigs.
// Candidates sit on a golden-angle spiral; each is scored by how much room
// it has to the nearest heads.
export function findGaps(stems, disc, count) {
  const live = stems.filter((s) => !s.dying);
  const spots = [];
  const N = 90;
  for (let i = 0; i < N; i++) {
    const r = disc * 0.92 * Math.sqrt((i + 0.5) / N), a = i * GOLDEN_ANGLE + 0.7;
    const u = Math.cos(a) * r, v = Math.sin(a) * r;
    let room = 9;
    for (const s of live) room = Math.min(room, Math.hypot(s.u - u, s.v - v) - s.radius);
    spots.push({ u, v, room });
  }
  spots.sort((a, b) => b.room - a.room);
  const picked = [];
  for (const s of spots) {
    if (picked.length >= count || s.room < -0.08) break;
    if (picked.every((p) => Math.hypot(p.u - s.u, p.v - s.v) > 0.55)) picked.push(s);
  }
  return picked;
}
