// Hero scene: a wireframe "core" with seven orbiting agent nodes.
// Loaded lazily by app.js only when WebGL is available and motion is allowed.
import * as THREE from 'three';
import { AGENTS } from './data.js';

export function initHero({ canvas, tagsEl, panelEl, onSelect }) {
  const small = window.matchMedia('(max-width: 620px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const HOME = new THREE.Vector3(0, 0.4, 9.5);
  const FOCUS_OFFSET = new THREE.Vector3(0, 0, 2.6);
  camera.position.copy(HOME);

  const root = new THREE.Group();
  scene.add(root);

  // core: outer shell + inner glow
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: 0x2ee6a8, wireframe: true, transparent: true, opacity: 0.45 })
  );
  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.72, 0),
    new THREE.MeshBasicMaterial({ color: 0x38f0ff, wireframe: true, transparent: true, opacity: 0.9 })
  );
  root.add(shell, inner);

  // two orbit rings
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x2ee6a8, transparent: true, opacity: 0.22 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.006, 6, 200), ringMat);
  ring1.rotation.x = Math.PI / 2.4;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.006, 6, 200), ringMat);
  ring2.rotation.set(Math.PI / 3, 0.4, 0);
  root.add(ring1, ring2);

  // agent nodes
  const nodes = AGENTS.map((a, i) => {
    const g = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20), new THREE.MeshBasicMaterial({ color: a.color }));
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: 0.12, depthWrite: false })
    );
    g.add(dot, halo);
    root.add(g);
    return {
      a, g, dot,
      angle: (i / AGENTS.length) * Math.PI * 2,
      radius: i % 2 ? 3.6 : 2.7,
      speed: 0.12 + 0.025 * (i % 3),
      incl: ((i % 3) - 1) * 0.55,
      tag: null,
    };
  });

  // tags (DOM, so labels stay crisp and keyboard-accessible)
  nodes.forEach((n, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'node-tag';
    b.style.setProperty('--c', n.a.color);
    b.textContent = n.a.name;
    b.setAttribute('aria-label', `${n.a.name}: ${n.a.role}`);
    b.addEventListener('click', () => select(i));
    tagsEl.appendChild(b);
    n.tag = b;
  });

  // links core -> nodes
  const linePos = new Float32Array(AGENTS.length * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const links = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0x2ee6a8, transparent: true, opacity: 0.3 })
  );
  root.add(links);

  // starfield
  const N = small ? 300 : 900;
  const sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 8 + Math.random() * 10;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    sp[i * 3] = r * Math.sin(p) * Math.cos(t);
    sp[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
    sp[i * 3 + 2] = r * Math.cos(p);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x7fb8ff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false })));

  // interaction state
  let selected = -1;
  let drag = null;
  let spin = { x: 0, y: 0 };
  let mouse = { x: 0, y: 0 };
  const flyTo = new THREE.Vector3().copy(HOME);
  const look = new THREE.Vector3();
  const v = new THREE.Vector3();
  let running = false;
  let raf = 0;
  let last = performance.now();

  function select(i) {
    selected = selected === i ? -1 : i;
    nodes.forEach((n, j) => n.tag.setAttribute('aria-pressed', String(j === selected)));
    if (selected >= 0) {
      showPanel(nodes[selected].a);
    } else {
      flyTo.copy(HOME);
      hidePanel();
    }
    if (onSelect) onSelect(selected >= 0 ? nodes[selected].a : null);
  }

  function showPanel(a) {
    if (!panelEl) return;
    panelEl.style.setProperty('--c', a.color);
    panelEl.querySelector('h3').textContent = a.name;
    panelEl.querySelector('.meta').textContent = `${a.mode} · temperature ${a.temp} · ${a.role}`;
    panelEl.querySelector('p').textContent = a.what;
    panelEl.classList.add('show');
  }
  function hidePanel() {
    if (panelEl) panelEl.classList.remove('show');
  }

  // drag to spin
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    if (!drag) return;
    spin.y += (e.clientX - drag.x) * 0.005;
    spin.x += (e.clientY - drag.y) * 0.003;
    drag = { x: e.clientX, y: e.clientY };
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { mouse.x = 0; mouse.y = 0; });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selected >= 0) select(selected); });

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

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;

    spin.y += dt * 0.08;
    root.rotation.y += ((spin.y + mouse.x * 0.35) - root.rotation.y) * 0.08;
    root.rotation.x += ((spin.x + mouse.y * 0.2) - root.rotation.x) * 0.08;
    shell.rotation.y = t * 0.2;
    inner.rotation.y = -t * 0.4;
    inner.rotation.x = t * 0.25;
    ring1.rotation.z = t * 0.06;
    ring2.rotation.z = -t * 0.09;

    nodes.forEach((n, i) => {
      const a = n.angle + t * n.speed;
      n.g.position.set(
        Math.cos(a) * n.radius,
        Math.sin(a * 1.3) * n.incl * 1.2,
        Math.sin(a) * n.radius
      );
      n.dot.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.12);
    });

    // link positions
    nodes.forEach((n, i) => {
      linePos[i * 6] = 0; linePos[i * 6 + 1] = 0; linePos[i * 6 + 2] = 0;
      linePos[i * 6 + 3] = n.g.position.x;
      linePos[i * 6 + 4] = n.g.position.y;
      linePos[i * 6 + 5] = n.g.position.z;
    });
    lineGeo.attributes.position.needsUpdate = true;

    // camera fly (eases toward home or the focused node, which keeps orbiting)
    if (selected >= 0) {
      nodes[selected].g.getWorldPosition(v);
      flyTo.copy(v).multiplyScalar(1.45).add(FOCUS_OFFSET);
    }
    camera.position.lerp(flyTo, 0.06);
    look.lerp(selected >= 0 ? nodes[selected].g.position : new THREE.Vector3(0, 0, 0), 0.08);
    camera.lookAt(look);

    renderer.render(scene, camera);

    // project DOM tags onto nodes
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    nodes.forEach((n) => {
      n.g.getWorldPosition(v);
      v.project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      n.tag.style.opacity = visible ? '1' : '0';
      n.tag.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -50%)`;
    });

    if (running) raf = requestAnimationFrame(frame);
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

  const vis = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? start() : stop()));
  });
  vis.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  function selectByName(name) {
    const i = nodes.findIndex((n) => n.a.name === name.toUpperCase());
    if (i >= 0) select(i);
  }

  return { start, stop, selectByName, dispose() { stop(); ro.disconnect(); vis.disconnect(); renderer.dispose(); } };
}
