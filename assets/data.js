// Shared facts for the HYDRA site. Source: the live site's agents page and README.
// Keep numbers in sync with skills.json (total) and the repo.
export const AGENTS = [
  {
    id: 'recon', name: 'RECON', role: 'surface mapper', mode: 'subagent', temp: 0.1, color: '#00cc66',
    what: 'Fast, passive-first mapping. Exhausts free passive sources (certificate transparency, archives, passive DNS) before touching the target, tags CDN-shielded hosts, and stops when two phases add under 5% new assets.',
  },
  {
    id: 'hunter', name: 'HUNTER', role: 'exploitation lead', mode: 'primary', temp: 0.2, color: '#ff4444',
    what: 'Runs the scanning pipeline and probing cycles. Treats recon as 80% of the job. Saves every lead instantly with a hash and tags it UNVERIFIED for the Verifier.',
  },
  {
    id: 'verifier', name: 'VERIFIER', role: 'quality gate', mode: 'primary', temp: 0.1, color: '#ffaa00',
    what: 'Takes every finding and tries to destroy it: baseline vs exploit requests, three replays, response diffing, false-positive checks, then a CVSS score and a confidence percentage.',
  },
  {
    id: 'reporter', name: 'REPORTER', role: 'submission writer', mode: 'primary', temp: 0.1, color: '#00aaff',
    what: 'Turns verified findings into platform-ready reports: a clear title, an honest severity, working curl PoCs with truncated proof, CWE mapping, a CVSS vector and business-level impact.',
  },
  {
    id: 'plan', name: 'PLAN', role: 'strategist', mode: 'primary', temp: 0.3, color: '#00ff88',
    what: 'Researches the target before anyone sends a packet, then builds a P0–P3 attack plan with success criteria and pivot conditions defined up front.',
  },
  {
    id: 'auditor', name: 'AUDITOR', role: 'code reviewer', mode: 'primary', temp: 0.1, color: '#ff8800',
    what: 'When you have source instead of a URL: maps trust boundaries first, sweeps dangerous sinks, then goes deep on authorization, sessions, crypto misuse and mass assignment. Every finding needs file, line, reachable path and minimal proof.',
  },
  {
    id: 'debug', name: 'DEBUG', role: 'self-improvement engine', mode: 'primary', temp: 0.4, color: '#ff00ff',
    what: 'Sees across all agents. When something breaks downstream it diagnoses upstream, and every logged mistake must end in a concrete prevention rule.',
  },
];

export const STATS = { agents: 7, skills: 1179, playbooks: 27, scripts: 35, providers: 23, version: 'v0.3.0' };

export const REPO = 'https://github.com/sricharanenabothula704-star/hydra';
export const INSTALL = `git clone ${REPO}.git && cd hydra && bash setup.sh`;

// Verifier confidence bands (from the live agents page).
export function verdict(pct) {
  if (pct >= 80) return { label: 'VERIFIED', cls: 'ok', note: 'moves forward to the Reporter' };
  if (pct >= 50) return { label: 'PARTIAL', cls: 'warn', note: 'flagged for human review' };
  return { label: 'REJECTED', cls: 'bad', note: 'rejected with a written reason; the FP signature is logged' };
}
