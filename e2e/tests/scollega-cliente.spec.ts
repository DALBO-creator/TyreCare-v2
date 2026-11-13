import { expect, test } from '@playwright/test';
import {
  accedi,
  creaCliente,
  creaVeicolo,
  emailNuova,
  preparaInvito,
  registratiDalLinkInvito,
  unico,
} from './aiuti';

// "Scollega l'account" nella scheda di un cliente collegato: solo il titolare, con conferma. Il cliente
// resta nell'anagrafica ma non vede più i veicoli dell'officina nel suo garage.

test("il titolare scollega il cliente dall'app e l'operatore non vede il pulsante", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const email = emailNuova();
  const modello = `Scollega ${unico()}`;

  // Titolare: cliente con veicolo, invito e collegamento da parte del cliente
  await accedi(page, 'titolare@tyrecare.test');
  const clienteId = await creaCliente(page, { nome: 'Ivo', cognome: 'Scollega', email });
  await creaVeicolo(page, clienteId, { targa: `S${unico().slice(-7)}`, marca: 'Fiat', modello });
  const link = await preparaInvito(page, clienteId);
  const contestoCliente = await browser.newContext();
  const cliente = await contestoCliente.newPage();
  await registratiDalLinkInvito(cliente, link, { nome: 'Ivo', cognome: 'Scollega', email });
  await expect(cliente.getByText(modello)).toBeVisible();

  // Operatore: la scheda mostra il collegamento ma non il pulsante
  const contestoOperatore = await browser.newContext();
  const operatore = await contestoOperatore.newPage();
  await accedi(operatore, 'operatore@tyrecare.test');
  await operatore.goto(`/cliente?id=${clienteId}`);
  const sezioneOperatore = operatore.getByRole('region', { name: 'App TyreCare' });
  await expect(sezioneOperatore.getByText("Usa l'app TyreCare")).toBeVisible();
  await expect(operatore.getByRole('button', { name: "Scollega l'account" })).toHaveCount(0);

  // Titolare: conferma e scollega
  await page.goto(`/cliente?id=${clienteId}`);
  const sezione = page.getByRole('region', { name: 'App TyreCare' });
  await expect(sezione.getByText("Usa l'app TyreCare")).toBeVisible();
  await sezione.getByRole('button', { name: "Scollega l'account" }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText('Il cliente non vedrà più i suoi veicoli')).toBeVisible();
  await dialogo.getByRole('button', { name: "Scollega l'account" }).click();

  await expect(page.getByRole('link', { name: "Invita nell'app" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'App TyreCare' })).toBeFocused();

  // Cliente: il veicolo non è più nel garage
  await cliente.goto('/');
  await expect(cliente.getByRole('heading', { name: 'I tuoi veicoli' })).toBeVisible();
  await expect(cliente.getByText(modello)).toHaveCount(0);

  await contestoCliente.close();
  await contestoOperatore.close();
});
