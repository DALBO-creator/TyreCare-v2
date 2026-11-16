/**
 * Bozza del «Nuovo controllo» salvata sul dispositivo (R44): se la pagina si ricarica o la rete cade,
 * le misure già scritte non si perdono. Niente `zod`: il file è letto dalla pagina pigra, ma tenerlo
 * leggero evita di appesantire il JS iniziale. Ogni accesso a `localStorage` è in `try/catch`:
 * senza memoria (modalità privata, spazio pieno) la pagina funziona come senza bozza.
 */

export const DURATA_BOZZA_MS = 7 * 24 * 60 * 60 * 1000;

export interface BozzaControllo {
  /** Istante del salvataggio, in millisecondi dal 1970. */
  salvata_il: number;
  /** Posizioni delle ruote montate quando la bozza è stata scritta. */
  posizioni: string[];
  /** Coppie nome/valore dei campi del modulo. */
  valori: Record<string, string>;
}

/** La chiave contiene l'id utente: un altro account sullo stesso telefono non vede le note. */
export function chiaveBozza(utenteId: string, veicoloId: string): string {
  return `tc-bozza-controllo:${utenteId}:${veicoloId}`;
}

export function salvaBozza(
  chiave: string,
  posizioni: readonly string[],
  valori: Record<string, string>,
  ora: number = Date.now(),
): void {
  try {
    const bozza: BozzaControllo = { salvata_il: ora, posizioni: [...posizioni], valori };
    localStorage.setItem(chiave, JSON.stringify(bozza));
  } catch {
    // la bozza vale solo finché la pagina resta aperta
  }
}

export function cancellaBozza(chiave: string): void {
  try {
    localStorage.removeItem(chiave);
  } catch {
    // niente da cancellare se la memoria non è disponibile
  }
}

/**
 * La bozza salvata, o `null` se manca, è illeggibile, è più vecchia di 7 giorni (e allora la
 * cancella) o riguarda ruote diverse da quelle montate adesso.
 */
export function leggiBozza(
  chiave: string,
  posizioni: readonly string[],
  ora: number = Date.now(),
): BozzaControllo | null {
  try {
    const grezza = localStorage.getItem(chiave);
    if (grezza === null) return null;
    const b: unknown = JSON.parse(grezza);
    if (!b || typeof b !== 'object') return null;
    const { salvata_il, posizioni: salvate, valori } = b as Partial<BozzaControllo>;
    if (typeof salvata_il !== 'number' || !Number.isFinite(salvata_il)) return null;
    if (ora - salvata_il > DURATA_BOZZA_MS) {
      cancellaBozza(chiave);
      return null;
    }
    if (!Array.isArray(salvate) || !valori || typeof valori !== 'object') return null;
    const attese = [...posizioni].sort().join(',');
    if ([...salvate].sort().join(',') !== attese) return null;
    const puliti: Record<string, string> = {};
    for (const [nome, v] of Object.entries(valori)) if (typeof v === 'string') puliti[nome] = v;
    return { salvata_il, posizioni: salvate.map(String), valori: puliti };
  } catch {
    return null;
  }
}

export interface SalvataggioRitardato {
  /** Chiede un salvataggio: subito se è passato abbastanza tempo, altrimenti con un timer finale. */
  programma(): void;
  /** Annulla il timer in sospeso, ma le richieste successive funzionano ancora. */
  annulla(): void;
  /** Ferma il timer in sospeso e blocca ogni scrittura successiva. */
  ferma(): void;
}

/** Throttle: `scrivi` al massimo una volta ogni `ms`, senza perdere l'ultima richiesta. */
export function creaSalvataggioRitardato(scrivi: () => void, ms: number): SalvataggioRitardato {
  let ultimo = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fermo = false;
  const esegui = () => {
    timer = undefined;
    if (fermo) return;
    ultimo = Date.now();
    scrivi();
  };
  return {
    programma() {
      if (fermo || timer !== undefined) return;
      const resta = ms - (Date.now() - ultimo);
      if (resta <= 0) esegui();
      else timer = setTimeout(esegui, resta);
    },
    annulla() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
    ferma() {
      fermo = true;
      this.annulla();
    },
  };
}
