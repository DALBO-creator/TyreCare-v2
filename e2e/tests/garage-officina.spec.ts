import { expect, test } from '@playwright/test';
import { accedi } from './aiuti';

// Il titolare del seed (`titolare@tyrecare.test`) non è collegato a nessuna scheda cliente
// (`clienti_officina.profile_id`): non ha veicoli nel garage. Il caso con veicoli (link «Il tuo garage · N
// veicoli») è coperto dagli unit test di `mostraHomeOfficina`, perché il seed non ha un membro
// dell'officina con veicoli.
test('chi lavora in officina e non ha veicoli non vede il link al garage', async ({ page }) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/');
  // Prima un elemento già disegnato della home dell'officina: l'assenza si verifica solo dopo (T145)
  await expect(page.getByRole('link', { name: 'Nuovo veicolo' })).toBeVisible();
  await expect(page.locator('a[href="/garage"]')).toHaveCount(0);
});
