// Scroll-driven pipeline: the camera flies a spline through RECON -> HUNTER -> VERIFIER -> REPORTER.
// app.js owns the scroll maths and DOM stop text; this module only renders and exposes setProgress/setActive.
import * as THREE from 'three';

const STAGES = [
  { color: 0x00cc66 }, // RECON
  { color: 0xff4444 }, // HUNTER
  { color: 0xffaa00 }, // VERIFIER
  { color: 0x00aaff }, // REPORTER
];

export function initPipe({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

  // spline through the four stage anchors (flows toward -z)
  const anchors = STAGES.map((_, i) => new THREE.Vector3(Math.sin(i * 1.3) * 1.8, Math.cos(i * 0.9) * 0.9, -i * 7));
  const curve = new THREE.CatmullRomCurve3(anchors);
  const stagePts = STAGES.map((_, i) => curve.getPointAt(i / (STAGES.length - 1)));

  // the path itself
  const pathGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(400));
  scene.add(new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: 0x2ee6a8, transparent: true, opacity: 0.25 })));

  // stage gates: a torus ring + wireframe core each
  const stages = STAGES.map((s, i) => {
    const g = new THREE.Group();
    g.position.copy(stagePts[i]);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.02, 8, 120),
      new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.45 })
    );
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshBasicMaterial({ color: s.color, wireframe: true, transparent: true, opacity: 0.85 })
    );
    g.add(ring, core);
    scene.add(g);
    return { g, ring, core, color: s.color, scale: 1, target: 1 };
  });

  // packets flowing along the path
  const N = 160;
  const pk = new Float32Array(N * 3);
  const phase = Array.from({ length: N }, () => Math.random());
  const pkGeo = new THREE.BufferGeometry();
  pkGeo.setAttribute('position', new THREE.BufferAttribute(pk, 3));
  const packets = new THREE.Points(
    pkGeo,
    new THREE.PointsMaterial({ color: 0x38f0ff, size: 0.04, transparent: true, opacity: 0.85, depthWrite: false })
  );
  scene.add(packets);

  let camT = 0;
  let camTarget = 0;
  let active = 0;
  let running = false;
  let raf = 0;
  let last = performance.now();
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();

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

    camT += (camTarget - camT) * 0.08;
    curve.getPointAt(camT, tmp);
    camPos.copy(tmp).add(new THREE.Vector3(0, 0.4, 4.6));
    curve.getPointAt(Math.min(camT + 0.02, 1), look);
    camera.position.copy(camPos);
    camera.lookAt(look);

    stages.forEach((s, i) => {
      s.target = i === active ? 1.1 : 1;
      s.scale += (s.target - s.scale) * 0.1;
      s.g.scale.setScalar(s.scale);
      s.core.rotation.y = t * 0.6 + i;
      s.core.rotation.x = t * 0.3;
    });

    // packets
    for (let i = 0; i < N; i++) {
      phase[i] = (phase[i] + dt * 0.07) % 1;
      curve.getPointAt(phase[i], tmp);
      pk[i * 3] = tmp.x + Math.sin(t * 3 + i) * 0.12;
      pk[i * 3 + 1] = tmp.y + Math.cos(t * 2.4 + i) * 0.12;
      pk[i * 3 + 2] = tmp.z;
    }
    pkGeo.attributes.position.needsUpdate = true;

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
    // p: 0..1 over the whole pinned section; stops sit at the centre of each quarter
    setProgress(p) {
      camTarget = Math.min(1, Math.max(0, (p - 0.125) / 0.75));
    },
    setActive(i) {
      active = i;
    },
    dispose() { stop(); ro.disconnect(); vis.disconnect(); renderer.dispose(); },
  };
}
