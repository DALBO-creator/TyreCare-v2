// @vitest-environment happy-dom
import { campoDot, oggiISO } from '@tyrecare/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Le icone creano SVG con `document`: qui bastano segnaposto
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

const { caricaSchedaDaUrl, montaPneumatici, vaiConConferma } = vi.hoisted(() => ({
  caricaSchedaDaUrl: vi.fn(),
  montaPneumatici: vi.fn(),
  vaiConConferma: vi.fn(),
}));
vi.mock('./veicolo', () => ({ caricaSchedaDaUrl }));
vi.mock('../lib/officina', () => ({ montaPneumatici }));
vi.mock('../lib/router', () => ({ visualizzazioneCorrente: () => 1 }));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal()),
  vaiConConferma,
}));

import type { Pneumatico } from '../lib/officina';
import { campiPneumatico, mostraMontaPneumatici } from './monta-pneumatici';

const VEICOLO = { id: 'v1', targa: 'AB123CD' };
const AVVISO =
  'Gli pneumatici montati ora nelle posizioni scelte vengono smontati e restano nello storico';

const pneumatico: Pneumatico = {
  id: 'p1',
  veicolo_id: 'v1',
  officina_id: 'o1',
  posizione: 'ANT_SX',
  stagione: 'ESTIVO',
  marca: 'Michelin',
  modello: 'Primacy',
  misura: '205/55 R16',
  dot: null,
  montato_il: '2026-01-01',
  smontato_il: null,
  origine: 'APP',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const campoDi = (nome: string) => document.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
const posizione = (p: string) =>
  document.querySelector<HTMLInputElement>(`input[name="posizioni"][value="${p}"]`)!;
const spunta = () => document.querySelector<HTMLInputElement>('[data-dot-per-ruota]')!;
const ruote = () => document.querySelector<HTMLElement>('[data-dot-ruote]')!;
const erroreDi = (nome: string) => document.getElementById(`campo-${nome}-errore`)!;
const pulsante = () =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === 'Monta pneumatici',
  );

const scrivi = (nome: string, valore: string) => {
  const el = campoDi(nome);
  el.value = valore;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const cambia = (el: HTMLInputElement, spuntato: boolean) => {
  el.checked = spuntato;
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
const invia = () =>
  document
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

async function apri(pneumatici: Pneumatico[] = []): Promise<void> {
  caricaSchedaDaUrl.mockResolvedValue({ veicolo: VEICOLO, pneumatici });
  document.body.innerHTML = '<div id="app"></div>';
  await mostraMontaPneumatici(document.getElementById('app')!);
  await vi.waitFor(() => expect(pulsante()).toBeDefined());
}

/** Compila i campi obbligatori diversi dal DOT. */
function compila(): void {
  campoDi('stagione').value = 'INVERNALE';
  scrivi('misura', '205/55 r16 91v');
  scrivi('marca', 'Pirelli');
  scrivi('modello', 'Cinturato');
}

beforeEach(() => {
  vi.clearAllMocks();
  montaPneumatici.mockResolvedValue(undefined);
});

describe('DOT diverso per ogni ruota', () => {
  beforeEach(async () => {
    await apri();
  });

  it('all’inizio il DOT unico è attivo, le quattro ruote sono scelte e non ci sono campi per ruota', () => {
    expect(spunta().checked).toBe(false);
    expect(campoDi('dot').disabled).toBe(false);
    expect(posizione('SCORTA').checked).toBe(false);
    expect(['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX'].map((p) => posizione(p).checked)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(ruote().children).toHaveLength(0);
  });

  it('con la spunta il DOT unico si disattiva e compare un campo per ogni posizione scelta', () => {
    cambia(spunta(), true);
    expect(campoDi('dot').disabled).toBe(true);
    expect([...ruote().querySelectorAll('input')].map((i) => i.name)).toEqual([
      'dot_ANT_SX',
      'dot_ANT_DX',
      'dot_POST_SX',
      'dot_POST_DX',
    ]);
    expect([...ruote().querySelectorAll('label')].map((l) => l.textContent)).toEqual([
      'DOT Anteriore sinistro',
      'DOT Anteriore destro',
      'DOT Posteriore sinistro',
      'DOT Posteriore destro',
    ]);
  });

  it('togliendo una posizione il suo campo sparisce e gli altri tengono il valore scritto', () => {
    cambia(spunta(), true);
    scrivi(campoDot('ANT_SX'), '3823');
    scrivi(campoDot('POST_DX'), '0124');

    cambia(posizione('ANT_DX'), false);
    expect([...ruote().querySelectorAll('input')].map((i) => i.name)).toEqual([
      'dot_ANT_SX',
      'dot_POST_SX',
      'dot_POST_DX',
    ]);
    expect(campoDi('dot_ANT_DX')).toBeNull();
    expect(campoDi('dot_ANT_SX').value).toBe('3823');
    expect(campoDi('dot_POST_DX').value).toBe('0124');
  });

  it('aggiungendo la scorta compare il suo campo, nell’ordine delle posizioni', () => {
    cambia(spunta(), true);
    cambia(posizione('SCORTA'), true);
    expect([...ruote().querySelectorAll('input')].map((i) => i.name).at(-1)).toBe('dot_SCORTA');
    expect(document.querySelector('label[for="campo-dot_SCORTA"]')!.textContent).toBe(
      'DOT Ruota di scorta',
    );
  });

  it('togliendo la spunta i campi per ruota spariscono e il DOT unico torna attivo', () => {
    cambia(spunta(), true);
    scrivi(campoDot('ANT_SX'), '3823');
    cambia(spunta(), false);
    expect(ruote().children).toHaveLength(0);
    expect(campoDi('dot_ANT_SX')).toBeNull();
    expect(campoDi('dot').disabled).toBe(false);
  });

  it('senza spunta, togliere una posizione non crea campi per ruota', () => {
    cambia(posizione('ANT_SX'), false);
    expect(ruote().children).toHaveLength(0);
    expect(campoDi('dot').disabled).toBe(false);
  });
});

describe('invio del modulo', () => {
  beforeEach(async () => {
    await apri();
    compila();
  });

  it('con la spunta la funzione di montaggio riceve un DOT per ruota e nessun DOT unico', async () => {
    scrivi('dot', '1111');
    cambia(spunta(), true);
    scrivi(campoDot('ANT_SX'), '3823');
    scrivi(campoDot('ANT_DX'), '3823');
    scrivi(campoDot('POST_SX'), '0124');
    scrivi(campoDot('POST_DX'), '');
    invia();

    await vi.waitFor(() => expect(montaPneumatici).toHaveBeenCalledTimes(1));
    expect(montaPneumatici).toHaveBeenCalledWith('v1', {
      posizioni: ['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX'],
      stagione: 'INVERNALE',
      misura: '205/55 R16 91V',
      marca: 'Pirelli',
      modello: 'Cinturato',
      dot: null,
      dot_ANT_SX: '3823',
      dot_ANT_DX: '3823',
      dot_POST_SX: '0124',
      dot_POST_DX: null,
      montato_il: oggiISO(),
    });
    expect(vaiConConferma).toHaveBeenCalledWith('/veicolo?id=v1', 'Pneumatici montati.');
  });

  it('senza spunta lo stesso DOT vale per tutte le ruote e non ci sono chiavi per ruota', async () => {
    scrivi('dot', '3823');
    invia();

    await vi.waitFor(() => expect(montaPneumatici).toHaveBeenCalledTimes(1));
    const dati = montaPneumatici.mock.calls[0]![1];
    expect(dati.dot).toBe('3823');
    expect(Object.keys(dati).filter((k) => k.startsWith('dot_'))).toEqual([]);
    expect(dati.posizioni).toEqual(['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX']);
  });

  it('il DOT di una ruota tolta dalle posizioni non viene inviato', async () => {
    cambia(spunta(), true);
    scrivi(campoDot('ANT_SX'), '3823');
    scrivi(campoDot('ANT_DX'), '0124');
    cambia(posizione('ANT_DX'), false);
    cambia(posizione('POST_SX'), false);
    cambia(posizione('POST_DX'), false);
    invia();

    await vi.waitFor(() => expect(montaPneumatici).toHaveBeenCalledTimes(1));
    const dati = montaPneumatici.mock.calls[0]![1];
    expect(dati.posizioni).toEqual(['ANT_SX']);
    expect(dati.dot_ANT_SX).toBe('3823');
    expect(Object.keys(dati).filter((k) => k.startsWith('dot_'))).toEqual(['dot_ANT_SX']);
    expect(vaiConConferma).toHaveBeenCalledWith('/veicolo?id=v1', 'Pneumatico montato.');
  });

  it('un DOT di 3 cifre nel campo unico mostra l’errore e non monta nulla', async () => {
    scrivi('dot', '382');
    invia();

    await vi.waitFor(() => expect(campoDi('dot').getAttribute('aria-invalid')).toBe('true'));
    expect(erroreDi('dot').textContent).toBe(
      'Il DOT sono le ultime 4 cifre: settimana e anno (es. 3823)',
    );
    expect(erroreDi('dot').hidden).toBe(false);
    expect(campoDi('marca').getAttribute('aria-invalid')).toBe('false');
    expect(montaPneumatici).not.toHaveBeenCalled();
    expect(vaiConConferma).not.toHaveBeenCalled();
  });

  it('un DOT di 3 cifre su una ruota segna solo quel campo e non monta nulla', async () => {
    cambia(spunta(), true);
    scrivi(campoDot('ANT_SX'), '3823');
    scrivi(campoDot('POST_SX'), '382');
    invia();

    await vi.waitFor(() =>
      expect(campoDi('dot_POST_SX').getAttribute('aria-invalid')).toBe('true'),
    );
    expect(erroreDi('dot_POST_SX').textContent).toBe(
      'Il DOT sono le ultime 4 cifre: settimana e anno (es. 3823)',
    );
    expect(campoDi('dot_ANT_SX').getAttribute('aria-invalid')).toBe('false');
    expect(erroreDi('dot_ANT_SX').hidden).toBe(true);
    expect(montaPneumatici).not.toHaveBeenCalled();
  });
});

describe('avviso sugli pneumatici montati', () => {
  it('senza pneumatici montati l’avviso non c’è e la misura è vuota', async () => {
    await apri([]);
    expect(document.body.textContent?.replace(/\s+/g, ' ')).not.toContain(AVVISO);
    expect(campoDi('misura').value).toBe('');
  });

  it('con pneumatici montati l’avviso c’è e la misura è quella attuale', async () => {
    await apri([pneumatico]);
    expect(document.body.textContent?.replace(/\s+/g, ' ')).toContain(AVVISO);
    expect(campoDi('misura').value).toBe('205/55 R16');
    expect(campoDi('montato_il').value).toBe(oggiISO());
  });
});

describe('campiPneumatico (Cambia pneumatici)', () => {
  it('precompila stagione, misura, marca, modello, DOT e data', () => {
    document.body.innerHTML = `<form>${campiPneumatico({
      stagione: 'INVERNALE',
      misura: '195/65 R15 91T',
      marca: 'Continental',
      modello: 'WinterContact',
      dot: '3823',
      montato_il: '2026-02-03',
    })}</form>`;
    // happy-dom non legge `selected` dal markup in `select.value`: si controlla l'opzione scelta dalla pagina
    expect(
      document.querySelector<HTMLOptionElement>('[name="stagione"] option[selected]')!.value,
    ).toBe('INVERNALE');
    expect(campoDi('misura').value).toBe('195/65 R15 91T');
    expect(campoDi('marca').value).toBe('Continental');
    expect(campoDi('modello').value).toBe('WinterContact');
    expect(campoDi('dot').value).toBe('3823');
    expect(campoDi('montato_il').value).toBe('2026-02-03');
  });

  it('senza valori lascia i campi vuoti', () => {
    document.body.innerHTML = `<form>${campiPneumatico({ dot: null })}</form>`;
    expect(campoDi('misura').value).toBe('');
    expect(campoDi('marca').value).toBe('');
    expect(campoDi('dot').value).toBe('');
  });
});
