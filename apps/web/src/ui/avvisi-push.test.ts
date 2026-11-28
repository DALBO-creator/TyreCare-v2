// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_push from '../lib/push';

const { statoPush, attivaPush, disattivaPush } = vi.hoisted(() => ({
  statoPush: vi.fn(),
  attivaPush: vi.fn(),
  disattivaPush: vi.fn(),
}));

vi.mock('../lib/push', async (importOriginal) => ({
  ...(await importOriginal<typeof M_push>()),
  statoPush,
  attivaPush,
  disattivaPush,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { collegaAvvisiPush } from './avvisi-push';

const ERRORE = 'Non è stato possibile cambiare gli avvisi. Controlla la connessione e riprova.';
const ATTIVA = 'Avvisami su questo dispositivo';
const DISATTIVA = 'Disattiva gli avvisi';
const TESTO_SPENTE =
  "Ricevi un avviso anche quando l'app è chiusa: richieste, conferme, cambi di orario.";
const TESTO_ATTIVE = 'Gli avvisi sono attivi su questo dispositivo.';

let contenitore: HTMLElement;

const monta = async (opzioni?: { invito: boolean }) => {
  await collegaAvvisiPush(contenitore, opzioni);
};
const pulsanti = () => [...contenitore.querySelectorAll('button')];
const titolo = () => contenitore.querySelector('h2#tc-push-titolo')?.textContent;
const testo = () => contenitore.querySelector('.tc-push__testo p')?.textContent;
const allarme = () => contenitore.querySelector('[role="alert"]')?.textContent;
const pulsante = () => contenitore.querySelector<HTMLButtonElement>('button')!;
const attendi = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  for (const f of [statoPush, attivaPush, disattivaPush]) f.mockReset();
  document.body.innerHTML = '<div id="push"></div>';
  contenitore = document.getElementById('push')!;
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('avvisi push: testo e pulsante per stato', () => {
  it.each([
    ['spente', TESTO_SPENTE, ATTIVA, 'attiva'],
    ['attive', TESTO_ATTIVE, DISATTIVA, 'disattiva'],
  ])('%s: testo e pulsante', async (stato, t, etichetta, azione) => {
    statoPush.mockResolvedValue(stato);
    await monta();
    expect(titolo()).toBe('Avvisi sul telefono');
    expect(testo()).toBe(t);
    expect(pulsanti()).toHaveLength(1);
    expect(pulsante().textContent).toBe(etichetta);
    expect(pulsante().dataset.push).toBe(azione);
    expect(allarme()).toBeUndefined();
  });

  it.each([
    [
      'bloccate',
      "Gli avvisi sono bloccati per TyreCare: riattivali dalle impostazioni del browser (icona accanto all'indirizzo).",
    ],
    [
      'installa',
      `Su iPhone gli avvisi arrivano solo con l'app nella schermata Home: tocca Condividi, poi "Aggiungi alla schermata Home", e apri TyreCare da lì.`,
    ],
    ['non-supportate', 'Questo browser non riceve avvisi: le notifiche restano qui.'],
  ])('%s: solo testo, nessun pulsante', async (stato, t) => {
    statoPush.mockResolvedValue(stato);
    await monta();
    expect(titolo()).toBe('Avvisi sul telefono');
    expect(testo()).toBe(t);
    expect(pulsanti()).toHaveLength(0);
  });

  it('se statoPush rifiuta, il riquadro mostra «non-supportate»', async () => {
    statoPush.mockRejectedValue(new Error('boom'));
    await monta();
    expect(testo()).toBe('Questo browser non riceve avvisi: le notifiche restano qui.');
    expect(pulsanti()).toHaveLength(0);
  });
});

describe('avvisi push: invito dopo una richiesta', () => {
  it.each(['attive', 'bloccate', 'installa', 'non-supportate'])(
    'con stato %s il contenitore resta vuoto',
    async (stato) => {
      statoPush.mockResolvedValue(stato);
      await monta({ invito: true });
      expect(contenitore.innerHTML).toBe('');
      expect(contenitore.querySelector('section')).toBeNull();
    },
  );

  it('se statoPush rifiuta, niente riquadro', async () => {
    statoPush.mockRejectedValue(new Error('boom'));
    await monta({ invito: true });
    expect(contenitore.innerHTML).toBe('');
  });

  it("con stato spente mostra l'invito con il pulsante", async () => {
    statoPush.mockResolvedValue('spente');
    await monta({ invito: true });
    expect(titolo()).toBe('Vuoi sapere subito quando risponde?');
    expect(testo()).toBe(
      "Attiva gli avvisi: ti arriva un messaggio sul telefono quando l'officina conferma o propone un altro orario, anche con l'app chiusa.",
    );
    expect(pulsanti()).toHaveLength(1);
    expect(pulsante().textContent).toBe(ATTIVA);
  });

  it("dopo l'attivazione compare il «fatto», senza pulsante", async () => {
    statoPush.mockResolvedValue('spente');
    attivaPush.mockResolvedValue('attive');
    await monta({ invito: true });
    pulsante().click();
    await attendi();
    expect(titolo()).toBe('Avvisi attivi');
    expect(testo()).toBe("Ti avvisiamo su questo dispositivo appena l'officina risponde.");
    expect(pulsanti()).toHaveLength(0);
  });

  it("se attivaPush fallisce l'errore resta nell'invito", async () => {
    statoPush.mockResolvedValue('spente');
    attivaPush.mockRejectedValue(new Error('rete'));
    await monta({ invito: true });
    pulsante().click();
    await attendi();
    expect(titolo()).toBe('Vuoi sapere subito quando risponde?');
    expect(allarme()).toBe(ERRORE);
    expect(pulsante().textContent).toBe(ATTIVA);
    expect(pulsante().disabled).toBe(false);
  });
});

describe('avvisi push: azioni', () => {
  it('«attiva»: una chiamata, pulsante disattivato durante, poi il nuovo stato', async () => {
    let risolvi!: (s: M_push.StatoPush) => void;
    statoPush.mockResolvedValue('spente');
    attivaPush.mockReturnValue(new Promise<M_push.StatoPush>((r) => (risolvi = r)));
    await monta();
    const prima = pulsante();
    prima.click();
    expect(attivaPush).toHaveBeenCalledTimes(1);
    expect(prima.disabled).toBe(true);
    expect(disattivaPush).not.toHaveBeenCalled();

    risolvi('attive');
    await attendi();
    expect(testo()).toBe(TESTO_ATTIVE);
    expect(pulsante().textContent).toBe(DISATTIVA);
    expect(pulsante().dataset.push).toBe('disattiva');
    expect(pulsante().disabled).toBe(false);
    expect(allarme()).toBeUndefined();
  });

  it('«attiva» che fallisce: stesso stato, errore e pulsante di nuovo cliccabile', async () => {
    statoPush.mockResolvedValue('spente');
    attivaPush.mockRejectedValue(new Error('rete'));
    await monta();
    const vecchio = pulsante();
    vecchio.click();
    await attendi();
    expect(titolo()).toBe('Avvisi sul telefono');
    expect(testo()).toBe(TESTO_SPENTE);
    expect(allarme()).toBe(ERRORE);
    expect(pulsanti()).toHaveLength(1);
    expect(pulsante()).not.toBe(vecchio);
    expect(pulsante().textContent).toBe(ATTIVA);
    expect(pulsante().disabled).toBe(false);
  });

  it('«disattiva» riuscita: torna a «spente»', async () => {
    statoPush.mockResolvedValue('attive');
    disattivaPush.mockResolvedValue('spente');
    await monta();
    pulsante().click();
    await attendi();
    expect(disattivaPush).toHaveBeenCalledTimes(1);
    expect(testo()).toBe(TESTO_SPENTE);
    expect(pulsante().textContent).toBe(ATTIVA);
  });

  it('«disattiva» che rifiuta (T372): messaggio, stato «attive», nessuna attivazione', async () => {
    statoPush.mockResolvedValue('attive');
    disattivaPush.mockRejectedValue(new Error('rete'));
    await monta();
    pulsante().click();
    await attendi();
    expect(disattivaPush).toHaveBeenCalledTimes(1);
    expect(attivaPush).not.toHaveBeenCalled();
    expect(allarme()).toBe(ERRORE);
    expect(testo()).toBe(TESTO_ATTIVE);
    expect(pulsanti()).toHaveLength(1);
    expect(pulsante().textContent).toBe(DISATTIVA);
    expect(pulsante().disabled).toBe(false);
  });
});
