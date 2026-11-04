import { describe, expect, it, vi } from 'vitest';
import { titoloVisibile } from './home-officina';

// Ambiente node, senza DOM: le icone (SVG creati con `document`) qui non servono
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

describe('titoloVisibile', () => {
  it('è visibile se sta tutto dentro la finestra', () => {
    expect(titoloVisibile({ top: 10, bottom: 80 }, 600)).toBe(true);
  });
  it('non è visibile se il bordo alto è sopra la finestra', () => {
    expect(titoloVisibile({ top: -5, bottom: 60 }, 600)).toBe(false);
  });
  it('non è visibile se il bordo basso è sotto la finestra', () => {
    expect(titoloVisibile({ top: 560, bottom: 640 }, 600)).toBe(false);
  });
});
