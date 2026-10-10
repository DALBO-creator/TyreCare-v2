import { Mail, MailCheck, Pencil, Phone, Plus, Send, Smartphone } from 'lucide';
import { esc } from '../lib/html';
import { annullaInvito, caricaInvitoInCorso, type InvitoInCorso } from '../lib/inviti';
import {
  caricaCliente,
  caricaVeicoli,
  nominativo,
  type SchedaCliente,
  type VeicoloInElenco,
} from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, mostraPagina, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  avvisoConferma,
  conData,
  formattaData,
  gestisciErroreCaricamento,
  idValido,
  parametro,
} from './comune';
import { messaggioErrore } from '../lib/auth';
import { ordinaPerUrgenza, rigaVeicolo } from './home-officina';
import { nonTrovato, riga } from './veicolo';

/** Scheda di un cliente dell'officina, con contatti e veicoli: `/cliente?id=…`. */
export async function mostraCliente(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const id = parametro('id') ?? '';
  let cliente: SchedaCliente | null = null;
  let veicoli: VeicoloInElenco[] = [];
  let invito: InvitoInCorso | null = null;
  try {
    if (idValido(id)) {
      const [c, v, utente, i] = await Promise.all([
        caricaCliente(id),
        caricaVeicoli({ clienteId: id }),
        caricaDatiUtente(),
        caricaInvitoInCorso(id),
      ]);
      invito = i;
      // Il cliente con un account vede la propria anagrafica, ma non è un membro dell'officina
      if (c && utente.officine.some((o) => o.officina.id === c.officina_id)) {
        cliente = c;
        veicoli = ordinaPerUrgenza(v);
      }
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!cliente) {
    app.innerHTML = paginaApp(nonTrovato('Cliente non trovato', 'Il cliente'));
    return;
  }

  const nome = nominativo(cliente);
  document.title = `${nome} · TyreCare`;
  // Per un'azienda il nome della persona di riferimento va sotto la ragione sociale
  const referente = cliente.ragione_sociale ? `${cliente.nome} ${cliente.cognome}`.trim() : '';

  app.innerHTML = paginaApp(`
    <section class="tc-hero">
      <p class="tc-etichetta">Cliente</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">${esc(nome)}</h1>
      ${
        referente || cliente.profile_id
          ? `<p class="tc-hero__dettagli">
              ${referente ? `<span>${esc(referente)}</span>` : ''}
              ${cliente.profile_id ? `<span>${icona(Smartphone)} Usa l'app TyreCare</span>` : ''}
            </p>`
          : ''
      }
    </section>

    <div class="tc-contenuto">
      ${avvisoConferma()}
      <section aria-labelledby="tc-contatti">
        <div class="tc-sezione-testa">
          <h2 id="tc-contatti" class="tc-etichetta">Contatti</h2>
          <a href="/clienti/modifica?id=${cliente.id}" aria-label="Modifica i dati del cliente">
            Modifica
          </a>
        </div>
        ${contatti(cliente)}
        ${cliente.note ? `<p class="tc-scheda-note">${esc(cliente.note)}</p>` : ''}
      </section>

      ${sezioneApp(cliente, invito)}

      <section aria-labelledby="tc-veicoli">
        <h2 id="tc-veicoli" class="tc-etichetta">${veicoli.length === 1 ? 'Veicolo' : 'Veicoli'}</h2>
        ${
          veicoli.length > 0
            ? `<div class="tc-lista">${veicoli.map((v) => rigaVeicolo(v, true)).join('')}</div>`
            : `<p class="text-body-secondary">Nessun veicolo registrato per questo cliente.</p>`
        }
        <a class="btn btn-outline-light btn-lg w-100 mt-3" href="/veicoli/nuovo?cliente=${cliente.id}&da=cliente">
          ${icona(Plus)} Nuovo veicolo
        </a>
      </section>

      <a class="btn btn-outline-light btn-lg w-100" href="/clienti/modifica?id=${cliente.id}">
        ${icona(Pencil)} Modifica dati del cliente
      </a>
    </div>`);

  collegaAnnullaInvito(app, cliente.id);
}

/**
 * Collegamento all'app TyreCare: già collegato, invito in corso (con "Invia di nuovo" e "Annulla"),
 * oppure il pulsante per invitare il cliente.
 */
function sezioneApp(c: SchedaCliente, invito: InvitoInCorso | null): string {
  const invita = `/cliente/invito?id=${c.id}`;
  let corpo: string;
  if (c.profile_id) {
    corpo = `
      <div class="tc-lista">
        ${riga(Smartphone, "Usa l'app TyreCare", 'Vede i suoi veicoli e i controlli nel suo garage')}
      </div>`;
  } else if (invito) {
    corpo = `
      <div class="tc-lista">
        ${riga(
          MailCheck,
          `Invito per ${esc(invito.email)}`,
          `Creato ${esc(conData('del', invito.created_at.slice(0, 10)))}, vale fino al ${esc(
            formattaData(invito.scade_il.slice(0, 10)),
          )}`,
        )}
      </div>
      <div class="tc-avviso tc-avviso--rosso" data-errore-invito role="alert" hidden></div>
      <div class="tc-coppia-pulsanti">
        <a class="btn btn-outline-light btn-lg" href="${invita}">Nuovo invito</a>
        <button type="button" class="btn btn-outline-light btn-lg" data-annulla-invito>
          Annulla invito
        </button>
      </div>`;
  } else {
    corpo = `
      <p class="text-body-secondary">
        Invitalo a vedere sul telefono i suoi veicoli, lo stato delle gomme e i controlli.
      </p>
      <a class="btn btn-outline-light btn-lg w-100" href="${invita}">
        ${icona(Send)} Invita nell'app
      </a>`;
  }
  return `
    <section aria-labelledby="tc-app">
      <h2 id="tc-app" class="tc-etichetta">App TyreCare</h2>
      ${corpo}
    </section>`;
}

function collegaAnnullaInvito(app: HTMLElement, clienteId: string): void {
  const pulsante = app.querySelector<HTMLButtonElement>('[data-annulla-invito]');
  const errore = app.querySelector<HTMLElement>('[data-errore-invito]');
  pulsante?.addEventListener('click', async () => {
    pulsante.disabled = true;
    try {
      await annullaInvito(clienteId);
      await mostraPagina();
    } catch (e) {
      pulsante.disabled = false;
      if (errore) {
        errore.innerHTML = `<p class="mb-0">${esc(messaggioErrore(e))}</p>`;
        errore.hidden = false;
      }
    }
  });
}

function contatti(c: SchedaCliente): string {
  const righe = [
    c.telefono
      ? riga(Phone, 'Chiama', esc(c.telefono), `tel:${esc(c.telefono.replace(/\s/g, ''))}`)
      : '',
    c.email ? riga(Mail, 'Scrivi', esc(c.email), `mailto:${esc(c.email)}`) : '',
  ].filter(Boolean);
  return `<div class="tc-lista">${
    righe.length > 0
      ? righe.join('')
      : riga(Phone, 'Nessun contatto', 'Aggiungi telefono o email', `/clienti/modifica?id=${c.id}`)
  }</div>`;
}
