# HYDRA site v2

A full-3D, interactive landing site for [HYDRA](https://github.com/sricharanenabothula704-star/hydra), built as plain HTML, CSS and JavaScript. No build step.

Pages: `index.html` (hero core, scroll pipeline, attack-surface simulation, terminal, verifier gate), `agents.html`, `skills.html` (constellation + search), `docs.html`, `security.html`, `roadmap.html`, `404.html`.

## Preview locally

3D modules and `skills.json` are fetched over HTTP, so open the folder through a server, not `file://`:

```bash
cd hydra-site-v2
python -m http.server 8000
# open http://localhost:8000
```

## How it stays fast and stable

- **3D is progressive.** Three.js (pinned `0.160.0`, loaded from unpkg) is imported only on pages with a scene, and only when WebGL is available and `prefers-reduced-motion` is not set. Each scene adds `.is-3d` after it starts; otherwise the static fallback shows. The page works without JS or WebGL.
- **Scenes pause when off-screen or in a hidden tab** (IntersectionObserver + `visibilitychange`).
- **Skills are data, not markup.** `assets/skills.json` (~260 KB) is fetched once. The list renders 48 cards at a time.
- **No external fonts or analytics.** System font stacks only.
- **Simulations stay simulated.** The terminal and the attack-surface globe never send requests. They use `example.*` names and show the scope gate in action.

## Files

| Path | Purpose |
|---|---|
| `assets/style.css` | All styles, responsive rules, reduced-motion overrides |
| `assets/app.js` | Entry point: boot, palette (⌘K), reveal, verifier gate, pipeline scroll, HUD, lazy scene loading |
| `assets/data.js` | Shared facts: agents, stats, verifier thresholds, install command |
| `assets/hero3d.js` | Hero core with seven orbiting agent nodes |
| `assets/pipe3d.js` | Scroll-driven camera through RECON → HUNTER → VERIFIER → REPORTER |
| `assets/map3d.js` | Attack-surface simulation (globe + scope gate) |
| `assets/constellation.js` | Skill point cloud, hover tooltip, category filtering |
| `assets/terminal.js` | Simulated console (history, tab-complete) and matrix rain |
| `assets/skills.js` | Skills page logic (search, chips, pagination) |
| `assets/skills.json` | Generated from HYDRA's `skills/index.json` |
| `scripts/build_skills_json.py` | Regenerates `skills.json` |

## Regenerating the skills index

```bash
python scripts/build_skills_json.py path/to/hydra/skills/index.json
```

The script checks that `total` matches the number of entries, then trims descriptions to 220 characters.

## Content rules

Keep numbers in sync with the HYDRA repo (7 agents, 1179 skills, 27 playbooks, 35 scripts, v0.3.0). Keep the safety notes: scope is enforced only by the CLI and loop runner, and the optional coordination server is unauthenticated as shipped. Do not add claims that the repo does not back up.

## License

Site content: © the author. HYDRA itself is MIT-licensed; see the HYDRA repository.
