import { Mail, Pencil, Phone, Plus, Smartphone } from 'lucide';
import { esc } from '../lib/html';
import {
  caricaCliente,
  caricaVeicoli,
  nominativo,
  type SchedaCliente,
  type VeicoloInElenco,
} from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { avvisoConferma, gestisciErroreCaricamento, idValido, parametro } from './comune';
import { ordinaPerUrgenza, rigaVeicolo } from './home-officina';
import { nonTrovato, riga } from './veicolo';

/** Scheda di un cliente dell'officina, con contatti e veicoli: `/cliente?id=…`. */
export async function mostraCliente(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const id = parametro('id') ?? '';
  let cliente: SchedaCliente | null = null;
  let veicoli: VeicoloInElenco[] = [];
  try {
    if (idValido(id)) {
      const [c, v, utente] = await Promise.all([
        caricaCliente(id),
        caricaVeicoli({ clienteId: id }),
        caricaDatiUtente(),
      ]);
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
