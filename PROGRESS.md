# PROGRESS — Rapportverket build

Tracks the §10 build-order phases from [BRIEF.md](./BRIEF.md). Updated and
committed after each phase.

Legend: ✅ done · 🚧 in progress · ⬜ pending

## Build-order phases (§10)

| # | Phase | Status |
|---|-------|--------|
| 1 | Prisma schema + Neon + NextAuth + seed admin | ✅ done |
| 2 | Intake form + webhook endpoint + lead queue dashboard | ✅ done |
| 3 | Lead editor (all tabs, autosave, fel-tabell CRUD, photo upload with sharp) | ✅ done |
| 4 | Templates + PLACEHOLDERS.md + docxtemplater generation + PDF adapter + preview | ✅ done |
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

### Phase 2 — done
- Public `/intake` form (mobile-first, Swedish): type select drives visibility
  (hantverkare block only for slutbesiktning), repeatable hantverkare rows,
  beställare + objekt fields, datum, notes, multi-photo upload with
  `capture="environment"`, and a hidden honeypot field.
- `POST /api/intake` (multipart): IP rate-limit + honeypot + zod validation →
  creates Lead (NY) + Report v1 shell + contractors, then compresses/stores
  photos via sharp (max 1600px, JPEG q80) under `storage/reports/{id}/photos/`.
- `POST /api/webhook/intake` (JSON, `X-Webhook-Secret`): shared create path via
  a single `mapGhlPayload` GHL field-mapping function (source = GHL).
- `/dashboard` lead queue: filter by status + type, debounced search
  (ref/name/beställare), sort by date, Swedish status badge colours; each row
  links to the (Phase 3) lead editor. Dashboard nav with logout + settings link.
- Supporting libs: `storage`, `images` (sharp), `rate-limit`, `refnumber`
  (`EK-YYYY-NNN`, per-year sequence with collision retry), `photos`, `labels`.

### Phase 3 — done
- `/dashboard/leads/[id]` editor: server loader hydrates the current (highest)
  report version; tabbed client editor (Parter · Innehåll · Fel-tabell · Bilder ·
  Dokumentation) with tabs shown per type (Fel-tabell hidden for skadeutredning,
  Dokumentation only for slutbesiktning).
- Debounced autosave (`useAutosave`, 800 ms, serialised, re-fires if state
  changed mid-flight) → single `PATCH /api/reports/[id]` that updates lead
  scalars + `dataJson` and syncs contractors/findings/qualityDocs. New rows use
  client-generated UUIDs as primary keys → server upserts with no reconciliation.
  First edit bumps status NY → PAGAENDE. Locked (GODKAND/SKICKAD/ARKIVERAD)
  reports return 409.
- Fel-tabell inline CRUD + up/down reorder; Nr auto-numbered; “Avhjälpt/sign”
  note that it stays blank in the generated doc. Innehåll renders type-specific
  fields incl. skadeutredning numbered sections + repeatable rekommendation
  groups. Dokumentation manages QualityDocs (slutbesiktning).
- Bilder tab: upload via `POST /api/reports/[id]/photos` (sharp compress → disk),
  per-photo caption/section/reorder with debounced `PATCH …/photos`, delete via
  `DELETE /api/photos/[id]` (unlinks file). Auth’d image streaming through
  `GET /api/photos/[id]` (photos stay outside /public for GDPR).

### Phase 4 — done
- Three starter templates (`templates/*.docx`) built programmatically by
  `scripts/build-templates.ts` (`npm run templates:build`) with the `docx` lib;
  committed so the user can restyle them in Word. Full contract documented in
  `templates/PLACEHOLDERS.md` (Swedish, incl. restyling rules, loop/table/image
  constraints, recovery command).
- `buildTemplateData` (src/lib/generation/template-data.ts) is the single
  source of truth for all tags; consumed by BOTH the docx renderer and the HTML
  preview so they cannot drift. Tags are ASCII snake_case (Word autocorrect
  mangles å/ä/ö in tags).
- `renderDocx` uses docxtemplater + pizzip + docxtemplater-image-module-free
  (free module only). Gotchas handled: image tags must be alone in a paragraph;
  the free module only accepts STRING tag values, so structured ImageValue
  objects are encoded to `path|w|h` at render time; missing image files fall
  back to a blank 1×1 PNG instead of failing generation; `nullGetter` returns
  "" so a user-removed tag never blocks generation.
- `POST /api/reports/[id]/generate` (allowed only in NY/PAGAENDE/GRANSKNING —
  after Godkänn files are a locked snapshot), writes
  `storage/reports/{id}/generated/{ref}_{typ}_{objekt-slug}_v{n}.docx`,
  clears stale pdfPath on regenerate, prunes renamed leftovers for the current
  version only. `GET /api/reports/[id]/files/docx|pdf` streams with auth.
- PDF adapter (`src/lib/pdf/`): `convertToPdf()` with `none` (default, throws
  PdfDisabledError) / `ilovepdf` / `cloudconvert` providers, plain fetch, no
  SDKs. When enabled, generate auto-converts; failure never loses the docx.
- Manual-PDF flow (PDF_PROVIDER=none): `POST/DELETE /api/reports/[id]/pdf`
  (magic-bytes validation, stored next to the docx; allowed incl. GODKAND since
  it doesn't alter the data snapshot). Lead page got a "Dokument" panel
  (generate/download/upload) + collapsible HTML preview.
- `npm run smoke:generate` renders all three templates from realistic fixtures
  (27 fel rows, photos, signature) without a database — verified: 28 table rows
  (header+27), images embedded, zero unresolved tags.

## Deviations from the brief

_None so far._ Additions that stay within scope:
- `AppSettings` singleton model added to hold the §4.4 company block, default
  email subject/body templates, and webhook-secret display. The brief lists
  these as settings-page fields without prescribing a table; a single-row model
  is the natural home and keeps them out of scattered env/config.
