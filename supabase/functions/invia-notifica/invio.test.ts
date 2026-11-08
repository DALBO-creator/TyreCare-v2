import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  gestisciNotifica,
  type DbNotifica,
  type DipendenzeNotifica,
  type FetchFn,
  type IscrizionePush,
  type Notifica,
} from './invio.ts';

const SEGRETO = 'segreto-finto';
const NOTIFICA_ID = 'c0000000-0000-0000-0000-000000000001';
const CLIENTE = 'a0000000-0000-0000-0000-000000000004';
const EMAIL_CLIENTE = 'cliente@prova.it';

const NOTIFICA: Notifica = {
  id: NOTIFICA_ID,
  destinatario_id: CLIENTE,
  titolo: 'Controllo pronto',
  testo: 'Le gomme sono state controllate',
  link: '/garage',
};

const ISCR_A: IscrizionePush = {
  id: 'i-a',
  endpoint: 'https://push.prova/a',
  p256dh: 'pa',
  auth: 'aa',
};
const ISCR_B: IscrizionePush = {
  id: 'i-b',
  endpoint: 'https://push.prova/b',
  p256dh: 'pb',
  auth: 'ab',
};

const ENV_EMAIL: Record<string, string> = {
  PUSH_SEGRETO: SEGRETO,
  EMAIL_NOTIFICHE: 'si',
  RESEND_API_KEY: 're_finta',
  EMAIL_MITTENTE: 'TyreCare <notifiche@prova.it>',
  SITO_URL: 'https://tyrecare.prova',
};

let console_error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  console_error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console_error.mockRestore();
});

function dbFinto(altro: Partial<DbNotifica> = {}) {
  return {
    notifica: vi.fn(async (id: string) => (id === NOTIFICA_ID ? NOTIFICA : null)),
    iscrizioni: vi.fn(async (): Promise<IscrizionePush[]> => []),
    cancellaIscrizione: vi.fn(async () => {}),
    preferenzaEmail: vi.fn(async () => ({ email_notifiche: true as boolean | null })),
    emailUtente: vi.fn(async (): Promise<string | null> => EMAIL_CLIENTE),
    ...altro,
  };
}

function dipendenze(
  env: Record<string, string>,
  db: DbNotifica,
  { inviaPush, stato = 200 }: { inviaPush?: DipendenzeNotifica['inviaPush']; stato?: number } = {},
) {
  const fetchFn = vi.fn<FetchFn>(async () =>
    Response.json({ id: 'email_finta' }, { status: stato }),
  );
  const push = vi.fn<DipendenzeNotifica['inviaPush']>(inviaPush ?? (async () => ({})));
  return {
    dip: { env: (nome: string) => env[nome] || undefined, fetchFn, inviaPush: push, db },
    fetchFn,
    push,
  };
}

const richiesta = (corpo: unknown, segreto: string | null = SEGRETO) =>
  new Request('https://funzione.prova/invia-notifica', {
    method: 'POST',
    headers: segreto === null ? {} : { 'x-segreto': segreto },
    body: JSON.stringify(corpo),
  });

describe('gestisciNotifica', () => {
  it('segreto errato → 401 senza leggere il database', async () => {
    const db = dbFinto();
    const { dip } = dipendenze({ PUSH_SEGRETO: SEGRETO }, db);
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }, 'sbagliato'), dip);
    expect(r.status).toBe(401);
    expect(await r.text()).toBe('Non autorizzato');
    expect(db.notifica).not.toHaveBeenCalled();
  });

  it('notifica_id mancante → 400', async () => {
    const db = dbFinto();
    const { dip } = dipendenze({ PUSH_SEGRETO: SEGRETO }, db);
    const r = await gestisciNotifica(richiesta({}), dip);
    expect(r.status).toBe(400);
    expect(await r.text()).toBe('notifica_id mancante');
    expect(db.notifica).not.toHaveBeenCalled();
  });

  it('notifica assente → 404', async () => {
    const db = dbFinto();
    const { dip, push } = dipendenze({ PUSH_SEGRETO: SEGRETO }, db);
    const r = await gestisciNotifica(
      richiesta({ notifica_id: 'c0000000-0000-0000-0000-000000000999' }),
      dip,
    );
    expect(r.status).toBe(404);
    expect(await r.text()).toBe('Notifica non trovata');
    expect(db.iscrizioni).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('errore del database → 500 con il messaggio', async () => {
    const db = dbFinto({
      notifica: vi.fn(async () => {
        throw new Error('connessione persa');
      }),
    });
    const { dip } = dipendenze({ PUSH_SEGRETO: SEGRETO }, db);
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(r.status).toBe(500);
    expect(await r.text()).toBe('connessione persa');
  });

  it('due dispositivi, uno 410 → cancellato quello e inviate: 1', async () => {
    const db = dbFinto({ iscrizioni: vi.fn(async () => [ISCR_A, ISCR_B]) });
    const { dip, push, fetchFn } = dipendenze(ENV_EMAIL, db, {
      inviaPush: async (s) => {
        if (s.endpoint === ISCR_B.endpoint)
          throw Object.assign(new Error('Gone'), { statusCode: 410 });
        return {};
      },
    });
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ inviate: 1, dispositivi: 2, email: false });
    expect(db.iscrizioni).toHaveBeenCalledWith(CLIENTE);
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith(
      { endpoint: ISCR_A.endpoint, keys: { p256dh: 'pa', auth: 'aa' } },
      JSON.stringify({
        titolo: NOTIFICA.titolo,
        testo: NOTIFICA.testo,
        link: NOTIFICA.link,
        id: NOTIFICA_ID,
      }),
      { TTL: 86400, urgency: 'high' },
    );
    expect(db.cancellaIscrizione).toHaveBeenCalledTimes(1);
    expect(db.cancellaIscrizione).toHaveBeenCalledWith('i-b');
    // Una push è partita: niente email anche con EMAIL_NOTIFICHE=si
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('dispositivo 404 → cancellato anche quello, inviate: 0', async () => {
    const db = dbFinto({ iscrizioni: vi.fn(async () => [ISCR_A]) });
    const { dip } = dipendenze({ PUSH_SEGRETO: SEGRETO }, db, {
      inviaPush: async () => {
        throw Object.assign(new Error('Not Found'), { statusCode: 404 });
      },
    });
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(await r.json()).toEqual({ inviate: 0, dispositivi: 1, email: false });
    expect(db.cancellaIscrizione).toHaveBeenCalledTimes(1);
    expect(db.cancellaIscrizione).toHaveBeenCalledWith('i-a');
  });

  it('errore push diverso da 404/410 → nessuna cancellazione, solo log', async () => {
    const db = dbFinto({ iscrizioni: vi.fn(async () => [ISCR_A]) });
    const { dip } = dipendenze({ PUSH_SEGRETO: SEGRETO }, db, {
      inviaPush: async () => {
        throw Object.assign(new Error('Server push giù'), { statusCode: 500 });
      },
    });
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(await r.json()).toEqual({ inviate: 0, dispositivi: 1, email: false });
    expect(db.cancellaIscrizione).not.toHaveBeenCalled();
    expect(console_error).toHaveBeenCalledWith('Push non inviata', 500, 'Server push giù');
  });

  it('nessuna push e EMAIL_NOTIFICHE diverso da si → Resend non chiamato, email: false', async () => {
    const db = dbFinto();
    const { dip, fetchFn } = dipendenze({ ...ENV_EMAIL, EMAIL_NOTIFICHE: 'no' }, db);
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(await r.json()).toEqual({ inviate: 0, dispositivi: 0, email: false });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(db.preferenzaEmail).not.toHaveBeenCalled();
  });

  it('nessuna push, si e preferenza false → email: false e Resend non chiamato', async () => {
    const db = dbFinto({ preferenzaEmail: vi.fn(async () => ({ email_notifiche: false })) });
    const { dip, fetchFn } = dipendenze(ENV_EMAIL, db);
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(await r.json()).toEqual({ inviate: 0, dispositivi: 0, email: false });
    expect(db.preferenzaEmail).toHaveBeenCalledWith(CLIENTE);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(db.emailUtente).not.toHaveBeenCalled();
  });

  it('preferenza vera ma manca RESEND_API_KEY → email: false', async () => {
    const db = dbFinto();
    const { dip, fetchFn } = dipendenze({ ...ENV_EMAIL, RESEND_API_KEY: '' }, db);
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(await r.json()).toEqual({ inviate: 0, dispositivi: 0, email: false });
    expect(db.preferenzaEmail).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(console_error).toHaveBeenCalledWith(
      'Email di riserva: mancano RESEND_API_KEY, EMAIL_MITTENTE o SITO_URL',
    );
  });

  it('tutto presente → Resend chiamato una volta con il to giusto, email: true', async () => {
    const db = dbFinto();
    const { dip, fetchFn } = dipendenze(ENV_EMAIL, db);
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(await r.json()).toEqual({ inviate: 0, dispositivi: 0, email: true });
    expect(db.emailUtente).toHaveBeenCalledWith(CLIENTE);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer re_finta',
      'Content-Type': 'application/json',
    });
    const corpo = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(corpo.to).toEqual([EMAIL_CLIENTE]);
    expect(corpo.from).toBe('TyreCare <notifiche@prova.it>');
    expect(corpo.subject).toEqual(expect.stringContaining('Controllo pronto'));
  });

  it('Resend risponde 500 → email: false', async () => {
    const db = dbFinto();
    const { dip, fetchFn } = dipendenze(ENV_EMAIL, db, { stato: 500 });
    const r = await gestisciNotifica(richiesta({ notifica_id: NOTIFICA_ID }), dip);
    expect(await r.json()).toEqual({ inviate: 0, dispositivi: 0, email: false });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(console_error).toHaveBeenCalledWith('Email di riserva: Resend ha risposto', 500);
  });
});
