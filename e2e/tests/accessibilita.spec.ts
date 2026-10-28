import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Pagine pubbliche (da ospite): nessuna violazione WCAG 2 A/AA di impatto grave o critico.
const PAGINE = [
  { percorso: '/accedi', titolo: 'Accedi' },
  { percorso: '/registrati', titolo: 'Crea il tuo account' },
  { percorso: '/password-dimenticata', titolo: 'Password dimenticata' },
];

for (const { percorso, titolo } of PAGINE) {
  test(`${percorso}: nessuna violazione di accessibilità grave`, async ({ page }) => {
    await page.goto(percorso);
    await expect(page.getByRole('heading', { level: 1, name: titolo })).toBeVisible();

    // Le pagine entrano con una dissolvenza: finché dura, axe misura colori a metà transizione
    // (falso errore di contrasto). Si analizza a pagina ferma, senza escludere nessuna regola.
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    );

    const risultato = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const gravi = risultato.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

    expect(gravi, `Violazioni su ${percorso}:\n${gravi.join('\n')}`).toEqual([]);
  });
}
