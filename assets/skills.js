// Skills page: loads assets/skills.json once, then search/filter/paginate in memory.
// The 3D constellation is optional and driven by the same filters.
const CATS = [
  { key: 'web', label: 'Web Exploitation', color: '#ff4d5e' },
  { key: 'forensics-defense', label: 'Forensics & Defense', color: '#38f0ff' },
  { key: 'platform', label: 'Platform Attacks', color: '#ffb84d' },
  { key: 'binary', label: 'Binary Exploitation', color: '#ff00ff' },
  { key: 'recon', label: 'Reconnaissance', color: '#00cc66' },
  { key: 'crypto', label: 'Cryptography', color: '#4db8ff' },
  { key: 'mobile', label: 'Mobile', color: '#b18cff' },
  { key: 'ai', label: 'AI Security', color: '#2ee6a8' },
  { key: 'other', label: 'Other Security Skills', color: '#8193a5' },
  { key: 'cve-specialized', label: 'CVE & Specialized', color: '#ffe66d' },
];
const LABEL = Object.fromEntries(CATS.map((c) => [c.key, c.label]));
const PAGE = 48;

const $ = (s) => document.querySelector(s);
const grid = $('#skillGrid');
const countEl = $('#skillCount');
const chipsEl = $('#skillChips');
const searchEl = $('#skillSearch');
const moreBtn = $('#skillMore');

let all = [];
let filtered = [];
let shown = 0;
let category = null;
let query = '';
let con = null;

function matches(item, q) {
  return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
}

function applyFilters() {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const pass = (item) =>
    (!category || item.category === category) &&
    terms.every((t) => matches(item, t));
  filtered = [];
  const hitIdx = new Set();
  all.forEach((item, i) => {
    if (pass(item)) {
      filtered.push(item);
      if (q) hitIdx.add(i);
    }
  });
  shown = 0;
  render(true);
  if (con) {
    con.setCategory(category);
    con.setHits(q ? hitIdx : null);
  }
  syncChips();
}

function card(item) {
  const el = document.createElement('div');
  el.className = 'skill';
  const cat = document.createElement('div');
  cat.className = 'cat';
  cat.textContent = LABEL[item.category] || item.category;
  const name = document.createElement('b');
  name.textContent = item.name;
  const desc = document.createElement('p');
  desc.textContent = item.description;
  el.append(cat, name, desc);
  return el;
}

function render(reset) {
  if (reset) grid.textContent = '';
  const slice = filtered.slice(shown, shown + PAGE);
  const frag = document.createDocumentFragment();
  slice.forEach((item) => frag.appendChild(card(item)));
  grid.appendChild(frag);
  shown += slice.length;
  countEl.textContent = `showing ${shown} of ${filtered.length} · ${all.length} total`;
  moreBtn.hidden = shown >= filtered.length;
  if (!filtered.length) {
    const p = document.createElement('p');
    p.className = 'noscript';
    p.textContent = 'no skills match. try a broader term or clear the category.';
    grid.appendChild(p);
  }
}

function buildChips() {
  chipsEl.textContent = '';
  const make = (key, label, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.key = key || '';
    b.setAttribute('aria-pressed', String(category === key));
    b.textContent = `${label} ${n}`;
    b.addEventListener('click', () => {
      category = category === key ? null : key;
      applyFilters();
    });
    return b;
  };
  chipsEl.appendChild(make(null, 'All', all.length));
  CATS.forEach((c) => {
    const n = all.filter((s) => s.category === c.key).length;
    if (n) chipsEl.appendChild(make(c.key, c.label, n));
  });
}
function syncChips() {
  chipsEl.querySelectorAll('.chip').forEach((b) => {
    const key = b.dataset.key || null;
    b.setAttribute('aria-pressed', String(category === key));
  });
}

async function load() {
  try {
    const res = await fetch('assets/skills.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    all = data.skills;
    $('#skillTotal') && ($('#skillTotal').textContent = data.total);
    buildChips();
    applyFilters();
  } catch (err) {
    grid.textContent = '';
    const p = document.createElement('p');
    p.className = 'noscript';
    p.textContent = 'could not load the skill index. if you opened this file directly, serve the folder over http (e.g. python -m http.server).';
    grid.appendChild(p);
    countEl.textContent = '';
    moreBtn.hidden = true;
    console.warn('skills.json', err);
  }
}

searchEl && searchEl.addEventListener('input', () => {
  query = searchEl.value;
  applyFilters();
});
moreBtn && moreBtn.addEventListener('click', () => render(false));

// Optional 3D constellation (progressive enhancement).
async function startConstellation() {
  const canvas = $('#const3d');
  if (!canvas || !all.length) return;
  const webgl = (() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  })();
  if (!webgl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    const mod = await import('./constellation.js');
    const legend = $('#constLegend');
    const tip = $('#constTip');
    con = mod.initConstellation({
      canvas,
      tipEl: tip,
      categories: CATS,
      items: all,
      onPick: (name) => {
        searchEl.value = name;
        query = name;
        applyFilters();
        document.getElementById('list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });
    CATS.forEach((c) => {
      if (!all.some((s) => s.category === c.key)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label;
      b.style.background = 'rgba(3,6,10,.8)';
      b.style.borderColor = c.color;
      b.style.color = c.color;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        category = category === c.key ? null : c.key;
        applyFilters();
        legend.querySelectorAll('button').forEach((x) => {
          const on = x === b && category === c.key;
          x.setAttribute('aria-pressed', String(on));
          x.style.background = on ? c.color : 'rgba(3,6,10,.8)';
          x.style.color = on ? '#03060a' : c.color;
        });
      });
      legend.appendChild(b);
    });
    const frame = canvas.closest('.const-wrap');
    frame && frame.classList.add('is-3d');
  } catch (err) {
    console.warn('constellation unavailable', err);
  }
}

load().then(startConstellation);
