// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroreModulo } from '../lib/errori';
import { chiediConferma } from './conferma';

const dialogo = () => document.querySelector<HTMLDialogElement>('dialog');
const pulsante = (attr: string) => document.querySelector<HTMLButtonElement>(`[${attr}]`)!;
const avviso = () => document.querySelector<HTMLElement>('[role="alert"]')!;

/** Esc nel browser: evento `cancel` e, se nessuno lo blocca, chiusura del dialogo. */
function premiEsc() {
  const d = dialogo()!;
  const evento = new Event('cancel', { cancelable: true });
  d.dispatchEvent(evento);
  if (!evento.defaultPrevented) d.close();
}

function apri(azione: (testo?: string) => Promise<void>, extra: object = {}) {
  chiediConferma({
    titolo: 'Eliminare il veicolo?',
    testo: 'Si perdono anche i 3 controlli.',
    pulsante: 'Elimina veicolo',
    azione,
    ...extra,
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('chiediConferma', () => {
  it('apre un dialogo modale con titolo, testo e pulsante di conferma, focus su «Annulla»', () => {
    apri(vi.fn().mockResolvedValue(undefined));
    expect(dialogo()!.open).toBe(true);
    expect(dialogo()!.querySelector('h2')!.textContent).toBe('Eliminare il veicolo?');
    expect(dialogo()!.querySelector('p')!.textContent).toBe('Si perdono anche i 3 controlli.');
    expect(pulsante('data-conferma').textContent).toContain('Elimina veicolo');
    expect(pulsante('data-annulla').textContent).toBe('Annulla');
    expect(document.activeElement).toBe(pulsante('data-annulla'));
  });

  it('«Annulla» chiude e rimuove il dialogo senza chiamare azione', () => {
    const azione = vi.fn().mockResolvedValue(undefined);
    apri(azione);
    expect(dialogo()!.open).toBe(true);
    pulsante('data-annulla').click();
    expect(dialogo()).toBeNull();
    expect(azione).not.toHaveBeenCalled();
  });

  it('Esc chiude senza chiamare azione', () => {
    const azione = vi.fn().mockResolvedValue(undefined);
    apri(azione);
    expect(dialogo()!.open).toBe(true);
    premiEsc();
    expect(dialogo()).toBeNull();
    expect(azione).not.toHaveBeenCalled();
  });

  it('un tocco sullo sfondo chiude come «Annulla»', () => {
    const azione = vi.fn().mockResolvedValue(undefined);
    apri(azione);
    dialogo()!.click();
    expect(dialogo()).toBeNull();
    expect(azione).not.toHaveBeenCalled();
  });

  it('se annullato, il focus torna al pulsante di origine', () => {
    const origine = document.createElement('button');
    document.body.append(origine);
    apri(vi.fn().mockResolvedValue(undefined), { origine });
    expect(document.activeElement).toBe(pulsante('data-annulla'));
    pulsante('data-annulla').click();
    expect(document.activeElement).toBe(origine);
  });

  it('conferma: azione chiamata una volta, pulsanti bloccati durante l’attesa, poi dialogo chiuso', async () => {
    let finisci!: () => void;
    const azione = vi.fn(() => new Promise<void>((ok) => (finisci = ok)));
    apri(azione);
    pulsante('data-conferma').click();
    expect(azione).toHaveBeenCalledTimes(1);
    expect(pulsante('data-conferma').disabled).toBe(true);
    expect(pulsante('data-annulla').disabled).toBe(true);
    expect(pulsante('data-conferma').textContent).toContain('Eliminazione…');
    expect(dialogo()!.open).toBe(true);
    finisci();
    await vi.waitFor(() => expect(dialogo()).toBeNull());
    expect(azione).toHaveBeenCalledTimes(1);
  });

  it('durante l’attesa Esc non chiude il dialogo', () => {
    apri(() => new Promise<void>(() => {}));
    pulsante('data-conferma').click();
    premiEsc();
    expect(dialogo()!.open).toBe(true);
  });

  it('usa il testo «inCorso» passato durante l’attesa', () => {
    apri(() => new Promise<void>(() => {}), { inCorso: 'Annullamento…' });
    pulsante('data-conferma').click();
    expect(pulsante('data-conferma').textContent).toContain('Annullamento…');
  });

  it('azione che lancia ErroreModulo: mostra il suo messaggio, dialogo aperto, pulsanti riattivati', async () => {
    let rifiuta!: (e: Error) => void;
    apri(() => new Promise<void>((_, ko) => (rifiuta = ko)));
    expect(avviso().hidden).toBe(true);
    pulsante('data-conferma').click();
    expect(pulsante('data-conferma').disabled).toBe(true);
    rifiuta(new ErroreModulo('Il veicolo ha un appuntamento aperto.'));
    await vi.waitFor(() => expect(avviso().hidden).toBe(false));
    expect(avviso().textContent?.trim()).toBe('Il veicolo ha un appuntamento aperto.');
    expect(dialogo()!.open).toBe(true);
    expect(pulsante('data-conferma').disabled).toBe(false);
    expect(pulsante('data-annulla').disabled).toBe(false);
    expect(pulsante('data-conferma').getAttribute('aria-busy')).toBeNull();
    expect(pulsante('data-conferma').textContent).toContain('Elimina veicolo');
    expect(document.activeElement).toBe(pulsante('data-annulla'));
  });

  it('azione che lancia un errore generico: mostra il testo fisso, non il messaggio tecnico', async () => {
    apri(vi.fn().mockRejectedValue(new Error('boom interno')));
    pulsante('data-conferma').click();
    await vi.waitFor(() => expect(avviso().hidden).toBe(false));
    expect(avviso().textContent?.trim()).toBe('Qualcosa è andato storto. Riprova tra poco.');
    expect(avviso().textContent).not.toContain('boom');
    expect(dialogo()!.open).toBe(true);
    expect(pulsante('data-conferma').disabled).toBe(false);
  });

  it('dopo un errore si può riprovare e l’errore sparisce', async () => {
    const azione = vi
      .fn()
      .mockRejectedValueOnce(new ErroreModulo('Errore'))
      .mockResolvedValue(undefined);
    apri(azione);
    pulsante('data-conferma').click();
    await vi.waitFor(() => expect(avviso().hidden).toBe(false));
    pulsante('data-conferma').click();
    expect(avviso().hidden).toBe(true);
    await vi.waitFor(() => expect(dialogo()).toBeNull());
    expect(azione).toHaveBeenCalledTimes(2);
  });

  describe('con campo', () => {
    const campo = { etichetta: 'Motivo (facoltativo)', max: 200 };

    it('mostra una textarea con label, maxlength e contatore iniziale', () => {
      apri(vi.fn().mockResolvedValue(undefined), { campo });
      const area = document.querySelector<HTMLTextAreaElement>('textarea')!;
      expect(area.getAttribute('maxlength')).toBe('200');
      const label = document.querySelector<HTMLLabelElement>(`label[for="${area.id}"]`)!;
      expect(label.textContent).toBe('Motivo (facoltativo)');
      expect(document.querySelector('[data-contatore]')!.textContent).toBe('0 / 200');
    });

    it('il contatore segue il testo e azione riceve il testo scritto', async () => {
      const azione = vi.fn().mockResolvedValue(undefined);
      apri(azione, { campo });
      const area = document.querySelector<HTMLTextAreaElement>('textarea')!;
      area.value = 'Ho venduto l’auto';
      area.dispatchEvent(new Event('input'));
      expect(document.querySelector('[data-contatore]')!.textContent).toBe('17 / 200');
      pulsante('data-conferma').click();
      expect(area.disabled).toBe(true);
      await vi.waitFor(() => expect(dialogo()).toBeNull());
      expect(azione).toHaveBeenCalledTimes(1);
      expect(azione).toHaveBeenCalledWith('Ho venduto l’auto');
    });

    it('se azione fallisce la textarea si riattiva e conserva il testo', async () => {
      apri(vi.fn().mockRejectedValue(new ErroreModulo('No')), { campo });
      const area = document.querySelector<HTMLTextAreaElement>('textarea')!;
      area.value = 'ciao';
      pulsante('data-conferma').click();
      await vi.waitFor(() => expect(avviso().hidden).toBe(false));
      expect(area.disabled).toBe(false);
      expect(area.value).toBe('ciao');
    });
  });

  it('senza campo non c’è nessuna textarea e azione riceve undefined', async () => {
    const azione = vi.fn().mockResolvedValue(undefined);
    apri(azione);
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.querySelector('[data-contatore]')).toBeNull();
    pulsante('data-conferma').click();
    await vi.waitFor(() => expect(dialogo()).toBeNull());
    expect(azione).toHaveBeenCalledWith(undefined);
  });
});
