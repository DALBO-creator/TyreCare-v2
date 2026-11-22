import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('./supabase', () => ({ getSupabase: () => ({ rpc, from }) }));

import { attivaPush, chiaveInByte, disattivaPush, statoPush } from './push';

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('chiaveInByte', () => {
  it('converte -/_ di base64url negli stessi byte di +// di base64', () => {
    // 251,255,191 in base64 sono "+/+/" ; in base64url "-_-_"
    expect(Array.from(chiaveInByte('-_-_'))).toEqual([251, 255, 191]);
  });

  it('aggiunge il padding mancante e accetta anche la forma con "="', () => {
    expect(Array.from(chiaveInByte('-w'))).toEqual([251]);
    expect(Array.from(chiaveInByte('-w=='))).toEqual([251]);
    expect(Array.from(chiaveInByte('-_8'))).toEqual([251, 255]);
    expect(Array.from(chiaveInByte('-_8='))).toEqual([251, 255]);
  });

  it('il padding cambia la lunghezza: senza era un byte, con 3 caratteri due', () => {
    expect(chiaveInByte('-w').length).toBe(1);
    expect(chiaveInByte('-_8').length).toBe(2);
  });
});

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120';

type Opzioni = {
  ua?: string;
  standalone?: boolean;
  pushManager?: boolean;
  notification?: boolean;
  permesso?: string;
  serviceWorker?: boolean;
  registrazione?: boolean;
  iscrizione?: object | null;
};

/** Finge il browser: di base Android con push supportate, SW registrato e nessuna iscrizione. */
function browser(o: Opzioni = {}) {
  const {
    ua = UA_ANDROID,
    standalone = false,
    pushManager = true,
    notification = true,
    permesso = 'default',
    serviceWorker = true,
    registrazione = true,
    iscrizione = null,
  } = o;
  const getSubscription = vi.fn(() => Promise.resolve(iscrizione));
  const nav: Record<string, unknown> = {
    userAgent: ua,
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
  };
  if (serviceWorker) {
    nav.serviceWorker = {
      getRegistration: () =>
        Promise.resolve(registrazione ? { pushManager: { getSubscription } } : undefined),
    };
  }
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('matchMedia', () => ({ matches: standalone }));
  const win: Record<string, unknown> = {};
  if (pushManager) win.PushManager = class {};
  if (notification) win.Notification = {};
  vi.stubGlobal('window', win);
  if (notification) vi.stubGlobal('Notification', { permission: permesso });
  return { getSubscription };
}

describe('statoPush', () => {
  it('installa: iPhone fuori dalla schermata Home; con standalone vero si passa oltre', async () => {
    browser({ ua: UA_IPHONE, standalone: false });
    expect(await statoPush()).toBe('installa');
    browser({ ua: UA_IPHONE, standalone: true });
    expect(await statoPush()).toBe('spente');
  });

  it('installa: vale anche navigator.standalone === true (Safari iOS) come installata', async () => {
    browser({ ua: UA_IPHONE });
    (navigator as unknown as Record<string, unknown>).standalone = true;
    expect(await statoPush()).toBe('spente');
  });

  it('installa: lo stesso identico browser non Apple non chiede di installare', async () => {
    browser({ ua: UA_ANDROID, standalone: false });
    expect(await statoPush()).toBe('spente');
  });

  it('installa ha la precedenza su non-supportate (iPhone senza PushManager)', async () => {
    browser({ ua: UA_IPHONE, pushManager: false });
    expect(await statoPush()).toBe('installa');
  });

  it('non-supportate: senza PushManager, senza Notification, senza serviceWorker, senza registrazione', async () => {
    browser();
    expect(await statoPush()).toBe('spente');
    browser({ pushManager: false });
    expect(await statoPush()).toBe('non-supportate');
    browser({ notification: false });
    expect(await statoPush()).toBe('non-supportate');
    browser({ serviceWorker: false });
    expect(await statoPush()).toBe('non-supportate');
    browser({ registrazione: false });
    expect(await statoPush()).toBe('non-supportate');
  });

  it('bloccate: permesso denied; con default si va avanti', async () => {
    browser({ permesso: 'denied' });
    expect(await statoPush()).toBe('bloccate');
    browser({ permesso: 'default' });
    expect(await statoPush()).toBe('spente');
    browser({ permesso: 'granted' });
    expect(await statoPush()).toBe('spente');
  });

  it('bloccate non legge l’iscrizione: vince anche se ce n’è una', async () => {
    const { getSubscription } = browser({ permesso: 'denied', iscrizione: { endpoint: 'x' } });
    expect(await statoPush()).toBe('bloccate');
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it('attive / spente: cambia solo getSubscription (oggetto vs null)', async () => {
    const { getSubscription } = browser({ permesso: 'granted', iscrizione: { endpoint: 'x' } });
    expect(await statoPush()).toBe('attive');
    expect(getSubscription).toHaveBeenCalledTimes(1);
    browser({ permesso: 'granted', iscrizione: null });
    expect(await statoPush()).toBe('spente');
  });
});

const ENDPOINT = 'https://push.example/abc';

/** Iscrizione finta: `toJSON` con le chiavi, `unsubscribe` spiabile. */
function iscrizioneFinta() {
  return {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'P', auth: 'A' } }),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
}

/** Finge il browser per `attivaPush`: `ready` è un getter spia, così si vede se viene letto. */
function browserAttiva(
  o: { permesso?: string; esistente?: ReturnType<typeof iscrizioneFinta> | null } = {},
) {
  const { permesso = 'granted', esistente = null } = o;
  const nuova = iscrizioneFinta();
  const getSubscription = vi.fn(() => Promise.resolve(esistente));
  const subscribe = vi.fn(() => Promise.resolve(nuova));
  const readLetto = vi.fn();
  const requestPermission = vi.fn(() => Promise.resolve(permesso));
  const sw = {
    get ready() {
      readLetto();
      return Promise.resolve({ pushManager: { getSubscription, subscribe } });
    },
  };
  vi.stubGlobal('navigator', { serviceWorker: sw });
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  return { getSubscription, subscribe, readLetto, requestPermission, nuova };
}

describe('attivaPush', () => {
  it('permesso negato: bloccate, senza leggere il service worker né salvare', async () => {
    const b = browserAttiva({ permesso: 'denied' });
    expect(await attivaPush()).toBe('bloccate');
    expect(b.requestPermission).toHaveBeenCalledTimes(1);
    expect(b.readLetto).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('permesso non deciso (default): spente, senza leggere il service worker né salvare', async () => {
    const b = browserAttiva({ permesso: 'default' });
    expect(await attivaPush()).toBe('spente');
    expect(b.requestPermission).toHaveBeenCalledTimes(1);
    expect(b.readLetto).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('con iscrizione già presente la salva senza iscriversi di nuovo', async () => {
    const esistente = iscrizioneFinta();
    const b = browserAttiva({ esistente });
    rpc.mockResolvedValue({ error: null });
    expect(await attivaPush()).toBe('attive');
    expect(b.subscribe).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('iscrivi_push', {
      p_endpoint: ENDPOINT,
      p_p256dh: 'P',
      p_auth: 'A',
    });
    expect(esistente.unsubscribe).not.toHaveBeenCalled();
  });

  it('senza iscrizione chiama subscribe con la chiave VAPID in byte e salva quella nuova', async () => {
    const b = browserAttiva();
    rpc.mockResolvedValue({ error: null });
    expect(await attivaPush()).toBe('attive');
    expect(b.subscribe).toHaveBeenCalledTimes(1);
    expect(b.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    // Chiave VAPID non compressa: 65 byte, il primo è 0x04.
    const [opzioni] = b.subscribe.mock.calls[0] as unknown as [
      { applicationServerKey: Uint8Array },
    ];
    expect(opzioni.applicationServerKey.length).toBe(65);
    expect(opzioni.applicationServerKey[0]).toBe(4);
    expect(rpc).toHaveBeenCalledWith('iscrivi_push', {
      p_endpoint: ENDPOINT,
      p_p256dh: 'P',
      p_auth: 'A',
    });
  });

  it('se il salvataggio fallisce annulla l’iscrizione e rilancia l’errore', async () => {
    const b = browserAttiva();
    const errore = { message: 'x' };
    rpc.mockResolvedValue({ error: errore });
    await expect(attivaPush()).rejects.toBe(errore);
    expect(b.nuova.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('disattivaPush', () => {
  it('con iscrizione la cancella dal database, la annulla e dà spente', async () => {
    const iscrizione = iscrizioneFinta();
    browser({ iscrizione });
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const del = vi.fn(() => ({ eq }));
    from.mockReturnValue({ delete: del });
    expect(await disattivaPush()).toBe('spente');
    expect(from).toHaveBeenCalledWith('iscrizioni_push');
    expect(del).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('endpoint', ENDPOINT);
    expect(iscrizione.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('senza iscrizione: spente, senza toccare il database', async () => {
    const { getSubscription } = browser({ iscrizione: null });
    expect(await disattivaPush()).toBe('spente');
    expect(getSubscription).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it('senza registrazione: spente, senza toccare il database', async () => {
    const { getSubscription } = browser({ registrazione: false });
    expect(await disattivaPush()).toBe('spente');
    expect(getSubscription).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('senza serviceWorker: spente, senza toccare il database', async () => {
    browser({ serviceWorker: false });
    expect(await disattivaPush()).toBe('spente');
    expect(from).not.toHaveBeenCalled();
  });
});
