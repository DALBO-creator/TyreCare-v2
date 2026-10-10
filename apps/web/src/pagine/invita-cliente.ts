import { Copy, Mail, Share2 } from 'lucide';
import { InvitoSchema } from '@tyrecare/shared';
import { esc } from '../lib/html';
import { creaInvito, GIORNI_VALIDITA, linkInvito, mailtoInvito } from '../lib/inviti';
import { caricaCliente, nominativo, type SchedaCliente } from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import {
  formattaData,
  gestisciErroreCaricamento,
  idValido,
  intestazioneSottopagina,
  parametro,
} from './comune';
import { nonTrovato } from './veicolo';

/**
 * Invito di un cliente nell'app: `/cliente/invito?id=…`. Si sceglie l'email (di solito quella del
 * cliente), il database crea l'invito e la pagina prepara l'email da mandare dal programma di posta
 * dell'officina, oppure il link da condividere o copiare.
 */
export async function mostraInvitaCliente(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const id = parametro('id');
  let cliente: SchedaCliente | null = null;
  let officina = '';
  try {
    if (idValido(id)) {
      const [c, utente] = await Promise.all([caricaCliente(id), caricaDatiUtente()]);
      const membro = c && utente.officine.find((o) => o.officina.id === c.officina_id);
      if (c && membro) {
        cliente = c;
        officina = membro.officina.ragione_sociale;
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

  const indietro = `/cliente?id=${cliente.id}`;
  const nome = nominativo(cliente);
  if (cliente.profile_id) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina("Invita nell'app", nome)}
      <div class="tc-contenuto">
        <p>Questo cliente ha già collegato il suo account: vede i suoi veicoli nel garage.</p>
        <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Torna al cliente</a>
      </div>`);
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina("Invita nell'app", nome)}
    <div class="tc-contenuto">
      <p class="text-body-secondary mb-0">
        Il cliente riceve un link: accedendo con questa email vede sul telefono i suoi veicoli, lo
        stato delle gomme e i controlli. Il link vale ${GIORNI_VALIDITA} giorni.
      </p>
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campo({
          nome: 'email',
          etichetta: 'Email del cliente',
          tipo: 'email',
          autocomplete: 'off',
          valore: cliente.email ?? '',
          aiuto: "Il cliente dovrà usare questa email per accedere all'app.",
        })}
        ${pulsanteInvio('Prepara invito', 'Creazione…')}
        <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Annulla</a>
      </form>
    </div>`);

  const scheda = cliente;
  collegaModulo(app.querySelector('form')!, InvitoSchema, async ({ email }) => {
    const invito = await creaInvito(scheda.id, email);
    if (!ancoraAttuale(n)) return;
    mostraInvitoPronto(app, {
      officina,
      nome: scheda.ragione_sociale ? '' : scheda.nome,
      email,
      link: linkInvito(invito.codice),
      scadenza: formattaData(invito.scade_il.slice(0, 10)),
      nominativo: nome,
      indietro,
    });
  });
}

interface InvitoPronto {
  officina: string;
  nome: string;
  email: string;
  link: string;
  scadenza: string;
  nominativo: string;
  indietro: string;
}

/** L'invito è creato: email già scritta, oppure link da condividere (WhatsApp…) o copiare. */
function mostraInvitoPronto(app: HTMLElement, invito: InvitoPronto): void {
  const condividi = typeof navigator.share === 'function';
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Invito pronto', invito.nominativo)}
    <div class="tc-contenuto">
      <p class="mb-0">
        Manda il link a <strong>${esc(invito.email)}</strong>. Vale fino al
        ${esc(invito.scadenza)}.
      </p>
      <div class="tc-azione">
        <a class="btn btn-primary btn-lg w-100" href="${esc(mailtoInvito(invito))}">
          ${icona(Mail)} Scrivi l'email
        </a>
        ${
          condividi
            ? `<button type="button" class="btn btn-outline-light btn-lg w-100" data-condividi>
                ${icona(Share2)} Condividi il link
              </button>`
            : ''
        }
        <button type="button" class="btn btn-outline-light btn-lg w-100" data-copia>
          ${icona(Copy)} Copia il link
        </button>
        <p class="small text-body-secondary mb-0" data-esito role="status" hidden></p>
      </div>
      <p class="small text-body-secondary mb-0">
        Il link si vede solo adesso. Se lo perdi, crea un nuovo invito: quello vecchio non varrà
        più. Anche se il link finisce ad altri, i veicoli si collegano solo all'account con questa
        email.
      </p>
      <a class="btn btn-outline-light btn-lg w-100" href="${invito.indietro}">Torna al cliente</a>
    </div>`);
  app.querySelector('h1')?.focus();

  const esito = app.querySelector<HTMLElement>('[data-esito]')!;
  app.querySelector('[data-copia]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(invito.link);
      esito.textContent = 'Link copiato.';
      esito.hidden = false;
    } catch {
      // Appunti non disponibili (es. permesso negato): si mostra il link da copiare a mano
      esito.textContent = invito.link;
      esito.hidden = false;
    }
  });
  app.querySelector('[data-condividi]')?.addEventListener('click', async () => {
    try {
      await navigator.share({
        title: `${invito.officina} ti invita su TyreCare`,
        text: `Collega i tuoi veicoli su TyreCare accedendo con ${invito.email}:`,
        url: invito.link,
      });
    } catch {
      // Condivisione annullata dall'utente: niente da fare
    }
  });
}
