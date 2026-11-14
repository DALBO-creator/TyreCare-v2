import { ShieldCheck } from 'lucide';
import { VerificaMfaSchema } from '@tyrecare/shared';
import { esci, messaggioErrore, sessioneCorrente } from '../lib/auth';
import { esc } from '../lib/html';
import {
  disattiva,
  fattoreAttivo,
  iniziaAttivazione,
  verificaCodice,
  type Attivazione,
} from '../lib/mfa';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp, paginaAuth } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { htmlErrore, intestazioneSottopagina } from './comune';
import { tornaAlProfilo } from './profilo';

const campoCodice = (etichetta = 'Codice di 6 cifre') =>
  campo({
    nome: 'codice',
    etichetta,
    tipo: 'text',
    autocomplete: 'one-time-code',
    attributi: 'inputmode="numeric" autocapitalize="off" maxlength="7"',
    aiuto: "Lo trovi nell'app di autenticazione; cambia ogni 30 secondi.",
  });

/**
 * Richiesta del codice dopo la password (sessione `aal1` di chi ha la 2FA attiva). La mostra il
 * router al posto della pagina richiesta; dopo il codice Supabase segnala MFA_CHALLENGE_VERIFIED e
 * main.ts ridisegna la pagina dell'URL.
 */
export function mostraCodiceAccesso(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'Verifica in due passaggi',
    sottotitolo: "Inserisci il codice dell'app di autenticazione per continuare.",
    corpo: `
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campoCodice()}
        ${pulsanteInvio('Continua', 'Verifica in corso…')}
        <button type="button" class="btn btn-outline-light btn-lg w-100" data-esci>Esci</button>
      </form>`,
    piede:
      'Hai perso il telefono? Scrivi a TyreCare: dopo aver verificato chi sei, togliamo la verifica in due passaggi dal tuo account.',
  });
  collegaModulo(app.querySelector('form')!, VerificaMfaSchema, ({ codice }) =>
    verificaCodice(codice),
  );
  app.querySelector('[data-esci]')?.addEventListener('click', () => void esci());
}

/** Per le pagine `/admin/…`: l'amministratore senza sessione al secondo livello deve attivare la 2FA. */
export function mostraAdminSenza2fa(app: HTMLElement): void {
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Amministrazione')}
    <div class="tc-contenuto">
      <div class="tc-avviso tc-avviso--giallo" role="status">
        <p class="mb-0">
          Le pagine di amministrazione si aprono solo con la verifica in due passaggi attiva:
          protegge i dati di tutte le officine anche se qualcuno scopre la tua password.
        </p>
      </div>
      <a class="btn btn-primary btn-lg w-100 mt-4" href="/profilo/sicurezza">
        Attiva la verifica in due passaggi
      </a>
    </div>`);
}

function moduloAttivazione(app: HTMLElement, attivazione: Attivazione): void {
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Verifica in due passaggi')}
    <div class="tc-contenuto">
      <ol>
        <li>Apri un'app di autenticazione (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Inquadra questo codice QR, oppure scrivi a mano la chiave qui sotto.</li>
        <li>Scrivi il codice di 6 cifre che l'app ti mostra.</li>
      </ol>
      <p class="text-center">
        <img class="tc-qr" data-qr alt="Codice QR da inquadrare con l'app di autenticazione" width="220" height="220" />
      </p>
      <p class="text-center"><code class="user-select-all" data-segreto></code></p>
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campoCodice()}
        ${pulsanteInvio('Attiva', 'Verifica in corso…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/profilo">Annulla</a>
      </form>
    </div>`);
  // Il QR è un URI `data:` generato da Supabase: si assegna come proprietà, mai dentro l'HTML
  const qr = app.querySelector<HTMLImageElement>('[data-qr]')!;
  if (attivazione.qr.startsWith('data:image/')) qr.src = attivazione.qr;
  app.querySelector('[data-segreto]')!.textContent = attivazione.segreto;
  collegaModulo(app.querySelector('form')!, VerificaMfaSchema, async ({ codice }) => {
    await verificaCodice(codice, attivazione.id);
    tornaAlProfilo('Verifica in due passaggi attivata: al prossimo accesso ti chiederemo il codice.');
  });
}

/** Pagina del profilo per attivare o disattivare la verifica in due passaggi. */
export function mostraSicurezza(app: HTMLElement): void {
  const n = visualizzazioneCorrente();

  if (fattoreAttivo(sessioneCorrente())) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Verifica in due passaggi')}
      <div class="tc-contenuto">
        <div class="tc-avviso tc-avviso--verde" role="status">
          <p class="mb-0">${icona(ShieldCheck)} La verifica in due passaggi è attiva.</p>
        </div>
        <p class="mt-3">
          Per disattivarla scrivi un codice dell'app di autenticazione. Se sei amministratore di
          TyreCare, senza verifica in due passaggi non potrai aprire le pagine di amministrazione.
        </p>
        <form class="tc-auth__modulo" novalidate>
          ${RIQUADRO_ERRORE}
          ${campoCodice()}
          ${pulsanteInvio('Disattiva', 'Un momento…')}
          <a class="btn btn-outline-light btn-lg w-100" href="/profilo">Annulla</a>
        </form>
      </div>`);
    collegaModulo(app.querySelector('form')!, VerificaMfaSchema, async ({ codice }) => {
      await disattiva(codice);
      tornaAlProfilo('Verifica in due passaggi disattivata.');
    });
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Verifica in due passaggi')}
    <div class="tc-contenuto">
      <p>
        Oltre alla password ti chiediamo un codice di 6 cifre generato da un'app sul tuo telefono.
        Così chi scopre la tua password non entra comunque nel tuo account.
      </p>
      <div data-errore></div>
      <button type="button" class="btn btn-primary btn-lg w-100" data-attiva>
        ${icona(ShieldCheck)} Attiva la verifica in due passaggi
      </button>
      <a class="btn btn-outline-light btn-lg w-100 mt-2" href="/profilo">Annulla</a>
    </div>`);
  app.querySelector<HTMLButtonElement>('[data-attiva]')?.addEventListener('click', async () => {
    app.innerHTML = paginaApp(caricamento());
    try {
      const attivazione = await iniziaAttivazione();
      if (ancoraAttuale(n)) moduloAttivazione(app, attivazione);
    } catch (errore) {
      if (!ancoraAttuale(n)) return;
      mostraSicurezza(app);
      app.querySelector('[data-errore]')!.innerHTML = htmlErrore(esc(messaggioErrore(errore)));
    }
  });
}
