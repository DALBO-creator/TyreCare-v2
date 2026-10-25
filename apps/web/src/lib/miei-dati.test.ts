import { describe, expect, it } from 'vitest';
import { componiMieiDati, type PartiMieiDati } from './miei-dati';

const parti: PartiMieiDati = {
  email: 'cliente@tyrecare.test',
  profilo: { id: 'p1', nome: 'Carlo', cognome: 'Bianchi', telefono: '+39 333 1234567' },
  clientiOfficine: [{ id: 'c1', officina: { ragione_sociale: 'Gomme Rossi' } }],
  garage: [],
  prenotazioni: [{ id: 'b1', targa: 'AB123CD' }],
  notifiche: [{ id: 'n1', titolo: 'Confermata' }],
  commenti: [],
  officineLavoro: [],
  iscrizioniPush: 2,
};

describe('componiMieiDati', () => {
  it('restituisce versione, data e tutte le chiavi previste', () => {
    const r = componiMieiDati(parti, '2026-10-25T10:00:00.000Z');
    expect(r.versione).toBe(1);
    expect(r.generato_il).toBe('2026-10-25T10:00:00.000Z');
    expect(Object.keys(r)).toEqual([
      'versione',
      'generato_il',
      'account',
      'profilo',
      'clienti_officine',
      'garage',
      'prenotazioni',
      'notifiche',
      'commenti',
      'officine_lavoro',
      'iscrizioni_push',
    ]);
    expect(r.account).toEqual({ email: 'cliente@tyrecare.test' });
    expect(r.clienti_officine).toEqual(parti.clientiOfficine);
    expect(r.prenotazioni).toEqual(parti.prenotazioni);
  });

  it('esporta le iscrizioni push solo come numero, senza chiavi del browser', () => {
    const r = componiMieiDati(parti, '2026-10-25T10:00:00.000Z');
    expect(r.iscrizioni_push).toBe(2);
    const json = JSON.stringify(r);
    for (const chiave of ['endpoint', 'p256dh', 'auth']) {
      expect(json).not.toContain(`"${chiave}"`);
    }
  });
});
