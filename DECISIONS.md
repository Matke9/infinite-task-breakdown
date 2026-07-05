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
