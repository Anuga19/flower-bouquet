// Renderer, lights, camera, input and the render loop.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp, lerp, easeOutCubic } from './util.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createScene(stage, bouquet) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 80);

  // key light with soft shadows, cool fill, warm rim from behind
  const key = new THREE.DirectionalLight(0xfff2e2, 2.6);
  key.position.set(4, 9, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 5;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.025;
  const sc = key.shadow.camera;
  sc.near = 1; sc.far = 30;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdfe9ff, 0.55);
  fill.position.set(-6, 3, 4);
  const rim = new THREE.DirectionalLight(0xfff0d8, 0.9);
  rim.position.set(-2, 6, -7);
  scene.add(fill, rim);

  // Soft contact shadow under the wrap: a tight dark core and a wide faint
  // halo. (A cast shadow of the whole bouquet on the floor reads as a hard
  // cut-out, so the floor only gets these.)
  const blobTex = blobTexture();
  const blobMat = (opacity) => new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity, toneMapped: false });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat(0.6));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat(0.16));
  blob.rotation.x = halo.rotation.x = -Math.PI / 2;
  scene.add(halo, blob);

  // tilt (toward the viewer) > spin (around the bouquet's own axis) > sway
  const tiltGroup = new THREE.Group(), spinGroup = new THREE.Group(), swayGroup = new THREE.Group();
  scene.add(tiltGroup);
  tiltGroup.add(spinGroup);
  spinGroup.add(swayGroup);
  swayGroup.add(bouquet.group);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const view = { yaw: 0.3, pitch: 0.32, yawT: 0.3, pitchT: 0.32, dist: 14, cy: 1, lastInput: -10 };
  const PITCH_MIN = -0.1, PITCH_MAX = 0.85;
  let dirty = true;
  // ?zoom=2 moves the camera closer (for checking detail)
  const params = new URLSearchParams(location.search);
  const zoom = Number(params.get('zoom')) || 1;
  const look = params.has('look') ? Number(params.get('look')) : null; // height to aim at, 0 = ribbon

  // --- input -------------------------------------------------------------
  let drag = null, fling = 0; // fling = leftover spin speed after a drag (rad/s)
  stage.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), v: 0 };
    fling = 0;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dyaw = (e.clientX - drag.x) * 0.009, now = performance.now();
    view.yawT += dyaw;
    drag.v = drag.v * 0.6 + (dyaw / Math.max((now - drag.t) / 1000, 0.008)) * 0.4;
    drag.t = now;
    view.pitchT = clamp(view.pitchT + (e.clientY - drag.y) * 0.005, PITCH_MIN, PITCH_MAX);
    drag.x = e.clientX; drag.y = e.clientY;
    view.lastInput = performance.now() / 1000;
    dirty = true;
  });
  const endDrag = () => {
    // let go while moving and the bouquet coasts to a stop
    if (drag && performance.now() - drag.t < 80 && !reduced.matches) fling = clamp(drag.v, -9, 9);
    drag = null; stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.5 : 0.2;
    if (e.key === 'ArrowLeft') view.yawT -= step;
    else if (e.key === 'ArrowRight') view.yawT += step;
    else if (e.key === 'ArrowUp') view.pitchT = clamp(view.pitchT - 0.1, PITCH_MIN, PITCH_MAX);
    else if (e.key === 'ArrowDown') view.pitchT = clamp(view.pitchT + 0.1, PITCH_MIN, PITCH_MAX);
    else if (e.key === 'Home') { view.yawT = 0.3; view.pitchT = 0.32; }
    else return;
    e.preventDefault();
    view.lastInput = performance.now() / 1000;
    dirty = true;
  });

  // --- sizing ------------------------------------------------------------
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Screen space covered by the top bar and the toolbar, in pixels. The
  // bouquet is framed in what is left.
  const inset = { top: 0, bottom: 0 };

  // Camera distance that keeps the whole bouquet in frame.
  function frame(d, instant) {
    const top = d.L + 1.25, bottom = -(d.drop + 0.3);
    const halfW = Math.max(d.disc + 0.8, 1.3);
    const halfH = (top - bottom) / 2;
    const tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const h = stage.clientHeight || 1;
    const free = Math.max(0.35, (h - inset.top - inset.bottom) / h);
    const dist = (Math.max(halfH / (tanF * free), halfW / (tanF * camera.aspect)) * 1.02 + halfW * 0.55) / zoom;
    const cy = look !== null ? look : (top + bottom) / 2 + (zoom > 1 ? d.L * 0.45 : 0);
    const k = instant ? 1 : 0.06;
    if (Math.abs(dist - view.dist) + Math.abs(cy - view.cy) > 1e-3) dirty = true;
    view.dist = lerp(view.dist, dist, k);
    view.cy = lerp(view.cy, cy, k);
    const elev = 0.22;
    // aim below the bouquet's middle so it sits in the middle of the free area
    const aim = view.cy - ((inset.bottom - inset.top) / 2 / h) * 2 * tanF * view.dist;
    camera.position.set(0, aim + Math.sin(elev) * view.dist, Math.cos(elev) * view.dist);
    camera.lookAt(0, aim, 0);
    // floor sits just under the lowest point of the wrap
    const gy = bottom + 0.12;
    const bs = 1.3 + d.neck * 5;
    blob.position.set(0, gy + 0.01, -0.25);
    blob.scale.set(bs, bs * 0.8, 1);
    halo.position.set(0.15, gy, -0.3);
    halo.scale.set(bs + halfW * 1.8, (bs + halfW * 1.8) * 0.7, 1);
    // shadow frustum follows the bouquet size
    const ext = halfH + halfW + 0.5;
    if (Math.abs(sc.right - ext) > 0.05) {
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
      sc.updateProjectionMatrix();
    }
    key.target.position.set(0, view.cy, 0);
    key.position.set(3, view.cy + 9, 7);
  }

  // --- loop --------------------------------------------------------------
  let last = performance.now(), raf = 0, first = true, time = 0;
  let intro = null; // { t, dur }: the bouquet turns and settles into view
  function step(dt) {
    const still = reduced.matches;
    if (!still) time += dt;

    if (Math.abs(fling) > 0.02) { view.yawT += fling * dt; fling *= Math.exp(-dt * 3.2); dirty = true; } else fling = 0;
    const k = still ? 1 : 1 - Math.exp(-dt * 9);
    const prevYaw = view.yaw;
    view.yaw = lerp(view.yaw, view.yawT, k);
    view.pitch = lerp(view.pitch, view.pitchT, k);
    const spinSpeed = dt > 0 ? (view.yaw - prevYaw) / dt : 0;
    if (Math.abs(view.yawT - view.yaw) + Math.abs(view.pitchT - view.pitch) > 1e-4) dirty = true;

    tiltGroup.rotation.x = view.pitch;
    spinGroup.rotation.y = view.yaw;
    if (intro) {
      intro.t += dt;
      const e = easeOutCubic(clamp(intro.t / intro.dur, 0, 1));
      spinGroup.rotation.y -= (1 - e) * 1.25;
      tiltGroup.rotation.x += (1 - e) * 0.22;
      tiltGroup.scale.setScalar(lerp(0.88, 1, e));
      dirty = true;
      if (intro.t >= intro.dur) { intro = null; tiltGroup.scale.setScalar(1); }
    }
    if (!still) {
      swayGroup.rotation.z = Math.sin(time * 0.75) * 0.022;
      swayGroup.rotation.x = Math.sin(time * 0.55 + 1.3) * 0.014;
    } else swayGroup.rotation.set(0, 0, 0);

    if (still && first) bouquet.settle();
    const moving = bouquet.update(still ? 1 : dt, time, { sway: !still, tilt: view.pitch, spinSpeed: still ? 0 : spinSpeed });
    frame(bouquet.dim, first || still);
    first = false;
    return moving;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const moving = step(dt);
    // with reduced motion nothing moves on its own, so only draw on change
    if (!reduced.matches || moving || dirty) renderer.render(scene, camera);
    dirty = false;
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduced.addEventListener('change', () => { dirty = true; });
  start();

  return {
    invalidate() { dirty = true; },
    // Entrance move for a received bouquet (skipped with reduced motion).
    intro(dur = 3.4) { if (!reduced.matches) intro = { t: 0, dur }; },
    setInsets(top, bottom) { inset.top = top; inset.bottom = bottom; dirty = true; },
    // Run the animation forward without waiting (used when checking renders).
    advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) step(1 / 30); dirty = true; },
    view,
    // Average cost of a full frame (update + draw, GPU flushed), in ms.
    bench(frames = 60) {
      const gl = renderer.getContext(), t0 = performance.now();
      for (let i = 0; i < frames; i++) { step(1 / 60); renderer.render(scene, camera); gl.finish(); }
      const ms = (performance.now() - t0) / frames;
      return { ms: +ms.toFixed(2), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    renderer,
  };
}
