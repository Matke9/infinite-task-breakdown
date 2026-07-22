# PROGRESS

Next up: Matke sets up Neon + Render + Cloudflare accounts, adds GitHub secrets, then we do a live Path B smoke test (T9B/T10B). HOSTING = Path B (DECISIONS 009, supersedes 001 — DO credit expires 2026-07-31). Frontend feature-complete (Phases 6–8). Code-side Path B wiring DONE (SSL, migrate-on-startup, CORS allowlist, _redirects, cd.yml). 007 = leave it (final). Vitest in CI (008). Still TODO: open PR for this branch; README with screenshots.

## Phase 0 — Bootstrap
- [x] T0.1 Repo created; plan.md, CLAUDE.md, PROGRESS.md, DECISIONS.md committed
- [x] T0.2 .gitignore (node_modules, dist, .env*, *.log — keep .env.example), README stub, directory skeleton per plan.md Part 5 → commit

## Phase 1 — Skeletons
- [x] T1.1 Backend init: deps + devDeps per plan Step 1.3, tsconfig, package scripts, minimal Express server with GET /api/health → runs locally → commit
- [x] T1.2 Frontend init: Vite react-ts template, Tailwind via @tailwindcss/vite, deps per plan Step 1.4, scripts → dev server renders → commit
- [x] T1.3 .env.example for both (per plan Step 1.5), dotenv loading, verify env read → commit

## Phase 2 — CI before features
- [x] T2.1 .github/workflows/ci.yml per plan Step 2.1 → push → CI green (fix any lint/ts config noise now) → commit
- [x] T2.2 Guide me through branch protection on main (require CI). From here on: feature branches + PRs.

## Phase 3 — DB & Auth
- [x] T3.1 migrations/001_init.sql: 4 tables, uuid-ossp, ON DELETE CASCADE, indexes, unique email (plan Step 3.1) → commit
- [x] T3.2 db/migrate.ts (ordered .sql runner + migrations table) and db/index.ts (Pool + query helper) → migrations run clean on local Postgres → commit
- [x] T3.3 middleware/auth.ts (Bearer JWT → req.userId, 401 on fail) → commit
- [x] T3.4 routes/auth.ts: signup (zod, bcrypt 10 rounds, JWT), login, /me → commit
- [x] T3.5 Wire index.ts (cors, json, routes, error handler); curl-test all three endpoints → PR → merge

## Phase 4 — Project & Node CRUD
- [x] T4.1 routes/projects.ts: GET list (updated_at DESC), POST create (project + root node, no AI yet) → commit
- [x] T4.2 GET /:id (project + flat node array), PATCH, DELETE (FK cascade) — ownership checks everywhere → commit
- [x] T4.3 routes/nodes.ts: POST, PATCH, DELETE; every mutation touches parent project updated_at → commit
- [x] T4.4 curl end-to-end pass → PR → merge

## Phase 5 — AI Integration
- [x] T5.1 ai/client.ts: callGemini(prompt, schema) with responseSchema JSON mode, zod validation, one retry on parse failure (plan Step 5.2) → commit
- [x] T5.2 ai/prompts.ts: initial-breakdown + expand-node prompts from plan Step 5.3, each with 1–2 few-shot example outputs → commit
- [x] T5.3 POST /api/projects now: create → root node → Gemini breakdown → insert children → return tree → commit
- [x] T5.4 POST /api/nodes/:id/expand with max-depth 6 rejection (recursive CTE for depth) → commit
- [x] T5.5 Rate limit middleware: 20 AI calls/user/hour, in-memory Map, clear 429 message → curl test → PR → merge

## Phase 6 — Frontend: Auth & Projects
- [x] T6.1 Router (/, /login, /signup, /projects, /projects/:id) + ProtectedRoute → commit
- [x] T6.2 store/auth.ts (token/user, localStorage persist) + api/client.ts (axios, auth header, logout-on-401) + shared types.ts → commit
- [x] T6.3 LoginPage + SignupPage with error display → commit
- [x] T6.4 LandingPage (redirect if logged in) → commit
- [x] T6.5 ProjectsPage: header/logout, card grid, hover edit/delete, empty state, floating + → commit (completion % deferred — DECISIONS 007)
- [x] T6.6 NewProjectModal: validation, 10–15s AI loading state, error-in-modal, navigate on success → commit (+ reusable Modal, EditProjectModal)

## Phase 7 — Tree View (the main event)
- [x] T7.1 ProjectDetailPage layout (top bar, inline title edit, overall %, delete, 70/30 split) + fetch + flat→nested tree builder util → commit
- [x] T7.2 utils/completion.ts computeCompletion (leaf/weighted-parent) + Vitest tests (13, green) + utils/tree.ts (buildTree, computeDepthMap) + nodesApi → commit
- [x] T7.3 react-d3-tree render, custom node: title, color-coded %, complete checkbox, collapse toggle, + and ✨ buttons, click-to-select → commit (+/✨ handlers stubbed → T7.6/T7.7)
- [x] T7.4 NodeDetailPanel: editable fields, weight slider, debounced autosave (600ms + flush-on-switch) → commit
- [x] T7.5 Collapse/expand via Set of collapsed IDs, prune before passing to d3-tree → commit (init from is_collapsed)
- [x] T7.6 Add node (optimistic temp-node + rollback); delete node (confirm w/ descendant count, subtree removal) → commit
- [x] T7.7 AI expand: loading spinner on node/panel, append children, success/error toasts → commit
- [x] T7.8 Toast system (Zustand store + <Toaster/>) wired to AI/save/rate-limit errors → commit

## Phase 8 — Polish
- [x] T8.1 Depth-limit UX: disabled ✨ + tooltip at depth 6 (TreeNodeCard + NodeDetailPanel) → commit
- [x] T8.2 Loading skeletons (project list grid, tree pane) via Skeleton primitive → commit
- [x] T8.3 Empty-AI response guard (toast, no empty nodes) + "Regenerate breakdown" on root (delete children → re-run AI, server-resync) → commit
- [x] T8.4 Mobile fallback: nested indented list at narrow widths (useMediaQuery, NestedTaskList, stacked layout < lg) → commit
- [x] Phase 8 complete — frontend feature-complete. (Plan's "T8.6 PR → merge": open PR when Matke is ready; not auto-created.)

## Phase 9 — Deploy — CHOSEN: Path B (DECISIONS 009, supersedes 001). Skip Path A.
### Path A — DigitalOcean droplet
- [ ] T9A.1 Create droplet (Ubuntu 24.04, $6 1GB + swapfile, or $12 2GB), SSH in, install Node 20 / Postgres / Caddy / pm2; ufw allow 22,80,443
- [ ] T9A.2 Create taskdb + taskuser; clone repo; production .env (openssl rand -hex 32 for JWT); build, migrate, pm2 start + startup
- [ ] T9A.3 DNS (freedns subdomain → droplet IP); Caddyfile per plan Step 9.10; HTTPS live end-to-end
### Path B — CF Pages + Render + Neon
- [~] T9B.1 CODE DONE: pg Pool SSL via DATABASE_SSL; migrate-on-startup via RUN_MIGRATIONS_ON_START before listen(). MATKE: create Neon project, grab POOLED conn string (?sslmode=require), verify locally
- [~] T9B.2 CODE DONE: /api/health exists; env vars documented in .env.example. MATKE: create Render service (root=backend, build `npm ci && npm run build`, start `node dist/index.js`), set env vars, auto-deploy OFF
- [~] T9B.3 CODE DONE: _redirects SPA fallback; CORS allowlist via CORS_ORIGIN env. MATKE: create CF Pages project, set secrets, full signup→AI→tree smoke test live (note cold start)

## Phase 10 — CD
### Path A
- [ ] T10A.1 Dedicated CI SSH keypair; GitHub secrets (VM_HOST/USER/SSH_KEY/VITE_API_URL); cd.yml per plan Step 10.3; sudoers NOPASSWD lines
- [ ] T10A.2 Push to main → watch → fix → green; verify live site updated; final branch-protection check
### Path B
- [x] T10B.1 CODE DONE: .github/workflows/cd.yml — checks gate deploy, build frontend w/ VITE_API_URL, wrangler pages deploy, curl Render deploy hook. MATKE: add repo secrets (VITE_API_URL, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, RENDER_DEPLOY_HOOK_URL), set CF Pages --project-name
- [ ] T10B.2 Push to main → watch → fix → green; verify both live; UptimeRobot ping /api/health every ~10 min to dodge cold starts (Matke opted in — DECISIONS 009)

## Done = README with architecture overview + screenshots + "decisions I made and why" section (pull from DECISIONS.md — that's your interview cheat sheet)
