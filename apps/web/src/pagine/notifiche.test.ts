// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as routerReale from '../lib/router';
import type { Notifica } from '../lib/notifiche';
// Elenco dei tipi dal file generato dal database (non ri-esportato da `@tyrecare/shared`)
import { Constants } from '../../../../packages/shared/src/database.types';

const { caricaNotifiche, leggiEmailNotifiche, salvaEmailNotifiche, segnaLette, caricaDatiUtente } =
  vi.hoisted(() => ({
    caricaNotifiche: vi.fn(),
    leggiEmailNotifiche: vi.fn(),
    salvaEmailNotifiche: vi.fn(),
    segnaLette: vi.fn(),
    caricaDatiUtente: vi.fn(),
  }));
vi.mock('../lib/notifiche', () => ({
  caricaNotifiche,
  leggiEmailNotifiche,
  salvaEmailNotifiche,
  segnaLette,
  tempoTrascorso: () => 'ora',
  // usate dal layout della pagina
  avviaNotifiche: () => undefined,
  notificheNonLette: () => 0,
  numeroBadge: String,
  testoNonLette: () => '',
}));
vi.mock('../lib/profilo', () => ({ caricaDatiUtente, lavoraInOfficina: () => false }));
vi.mock('../ui/avvisi-push', () => ({ collegaAvvisiPush: vi.fn() }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof routerReale>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
}));

import { mostraNotifiche } from './notifiche';

const nota = (extra: Partial<Notifica> = {}): Notifica =>
  ({
    id: 'n1',
    tipo: 'CONFERMATA',
    titolo: 'Appuntamento confermato',
    testo: 'Ti aspettiamo martedì',
    link: '/clienti/importa',
    created_at: '2026-11-16T10:00:00Z',
    letta_il: null,
    ...extra,
  }) as Notifica;

const app = () => document.getElementById('app')!;
const apri = () => mostraNotifiche(app());
const testo = () => app().textContent!.replace(/\s+/g, ' ');

beforeEach(() => {
  vi.resetAllMocks();
  caricaNotifiche.mockResolvedValue([]);
  leggiEmailNotifiche.mockResolvedValue(false);
  segnaLette.mockResolvedValue(undefined);
  caricaDatiUtente.mockResolvedValue(null);
  document.body.innerHTML = '<div id="app"></div>';
});

describe('pagina delle notifiche', () => {
  it('ogni tipo di notifica del database ha la sua icona', async () => {
    const tipi = Constants.public.Enums.tipo_notifica;
    caricaNotifiche.mockResolvedValue(
      tipi.map((tipo, i) => nota({ id: `n${i}`, tipo, letta_il: '2026-11-16T11:00:00Z' })),
    );
    await apri();
    const icone = [...app().querySelectorAll('.tc-notifica .tc-lista__icona')];
    expect(icone).toHaveLength(tipi.length);
    icone.forEach((el, i) => {
      // un'icona vera ha dei tracciati dentro l'svg; una voce mancante dà un svg vuoto
      expect(
        el.querySelectorAll('svg > *').length,
        `icona mancante per ${tipi[i]}`,
      ).toBeGreaterThan(0);
    });
  });

  it('senza notifiche mostra lo stato vuoto', async () => {
    await apri();
    expect(testo()).toContain('Nessuna notifica');
    expect(testo()).toContain(
      'Qui trovi le novità su appuntamenti, controlli delle gomme e aiuto su strada.',
    );
    expect(app().querySelector('.tc-notifica')).toBeNull();
    expect(segnaLette).not.toHaveBeenCalled();
  });

  it('una notifica non letta è evidenziata e porta al suo link', async () => {
    caricaNotifiche.mockResolvedValue([
      nota({ id: 'a', letta_il: null }),
      nota({ id: 'b', titolo: 'Già vista', letta_il: '2026-11-16T11:00:00Z' }),
    ]);
    await apri();
    const righe = [...app().querySelectorAll<HTMLAnchorElement>('a.tc-notifica')];
    const nuova = righe[0]!;
    const vecchia = righe[1]!;
    expect(nuova.classList.contains('tc-notifica--nuova')).toBe(true);
    expect(nuova.getAttribute('href')).toBe('/clienti/importa');
    expect(nuova.textContent).toContain('Nuova:');
    expect(vecchia.classList.contains('tc-notifica--nuova')).toBe(false);
  });

  it('aprendo la pagina con notifiche non lette le segna lette una volta sola', async () => {
    caricaNotifiche.mockResolvedValue([nota(), nota({ id: 'n2' })]);
    await apri();
    expect(segnaLette).toHaveBeenCalledTimes(1);
  });

  it('con tutte le notifiche già lette non chiama segnaLette', async () => {
    caricaNotifiche.mockResolvedValue([nota({ letta_il: '2026-11-16T11:00:00Z' })]);
    await apri();
    expect(segnaLette).not.toHaveBeenCalled();
  });

  it('la sezione Email rispecchia la scelta salvata e la salva al cambio', async () => {
    leggiEmailNotifiche.mockResolvedValue(true);
    salvaEmailNotifiche.mockResolvedValue(undefined);
    await apri();
    const input = app().querySelector<HTMLInputElement>('#tc-email-notifiche')!;
    expect(input.checked).toBe(true);
    input.checked = false;
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(salvaEmailNotifiche).toHaveBeenCalledWith(false));
  });

  it('se il salvataggio dell’email fallisce ripristina l’interruttore e mostra l’errore', async () => {
    salvaEmailNotifiche.mockRejectedValue(new Error('rete'));
    await apri();
    const input = app().querySelector<HTMLInputElement>('#tc-email-notifiche')!;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    const errore = app().querySelector<HTMLElement>('[data-email-errore]')!;
    await vi.waitFor(() => expect(errore.hidden).toBe(false));
    expect(input.checked).toBe(false);
    expect(errore.textContent).toContain('Non è stato possibile salvare la scelta');
  });
});
