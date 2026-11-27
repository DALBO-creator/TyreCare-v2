// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';
import type * as M_salute from '../lib/salute';

const { caricaPneumatico, caricaDatiUtente, ancoraAttuale } = vi.hoisted(() => ({
  caricaPneumatico: vi.fn(),
  caricaDatiUtente: vi.fn(),
  ancoraAttuale: vi.fn(),
}));
const { mostraPagina } = vi.hoisted(() => ({ mostraPagina: vi.fn() }));

// Si finge solo la lettura: tendenza, dataSoglia, mesiDalDot, formattaEta restano quelle vere
vi.mock('../lib/salute', async (importOriginal) => ({
  ...(await importOriginal<typeof M_salute>()),
  caricaPneumatico,
}));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraPneumatico } from './pneumatico';

const ID_PNEUMATICO = '11111111-1111-4111-8111-111111111111';
const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
const ID_VEICOLO = '33333333-3333-4333-8333-333333333333';
const ID_CONTROLLO = (n: number) => `4444444${n}-4444-4444-8444-444444444444`;

const TESTO_ASSENTE = "Lo pneumatico non esiste più oppure appartiene a un'altra officina.";
const TESTO_NON_MISURATO = 'Questo pneumatico non è ancora stato misurato.';
const TESTO_UNA_MISURA = 'Dal prossimo controllo qui vedrai come si consuma il battistrada.';
const TESTO_NON_CALATO =
  'Tra le misure il battistrada non è calato: non si può stimare il consumo.';

interface Misura {
  id: string;
  data: string;
  mm: number;
  km?: number | null;
  pressione?: number | null;
  usura?: string | null;
  danni?: string | null;
}

const misura = (m: Misura) => ({
  battistrada_mm: m.mm,
  pressione_bar: m.pressione ?? null,
  usura: m.usura ?? null,
  danni: m.danni ?? null,
  controllo: { id: m.id, eseguito_il: m.data, km: m.km ?? null },
});

const scheda = (misure: Misura[], extra: Record<string, unknown> = {}) => ({
  id: ID_PNEUMATICO,
  officina_id: ID_OFFICINA,
  veicolo_id: ID_VEICOLO,
  veicolo: { id: ID_VEICOLO, targa: 'AB123CD', marca: 'Fiat', modello: 'Panda' },
  marca: 'Pirelli',
  modello: 'Cinturato',
  misura: '185/65 R15',
  posizione: 'ANT_SX',
  stagione: 'ESTIVO',
  montato_il: '2026-03-10',
  smontato_il: null,
  dot: null,
  // Come `caricaPneumatico`: dalla più vecchia alla più recente
  misure: misure.map(misura),
  ...extra,
});

const monta = async (
  s: ReturnType<typeof scheda> | null,
  { membro = false, url = `/pneumatico?id=${ID_PNEUMATICO}` } = {},
) => {
  caricaPneumatico.mockResolvedValue(s);
  caricaDatiUtente.mockResolvedValue({
    officine: membro ? [{ officina: { id: ID_OFFICINA } }] : [],
  });
  history.replaceState(null, '', url);
  document.body.innerHTML = '<div id="app"></div>';
  await mostraPneumatico(document.getElementById('app')!);
};

const normalizza = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();

const sezione = (titolo: string) =>
  [...document.querySelectorAll('h2')]
    .find((h) => h.textContent?.startsWith(titolo))
    ?.closest('section') ?? null;

const testoAndamento = () =>
  normalizza(sezione('Andamento del battistrada')!.querySelector('p')?.textContent);

const righeDati = () =>
  [...sezione('Dati dello pneumatico')!.querySelectorAll('dl > div')].map((r) => [
    r.querySelector('dt')?.textContent,
    r.querySelector('dd')?.textContent,
  ]);

const righeMisure = () => [...document.querySelectorAll<HTMLAnchorElement>('.tc-misure a')];

beforeEach(() => {
  for (const f of [caricaPneumatico, caricaDatiUtente, mostraPagina]) f.mockReset();
  ancoraAttuale.mockReset().mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('scheda pneumatico: non trovato', () => {
  it('con un id non valido mostra «Pneumatico non trovato» senza leggere il database', async () => {
    await monta(null, { url: '/pneumatico?id=non-un-uuid' });

    expect(document.querySelector('h1')?.textContent).toBe('Pneumatico non trovato');
    expect(caricaPneumatico).not.toHaveBeenCalled();
  });

  it('se lo pneumatico non esiste (o non è visibile) mostra la stessa pagina col suo testo', async () => {
    await monta(null);

    expect(caricaPneumatico).toHaveBeenCalledWith(ID_PNEUMATICO);
    expect(document.querySelector('h1')?.textContent).toBe('Pneumatico non trovato');
    expect(normalizza(document.querySelector('.tc-vuoto__testo')?.textContent)).toBe(TESTO_ASSENTE);
  });

  it('se la visualizzazione è cambiata durante la lettura non disegna la pagina', async () => {
    ancoraAttuale.mockReturnValue(false);
    await monta(scheda([{ id: ID_CONTROLLO(1), data: '2026-10-01', mm: 6 }]));

    expect(document.querySelector('h1')).toBeNull();
    expect(document.body.textContent).not.toContain('Torna al veicolo');
  });
});

describe('scheda pneumatico: andamento del battistrada', () => {
  it('senza misure dice che non è stato misurato; niente grafico, elenco o indicatore', async () => {
    await monta(scheda([]));

    expect(testoAndamento()).toBe(TESTO_NON_MISURATO);
    expect(document.querySelector('svg[role="img"]')).toBeNull();
    expect(sezione('Misure (')).toBeNull();
    expect(document.querySelector('.tc-salute')).toBeNull();
  });

  it('con una sola misura dice che serve un altro controllo; niente grafico né stima', async () => {
    await monta(scheda([{ id: ID_CONTROLLO(1), data: '2026-10-01', mm: 6 }]));

    expect(testoAndamento()).toBe(TESTO_UNA_MISURA);
    expect(sezione('Andamento del battistrada')!.querySelector('svg')).toBeNull();
    expect(document.body.textContent).not.toContain('Il battistrada cala');
  });

  it('con tre misure in calo mostra il grafico e la stima calcolata', async () => {
    // Giorni: 1 set → 1 ott = 30, 1 ott → 31 ott = 30. Calo di 1 mm ogni 30 giorni (8 → 7 → 6)
    // e di 1 mm ogni 5.000 km (10.000 → 15.000 → 20.000 km).
    //  - al mese: 1/30 × 30,44 = 1,0147 → «1,0»; ogni 10.000 km: 2 → «2,0»
    //  - 3 mm consigliati (estivo): 3 mm sotto l'ultima misura = 90 giorni dopo il 31/10/2026 → gennaio 2027
    //  - 1,6 mm del limite: 4,4 mm = 132 giorni dopo il 31/10/2026 → marzo 2027
    await monta(
      scheda([
        { id: ID_CONTROLLO(1), data: '2026-09-01', mm: 8, km: 10000 },
        { id: ID_CONTROLLO(2), data: '2026-10-01', mm: 7, km: 15000 },
        { id: ID_CONTROLLO(3), data: '2026-10-31', mm: 6, km: 20000 },
      ]),
    );

    const grafico = sezione('Andamento del battistrada')!.querySelector('svg[role="img"]');
    expect(grafico?.getAttribute('aria-label')).toBe(
      'Battistrada da 8,0 mm il 1 settembre 2026 a 6,0 mm il 31 ottobre 2026',
    );
    expect(testoAndamento()).toBe(
      'Il battistrada cala di circa 1,0 mm al mese (2,0 mm ogni 10.000 km). ' +
        'Se continua così arriverà ai 3 mm consigliati verso gennaio 2027 ' +
        'e ai 1,6 mm del limite di legge verso marzo 2027. ' +
        'È una stima: dipende da come e quanto guidi.',
    );
  });

  it('con misure uguali in giorni diversi dice che non si può stimare il consumo', async () => {
    await monta(
      scheda([
        { id: ID_CONTROLLO(1), data: '2026-09-01', mm: 5 },
        { id: ID_CONTROLLO(2), data: '2026-10-01', mm: 5 },
        { id: ID_CONTROLLO(3), data: '2026-10-31', mm: 5 },
      ]),
    );

    expect(testoAndamento()).toBe(TESTO_NON_CALATO);
    expect(document.body.textContent).not.toContain('Il battistrada cala');
    // Il grafico c'è comunque: ci sono tre punti
    expect(sezione('Andamento del battistrada')!.querySelector('svg[role="img"]')).not.toBeNull();
  });
});

describe('scheda pneumatico: dati dello pneumatico', () => {
  beforeEach(() => {
    // oggi() usa il fuso del dispositivo: data e ora locali
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T12:00:00'));
  });

  it('con il DOT 3823 calcola l’età alla data di oggi, senza l’avviso della gomma vecchia', async () => {
    // Settimana 38 del 2023: 1 gen 2023 + 37 × 7 giorni = 17 settembre 2023.
    // Al 27/11/2026: 3 anni (36 mesi) + ottobre e novembre (il 27 ≥ 17) = 38 mesi → 3 anni e 2 mesi
    await monta(scheda([], { dot: '3823' }));

    expect(righeDati()).toEqual([
      ['Montato il', '10 marzo 2026'],
      ['DOT', '3823'],
      ['Età', '3 anni e 2 mesi'],
    ]);
    expect(document.body.textContent).not.toContain('Oltre i 5 anni');
  });

  it('con un DOT di oltre 5 anni mostra l’avviso', async () => {
    // Settimana 1 del 2019 = 1 gen 2019: al 27/11/2026 sono 7 anni e 10 mesi (94 mesi ≥ 60)
    await monta(scheda([], { dot: '0119' }));

    expect(righeDati()).toContainEqual(['Età', '7 anni e 10 mesi']);
    expect(normalizza(document.querySelector('.tc-ruota__pneumatico')?.textContent)).toBe(
      'Oltre i 5 anni la gomma indurisce anche con molto battistrada: chiedi alla tua officina di controllarla.',
    );
  });

  it('senza DOT le righe «DOT» ed «Età» non ci sono (il codice non scrive un testo)', async () => {
    await monta(scheda([], { dot: null }));

    expect(righeDati()).toEqual([['Montato il', '10 marzo 2026']]);
    expect(document.body.textContent).not.toContain('Oltre i 5 anni');
  });

  it('con una gomma smontata aggiunge la riga «Smontato il» e l’avviso nella pagina', async () => {
    await monta(scheda([], { smontato_il: '2026-11-03' }));

    expect(righeDati()).toEqual([
      ['Montato il', '10 marzo 2026'],
      ['Smontato il', '3 novembre 2026'],
    ]);
    expect(normalizza(document.querySelector('.tc-avviso[role="status"]')?.textContent)).toBe(
      'Smontato: non è più sul veicolo dal 3 novembre 2026. Qui restano le sue misure.',
    );
  });

  it('senza smontaggio non c’è né l’avviso né la riga', async () => {
    await monta(scheda([]));

    expect(document.querySelector('.tc-avviso[role="status"]')).toBeNull();
    expect(righeDati().map(([k]) => k)).toEqual(['Montato il']);
  });
});

describe('scheda pneumatico: elenco delle misure', () => {
  // Invernale: ROSSO sotto 1,6, GIALLO sotto 4, altrimenti VERDE
  const tre = () =>
    scheda(
      [
        { id: ID_CONTROLLO(1), data: '2026-06-10', mm: 4, km: 10000 },
        { id: ID_CONTROLLO(2), data: '2026-09-15', mm: 3.5, usura: 'REGOLARE' },
        {
          id: ID_CONTROLLO(3),
          data: '2026-11-20',
          mm: 1.5,
          km: 20000,
          pressione: 2.2,
          usura: 'INTERNA',
          danni: 'Taglio sul fianco',
        },
      ],
      { stagione: 'INVERNALE' },
    );

  it('le elenca dalla più recente, col titolo e i link ai controlli', async () => {
    await monta(tre());

    expect(sezione('Misure (')!.querySelector('h2')?.textContent).toBe('Misure (3)');
    expect(righeMisure().map((a) => a.getAttribute('href'))).toEqual([
      `/controllo?id=${ID_CONTROLLO(3)}`,
      `/controllo?id=${ID_CONTROLLO(2)}`,
      `/controllo?id=${ID_CONTROLLO(1)}`,
    ]);
  });

  it('ogni riga ha data, millimetri, stato con le soglie vere e dettagli', async () => {
    await monta(tre());

    const [recente, mezzo, vecchia] = righeMisure();
    expect(normalizza(recente!.querySelector('.tc-lista__testo')?.textContent)).toBe(
      '20 novembre 2026 · 1,5 mm 20.000 km · 2,2 bar · usura sul lato interno · Taglio sul fianco',
    );
    expect(normalizza(mezzo!.querySelector('.tc-lista__testo')?.textContent)).toBe(
      '15 settembre 2026 · 3,5 mm',
    );
    expect(normalizza(vecchia!.querySelector('.tc-lista__testo')?.textContent)).toBe(
      '10 giugno 2026 · 4,0 mm 10.000 km',
    );
    // 1,5 < 1,6 → rosso; 3,5 < 4 (invernale) → giallo; 4 non è < 4 → verde
    expect(recente!.querySelector('.tc-stato')?.textContent?.trim()).toBe('Da sostituire');
    expect(mezzo!.querySelector('.tc-stato')?.textContent?.trim()).toBe('Da controllare');
    expect(vecchia!.querySelector('.tc-stato')?.textContent?.trim()).toBe('In buono stato');
  });

  it('l’usura REGOLARE non compare nel dettaglio', async () => {
    await monta(tre());

    expect(document.querySelector('.tc-misure')?.textContent).not.toContain('Regolare');
    expect(document.querySelector('.tc-misure')?.textContent).not.toContain('usura regolare');
  });
});

describe('scheda pneumatico: testata e ritorno al veicolo', () => {
  const unaMisura = () =>
    scheda([
      { id: ID_CONTROLLO(1), data: '2026-09-01', mm: 8, km: 10000 },
      { id: ID_CONTROLLO(2), data: '2026-10-31', mm: 2.5, km: 41250 },
    ]);

  it('mostra nome, posizione, stagione e misura; l’ultima misura è la più recente', async () => {
    await monta(unaMisura());

    expect(document.querySelector('h1')?.textContent?.trim()).toBe('Pirelli Cinturato');
    expect(document.querySelector('.tc-etichetta')?.textContent).toBe('Anteriore sinistro');
    expect(normalizza(document.querySelector('.tc-hero__dettagli')?.textContent)).toBe(
      'AB 123 CD Estivi 185/65 R15',
    );
    expect(normalizza(document.querySelector('.tc-salute__testo')?.textContent)).toBe(
      'Ultima misura 31 ottobre 2026 a 41.250 km',
    );
    // 2,5 mm su gomma estiva: sotto i 3 consigliati → giallo
    expect(
      document.querySelector('.tc-salute [role="meter"]')?.getAttribute('aria-valuetext'),
    ).toBe('2,5 millimetri, da controllare');
  });

  it('chi lavora nell’officina torna alla scheda del veicolo dell’officina', async () => {
    await monta(unaMisura(), { membro: true });

    const link = [...document.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Torna al veicolo'),
    );
    expect(link?.getAttribute('href')).toBe(`/veicolo?id=${ID_VEICOLO}`);
  });

  it('il cliente torna al veicolo del garage, per targa', async () => {
    await monta(unaMisura(), { membro: false });

    const link = [...document.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Torna al veicolo'),
    );
    expect(link?.getAttribute('href')).toBe('/garage/veicolo?targa=AB123CD');
  });
});
