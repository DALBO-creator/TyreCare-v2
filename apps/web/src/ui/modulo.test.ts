// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ErroreModulo } from '../lib/errori';
import { areaTesto, campo, collegaModulo, pulsanteInvio, RIQUADRO_ERRORE, scelta } from './modulo';

const html = (s: string) => {
  const t = document.createElement('div');
  t.innerHTML = s;
  return t;
};

describe('campo, scelta, areaTesto: id, label e aria-describedby', () => {
  it('campo con aiuto: id, label for e descrizione con aiuto ed errore', () => {
    const r = html(
      campo({
        nome: 'targa',
        etichetta: 'Targa',
        tipo: 'text',
        autocomplete: 'off',
        aiuto: 'Es. AB123CD',
      }),
    );
    const input = r.querySelector('input')!;
    expect(input.id).toBe('campo-targa');
    expect(input.name).toBe('targa');
    expect(r.querySelector('label')!.getAttribute('for')).toBe('campo-targa');
    expect(input.getAttribute('aria-describedby')).toBe('campo-targa-aiuto campo-targa-errore');
    expect(r.querySelector('#campo-targa-aiuto')!.textContent).toBe('Es. AB123CD');
    expect(r.querySelector('#campo-targa-errore')!.hasAttribute('hidden')).toBe(true);
  });

  it('campo senza aiuto: la descrizione è solo l’errore e non c’è il blocco aiuto', () => {
    const r = html(campo({ nome: 'nome', etichetta: 'Nome', tipo: 'text', autocomplete: 'name' }));
    expect(r.querySelector('input')!.getAttribute('aria-describedby')).toBe('campo-nome-errore');
    expect(r.querySelector('#campo-nome-aiuto')).toBeNull();
  });

  it('scelta con aiuto e senza', () => {
    const opzioni = [
      ['', 'Nessuna'],
      ['a', 'A'],
    ] as const;
    const con = html(scelta({ nome: 'tipo', etichetta: 'Tipo', opzioni, aiuto: 'Aiuto' }));
    const sel = con.querySelector('select')!;
    expect(sel.id).toBe('campo-tipo');
    expect(con.querySelector('label')!.getAttribute('for')).toBe('campo-tipo');
    expect(sel.getAttribute('aria-describedby')).toBe('campo-tipo-aiuto campo-tipo-errore');
    const senza = html(scelta({ nome: 'tipo', etichetta: 'Tipo', opzioni }));
    expect(senza.querySelector('select')!.getAttribute('aria-describedby')).toBe(
      'campo-tipo-errore',
    );
  });

  it('areaTesto con aiuto e senza', () => {
    const con = html(areaTesto({ nome: 'note', etichetta: 'Note', aiuto: 'Aiuto' }));
    const ta = con.querySelector('textarea')!;
    expect(ta.id).toBe('campo-note');
    expect(con.querySelector('label')!.getAttribute('for')).toBe('campo-note');
    expect(ta.getAttribute('aria-describedby')).toBe('campo-note-aiuto campo-note-errore');
    const senza = html(areaTesto({ nome: 'note', etichetta: 'Note' }));
    expect(senza.querySelector('textarea')!.getAttribute('aria-describedby')).toBe(
      'campo-note-errore',
    );
  });
});

describe('collegaModulo', () => {
  const schema = z.object({
    nome: z.string().trim().min(1, 'Inserisci il nome'),
    note: z
      .string()
      .trim()
      .min(1, 'Inserisci le note')
      .transform((v) => v.toUpperCase()),
  });
  const invia = vi.fn<(d: z.output<typeof schema>) => Promise<void>>();
  let form: HTMLFormElement;
  const errore = (n: string) => document.getElementById(`campo-${n}-errore`)!;
  const input = (n: string) => document.getElementById(`campo-${n}`) as HTMLInputElement;
  const riquadro = () => document.querySelector<HTMLElement>('[data-errore-modulo]')!;
  const pulsante = () => document.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const compila = () => {
    input('nome').value = '  Mario ';
    input('note').value = 'ciao';
  };

  beforeEach(() => {
    invia.mockReset();
    document.body.innerHTML = `<form>${campo({ nome: 'nome', etichetta: 'Nome', tipo: 'text', autocomplete: 'name' })}
      ${areaTesto({ nome: 'note', etichetta: 'Note' })}${RIQUADRO_ERRORE}${pulsanteInvio('Salva', 'Salvataggio in corso')}</form>`;
    form = document.querySelector('form')!;
    collegaModulo(form, schema, invia);
  });

  it('campi vuoti: errori sotto i campi giusti, aria-invalid, focus sul primo errato, azione non chiamata', async () => {
    form.requestSubmit();
    await vi.waitFor(() => expect(input('nome').getAttribute('aria-invalid')).toBe('true'));
    expect(input('note').getAttribute('aria-invalid')).toBe('true');
    expect(errore('nome').textContent).toBe('Inserisci il nome');
    expect(errore('nome').hidden).toBe(false);
    expect(errore('note').textContent).toBe('Inserisci le note');
    expect(document.activeElement).toBe(input('nome'));
    expect(invia).not.toHaveBeenCalled();
    expect(pulsante().disabled).toBe(false);
  });

  it('solo il secondo campo errato: il focus va sul secondo', async () => {
    input('nome').value = 'Mario';
    form.requestSubmit();
    await vi.waitFor(() => expect(input('note').getAttribute('aria-invalid')).toBe('true'));
    expect(input('nome').getAttribute('aria-invalid')).toBe('false');
    expect(errore('nome').hidden).toBe(true);
    expect(document.activeElement).toBe(input('note'));
  });

  it('invio valido: una chiamata con dati trasformati; pulsante in corso finché la promessa non finisce', async () => {
    let risolvi!: () => void;
    invia.mockReturnValue(new Promise<void>((r) => (risolvi = r)));
    compila();
    form.requestSubmit();
    await vi.waitFor(() => expect(pulsante().disabled).toBe(true));
    expect(invia).toHaveBeenCalledTimes(1);
    expect(invia).toHaveBeenCalledWith({ nome: 'Mario', note: 'CIAO' });
    expect(pulsante().textContent).toContain('Salvataggio in corso');
    expect(pulsante().getAttribute('aria-busy')).toBe('true');
    risolvi();
    await vi.waitFor(() => expect(pulsante().disabled).toBe(false));
    expect(pulsante().textContent!.trim()).toBe('Salva');
    expect(pulsante().getAttribute('aria-busy')).toBe('false');
  });

  it('doppio invio durante l’attesa: una sola chiamata', async () => {
    let risolvi!: () => void;
    invia.mockReturnValue(new Promise<void>((r) => (risolvi = r)));
    compila();
    form.requestSubmit();
    await vi.waitFor(() => expect(pulsante().disabled).toBe(true));
    form.requestSubmit();
    form.requestSubmit();
    expect(invia).toHaveBeenCalledTimes(1);
    risolvi();
    await vi.waitFor(() => expect(pulsante().disabled).toBe(false));
    expect(invia).toHaveBeenCalledTimes(1);
  });

  it('ErroreModulo con campo: errore sotto quel campo, focus lì, riquadro nascosto', async () => {
    invia.mockRejectedValue(new ErroreModulo('Targa già registrata', 'note'));
    compila();
    form.requestSubmit();
    await vi.waitFor(() => expect(errore('note').textContent).toBe('Targa già registrata'));
    expect(errore('note').hidden).toBe(false);
    expect(input('note').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('note'));
    expect(riquadro().hidden).toBe(true);
    expect(pulsante().disabled).toBe(false);
  });

  it('ErroreModulo senza campo: riquadro con il messaggio e focus sul riquadro', async () => {
    invia.mockRejectedValue(new ErroreModulo('Non consentito'));
    compila();
    form.requestSubmit();
    await vi.waitFor(() => expect(riquadro().hidden).toBe(false));
    expect(riquadro().textContent).toBe('Non consentito');
    expect(document.activeElement).toBe(riquadro());
    expect(pulsante().disabled).toBe(false);
  });

  it('errore generico: riquadro con il testo fisso (non il messaggio originale)', async () => {
    invia.mockRejectedValue(new Error('x'));
    compila();
    form.requestSubmit();
    await vi.waitFor(() => expect(riquadro().hidden).toBe(false));
    expect(riquadro().textContent).toBe('Qualcosa è andato storto. Riprova tra poco.');
    expect(document.activeElement).toBe(riquadro());
  });

  it('un nuovo invio nasconde il riquadro precedente', async () => {
    invia.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    compila();
    form.requestSubmit();
    await vi.waitFor(() => expect(riquadro().hidden).toBe(false));
    form.requestSubmit();
    await vi.waitFor(() => expect(invia).toHaveBeenCalledTimes(2));
    expect(riquadro().hidden).toBe(true);
  });

  it('reset del modulo: toglie errori e riquadro, e la validazione resta attiva', () => {
    const esci = () => input('nome').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    input('nome').value = '';
    input('nome').dispatchEvent(new Event('input', { bubbles: true }));
    esci();
    riquadro().hidden = false;
    expect(input('nome').classList.contains('is-invalid')).toBe(true);
    expect(errore('nome').hidden).toBe(false);

    form.reset();
    expect(input('nome').classList.contains('is-invalid')).toBe(false);
    expect(input('nome').getAttribute('aria-invalid')).toBe('false');
    expect(errore('nome').hidden).toBe(true);
    expect(riquadro().hidden).toBe(true);

    esci();
    expect(input('nome').classList.contains('is-invalid')).toBe(false);

    input('nome').dispatchEvent(new Event('input', { bubbles: true }));
    esci();
    expect(input('nome').classList.contains('is-invalid')).toBe(true);
    expect(errore('nome').textContent).toBe('Inserisci il nome');
  });
});
