# BenchPilot AI — candidate marketing command center
Internal operations application, integrated with the separate bench_engine PostgreSQL database.
## Features
- Candidate records, real job listings from Greenhouse public boards, manually entered JDs
- Transparent heuristic matching with work authorization screening flags
- Recruiter contact records (unverified until checked), opportunity stages and auditable activity
- Personalized, human-reviewed outreach drafts; NO automatic emailing or LinkedIn scraping
- Daily Vercel Cron (08:00 UTC) with CRON_SECRET authorization
## Required configuration
DATABASE_URL, APP_USER, APP_PASSWORD and CRON_SECRET are Vercel project env vars.
Optional OPENAI_API_KEY is reserved for future LLM features; not wired into the current matching engine.
## Security
Use HTTPS, rotate APP_PASSWORD, restrict access to internal users only. Basic auth is a starter access mechanism; migrate to SSO and per-user RBAC before team-wide rollout.
## Constraints
The first version performs deterministic relevance scoring, not interview-probability predictions. Recruiter emails are neither discovered nor validated automatically, and Gmail is not yet integrated for bidirectional conversations.