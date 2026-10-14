// HYDRA v2 entry point. Loaded on every page as a module.
// 3D scenes are loaded lazily and only when WebGL is available and motion is allowed.
// Any failure leaves the page fully usable: the DOM content never depends on 3D.
import { REPO, INSTALL, verdict } from './data.js';
import { initTerminal, startRain } from './terminal.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
const WEBGL = hasWebGL();

// ---------- nav ----------
const nav = $('.nav');
const toggle = $('.nav-toggle');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// ---------- copy buttons ----------
$$('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const src = $(btn.dataset.copy);
    const text = src ? src.textContent.trim() : INSTALL;
    try {
      await navigator.clipboard.writeText(text);
      flash(btn, 'copied');
    } catch {
      flash(btn, 'select + ⌘C');
    }
  });
});
function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = old), 1400);
}

// ---------- reveal on scroll ----------
const revealIO = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          revealIO.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' })
  : null;
$$('.rv').forEach((el) => (revealIO ? revealIO.observe(el) : el.classList.add('in')));

// ---------- "decrypt" text scramble on headings ----------
const GLYPHS = '01<>/\\{}[]#$%&*+=';
function scramble(el) {
  const target = el.dataset.decrypt || el.textContent;
  const frames = 14;
  let f = 0;
  const id = setInterval(() => {
    f++;
    const shown = target
      .split('')
      .map((ch, i) => (i < (f / frames) * target.length || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
      .join('');
    el.textContent = shown;
    if (f >= frames) {
      clearInterval(id);
      el.textContent = target;
    }
  }, 34);
}
if (!RM && revealIO) {
  const decIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        scramble(e.target);
        decIO.unobserve(e.target);
      }
    });
  });
  $$('[data-decrypt]').forEach((el) => decIO.observe(el));
}

// ---------- boot sequence (once per session, index only) ----------
const boot = $('#boot');
function endBoot() {
  if (!boot) return;
  boot.classList.add('done');
  setTimeout(() => boot.remove(), 600);
  try { sessionStorage.setItem('hydra-booted', '1'); } catch {}
}
if (boot) {
  let seen = false;
  try { seen = !!sessionStorage.getItem('hydra-booted'); } catch {}
  if (seen || RM) {
    endBoot();
  } else {
    const lines = [
      ['ok', 'loading agent definitions ............ 7/7'],
      ['ok', 'indexing skill library ............... 1179 modules'],
      ['ok', 'loading scope gate (allowlist) ....... enforced for CLI'],
      ['warn', 'live network activity ............... none. this is a website'],
      ['ok', 'ready. type `help` anywhere, or press ⌘K'],
    ];
    const out = $('#bootLines');
    let i = 0;
    let stopped = false;
    const next = () => {
      if (stopped) return;
      if (i >= lines.length) return setTimeout(endBoot, 500);
      const [cls, text] = lines[i++];
      const d = document.createElement('div');
      d.className = cls;
      d.textContent = `[${cls === 'ok' ? ' OK ' : 'WARN'}] ${text}`;
      out.appendChild(d);
      setTimeout(next, 240);
    };
    setTimeout(next, 200);
    const skip = $('#bootSkip');
    skip && skip.addEventListener('click', () => { stopped = true; endBoot(); });
    window.addEventListener('keydown', function k() { stopped = true; endBoot(); window.removeEventListener('keydown', k); }, { once: true });
  }
}

// ---------- command palette (⌘K / Ctrl+K) ----------
const PAL = [
  { l: 'Home · hero core', h: 'index.html#hero', s: 'home' },
  { l: 'Scroll pipeline', h: 'index.html#pipeline', s: 'recon hunter verifier reporter' },
  { l: 'Attack-surface simulation', h: 'index.html#surface', s: 'map scan scope' },
  { l: 'Terminal', h: 'index.html#terminal', s: 'shell console commands' },
  { l: 'Verifier gate', h: 'index.html#gate', s: 'confidence verified partial rejected' },
  { l: 'Agents', h: 'agents.html', s: 'heads roles' },
  { l: 'Skill constellation', h: 'skills.html', s: 'skills search library 1179' },
  { l: 'Docs · quick start', h: 'docs.html', s: 'install setup guide' },
  { l: 'Security & limits', h: 'security.html', s: 'scope legal safety limits' },
  { l: 'Roadmap', h: 'roadmap.html', s: 'changelog next later' },
  { l: 'GitHub repository', h: REPO, s: 'source code star' },
  { l: 'Run matrix rain', a: 'matrix', s: 'fun effect' },
  { l: 'Copy install command', a: 'copy', s: 'clone setup' },
];
const pal = $('#palette');
const palInput = $('#palInput');
const palList = $('#palList');
let palSel = 0;
let palItems = PAL;
function renderPal() {
  if (!palList) return;
  const q = (palInput.value || '').trim().toLowerCase();
  palItems = PAL.filter((x) => !q || `${x.l} ${x.s}`.toLowerCase().includes(q));
  palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  palList.textContent = '';
  palItems.forEach((x, i) => {
    const li = document.createElement('li');
    li.className = 'palette-item';
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === palSel));
    const a = document.createElement('span');
    a.textContent = x.l;
    const b = document.createElement('small');
    b.textContent = x.h ? x.h.replace('https://', '') : 'action';
    li.append(a, b);
    li.addEventListener('click', () => runPal(x));
    palList.appendChild(li);
  });
  if (!palItems.length) {
    const li = document.createElement('li');
    li.className = 'palette-item';
    li.textContent = 'no matches';
    palList.appendChild(li);
  }
}
function openPal() {
  if (!pal) return;
  pal.classList.add('open');
  palInput.value = '';
  palSel = 0;
  renderPal();
  palInput.focus();
}
function closePal() {
  pal && pal.classList.remove('open');
}
function runPal(x) {
  closePal();
  if (x.a === 'matrix') return launchRain();
  if (x.a === 'copy') return navigator.clipboard?.writeText(INSTALL).catch(() => {});
  if (x.h) location.href = x.h;
}
if (pal) {
  palInput.addEventListener('input', () => { palSel = 0; renderPal(); });
  palInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palSel + 1, palItems.length - 1); renderPal(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(palSel - 1, 0); renderPal(); }
    else if (e.key === 'Enter') { e.preventDefault(); palItems[palSel] && runPal(palItems[palSel]); }
    else if (e.key === 'Escape') closePal();
  });
  pal.addEventListener('click', (e) => { if (e.target === pal) closePal(); });
}
$$('.pal-btn').forEach((b) => b.addEventListener('click', openPal));
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    pal && pal.classList.contains('open') ? closePal() : openPal();
  }
});

// ---------- rain + Konami ----------
const rainCanvas = $('#rain');
function launchRain() {
  startRain(rainCanvas, 7000);
}
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let kIdx = 0;
window.addEventListener('keydown', (e) => {
  kIdx = e.key.toLowerCase() === KONAMI[kIdx].toLowerCase() ? kIdx + 1 : (e.key === KONAMI[0] ? 1 : 0);
  if (kIdx === KONAMI.length) {
    kIdx = 0;
    launchRain();
  }
});

// ---------- verifier gate ----------
const gate = $('#gate');
const gateOut = $('#gateOut');
function renderGate() {
  if (!gate || !gateOut) return;
  const pct = Number(gate.value);
  const v = verdict(pct);
  gateOut.textContent = '';
  const big = document.createElement('b');
  big.className = v.cls;
  big.textContent = `${pct}% → ${v.label}`;
  const small = document.createElement('span');
  small.textContent = v.note;
  gateOut.append(big, small);
  const lbl = $('#gateVal');
  if (lbl) lbl.textContent = `${pct}%`;
}
if (gate) {
  gate.addEventListener('input', renderGate);
  renderGate();
}

// ---------- scroll-driven pipeline (DOM part; works without WebGL) ----------
const pipeWrap = $('.pipe-wrap');
const stops = $$('.stop');
const dots = $$('.pipe-dots button');
let pipeCtl = null;
let pipeIdx = -1;
function setStop(i) {
  if (i === pipeIdx) return;
  pipeIdx = i;
  stops.forEach((s, j) => s.classList.toggle('on', j === i));
  dots.forEach((d, j) => d.setAttribute('aria-current', String(j === i)));
  pipeCtl && pipeCtl.setActive(i);
}
function pipeProgress() {
  if (!pipeWrap) return 0;
  const rect = pipeWrap.getBoundingClientRect();
  const total = pipeWrap.offsetHeight - window.innerHeight;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, -rect.top / total));
}
let ticking = false;
function onPipeScroll() {
  if (ticking || !pipeWrap) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const p = pipeProgress();
    setStop(Math.min(stops.length - 1, Math.floor(p * stops.length)));
    pipeCtl && pipeCtl.setProgress(p);
  });
}
if (pipeWrap && stops.length) {
  window.addEventListener('scroll', onPipeScroll, { passive: true });
  window.addEventListener('resize', onPipeScroll);
  dots.forEach((d, i) => d.addEventListener('click', () => {
    const total = pipeWrap.offsetHeight - window.innerHeight;
    const p = (i + 0.5) / stops.length;
    window.scrollTo({ top: pipeWrap.offsetTop + p * total, behavior: RM ? 'auto' : 'smooth' });
  }));
  setStop(0);
}

// ---------- scene visibility for HUD ----------
const hudScene = $('#hudScene');
const sceneOf = { hero: 'core', pipeline: 'pipeline', surface: 'surface', terminal: 'console', gate: 'gate' };
if (hudScene && 'IntersectionObserver' in window) {
  const sIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) hudScene.textContent = sceneOf[e.target.id] || 'idle';
    });
  }, { threshold: 0.35 });
  Object.keys(sceneOf).forEach((id) => { const el = document.getElementById(id); el && sIO.observe(el); });
}

// ---------- HUD fps ----------
const hudFps = $('#hudFps');
if (hudFps && !RM) {
  let frames = 0;
  let t0 = performance.now();
  const tick = (now) => {
    frames++;
    if (now - t0 >= 500) {
      hudFps.textContent = String(Math.round((frames * 1000) / (now - t0)));
      frames = 0;
      t0 = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- custom cursor (fine pointers only) ----------
if (FINE && !RM) {
  const c = document.createElement('div');
  c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, {
    position: 'fixed', left: '0', top: '0', width: '26px', height: '26px', marginLeft: '-13px', marginTop: '-13px',
    border: '1px solid rgba(46,230,168,.7)', borderRadius: '50%', pointerEvents: 'none', zIndex: '400',
    transition: 'width .15s, height .15s, margin .15s, background .15s', mixBlendMode: 'screen',
  });
  document.body.appendChild(c);
  let hovering = false;
  window.addEventListener('pointermove', (e) => {
    c.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const t = e.target;
    const over = !!(t.closest && t.closest('a, button, input, summary, .node-tag, .stop, canvas'));
    if (over !== hovering) {
      hovering = over;
      c.style.width = c.style.height = over ? '44px' : '26px';
      c.style.marginLeft = c.style.marginTop = over ? '-22px' : '-13px';
      c.style.background = over ? 'rgba(46,230,168,.12)' : 'transparent';
    }
  }, { passive: true });
}

// ---------- terminal ----------
const termLog = $('#termLog');
const termInput = $('#termInput');
const termForm = $('#termForm');
let mapCtl = null;
let termCtl = null;
if (termLog && termInput && termForm) {
  termCtl = initTerminal({
    logEl: termLog,
    inputEl: termInput,
    formEl: termForm,
    onScan: () => mapCtl && mapCtl.scan(),
    onRain: launchRain,
  });
  $$('[data-run]').forEach((b) => b.addEventListener('click', () => {
    termInput.value = b.dataset.run;
    termForm.requestSubmit();
    termInput.value = '';
  }));
}

// ---------- 3D scenes (lazy) ----------
function markScene(el) {
  el && el.classList.add('is-3d');
}
async function loadScenes() {
  if (!WEBGL || RM) return;

  // hero core
  const heroCanvas = $('#hero3d');
  if (heroCanvas) {
    try {
      const m = await import('./hero3d.js');
      window.__hero = m.initHero({
        canvas: heroCanvas,
        tagsEl: $('#nodeTags'),
        panelEl: $('#agentPanel'),
      });
      markScene($('#hero'));
      $('#agentPanel .x')?.addEventListener('click', () => window.__hero && window.__hero.selectByName(
        $('#agentPanel h3')?.textContent || ''
      ));
    } catch (err) {
      console.warn('hero scene unavailable, using static fallback', err);
    }
  }

  // scroll pipeline
  const pipeCanvas = $('#pipe3d');
  if (pipeCanvas) {
    try {
      const m = await import('./pipe3d.js');
      pipeCtl = m.initPipe({ canvas: pipeCanvas });
      markScene(pipeWrap);
      pipeCtl.setActive(Math.max(0, pipeIdx));
      onPipeScroll();
    } catch (err) {
      console.warn('pipeline scene unavailable', err);
    }
  }

  // attack-surface simulation
  const mapCanvas = $('#map3d');
  if (mapCanvas) {
    try {
      const m = await import('./map3d.js');
      mapCtl = m.initMap({
        canvas: mapCanvas,
        onEvent: (text, cls) => appendLog($('#mapLog'), text, cls),
        onHostState: (h, state) => updateTarget(h, state),
      });
      markScene($('.scene-frame'));
      $('#mapScan')?.addEventListener('click', () => mapCtl.scan());
      $('#mapReset')?.addEventListener('click', () => mapCtl.reset());
    } catch (err) {
      console.warn('map scene unavailable', err);
    }
  }

}
function appendLog(el, text, cls) {
  if (!el) return;
  el.querySelectorAll('.placeholder').forEach((p) => p.remove());
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = text;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}
function updateTarget(h, state) {
  const row = document.querySelector(`[data-host="${CSS.escape(h.name)}"] em`);
  if (!row) return;
  const label = { idle: 'queued', lit: h.cdn ? 'tagged' : 'checked', skip: 'denied' }[state] || state;
  row.textContent = label;
  row.className = { idle: 'dim', lit: h.cdn ? 'warn' : 'ok', skip: 'bad' }[state] || 'dim';
}

// fallback for the map when WebGL is missing: keep the simulation text working
const mapNoGl = $('#map3d');
if (mapNoGl && !WEBGL) {
  $('#mapScan')?.addEventListener('click', () => {
    appendLog($('#mapLog'), '[sim] 3D unavailable in this browser. the text simulation still runs below.', 'warn');
  });
}

loadScenes();

// keep a link to the page's own repo in the install block
$$('[data-repo]').forEach((a) => (a.href = REPO));

// global error guard: never leave a blank page because of one bad script
window.addEventListener('error', (e) => {
  if (e && e.message) console.warn('[hydra]', e.message);
});
