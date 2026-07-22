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

## 007 — Project cards omit completion % for now (Phase 6, T6.5) (2026-07)
plan.md Step 6.6 lists a completion % on each project card. But `GET /api/projects` returns only the
project rows (`{ projects: [...] }`) — no task nodes — and completion is a client-side roll-up over the
node tree (Part 3), so it can't be computed on the list page without an N+1 fetch (one `GET
/api/projects/:id` per card). Decision: **cards show title, truncated description, and updated date; no
completion badge** in Phase 6. Completion computation lands in Phase 7 (T7.2 `utils/completion.ts`) on the
detail page where the full node array is already loaded. Cheap ways to restore it later if wanted:
(a) extend the list endpoint to return a stored/aggregated completion or a node count, or (b) add a
`GET /api/projects?include=completion` variant. **Resolved (Matke, 2026-07): leave it** — cards stay title/description/updated-date, no
completion badge. The % is visible on the detail page the moment a project is opened, and adding
it to the list wasn't worth an N+1 fetch or a backend aggregate for a 1–10 user app.

## 008 — Vitest added to the frontend for completion-logic unit tests (Phase 7, T7.2) (2026-07)
plan.md Step 7.3 asks for "quick sanity tests" on `computeCompletion`. The frontend had no test
runner, so added **Vitest** (Vite's native test tool — zero extra config, reuses the Vite pipeline)
as a devDependency + a `"test": "vitest run"` script. Tests live next to the code they cover
(`src/utils/completion.test.ts`, `src/utils/tree.test.ts`, 13 tests). Rationale: the weighted
completion roll-up is the app's core domain logic and the one piece worth locking down with tests.
Wired into CI as a `Test frontend` step (approved by Matke) so the tests gate merges alongside
typecheck + lint. Backend still has no tests (its logic is mostly thin CRUD + validated by curl in
Phases 3–5); revisit if backend logic grows.

## 008 — Vitest added to the frontend for domain-logic tests (Phase 7, T7.2) (2026-07)
plan.md Step 7.3/PROGRESS T7.2 call for "quick sanity tests" on `computeCompletion`. Added **Vitest 4.x**
(dev dependency) with a standalone `vitest.config.ts` (`{ test: { environment: 'node' } }`) and a
`"test": "vitest run"` script. Rationale: completion (the weighted roll-up over the node tree) is the app's
core domain logic and the one piece worth unit-testing; Vitest is the native Vite test runner (zero extra
build plumbing, shares the Vite transform). Config is kept in its own file so it stays out of `tsc -b`'s
project graph and doesn't touch the app build. Tests import `describe/it/expect` explicitly from 'vitest'
(no `globals: true`) to avoid changing tsconfig. 13 tests cover leaf/weighted-parent/3-level-rollup,
the divide-by-zero guard, `computeCompletionMap`, and `buildTree`/`computeDepthMap` (orphan-skip, sort,
depth convention). NOT yet wired into CI (`.github/workflows/ci.yml`) — deferred to avoid touching shared
CI mid-session; a `npm run test` step in the frontend CI job is a one-line follow-up.

## 009 — Hosting switched to Path B (free forever), superseding 001's Path A (2026-07)
DECISIONS 001 chose **Path A (DigitalOcean droplet)** on the basis of a $200 GitHub Student Pack
credit valid ~12 months — enough to run a ~$6/mo droplet free through the job hunt. That basis is
gone: **DigitalOcean is winding down its Student Pack participation and all such credits expire
2026-07-31** (confirmed via GitHub community + DO announcements). With ~9 days of credit left,
Path A now means paying ~$6/mo almost immediately for a marginally better DevOps story.
Decision: **switch to Path B — Cloudflare Pages (frontend) + Render free web service (backend) +
Neon free Postgres.** $0 indefinitely. Trade-off accepted: Render free spins down after 15 min
idle (~30–60s cold start on first hit); mitigated by an **uptime pinger** (Matke opted in — see
T10B.2: UptimeRobot hitting /api/health every ~10 min, ~744h/mo fits the 750h free cap for one
service). Neon's 0.5 GB cap is ample at 1–10 users. Path A remains documented in 001 as the
"if I later want the self-hosted DevOps story and will pay for it" fallback.

Account-independent Path B wiring done in code now (the rest needs Matke's own accounts):
- **Postgres TLS for Neon:** `backend/src/db/index.ts` enables `ssl: { rejectUnauthorized: false }`
  when `DATABASE_SSL=true`. rejectUnauthorized:false because Neon's pooled endpoint can present a
  chain node-postgres won't verify by default — traffic is still encrypted; we skip CA validation.
  Off by default so local Postgres (no TLS) is unaffected. Use the **pooled** Neon string with
  `?sslmode=require`.
- **Migrate-on-startup:** `backend/src/index.ts` runs `runMigrations()` before `app.listen()` when
  `RUN_MIGRATIONS_ON_START=true` (set on Render — no SSH to run them by hand). Startup exits non-zero
  if a migration fails. Local/dev keep running `node dist/db/migrate.js` manually (flag stays off).
- **CORS allowlist:** `backend/src/index.ts` reads a comma-separated `CORS_ORIGIN`; unset = reflect
  any origin (local dev), set to the Cloudflare Pages URL in production.
- `.env.example` updated with DATABASE_SSL / RUN_MIGRATIONS_ON_START / CORS_ORIGIN + a Neon URL note.
- Frontend `_redirects` (SPA fallback) + `.github/workflows/cd.yml` (Path B deploy) — see next commit.
