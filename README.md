# Recursive Task Breakdown

AI-powered recursive task breakdown web app. Create a project, let Gemini break it into
weighted subtasks, then recursively expand any subtask into a tree. Completion % rolls up
the tree, computed client-side.

## Stack
- **Frontend:** React + Vite + TypeScript, Tailwind, Zustand, react-d3-tree, axios, react-router-dom
- **Backend:** Node + Express + TypeScript, pg, zod, bcrypt, jsonwebtoken
- **Database:** PostgreSQL
- **AI:** Google Gemini 2.0 Flash (structured JSON output)
- **CI/CD:** GitHub Actions

## Structure
```
backend/    Express API (ai/, db/, routes/, middleware/), migrations
frontend/   React app (components/, pages/, store/, api/, utils/)
```

## Development
See `plan.md` for the full spec, `PROGRESS.md` for the task checklist, and `DECISIONS.md`
for the log of deviations from the plan and the reasoning behind them.

```bash
# backend
cd backend && npm run dev        # build | start | lint | typecheck

# frontend
cd frontend && npm run dev       # build | lint | typecheck
```

> Architecture overview, screenshots, and a "decisions I made and why" section land here
> once v1 is deployed.
