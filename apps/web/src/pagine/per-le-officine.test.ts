// @vitest-environment happy-dom
import {
  CONTATTO_EMAIL,
  GIORNI_PROVA,
  PIANI,
  PREZZO_INSTALLAZIONE,
  PianoSchema,
  SITO_URL,
  formattaEuro,
  linkContatto,
  prezzoPiano,
} from '@tyrecare/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraPerLeOfficine } from './per-le-officine';

const app = () => document.getElementById('app')!;
const testo = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  mostraPerLeOfficine(app());
});

describe('Per le officine: prezzi', () => {
  it.each(PianoSchema.options)('piano %s: nome e prezzo vengono da PIANI', (piano) => {
    const sezione = app().querySelector(`section[aria-labelledby="tc-prezzo-${piano}"]`)!;
    expect(sezione.querySelector('h3')!.textContent).toBe(PIANI[piano].nome);
    expect(testo(sezione)).toContain(prezzoPiano(piano));
    if (PIANI[piano].nota) expect(testo(sezione)).toContain(PIANI[piano].nota);
    else expect(sezione.querySelectorAll('p')).toHaveLength(1);
  });

  it('mostra una carta per ogni piano', () => {
    expect(app().querySelectorAll('section[aria-labelledby^="tc-prezzo-"]')).toHaveLength(
      PianoSchema.options.length,
    );
  });

  it('installazione e giorni di prova vengono dalle costanti', () => {
    expect(testo(app())).toContain(`Installazione e avvio: ${formattaEuro(PREZZO_INSTALLAZIONE)}`);
    expect(testo(app())).toContain(`${GIORNI_PROVA} giorni di prova gratuita`);
  });
});

describe('Per le officine: domande frequenti', () => {
  it('elenca i titoli del codice, in ordine', () => {
    const titoli = [...app().querySelectorAll('details > summary')].map((s) => s.textContent);
    expect(titoli).toEqual([
      'Devo reinserire i miei clienti?',
      'I miei clienti devono scaricare un’app?',
      'Quanto costa e quando pago?',
      'Posso smettere quando voglio?',
      'I dati sono miei?',
      'Funziona al computer e al telefono?',
    ]);
  });

  it('la risposta sui costi cita i giorni di prova', () => {
    const d = [...app().querySelectorAll('details')].find((x) =>
      x.querySelector('summary')!.textContent!.startsWith('Quanto costa'),
    )!;
    expect(testo(d)).toContain(`i primi ${GIORNI_PROVA} giorni`);
  });

  it('disdetta: il contatto è CONTATTO_EMAIL con oggetto dedicato', () => {
    const link = [...app().querySelectorAll('details a')].find(
      (a) => a.textContent === CONTATTO_EMAIL,
    )!;
    expect(link.getAttribute('href')).toBe(linkContatto('Disdetta abbonamento'));
  });
});

describe('Per le officine: link', () => {
  it('registrazione e accesso portano a /officina/registra', () => {
    const link = (nome: string) => [...app().querySelectorAll('a')].find((a) => testo(a) === nome)!;
    expect(link('Registra la tua officina').getAttribute('href')).toBe(
      '/registrati?dopo=/officina/registra',
    );
    expect(link('Accedi').getAttribute('href')).toBe('/accedi?dopo=/officina/registra');
  });

  it('il sito si apre in una scheda nuova senza opener', () => {
    const a = app().querySelector<HTMLAnchorElement>(`a[href="${SITO_URL}"]`)!;
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
