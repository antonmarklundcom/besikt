# BUILD BRIEF — Besiktningsrapport Generator ("Rapportverket")

Internal tool for a Swedish besiktningsfirma. Intake form → lead queue → fill/edit report data → generate editable .docx from one of 3 templates → convert to PDF → approve → email to client. Volume is low (5–10 reports/week), single-tenant, 1–3 internal users. Optimize for simplicity and reliability, not scale.

---

## 1. Stack (fixed — do not substitute)

- **Next.js 14+ (App Router), TypeScript**
- **Prisma + Neon.tech PostgreSQL** (free tier, EU region — Frankfurt or Stockholm)
- **NextAuth** (credentials provider, internal users only)
- **docxtemplater** + `pizzip` for .docx generation
- **docxtemplater-image-module-free** (npm) for injecting photos — do NOT use the paid image module
- **PDF conversion: OFF by default for GDPR reasons** (`PDF_PROVIDER=none`). Report data (names, addresses, home photos) must not leave the server in v1. The primary deliverable is the editable .docx; the user converts to PDF manually in Word ("Spara som PDF") before sending — attach flow must support uploading that manually-made PDF onto the report version, or sending the .docx directly. Still build a `convertToPdf(buffer): Promise<Buffer>` adapter with pluggable providers (`ilovepdf` — EU-based, DPA available — and `cloudconvert`) so automated conversion can be switched on later via env var. When provider is `none`, the UI shows the manual-PDF upload slot instead of auto-preview, and previews the generated document via a simple HTML render of the report data instead.
- **Resend** (free tier) for outbound email, from a verified domain
- **sharp** for server-side image compression (phone photos arrive at 3–8 MB; resize to max 1600px wide, JPEG q80 before storing)
- File storage: local `./storage/` directory on the server (Hostinger persistent disk). Structure: `storage/reports/{reportId}/photos/` and `storage/reports/{reportId}/generated/`. No S3 — volume doesn't justify it.
- Deployment target: **Hostinger managed Node.js hosting via GitHub integration** (see §9 — critical constraints).

## 2. The three report types

Each is a separate .docx template with its own structure. Do NOT build one mega-template with conditionals.

1. **SLUTBESIKTNING** (final inspection of renovation work)
   - Parties: beställare (consumer) + one or more hantverkare (company + org.nr)
   - Sections: omfattning, tid, kallelse (date + method), provning/dokumentation (dynamic list of quality documents, each with a date), fel-tabell, kostnad för avhjälpande (SEK), besked om godkännande (approved yes/no + date), reklamationsfrister, avhjälpande-deadline (e.g. "inom 2 månader"), övriga noteringar, sändlista (emails)
   - Fel-tabell columns: **Bet** (H = hantverkaren ansvarig), **Nr**, **Del/Rum**, **Fel**, **Avhjälpt/sign** (left blank)
   - Can have 0–50+ rows.

2. **STATUSBESIKTNING** (status inspection, e.g. before apartment purchase)
   - Parties: beställare only + fastighetsadress/objekt + lägenhetsinnehavare (present person)
   - Sections: omfattning, tid, fel-tabell (no Bet column values required), övriga noteringar (free text, multi-paragraph), bilder (photo grid with captions)

3. **SKADEUTREDNING** (damage investigation)
   - Parties: beställare + konsultföretag (our own company block, static) + fastighet/objekt
   - Numbered sections: 1. Bakgrund till uppdraget (free text), 2. Observationer (bullet list), 3. Orsak till skada (free text), 4. Bedömning och bilder (free text + photos with captions interleaved), 5. Rekommendationer/Åtgärdsförslag (grouped bullet lists: group heading + bullets, repeatable)

**Shared elements across all three:** company header (Entreprenadkonsulterna Sthlm AB block, org.nr, address, phones, email), page numbering "Sid X(Y)", filename footer, besiktningsman signature block (name, "Certifierad besiktningsman SBR", KIWA cert nr, signature image), numbering convention text ("Fönster, dörrar, väggar etc numreras från vänster till höger...").

**Template files:** create `templates/slutbesiktning.docx`, `templates/statusbesiktning.docx`, `templates/skadeutredning.docx` with docxtemplater placeholders (`{beställare_namn}`, loops `{#fel}...{/fel}`, images `{%photo}`). Build them programmatically with the `docx` npm library as a starting point OR create minimal placeholder templates and document every placeholder in `templates/PLACEHOLDERS.md` so the user can restyle the .docx files in Word without breaking generation. The user will replace these with styled versions matching their current reports — the placeholder contract is the deliverable.

## 3. Data model (Prisma)

```
User        id, email, passwordHash, name, role (ADMIN|INSPECTOR)
Inspector   id, userId?, name, title, certBody (SBR), certNumber (KIWA...), signatureImagePath, email, phone
Lead        id, refNumber (auto: "EK-2026-001"), type (SLUTBESIKTNING|STATUSBESIKTNING|SKADEUTREDNING),
            status (NY|PAGAENDE|GRANSKNING|GODKAND|SKICKAD|ARKIVERAD),
            source (FORM|MANUAL|GHL), createdAt, updatedAt,
            -- beställare
            clientName, clientEmail, clientPhone, clientAddress, clientPostal,
            -- objekt
            propertyDesignation (e.g. "BJÄLKEN 6, STOCKHOLM"), propertyAddress, propertyPostal,
            inspectionDate, notes
Contractor  id, leadId, companyName, orgNr, contactName, email   -- 0..n per lead (hantverkare)
Report      id, leadId, version (int, starts 1), dataJson (full structured report payload),
            docxPath?, pdfPath?, generatedAt?, approvedAt?, approvedById?, sentAt?, sentTo (string[])
Finding     id, reportId, sortOrder, bet (e.g. "H" or null), delRum, felText, avhjalpt (bool), avhjalptSign?
Photo       id, reportId, filePath, caption, sortOrder, section (BILDER|BEDOMNING|...)
QualityDoc  id, reportId, label, docDate            -- slutbesiktning "Dokumentation" list
EmailLog    id, reportId, to (string[]), subject, provider, providerId?, status, sentAt
```

`dataJson` holds type-specific fields (kostnad, godkännande, free-text sections, observationer, rekommendation groups) so the schema stays stable across the three types. Findings/Photos/QualityDocs are relational because they're edited row-by-row in the UI.

## 4. Pages / flows

All UI text in **Swedish**. Mobile-first — the intake form is filled on-site on a phone.

1. **/intake** (public, no auth, rate-limited, honeypot field)
   - "Typ av uppdrag" select → drives which fields show
   - Minimal on-site capture: beställare, objekt/fastighet, datum, hantverkare (repeatable, slutbesiktning only), quick notes, photo upload (multi, compressed client-side if possible, else server-side via sharp)
   - Submit → creates Lead (status NY) + Report v1 shell → confirmation screen
   - Also expose the same endpoint as **POST /api/webhook/intake** (JSON, secret header `X-Webhook-Secret`) so a GHL form can post into it later. Map GHL field names in one mapping function.

2. **/dashboard** (auth)
   - Lead queue: filter by status + type, sortable by date, search by name/ref. Status badge colors. This is the "lead sorting".

3. **/dashboard/leads/[id]** (auth) — the workhorse
   - Tabbed editor per report type: Parter · Innehåll (type-specific sections) · Fel-tabell (inline add/edit/reorder/delete rows) · Bilder (upload, caption, reorder, assign section) · Dokumentation (slutbesiktning)
   - Autosave (debounced) to Report.dataJson + relational tables
   - **"Generera dokument"** button → renders .docx via docxtemplater → download link for the .docx + HTML preview of the report data. If `PDF_PROVIDER=none`: show a "Ladda upp PDF" slot where the user attaches the PDF they exported from Word; that file becomes the version's pdfPath. If a provider is configured: auto-convert and show inline PDF preview instead.
   - **"Godkänn"** button (separate, deliberate) → status GODKAND, locks a snapshot
   - **"Skicka"** panel: to-addresses prefilled from beställare + contractors (editable), subject prefilled (`"Utlåtande {typ} – {objekt}"`), body template editable, attaches the version's PDF if present (auto-converted or manually uploaded), else the .docx; checkboxes to include either/both → sends via Resend → status SKICKAD → EmailLog row
   - **"Ny version"** → clones Report as version+1 (for the avhjälpande round-trip); old versions listed read-only with their generated files

4. **/dashboard/settings** (auth, ADMIN)
   - Company block fields, Inspector profiles incl. signature image upload, default email body templates, webhook secret display

## 5. Generation rules

- Filename: `{refNumber}_{typ}_{objekt-slug}_v{version}.docx/pdf`
- Fel-tabell renders as a real Word table via docxtemplater loop; "Avhjälpt/sign" column always empty in generated doc
- Photos: 2-column grid, caption under each; in skadeutredning, photos flow inside section 4 in the order set in UI
- Signature image + cert lines injected from Inspector profile
- Date format: `YYYY-MM-DD`. Currency: `35 000 kr` (space thousands separator)
- Generated files are immutable per generation; regenerating overwrites the current version's files only (previous versions untouched)

## 6. Email

- Resend, single verified sender domain (env: `RESEND_API_KEY`, `MAIL_FROM`)
- Nothing sends without status = GODKAND. Enforce server-side, not just UI.
- Log every send in EmailLog; show send history on the lead page

## 7. Auth & security

- NextAuth credentials, bcrypt, seed one admin from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) — rotate after first login
- Public intake: rate limit by IP (simple in-memory or DB-based, low volume), honeypot, max 20 photos × 10 MB pre-compression
- All `/dashboard` and mutation APIs require session; webhook requires secret header
- GDPR: add an "Arkivera/Radera" action on leads that deletes photos + generated files from disk and anonymizes the lead row; note retention policy in README

## 8. Env vars

`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `MAIL_FROM`, `PDF_PROVIDER` (cloudconvert|ilovepdf|none), `CLOUDCONVERT_API_KEY?`, `ILOVEPDF_PUBLIC_KEY?`/`ILOVEPDF_SECRET_KEY?`, `WEBHOOK_SECRET`, `STORAGE_DIR` (default `./storage`)

## 9. Deployment constraints (Hostinger managed Node.js — non-negotiable facts)

- Deploy via hPanel → Node.js Apps → Import Git Repository (GitHub). Build `npm run build`, start `npm start`. All env vars set in hPanel.
- **Hostinger's SSH shell has broken IPv6 routing to Neon** — Prisma commands fail there. All `prisma db push` / seed runs happen from the LOCAL machine, never over Hostinger SSH. Document this in README.
- Do NOT assume LibreOffice/system binaries exist on the server — that's why PDF conversion is API-based.
- `NEXTAUTH_URL` starts as the `*.hostingersite.com` URL, updated after custom domain mapping, then redeploy.
- Local dev is on Windows PowerShell: never write `.env` with `>` redirect (UTF-16 breaks dotenv). Use `Set-Content -Encoding utf8`. Give the user one command per message when instructing.

## 10. Build order

1. Prisma schema + Neon + NextAuth + seed admin
2. Intake form + webhook endpoint + lead queue dashboard
3. Lead editor (all tabs, autosave, fel-tabell CRUD, photo upload with sharp)
4. Templates + PLACEHOLDERS.md + docxtemplater generation + PDF adapter + preview
5. Approve flow + Resend email + EmailLog + versioning
6. Settings, GDPR delete, polish, README with deploy runbook

## 11. Acceptance checklist

- [ ] Submit intake as slutbesiktning with 3 hantverkare-fel and 2 photos → lead appears NY
- [ ] Edit in dashboard, add 27 fel rows, generate → .docx opens in Word, table correct, photos placed, signature block correct
- [ ] With PDF_PROVIDER=none: manual PDF upload works and attaches to the version; HTML preview renders; .docx downloadable
- [ ] Send blocked before Godkänn; after Godkänn, email arrives with PDF attached; EmailLog written
- [ ] Ny version clones data; v1 files still downloadable
- [ ] All three template types generate without errors from realistic data
- [ ] Radera removes files from disk
