import { expect, test } from '@playwright/test';
import {
  OFFICINA,
  PASSWORD,
  accedi,
  creaCliente,
  creaVeicolo,
  emailNuova,
  linkConferma,
  preparaInvito,
  unico,
} from './aiuti';

// Invito del cliente nell'app (sessione 12): l'officina prepara il link, il cliente crea l'account con
// la stessa email, conferma dall'email (Mailpit) e collega i veicoli al suo garage.

test("il cliente crea l'account dall'invito e trova i veicoli nel garage", async ({
  page,
  browser,
}) => {
  const email = emailNuova();
  const modello = `Prova ${unico()}`;

  // Officina: cliente nuovo con un veicolo, poi l'invito
  await accedi(page, 'titolare@tyrecare.test');
  const clienteId = await creaCliente(page, { nome: 'Elena', cognome: 'Prova', email });
  await creaVeicolo(page, clienteId, { targa: `E${unico().slice(-7)}`, marca: 'Fiat', modello });
  const link = await preparaInvito(page, clienteId);

  // Cliente, in un altro browser: dal link alla registrazione con l'email già scritta
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(link);
  await expect(
    cliente.getByRole('heading', { name: `${OFFICINA} ti invita su TyreCare` }),
  ).toBeVisible();
  await cliente.getByRole('link', { name: 'Crea account' }).click();
  await expect(cliente.getByLabel('Email', { exact: true })).toHaveValue(email);
  await cliente.getByLabel('Nome', { exact: true }).fill('Elena');
  await cliente.getByLabel('Cognome', { exact: true }).fill('Prova');
  await cliente.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await cliente.getByLabel(/Ho letto l'informativa privacy/).check();
  await cliente.getByRole('button', { name: 'Crea account' }).click();
  await expect(cliente.getByRole('heading', { name: 'Controlla la posta' })).toBeVisible();

  // Il link di conferma riporta all'invito, già dentro
  await cliente.goto(await linkConferma(email));
  await expect(cliente).toHaveURL(/\/invito\?codice=/);
  await cliente.getByRole('button', { name: 'Collega i miei veicoli' }).click();
  await expect(cliente).toHaveURL(/\/$/);
  await expect(
    cliente.getByText(`Fatto! I veicoli registrati da ${OFFICINA} sono nel tuo garage.`),
  ).toBeVisible();
  await expect(cliente.getByText(modello)).toBeVisible();

  // Officina: la scheda del cliente ora dice che usa l'app
  await page.goto(`/cliente?id=${clienteId}`);
  await expect(
    page.getByRole('region', { name: 'App TyreCare' }).getByText("Usa l'app TyreCare"),
  ).toBeVisible();

  // Lo stesso link aperto da un altro non vale più
  const altro = await (await browser.newContext()).newPage();
  await altro.goto(link);
  await expect(altro.getByRole('heading', { name: 'Invito già usato' })).toBeVisible();
});

test("con un'altra email l'invito chiede di cambiare account", async ({ page, browser }) => {
  const email = emailNuova();

  await accedi(page, 'titolare@tyrecare.test');
  const clienteId = await creaCliente(page, { nome: 'Sara', cognome: 'Prova', email });
  const link = await preparaInvito(page, clienteId);

  // Giulia (cliente del seed) apre l'invito di un altro
  const cliente = await (await browser.newContext()).newPage();
  await accedi(cliente, 'cliente@tyrecare.test');
  await cliente.goto(link);
  await expect(cliente.getByRole('alert')).toContainText(`L'invito è per ${email}`);
  await expect(cliente.getByRole('alert')).toContainText('sei entrato con cliente@tyrecare.test');
  await expect(cliente.getByRole('button', { name: 'Collega i miei veicoli' })).toHaveCount(0);

  // Uscendo resta sull'invito, pronto per accedere con l'email giusta
  await cliente.getByRole('button', { name: 'Esci e cambia account' }).click();
  await expect(cliente.getByRole('link', { name: 'Crea account' })).toBeVisible();
  await expect(cliente.getByText(email)).toBeVisible();
});

test("l'invito annullato dall'officina non si può più usare", async ({ page, browser }) => {
  const email = emailNuova();

  await accedi(page, 'titolare@tyrecare.test');
  const clienteId = await creaCliente(page, { nome: 'Marco', cognome: 'Prova', email });
  const link = await preparaInvito(page, clienteId);

  await page.goto(`/cliente?id=${clienteId}`);
  await expect(page.getByText(`Invito per ${email}`)).toBeVisible();
  await page.getByRole('button', { name: 'Annulla invito' }).click();
  await expect(page.getByRole('link', { name: "Invita nell'app" })).toBeVisible();

  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(link);
  await expect(cliente.getByRole('heading', { name: 'Invito annullato' })).toBeVisible();
  await expect(cliente.getByText(`${OFFICINA} ha annullato questo invito.`)).toBeVisible();
});

test('un codice inventato mostra "Invito non valido"', async ({ page }) => {
  await page.goto(`/invito?codice=${'0'.repeat(32)}`);
  await expect(page.getByRole('heading', { name: 'Invito non valido' })).toBeVisible();
});
