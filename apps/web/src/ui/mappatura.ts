import {
  COLONNE_IMPORT,
  ETICHETTE_COLONNE_IMPORT,
  type ColonnaImport,
  type Mappatura,
  type Tabella,
} from '@tyrecare/shared';
import { esc } from '../lib/html';
import type { MappaturaSalvata } from '../lib/importa';

// Passo "Associa le colonne" dell'import (PLAN P22): per ogni colonna di TyreCare un <select> con le
// intestazioni del file. Solo HTML e lettura dei valori: il flusso (anteprima, errori) è in pagine/importa.ts.

const MAX_ESEMPIO = 30;

/** Intestazioni non vuote e senza ripetizioni, nell'ordine del file. */
export const intestazioniUtili = (t: Tabella): string[] => [
  ...new Set(t.intestazioni.filter((h) => h.trim() !== '')),
];

/**
 * Vero se ogni intestazione non vuota del file è usata dalla mappatura. Un'intestazione ripetuta
 * conta come non riconosciuta (la mappatura ne usa una sola).
 */
export function tuttoRiconosciuto(t: Tabella, m: Mappatura): boolean {
  const usate = new Set(Object.values(m));
  const nonVuote = t.intestazioni.filter((h) => h.trim() !== '');
  return nonVuote.length === usate.size && nonVuote.every((h) => usate.has(h));
}

/** Esempio per un'intestazione: la prima cella non vuota della colonna, tagliata a 30 caratteri. */
export function esempioColonna(t: Tabella, intestazione: string): string {
  const posizione = t.intestazioni.indexOf(intestazione);
  if (posizione < 0) return '';
  for (const riga of t.righe) {
    const cella = (riga.celle[posizione] ?? '').trim();
    if (cella) return cella.length > MAX_ESEMPIO ? `${cella.slice(0, MAX_ESEMPIO)}…` : cella;
  }
  return '';
}

const idCampo = (colonna: ColonnaImport) => `tc-mappa-${colonna}`;

/** HTML del passo: i <select> con le scelte iniziali, il riquadro degli errori e il pulsante. */
export function schermataMappatura(
  t: Tabella,
  scelte: Mappatura,
  salvate: MappaturaSalvata[] = [],
): string {
  const opzioni = intestazioniUtili(t).map((h) => {
    const esempio = esempioColonna(t, h);
    return { h, testo: esempio ? `${h} (es. ${esempio})` : h };
  });
  const campi = COLONNE_IMPORT.map(
    (colonna) => `
      <div class="tc-campo">
        <label class="form-label" for="${idCampo(colonna)}">${esc(ETICHETTE_COLONNE_IMPORT[colonna])}</label>
        <select class="form-select" id="${idCampo(colonna)}" data-colonna="${colonna}">
          <option value="">— Non c'è nel file —</option>
          ${opzioni
            .map(
              (o) =>
                `<option value="${esc(o.h)}"${scelte[colonna] === o.h ? ' selected' : ''}>${esc(o.testo)}</option>`,
            )
            .join('')}
        </select>
      </div>`,
  ).join('');
  const usaSalvata = salvate.length
    ? `
      <div class="tc-campo">
        <label class="form-label" for="tc-mappa-salvata">Usa un'associazione salvata</label>
        <div class="d-flex gap-2">
          <select class="form-select" id="tc-mappa-salvata" data-mappa-salvata>
            <option value="">— Scegli —</option>
            ${salvate.map((m) => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-outline-light" data-elimina-mappatura disabled>
            Elimina
          </button>
        </div>
      </div>`
    : '';
  return `
    <section class="tc-import" aria-labelledby="tc-mappatura">
      <h2 id="tc-mappatura" class="tc-etichetta" tabindex="-1">Associa le colonne</h2>
      <p class="mb-0">
        Non riconosciamo tutte le colonne del file. Per ogni dato di TyreCare scegli la colonna del
        tuo file che lo contiene. Serve almeno la targa o il codice cliente.
      </p>
      ${usaSalvata}
      <div class="tc-mappatura__campi">${campi}</div>
      <div class="tc-campo">
        <label class="form-label" for="tc-salva-come">Salva queste scelte come (facoltativo)</label>
        <input class="form-control" id="tc-salva-come" type="text" maxlength="60"
          placeholder="Es. il nome del tuo gestionale" autocomplete="off" />
      </div>
      <div data-errori-mappatura role="alert"></div>
      <button type="button" class="btn btn-primary btn-lg w-100" data-mostra-anteprima>
        Mostra l'anteprima
      </button>
    </section>`;
}

/** Scelte attuali dei <select>. */
export function leggiScelte(box: HTMLElement): Mappatura {
  const m: Mappatura = {};
  for (const s of box.querySelectorAll<HTMLSelectElement>('select[data-colonna]')) {
    if (s.value !== '') m[s.dataset.colonna as ColonnaImport] = s.value;
  }
  return m;
}

/** Il primo <select> da correggere: uno con l'intestazione scelta due volte, o quello della targa. */
export function primoSelectCoinvolto(box: HTMLElement, m: Mappatura): HTMLSelectElement | null {
  const selects = [...box.querySelectorAll<HTMLSelectElement>('select[data-colonna]')];
  const volte = new Map<string, number>();
  for (const h of Object.values(m)) volte.set(h, (volte.get(h) ?? 0) + 1);
  return (
    selects.find((s) => (volte.get(s.value) ?? 0) > 1) ??
    (m.targa === undefined && m.codice_cliente === undefined
      ? selects.find((s) => s.dataset.colonna === 'targa')
      : undefined) ??
    selects[0] ??
    null
  );
}

/** Imposta i <select> delle colonne sulle scelte date (le colonne non citate tornano a "non c'è"). */
export function impostaScelte(box: HTMLElement, m: Mappatura): void {
  for (const s of box.querySelectorAll<HTMLSelectElement>('select[data-colonna]')) {
    s.value = m[s.dataset.colonna as ColonnaImport] ?? '';
  }
}
