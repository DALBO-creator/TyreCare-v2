// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlAvvisoAggiornamento, mostraAvvisoAggiornamento } from './aggiornamento';

describe('htmlAvvisoAggiornamento', () => {
  const html = htmlAvvisoAggiornamento();

  it('è un riquadro di stato marcato per evitare le copie', () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('data-aggiornamento');
    expect(html).toContain('tc-avviso tc-avviso--info tc-aggiornamento');
  });

  it('ha il testo esatto', () => {
    expect(html).toContain('È disponibile una nuova versione di TyreCare.');
  });

  it('ha i pulsanti "Aggiorna" e "Più tardi", entrambi di tipo button', () => {
    expect(html).toContain(
      '<button type="button" class="btn btn-primary btn-sm" data-aggiorna>Aggiorna</button>',
    );
    expect(html).toContain(
      '<button type="button" class="btn btn-link btn-sm" data-piu-tardi>Più tardi</button>',
    );
    expect(html.match(/<button /g)).toHaveLength(2);
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
  });
});

describe('mostraAvvisoAggiornamento', () => {
  const riquadri = () => document.querySelectorAll('[data-aggiornamento]');
  const clic = (sel: string) => document.querySelector<HTMLButtonElement>(sel)!.click();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // "Più tardi" azzera anche lo stato di modulo (`aggiornaCorrente`): indipendente dall'ordine
    if (riquadri().length) clic('[data-piu-tardi]');
    vi.runAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('due chiamate mostrano una sola copia', () => {
    mostraAvvisoAggiornamento(vi.fn());
    mostraAvvisoAggiornamento(vi.fn());
    expect(riquadri()).toHaveLength(1);
  });

  it('due clic su "Aggiorna" chiamano la callback una volta e disabilitano il pulsante', () => {
    const cb = vi.fn();
    mostraAvvisoAggiornamento(cb);
    clic('[data-aggiorna]');
    clic('[data-aggiorna]');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLButtonElement>('[data-aggiorna]')!.disabled).toBe(true);
  });

  it('"Più tardi" chiude il riquadro e una nuova chiamata lo rimostra', () => {
    mostraAvvisoAggiornamento(vi.fn());
    clic('[data-piu-tardi]');
    expect(riquadri()).toHaveLength(0);
    mostraAvvisoAggiornamento(vi.fn());
    expect(riquadri()).toHaveLength(1);
  });

  it('"Più tardi" prima del giro dei timer non lancia', () => {
    mostraAvvisoAggiornamento(vi.fn());
    clic('[data-piu-tardi]');
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  it('la seconda chiamata sostituisce la callback', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    mostraAvvisoAggiornamento(cb1);
    mostraAvvisoAggiornamento(cb2);
    clic('[data-aggiorna]');
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
  });

  it('il testo si scrive al giro successivo, così viene annunciato', () => {
    mostraAvvisoAggiornamento(vi.fn());
    const p = document.querySelector('.tc-aggiornamento__testo')!;
    expect(p.textContent).toBe('');
    vi.runAllTimers();
    expect(p.textContent).toBe('È disponibile una nuova versione di TyreCare.');
  });
});
