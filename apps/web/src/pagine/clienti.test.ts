import { describe, expect, it } from 'vitest';
import { filtraClienti, senzaApp, testoVuoto } from './clienti';
import type { ClienteConVeicoli } from '../lib/officina';

const cliente = (o: Partial<ClienteConVeicoli> & { id: string }): ClienteConVeicoli =>
  ({
    nome: '',
    cognome: '',
    ragione_sociale: null,
    telefono: null,
    email: null,
    profile_id: null,
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

describe('filtro "Senza app"', () => {
  const misti = [
    cliente({ id: '1', nome: 'Giulia', cognome: 'Verdi', profile_id: 'p1' }),
    cliente({ id: '2', nome: 'Franco', cognome: 'Gialli' }),
    cliente({ id: '3', nome: 'Gianni', cognome: 'Neri' }),
  ];
  it('conta e mostra solo i clienti senza account', () => {
    expect(senzaApp(misti).map((c) => c.id)).toEqual(['2', '3']);
    expect(filtraClienti(misti, '', true).map((c) => c.id)).toEqual(['2', '3']);
  });
  it('si combina con la ricerca', () => {
    expect(filtraClienti(misti, 'gian', true).map((c) => c.id)).toEqual(['3']);
    expect(filtraClienti(misti, 'giulia', true)).toEqual([]);
    expect(filtraClienti(misti, 'giulia').map((c) => c.id)).toEqual(['1']);
  });
  it('lista vuota', () => {
    expect(senzaApp([])).toEqual([]);
    expect(filtraClienti([], '', true)).toEqual([]);
  });
});

describe('testoVuoto', () => {
  it('nessun cliente in officina', () => {
    expect(testoVuoto('', false, false).titolo).toBe('Ancora nessun cliente');
  });
  it('ricerca senza risultati', () => {
    expect(testoVuoto('  Rossi ', false).titolo).toBe('Nessun cliente per «Rossi»');
  });
  it('solo filtro "Senza app" con ricerca vuota', () => {
    const v = testoVuoto('   ', true);
    expect(v.titolo).toBe('Tutti i clienti usano già l’app.');
    expect(v.testo).toBe('Qui compaiono i clienti che non hanno ancora l’app.');
  });
  it('filtro e ricerca insieme', () => {
    expect(testoVuoto('Rossi', true).titolo).toBe(
      'Nessun cliente per «Rossi» tra chi non usa l’app',
    );
  });
});
