# Rapportverket

Internt verktyg för en svensk besiktningsfirma: intagsformulär → leadkö →
rapporteditor → generera `.docx` → (manuell eller API-baserad) PDF → godkänn →
mejla till kund.

Byggt med **Next.js 14 (App Router) + TypeScript**, **Prisma + Neon PostgreSQL**,
**NextAuth** (credentials), **docxtemplater** + `docxtemplater-image-module-free`,
**Resend**, **sharp**, samt **Tailwind + shadcn/ui**. Se
[BRIEF.md](./BRIEF.md) för hela specifikationen och [CLAUDE.md](./CLAUDE.md) för
de icke förhandlingsbara reglerna.

---

## 1. Lokal utveckling (Windows PowerShell)

> **Viktigt:** skriv aldrig `.env` med `>`-omdirigering — det ger UTF-16 och
> bryter dotenv. Använd `Set-Content -Encoding utf8`.

1. Installera beroenden:
   ```powershell
   npm install
   ```

2. Skapa `.env` (kopiera från [`.env.example`](./.env.example) och fyll i
   riktiga värden). Exempel för en rad:
   ```powershell
   Set-Content -Encoding utf8 .env "DATABASE_URL=postgresql://user:pass@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
   ```
   Generera `NEXTAUTH_SECRET` med:
   ```powershell
   openssl rand -base64 32
   ```

3. Pusha schemat till Neon (**körs bara lokalt** — se §3):
   ```powershell
   npm run db:push
   ```

4. Seeda adminanvändaren (från `ADMIN_EMAIL` / `ADMIN_PASSWORD`):
   ```powershell
   npm run db:seed
   ```

5. Starta dev-servern:
   ```powershell
   npm run dev
   ```
   Öppna <http://localhost:3000/login> och logga in med adminuppgifterna.
   **Byt lösenord efter första inloggningen.**

### Nyttiga kommandon

| Kommando | Beskrivning |
|----------|-------------|
| `npm run build` | `prisma generate` + `next build` (fungerar utan DB) |
| `npm run lint` | ESLint |
| `npm run db:push` | Prisma-schema → Neon (**endast lokalt**) |
| `npm run db:seed` | Seeda admin + inspector + inställningar (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run templates:build` | Bygg om startmallarna (`templates/*.docx`) |
| `npm run smoke:generate` | Rendera alla tre mallar från fixtures (utan DB) |

---

## 2. Miljövariabler

Se [`.env.example`](./.env.example) för fullständig lista. Kort:

| Variabel | Beskrivning |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL, EU-region (Frankfurt/Stockholm) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Publik URL (se §3 om Hostinger) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed-admin (rotera efter första inloggning) |
| `RESEND_API_KEY` / `MAIL_FROM` | Utgående e-post (verifierad avsändardomän) |
| `PDF_PROVIDER` | `none` (standard) \| `ilovepdf` \| `cloudconvert` \| `gotenberg` |
| `CLOUDCONVERT_API_KEY` / `ILOVEPDF_PUBLIC_KEY` / `ILOVEPDF_SECRET_KEY` | Endast om en av dessa providers är på |
| `GOTENBERG_URL` / `GOTENBERG_SECRET` | Endast om `PDF_PROVIDER=gotenberg` (självhostad, se §5) |
| `WEBHOOK_SECRET` | Delad hemlighet för `X-Webhook-Secret` (GHL-intag) |
| `STORAGE_DIR` | Filrot (standard `./storage`; Hostingers beständiga disk i prod) |

---

## 3. Deploy till Hostinger (managed Node.js)

Hostingers hanterade Node.js-hosting via GitHub-integration. **Följande fakta är
icke förhandlingsbara** (BRIEF §9):

1. **hPanel → Node.js Apps → Import Git Repository** och välj GitHub-repot.
2. Byggkommando: `npm run build`. Startkommando: `npm start`.
3. Sätt **alla** miljövariabler från §2 i hPanel.
4. **⚠️ Hostingers SSH-shell har trasig IPv6-routing till Neon.** Kör **aldrig**
   `prisma db push` eller seed över Hostinger-SSH — det timeoutar. All
   schemapush och seed sker från din **lokala** Windows-maskin (§1, steg 3–4).
5. `NEXTAUTH_URL` börjar som `*.hostingersite.com`-URL:en. Efter att en egen
   domän mappats: **uppdatera `NEXTAUTH_URL` till den nya domänen och deploya
   om** — annars fungerar inte inloggningen.
6. Det finns **ingen LibreOffice/systembinär** på servern — därför är
   PDF-konvertering API-baserad och av som standard (se §5).
7. `STORAGE_DIR` ska peka på en beständig disk så att bilder och genererade
   filer överlever omdeploys.

---

## 4. Retention & GDPR

Rapportdata (namn, adresser, bostadsfoton) lämnar **inte** servern i v1 —
`PDF_PROVIDER=none` är standard just av den anledningen.

På varje lead finns två dataskyddsåtgärder (leadsidan, längst ner):

- **Arkivera** — sätter status `ARKIVERAD` men **behåller** all data och alla
  filer. Leaden låses för redigering.
- **Radera** — tar bort persondata (beställare, objekt, anteckningar), alla
  bilder och genererade `.docx`/PDF-filer från disk, samt alla
  rapport-/kontraktsrader. Kvar blir en **anonymiserad spårbarhetsrad**
  (referensnummer, typ, tidsstämplar) med `clientName = "Raderad"`. Kan **inte**
  ångras.

**Retentionpolicy (rekommendation):** radera leads när kundens
reklamationsfrist löpt ut och rapporten inte längre behövs för spårbarhet.
Referensnummerserien (`EK-ÅÅÅÅ-NNN`) bevaras via den anonymiserade raden.

---

## 5. PDF-konvertering (av som standard)

Standard är `PDF_PROVIDER=none`: den primära leveransen är den redigerbara
`.docx`-filen. Användaren sparar som PDF i Word ("Spara som PDF") och laddar upp
den PDF:en på rapportversionen, eller skickar `.docx` direkt.

För att slå på automatisk konvertering senare finns tre alternativ:

**A. Tredjeparts-SaaS (EU-baserade providers med DPA)**
1. Sätt `PDF_PROVIDER=ilovepdf` **eller** `PDF_PROVIDER=cloudconvert` i hPanel.
2. Sätt motsvarande nycklar (`ILOVEPDF_PUBLIC_KEY` + `ILOVEPDF_SECRET_KEY`,
   eller `CLOUDCONVERT_API_KEY`).
3. Deploya om. Generering konverterar då automatiskt och sätter `pdfPath`; den
   manuella uppladdningsplatsen ersätts av en auto-PDF-länk.

> **GDPR-notis:** med en tredjeparts-provider påslagen lämnar
> dokumentinnehållet servern för konvertering hos den leverantören. Slå bara
> på detta med ett DPA på plats.

**B. Självhostad konvertering (`PDF_PROVIDER=gotenberg`)** — inga
tredjepartsavgifter, datan lämnar bara infrastruktur ni själva äger. Kräver att
ni driftar [Gotenberg](https://gotenberg.dev/) (öppen källkod, kör LibreOffice
+ headless Chromium i en Docker-container) på egen infra, t.ex.:
- **Google Cloud Run** — skalar till noll (ingen kostnad när den står stilla),
  har en generös gratiskvot per månad som med ~5–10 konverteringar/vecka
  sannolikt aldrig överskrids. Deploya Gotenbergs officiella Docker-image
  direkt.
- **Oracle Cloud "Always Free"-tier** — en riktigt gratis-för-alltid VM utan
  användningstak; enklare "alltid på"-server, mer manuell driftsättning
  (SSH in, installera Docker, kör Gotenberg-containern).

Sätt `PDF_PROVIDER=gotenberg` och `GOTENBERG_URL` (pekar på er instans). Om ni
lagt en delad hemlighet framför containern (rekommenderas om den är nåbar
publikt), sätt även `GOTENBERG_SECRET` — den skickas som headern
`X-Gotenberg-Secret` på varje konverteringsanrop.

---

## 6. Projektstruktur

Se [CLAUDE.md](./CLAUDE.md) för fullständig arkitekturkarta. Kort:

```
prisma/schema.prisma   Alla modeller (Lead, Report, Finding, Photo, …)
src/lib/               auth, storage, images (sharp), generation, pdf, labels …
src/app/intake/        Publikt intagsformulär (honeypot, rate-limit)
src/app/dashboard/     Leadkö, rapporteditor, inställningar
src/app/api/           Route handlers (intake, reports, photos, leads, settings …)
templates/*.docx       docxtemplater-mallar (se templates/PLACEHOLDERS.md)
```
