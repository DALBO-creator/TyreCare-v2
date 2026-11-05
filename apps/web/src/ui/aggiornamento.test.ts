import { describe, expect, it } from 'vitest';
import { htmlAvvisoAggiornamento } from './aggiornamento';

describe('htmlAvvisoAggiornamento', () => {
  const html = htmlAvvisoAggiornamento();

  it('è un riquadro di stato marcato per evitare le copie', () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('data-aggiornamento');
    expect(html).toContain('tc-avviso tc-avviso--info tc-aggiornamento');
  });

  it('ha il testo esatto', () => {
    expect(html).toContain('È disponibile una nuova versione di TyreCare.');
  });

  it('ha i pulsanti "Aggiorna" e "Più tardi", entrambi di tipo button', () => {
    expect(html).toContain(
      '<button type="button" class="btn btn-primary btn-sm" data-aggiorna>Aggiorna</button>',
    );
    expect(html).toContain(
      '<button type="button" class="btn btn-link btn-sm" data-piu-tardi>Più tardi</button>',
    );
    expect(html.match(/<button /g)).toHaveLength(2);
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
  });
});
