# DECISIONS

Log of every deviation from `plan.md`, with rationale.

## 001 — Hosting: Oracle Cloud replaced (2026-07)
Oracle ARM capacity unavailable after hundreds of retry attempts; Oracle dropped entirely.
Options: (A) DigitalOcean droplet via GitHub Student Pack $200/12mo credit — preserves the
full VM deployment story from plan.md (Caddy, pm2, self-hosted Postgres, SSH-based CD);
(B) Cloudflare Pages + Render free tier + Neon free Postgres — $0 forever, but cold starts
and a thinner DevOps story. Render's own free Postgres rejected outright (deleted after 30 days).
Decision: **Path A — DigitalOcean droplet.** Rationale: the project's primary purpose is
an interview/portfolio narrative, and Path A preserves plan.md's full DevOps story
(self-hosted Postgres, Caddy auto-TLS, pm2 process supervision, ufw, SSH-based CD over
GitHub Actions) — concrete systems substance recruiters probe. The $200 Student Pack credit
covers ~12 months (~$6/mo droplet), i.e. free through the active job-hunting window. Path B's
Render cold start (30–60s on first hit) also degrades live demos, a real cost when a link is
clicked in an interview. Trade-offs accepted: real cost (~$6/mo) after the credit year, and
single-box uptime/patching ownership. Revisable until Phase 9 (nothing in Phases 1–8 depends
on this); Path B (CF Pages + Render free + Neon free, $0 forever) remains the fallback if
zero-maintenance/zero-cost is later prioritized over DevOps depth.
Note: Path A's Phase 9–10 steps that touch external accounts (droplet creation, SSH keys, DNS)
require Matke's hands on his own accounts; all code (Phases 1–8, Caddyfile, cd.yml) is authored here.

## 002 — Backend toolchain versions resolved newer than plan.md assumed (2026-07)
`plan.md` predates these releases and pins nothing, so `npm i` pulled current majors:
- **Express 5.2.x** (plan implicitly assumed Express 4). Kept it — Express 5 is stable/current.
  Consequence future tasks MUST respect: route wildcards changed (`/api/*` → named form like
  `/api/*splat`), and async errors now propagate to the error handler without manual `next(err)`.
  The Caddy `/api/*` matcher (Phase 9) is unaffected — that's Caddy config, not Express routing.
- **TypeScript 6.0.x** (plan assumed TS 5). TS 6 turned `moduleResolution: "node"` into a hard
  error; added `"ignoreDeprecations": "6.0"` to `backend/tsconfig.json` to keep `"node"` resolution
  exactly as specified rather than silently switching resolution modes.
- **ESLint pinned to 8.x** (deliberate, not resolved): plan.md names `.eslintrc.json` +
  `@typescript-eslint/parser`/`eslint-plugin`, which ESLint 9 ignores by default. Pinning 8.x
  honors the plan's named config. See 003 for the frontend's separate (ESLint 10 flat) setup.

## 003 — Frontend toolchain resolved newer than plan.md assumed (2026-07)
`npm create vite@latest` now scaffolds Vite 8 + React 19 + TypeScript 6, and the template's
default linter is **oxlint**, not ESLint.
- **Replaced oxlint with ESLint 10 (flat config, `eslint.config.js`).** plan.md Step 1.4 explicitly
  installs `eslint`, and the backend already uses ESLint — keeping "ESLint everywhere" is a cleaner
  interview story than introducing a third linter. Backend is ESLint 8 (classic `.eslintrc.json`,
  per plan), frontend is ESLint 10 (flat config, React-19 template) — separate `node_modules`, no
  conflict. The plugin shareable-configs (`react-hooks`/`react-refresh`) ship an old `plugins`-array
  shape ESLint 10 rejects, so the config registers those plugins as objects and sets their rules
  explicitly instead of spreading the broken shareable configs.
- **Tailwind v4 via `@tailwindcss/vite`** (plan-era Tailwind was v3). v4 is CSS-first: no
  `tailwind.config.js` / `postcss.config.js`; the entry CSS is just `@import "tailwindcss";` and
  theme customization (when needed later) is done in CSS via `@theme`, not a JS config file.
- **React 19 / TS 6 / Vite 8** all resolved to current majors; no code changes needed for the
  skeleton. `tsconfig.app.json` enables `verbatimModuleSyntax` + `erasableSyntaxOnly`, so all
  frontend code MUST use `import type { ... }` for type-only imports (enforced at build).
- **CI uses Node 22** (plan Step 2.1 said Node 20). Vite 8 and ESLint 10 require Node ≥20.19/22.x;
  Node 22 is current LTS and matches the version the lockfiles were generated with, so it's the
  safe floor. Bumped `.github/workflows/ci.yml` (and, later, cd.yml) to `node-version: 22`.
