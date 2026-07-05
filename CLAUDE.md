# CLAUDE.md — Recursive Task Breakdown App (portfolio project)

## Project snapshot
AI-powered recursive task breakdown web app. Users create a project, Gemini breaks it into weighted subtasks, each subtask can be recursively expanded into a tree. Completion % rolls up the tree client-side.

- **Frontend:** React + Vite + TypeScript, Tailwind, Zustand, react-d3-tree, axios, react-router-dom
- **Backend:** Node + Express + TypeScript, pg, zod, bcrypt, jsonwebtoken
- **DB:** PostgreSQL · **AI:** Gemini 2.0 Flash (free tier, structured JSON output)
- **CI/CD:** GitHub Actions

## Files that drive the work
- `plan.md` — the full spec (stack, data model, API, prompts, build phases). Read **only the part relevant to the current task**, not the whole file.
- `PROGRESS.md` — the task checklist. Single source of truth for what is done and what is next. **Update it and commit before ending every task.**
- `DECISIONS.md` — log of every deviation from plan.md, with rationale.

## ⚠️ Hosting change (supersedes plan.md Phase 9–10)
Oracle Cloud is **out** — no VM capacity. Expected load is tiny (1–10 users). Two paths, decision recorded in `DECISIONS.md` entry 001:

- **Path A — DigitalOcean droplet via GitHub Student Pack** ($200 credit, valid 12 months, new-account only). Keeps plan.md's VM deployment (Caddy + pm2 + Postgres on the box, SSH-based CD) almost verbatim; use `ufw` instead of Oracle's iptables steps. Best DevOps/interview story; costs real money (~$6/mo) after credit year ends.
- **Path B — free-forever PaaS:** frontend on Cloudflare Pages, backend on Render free web service, DB on Neon free Postgres. $0 indefinitely, but Render free spins down after 15 min idle (30–60 s cold start) and Neon caps at 0.5 GB. Do **not** use Render's free Postgres — it is deleted after 30 days.

Phases 1–8 are identical either way. Path-specific notes:
- **Neon (Path B):** use the pooled connection string, `sslmode=require`; run migrations at server startup before `listen()` (no SSH access to run them manually).
- **Render (Path B):** root dir `backend`, build `npm ci && npm run build`, start `node dist/index.js`, health endpoint `GET /api/health`. Turn **off** Render auto-deploy; CD is triggered from GitHub Actions via deploy hook after checks pass ("CI gates CD" — interview talking point).
- **Cloudflare Pages (Path B):** deploy `frontend/dist` with wrangler from Actions; add `_redirects` (`/* /index.html 200`) for SPA routing; CORS allowlist via env var on the backend.

## How to work with Matke (IMPORTANT — read carefully)

### Learning mode
This project is also a learning exercise. Matke wants to understand every decision, not just watch code appear.
- **At the start of each task:** explain the approach in 2–4 sentences, then ask exactly **one** short question — either a comprehension check ("why do we hash with bcrypt instead of sha256?") or a design-tradeoff question ("should the depth limit live in the route or the middleware — what do you think, and why?"). Wait for the answer before writing code.
- If the answer shows a gap, explain briefly (max ~5 sentences) and move on. No lectures.
- **At the end of each phase:** ask Matke to explain one key piece back in their own words (e.g., after auth: "walk me through what happens between the login POST and the /projects page loading").
- Keep all of this cheap. One question, short follow-ups, then code.

### Plan deviations
- `plan.md` is the agreed plan. **Never silently deviate from it.**
- If Matke suggests something that contradicts the plan: first explain *why the plan chose its approach* and what the suggestion would trade off. Push back with reasons, not compliance.
- If Matke gives a solid reason, discuss it, agree on the change, add an entry to `DECISIONS.md`, then implement.
- If the reason is weak, recommend sticking with the plan — Matke has final say, but say clearly what you'd do and why.
- Same rule applies to you: if you think the plan is wrong somewhere, raise it and log it; don't just code around it.

### Task & session discipline (usage limits are real)
Matke is on Claude Pro and may run out of usage mid-session. The repo must always be left in a resumable state.
- Work in the small tasks defined in `PROGRESS.md`. One task at a time.
- **Definition of done for every task:** typecheck + lint pass · app still runs · changes committed with a clear message · `PROGRESS.md` checkbox ticked · one-line "Next up:" note updated at the top of `PROGRESS.md`.
- If a task grows beyond expectation, split it: commit the working part first, add the remainder as a new task.
- Never end a turn with the repo in a broken, uncommitted state if avoidable.
- At session start: read `PROGRESS.md`, confirm the next task with Matke, go.

## Token discipline
- Don't re-read files already seen this session; don't read plan.md in full — target the relevant Part.
- Edit files surgically; don't regenerate whole files for small changes.
- Keep responses concise. No recaps of previous work, no restating the plan.
- At phase boundaries, suggest Matke run `/clear` — PROGRESS.md carries the state, context history doesn't need to.

## Commands
```
backend:   npm run dev | build | start | lint | typecheck    (migrations: node dist/db/migrate.js)
frontend:  npm run dev | build | lint | typecheck
```

## Code conventions
- Feature branches + PRs into `main`; CI must be green before merge.
- zod validation on every request body; ownership check (`user_id === req.userId`) on every query touching projects/nodes.
- Completion % is computed client-side, never stored (see plan.md Part 3).
- Secrets only in `.env` (never committed); `.env.example` kept current.
- Conventional-ish commits: `feat:`, `fix:`, `chore:`, `ci:` — small and frequent.
