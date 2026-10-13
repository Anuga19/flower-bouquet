// Toolbar, popovers and menus. Holds the order state and tells the 3D view
// (if there is one) what changed.

import { track } from '@vercel/analytics';
import { FLOWERS, WRAPPERS, LIMITS, DEFAULTS, EMAIL } from './config.js';

const $ = (id) => document.getElementById(id);

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children);
  return node;
};

const totalStems = (counts) => FLOWERS.reduce((sum, f) => sum + (counts[f.id] || 0), 0);

// A bouquet travels as a link: #s=rose:3,peony:2&w=blush&m=For+you
// A sent bouquet adds t= (the message shown under it) and view=1 (show the
// receiver's page instead of the builder).
export function readLink() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (!p.has('s')) return null;
  const stems = {};
  let left = LIMITS.maxStems;
  for (const part of p.get('s').split(',')) {
    const [id, n] = part.split(':');
    if (!FLOWERS.some((f) => f.id === id)) continue;
    const qty = Math.min(left, Math.max(0, parseInt(n, 10) || 0));
    if (qty) { stems[id] = (stems[id] || 0) + qty; left -= qty; }
  }
  return {
    stems,
    wrapper: WRAPPERS.some((w) => w.id === p.get('w')) ? p.get('w') : DEFAULTS.wrapper,
    message: (p.get('m') || '').slice(0, LIMITS.messageMax),
    text: (p.get('t') || '').slice(0, EMAIL.textMax),
    received: p.get('view') === '1',
  };
}

function makeLink(state, text = null) {
  const stems = FLOWERS.filter((f) => state.counts[f.id]).map((f) => `${f.id}:${state.counts[f.id]}`).join(',');
  const note = state.message ? `&m=${encodeURIComponent(state.message)}` : '';
  const sent = text === null ? '' : `${text ? `&t=${encodeURIComponent(text)}` : ''}&view=1`;
  return `${location.origin}${location.pathname}#s=${stems}&w=${state.wrapper}${note}${sent}`;
}

// Bouquets are kept in this browser: the one being worked on (so it is still
// there next visit) and a short list the person chose to save.
const STORE_KEY = 'bouquet-builder:v1';
const SAVED_MAX = 12;
function readStore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return { current: data.current || null, saved: Array.isArray(data.saved) ? data.saved : [] };
  } catch { return { current: null, saved: [] }; }
}
function writeStore(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; } catch { return false; } // private mode, storage full
}
// Anything read back is checked like a link would be.
function cleanBouquet(b) {
  if (!b || typeof b !== 'object') return null;
  const stems = {};
  let left = LIMITS.maxStems;
  for (const f of FLOWERS) {
    const n = Math.min(left, Math.max(0, parseInt(b.stems?.[f.id], 10) || 0));
    if (n) { stems[f.id] = n; left -= n; }
  }
  return {
    stems,
    wrapper: WRAPPERS.some((w) => w.id === b.wrapper) ? b.wrapper : DEFAULTS.wrapper,
    message: String(b.message || '').slice(0, LIMITS.messageMax),
  };
}

const asset = (name) => `${import.meta.env.BASE_URL}toolbar/${name}.png`;

// The wrapper picture is drawn in pink. This repaints it in any paper and
// ribbon color while keeping its light and dark folds.
function tintWrapper(img, paper, ribbon) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height), d = data.data;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const P = hex(paper), R = hex(ribbon);
  // lightness the artwork uses for a plain paper fold and for the ribbon
  const PAPER_L = 0.84, RIBBON_L = 0.6;
  const shade = (col, l, ref) => col.map((v) => (l >= ref ? v + (255 - v) * ((l - ref) / (1 - ref)) : v * (1 - 0.75 * (ref - l) / ref)));
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    const a = shade(P, l, PAPER_L), bRib = shade(R, l, RIBBON_L);
    // darker, saturated pixels are the ribbon; blend across the boundary
    const k = Math.min(1, Math.max(0, (0.7 - l) / 0.06)) * Math.min(1, (max - min) / 0.12);
    for (let j = 0; j < 3; j++) d[i + j] = a[j] + (bRib[j] - a[j]) * k;
  }
  ctx.putImageData(data, 0, 0);
  return c.toDataURL('image/png');
}

export function createUI(view) {
  const link = readLink();
  const received = !!link?.received;
  const store = readStore();
  // Start from a link if there is one, else the bouquet left here last time,
  // else the example.
  const last = cleanBouquet(store.current);
  const start = link || (last && Object.keys(last.stems).length ? last : null)
    || { stems: DEFAULTS.stems, wrapper: DEFAULTS.wrapper, message: DEFAULTS.message };
  let ready = false; // set once the first bouquet is loaded

  const snapshot = () => ({
    stems: Object.fromEntries(FLOWERS.filter((f) => state.counts[f.id]).map((f) => [f.id, state.counts[f.id]])),
    wrapper: state.wrapper,
    message: state.message,
  });
  // Remember the bouquet as it is now. A received bouquet is someone else's,
  // so viewing one never replaces your own.
  function persist() {
    if (!ready || received) return;
    store.current = snapshot();
    writeStore(store);
  }
  const state = {
    counts: Object.fromEntries(FLOWERS.map((f) => [f.id, 0])),
    wrapper: start.wrapper,
    message: start.message,
  };

  const dockWrap = $('dock-wrap'), toast = $('toast'), hint = $('hint'), announce = $('announce');
  const itemList = $('item-list'), stemCount = $('stem-count');
  const messageInput = $('message'), messageCount = $('message-count');
  const wrapBtn = $('wrap-btn');
  const flowerBtns = {};

  // --- toolbar flowers: one click adds one stem --------------------------
  for (const f of FLOWERS) {
    const lower = f.name.toLowerCase();
    const btn = el('button', { type: 'button', class: 'flower-btn', 'aria-label': `Add one ${lower}`, title: f.name, onclick: () => change(f.id, 1) },
      el('img', { src: asset(f.id), alt: '', draggable: 'false' }));
    btn.addEventListener('animationend', () => btn.classList.remove('added'));
    $('flower-list').append(btn);
    flowerBtns[f.id] = btn;
  }
  $('note-img').src = asset('note');

  // --- wrapper colors ----------------------------------------------------
  for (const w of WRAPPERS) {
    const input = el('input', { type: 'radio', name: 'wrapper', value: w.id, id: `wrap-${w.id}`, class: 'sr-only', checked: w.id === state.wrapper });
    input.addEventListener('change', () => { state.wrapper = w.id; view?.setWrapper(w); renderWrapper(); persist(); });
    $('wrapper-swatches').append(el('div', { class: 'swatch' }, input,
      el('label', { for: `wrap-${w.id}`, title: w.name },
        el('span', { class: 'chip', style: `--paper:${w.paper}`, 'aria-hidden': 'true' }),
        el('span', { class: 'sr-only', text: w.name }))));
  }

  // The toolbar wrapper takes the chosen colors. Two stacked images let the
  // new color fade in over the old one.
  const wrapImg = $('wrap-img'), wrapNext = $('wrap-img-next');
  const wrapArt = new Image();
  const tinted = {};
  wrapArt.onload = () => renderWrapper();
  wrapArt.src = asset('wrapper');
  wrapImg.src = wrapArt.src;

  function renderWrapper() {
    const w = WRAPPERS.find((x) => x.id === state.wrapper);
    wrapBtn.setAttribute('aria-label', `Change wrapper color. Current: ${w.name}`);
    if (!wrapArt.complete || !wrapArt.naturalWidth) return;
    let src;
    try { src = tinted[w.id] ||= tintWrapper(wrapArt, w.paper, w.ribbon); } catch { return; }
    if (wrapImg.dataset.id === w.id) return;
    if (!wrapImg.dataset.id) { wrapImg.src = src; wrapImg.dataset.id = w.id; return; }
    wrapNext.src = src;
    wrapNext.classList.add('show');
    wrapImg.dataset.id = w.id;
    clearTimeout(renderWrapper.t);
    renderWrapper.t = setTimeout(() => { wrapImg.src = src; wrapNext.classList.remove('show'); }, 260);
  }

  // --- tag message -------------------------------------------------------
  messageInput.maxLength = LIMITS.messageMax;
  messageInput.value = state.message;
  messageInput.addEventListener('input', () => {
    state.message = messageInput.value.slice(0, LIMITS.messageMax);
    view?.setMessage(state.message);
    renderMessage();
    persist();
  });
  messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(true); });
  const renderMessage = () => { messageCount.textContent = `${state.message.length}/${LIMITS.messageMax}`; };

  // --- popovers and menus: one open at a time ----------------------------
  const pops = [
    { btn: $('items-btn'), panel: $('items-pop') },
    { btn: $('menu-btn'), panel: $('menu-pop') },
    { btn: wrapBtn, panel: $('wrap-pop'), docked: true },
    { btn: $('note-btn'), panel: $('note-pop'), docked: true },
  ];
  // opened from the menu, so it has no toggle button of its own
  const sendPop = { btn: $('menu-btn'), panel: $('send-pop'), quiet: true };
  let openPop = null;

  function place(p) {
    // centre a toolbar popover over its button, kept inside the window
    const b = p.btn.getBoundingClientRect(), w = p.panel.offsetWidth;
    const left = Math.max(12, Math.min(b.left + b.width / 2 - w / 2, window.innerWidth - w - 12));
    p.panel.style.left = `${left}px`;
  }

  function open(p) {
    close();
    if (p.docked) place(p);
    p.panel.inert = false;
    p.panel.classList.add('open');
    if (!p.quiet) p.btn.setAttribute('aria-expanded', 'true');
    hint.classList.toggle('away', !!p.docked);
    openPop = p;
    const target = p.panel.querySelector('input:checked, input[type=text], input[type=email], button:not(:disabled)');
    target?.focus({ preventScroll: true });
    if (target === messageInput) messageInput.select();
  }

  function close(refocus = false) {
    if (!openPop) return;
    openPop.panel.classList.remove('open');
    openPop.panel.inert = true;
    openPop.btn.setAttribute('aria-expanded', 'false');
    hint.classList.remove('away');
    if (refocus) openPop.btn.focus();
    openPop = null;
  }

  for (const p of pops) p.btn.addEventListener('click', () => (openPop === p ? close() : open(p)));
  document.addEventListener('pointerdown', (e) => {
    if (openPop && !openPop.panel.contains(e.target) && !openPop.btn.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openPop) { e.stopPropagation(); close(true); } });
  window.addEventListener('resize', () => { if (openPop?.docked) place(openPop); });

  // --- menu actions ------------------------------------------------------
  let toastTimer = 0;
  function say(text, ms = 3200) {
    toast.textContent = text;
    toast.classList.add('open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('open'), ms);
  }

  function setCounts(want) {
    for (const f of FLOWERS) {
      const n = want[f.id] || 0;
      while (state.counts[f.id] > n) change(f.id, -1, true);
      while (state.counts[f.id] < n) change(f.id, 1, true);
    }
    render();
  }

  $('clear').addEventListener('click', () => { setCounts({}); close(true); });
  $('reset').addEventListener('click', () => { setCounts(DEFAULTS.stems); close(true); });
  // --- send bouquet: email address and a few words -----------------------
  const sendForm = $('send-form'), sendDone = $('send-done'), sendEmail = $('send-email'), sendFrom = $('send-from'), sendText = $('send-text');
  const sendError = $('send-error'), sendSubmit = $('send-submit');
  let sentLink = '';
  sendText.maxLength = EMAIL.textMax;
  const renderSendCount = () => { $('send-count').textContent = `${sendText.value.length}/${EMAIL.textMax}`; };
  sendText.addEventListener('input', renderSendCount);
  renderSendCount();

  $('send').addEventListener('click', () => {
    if (!totalStems(state.counts)) { close(true); say('Add a flower first, then send the bouquet.'); return; }
    sendForm.hidden = false; sendDone.hidden = true; sendError.textContent = '';
    open(sendPop);
  });

  $('send-pop').addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = sendEmail.value.trim(), from = sendFrom.value.trim(), text = sendText.value.trim();
    const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!valid(to)) { sendError.textContent = 'Enter their full email address, like name@example.com.'; sendEmail.focus(); return; }
    if (!valid(from)) { sendError.textContent = 'Enter your full email address, so they can reply to you.'; sendFrom.focus(); return; }
    sendError.textContent = '';
    sentLink = makeLink(state, text);

    // Ask the site to send the email. 'sent' = done, 'fallback' = no mail
    // service here (use the sender's email app), anything else = show why.
    let outcome = 'fallback';
    sendSubmit.disabled = true; sendSubmit.textContent = 'Sending';
    try {
      const res = await fetch(EMAIL.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, from, text, link: sentLink, website: $('send-website').value }),
      });
      if (res.ok) outcome = 'sent';
      else if (res.status === 429) outcome = 'Too many bouquets were sent from here. Try again in a few minutes.';
      else if (res.status === 400 || res.status === 502) outcome = 'The email could not be sent. Check both addresses and try again.';
    } catch { /* offline or no server: fall back */ }
    sendSubmit.disabled = false; sendSubmit.textContent = 'Send bouquet';

    let title, detail;
    if (outcome === 'sent') {
      title = 'Bouquet sent'; detail = `It is on its way to ${to}. If they reply, it comes to ${from}.`;
    } else if (outcome === 'fallback') {
      const body = `${text ? `${text}\n\n` : ''}Open your bouquet:\n${sentLink}`;
      location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(EMAIL.subject)}&body=${encodeURIComponent(body)}`;
      title = 'Email ready'; detail = `Your email app has the bouquet for ${to}. Press send there.`;
    } else { sendError.textContent = outcome; return; }
    // counts only: how it went out and how big the bouquet was, nothing personal
    track('Bouquet sent', { via: outcome === 'sent' ? 'site' : 'email app', stems: totalStems(state.counts) });
    $('send-done-title').textContent = title;
    $('send-done-text').textContent = detail;
    $('send-preview').href = sentLink;
    sendForm.hidden = true; sendDone.hidden = false;
    $('send-done-title').focus();
  });

  $('send-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(sentLink); $('send-copy').textContent = 'Link copied'; }
    catch { say(`Copy this link: ${sentLink}`, 12000); }
    setTimeout(() => { $('send-copy').textContent = 'Copy link'; }, 2400);
  });

  // --- state changes -----------------------------------------------------
  function change(id, delta, quiet = false) {
    const next = state.counts[id] + delta;
    if (next < 0) return;
    if (delta > 0 && totalStems(state.counts) >= LIMITS.maxStems) {
      if (!quiet) say(`${LIMITS.maxStems} stems is the limit. Remove one in Check items to add another.`);
      return;
    }
    state.counts[id] = next;
    if (delta > 0) view?.addStem(id); else view?.removeStem(id);
    if (quiet) return;
    const f = FLOWERS.find((x) => x.id === id);
    if (delta > 0) { flowerBtns[id].classList.remove('added'); void flowerBtns[id].offsetWidth; flowerBtns[id].classList.add('added'); }
    announce.textContent = `${f.name} ${delta > 0 ? 'added' : 'removed'}. ${next} in the bouquet, ${totalStems(state.counts)} stems in total.`;
    render();
  }

  // "Check items": what is in the bouquet, with counts only.
  let shown = {};
  function render() {
    const stems = totalStems(state.counts), full = stems >= LIMITS.maxStems;
    const rows = FLOWERS.filter((f) => state.counts[f.id] > 0).map((f) => {
      const lower = f.name.toLowerCase();
      return el('li', { 'data-id': f.id },
        el('span', { text: f.name }),
        el('span', { class: 'stepper' },
          el('button', { type: 'button', class: 'step', 'aria-label': `Remove one ${lower}`, onclick: () => step(f.id, -1) }, '−'),
          el('output', { class: 'qty', 'aria-label': `${f.name} stems` }, String(state.counts[f.id])),
          el('button', { type: 'button', class: 'step', 'aria-label': `Add one ${lower}`, disabled: full, onclick: () => step(f.id, 1) }, '+')));
    });
    // rows that just appeared slide in; a count that changed gives a small bump
    for (const row of rows) {
      const id = row.dataset.id, was = shown[id];
      if (was === undefined) row.classList.add('new');
      else if (was !== state.counts[id]) row.querySelector('.qty').classList.add('bump');
    }
    shown = Object.fromEntries(rows.map((r) => [r.dataset.id, state.counts[r.dataset.id]]));
    itemList.replaceChildren(...(rows.length ? rows : [el('li', { class: 'empty', text: 'No flowers yet. Click a flower below to add it.' })]));
    stemCount.textContent = `${stems} of ${LIMITS.maxStems} stems`;
    for (const f of FLOWERS) flowerBtns[f.id].setAttribute('aria-disabled', full ? 'true' : 'false');
    persist();
  }

  // Re-rendering replaces the buttons, so put focus back on the same one.
  function step(id, delta) {
    change(id, delta);
    const row = itemList.querySelector(`[data-id="${id}"]`);
    const btn = row?.querySelector(delta > 0 ? '.step:last-child:not(:disabled)' : '.step') || row?.querySelector('.step') || itemList.querySelector('.step');
    (btn || $('items-btn')).focus();
  }

  // Swap the whole bouquet for another one (from a link or the saved list).
  function apply(b) {
    setCounts(b.stems);
    state.wrapper = b.wrapper;
    $(`wrap-${b.wrapper}`).checked = true;
    view?.setWrapper(WRAPPERS.find((x) => x.id === b.wrapper));
    state.message = messageInput.value = b.message;
    view?.setMessage(b.message);
    renderWrapper();
    renderMessage();
    persist();
  }

  // A bouquet link opened (or pasted) while the page is already showing.
  window.addEventListener('hashchange', () => {
    const link = readLink();
    if (!link) return;
    // a sent bouquet has its own page; load it fresh so it plays its entrance
    if (link.received || received) { location.reload(); return; }
    apply(link);
  });

  // --- saved bouquets ----------------------------------------------------
  const savedList = $('saved-list');
  const savedPop = { btn: $('menu-btn'), panel: $('saved-pop'), quiet: true };
  const same = (a, b) => JSON.stringify(cleanBouquet(a)) === JSON.stringify(cleanBouquet(b));
  const describe = (b) => {
    const names = FLOWERS.filter((f) => b.stems[f.id]).map((f) => f.name.toLowerCase());
    const n = Object.values(b.stems).reduce((x, y) => x + y, 0);
    return `${n} ${n === 1 ? 'stem' : 'stems'}: ${names.join(', ')}`;
  };
  const when = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  function renderSaved(newId = null) {
    const rows = store.saved.map((entry) => {
      const b = cleanBouquet(entry), w = WRAPPERS.find((x) => x.id === b.wrapper);
      const title = b.message || `${w.name} bouquet`;
      return el('li', { class: entry.id === newId ? 'new' : '' },
        el('button', { type: 'button', class: 'saved-open', 'aria-label': `Open ${title}, saved ${when(entry.at)}, ${describe(b)}`, onclick: () => { apply(b); close(true); say('Bouquet opened.'); } },
          el('i', { style: `background:${w.paper}`, 'aria-hidden': 'true' }),
          el('b', { text: title }),
          el('small', { text: `${when(entry.at)} · ${describe(b)}` })),
        el('button', { type: 'button', class: 'saved-del', 'aria-label': `Delete ${title}`, title: 'Delete', onclick: () => {
          store.saved = store.saved.filter((x) => x.id !== entry.id);
          writeStore(store);
          renderSaved();
          (savedList.querySelector('button') || $('menu-btn')).focus();
        } }, '\u00d7'));
    });
    savedList.replaceChildren(...(rows.length ? rows : [el('li', { class: 'empty', text: 'Nothing saved yet. Choose Save bouquet in the menu to keep one here.' })]));
  }

  $('save').addEventListener('click', () => {
    close(true);
    if (!totalStems(state.counts)) { say('Add a flower first, then save the bouquet.'); return; }
    const now = snapshot();
    // saving the same bouquet twice just moves it to the top
    store.saved = store.saved.filter((x) => !same(x, now));
    const entry = { ...now, id: Date.now().toString(36), at: Date.now() };
    store.saved = [entry, ...store.saved].slice(0, SAVED_MAX);
    if (!writeStore(store)) { say('This browser would not let the bouquet be saved. Use Send bouquet to keep a link instead.', 6000); return; }
    track('Bouquet saved');
    renderSaved(entry.id);
    say('Bouquet saved. Open it again from Saved bouquets in the menu.');
  });
  $('open-saved').addEventListener('click', () => { renderSaved(); open(savedPop); });

  // --- first load: from a link, the last visit, or the example ------------
  for (const [id, n] of Object.entries(start.stems)) {
    state.counts[id] = n;
    for (let i = 0; i < n; i++) view?.addStem(id, true);
  }
  view?.setWrapper(WRAPPERS.find((x) => x.id === state.wrapper), true);
  view?.setMessage(state.message);
  renderWrapper();
  renderMessage();
  render();
  ready = true;
  persist();

  // --- the receiver's page: only the bouquet and the message --------------
  if (received) {
    for (const part of [document.querySelector('.topbar'), dockWrap]) { part.hidden = true; part.inert = true; }
    document.title = EMAIL.subject;
    document.body.classList.add('received');
    $('letter-text').textContent = link.text;
    $('letter-text').hidden = !link.text;
    $('letter-link').href = location.pathname;
    $('letter').hidden = false;
  }

  return {
    state, change, received,
    // space the 3D view should keep clear, in pixels
    insets: () => (received
      ? { top: 24, bottom: window.innerHeight - $('letter').getBoundingClientRect().top + 16 }
      : { top: 70, bottom: window.innerHeight - dockWrap.getBoundingClientRect().top + 52 }),
  };
}
