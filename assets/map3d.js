// Attack-surface SIMULATION. Nothing here sends a request to any host.
// It shows how the scope gate and CDN tagging behave, using made-up example.* names.
import * as THREE from 'three';

export const SIM_HOSTS = [
  { name: 'app.example.test', inScope: true },
  { name: 'api.example.test', inScope: true },
  { name: 'cdn.example.test', inScope: true, cdn: true },
  { name: 'legacy.example.test', inScope: true },
  { name: 'partner.example.org', inScope: false },
  { name: 'mail.example.net', inScope: false },
];

export function initMap({ canvas, onEvent, onHostState }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.6, 7.2);

  const globe = new THREE.Group();
  scene.add(globe);

  const wire = new THREE.Mesh(
    new THREE.SphereGeometry(2, 36, 18),
    new THREE.MeshBasicMaterial({ color: 0x38f0ff, wireframe: true, transparent: true, opacity: 0.12 })
  );
  globe.add(wire);
  const equator = new THREE.Mesh(
    new THREE.TorusGeometry(2.02, 0.008, 6, 180),
    new THREE.MeshBasicMaterial({ color: 0x2ee6a8, transparent: true, opacity: 0.5 })
  );
  equator.rotation.x = Math.PI / 2;
  globe.add(equator);

  // blips: one per host, placed on the sphere
  const colorFor = (h) => (h.inScope ? (h.cdn ? 0xffb84d : 0x2ee6a8) : 0xff4d5e);
  const blips = SIM_HOSTS.map((h, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / SIM_HOSTS.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    const p = new THREE.Vector3(
      2.02 * Math.sin(phi) * Math.cos(theta),
      2.02 * Math.cos(phi),
      2.02 * Math.sin(phi) * Math.sin(theta)
    );
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0x52647a, transparent: true, opacity: 0.4 })
    );
    m.position.copy(p);
    globe.add(m);
    return { h, m, p, state: 'idle' };
  });

  // scan rings
  const rings = [];
  function emitRing(at) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.02, 0.05, 64),
      new THREE.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    m.position.copy(at).multiplyScalar(1.01);
    m.lookAt(at.clone().multiplyScalar(2));
    globe.add(m);
    rings.push({ m, t: 0 });
  }

  let running = false;
  let raf = 0;
  let last = performance.now();
  let drag = null;
  let autoSpin = true;
  let spinY = 0;
  let timers = [];

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; autoSpin = false; });
  canvas.addEventListener('pointermove', (e) => { if (drag !== null) { spinY += (e.clientX - drag) * 0.006; drag = e.clientX; } });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (autoSpin) spinY += dt * 0.12;
    globe.rotation.y += (spinY - globe.rotation.y) * 0.1;

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt * 0.7;
      r.m.scale.setScalar(1 + r.t * 14);
      r.m.material.opacity = Math.max(0, 0.8 * (1 - r.t));
      if (r.t >= 1) {
        globe.remove(r.m);
        r.m.geometry.dispose();
        r.m.material.dispose();
        rings.splice(i, 1);
      }
    }
    blips.forEach((b) => {
      if (b.state === 'lit') b.m.scale.setScalar(1 + Math.sin(now / 200) * 0.25);
    });

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  function setBlip(b, state) {
    b.state = state;
    const col = state === 'lit' ? colorFor(b.h) : state === 'skip' ? 0xff4d5e : 0x52647a;
    b.m.material.color.setHex(col);
    b.m.material.opacity = state === 'idle' ? 0.4 : 1;
    if (onHostState) onHostState(b.h, state);
  }

  // simulated scan: walks the host list, applying the scope gate and CDN tagging
  function scan() {
    reset(false);
    let t = 0;
    const step = (ms, fn) => { timers.push(setTimeout(fn, (t += ms))); };
    onEvent('[sim] starting simulated recon. nothing is sent to any host.', 'info');
    SIM_HOSTS.forEach((h, i) => {
      const b = blips[i];
      step(550, () => {
        emitRing(b.p);
        if (!h.inScope) {
          setBlip(b, 'skip');
          onEvent(`[deny] ${h.name} is not in SCOPE_ALLOWLIST. skipped.`, 'bad');
        } else if (h.cdn) {
          setBlip(b, 'lit');
          onEvent(`[tag]  ${h.name} is CDN-shielded. not port-scanned.`, 'warn');
        } else {
          setBlip(b, 'lit');
          onEvent(`[ok]   ${h.name} queued for passive checks (simulated).`, 'ok');
        }
      });
    });
    step(600, () => onEvent('[sim] done. the Verifier would now replay each lead 3x.', 'info'));
  }

  function reset(log = true) {
    timers.forEach(clearTimeout);
    timers = [];
    blips.forEach((b) => setBlip(b, 'idle'));
    if (log) onEvent('[sim] reset.', 'dim');
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  const vis = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())));
  vis.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  return {
    scan,
    reset,
    start,
    stop,
    dispose() { stop(); ro.disconnect(); vis.disconnect(); timers.forEach(clearTimeout); renderer.dispose(); },
  };
}
