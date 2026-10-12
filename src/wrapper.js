// Paper wrapper, satin ribbon with bow, and the message tag.
// The bouquet's tie point is the origin; +Z is the front (where the bow is).
// All geometry is regenerated from the bouquet dimensions, so the wrap can
// follow the bouquet smoothly as it grows.

import * as THREE from 'three';
import { Geo } from './flowers/geo.js';
import { TAU, lerp, smoothstep, noise2, fbm2, tri } from './util.js';
import { LIMITS } from './config.js';

// Radius of the paper cone at height y and angle ang (0 = front).
// k separates the two sheets so their folds do not line up.
export function wrapRadius(y, ang, d, k) {
  let r;
  if (y >= 0) r = d.neck + y * d.flare;
  else r = d.neck * (1 + 0.3 * Math.pow(Math.min(-y / d.drop, 1), 0.75));
  const ay = Math.abs(y), s = d.neck / 0.25;
  // gathers under the ribbon: sharp pleats that fade away from the tie
  const env = (1 - Math.exp(-ay * 7)) * Math.exp(-ay * 0.8);
  r += env * s * (0.05 * tri(ang * 1.9 + k) + 0.03 * tri(ang * 3.3 + 1.7 * k) - 0.035);
  // long folds that open toward the rim
  if (y > 0) r += 0.055 * y * (tri(ang * 1.15 + k * 2.1) - 0.5) * (1 + d.flare) + 0.02 * y * (tri(ang * 2.9 + k) - 0.5);
  r += 0.025 * fbm2(ang * 1.4 + k * 5, y * 1.1, 40 + k) * (1 + ay * 0.4);
  return r;
}

function sheet(d, kind) {
  const g = new Geo();
  const back = kind === 0;
  g.grid(110, 38, (su, t, o) => {
    const s = su * 2 - 1, as = Math.abs(s);
    let ang, top;
    if (back) {
      ang = Math.PI + s * 2.8;
      top = d.back * (1 - 0.5 * Math.pow(as, 2.2) + 0.2 * Math.max(0, 1 - Math.abs(s - 0.16) / 0.26) + 0.1 * Math.max(0, 1 - Math.abs(s + 0.5) / 0.2));
    } else {
      ang = s * lerp(2.05, 1.6, t) + 0.12;
      top = d.front * (0.92 + 0.2 * Math.pow(as, 1.6) + 0.07 * smoothstep(0.86, 1, as) + 0.16 * Math.max(0, 1 - Math.abs(s + 0.62) / 0.22));
    }
    // uneven, torn-looking edges
    top += 0.04 * noise2(s * 9, kind * 3.3, 7) + 0.02 * noise2(s * 31, kind, 8) + 0.008 * noise2(s * 95, kind, 9);
    const bottom = -d.drop * (1 + 0.035 * noise2(s * 7, kind, 12) + 0.012 * noise2(s * 40, kind, 13));
    const y = lerp(bottom, top, t);
    let r = wrapRadius(y, ang, d, kind);
    if (!back) r += 0.016 + 0.07 * smoothstep(0.72, 1, as) * (0.3 + Math.max(y, 0) * 0.35);
    // the rim rolls outward a little
    r += 0.07 * (1 + d.flare) * Math.pow(smoothstep(0.78, 1, t), 2);
    o.x = r * Math.sin(ang); o.y = y; o.z = r * Math.cos(ang);
    o.u = ang * 0.42 + kind * 0.37; o.v = y * 0.38;
    o.r = o.g = o.b = 1;
  });
  return g;
}

// Flat band along a path. Ws are the width directions at each point.
function strip(g, pts, Ws, widthFn, { vcut = 0, cup = 0, project = null, nu = 4 } = {}) {
  const n = pts.length;
  const tan = [], nor = [];
  for (let k = 0; k < n; k++) {
    const t = new THREE.Vector3().subVectors(pts[Math.min(k + 1, n - 1)], pts[Math.max(k - 1, 0)]).normalize();
    tan.push(t);
    nor.push(new THREE.Vector3().crossVectors(Ws[k], t).normalize());
  }
  let len = 0;
  const dist = [0];
  for (let k = 1; k < n; k++) { len += pts[k].distanceTo(pts[k - 1]); dist.push(len); }
  const p = new THREE.Vector3();
  g.grid(nu, n - 1, (s, t, o) => {
    const k = Math.round(t * (n - 1)), u = s * 2 - 1, w = widthFn(t) / 2;
    p.copy(pts[k]).addScaledVector(Ws[k], u * w).addScaledVector(nor[k], cup * (1 - u * u) * w);
    if (vcut && k === n - 1) p.addScaledVector(tan[k], vcut * (Math.abs(u) * 2 - 1));
    if (project) project(p, u, t);
    o.x = p.x; o.y = p.y; o.z = p.z;
    o.u = dist[k] * 3; o.v = s;
    o.r = o.g = o.b = 1;
  });
}

function ribbon(d) {
  const g = new Geo();
  const sb = 0.82 + d.neck * 1.2; // bow size follows the bundle
  const bw = 0.125 * sb;
  // band around the neck
  g.grid(72, 4, (s, t, o) => {
    const ang = s * TAU;
    const r = d.neck + 0.042 + 0.014 * Math.sin(Math.PI * t) + 0.004 * noise2(ang * 3, t * 2, 4);
    o.x = r * Math.sin(ang); o.z = r * Math.cos(ang);
    o.y = (t - 0.5) * bw + 0.012 * Math.sin(ang * 2 + 0.6) + 0.004 * noise2(ang * 5, 1, 6);
    o.u = ang * r * 3; o.v = t; o.r = o.g = o.b = 1;
  }, undefined, { wrapU: true });

  const F = new THREE.Vector3(0, 0, d.neck + 0.075);
  // knot
  // (own UVs: the satin highlight needs a UV direction everywhere)
  g.grid(12, 7, (su, t, o) => {
    const a2 = -su * TAU, ph = Math.PI * t, sp = Math.sin(ph);
    o.x = 0.062 * sb * sp * Math.cos(a2);
    o.y = -0.08 * sb * Math.cos(ph);
    o.z = 0.05 * sb * sp * Math.sin(a2);
    o.u = su * 2; o.v = t; o.r = o.g = o.b = 1;
  }, new THREE.Matrix4().makeTranslation(F.x, F.y, F.z + 0.02 * sb), { wrapU: true });

  // two loops: each a pinched ring of ribbon leaving and re-entering the knot
  for (const side of [-1, 1]) {
    const M = new THREE.Matrix4().makeTranslation(F.x, F.y, F.z + 0.02 * sb)
      .multiply(new THREE.Matrix4().makeScale(side, 1, 1))
      .multiply(new THREE.Matrix4().makeRotationZ(0.4 + (side > 0 ? 0.1 : 0)))
      .multiply(new THREE.Matrix4().makeRotationX(-0.5));
    const pts = [], Ws = [];
    const n = 26, a = (side > 0 ? 0.38 : 0.35) * sb, b = 0.2 * sb;
    const W = new THREE.Vector3(0, 1, 0).transformDirection(M);
    for (let k = 0; k < n; k++) {
      const s = k / (n - 1), ph = s * TAU;
      const e = Math.pow(Math.sin(Math.PI * s), 0.7);
      pts.push(new THREE.Vector3(a * (1 - Math.cos(ph)) / 2, -0.07 * sb * Math.sin(Math.PI * s) + 0.03 * sb * Math.sin(ph), b * Math.sin(ph) * (0.6 + 0.4 * e)).applyMatrix4(M));
      Ws.push(W);
    }
    strip(g, pts, Ws, (t) => bw * (0.4 + 1.1 * Math.pow(Math.sin(Math.PI * t), 0.7)), { cup: 0.3, nu: 6 });
  }

  // two tails that lie on the paper below the knot, ends cut to a V
  let tagAnchor = null;
  for (const side of [-1, 1]) {
    const n = 18, len = (side > 0 ? 0.6 : 0.74) * sb;
    const pts = [], Ws = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      pts.push(new THREE.Vector3(side * (0.02 + 0.13 * t + 0.025 * Math.sin(t * 5 + side)) * sb, -0.02 - len * t, 0));
    }
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(k - 1, 0)], b = pts[Math.min(k + 1, n - 1)];
      Ws.push(new THREE.Vector3(-(b.y - a.y), b.x - a.x, 0).normalize().multiplyScalar(-side));
    }
    const project = (p, u, t) => {
      const r = wrapRadius(p.y, 0.3 * side, d, 1) + 0.016 + 0.07;
      const zs = Math.sqrt(Math.max(r * r - p.x * p.x, r * r * 0.2));
      const near = smoothstep(0, 0.22, t);
      p.z = lerp(F.z + 0.02, zs + 0.012 + 0.012 * Math.sin(t * 8 + u * 1.5 + side), near);
    };
    strip(g, pts, Ws, (t) => bw * (0.6 + 0.4 * smoothstep(0, 0.25, t)), { vcut: bw * 0.42, project, cup: 0.1 });
    if (side > 0) {
      tagAnchor = pts[n - 1].clone();
      project(tagAnchor, 0, 1);
    }
  }
  return { geo: g, tagAnchor, sb };
}

const WHITE = new THREE.Color(1, 1, 1);

function copyInto(mesh, geo) {
  const pos = mesh.geometry.attributes.position, nor = mesh.geometry.attributes.normal;
  pos.array.set(geo.p); nor.array.set(geo.n);
  pos.needsUpdate = true; nor.needsUpdate = true;
}

const TAG_W = 768, TAG_H = 480, HOLE_Y = 56;

function drawTag(canvas, text, font) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, TAG_W, TAG_H);
  const r = 34, m = 6;
  ctx.beginPath();
  ctx.roundRect(m, m, TAG_W - 2 * m, TAG_H - 2 * m, r);
  ctx.fillStyle = '#f5f0e2';
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,30,0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(m + 16, m + 16, TAG_W - 2 * m - 32, TAG_H - 2 * m - 32, r - 12);
  ctx.stroke();
  // eyelet
  ctx.fillStyle = '#d8ccb0';
  ctx.beginPath(); ctx.arc(TAG_W / 2, HOLE_Y, 30, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(TAG_W / 2, HOLE_Y, 15, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  if (!text) return;
  const maxW = TAG_W - 110, top = 100, bottom = TAG_H - 40;
  ctx.fillStyle = '#26282b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let size = 170; size >= 40; size -= 6) {
    ctx.font = `600 ${size}px ${font}`;
    const words = text.split(/\s+/), lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
    }
    lines.push(line);
    const lh = size * 0.92;
    const fits = lines.length * lh <= bottom - top && lines.every((l) => ctx.measureText(l).width <= maxW);
    if (fits || size <= 40) {
      const y0 = (top + bottom) / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => ctx.fillText(l, TAG_W / 2, y0 + i * lh, maxW));
      break;
    }
  }
}

export function createWrapper(materials) {
  const group = new THREE.Group();
  const tagFont = '"Caveat Variable", "Caveat", cursive';
  let built = false, last = null;

  const meshes = {};
  const make = (name, geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo.build(), mat);
    m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false;
    meshes[name] = m; group.add(m);
    return m;
  };

  // tag: string plus a card, hanging from a pivot at the end of one tail
  const tagPivot = new THREE.Group();
  const tagCanvas = document.createElement('canvas');
  tagCanvas.width = TAG_W; tagCanvas.height = TAG_H;
  const blankCanvas = document.createElement('canvas');
  blankCanvas.width = TAG_W; blankCanvas.height = TAG_H;
  const tagTex = new THREE.CanvasTexture(tagCanvas);
  const blankTex = new THREE.CanvasTexture(blankCanvas);
  for (const t of [tagTex, blankTex]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
  const tw = 0.92, th = tw * TAG_H / TAG_W, stringLen = 0.2;
  const tagBody = new THREE.Group();
  const plane = new THREE.PlaneGeometry(tw, th);
  const frontMat = new THREE.MeshStandardMaterial({ map: tagTex, alphaTest: 0.5, roughness: 0.9 });
  const backMat = new THREE.MeshStandardMaterial({ map: blankTex, alphaTest: 0.5, roughness: 0.9 });
  const front = new THREE.Mesh(plane, frontMat);
  const back = new THREE.Mesh(plane, backMat);
  back.rotation.y = Math.PI;
  front.castShadow = back.castShadow = true;
  front.receiveShadow = true;
  tagBody.add(front, back);
  tagBody.position.y = -(stringLen + th / 2 - th * HOLE_Y / TAG_H);
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, stringLen + 0.03, 5).translate(0, -(stringLen + 0.03) / 2 + 0.03, 0),
    new THREE.MeshStandardMaterial({ color: '#cdbd98', roughness: 1 }),
  );
  tagPivot.add(string, tagBody);
  group.add(tagPivot);

  let message = '';
  const redrawTag = () => {
    drawTag(tagCanvas, message, tagFont);
    drawTag(blankCanvas, '', tagFont);
    tagTex.needsUpdate = true; blankTex.needsUpdate = true;
  };

  const target = { paper: new THREE.Color(), inner: new THREE.Color(), ribbon: new THREE.Color(), sheen: new THREE.Color() };
  let colorsSet = false;

  return {
    group,

    // Rebuild the wrap for the given dimensions (cheap; called while they ease).
    update(d) {
      if (last && Math.abs(last.neck - d.neck) + Math.abs(last.flare - d.flare) + Math.abs(last.back - d.back) + Math.abs(last.drop - d.drop) < 2e-4) return;
      last = { ...d };
      const back = sheet(d, 0), front = sheet(d, 1), rib = ribbon(d);
      if (!built) {
        for (const [name, geo] of [['back', back], ['front', front]]) {
          make(name + 'Out', geo, materials.paperOuter);
          const inner = make(name + 'In', geo, materials.paperInner, false);
          inner.geometry.dispose();
          inner.geometry = meshes[name + 'Out'].geometry;
        }
        make('ribbon', rib.geo, materials.ribbon);
        built = true;
      } else {
        copyInto(meshes.backOut, back);
        copyInto(meshes.frontOut, front);
        copyInto(meshes.ribbon, rib.geo);
      }
      tagPivot.position.copy(rib.tagAnchor).add(new THREE.Vector3(0, 0.03, 0.03));
      tagPivot.scale.setScalar(0.85 + (rib.sb - 1) * 0.5);
    },

    setColors(def, instant = false) {
      target.paper.set(def.paper);
      const hsl = {};
      target.paper.getHSL(hsl);
      // tissue lining: same hue, lighter
      target.inner.copy(target.paper).lerp(new THREE.Color('#ffffff'), hsl.l < 0.3 ? 0.16 : 0.2);
      target.ribbon.set(def.ribbon);
      target.sheen.copy(target.ribbon).lerp(new THREE.Color('#ffffff'), 0.55);
      if (instant || !colorsSet) {
        materials.paperOuter.color.copy(target.paper);
        materials.paperInner.color.copy(target.inner);
        materials.ribbon.color.copy(target.ribbon);
        materials.ribbon.sheenColor.copy(target.sheen);
        colorsSet = true;
      }
    },

    setMessage(text) {
      message = (text || '').slice(0, LIMITS.messageMax).trim();
      redrawTag();
      // the handwriting font may still be loading
      if (document.fonts && document.fonts.load) document.fonts.load('600 64px "Caveat Variable"').then(redrawTag, () => {});
    },

    // Returns true while something is still moving.
    animate(dt, time, swing, tilt, spinSpeed) {
      const k = 1 - Math.exp(-dt * 7);
      let moving = false;
      const ease = (c, t) => {
        if (Math.abs(c.r - t.r) + Math.abs(c.g - t.g) + Math.abs(c.b - t.b) > 0.002) { c.lerp(t, k); moving = true; } else c.copy(t);
      };
      ease(materials.paperOuter.color, target.paper);
      ease(materials.paperInner.color, target.inner);
      ease(materials.ribbon.color, target.ribbon);
      ease(materials.ribbon.sheenColor, target.sheen);
      // hang straight down even though the bouquet leans, and swing a little
      tagPivot.rotation.x = -tilt + (swing ? Math.sin(time * 1.1 + 1) * 0.035 : 0);
      tagPivot.rotation.z = (swing ? Math.sin(time * 1.45) * 0.06 : 0) + THREE.MathUtils.clamp(spinSpeed * 0.12, -0.35, 0.35);
      return moving;
    },
  };
}
