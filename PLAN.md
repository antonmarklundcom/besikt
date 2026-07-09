# PLAN.md — Implementation plan for remaining phases

Written by Fable 5 for handover to Sonnet 5 / Opus 4.8. Prereq reading:
[CLAUDE.md](./CLAUDE.md) (hard rules) and [BRIEF.md](./BRIEF.md) (spec).
Phases 1–3 are done — see [PROGRESS.md](./PROGRESS.md). Do the phases below in
order, one at a time, with the phase gate from CLAUDE.md rule 8.

---

## Phase 4 — Templates + PLACEHOLDERS.md + generation + PDF adapter + preview

The deliverable that matters most: **the placeholder contract.** The user will
restyle the three .docx files in Word; generation must keep working as long as
they keep the placeholders. Everything below serves that.

### 4.1 Dependencies

```
npm i docxtemplater pizzip docxtemplater-image-module-free docx
```

(`docx` is a devDependency-style build tool here: used once by a script to
produce the starter templates; generation itself uses only docxtemplater+pizzip.)

### 4.2 Template data contract (single source of truth)

Create `src/lib/generation/template-data.ts`:

- `buildTemplateData(lead, report, inspector, settings): SlutData | StatusData | SkadeData`
- Flatten everything the templates need. Placeholder names are **ASCII snake_case
  without Swedish characters** (docxtemplater tags with å/ä/ö invite Word
  autocorrect breakage): e.g. `bestallare_namn`, not `{beställare_namn}`.
- Shared fields (all three types): `ref_nummer`, `typ_rubrik`, `datum` (today,
  YYYY-MM-DD), company block (`foretag_namn`, `foretag_orgnr`, `foretag_adress`,
  `foretag_postadress`, `foretag_telefon`, `foretag_epost`), objekt block
  (`fastighetsbeteckning`, `objekt_adress`, `objekt_postnr`),
  beställare block (`bestallare_namn/_adress/_postnr/_epost/_telefon`),
  besiktning (`besiktning_datum`, `besiktningsman_namn`, `besiktningsman_titel`,
  `cert_nummer`, `{%signatur}` image), `numrering_text` (the "Fönster, dörrar…"
  convention), `filnamn`.
- Slutbesiktning extras: `hantverkare` loop (`namn`, `orgnr`, `kontakt`,
  `epost`), `omfattning`, `tid`, `kallelse_datum`, `kallelse_satt`,
  `dokumentation` loop (`label`, `datum`), `fel` loop (`bet`, `nr`, `del_rum`,
  `fel_text` — avhjälpt/sign column stays EMPTY), `kostnad` (formatted
  `35 000 kr`), `godkand_text` ("Godkänd"/"Ej godkänd"), `godkand_datum`,
  `reklamationsfrister`, `avhjalpande_deadline`, `ovriga_noteringar`,
  `sandlista` loop.
- Statusbesiktning extras: `lagenhetsinnehavare`, `fel` loop (no bet), free-text
  `ovriga_noteringar` (split paragraphs on blank lines → loop of `{stycke}`),
  `bilder` loop (`{%bild}` + `bildtext`, from Photo section BILDER, sorted).
- Skadeutredning extras: `bakgrund`, `observationer` loop (line-split),
  `orsak`, `bedomning`, `bedomning_bilder` loop (section BEDOMNING, in UI
  order), `rekommendationer` loop (`rubrik`, nested `punkter` loop).

### 4.3 Starter templates (programmatic, committed as .docx)

Create `scripts/build-templates.ts` (run with `tsx`, committed; output
`templates/slutbesiktning.docx`, `templates/statusbesiktning.docx`,
`templates/skadeutredning.docx` also committed). Use the `docx` npm library.
Three SEPARATE templates — no mega-template with conditionals.

Each starter template contains, in order: company header block, title, parties
section, type-specific sections (per BRIEF §2) with the placeholders above,
fel-tabell as a REAL Word table whose data row contains the loop tags
(`{#fel}` … `{/fel}` in table cells — docxtemplater repeats the row), photo
grid (2-col table, `{%bild}` + caption), signature block, footer with
`Sid X(Y)` page numbering (PAGE/NUMPAGES fields) and `{filnamn}`.

Important docxtemplater details:
- Loop tags in tables: open/close tags must sit inside the same row's cells.
- Image module free: tag syntax `{%tagname}`; the module's `getImage` receives
  the tag value — pass **absolute file paths** and read them in `getImage`;
  `getSize` should honour a max width (~450px at 96 dpi for full width, ~220px
  for 2-col grid) preserving aspect ratio (use `sharp` metadata or
  `image-size`).
- Use `{d.` free syntax OFF — plain tags, `paragraphLoop: true`,
  `linebreaks: true` in the Docxtemplater constructor.

### 4.4 PLACEHOLDERS.md

`templates/PLACEHOLDERS.md` — the contract document, in Swedish or bilingual,
one section per template: every tag, its meaning, loop structure (with a
copy-pasteable example of a fel-tabell row), image tags and sizing behaviour,
rules for restyling in Word (you may change fonts/colors/layout freely; don't
edit inside `{}` tags; keep loop open/close in the same table row; save as
.docx not .docm/.doc). This file must be complete enough that the user never
needs to read code.

### 4.5 Generation service + route

- `src/lib/generation/generate-docx.ts`:
  `generateDocx(reportId): Promise<{ docxPath, filename }>` — loads lead +
  report + relations + inspector + settings, builds data, renders the right
  template, writes to `storage/reports/{reportId}/generated/{filename}`,
  updates `Report.docxPath` + `generatedAt`. Filename per BRIEF §5:
  `{refNumber}_{typ}_{objekt-slug}_v{version}.docx` (slugify objekt: lowercase,
  åäö→aao, non-alnum→`-`). Regeneration overwrites the CURRENT version's files
  only; clear `pdfPath` when regenerating (stale manual PDF must not survive a
  regenerate).
- `POST /api/reports/[reportId]/generate` — requireSession, allowed in any
  non-archived status.
- `GET /api/reports/[reportId]/files/[kind]` (kind = docx|pdf) — requireSession,
  streams the stored file with correct content-type + Content-Disposition.

### 4.6 PDF adapter (built but OFF)

`src/lib/pdf/index.ts`: `convertToPdf(buffer: Buffer): Promise<Buffer>` —
switch on `PDF_PROVIDER`:
- `none` (default): throw `PdfDisabledError` (callers check `isPdfEnabled()`).
- `ilovepdf`: implement against their REST API (start task → upload → process
  officepdf → download) using `ILOVEPDF_PUBLIC_KEY/SECRET_KEY`.
- `cloudconvert`: jobs API with `CLOUDCONVERT_API_KEY`.
Keep providers in separate files; no SDK deps — plain fetch. If a provider is
configured, the generate route auto-converts and sets `pdfPath`.

### 4.7 Manual-PDF upload + HTML preview (PDF_PROVIDER=none path)

- `POST /api/reports/[reportId]/pdf` — multipart upload of the user's
  Word-exported PDF; validate content-type `application/pdf` + magic bytes
  `%PDF`; store next to the docx as `{same-basename}.pdf`, set `pdfPath`.
- HTML preview: server component section on the lead page rendering the report
  data (NOT the docx) in the document's reading order — good enough to
  proof-read content. Reuse `buildTemplateData` so preview and docx can't
  drift.
- Lead page UI (new "Dokument" panel): Generera dokument button → shows docx
  download link + preview; if provider none → "Ladda upp PDF" slot (+ replace/
  remove); if provider configured → auto PDF link. Show generatedAt timestamp.

### Phase 4 acceptance
- All three templates generate without errors from realistic data (write a
  temporary script `scripts/smoke-generate.ts` that builds template data from a
  fixture object and renders all three templates via docxtemplater — must run
  in CI/dev without a DB by taking fixtures, not DB rows).
- Fel-tabell repeats rows correctly incl. 27+ rows; photos embed; signature
  image renders when the inspector has one, and the block degrades gracefully
  (empty image) when not.
- `npm run build` + lint clean. PROGRESS.md updated. 3-line summary, then STOP.

---

## Phase 5 — Approve flow + Resend email + EmailLog + versioning

- `npm i resend`.
- `POST /api/reports/[reportId]/approve` — requireSession; sets lead status
  GODKAND, `approvedAt`, `approvedById`. Require a generated docx first.
  Approval locks editing (already enforced by the 409 guards).
- Also add the reverse: `POST .../reopen` sets GODKAND → GRANSKNING **only if
  not sent** (needed in practice; confirm with user if in doubt).
- `POST /api/reports/[reportId]/send` — requireSession. **Server-side re-check:
  lead.status === GODKAND, else 403** (BRIEF §6 — do not trust the UI).
  Body: `{ to: string[], subject, body, attachPdf: bool, attachDocx: bool }`.
  At least one attachment required; pdf requested but missing → 400. Send via
  Resend (`RESEND_API_KEY`, `MAIL_FROM`), write EmailLog (status SENT/FAILED,
  providerId), set lead SKICKAD + report `sentAt`/`sentTo` on success.
- Send panel UI on lead page: to-addresses prefilled from beställare +
  contractors (editable chips or textarea), subject prefilled from
  AppSettings template (`Utlåtande {typ} – {objekt}`), body from AppSettings
  template, attachment checkboxes. Show EmailLog history table on the page.
- `POST /api/leads/[id]/new-version` — clones the current Report (dataJson,
  findings, qualityDocs, photo ROWS pointing at copied files — copy the files
  into the new report's storage dir so GDPR delete of one version can't break
  another), version+1, resets docx/pdf/approved/sent fields, sets lead status
  PAGAENDE. Old versions listed read-only on the lead page with their files.
- Version switcher on lead page: editor edits ONLY the highest version.

### Phase 5 acceptance
Send blocked before Godkänn (server-side); after approve, email flows and
EmailLog row appears; Ny version clones data and v1 files stay downloadable.
Build/lint clean, PROGRESS.md, 3-line summary, STOP.

---

## Phase 6 — Settings, GDPR delete, polish, README runbook

- `/dashboard/settings` (ADMIN only — check role in the page AND in the APIs):
  company block fields (AppSettings), email subject/body templates, inspector
  profiles CRUD incl. signature image upload (reuse sharp pipeline; store under
  `storage/inspectors/{id}/`), webhook secret display (read from env,
  display-only with copy button).
- GDPR (BRIEF §7): on the lead page, `Arkivera` (status ARKIVERAD, keeps data)
  and `Radera` (danger confirm) — deletes ALL report storage dirs (photos +
  generated files) via `removeReportDir`, deletes Photo/Finding/QualityDoc/
  EmailLog/Report/Contractor rows, and ANONYMIZES the lead row (clientName →
  "Raderad", null out contact/property fields, notes; keep refNumber + type +
  timestamps for the ledger). Status ARKIVERAD.
- README.md: project intro, local dev setup (PowerShell, one command per step),
  the **Neon/Hostinger runbook** (BRIEF §9: hPanel Git import, build/start
  commands, env vars list, the IPv6/SSH warning in bold, NEXTAUTH_URL
  update-then-redeploy step), retention policy note, PDF provider switch
  instructions.
- Polish pass: empty states, loading states, mobile check of dashboard tables,
  favicon/title.
- Verify BRIEF §11 acceptance checklist item by item; tick them off in
  PROGRESS.md with how each was verified.

---

## User-side track (their local Windows machine — give one command per message)

1. `.env` via `Set-Content -Encoding utf8` (Neon URL, secrets)
2. `npx prisma db push`
3. `npm run db:seed`
4. `npm run dev` → log in, click through
5. At deploy time: follow README runbook (hPanel env vars, deploy, then
   `NEXTAUTH_URL` swap after domain mapping + redeploy)

## Approved future scope (user-confirmed, build only when asked)

- **PDF download link in the send email** in addition to the attachment
  (2026-07-09): a tokenized `GET /api/public/reports/[token]/pdf` link included
  in the Resend email body. Attachment remains primary.
- **Client portal (v2, out of current brief)**: potential clients log in to
  follow their project. Prefer magic-link (email) auth over Google for
  outsiders; needs a CLIENT role + per-lead access checks. Do NOT start without
  an explicit go-ahead.
- **Google sign-in for internal users**: small NextAuth addition; only on
  request.

## Open questions for the user (ask, don't guess)

- Real GHL field names for the webhook mapper (current mapping is a guess).
- Company block real values (org.nr, address, phones) — needed before first
  real report; they can also enter them in Settings once Phase 6 lands.
- Reopen-after-approve semantics (PLAN assumes allowed until sent).
