import { describe, expect, it } from 'vitest';
import {
  AccessoSchema,
  CambioPasswordSchema,
  VERSIONE_TERMINI,
  devonoRiaccettare,
  ModificaProfiloSchema,
  RegistrazioneSchema,
} from './auth';

describe('RegistrazioneSchema', () => {
  const valida = {
    nome: ' Giulia ',
    cognome: 'Verdi',
    email: ' giulia@esempio.it ',
    password: 'abcdefgh',
    accetto: true,
  };

  it('accetta dati validi e toglie gli spazi', () => {
    expect(RegistrazioneSchema.parse(valida)).toEqual({
      nome: 'Giulia',
      cognome: 'Verdi',
      email: 'giulia@esempio.it',
      password: 'abcdefgh',
      accetto: true,
    });
  });

  it('accetta la casella spuntata del modulo (on)', () => {
    expect(RegistrazioneSchema.parse({ ...valida, accetto: 'on' }).accetto).toBe(true);
  });

  it('rifiuta la registrazione senza accettare i termini', () => {
    const senza: Partial<typeof valida> = { ...valida };
    delete senza.accetto;
    for (const dati of [senza, { ...valida, accetto: '' }, { ...valida, accetto: false }]) {
      const r = RegistrazioneSchema.safeParse(dati);
      expect(r.error?.issues[0]?.path).toEqual(['accetto']);
      expect(r.error?.issues[0]?.message).toBe("Per creare l'account devi accettare i termini");
    }
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

describe('ModificaProfiloSchema', () => {
  const base = { nome: 'Giulia', cognome: 'Verdi' };

  it('trasforma il telefono vuoto in null', () => {
    expect(ModificaProfiloSchema.parse({ ...base, telefono: '  ' }).telefono).toBeNull();
  });

  it('normalizza i separatori del telefono', () => {
    expect(ModificaProfiloSchema.parse({ ...base, telefono: '+39 (333) 123-45.67' }).telefono).toBe(
      '+39 333 123 45 67',
    );
  });

  it('rifiuta un telefono con lettere o troppo corto', () => {
    for (const telefono of ['333abc456', '12345']) {
      const r = ModificaProfiloSchema.safeParse({ ...base, telefono });
      expect(r.error?.issues[0]?.path).toEqual(['telefono']);
    }
  });
});

describe('CambioPasswordSchema', () => {
  it('chiede la password attuale e una nuova abbastanza lunga', () => {
    const r = CambioPasswordSchema.safeParse({ attuale: '', password: 'corta' });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(['attuale', 'password']);
  });
});

describe('devonoRiaccettare', () => {
  it('non chiede nulla se la versione è nulla', () => {
    expect(devonoRiaccettare(null)).toBe(false);
  });
  it('non chiede nulla se la versione è quella attuale', () => {
    expect(devonoRiaccettare(VERSIONE_TERMINI)).toBe(false);
  });
  it('chiede di riaccettare se la versione è diversa', () => {
    expect(devonoRiaccettare('2020-01-vecchia')).toBe(true);
  });
});
