import { Link2, MailWarning } from 'lucide';
import { esci, messaggioErrore, sessioneCorrente } from '../lib/auth';
import { ErroreModulo } from '../lib/errori';
import { esc } from '../lib/html';
import { accettaInvito, leggiInvito, type InfoInvito } from '../lib/inviti';
import { ancoraAttuale, mostraPagina, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaAuth } from '../ui/layout';
import {
  erroreCaricamento,
  formattaData,
  mostraErroreInBox,
  parametro,
  vaiConConferma,
} from './comune';

// Il codice è di 16 byte scritti in esadecimale (`crea_invito_cliente`)
const CODICE = /^[0-9a-f]{32}$/;

/**
 * Pagina che il cliente apre dal link dell'invito: `/invito?codice=…`. È pubblica: senza accesso
 * mostra l'officina e l'email da usare, con "Crea account" e "Accedi" che riportano qui; con
 * l'accesso giusto si collegano i veicoli con un tocco.
 */
export async function mostraInvito(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaAuth({ titolo: 'Invito', corpo: caricamento() });

  const codice = (parametro('codice') ?? '').trim().toLowerCase();
  let info: InfoInvito | null = null;
  try {
    if (CODICE.test(codice)) info = await leggiInvito(codice);
  } catch {
    if (ancoraAttuale(n))
      app.innerHTML = paginaAuth({ titolo: 'Invito', corpo: erroreCaricamento() });
    return;
  }
  if (!ancoraAttuale(n)) return;

  if (!info)
    return messaggio(app, 'Invito non valido', 'Controlla di aver aperto il link completo.');
  if (info.stato === 'USATO') {
    return info.usato_da_te
      ? messaggio(
          app,
          'Veicoli già collegati',
          `I veicoli registrati da ${info.officina} sono già nel tuo garage.`,
          { garage: true },
        )
      : messaggio(app, 'Invito già usato', 'Questo invito è già stato usato da un altro account.');
  }
  if (info.stato === 'ANNULLATO') {
    return messaggio(app, 'Invito annullato', `${info.officina} ha annullato questo invito.`, {
      chiedi: true,
    });
  }
  if (info.stato === 'SCADUTO') {
    return messaggio(app, 'Invito scaduto', `L'invito di ${info.officina} è scaduto.`, {
      chiedi: true,
    });
  }

  const email = sessioneCorrente()?.user.email?.toLowerCase();
  if (!email) return mostraDaOspite(app, codice, info);
  if (email !== info.email) return mostraEmailDiversa(app, info, email);
  mostraAccetta(app, codice, info);
}

const titoloInvito = (info: InfoInvito) => `${info.officina} ti invita su TyreCare`;
const SOTTOTITOLO = "Collega i tuoi veicoli e tieni d'occhio le gomme dal telefono.";

function mostraDaOspite(app: HTMLElement, codice: string, info: InfoInvito): void {
  // Dopo la registrazione (link di conferma) o l'accesso si torna su questa pagina
  const ritorno = new URLSearchParams({ email: info.email, dopo: `/invito?codice=${codice}` });
  app.innerHTML = paginaAuth({
    titolo: titoloInvito(info),
    sottotitolo: SOTTOTITOLO,
    corpo: `
      <div class="tc-auth__modulo">
        <p class="mb-0">
          Crea il tuo account o accedi con <strong>${esc(info.email)}</strong>: è l'email a cui
          l'officina ha mandato l'invito.
        </p>
        <a class="btn btn-primary btn-lg w-100" href="/registrati?${esc(ritorno.toString())}">
          Crea account
        </a>
        <a class="btn btn-outline-light btn-lg w-100" href="/accedi?${esc(ritorno.toString())}">
          Ho già un account
        </a>
        <p class="small text-body-secondary mb-0">
          L'invito vale fino al ${esc(formattaData(info.scade_il.slice(0, 10)))}.
        </p>
      </div>`,
  });
}

function mostraEmailDiversa(app: HTMLElement, info: InfoInvito, email: string): void {
  app.innerHTML = paginaAuth({
    titolo: titoloInvito(info),
    corpo: `
      <div class="tc-auth__modulo">
        <div class="tc-avviso tc-avviso--giallo" role="alert">
          ${icona(MailWarning)}
          <p class="mb-0">
            L'invito è per <strong>${esc(info.email)}</strong>, ma sei entrato con
            <strong>${esc(email)}</strong>. Esci e accedi con l'email dell'invito, oppure chiedi
            all'officina di mandarlo all'email del tuo account.
          </p>
        </div>
        <div class="tc-avviso tc-avviso--rosso" data-errore role="alert" tabindex="-1" hidden></div>
        <button type="button" class="btn btn-primary btn-lg w-100" data-esci>
          Esci e cambia account
        </button>
        <a class="btn btn-outline-light btn-lg w-100" href="/">Vai al tuo garage</a>
      </div>`,
  });

  const pulsante = app.querySelector<HTMLButtonElement>('[data-esci]')!;
  pulsante.addEventListener('click', async () => {
    pulsante.disabled = true;
    try {
      await esci();
      // La pagina è pubblica: dopo l'uscita si resta qui e si vedono "Crea account" e "Accedi"
      await mostraPagina();
    } catch (e) {
      pulsante.disabled = false;
      mostraErrore(app, messaggioErrore(e));
    }
  });
}

function mostraAccetta(app: HTMLElement, codice: string, info: InfoInvito): void {
  app.innerHTML = paginaAuth({
    titolo: titoloInvito(info),
    sottotitolo: SOTTOTITOLO,
    corpo: `
      <div class="tc-auth__modulo">
        <p class="mb-0">
          Collegando il tuo account, nel garage vedrai i veicoli che ${esc(info.officina)} ha
          registrato a tuo nome, lo stato delle gomme e i controlli.
        </p>
        <div class="tc-avviso tc-avviso--rosso" data-errore role="alert" tabindex="-1" hidden></div>
        <button type="button" class="btn btn-primary btn-lg w-100" data-accetta>
          ${icona(Link2)} Collega i miei veicoli
        </button>
        <a class="btn btn-outline-light btn-lg w-100" href="/">Non ora</a>
      </div>`,
  });

  const pulsante = app.querySelector<HTMLButtonElement>('[data-accetta]')!;
  const testo = pulsante.innerHTML;
  pulsante.addEventListener('click', async () => {
    pulsante.disabled = true;
    pulsante.setAttribute('aria-busy', 'true');
    pulsante.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
      Collegamento…`;
    try {
      const officina = await accettaInvito(codice);
      vaiConConferma('/', `Fatto! I veicoli registrati da ${officina} sono nel tuo garage.`);
    } catch (e) {
      pulsante.disabled = false;
      pulsante.removeAttribute('aria-busy');
      pulsante.innerHTML = testo;
      mostraErrore(app, e instanceof ErroreModulo ? e.message : messaggioErrore(e));
    }
  });
}

function mostraErrore(app: HTMLElement, testo: string): void {
  mostraErroreInBox(app.querySelector<HTMLElement>('[data-errore]'), testo);
}

/** Invito che non si può usare: spiegazione e un'uscita (garage o richiesta di un nuovo invito). */
function messaggio(
  app: HTMLElement,
  titolo: string,
  testo: string,
  { garage = false, chiedi = false } = {},
): void {
  app.innerHTML = paginaAuth({
    titolo,
    corpo: `
      <div class="tc-auth__modulo">
        <p class="mb-0">${esc(testo)}</p>
        ${
          chiedi
            ? `<p class="mb-0 text-body-secondary">
                Chiedi all'officina di mandarti un nuovo invito.
              </p>`
            : ''
        }
        <a class="btn ${garage ? 'btn-primary' : 'btn-outline-light'} btn-lg w-100" href="/">
          ${garage ? 'Vai al tuo garage' : "Vai all'app"}
        </a>
      </div>`,
  });
}
