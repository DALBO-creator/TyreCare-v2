import { describe, expect, it } from 'vitest';
import { filtraClienti } from './clienti';
import type { ClienteConVeicoli } from '../lib/officina';

const cliente = (o: Partial<ClienteConVeicoli> & { id: string }): ClienteConVeicoli =>
  ({
    nome: '',
    cognome: '',
    ragione_sociale: null,
    telefono: null,
    email: null,
    veicoli: [],
    ...o,
  }) as ClienteConVeicoli;

const elenco = [
  cliente({ id: '1', nome: 'Mario', cognome: 'Rossi', telefono: '333 987 6543' }),
  cliente({
    id: '2',
    nome: 'Anna',
    cognome: 'Bianchi',
    email: 'anna@esempio.it',
    veicoli: [{ targa: 'AB123CD' }] as never,
  }),
];

describe('filtraClienti', () => {
  it('senza testo restituisce tutti', () => {
    expect(filtraClienti(elenco, '  ')).toHaveLength(2);
  });
  it('cerca per nome, email e targa', () => {
    expect(filtraClienti(elenco, 'ross').map((c) => c.id)).toEqual(['1']);
    expect(filtraClienti(elenco, 'ESEMPIO').map((c) => c.id)).toEqual(['2']);
    expect(filtraClienti(elenco, 'AB123CD').map((c) => c.id)).toEqual(['2']);
  });
  it('cerca il telefono per cifre', () => {
    expect(filtraClienti(elenco, '3339876543').map((c) => c.id)).toEqual(['1']);
  });
  it('nessun risultato', () => {
    expect(filtraClienti(elenco, 'zzz')).toEqual([]);
  });
});
