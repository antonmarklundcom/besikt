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
| 5 | Approve flow + Resend email + EmailLog + versioning | ✅ done |
| 6 | Settings, GDPR delete, polish, README with deploy runbook | ✅ done |

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

### Phase 5 — done
- `POST /api/reports/[id]/approve`: requires a generated docx, sets lead
  GODKAND + `approvedAt/approvedById`; the existing 409 guards now lock all
  editing. `POST …/reopen` undoes approval (GODKAND → GRANSKNING) **only while
  not sent** — after SKICKAD the snapshot stands and Ny version is the path.
- `POST /api/reports/[id]/send`: **server-side hard gate — refuses with 403
  unless lead.status === GODKAND** (§6, independent of UI). Validates
  recipients (zod), requires ≥1 attachment, streams the version's PDF and/or
  docx from disk, sends via Resend (`RESEND_API_KEY`/`MAIL_FROM`, 503 when
  unconfigured), writes an EmailLog row (SENT with providerId / FAILED), then
  sets report `sentAt`/`sentTo` and lead SKICKAD in one transaction.
- `POST /api/leads/[id]/new-version` (allowed in GODKAND/SKICKAD): clones
  dataJson + findings + qualityDocs, **copies photo files on disk** into the
  new report's dir (versions never share files, so GDPR-deleting one can't
  break another), resets generated/approved/sent fields, lead → PAGAENDE.
- Lead page: "Godkännande & utskick" panel (Godkänn with confirm; send form
  prefilled with beställare+hantverkare addresses and AppSettings
  subject/body templates with `{typ}/{objekt}/{företag}` filled; PDF/docx
  attachment checkboxes; Ångra godkännande; Ny version). Read-only list of
  previous versions with their still-downloadable files + full
  utskickshistorik table across versions. Editor now disables all fields
  (native `fieldset disabled`) with an explanatory banner when locked.

### Phase 6 — done
- `/dashboard/settings` (ADMIN-only, gated in the page **and** in every API):
  company block + default email templates (`PATCH /api/settings`, upserts the
  `AppSettings` singleton), inspector profiles CRUD (`POST /api/inspectors`,
  `PATCH`/`DELETE /api/inspectors/[id]`) incl. signature image upload
  (`POST`/`DELETE /api/inspectors/[id]/signature` — reuses the sharp pipeline,
  stored under `storage/inspectors/{id}/signature.jpg`; auth'd `GET` stream for
  the preview, kept outside /public like photos). Webhook secret shown
  read-only from `WEBHOOK_SECRET` with reveal/copy. New `requireAdmin()` guard
  in `api-auth.ts`.
- GDPR (§7) on the lead page: **Arkivera** (`POST /api/leads/[id]/archive` →
  status ARKIVERAD, keeps data) and **Radera** (`DELETE /api/leads/[id]` →
  `removeReportDir` for every version's files, deletes Report [cascades
  Finding/Photo/QualityDoc/EmailLog] + Contractor rows, **anonymises** the lead
  (clientName → "Raderad", nulls contact/property/notes, keeps
  refNumber+type+timestamps), status ARKIVERAD). Danger-styled panel with
  confirms; Radera redirects to the leadkö.
- README.md: Swedish deploy runbook — local PowerShell setup (one command per
  step, `Set-Content -Encoding utf8`), env var table, the **Hostinger
  IPv6/SSH-to-Neon warning in bold**, `NEXTAUTH_URL`-swap-then-redeploy step,
  retention/GDPR policy, PDF-provider switch instructions.
- Polish: dashboard already has an empty state + mobile card layout; added an
  app icon (`src/app/icon.svg`) so the browser tab has a favicon; title already
  set in the root layout.
- Gates: `npm run build` + `npm run lint` clean; `npm run smoke:generate`
  renders all three templates without errors.

### BRIEF §11 acceptance checklist — how each was verified
- **Intake slutbesiktning → lead NY**: Phase 2 intake endpoint creates Lead(NY)
  + Report v1 + contractors + compressed photos (code-verified; not re-run here
  since it needs a live DB).
- **Edit + 27 fel rows + generate → .docx table/photos/signature**: covered by
  `npm run smoke:generate` (27 fel rows, embedded photos, signature block; run
  this phase — all three render clean).
- **PDF_PROVIDER=none manual upload + HTML preview + docx download**: Phase 4
  manual-PDF route + HTML preview reuse `buildTemplateData` (code-verified).
- **Send blocked before Godkänn; after Godkänn email + EmailLog**: Phase 5
  server-side 403 gate on `lead.status !== GODKAND` (code-verified).
- **Ny version clones data; v1 files downloadable**: Phase 5 new-version route
  copies photo files + rows, previous versions listed read-only (code-verified).
- **All three types generate**: `npm run smoke:generate` ✅.
- **Radera removes files from disk**: `DELETE /api/leads/[id]` calls
  `removeReportDir` per version before anonymising (code-verified).

_DB-dependent items above are verified by reading the implementing code; the
user runs the full click-through locally against Neon per the user-side track._

### Post-Phase-6 fix — real template styling
The earlier session's briefing claimed the `.docx` templates had already been
restyled to match the firm's reference reports; that turned out to be false —
git history showed only the generic Phase 4 starter templates had ever been
committed. The user supplied three real reference PDFs (slutbesiktning,
statusbesiktning, skadeutredning) and `scripts/build-templates.ts` was
rewritten to match them precisely:
- Two-column header (house-icon logo left, SBR/Byggingenjörerna badge right on
  slut/status only) with a rule below; `Sid X(Y)` via native Word PAGE/NUMPAGES
  fields (not a tag). Different-first-page footer: full company contact block
  on page 1, `Filnamn: {filnamn}` only on continuation pages.
- Blue (`#1F5C99`) header row on the fel-tabell and the sändlista table,
  matching the reference exactly; verified absent on skadeutredning (no
  fel-tabell there).
- Boilerplate legal/explanatory text copied verbatim from the references (the
  Bet/Nr/Del-Rum/Fel/Avhjälpt column explanations, the numbering-convention
  sentence, "utsedd av beställaren", "medlem i SBR:s entreprenadbesiktningsgrupp").
  This text is static (no `{tags}`), so it's safe to further edit in Word.
- Two logo assets (`templates/assets/logo.png`, `templates/assets/badge.png`)
  are generated as clean SVG→PNG placeholders on first build (real logo files
  weren't available — only rasterized PDF renders); dropping the firm's real
  PNGs at those paths and re-running `npm run templates:build` swaps them in
  with no other changes needed.
- Two fields visible in the real reports aren't in the app's data model yet
  and were deliberately omitted rather than faked: **Avtalsform** and
  **Närvarande** (attendee names). Documented in PLACEHOLDERS.md; add on request.
- Verified structurally (LibreOffice wasn't usable for a rendered-PDF preview
  in this sandbox): unzipped the smoke-generated `.docx` files and confirmed
  zero unresolved `{tags}`, blue shading present on slut/status and absent on
  skade, all 27 fel-tabell rows repeating individually (not merged), the
  nested `rekommendationer` loop, the `dokumentation`/`observationer` loops,
  and the statusbesiktning photo grid all rendering correctly.
- `npm run build` + `npm run lint` clean; `npm run smoke:generate` clean.

### Post-Phase-6 fix — Avtalsform + Närvarande fields
The two fields flagged as missing in the template-restyle note above are now
captured for real, matching the reference reports:
- **Avtalsform** (slutbesiktning only, e.g. "Konsumenttjänster") — new
  `dataJson.avtalsform` field, edited on the Parter tab, rendered in the
  "Avtalade arbeten och parter" section.
- **Närvarande** (attendee names) — new `dataJson.narvarandeBestallare` /
  `narvarandeHantverkare` fields (slutbesiktning has both; skadeutredning has
  only the beställare side, matching its reference), edited on the Parter tab
  under a new "Närvarande vid besiktningen" section, rendered as their own
  "Närvarande" section in both templates. Statusbesiktning already had this
  covered by the existing `lagenhetsinnehavare` field — no change needed there.
No schema migration — both live in `Report.dataJson` per the existing
type-specific-fields convention. `template-data.ts`, `parter-tab.tsx`,
`build-templates.ts`, `scripts/smoke-generate.ts` fixtures, and
`PLACEHOLDERS.md` all updated together; verified via the unzipped
smoke-generated `.docx` (both new sections render with zero unresolved tags).
Build + lint + smoke:generate clean.

## Deviations from the brief

_None so far._ Additions that stay within scope:
- `AppSettings` singleton model added to hold the §4.4 company block, default
  email subject/body templates, and webhook-secret display. The brief lists
  these as settings-page fields without prescribing a table; a single-row model
  is the natural home and keeps them out of scattered env/config.
