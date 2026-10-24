import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Regola = { source: string; headers: { key: string; value: string }[] };

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf-8')) as {
  headers: Regola[];
};

function valori(source: string): Record<string, string> {
  const regola = config.headers.find((r) => r.source === source);
  expect(regola, `regola ${source}`).toBeDefined();
  return Object.fromEntries(regola!.headers.map((h) => [h.key, h.value]));
}

describe('vercel.json: intestazioni di sicurezza', () => {
  const tutte = () => valori('/(.*)');

  it('ha tutte le intestazioni di base', () => {
    const h = tutte();
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toBeDefined();
    expect(h['Strict-Transport-Security']).toBeDefined();
    expect(h['Content-Security-Policy-Report-Only']).toBeDefined();
  });

  it('lascia la posizione a "Vicino a me" e blocca camera, microfono e pagamenti', () => {
    const p = tutte()['Permissions-Policy'];
    expect(p).toContain('geolocation=(self)');
    expect(p).toContain('camera=()');
    expect(p).toContain('microphone=()');
    expect(p).toContain('payment=()');
  });

  it('HSTS senza includeSubDomains né preload (dominio non ancora scelto)', () => {
    const h = tutte()['Strict-Transport-Security'];
    expect(h).toContain('max-age=63072000');
    expect(h).not.toMatch(/includeSubDomains|preload/i);
  });

  it('la CSP è solo in osservazione e ammette Supabase e nient altro di esterno', () => {
    const h = tutte();
    expect(h['Content-Security-Policy']).toBeUndefined();
    const csp = h['Content-Security-Policy-Report-Only'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain('wss://*.supabase.co');
  });

  it('le regole di cache restano', () => {
    for (const source of ['/sw.js', '/manifest.webmanifest', '/assets/(.*)']) {
      expect(valori(source)['Cache-Control'], source).toBeDefined();
    }
    expect(valori('/assets/(.*)')['Cache-Control']).toContain('immutable');
    expect(valori('/sw.js')['Cache-Control']).toContain('max-age=0');
  });
});
