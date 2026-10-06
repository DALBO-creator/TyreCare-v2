import { describe, expect, it } from 'vitest';
import { AccessoSchema, RegistrazioneSchema } from './auth';

describe('RegistrazioneSchema', () => {
  const valida = {
    nome: ' Giulia ',
    cognome: 'Verdi',
    email: ' giulia@esempio.it ',
    password: 'abcdefgh',
  };

  it('accetta dati validi e toglie gli spazi', () => {
    expect(RegistrazioneSchema.parse(valida)).toEqual({
      nome: 'Giulia',
      cognome: 'Verdi',
      email: 'giulia@esempio.it',
      password: 'abcdefgh',
    });
  });

  it('rifiuta una password troppo corta', () => {
    const r = RegistrazioneSchema.safeParse({ ...valida, password: 'corta' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['password']);
  });

  it("rifiuta un'email non valida e un nome vuoto", () => {
    const r = RegistrazioneSchema.safeParse({ ...valida, email: 'giulia@', nome: '  ' });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(['nome', 'email']);
  });
});

describe('AccessoSchema', () => {
  it('non controlla la lunghezza della password', () => {
    expect(AccessoSchema.safeParse({ email: 'a@b.it', password: 'x' }).success).toBe(true);
  });

  it('chiede la password se manca', () => {
    const r = AccessoSchema.safeParse({ email: 'a@b.it', password: '' });
    expect(r.error?.issues[0]?.message).toBe('Inserisci la password');
  });
});
