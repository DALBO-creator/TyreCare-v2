import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Auth from './auth';
import {
  disattiva,
  fattoreAttivo,
  iniziaAttivazione,
  livelloToken,
  secondoLivello,
  serveCodice,
  verificaCodice,
} from './mfa';

const finti = vi.hoisted(() => ({
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  refreshSession: vi.fn(),
  sessione: vi.fn(),
}));

vi.mock('./auth', async (importOriginal) => ({
  ...(await importOriginal<typeof Auth>()),
  sessioneCorrente: finti.sessione,
}));
vi.mock('./supabase', () => ({
  getSupabase: () => ({
    auth: {
      mfa: {
        listFactors: finti.listFactors,
        enroll: finti.enroll,
        unenroll: finti.unenroll,
        challengeAndVerify: finti.challengeAndVerify,
      },
      refreshSession: finti.refreshSession,
    },
  }),
}));

const token = (corpo: object) =>
  `x.${btoa(JSON.stringify(corpo)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`;
const totp = { id: 'f1', factor_type: 'totp', status: 'verified' };

describe('livelloToken', () => {
  it('legge aal1 e aal2 dal token', () => {
    expect(livelloToken(token({ aal: 'aal1' }))).toBe('aal1');
    expect(livelloToken(token({ aal: 'aal2', nome: 'Niccolò è qui?' }))).toBe('aal2');
  });
  it('token mancante, rotto o con un valore strano: null', () => {
    expect(livelloToken(null)).toBeNull();
    expect(livelloToken('non-un-token')).toBeNull();
    expect(livelloToken('a.%%%.c')).toBeNull();
    expect(livelloToken(token({ aal: 'aal3' }))).toBeNull();
  });
});

describe('serveCodice', () => {
  it('senza fattori non serve il codice', () => {
    expect(serveCodice({ access_token: token({ aal: 'aal1' }), user: {} })).toBe(false);
    expect(serveCodice(null)).toBe(false);
  });
  it('un fattore non verificato non conta', () => {
    const user = { factors: [{ ...totp, status: 'unverified' }] };
    expect(fattoreAttivo({ access_token: '', user })).toBeUndefined();
    expect(serveCodice({ access_token: token({ aal: 'aal1' }), user })).toBe(false);
  });
  it('con un fattore verificato serve finché la sessione è aal1', () => {
    const user = { factors: [totp] };
    expect(serveCodice({ access_token: token({ aal: 'aal1' }), user })).toBe(true);
    expect(serveCodice({ access_token: token({ aal: 'aal2' }), user })).toBe(false);
    expect(secondoLivello({ access_token: token({ aal: 'aal2' }), user })).toBe(true);
  });
  it('un token illeggibile con un fattore attivo chiede il codice', () => {
    expect(serveCodice({ access_token: 'rotto', user: { factors: [totp] } })).toBe(true);
  });
});

const sessioneCon = (...factors: { id: string; factor_type: string; status: string }[]) => ({
  access_token: token({ aal: 'aal1' }),
  user: { factors },
});

beforeEach(() => {
  vi.resetAllMocks();
  finti.sessione.mockReturnValue(null);
  finti.unenroll.mockResolvedValue({ error: null });
  finti.challengeAndVerify.mockResolvedValue({ error: null });
  finti.refreshSession.mockResolvedValue({ error: null });
});

describe('iniziaAttivazione', () => {
  const fattore = (id: string, status: string) => ({ id, factor_type: 'totp', status });
  beforeEach(() => {
    finti.enroll.mockResolvedValue({
      data: { id: 'nuovo', totp: { qr_code: 'data:image/svg+xml;qr', secret: 'ABCD' } },
      error: null,
    });
  });

  it('toglie ogni fattore non verificato e lascia quello verificato', async () => {
    finti.listFactors.mockResolvedValue({
      data: {
        all: [fattore('a', 'unverified'), fattore('v', 'verified'), fattore('b', 'unverified')],
      },
      error: null,
    });
    await iniziaAttivazione();
    expect(finti.unenroll).toHaveBeenCalledTimes(2);
    expect(finti.unenroll).toHaveBeenCalledWith({ factorId: 'a' });
    expect(finti.unenroll).toHaveBeenCalledWith({ factorId: 'b' });
    expect(finti.unenroll).not.toHaveBeenCalledWith({ factorId: 'v' });
  });

  it('crea un fattore TOTP con emittente TyreCare e restituisce id, QR e segreto', async () => {
    finti.listFactors.mockResolvedValue({ data: { all: [] }, error: null });
    const risultato = await iniziaAttivazione();
    expect(finti.unenroll).not.toHaveBeenCalled();
    expect(finti.enroll).toHaveBeenCalledWith(
      expect.objectContaining({ factorType: 'totp', issuer: 'TyreCare' }),
    );
    expect(risultato).toEqual({ id: 'nuovo', qr: 'data:image/svg+xml;qr', segreto: 'ABCD' });
  });

  it("un errore dell'elenco dei fattori viene rilanciato e non si crea nulla", async () => {
    const err = new Error('elenco');
    finti.listFactors.mockResolvedValue({ data: null, error: err });
    await expect(iniziaAttivazione()).rejects.toBe(err);
    expect(finti.enroll).not.toHaveBeenCalled();
    expect(finti.unenroll).not.toHaveBeenCalled();
  });

  it('un errore di enroll viene rilanciato', async () => {
    const err = new Error('enroll');
    finti.listFactors.mockResolvedValue({ data: { all: [] }, error: null });
    finti.enroll.mockResolvedValue({ data: null, error: err });
    await expect(iniziaAttivazione()).rejects.toBe(err);
  });
});

describe('verificaCodice', () => {
  it('con un fattore esplicito usa quello, anche se la sessione ne ha un altro', async () => {
    finti.sessione.mockReturnValue(sessioneCon(totp));
    await verificaCodice('123456', 'esplicito');
    expect(finti.challengeAndVerify).toHaveBeenCalledWith({
      factorId: 'esplicito',
      code: '123456',
    });
  });

  it('senza fattore usa quello verificato della sessione, non quello da confermare', async () => {
    finti.sessione.mockReturnValue(
      sessioneCon({ ...totp, id: 'bozza', status: 'unverified' }, totp),
    );
    await verificaCodice('654321');
    expect(finti.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '654321' });
  });

  it('senza nessun fattore dà errore e non chiama Supabase', async () => {
    finti.sessione.mockReturnValue(sessioneCon());
    await expect(verificaCodice('123456')).rejects.toThrow('Nessun fattore da verificare');
    expect(finti.challengeAndVerify).not.toHaveBeenCalled();
  });

  it('un errore di challengeAndVerify viene rilanciato', async () => {
    const err = new Error('codice errato');
    finti.challengeAndVerify.mockResolvedValue({ error: err });
    await expect(verificaCodice('000000', 'f1')).rejects.toBe(err);
  });
});

describe('disattiva', () => {
  it('senza fattore attivo non chiama nulla', async () => {
    finti.sessione.mockReturnValue(sessioneCon({ ...totp, status: 'unverified' }));
    await disattiva('123456');
    expect(finti.challengeAndVerify).not.toHaveBeenCalled();
    expect(finti.unenroll).not.toHaveBeenCalled();
    expect(finti.refreshSession).not.toHaveBeenCalled();
  });

  it('verifica il codice, toglie lo stesso fattore e rinnova la sessione, in quest’ordine', async () => {
    finti.sessione.mockReturnValue(sessioneCon(totp));
    const ordine: string[] = [];
    finti.challengeAndVerify.mockImplementation(async () => {
      ordine.push('verifica');
      return { error: null };
    });
    finti.unenroll.mockImplementation(async () => {
      ordine.push('unenroll');
      return { error: null };
    });
    finti.refreshSession.mockImplementation(async () => {
      ordine.push('rinnovo');
      return { error: null };
    });
    await disattiva('123456');
    expect(ordine).toEqual(['verifica', 'unenroll', 'rinnovo']);
    expect(finti.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' });
    expect(finti.unenroll).toHaveBeenCalledWith({ factorId: 'f1' });
  });

  it('con il codice errato non toglie il fattore né rinnova la sessione', async () => {
    finti.sessione.mockReturnValue(sessioneCon(totp));
    const err = new Error('codice errato');
    finti.challengeAndVerify.mockResolvedValue({ error: err });
    await expect(disattiva('000000')).rejects.toBe(err);
    expect(finti.unenroll).not.toHaveBeenCalled();
    expect(finti.refreshSession).not.toHaveBeenCalled();
  });

  it('un errore di unenroll viene rilanciato e la sessione non si rinnova', async () => {
    finti.sessione.mockReturnValue(sessioneCon(totp));
    const err = new Error('unenroll');
    finti.unenroll.mockResolvedValue({ error: err });
    await expect(disattiva('123456')).rejects.toBe(err);
    expect(finti.refreshSession).not.toHaveBeenCalled();
  });
});
