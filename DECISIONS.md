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

## 006 — AI-integration design choices (Phase 5) (2026-07)
- **Call Gemini BEFORE writing to the DB** on project create (plan.md said create-then-call). The
  breakdown runs first; only if it succeeds do we open the transaction to insert project + root +
  children. Two wins: no DB transaction is held open across the ~2.5s AI HTTP call, and a failed AI
  call leaves **no orphan project** (the request 502s and nothing is written).
- **AiError → HTTP 502** via the central handler, so AI/transport failures are distinct from 400/404/500.
- **Depth limit via recursive CTE, root = depth 1, reject expand at depth ≥ 6** (`MAX_DEPTH`). The check
  runs BEFORE any Gemini call, so a too-deep expand costs zero quota and returns 422 instantly. Frontend
  T8.1 mirrors this by disabling the ✨ button at depth 6.
- **Rate limit: in-memory per-user sliding window**, `AI_RATE_LIMIT` (default 20)/hour, applied only to the
  two AI routes (project-create, node-expand) as route-level middleware after auth; non-AI routes are never
  limited. In-memory is fine at this scale (single instance); a multi-instance deploy would need shared state.
- **30s fetch timeout** (AbortSignal.timeout) on the Gemini call — without it a slow/stalled response hangs
  the request indefinitely; now it fails cleanly as an AiError→502.

## 005 — Gemini model: gemini-flash-latest, thinking disabled (2026-07)
plan.md pinned `gemini-2.0-flash`, but that model returns **429 (no free-tier quota)** on Matke's
key/project, while `gemini-flash-latest` works (it currently resolves to gemini-3.5-flash). Switched
the client's model. flash-latest is a *thinking* model — a trivial prompt burned ~207 reasoning
tokens — which wastes the free-tier quota and adds latency, so we set
`generationConfig.thinkingConfig.thinkingBudget = 0`. Verified: structured-JSON output still works,
0 thought-tokens, initial breakdown ~2.4s / expand ~2.7s. Auth uses the `?key=` query param (works
with the new `AQ.`-prefixed keys). If quota ever tightens, `gemini-flash-lite-latest` is the fallback.

## 004 — Error handling: typed errors + central handler (2026-07)
Not in plan.md, but a clean addition made during Phase 3–4. Routes throw typed errors and a single
Express error-handling middleware maps them to responses (`ZodError` → 400 with issue details,
`NotFoundError` → 404 `{error:'Not found'}`, else 500). Enabled by Express 5, which auto-forwards
rejected promises from async handlers to the error middleware — so route bodies stay try/catch-free.
`src/lib/errors.ts` holds the shared `NotFoundError` so both routers and the handler agree on the type.
Ownership rule: any project/node not owned by `req.userId` returns **404, not 403**, so the API never
leaks whether a resource exists to a non-owner.

## 008 — No completion % on project cards (2026-09-12)
plan.md Step 6.6 lists "completion %" on each ProjectsPage card, but completion is computed
client-side from a project's nodes (Part 3) and `GET /api/projects` returns projects only, no
nodes. Showing it on cards would need either one tree fetch per card (N requests on the list
page) or a server-side rollup (duplicating the weighted algorithm before Phase 7 even writes it).
Decision: **cards show title, description, updated date only; completion % lives on the detail
page.** Also considered and rejected: persisting per-node percentages and updating them on
completion. Every ancestor changes on any leaf toggle / add / delete / reweight, so stored values
must be resynced on every mutation and any miss shows stale numbers — while a full recompute is
one tree walk in the browser. If the tree view ever feels slow, memoize in React; don't persist.

