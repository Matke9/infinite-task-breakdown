# Detailed Plan: Recursive Task Breakdown Web App (v2)

## Part 1: Final Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, react-d3-tree, Zustand, axios, react-router-dom
- **Backend:** Node.js + Express + TypeScript, pg (node-postgres), bcrypt, jsonwebtoken, zod
- **Database:** PostgreSQL (self-hosted on the Oracle VM)
- **AI:** Google Gemini free tier (`gemini-2.0-flash`) with structured JSON output
- **Hosting:** Oracle Cloud Free Tier ARM Ampere VM (Ubuntu 22.04)
- **Reverse proxy + HTTPS:** Caddy (auto Let's Encrypt)
- **Process manager:** pm2
- **Domain:** freedns.afraid.org subdomain
- **CI/CD:** GitHub Actions (CI on every push, CD on push to `main`)

## Part 2: Missing Features You Forgot

Adding these to the spec:

1. Login / Signup / Logout pages
2. Landing page for logged-out users
3. Edit and delete project buttons on project cards
4. Mark node as complete checkbox (drives the percentage)
5. Loading states during AI generation (5-15 seconds)
6. Error states when AI fails or returns malformed JSON
7. Confirmation modals for destructive actions
8. Back button on tree view to return to project list
9. Node detail panel (clicking a tree node opens it for editing)
10. Empty states ("No projects yet")
11. Rate limiting on AI endpoints to protect Gemini free quota
12. Input validation everywhere (zod on backend, light client-side checks)
13. Max tree depth limit to prevent runaway AI generation
14. Toast notifications for errors and successes

## Part 3: Data Model

```
User
  id (uuid)
  email (unique)
  password_hash
  created_at

Project
  id (uuid)
  user_id (fk)
  title
  description
  created_at
  updated_at
  root_node_id (fk to TaskNode, nullable until root created)

TaskNode
  id (uuid)
  project_id (fk)
  parent_id (fk to TaskNode, nullable for root)
  title
  description
  weight (float, default 1.0)
  is_complete (bool, default false)
  is_collapsed (bool, default false)
  position (int, sibling ordering)
  created_at
  updated_at
```

**Completion calculation rule:**
- Leaf node: `completion = is_complete ? 1.0 : 0.0`
- Parent node: `completion = sum(child.completion * child.weight) / sum(child.weight)`
- Computed client-side after fetching, never stored

## Part 4: API Endpoints

```
POST   /api/auth/signup        { email, password } → { token, user }
POST   /api/auth/login         { email, password } → { token, user }
GET    /api/auth/me            → { user }

GET    /api/projects           → [{ project, completion% }]
POST   /api/projects           { title, description } → { project, tree }
                                (also triggers initial AI breakdown)
GET    /api/projects/:id       → { project, tree }
PATCH  /api/projects/:id       { title?, description? }
DELETE /api/projects/:id

POST   /api/nodes              { project_id, parent_id, title, description?, weight? }
PATCH  /api/nodes/:id          { title?, description?, weight?, is_complete? }
DELETE /api/nodes/:id          (cascade deletes children)

POST   /api/nodes/:id/expand   → AI generates subtasks for this node
```

## Part 5: Repository Structure

```
task-breakdown/
  .github/
    workflows/
      ci.yml
      cd.yml
  backend/
    src/
      ai/
      db/
      routes/
      middleware/
      index.ts
    migrations/
    package.json
    tsconfig.json
    .eslintrc.json
  frontend/
    src/
      components/
      pages/
      store/
      api/
      utils/
      App.tsx
      main.tsx
    package.json
    tsconfig.json
    .eslintrc.json
  .gitignore
  README.md
```

## Part 6: Step-by-Step Build Plan

### Phase 1: Project Skeleton & Git Setup (Day 1)

**Step 1.1** — Create the repository on GitHub (private is fine; Actions still free for student accounts). Clone locally.

**Step 1.2** — Create the directory structure above. Add `.gitignore` covering `node_modules/`, `dist/`, `.env`, `.env.*`, `*.log`.

**Step 1.3** — Backend init:

```bash
cd backend
npm init -y
npm i express cors bcrypt jsonwebtoken pg dotenv zod
npm i -D typescript @types/node @types/express @types/bcrypt @types/jsonwebtoken @types/pg @types/cors tsx eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npx tsc --init
```

In `backend/package.json` scripts:
```json
"dev": "tsx watch src/index.ts",
"build": "tsc",
"start": "node dist/index.js",
"lint": "eslint src",
"typecheck": "tsc --noEmit"
```

**Step 1.4** — Frontend init:

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm i axios react-router-dom react-d3-tree zustand
npm i -D tailwindcss @tailwindcss/vite eslint
```

Set up Tailwind per their Vite guide. Add scripts:
```json
"lint": "eslint src",
"typecheck": "tsc --noEmit"
```

**Step 1.5** — Create `.env.example` files (committed) and `.env` files (not committed):

Backend `.env`:
```
DATABASE_URL=postgresql://taskuser:password@localhost:5432/taskdb
JWT_SECRET=replace_with_long_random_string
GEMINI_API_KEY=your_gemini_key
PORT=3001
NODE_ENV=development
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:3001
```

**Step 1.6** — First commit, push to GitHub. Verify the repo shows up correctly.

### Phase 2: CI Setup First (Day 1) — Before Writing Real Code

Setting up CI before writing real code means it catches problems from the very first feature, not after you've already accumulated a mess.

**Step 2.1** — Create `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Install backend deps
        run: cd backend && npm ci

      - name: Install frontend deps
        run: cd frontend && npm ci

      - name: Type-check backend
        run: cd backend && npm run typecheck

      - name: Type-check frontend
        run: cd frontend && npm run typecheck

      - name: Lint backend
        run: cd backend && npm run lint

      - name: Lint frontend
        run: cd frontend && npm run lint
```

**Step 2.2** — Push and verify CI runs green on a near-empty project. If it fails, fix lint/tsconfig issues now while there's nothing to lint.

**Step 2.3** — In GitHub repo settings → Branches → Add rule for `main`:
- Require status checks to pass before merging
- Select the CI check

From now on, work on feature branches and merge via PR. This is the workflow recruiters expect to see in commit history.

### Phase 3: Database & Auth (Day 2)

**Step 3.1** — Write `backend/migrations/001_init.sql` with the four tables. Include:
- `uuid_generate_v4()` defaults (enable `uuid-ossp` extension first)
- Foreign keys with `ON DELETE CASCADE` on `task_nodes.parent_id` and `task_nodes.project_id`
- Indexes on `projects.user_id`, `task_nodes.project_id`, `task_nodes.parent_id`
- Unique index on `users.email`

**Step 3.2** — Write `backend/src/db/migrate.ts`: reads .sql files in order, runs them, tracks applied migrations in a `migrations` table.

**Step 3.3** — Create `backend/src/db/index.ts` exporting a configured `pg.Pool` and a `query()` helper.

**Step 3.4** — Build auth routes in `backend/src/routes/auth.ts`:
- `POST /api/auth/signup`: zod-validate email + password (min 8 chars), check uniqueness, bcrypt hash (10 rounds), insert, return JWT
- `POST /api/auth/login`: lookup, bcrypt compare, return JWT
- `GET /api/auth/me`: protected, returns user from token

**Step 3.5** — Write `backend/src/middleware/auth.ts`: reads `Authorization: Bearer <token>`, verifies JWT, attaches `req.userId`, returns 401 on failure.

**Step 3.6** — Wire everything in `backend/src/index.ts`: cors, json body parser, route mounting, error handler.

**Step 3.7** — Test with curl. Commit, open PR, merge after CI passes.

### Phase 4: Project CRUD (Day 2-3)

**Step 4.1** — Implement routes in `backend/src/routes/projects.ts`. All routes use `authMiddleware` and verify `project.user_id === req.userId`.

**Step 4.2** — `GET /api/projects`: return projects for the logged-in user, ordered by `updated_at DESC`. Skip computing completion server-side; frontend handles it after fetching individual projects.

**Step 4.3** — `POST /api/projects`: for now, create project + a single root TaskNode using the title. AI integration comes next.

**Step 4.4** — `GET /api/projects/:id`: verify ownership, return project plus a flat array of all task_nodes belonging to it. Frontend nests them.

**Step 4.5** — `PATCH /api/projects/:id` and `DELETE /api/projects/:id` (cascades via FK).

**Step 4.6** — Implement `/api/nodes` routes (POST, PATCH, DELETE). On every node mutation, update the parent project's `updated_at`. Always verify the node's project belongs to `req.userId`.

**Step 4.7** — Commit, PR, merge.

### Phase 5: AI Integration (Day 3) — The Critical Part

**Step 5.1** — Get a free Gemini API key from Google AI Studio (no credit card). Add to `.env`.

**Step 5.2** — Create `backend/src/ai/client.ts` with a `callGemini(prompt, schema)` function:
- POSTs to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=...`
- Sets `generationConfig.responseMimeType: "application/json"` and `generationConfig.responseSchema` (Gemini supports structured output natively)
- Parses response, validates against zod schema
- On JSON parse failure, retry once with the same prompt
- Throws on second failure

**Step 5.3** — Write prompts in `backend/src/ai/prompts.ts`:

**Initial breakdown prompt:**
```
You are a task breakdown assistant. Given a project title and description,
break it into 3-7 high-level subtasks. Each should be a meaningful chunk
of work. Assign a weight (1-10) representing relative effort.

Return JSON: { "subtasks": [{ "title", "description", "weight" }] }

Project title: {title}
Project description: {description}
```

**Expand-node prompt:**
```
You are a task breakdown assistant. Given a task within a larger project,
break it into 2-6 smaller, more concrete subtasks. Make them comically
small — each should be a single concrete action that takes less than an
hour. Assign weights (1-10).

Return JSON: { "subtasks": [{ "title", "description", "weight" }] }

Project context: {project_title}
Parent task path: {breadcrumb, e.g. "Build app > Set up DB > Configure Postgres"}
Task to break down: {node_title}
Task description: {node_description}
```

**Step 5.4** — Modify `POST /api/projects` to: create project → create root node → call Gemini for initial breakdown → insert returned subtasks as children → return full tree.

**Step 5.5** — Implement `POST /api/nodes/:id/expand` using the expand prompt. Reject if node is at max depth (e.g., 6 levels) — query depth via recursive CTE or cache it on the node.

**Step 5.6** — Add rate limiting middleware: max 20 AI calls per user per hour using an in-memory `Map<userId, timestamps[]>`. Return 429 when exceeded with a clear error message.

**Step 5.7** — Test the full flow with curl. Commit, PR, merge.

### Phase 6: Frontend — Auth & Project List (Day 4)

**Step 6.1** — Set up React Router with routes: `/`, `/login`, `/signup`, `/projects`, `/projects/:id`. Create a `ProtectedRoute` wrapper that redirects to `/login` if no token.

**Step 6.2** — Zustand store `frontend/src/store/auth.ts` with `token`, `user`, `login()`, `logout()`. Persist token to `localStorage`, hydrate on mount.

**Step 6.3** — `frontend/src/api/client.ts`: axios instance with base URL from env, request interceptor attaching `Authorization`, response interceptor logging out on 401.

**Step 6.4** — Build `LoginPage` and `SignupPage`: simple forms, error display, redirect to `/projects` on success.

**Step 6.5** — Build `LandingPage` (route `/`): brief pitch, "Get Started" button to signup. Redirect to `/projects` if already logged in.

**Step 6.6** — Build `ProjectsPage`:
- Header with email and logout button
- Grid of project cards: title, truncated description, completion %, updated date
- Hover-revealed edit/delete buttons on each card
- Floating "+" button bottom-right opens `NewProjectModal`
- Empty state when no projects ("Click + to create your first project")

**Step 6.7** — Build `NewProjectModal`:
- Title input (required, max 200)
- Description textarea (required, max 5000) with helper "Describe the project or paste a rough plan"
- Submit shows spinner with "Breaking down your project... (this can take 10-15 seconds)"
- On success, navigate to `/projects/:id`
- On error, display in modal

**Step 6.8** — Commit, PR, merge.

### Phase 7: Frontend — Tree View (Day 5-6) — The Main Event

**Step 7.1** — `ProjectDetailPage` layout:
- Top bar: back button, project title (click to edit inline), overall completion bar, settings menu (rename, delete)
- Main area split: tree (70% left), detail panel (30% right)
- Detail panel empty until a node is selected

**Step 7.2** — Fetch tree on mount. Build nested structure from flat node list (recursive by `parent_id`).

**Step 7.3** — Pure function `computeCompletion(node)` in `frontend/src/utils/completion.ts`:
- Leaf: `is_complete ? 1 : 0`
- Parent: weighted average of children
- Memoize per render or compute once on data change

**Step 7.4** — Render tree with `react-d3-tree`. Custom node component shows:
- Title (truncated)
- Completion bar/percentage (color-coded: red < 33%, yellow < 66%, green ≥ 66%)
- Checkbox for `is_complete`
- Collapse/expand toggle if has children
- "+" mini button to add child manually
- "✨" mini button to AI-generate children (disabled at max depth)
- Click anywhere else → select node (populate detail panel)

**Step 7.5** — `NodeDetailPanel`:
- Title (editable)
- Description (editable textarea)
- Weight (slider 1-10)
- `is_complete` checkbox
- "Generate subtasks with AI" button
- "Add subtask manually" button
- "Delete this task" button (confirms if has children: "This deletes X subtasks. Continue?")
- Autosave with debounce on field changes

**Step 7.6** — Implement collapse/expand: store collapsed node IDs in a `Set` in component state. When passing tree to `react-d3-tree`, prune children of collapsed nodes.

**Step 7.7** — Implement add node: optimistic update, then API call, rollback on failure.

**Step 7.8** — Implement delete node: confirmation modal if has children, API call, remove from local tree.

**Step 7.9** — Implement AI expansion: button shows loading state, on success append new children to selected node and animate in.

**Step 7.10** — Add a global toast system (a simple Zustand store + a `<Toaster />` component) for AI errors, save errors, rate limit hits.

**Step 7.11** — Commit, PR, merge.

### Phase 8: Polish & Edge Cases (Day 7)

**Step 8.1** — Max tree depth check: disable AI button at depth limit, show tooltip explaining why.

**Step 8.2** — Loading skeletons for project list and tree view.

**Step 8.3** — Graceful handling when AI returns malformed/empty subtasks (toast error, don't create empty nodes).

**Step 8.4** — "Regenerate breakdown" option on root node for bad first attempts.

**Step 8.5** — Mobile fallback: at narrow widths, render tree as a nested indented list instead of `react-d3-tree`.

**Step 8.6** — Final commit, PR, merge.

### Phase 9: VM Setup & Initial Manual Deployment (Day 8)

The first deployment is manual so you understand the moving parts. The CD pipeline automates subsequent deployments.

**Step 9.1** — Provision Oracle Cloud Free Tier ARM Ampere VM (VM.Standard.A1.Flex, 4 OCPU / 24GB RAM, Ubuntu 22.04). Save the SSH private key.

**Step 9.2** — In Oracle Cloud's VCN security list, open ingress for ports 80 and 443.

**Step 9.3** — SSH in, then **also** open ports in the VM's iptables (Oracle's Ubuntu image blocks them by default — this trips up everyone):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

**Step 9.4** — Install dependencies:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql caddy git
sudo npm i -g pm2
```

**Step 9.5** — Configure PostgreSQL:

```bash
sudo -u postgres psql
CREATE DATABASE taskdb;
CREATE USER taskuser WITH ENCRYPTED PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE taskdb TO taskuser;
\q
```

**Step 9.6** — Set up freedns.afraid.org subdomain pointing to the VM's public IP. Wait for DNS propagation (a few minutes).

**Step 9.7** — Clone repo into `~/task-breakdown`. Create `backend/.env` with production values (real DB password, real JWT_SECRET — generate with `openssl rand -hex 32`, real GEMINI_API_KEY, `NODE_ENV=production`).

**Step 9.8** — Build and run migrations manually first time:

```bash
cd ~/task-breakdown/backend
npm ci
npm run build
node dist/db/migrate.js
pm2 start dist/index.js --name task-breakdown-api
pm2 save
pm2 startup   # follow the printed instructions to enable on boot
```

**Step 9.9** — Build the frontend with the production API URL:

```bash
cd ~/task-breakdown/frontend
echo "VITE_API_URL=https://yoursubdomain.mooo.com" > .env.production
npm ci
npm run build
sudo mkdir -p /var/www/frontend
sudo cp -r dist/* /var/www/frontend/
```

**Step 9.10** — Configure Caddy. Edit `/etc/caddy/Caddyfile`:

```
yoursubdomain.mooo.com {
  handle /api/* {
    reverse_proxy localhost:3001
  }
  handle {
    root * /var/www/frontend
    try_files {path} /index.html
    file_server
  }
}
```

```bash
sudo systemctl reload caddy
```

Caddy auto-provisions HTTPS via Let's Encrypt. Visit your URL — it should work.

### Phase 10: CD Pipeline (Day 8)

Now that manual deployment works, automate it.

**Step 10.1** — On your local machine, generate a dedicated SSH key pair just for CI (don't reuse your personal key):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/task-breakdown-ci -N ""
```

Append the **public** key to `~/.ssh/authorized_keys` on the VM. Keep the **private** key for the next step.

**Step 10.2** — In GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `VM_HOST` | your VM's public IP |
| `VM_USER` | `ubuntu` |
| `VM_SSH_KEY` | full contents of the private key file (including BEGIN/END lines) |
| `VITE_API_URL` | `https://yoursubdomain.mooo.com` |

**Step 10.3** — Create `.github/workflows/cd.yml`:

```yaml
name: CD

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Install & type-check backend
        run: |
          cd backend
          npm ci
          npm run typecheck
          npm run lint

      - name: Install & type-check frontend
        run: |
          cd frontend
          npm ci
          npm run typecheck
          npm run lint

      - name: Build frontend
        run: cd frontend && npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      - name: Copy frontend build to VM
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VM_HOST }}
          username: ${{ secrets.VM_USER }}
          key: ${{ secrets.VM_SSH_KEY }}
          source: "frontend/dist/*"
          target: "/tmp/frontend-build"
          strip_components: 2

      - name: Deploy on VM
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VM_HOST }}
          username: ${{ secrets.VM_USER }}
          key: ${{ secrets.VM_SSH_KEY }}
          script: |
            set -e
            sudo rm -rf /var/www/frontend/*
            sudo cp -r /tmp/frontend-build/* /var/www/frontend/
            rm -rf /tmp/frontend-build
            cd ~/task-breakdown
            git pull origin main
            cd backend
            npm ci --omit=dev
            npm run build
            node dist/db/migrate.js
            pm2 restart task-breakdown-api
```

**Step 10.4** — Allow the `ubuntu` user passwordless `sudo` for the specific commands the script runs (so it doesn't hang waiting for a password):

```bash
sudo visudo
# add this line:
ubuntu ALL=(ALL) NOPASSWD: /bin/rm, /bin/cp
```

**Step 10.5** — Push to `main`. Watch the Actions tab. First run will likely fail somewhere — read the logs, fix, push again. This iteration is normal.

**Step 10.6** — Verify the live site reflects new changes after a successful run.

**Step 10.7** — Optional but worth it: protect `main` branch in GitHub settings to require CI checks to pass before merging. Now broken code can never reach production.

## Part 7: Tips for Working with Copilot/Smaller Models

- Build one phase at a time, testing each before moving on.
- Give Copilot the data model + the specific endpoint or component spec you're on, not the whole plan.
- For the AI prompts (Phase 5), include 1-2 example outputs in the system prompt — few-shot examples drastically improve smaller-model JSON reliability.
- Commit after every working step.
- Keep the PR-per-feature workflow even when working alone. CI catches things before merge, and the commit history looks professional on a portfolio.

## Part 8: Stretch Features (After v1 Works)

- Drag-and-drop reordering of siblings
- Reparenting nodes (drag onto another)
- Export project as markdown checklist
- Keyboard shortcuts (j/k to navigate, space to toggle complete, e to expand)
- Estimated time per task, summed up the tree
- Read-only shareable project links

This version sets up CI before the first feature so it shapes the whole codebase, deploys manually once so you understand the system before automating it, and ends with a clean GitHub Actions pipeline that's worth talking about in interviews. Want me to write out any specific piece in more detail — the Gemini API call shape, the recursive tree builder, or the completion-calculation function?