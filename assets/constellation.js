// Skills constellation: all skills as one Points draw call, clustered by category on a sphere.
import * as THREE from 'three';

export function initConstellation({ canvas, tipEl, categories, items, onPick }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 13);
  const root = new THREE.Group();
  scene.add(root);

  // one centre per category, spread on a fibonacci sphere
  const K = categories.length;
  const centre = new Map();
  categories.forEach((c, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / K);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    centre.set(c.key, new THREE.Vector3(
      4.8 * Math.sin(phi) * Math.cos(theta),
      4.8 * Math.cos(phi),
      4.8 * Math.sin(phi) * Math.sin(theta)
    ));
  });

  const N = items.length;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const base = new Float32Array(N * 3);
  const colorOf = new Map(categories.map((c) => [c.key, new THREE.Color(c.color)]));
  const tmp = new THREE.Color();
  items.forEach((it, i) => {
    const c = centre.get(it.category) || new THREE.Vector3();
    // random point in a soft cluster around the centre
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const r = 0.5 + Math.pow(Math.random(), 0.6) * 1.9;
    const p = c.clone().add(d.multiplyScalar(r));
    pos.set([p.x, p.y, p.z], i * 3);
    const col0 = colorOf.get(it.category) || colorOf.get('other');
    base.set([col0.r, col0.g, col0.b], i * 3);
    col.set([col0.r, col0.g, col0.b], i * 3);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true, depthWrite: false }));
  root.add(points);

  // faint category labels as hollow rings at each centre
  categories.forEach((c) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 2.45, 64),
      new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
    );
    m.position.copy(centre.get(c.key));
    m.lookAt(new THREE.Vector3(0, 0, 0));
    root.add(m);
  });

  let filter = null; // category key or null
  let hits = null; // Set of item indices or null
  let drag = null;
  let spin = 0;
  let tilt = 0;
  let targetSpin = 0;
  let targetTilt = 0;
  let autoSpin = true;
  let running = false;
  let raf = 0;
  let last = performance.now();
  const ray = new THREE.Raycaster();
  ray.params.Points.threshold = 0.12;
  const mouse = new THREE.Vector2(9, 9);
  let hover = -1;

  function paint() {
    for (let i = 0; i < N; i++) {
      const it = items[i];
      const on = (!filter || it.category === filter) && (!hits || hits.has(i));
      const k = on ? 1 : 0.12;
      col[i * 3] = base[i * 3] * k;
      col[i * 3 + 1] = base[i * 3 + 1] * k;
      col[i * 3 + 2] = base[i * 3 + 2] * k;
    }
    geo.attributes.color.needsUpdate = true;
  }
  paint();

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

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    autoSpin = false;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    tipPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (drag) {
      targetSpin += (e.clientX - drag.x) * 0.006;
      targetTilt = Math.max(-1, Math.min(1, targetTilt + (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    }
  });
  let tipPos = { x: 0, y: 0 };
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', (e) => {
    // a click without much drag picks the hovered skill
    if (drag && hover >= 0) {
      const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
      if (moved < 4 && onPick) onPick(items[hover].name);
    }
    endDrag();
  });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { mouse.set(9, 9); hover = -1; if (tipEl) tipEl.style.display = 'none'; });

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (autoSpin) targetSpin += dt * 0.07;
    spin += (targetSpin - spin) * 0.08;
    tilt += (targetTilt - tilt) * 0.08;
    root.rotation.y = spin;
    root.rotation.x = tilt;

    // hover detection (raycast only every few frames to stay cheap)
    if (Math.floor(now / 80) !== Math.floor((now - 16) / 80)) {
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObject(points)[0];
      const idx = hit && hit.index !== undefined ? hit.index : -1;
      if (idx !== hover) {
        hover = idx;
        if (tipEl) {
          if (idx >= 0 && (!filter || items[idx].category === filter)) {
            tipEl.style.display = 'block';
            tipEl.textContent = items[idx].name;
            tipEl.style.left = `${Math.min(tipPos.x + 14, canvas.clientWidth - 200)}px`;
            tipEl.style.top = `${tipPos.y + 14}px`;
          } else {
            tipEl.style.display = 'none';
          }
        }
      }
    }

    renderer.render(scene, camera);
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
  const vis = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())));
  vis.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  return {
    start,
    stop,
    setCategory(key) { filter = key; paint(); },
    setHits(set) { hits = set; paint(); },
    dispose() { stop(); ro.disconnect(); vis.disconnect(); renderer.dispose(); },
  };
}
