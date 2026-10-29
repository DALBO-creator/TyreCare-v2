import { describe, expect, it } from 'vitest';
import { linkReport, linkWhatsApp } from './report';

describe('link del report', () => {
  it('il link usa /r?c= con il codice', () => {
    expect(linkReport('https://tyrecare.app', 'abc123')).toBe('https://tyrecare.app/r?c=abc123');
  });

  it('il messaggio WhatsApp contiene il link codificato', () => {
    const link = linkReport('https://tyrecare.app', 'abc123');
    const url = linkWhatsApp(link, 'AB 123 CD');
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    const testo = decodeURIComponent(url.slice('https://wa.me/?text='.length));
    expect(testo).toContain('AB 123 CD');
    expect(testo.endsWith(link)).toBe(true);
  });
});
