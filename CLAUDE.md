# CLAUDE.md — Rapportverket

Internal tool for a Swedish besiktningsfirma: intake form → lead queue → report
editor → generate .docx → (manual or API) PDF → approve → email to client.

**Read [BRIEF.md](./BRIEF.md) before writing code — it is the spec and its
constraints are non-negotiable.** [PROGRESS.md](./PROGRESS.md) tracks phase
status; [PLAN.md](./PLAN.md) is the implementation plan for the remaining
phases. Update PROGRESS.md and commit it alongside every phase.

## Hard rules (violating these breaks the project)

1. **Stack is fixed** (BRIEF §1). Next.js 14 App Router + TS, Prisma + Neon,
   NextAuth credentials, docxtemplater + pizzip, **docxtemplater-image-module-free**
   (never the paid module), Resend, sharp. UI = Tailwind + shadcn/ui only.
2. **Never run prisma commands against Neon from this environment or from
   Hostinger SSH.** All `prisma db push` / seed runs happen on the user's LOCAL
   Windows machine. Give the user commands to run, **one per message**,
   PowerShell syntax. Never write `.env` via `>` redirect (UTF-16 breaks
   dotenv) — use `Set-Content -Encoding utf8`.
3. **PDF_PROVIDER=none is the default** (GDPR): report data must not leave the
   server in v1. No LibreOffice/system binaries on Hostinger — PDF conversion is
   API-based and optional.
4. **All UI text in Swedish. Mobile-first.**
5. **No features outside the brief.** Ambiguity → ask the user, don't guess.
6. **Nothing emails without lead status = GODKAND, enforced server-side.**
7. **Work on branch `claude/besiktning-app-build-tkcnnm`; PR #1 is the running
   PR** — push updates it, never open a new PR.
8. **After each phase:** `npm run build` + `npm run lint` must be clean, update
   PROGRESS.md, commit, push, give the user a 3-line summary, then STOP and
   wait for their "continue" before the next phase.

## Commands

- `npm run build` — prisma generate + next build (works without a DB)
- `npm run lint` — ESLint
- `npm run dev` — local dev (needs DATABASE_URL)
- `npm run db:push` / `npm run db:seed` — **user's local machine only**

## Architecture map

```
prisma/schema.prisma        All models (Lead, Report, Finding, Photo, …)
prisma/seed.ts              Admin from ADMIN_EMAIL/ADMIN_PASSWORD (idempotent)
src/lib/
  auth.ts                   NextAuth options (credentials + JWT role)
  api-auth.ts               requireSession() guard for route handlers
  prisma.ts                 Client singleton
  storage.ts                ./storage paths: reports/{id}/photos|generated
  images.ts                 sharp compress (1600px, JPEG q80)
  photos.ts                 storePhotos() — compress + save + Photo rows
  intake.ts                 zod intake schema, createLeadFromIntake, GHL mapper
  refnumber.ts              EK-YYYY-NNN sequence (collision retry)
  labels.ts                 Swedish labels + status badge colors
  report-data.ts            dataJson field types per report type
src/app/
  intake/                   Public form (honeypot, rate-limited)
  api/intake/               Multipart intake endpoint
  api/webhook/intake/       JSON + X-Webhook-Secret (GHL)
  api/reports/[reportId]/   PATCH autosave (lead + dataJson + relations)
  api/reports/[reportId]/photos/  POST upload, PATCH metadata
  api/photos/[id]/          GET stream (auth), DELETE
  dashboard/                Lead queue (filters, search, badges)
  dashboard/leads/[id]/     Tabbed editor (autosave via use-autosave.ts)
```

## Conventions & gotchas

- Editor rows (findings/contractors/qualityDocs) use **client-generated UUID
  primary keys**; the autosave PATCH upserts by id and deletes missing ids.
  Array order = sortOrder. Keep this pattern for new collections.
- Leads in GODKAND/SKICKAD/ARKIVERAD are **locked**: mutation APIs return 409.
- Photos live under `./storage` (NOT /public); they stream through
  `GET /api/photos/[id]` with a session check. Keep it that way (GDPR).
- File paths are stored **relative to cwd** (`toRelPath`) so deploys don't
  break; resolve with `absPath()`.
- Dates render as `YYYY-MM-DD`; currency as `35 000 kr` (space thousands).
- Middleware only guards `/dashboard` pages — every mutation route handler must
  call `requireSession()` itself.
- `next.config.js` marks sharp/docxtemplater/pizzip as
  `serverComponentsExternalPackages`; add new native/CJS server deps there.
- The build must keep working **without** a reachable database (Hostinger
  builds run `npm run build` with env vars but the DB may be unreachable at
  build time): never query the DB at module top-level or in static pages —
  dashboard pages use `force-dynamic`.
