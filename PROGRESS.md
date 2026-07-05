# PROGRESS

Next up: T1.2

## Phase 0 — Bootstrap
- [x] T0.1 Repo created; plan.md, CLAUDE.md, PROGRESS.md, DECISIONS.md committed
- [x] T0.2 .gitignore (node_modules, dist, .env*, *.log — keep .env.example), README stub, directory skeleton per plan.md Part 5 → commit

## Phase 1 — Skeletons
- [x] T1.1 Backend init: deps + devDeps per plan Step 1.3, tsconfig, package scripts, minimal Express server with GET /api/health → runs locally → commit
- [ ] T1.2 Frontend init: Vite react-ts template, Tailwind via @tailwindcss/vite, deps per plan Step 1.4, scripts → dev server renders → commit
- [ ] T1.3 .env.example for both (per plan Step 1.5), dotenv loading, verify env read → commit

## Phase 2 — CI before features
- [ ] T2.1 .github/workflows/ci.yml per plan Step 2.1 → push → CI green (fix any lint/ts config noise now) → commit
- [ ] T2.2 Guide me through branch protection on main (require CI). From here on: feature branches + PRs.

## Phase 3 — DB & Auth
- [ ] T3.1 migrations/001_init.sql: 4 tables, uuid-ossp, ON DELETE CASCADE, indexes, unique email (plan Step 3.1) → commit
- [ ] T3.2 db/migrate.ts (ordered .sql runner + migrations table) and db/index.ts (Pool + query helper) → migrations run clean on local Postgres → commit
- [ ] T3.3 middleware/auth.ts (Bearer JWT → req.userId, 401 on fail) → commit
- [ ] T3.4 routes/auth.ts: signup (zod, bcrypt 10 rounds, JWT), login, /me → commit
- [ ] T3.5 Wire index.ts (cors, json, routes, error handler); curl-test all three endpoints → PR → merge

## Phase 4 — Project & Node CRUD
- [ ] T4.1 routes/projects.ts: GET list (updated_at DESC), POST create (project + root node, no AI yet) → commit
- [ ] T4.2 GET /:id (project + flat node array), PATCH, DELETE (FK cascade) — ownership checks everywhere → commit
- [ ] T4.3 routes/nodes.ts: POST, PATCH, DELETE; every mutation touches parent project updated_at → commit
- [ ] T4.4 curl end-to-end pass → PR → merge

## Phase 5 — AI Integration
- [ ] T5.1 ai/client.ts: callGemini(prompt, schema) with responseSchema JSON mode, zod validation, one retry on parse failure (plan Step 5.2) → commit
- [ ] T5.2 ai/prompts.ts: initial-breakdown + expand-node prompts from plan Step 5.3, each with 1–2 few-shot example outputs → commit
- [ ] T5.3 POST /api/projects now: create → root node → Gemini breakdown → insert children → return tree → commit
- [ ] T5.4 POST /api/nodes/:id/expand with max-depth 6 rejection (recursive CTE for depth) → commit
- [ ] T5.5 Rate limit middleware: 20 AI calls/user/hour, in-memory Map, clear 429 message → curl test → PR → merge

## Phase 6 — Frontend: Auth & Projects
- [ ] T6.1 Router (/, /login, /signup, /projects, /projects/:id) + ProtectedRoute → commit
- [ ] T6.2 store/auth.ts (token/user, localStorage persist) + api/client.ts (axios, auth header, logout-on-401) → commit
- [ ] T6.3 LoginPage + SignupPage with error display → works against local backend → commit
- [ ] T6.4 LandingPage (redirect if logged in) → commit
- [ ] T6.5 ProjectsPage: header/logout, card grid, hover edit/delete, empty state, floating + → commit
- [ ] T6.6 NewProjectModal: validation, 10–15s AI loading state, error-in-modal, navigate on success → PR → merge

## Phase 7 — Tree View (the main event)
- [ ] T7.1 ProjectDetailPage layout (top bar, 70/30 split) + fetch + flat→nested tree builder util → commit
- [ ] T7.2 utils/completion.ts computeCompletion (leaf/weighted-parent) + quick sanity tests → commit
- [ ] T7.3 react-d3-tree render, custom node: title, color-coded %, complete checkbox, collapse toggle, + and ✨ buttons, click-to-select → commit
- [ ] T7.4 NodeDetailPanel: editable fields, weight slider, debounced autosave → commit
- [ ] T7.5 Collapse/expand via Set of collapsed IDs, prune before passing to d3-tree → commit
- [ ] T7.6 Add node (optimistic + rollback); delete node (confirm modal when has children) → commit
- [ ] T7.7 AI expand: loading state on node, append + animate children → commit
- [ ] T7.8 Toast system (Zustand store + <Toaster/>) wired to AI/save/rate-limit errors → PR → merge

## Phase 8 — Polish
- [ ] T8.1 Depth-limit UX: disabled ✨ + tooltip at depth 6 → commit
- [ ] T8.2 Loading skeletons (project list, tree); empty/error state sweep → commit
- [ ] T8.3 Malformed/empty AI response handling; "Regenerate breakdown" on root → commit
- [ ] T8.4 Mobile fallback: nested indented list at narrow widths → PR → merge

## Phase 9 — Deploy (do ONLY the chosen path from DECISIONS.md 001)
### Path A — DigitalOcean droplet
- [ ] T9A.1 Create droplet (Ubuntu 24.04, $6 1GB + swapfile, or $12 2GB), SSH in, install Node 20 / Postgres / Caddy / pm2; ufw allow 22,80,443
- [ ] T9A.2 Create taskdb + taskuser; clone repo; production .env (openssl rand -hex 32 for JWT); build, migrate, pm2 start + startup
- [ ] T9A.3 DNS (freedns subdomain → droplet IP); Caddyfile per plan Step 9.10; HTTPS live end-to-end
### Path B — CF Pages + Render + Neon
- [ ] T9B.1 Neon project; pooled connection string with sslmode=require; pg Pool updated; migrations run at server startup before listen(); verify against Neon locally
- [ ] T9B.2 Render free web service: root backend, build `npm ci && npm run build`, start `node dist/index.js`, env vars set, auto-deploy OFF, /api/health returns 200 live
- [ ] T9B.3 CF Pages: build with prod VITE_API_URL, _redirects SPA fallback, deploy; backend CORS allowlist env; full signup→AI→tree smoke test live (note the cold start)

## Phase 10 — CD
### Path A
- [ ] T10A.1 Dedicated CI SSH keypair; GitHub secrets (VM_HOST/USER/SSH_KEY/VITE_API_URL); cd.yml per plan Step 10.3; sudoers NOPASSWD lines
- [ ] T10A.2 Push to main → watch → fix → green; verify live site updated; final branch-protection check
### Path B
- [ ] T10B.1 cd.yml on push to main: typecheck+lint both, build frontend with secret VITE_API_URL, `wrangler pages deploy frontend/dist` (CLOUDFLARE_API_TOKEN + ACCOUNT_ID secrets), then curl Render deploy hook (secret) — deploys only run if checks pass
- [ ] T10B.2 Push to main → watch → fix → green; verify both live; optional: UptimeRobot ping /api/health every 10 min to dodge cold starts (~744h/mo fits the 750h free cap for one service)

## Done = README with architecture overview + screenshots + "decisions I made and why" section (pull from DECISIONS.md — that's your interview cheat sheet)
