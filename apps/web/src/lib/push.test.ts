import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ getSupabase: () => ({}) }));

import { chiaveInByte, statoPush } from './push';

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
