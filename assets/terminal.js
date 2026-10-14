// In-browser terminal. Every command is simulated text: nothing runs on your machine or touches a network.
import { AGENTS, STATS, verdict } from './data.js';

const DEMO_SCOPE = ['example.test']; // the only domain family this demo treats as "in scope"
const HOST_RE = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i;

export function initTerminal({ logEl, inputEl, formEl, onScan, onRain }) {
  const history = [];
  let hIdx = -1;
  const timers = [];
  const COMMANDS = ['help', 'agents', 'skills', 'scope', 'verify', 'hunt', 'scan', 'doctor', 'whoami', 'matrix', 'history', 'clear', 'sudo'];

  function out(text, cls = '') {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function outRaw(node) {
    logEl.appendChild(node);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function later(ms, fn) {
    timers.push(setTimeout(fn, ms));
  }
  function cancelAll() {
    timers.splice(0).forEach(clearTimeout);
  }

  const handlers = {
    help() {
      out('commands:', 'info');
      out('  agents            the seven heads, their roles and temperatures');
      out('  skills            how many skill modules ship (1179) and where to browse them');
      out('  scope             how the allowlist gate works (demo rules)');
      out('  verify <0-100>    show the Verifier verdict for a confidence score');
      out('  hunt <host>       simulated run against a demo host (scope-gated)');
      out('  scan              animate the attack-surface simulation above');
      out('  doctor            what `hydra doctor` checks (run it locally)');
      out('  matrix            full-screen code rain (press any key to stop)');
      out('  whoami · history · clear');
    },
    agents() {
      AGENTS.forEach((a) => {
        const row = document.createElement('div');
        const name = document.createElement('span');
        name.style.color = a.color;
        name.textContent = a.name.padEnd(10, ' ');
        row.appendChild(name);
        row.appendChild(document.createTextNode(`${a.role.padEnd(24, ' ')}temp ${a.temp}  ${a.mode}`));
        outRaw(row);
      });
    },
    skills() {
      out(`${STATS.skills} skill modules · ${STATS.playbooks} methodology playbooks · ${STATS.scripts} automation scripts`, 'info');
      out('browse and search them on skills.html');
    },
    scope() {
      out('the CLI and loop runner check targets against SCOPE_ALLOWLIST.txt before any command runs.', 'info');
      out('this demo treats *.example.test as in scope. everything else is denied and never sent.');
      out('note: standalone helper scripts may not enforce the allowlist. read them before use.', 'warn');
    },
    verify(args) {
      const n = Number(args[0]);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        out('usage: verify <0-100>', 'warn');
        return;
      }
      const v = verdict(n);
      out(`confidence ${n}%  →  ${v.label}  (${v.note})`, v.cls);
    },
    hunt(args) {
      runHunt(args[0]);
    },
    scan() {
      out('[sim] starting the attack-surface simulation (no requests are sent)', 'info');
      if (onScan) onScan();
    },
    doctor() {
      out('`hydra doctor` is a local preflight: python, opencode, config, and the allowlist file.', 'info');
      out('this page cannot inspect your machine. run it in your own terminal after installing.');
    },
    whoami() {
      out('guest. this page has no shell and no network access to your machine.');
      out('install HYDRA locally to run real commands.');
    },
    matrix() {
      out('wake up, neo…', 'ok');
      if (onRain) onRain();
    },
    sudo() {
      out('[sudo] password for guest: ••••••••', 'dim');
      later(700, () => out('sudo: access denied. there is no root on a website.', 'bad'));
    },
    history() {
      if (!history.length) out('(empty)', 'dim');
      history.forEach((h, i) => out(`${String(i + 1).padStart(3, ' ')}  ${h}`));
    },
    clear() {
      cancelAll();
      logEl.textContent = '';
    },
  };

  function runHunt(target) {
    if (!target) {
      out('usage: hunt <host>   (try: hunt app.example.test)', 'warn');
      return;
    }
    const host = target.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!HOST_RE.test(host)) {
      out(`hunt: "${target}" does not look like a hostname.`, 'bad');
      return;
    }
    const inScope = DEMO_SCOPE.some((d) => host === d || host.endsWith(`.${d}`));
    if (!inScope) {
      out(`[deny] ${host} is not in SCOPE_ALLOWLIST. nothing was sent.`, 'bad');
      return;
    }
    cancelAll();
    const steps = [
      [0, 'info', `[sim] hunt ${host}  (simulated; no traffic leaves this page)`],
      [500, 'dim', '[recon]    passive sources: 3 candidates (simulated)'],
      [1100, 'ok', '[hunter]   3 leads saved with hash, tagged UNVERIFIED'],
      [1700, 'dim', '[verifier] replay 1/3 · diff ok'],
      [2200, 'dim', '[verifier] replay 2/3 · diff ok'],
      [2700, 'dim', '[verifier] replay 3/3 · diff ok'],
    ];
    steps.forEach(([ms, cls, text]) => later(ms, () => out(text, cls)));
    later(3200, () => {
      const v = verdict(84);
      out(`[verifier] confidence 84% → ${v.label}  (${v.note})`, v.cls);
    });
    later(3700, () => out('[reporter] draft ready. a human reviews and reproduces before anything is submitted.', 'info'));
    if (onScan) later(500, onScan);
  }

  function run(raw) {
    const line = raw.trim();
    if (!line) return;
    history.push(line);
    hIdx = history.length;
    out(`hydra> ${line}`, 'dim');
    if (line === 'hydra --version') {
      out(`hydra ${STATS.version} (site demo)`, 'ok');
      return;
    }
    if (line === 'rm -rf /' || line === 'rm -rf /*') {
      out('rm: refusing to delete the internet. nice try.', 'bad');
      return;
    }
    const [cmd, ...args] = line.split(/\s+/);
    const fn = handlers[cmd.toLowerCase()];
    if (fn) fn(args);
    else out(`command not found: ${cmd}. try 'help'.`, 'bad');
  }

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = inputEl.value;
    inputEl.value = '';
    run(v);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      hIdx = Math.max(0, hIdx - 1);
      inputEl.value = history[hIdx] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hIdx = Math.min(history.length, hIdx + 1);
      inputEl.value = hIdx >= history.length ? '' : history[hIdx];
    } else if (e.key === 'Tab') {
      const v = inputEl.value.trimStart();
      if (!v || v.includes(' ')) return;
      e.preventDefault();
      const hits = COMMANDS.filter((c) => c.startsWith(v));
      if (hits.length === 1) inputEl.value = `${hits[0]} `;
      else if (hits.length > 1) out(hits.join('   '), 'dim');
    }
  });

  out(`HYDRA ${STATS.version} · site console. type 'help'.`, 'info');
  out('everything here is simulated. nothing runs on your machine.', 'dim');

  return {
    run,
    dispose() { cancelAll(); },
  };
}

// Full-screen code rain for the `matrix` command and the Konami code.
export function startRain(canvas, ms = 6000) {
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const chars = '01HYDRA<>/{}[]#$%&*+=';
  let w = 0;
  let h = 0;
  let cols = [];
  const size = 16;
  function fit() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    cols = Array.from({ length: Math.ceil(w / size) }, () => Math.random() * -50);
  }
  fit();
  window.addEventListener('resize', fit);
  canvas.classList.add('on');
  let raf = 0;
  let last = 0;
  let dead = false;
  function draw(now) {
    if (dead) return;
    if (now - last > 45) {
      last = now;
      ctx.fillStyle = 'rgba(3,6,10,0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${size}px ui-monospace, Consolas, monospace`;
      cols.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = Math.random() > 0.97 ? '#dffff5' : '#2ee6a8';
        ctx.fillText(ch, i * size, y * size);
        cols[i] = y * size > h && Math.random() > 0.975 ? 0 : y + 1;
      });
    }
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
  const stop = () => {
    dead = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', fit);
    canvas.classList.remove('on');
    ctx.clearRect(0, 0, w, h);
  };
  const t = setTimeout(stop, ms);
  const key = () => { clearTimeout(t); stop(); window.removeEventListener('keydown', key); };
  // wait a beat so the Enter that started the rain can't also stop it
  setTimeout(() => window.addEventListener('keydown', key), 800);
  return stop;
}
