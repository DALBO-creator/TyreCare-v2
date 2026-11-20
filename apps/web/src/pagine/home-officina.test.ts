// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatiUtente } from '../lib/profilo';

vi.mock('../ui/layout', () => ({
  paginaApp: (corpo: string) => corpo,
  caricamento: () => '',
}));
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));
vi.mock('../lib/officina', () => ({
  caricaVeicoli: vi.fn().mockResolvedValue([]),
  eTitolare: () => false,
  officinaAttiva: (o: unknown[]) => o[0],
  scegliOfficina: vi.fn(),
}));
vi.mock('../lib/prenotazioni', () => ({
  contaRichiesteDaConfermare: vi.fn().mockResolvedValue(0),
}));
vi.mock('../lib/dati-officina', () => ({ officinaOffreStrada: vi.fn().mockResolvedValue(false) }));
vi.mock('../lib/strada-conta', () => ({
  contaRichiesteStradaVicine: vi.fn().mockResolvedValue(0),
}));
vi.mock('../lib/primi-passi', () => ({
  leggiStatoPrimiPassi: vi.fn(),
  nascondi: vi.fn(),
  nascosta: () => true,
  passiPrimiPassi: vi.fn(),
}));
vi.mock('../lib/router', () => ({
  ancoraAttuale: () => true,
  mostraPagina: vi.fn(),
  visualizzazioneCorrente: () => 1,
}));
vi.mock('../lib/auth', () => ({ messaggioErrore: () => 'Errore', esci: vi.fn() }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraHomeOfficina, titoloVisibile } from './home-officina';

const dati = {
  email: 'titolare@esempio.it',
  profilo: { id: 'u1', nome: 'Mario', cognome: 'Rossi', ruolo: 'OFFICINA' },
  officine: [
    {
      ruolo: 'TITOLARE',
      officina: { id: 'o1', ragione_sociale: 'Gomme Rossi', stato_affiliazione: 'ATTIVA' },
    },
  ],
} as unknown as DatiUtente;

const monta = async (veicoliGarage?: number) => {
  document.body.innerHTML = '<div id="app"></div>';
  await mostraHomeOfficina(document.getElementById('app')!, 1, dati, veicoliGarage);
};
const link = () => document.querySelector<HTMLAnchorElement>('a[href="/garage"]');

describe('link al garage nella home dell’officina', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
  });

  it('senza veicoli nel garage non c’è il link', async () => {
    await monta(0);
    expect(document.querySelector('h1')).not.toBeNull();
    expect(link()).toBeNull();
  });

  it('senza il parametro non c’è il link', async () => {
    await monta();
    expect(link()).toBeNull();
  });

  it('con un veicolo il testo è al singolare', async () => {
    await monta(1);
    expect(link()?.textContent).toBe('Il tuo garage · 1 veicolo');
  });

  it('con più veicoli il testo è al plurale', async () => {
    await monta(3);
    expect(link()?.textContent).toBe('Il tuo garage · 3 veicoli');
  });
});

describe('titoloVisibile', () => {
  it('è visibile se sta tutto dentro la finestra', () => {
    expect(titoloVisibile({ top: 10, bottom: 80 }, 600)).toBe(true);
  });
  it('non è visibile se il bordo alto è sopra la finestra', () => {
    expect(titoloVisibile({ top: -5, bottom: 60 }, 600)).toBe(false);
  });
  it('non è visibile se il bordo basso è sotto la finestra', () => {
    expect(titoloVisibile({ top: 560, bottom: 640 }, 600)).toBe(false);
  });
});
