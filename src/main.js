import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/caveat';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles.css';
import { createUI } from './ui.js';

const stage = document.getElementById('stage');
const fallback = document.getElementById('stage-fallback');
const params = new URLSearchParams(location.search);
if (params.has('solo')) document.body.classList.add('solo');

async function boot() {
  let ui = null;
  try {
    const { webglAvailable, createScene } = await import('./scene.js');
    // ?nowebgl forces the fallback so it can be checked on any machine
    if (params.has('nowebgl') || !webglAvailable()) throw new Error('WebGL is not available');
    const { createMaterials } = await import('./materials.js');
    const { createBouquet } = await import('./bouquet.js');
    const materials = createMaterials();
    const bouquet = createBouquet(materials);
    let scene = null;
    const view = {
      addStem: (type, instant) => bouquet.add(type, instant),
      removeStem: (type) => bouquet.remove(type),
      setWrapper: (def, instant) => { bouquet.wrapper.setColors(def, instant); scene?.invalidate(); },
      setMessage: (text) => { bouquet.wrapper.setMessage(text); scene?.invalidate(); },
    };
    ui = createUI(view);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (ui.received && !reduced) bouquet.reveal(); else bouquet.settle();
    scene = createScene(stage, bouquet);
    if (ui.received) scene.intro();
    const fit = () => {
      const i = params.has('solo') ? { top: 0, bottom: 0 } : ui.insets();
      scene.setInsets(i.top, i.bottom);
    };
    fit();
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(() => { bouquet.wrapper.setMessage(ui.state.message); scene.invalidate(); });
    if (import.meta.env.DEV) window.__bouquet = { ui, bouquet, scene };
  } catch (err) {
    // No 3D: say so plainly and keep the controls working.
    console.warn(err);
    stage.classList.add('no-webgl');
    for (const a of ['tabindex', 'role', 'aria-label']) stage.removeAttribute(a);
    document.getElementById('hint').hidden = true;
    fallback.hidden = false;
    if (!ui) createUI(null);
  }
}

boot();
