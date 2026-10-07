# DESIGN-SYSTEM — Linee guida visive di TyreCare

> Fonte di verità per colori, tipografia e componenti. I valori nel codice stanno in
> `apps/web/src/styles/_tokens.scss`: se si cambia un colore qui, va cambiato lì (e viceversa).
>
> **Versione 3 (2026-10-06): "cruscotto sportivo"**, riferimento **My Porsche** (minimal + lusso), scelto dal
> titolare. Rosso e nero, tema sempre scuro.

## 1. Principi

1. **Un protagonista per schermata.** In home è l'**auto vista dall'alto** con i quattro pneumatici
   illuminati del colore del loro stato e un **indicatore stile contagiri** per ruota. Il resto è sobrio.
2. **Minimal e lusso insieme.** Nero profondo, un solo carattere (Inter), numeri grandi e sottili, etichette
   piccole in maiuscolo molto spaziate, molto spazio. Il rosso si usa poco: dove si usa, conta.
3. **User friendly.** Una sola azione principale (pulsante rosso a tutta larghezza), pulsanti e righe alti
   almeno 48 px, navigazione in basso con icona + testo, informazioni in linguaggio semplice
   ("Sostituiscilo il prima possibile").
4. **Il rosso del brand non è uno stato.** Rosso pieno `#E10600` = azioni e marchio (incluso il fanale
   posteriore dell'auto). Lo stato "da sostituire" usa un **rosso corallo** diverso, sempre con **ottagono + testo**.
5. **Mai solo il colore**: ogni stato ha colore + icona (forma diversa) + testo.
6. **Accessibile per costruzione**: contrasto ≥ 4.5:1 per il testo (WCAG AA), ≥ 3:1 per i bordi dei campi,
   focus sempre visibile, animazioni disattivate con `prefers-reduced-motion`.

## 2. Colori

Tema **sempre scuro** (`data-bs-theme="dark"` fisso in `index.html`).

### Base

| Ruolo | Valore | Uso |
|-------|--------|-----|
| Sfondo pagina | `#0A0A0A` | `body`; barre superiore e inferiore semitrasparenti con sfocatura |
| Superficie | `#161616` | liste, card |
| Superficie alta | `#1F1F1F` | campi, riquadri delle icone, righe al passaggio |
| Bordo | `#2A2A2A` | separatori, contorni |
| Bordo dei campi | `#737373` | input e select (≥ 3:1) |
| Testo | `#F5F5F5` (titoli e numeri `#FFFFFF`) | |
| Testo secondario | `#A3A3A3` | descrizioni, unità, etichette |
| **Rosso brand** (`primary`) | `#E10600`, al passaggio `#B80500` | pulsante principale (con alone rosso), "CARE" nel marchio, fanale dell'auto, pallino della voce attiva e delle notifiche. Variabile CSS `--tc-brand` (non `--tc-rosso`, che è il corallo di stato) |
| Logo | `apps/web/public/logo.svg` | contagiri bianco con zona e lancetta in rosso brand, su nero `#0A0A0A` |
| Rosso chiaro | `#FF4D4D` | link, anello di focus |
| Blu targa | `#1D4ED8` | solo le bande laterali della targa |

L'illustrazione dell'auto (`src/ui/auto.ts`) ha i suoi grigi metallizzati scritti nell'SVG: è un disegno, non
un componente d'interfaccia.

### Stato di salute (`StatoSalute` in `@tyrecare/shared`)

| Stato | Etichetta | Icona (Lucide) | Pieno | Sfondo tenue / testo |
|-------|-----------|----------------|-------|----------------------|
| `VERDE` | In buono stato | `circle-check` | `#22C55E` | `#052E16` / `#BBF7D0` |
| `GIALLO` | Da controllare | `triangle-alert` | `#FBBF24` | `#422006` / `#FDE68A` |
| `ROSSO` | Da sostituire | `octagon-alert` | `#FF6B6B` | `#450A0A` / `#FECACA` |

Il colore pieno colora l'arco dell'indicatore, il testo di stato sotto di esso e il contorno luminoso della
ruota nel disegno. Variabili CSS: `--tc-verde`, `--tc-verde-tenue`, `--tc-verde-testo` (idem `giallo`, `rosso`).

### Contrasti verificati (WCAG 2.1)

| Coppia | Rapporto | | Coppia | Rapporto |
|--------|----------|-|--------|----------|
| Testo / sfondo | 18.2 | | Bianco / rosso brand | 4.97 |
| Secondario / sfondo | 7.9 | | Rosso chiaro / sfondo | 6.1 |
| Secondario / superficie | 7.2 | | Verde pieno / superficie | 7.9 |
| Verde testo / tenue | 12.3 | | Ambra piena / superficie | 10.8 |
| Ambra testo / tenue | 11.7 | | Corallo pieno / superficie | 6.5 |
| Corallo testo / tenue | 11.2 | | Bordo campi / superficie | ≥ 3 |

## 3. Tipografia

Un solo carattere: **Inter** (variabile, inclusa nell'app con `@fontsource-variable/inter`: offline e senza
inviare dati a Google — GDPR). Attivate le varianti `cv11`/`ss01` (a e 1 più eleganti).

| Uso | Dimensione | Peso | Note |
|-----|-----------|------|------|
| Nome del modello (hero) | 48–64 px | 250 | spaziatura `-0.045em` |
| Valore dell'indicatore | 24 px | 300 | cifre tabellari |
| Titoli di blocco | 20–22 px | 400–500 | |
| Testo | 16 px | 400 | interlinea 1.55 |
| Etichette di sezione (`.tc-etichetta`) | 12 px | 500 | MAIUSCOLO, spaziatura `0.16em` |
| Sigle (ANT. SX), unità | 11 px | 500 | solo maiuscolo/abbreviazioni, mai testo di lettura |
| Marchio | 15 px | 600 | MAIUSCOLO, spaziatura `0.28em` |

## 4. Forme, spazi, movimento

- Raggi: **0.375 rem** per pulsanti e campi (angoli quasi vivi, più "sartoriali"), 0.75 rem per liste e card.
- Pulsanti e campi alti **48 px**; righe di lista alte 68 px.
- Niente ombre sulle card (sul nero non si vedono): bordi sottili e superfici a due livelli.
- Luce: alone bianco diffuso dietro l'auto ("luce da studio") e riflesso rosso tenue a terra.
- Movimento (curva `cubic-bezier(.2,.8,.2,1)`): gli archi degli indicatori si riempiono all'apertura (1.4 s),
  i blocchi entrano dal basso in sequenza (70 ms di scarto), i pulsanti si comprimono alla pressione.
  **Tutto disattivato** con "riduci movimento".

## 5. Componenti

| Componente | Classe / funzione | Note |
|------------|-------------------|------|
| Marchio | `.tc-marchio` → `Tyre<span>Care</span>` | maiuscolo spaziato, "CARE" rosso |
| Barra superiore | `.tc-appbar`, `__azione`, `.tc-punto` | nera semitrasparente; pulsanti icona 44 px con `aria-label`; pallino rosso notifiche |
| Hero veicolo | `.tc-hero`, `__modello`, `__dettagli` | marca piccola, modello enorme, targa, stagione |
| Cruscotto | `.tc-cruscotto` (aree `as`, `veicolo`, `ad`, `ps`, `pd`) | indicatori agli angoli, auto al centro |
| Auto dall'alto | `autoDallAlto(stati)` → `.tc-auto` | SVG decorativo (`aria-hidden`); ruote con contorno luminoso dello stato |
| Indicatore battistrada | `indicatoreBattistrada({posizione, sigla, mm, stato})` → `.tc-indicatore--<stato>` | arco 270°, tacca per mm, tacca rossa al limite 1,6 mm; `role="meter"` con `aria-valuetext` |
| Targa | `.tc-targa` | stile targa italiana |
| Azione consigliata | `.tc-azione` = `.tc-avviso--<stato>` + `btn-primary btn-lg w-100` | compare solo se serve |
| Lista | `.tc-lista`, `__riga`, `__icona`, `__testo` | icona in riquadro, titolo + dettaglio, freccia |
| Officina | `.tc-officina`, `__nome`, `__indirizzo`, `__azioni` | due azioni affiancate (Chiama, Indicazioni) |
| Badge di stato | `badgeStato(stato, dettaglio?)` → `.tc-stato--<stato>` | per elenchi e tabelle |
| Navigazione inferiore | `.tc-bottomnav`, `__voce` | max 5 voci; attiva = bianca, grassetto e pallino rosso |
| Pulsanti | `btn-primary` (1 per schermata), `btn-outline-light` (secondari) | |
| Icone | `icona(Nome)` da `src/ui/icone.ts` | Lucide, tratto 1.75, `aria-hidden` |

Anteprima: `npm run dev:web` → http://localhost:5173 (pagina provvisoria `src/anteprima.ts`).

## 6. Da evitare

- Rosso pieno del brand dentro badge, avvisi o indicatori (lì si usa il corallo di stato).
- Più di un pulsante rosso per schermata; card tutte uguali una dopo l'altra.
- Secondo font, pesi pesanti (700+) sui numeri grandi, testo di lettura sotto i 13 px.
- Emoji come icone; icone senza testo nella navigazione.
- Esadecimali nei componenti (eccetto l'illustrazione dell'auto): usare token Sass o variabili CSS.
- Gradienti vistosi, bagliori neon diffusi, sfondi chiari.
- Rimuovere l'anello di focus; elementi toccabili sotto i 44 px.

## 7. Checklist prima di consegnare una schermata

- [ ] C'è **un** protagonista visivo e **una** azione principale
- [ ] Contrasto ≥ 4.5:1 per il testo, ≥ 3:1 per bordi di campi e icone significative
- [ ] Stati con colore + icona + testo; rosso brand solo per azioni e marchio
- [ ] Navigabile da tastiera, focus visibile, ordine logico
- [ ] Aree di tocco ≥ 44 px, spazio ≥ 8 px tra elementi toccabili
- [ ] Provata a 375, 768, 1024 px senza scorrimento orizzontale
- [ ] Contenuto non coperto da barre o notch
- [ ] Animazioni assenti con `prefers-reduced-motion`

## Storico delle versioni

- **v1 (2026-10-06)** — navy + blu, tema chiaro/scuro di sistema, Lexend + Source Sans 3. Sostituita.
- **v2 (2026-10-06)** — rosso e nero, Outfit + Inter, componenti Bootstrap ricolorati. Giudicata dal titolare
  "spoglia, non premium": mancava un elemento protagonista. Sostituita.
- **v3 (2026-10-06)** — cruscotto sportivo stile My Porsche: auto dall'alto, indicatori a contagiri, solo Inter.
