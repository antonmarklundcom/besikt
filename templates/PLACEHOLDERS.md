# PLACEHOLDERS.md — Platshållarkontrakt för rapportmallarna

Detta dokument beskriver **alla platshållare** i de tre Word-mallarna:

| Mall | Rapporttyp |
|---|---|
| `slutbesiktning.docx` | Slutbesiktning |
| `statusbesiktning.docx` | Statusbesiktning |
| `skadeutredning.docx` | Skadeutredning |

Du kan **stila om mallarna fritt i Word** (typsnitt, färger, logotyp, marginaler,
sidhuvud/sidfot, tabellutseende) så länge du följer reglerna nedan. Systemet
fyller i platshållarna vid ”Generera dokument”.

---

## Regler vid omstilning (viktigt!)

1. **Ändra aldrig texten inuti `{ }`.** Taggen `{bestallare_namn}` måste förbli
   exakt så — inga mellanslag, inga svenska tecken, ingen autokorrigering.
   Tips: skriv inte om taggar för hand; klipp ut och klistra in dem i stället.
2. **Ta inte bort loop-par.** En loop börjar med `{#namn}` och slutar med
   `{/namn}`. Båda måste finnas kvar. Allt mellan dem upprepas en gång per rad
   i datat.
3. **Tabell-loopar:** i fel-tabellen ligger `{#fel}` i datarad­ens **första
   cell** och `{/fel}` i **sista cellen på samma rad**. Då upprepas hela raden.
   Flytta inte dessa taggar till andra rader/celler. Du får ändra kolumnbredd,
   ramar, typsnitt och rubrikraden fritt.
4. **Bildtaggar (`{%bild}`) måste stå ENSAMMA i ett eget stycke.** Skriv ingen
   annan text i samma stycke som en bildtagg.
5. **Ta bort en platshållare du inte vill ha?** Det är tillåtet — den delen av
   datat utelämnas då bara. (En borttagen tagg kraschar inget.)
6. Spara alltid som **.docx** (inte .doc eller .docm). Byt inte filnamn.
7. Testa efter omstilning: kör `npm run smoke:generate` (eller generera ett
   dokument i appen) — får du fel pekar felmeddelandet ut vilken tagg som gått
   sönder.

## Så fungerar taggarna

| Syntax | Betydelse | Exempel |
|---|---|---|
| `{namn}` | Ersätts med text | `{bestallare_namn}` → ”Anna Andersson” |
| `{#lista}` … `{/lista}` | Loop — innehållet upprepas per rad | fel-tabellens rader |
| `{#flagga}` … `{/flagga}` | Villkor — visas bara om värdet finns | signaturbild |
| `{%bild}` | Ersätts med en bild (eget stycke!) | foton, signatur |

Radbrytningar i inmatad text bevaras (fritextfält kan innehålla flera stycken).

---

## Gemensamma platshållare (alla tre mallar)

### Dokument & ärende
| Tagg | Innehåll |
|---|---|
| `{typ_rubrik}` | Rapporttyp i versaler, t.ex. ”SLUTBESIKTNING” |
| `{ref_nummer}` | Ärendenummer, t.ex. ”EK-2026-042” |
| `{datum}` | Dagens datum (ÅÅÅÅ-MM-DD) |
| `{version}` | Rapportversion (1, 2, …) |
| `{filnamn}` | Genererat filnamn (ligger i sidfoten) |

### Företagsblock (från Inställningar)
| Tagg | Innehåll |
|---|---|
| `{foretag_namn}` | Företagsnamn |
| `{foretag_orgnr}` | Org.nr |
| `{foretag_adress}` | Gatuadress |
| `{foretag_postadress}` | Postnr + ort |
| `{foretag_telefon}` | Telefon |
| `{foretag_epost}` | E-post |

### Beställare
| Tagg | Innehåll |
|---|---|
| `{bestallare_namn}` | Namn |
| `{bestallare_adress}` | Adress |
| `{bestallare_postnr}` | Postnummer |
| `{bestallare_epost}` | E-post |
| `{bestallare_telefon}` | Telefon |

### Objekt
| Tagg | Innehåll |
|---|---|
| `{fastighetsbeteckning}` | T.ex. ”BJÄLKEN 6, STOCKHOLM” |
| `{objekt_adress}` | Objektets adress |
| `{objekt_postnr}` | Postnummer |

### Besiktningsman & signatur
| Tagg | Innehåll |
|---|---|
| `{besiktning_datum}` | Besiktningsdatum |
| `{besiktningsman_namn}` | Namn |
| `{besiktningsman_titel}` | T.ex. ”Certifierad besiktningsman SBR” |
| `{cert_nummer}` | T.ex. ”KIWA 12345” |
| `{#har_signatur}` `{%bild}` `{/har_signatur}` | Signaturbild — visas bara om profilen har en. `{%bild}` i eget stycke. |

### Övrigt
| Tagg | Innehåll |
|---|---|
| `{numrering_text}` | Standardtexten om numrering (”Fönster, dörrar, väggar …”) — ligger inne i avsnittet ”Fel och förhållanden” (slutbesiktning/statusbesiktning). Skadeutredning har ingen fel-tabell och använder inte taggen. |

Sidnumreringen ”Sid X(Y)” är vanliga Word-fält (PAGE/NUMPAGES) i sidhuvudet —
inga taggar, stila fritt.

`{ref_nummer}` och `{version}` finns kvar som data men visas inte i den
löpande texten längre (de riktiga referensrapporterna visar dem inte) — lägg
gärna till dem själv i Word om du vill se dem i dokumentet.

### Logotyper (statiska bilder, ej datataggar)
Sidhuvudets logotyper är inte platshållartaggar — de bakas in i mallfilen när
`npm run templates:build` körs, från:

- `templates/assets/logo.png` — vänster logga (hus-ikon + ”Entreprenad­konsulterna”)
- `templates/assets/badge.png` — höger SBR/Bygg­ingenjörerna-märke (endast
  slutbesiktning + statusbesiktning; syns även vid signaturen)

Just nu är dessa **genererade platshållarbilder**. Lägg de riktiga PNG-filerna
på exakt dessa sökvägar och kör `npm run templates:build` igen — resten av
mallen ändras inte. (Om du hellre stilar om i Word: infoga bilden direkt i
sidhuvudet/signaturen i Word i stället — då spelar filerna i `templates/assets/`
ingen roll längre för just den mallen.)

### Fält som ännu inte fångas i appen
De riktiga referensrapporterna innehåller två uppgifter som appens formulär
inte samlar in ännu, så mallarna saknar dem avsiktligt i stället för att visa
tomma fält:
- **Avtalsform** (t.ex. ”Konsumenttjänster”)
- **Närvarande** (namn på personer som deltog vid besiktningen)

Säg till om du vill att dessa läggs till som riktiga fält i formuläret.

---

## SLUTBESIKTNING — `slutbesiktning.docx`

### Hantverkare (loop)
```
{#hantverkare}
{namn} · Org.nr {orgnr}
{kontakt} · {epost}
{/hantverkare}
```
Upprepas per hantverkare. `{#hantverkare}` och `{/hantverkare}` står i egna
stycken (de raderna försvinner i det färdiga dokumentet).

### Sektioner
| Tagg | Innehåll |
|---|---|
| `{omfattning}` | Fritext |
| `{tid}` | Fritext, t.ex. ”2026-06-15 kl. 09:00–12:00” |
| `{kallelse_datum}` | Datum |
| `{kallelse_satt}` | T.ex. ”e-post” |
| `{kostnad}` | Formaterad kostnad, t.ex. ”35 000 kr” |
| `{godkand_text}` | ”Godkänd” eller ”Ej godkänd” |
| `{godkand_datum}` | Datum för besked |
| `{reklamationsfrister}` | Fritext |
| `{avhjalpande_deadline}` | T.ex. ”inom 2 månader” |
| `{ovriga_noteringar}` | Fritext |

### Provning/Dokumentation (loop)
```
{#dokumentation}{label} – {datum}{/dokumentation}
```
En punkt per kvalitetsdokument (`label` = namn, `datum` = ÅÅÅÅ-MM-DD).

### Fel-tabellen (loop i tabellrad)
Kolumner: **Bet | Nr | Del/Rum | Fel | Avhjälpt/sign**

Dataraden ser ut så här (en cell per kolumn):

| Bet | Nr | Del/Rum | Fel | Avhjälpt/sign |
|---|---|---|---|---|
| `{#fel}{bet}` | `{nr}` | `{del_rum}` | `{fel_text}` | `{/fel}` |

- Raden upprepas en gång per fel (0–50+ rader).
- `{bet}` är ”H” när hantverkaren är ansvarig, annars tomt.
- `{nr}` numreras automatiskt 1, 2, 3 …
- Sista kolumnen blir alltid tom (fylls i för hand) — `{/fel}` syns inte.

### Sändlista (loop)
```
{#sandlista}{epost}{/sandlista}
```
En punkt per e-postadress.

---

## STATUSBESIKTNING — `statusbesiktning.docx`

| Tagg | Innehåll |
|---|---|
| `{lagenhetsinnehavare}` | Närvarande person |
| `{omfattning}` | Fritext |
| `{tid}` | Fritext |
| `{ovriga_noteringar}` | Fritext, flera stycken bevaras |

### Fel-tabellen
Som slutbesiktningens men **utan Bet-kolumn**:

| Nr | Del/Rum | Fel | Avhjälpt/sign |
|---|---|---|---|
| `{#fel}{nr}` | `{del_rum}` | `{fel_text}` | `{/fel}` |

### Bildrutnät (2 kolumner, loop i tabellrad)
Tabellen har EN datarad med två celler; raden upprepas per bildpar:

- Vänster cell: `{#bild_rader}{#v}` → `{%bild}` (eget stycke) → `{bildtext}` → `{/v}`
- Höger cell: `{#h}` → `{%bild}` (eget stycke) → `{bildtext}` → `{/h}{/bild_rader}`

`v` = vänster bild, `h` = höger bild (tom vid udda antal). Bilderna kommer från
fliken **Bilder** med sektionen **Bilder**, i den ordning du sorterat dem.
Bildstorleken sätts automatiskt (max ~250 px bred i rutnätet, proportioner
bevaras).

---

## SKADEUTREDNING — `skadeutredning.docx`

Konsultföretagsblocket använder de gemensamma `{foretag_*}`-taggarna.

| Tagg | Innehåll |
|---|---|
| `{bakgrund}` | 1. Bakgrund till uppdraget (fritext) |
| `{orsak}` | 3. Orsak till skada (fritext) |
| `{bedomning}` | 4. Bedömning (fritext) |

### 2. Observationer (loop, punktlista)
```
{#observationer}{punkt}{/observationer}
```
En punkt per rad som skrivits i redigeraren.

### 4. Bilder i bedömningen (loop)
```
{#bedomning_bilder}
{%bild}          ← eget stycke
{bildtext}
{/bedomning_bilder}
```
Bilder från fliken **Bilder** med sektionen **Bedömning (avsnitt 4)**, i vald
ordning, i full bredd (~440 px).

### 5. Rekommendationer / Åtgärdsförslag (nästlad loop)
```
{#rekommendationer}
{rubrik}                      ← gruppens rubrik (fetstil)
{#punkter}{punkt}{/punkter}   ← punktlista i gruppen
{/rekommendationer}
```
Upprepas per grupp; varje grupp har en rubrik och valfritt antal punkter.

---

## Återskapa startmallarna

Om en mall gått sönder bortom räddning:

```
npm run templates:build
```

skriver om alla tre mallarna i ursprungligt (ostilat) skick. Din omstilade
version försvinner då — ta en säkerhetskopia först.
