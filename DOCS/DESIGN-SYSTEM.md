# DESIGN-SYSTEM — Linee guida visive di TyreCare

> Fonte di verità per colori, tipografia e componenti. Generato in Fase 1 (2026-10-06) con la skill
> `ui-ux-pro-max` e rivisto per il prodotto. I valori nel codice stanno in `apps/web/src/styles/_tokens.scss`:
> se si cambia un colore qui, va cambiato lì (e viceversa).

## 1. Principi

1. **App, non landing page.** Mobile-first, pensata per l'uso con una mano: navigazione in basso, azioni
   grandi, informazioni importanti in alto.
2. **Lo stato degli pneumatici è il protagonista.** Verde/giallo/rosso sono riservati **solo** allo stato di
   salute: nessun altro elemento dell'interfaccia usa questi colori.
3. **Mai solo il colore.** Ogni stato ha sempre **colore + icona + testo** (chi non distingue i colori deve
   capire comunque).
4. **Accessibile per costruzione.** Contrasto minimo 4.5:1 (WCAG AA), aree di tocco di almeno 44×44 px,
   focus sempre visibile, animazioni ridotte se l'utente lo chiede (`prefers-reduced-motion`).
5. **Affidabile e sobrio.** Stile *Flat + Accessible*: niente ombre pesanti, gradienti o effetti decorativi.

### Scelte rispetto alla proposta della skill

La prima proposta della skill (profilo "Automotive/Car Dealership") è stata scartata perché pensata per siti
vetrina: stile *Motion-Driven* con parallax, font serif (Playfair Display) per il testo e **rosso come colore
delle azioni**, che confonderebbe le azioni con lo stato "da sostituire". Il design system finale combina:

| Aspetto | Profilo della skill usato |
|---------|---------------------------|
| Stile | *Home Services* → Flat Design + Accessible & Ethical |
| Palette | *B2B Service* → navy professionale + blu per le azioni |
| Colori di stato | *Status Page* → verde / ambra / rosso |
| Tipografia | *Corporate Trust* → Lexend + Source Sans 3 |

## 2. Colori

### Base

| Ruolo | Chiaro | Scuro | Uso |
|-------|--------|-------|-----|
| Sfondo pagina | `#F8FAFC` | `#0B1220` | `body` |
| Superficie (card) | `#FFFFFF` | `#131C2E` | schede, barra di navigazione |
| Testo | `#0F172A` | `#E2E8F0` | testo principale |
| Testo secondario | `#475569` | `#94A3B8` | descrizioni, date, unità |
| Bordi | `#E2E8F0` | `#334155` | separatori |
| Barra superiore | `#0F172A` (navy) | `#131C2E` | intestazione, `theme-color` della PWA |
| **Azione** (`primary`) | `#0369A1` | link `#7DD3FC` | pulsanti principali, link, voce attiva |

Il blu "azione" serve **solo** per ciò che si può toccare. In Bootstrap è `$primary` (`btn-primary`,
`link-primary`…).

### Stato di salute (`StatoSalute` in `@tyrecare/shared`)

| Stato | Etichetta | Icona (Lucide) | Pieno | Sfondo tenue / testo (chiaro) | Sfondo tenue / testo (scuro) |
|-------|-----------|----------------|-------|-------------------------------|------------------------------|
| `VERDE` | In buono stato | `circle-check` | `#15803D` | `#DCFCE7` / `#14532D` | `#052E16` / `#BBF7D0` |
| `GIALLO` | Da controllare | `triangle-alert` | `#F59E0B` | `#FEF3C7` / `#78350F` | `#451A03` / `#FDE68A` |
| `ROSSO` | Da sostituire | `octagon-alert` | `#B91C1C` | `#FEE2E2` / `#7F1D1D` | `#450A0A` / `#FECACA` |

Le icone hanno **forme diverse** (cerchio, triangolo, ottagono), così lo stato si distingue anche in bianco e
nero. In Bootstrap: `$success`, `$warning`, `$danger` usano gli stessi valori (per `alert-danger` ecc.).
Variabili CSS: `--tc-verde`, `--tc-verde-tenue`, `--tc-verde-testo` (e così via per `giallo`, `rosso`),
che cambiano da sole in modalità scura.

### Contrasti verificati (WCAG 2.1)

| Coppia | Rapporto | | Coppia | Rapporto |
|--------|----------|-|--------|----------|
| Testo / sfondo | 17.1 | | Bianco / azione | 5.9 |
| Secondario / sfondo | 7.2 | | Bianco / rosso | 6.5 |
| Verde testo / tenue | 8.3 | | Bianco / verde | 5.0 |
| Ambra testo / tenue | 8.2 | | Navy / ambra pieno | 8.3 |
| Rosso testo / tenue | 8.2 | | Scuro: testo / sfondo | 15.2 |
| Scuro: secondario / sfondo | 7.3 | | Scuro: link / sfondo | 11.2 |

Tutti ≥ 4.5:1. Bootstrap sceglie da solo testo bianco o navy sui pulsanti colorati (`$min-contrast-ratio: 4.5`).

## 3. Tipografia

| Uso | Font | Pesi |
|-----|------|------|
| Titoli, valori numerici | **Lexend** (variabile) | 600–700 |
| Testo, moduli, pulsanti | **Source Sans 3** (variabile) | 400–600 |

- Font **inclusi nell'app** (`@fontsource-variable/*`), non caricati da Google Fonts: funzionano offline e non
  inviano l'IP degli utenti a Google (GDPR, PLAN P17). Il service worker precarica solo i caratteri latini.
- Testo base **16 px**, interlinea 1.5; mai testo di contenuto sotto i 13 px.
- Numeri delle misure con `font-variant-numeric: tabular-nums` (le cifre non "ballano").
- Lexend è progettato per la leggibilità: adatto a utenti di tutte le età, anche alla guida di un'officina.

## 4. Forme, spazi, movimento

- Raggi: 0.5 rem (campi, pulsanti), 0.75 rem (card), pillola per i badge.
- Pulsanti e campi alti **44 px** (`$input-btn-padding-y: .625rem`).
- Spaziatura: scala di Bootstrap (`.25 / .5 / 1 / 1.5 / 3 rem`), densità standard.
- Animazioni brevi (150–300 ms, `ease-out`), solo per dare un riscontro (colore al passaggio, riempimento della
  barra del battistrada). Disattivate con `prefers-reduced-motion` (`$enable-reduced-motion`).
- Tema chiaro/scuro: segue l'impostazione del sistema operativo (`src/ui/tema.ts`).

## 5. Componenti

| Componente | Classe / funzione | Note |
|------------|-------------------|------|
| Barra superiore | `.tc-appbar`, `.tc-appbar__titolo` | Sticky, navy, rispetta il notch (`safe-area-inset-top`) |
| Navigazione inferiore | `.tc-bottomnav`, `.tc-bottomnav__voce` | **Max 5 voci**, icona + testo, voce attiva con `aria-current="page"`; al contenuto va `.tc-con-bottomnav` |
| Badge di stato | `badgeStato(stato)` → `.tc-stato--verde/giallo/rosso` | Icona + etichetta, mai solo colore |
| Scheda pneumatico | `.tc-pneumatico` (+ `__intestazione`, `__posizione`, `__valore`, `__unita`) | Posizione, badge, mm in grande, misuratore |
| Misuratore battistrada | `.tc-battistrada--<stato>` + `__livello` | `role="meter"` con `aria-valuetext` leggibile ("3,4 millimetri, da controllare"); 8 mm = 100% |
| Icone | `icona(NomeIcona)` da `src/ui/icone.ts` | Lucide SVG, `aria-hidden`; i pulsanti solo-icona hanno `aria-label` |
| Pulsanti, moduli, alert, card, modal, toast | Bootstrap | Etichette sempre visibili sopra i campi (mai solo placeholder), testo di aiuto sotto |

Anteprima di tutti i componenti: `npm run dev:web` → http://localhost:5173 (pagina provvisoria
`src/anteprima.ts`, sarà sostituita dalle schermate reali).

## 6. Da evitare

- Rosso, giallo o verde per elementi che non sono uno stato (es. pulsante "Elimina" → `btn-outline-secondary`
  con conferma, non rosso pieno accanto agli stati).
- Emoji come icone; icone senza testo nella navigazione.
- Colori esadecimali scritti nei componenti: usare token Sass o variabili CSS.
- Rimuovere l'anello di focus; elementi toccabili sotto i 44 px.
- Animazioni decorative, parallax, caroselli automatici.

## 7. Checklist prima di consegnare una schermata

- [ ] Contrasto ≥ 4.5:1 in chiaro **e** in scuro
- [ ] Stati con colore + icona + testo
- [ ] Navigabile da tastiera, focus visibile, ordine logico
- [ ] Aree di tocco ≥ 44 px, spazio ≥ 8 px tra elementi toccabili
- [ ] Provata a 375, 768, 1024 px senza scorrimento orizzontale
- [ ] Contenuto non coperto da barra superiore / navigazione inferiore / notch
- [ ] `prefers-reduced-motion` rispettato
