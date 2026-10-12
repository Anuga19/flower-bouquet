// Registry of flower types: how to build each one and how it behaves in the
// arrangement. Geometry is built lazily, a few variants per type, and shared
// by every stem of that type.

import { mulberry32 } from '../util.js';
import { buildRose, buildPeony, buildTulip, buildLily, buildSunflower, buildDaisy, buildLavender, buildEucalyptus } from './heads.js';
import { buildStem, buildGreenery, buildBabysBreath, STEM_LEN } from './stems.js';

export { STEM_LEN };

/*
 * radius  space the head claims in the layout
 * pull    how hard it is drawn to the centre (focal flowers high, fillers low)
 * nod     how far the head tips outward from its stem (radians)
 * lift    extra stem length relative to the bouquet dome
 * stem    colour used for the cut stem ends under the wrap
 */
export const TYPES = {
  sunflower: { build: buildSunflower, radius: 0.5, pull: 1.0, nod: 0.5, lift: -0.02, stem: '#4f7a34', scale: [0.9, 1.08] },
  peony: { build: buildPeony, radius: 0.43, pull: 0.92, nod: 0.2, lift: 0.0, stem: '#42692f', scale: [0.9, 1.1] },
  rose: { build: buildRose, radius: 0.34, pull: 0.8, nod: 0.2, lift: 0.02, stem: '#3a5e2b', scale: [0.88, 1.1] },
  lily: { build: buildLily, radius: 0.42, pull: 0.62, nod: 0.6, lift: 0.07, stem: '#447a34', scale: [0.9, 1.08] },
  tulip: { build: buildTulip, radius: 0.24, pull: 0.55, nod: 0.08, lift: 0.06, stem: '#7fa860', scale: [0.9, 1.1] },
  daisy: { build: buildDaisy, radius: 0.24, pull: 0.42, nod: 0.38, lift: 0.04, stem: '#537f36', scale: [0.9, 1.15] },
  lavender: { build: buildLavender, radius: 0.19, pull: 0.2, nod: 0.05, lift: 0.0, stem: '#697e60', scale: [0.9, 1.1] },
  eucalyptus: { build: buildEucalyptus, radius: 0.22, pull: 0.1, nod: 0.12, lift: 0.0, stem: '#6e7460', scale: [0.9, 1.1] },
};

export const VARIANTS = 3;

const cache = new Map();

export function getVariants(type) {
  if (!cache.has(type)) {
    const list = [];
    const base = Object.keys(TYPES).indexOf(type) * 101 + 7;
    for (let v = 0; v < VARIANTS; v++) {
      list.push({
        head: TYPES[type].build(mulberry32(base + v * 13), v),
        stem: buildStem(mulberry32(base + v * 29 + 3), type),
      });
    }
    cache.set(type, list);
  }
  return cache.get(type);
}

let greenery;
export function getGreenery() {
  if (!greenery) greenery = [0, 1, 2].map((v) => buildGreenery(mulberry32(900 + v * 7)));
  return greenery;
}

let breath;
export function getBabysBreath() {
  if (!breath) breath = [0, 1, 2].map((v) => buildBabysBreath(mulberry32(1300 + v * 11)));
  return breath;
}
