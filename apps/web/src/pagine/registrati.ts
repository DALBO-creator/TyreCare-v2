import { MailCheck } from 'lucide';
import { AIUTO_PASSWORD, ETA_MINIMA, RegistrazioneSchema } from '@tyrecare/shared';
import { registrati } from '../lib/auth';
import { esc } from '../lib/html';
import { icona } from '../ui/icone';
import { paginaAuth } from '../ui/layout';
import { piedeLegale } from '../ui/piede-legale';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { avvisoConferma, parametro } from './comune';

export function mostraRegistrati(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'Crea il tuo account',
    sottotitolo: 'Tieni sotto controllo gomme, controlli e appuntamenti in officina.',
    corpo: `
      ${avvisoConferma()}
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        <div class="tc-auth__coppia">
          ${campo({ nome: 'nome', etichetta: 'Nome', tipo: 'text', autocomplete: 'given-name' })}
          ${campo({ nome: 'cognome', etichetta: 'Cognome', tipo: 'text', autocomplete: 'family-name' })}
        </div>
        ${campo({
          nome: 'email',
          etichetta: 'Email',
          tipo: 'email',
          autocomplete: 'email',
          valore: parametro('email') ?? '',
        })}
        ${campo({
          nome: 'password',
          etichetta: 'Password',
          tipo: 'password',
          autocomplete: 'new-password',
          aiuto: AIUTO_PASSWORD,
        })}
        <div class="form-check">
          <input class="form-check-input" type="checkbox" name="accetto" id="campo-accetto"
            aria-describedby="campo-accetto-errore" />
          <label class="form-check-label" for="campo-accetto">
            Ho letto l'<a href="/privacy" target="_blank" rel="noopener">informativa privacy</a>,
            accetto i <a href="/termini" target="_blank" rel="noopener">termini di servizio</a>
            e dichiaro di avere almeno ${ETA_MINIMA} anni
          </label>
          <div id="campo-accetto-errore" class="tc-campo__errore" hidden></div>
        </div>
        ${pulsanteInvio('Crea account', 'Creazione in corso…')}
      </form>`,
    // Il passaggio tra accesso e registrazione conserva `?dopo=` ed `?email=` (es. dall'invito)
    piede: `Hai già un account? <a href="/accedi${esc(location.search)}">Accedi</a><br>${piedeLegale()}`,
  });

  collegaModulo(app.querySelector('form')!, RegistrazioneSchema, async (dati) => {
    const dentro = await registrati(dati);
    // Se la conferma email è disattivata l'utente è già dentro: ci pensa main.ts (SIGNED_IN)
    if (!dentro) mostraControllaEmail(app, dati.email);
  });
}

function mostraControllaEmail(app: HTMLElement, email: string): void {
  app.innerHTML = paginaAuth({
    titolo: 'Controlla la posta',
    corpo: `
      <div class="tc-auth__conferma">
        <span class="tc-auth__icona-conferma">${icona(MailCheck)}</span>
        <p>
          Ti abbiamo inviato un link a <strong>${esc(email)}</strong>.
          Aprilo per confermare l'email e attivare l'account.
        </p>
        <p class="text-body-secondary small mb-0">
          Non lo trovi? Guarda nella cartella spam o promozioni.
        </p>
      </div>`,
    piede: '<a href="/accedi">Torna all\'accesso</a>',
  });
  app.querySelector('h1')?.focus();
}
