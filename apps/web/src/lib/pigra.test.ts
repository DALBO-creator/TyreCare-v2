import { describe, expect, it, vi } from 'vitest';
import { deveRicaricare, pigra } from './pigra';

const router = vi.hoisted(() => ({ attuale: true }));
vi.mock('./router', () => ({
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => router.attuale,
}));

describe('deveRicaricare', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/clienti-abc.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: https://x/assets/clienti-abc.js',
  ])('ricarica per "%s"', (messaggio) => {
    expect(deveRicaricare(new TypeError(messaggio), false)).toBe(true);
  });

  it('non ricarica per un altro errore', () => {
    expect(deveRicaricare(new TypeError('x is not a function'), false)).toBe(false);
  });

  it('non ricarica se la pagina è già stata ricaricata', () => {
    expect(deveRicaricare(new TypeError('Importing a module script failed.'), true)).toBe(false);
  });

  it('gestisce valori che non sono Error', () => {
    expect(deveRicaricare('Failed to fetch dynamically imported module', false)).toBe(false);
    expect(deveRicaricare(undefined, false)).toBe(false);
    expect(deveRicaricare(null, false)).toBe(false);
  });
});

describe('pigra', () => {
  const app = {} as HTMLElement;

  it('importa il modulo e chiama la pagina con app', async () => {
    router.attuale = true;
    const pagina = vi.fn();
    await pigra(() => Promise.resolve({ mostraX: pagina }), 'mostraX')(app);
    expect(pagina).toHaveBeenCalledWith(app);
  });

  it("non chiama la pagina se la navigazione è cambiata durante l'import", async () => {
    const pagina = vi.fn();
    router.attuale = false;
    await pigra(() => Promise.resolve({ mostraX: pagina }), 'mostraX')(app);
    router.attuale = true;
    expect(pagina).not.toHaveBeenCalled();
  });

  it('rilancia un errore che non è di import', async () => {
    router.attuale = true;
    const errore = new TypeError('altro');
    await expect(
      pigra(() => Promise.reject(errore) as Promise<{ mostraX: () => void }>, 'mostraX')(app),
    ).rejects.toBe(errore);
  });
});
