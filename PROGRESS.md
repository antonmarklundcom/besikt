# PROGRESS — Rapportverket build

Tracks the §10 build-order phases from [BRIEF.md](./BRIEF.md). Updated and
committed after each phase.

Legend: ✅ done · 🚧 in progress · ⬜ pending

## Build-order phases (§10)

| # | Phase | Status |
|---|-------|--------|
| 1 | Prisma schema + Neon + NextAuth + seed admin | ✅ done |
| 2 | Intake form + webhook endpoint + lead queue dashboard | ⬜ pending |
| 3 | Lead editor (all tabs, autosave, fel-tabell CRUD, photo upload with sharp) | ⬜ pending |
| 4 | Templates + PLACEHOLDERS.md + docxtemplater generation + PDF adapter + preview | ⬜ pending |
| 5 | Approve flow + Resend email + EmailLog + versioning | ⬜ pending |
| 6 | Settings, GDPR delete, polish, README with deploy runbook | ⬜ pending |

## Phase notes

### Phase 1 — done
- Next.js 14 (App Router, TypeScript) scaffolded manually; Tailwind + shadcn/ui
  base components only (Button, Input, Label) — no other UI libraries per brief.
- Full Prisma schema for every §3 model + enum: `User`, `Inspector`, `Lead`,
  `Contractor`, `Report`, `Finding`, `Photo`, `QualityDoc`, `EmailLog`, plus a
  singleton `AppSettings` row (company block + default email templates).
- NextAuth credentials provider (bcrypt, JWT sessions, role carried in the
  token/session). Swedish `/login`, `/dashboard` guarded by middleware.
- Idempotent `prisma/seed.ts` upserts the admin from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` (never clobbers an existing password on re-seed) and ensures
  an Inspector profile + settings row.
- `.env.example` documents all §8 env vars. Build + lint clean.
- **DB not yet pushed/seeded** — awaiting the user to run `prisma db push` and
  `db:seed` locally against Neon (never over Hostinger SSH, per §9).

## Deviations from the brief

_None so far._ Additions that stay within scope:
- `AppSettings` singleton model added to hold the §4.4 company block, default
  email subject/body templates, and webhook-secret display. The brief lists
  these as settings-page fields without prescribing a table; a single-row model
  is the natural home and keeps them out of scattered env/config.
