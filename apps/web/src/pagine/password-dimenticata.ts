import { MailCheck } from 'lucide';
import { RecuperoPasswordSchema } from '@tyrecare/shared';
import { inviaRecuperoPassword } from '../lib/auth';
import { esc } from '../lib/html';
import { icona } from '../ui/icone';
import { paginaAuth } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { avvisoConferma } from './comune';

export function mostraPasswordDimenticata(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'Password dimenticata',
    sottotitolo:
      "Inserisci l'email del tuo account: ti invieremo un link per sceglierne una nuova.",
    corpo: `
      ${avvisoConferma()}
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campo({ nome: 'email', etichetta: 'Email', tipo: 'email', autocomplete: 'email' })}
        ${pulsanteInvio('Invia il link', 'Invio in corso…')}
      </form>`,
    piede: '<a href="/accedi">Torna all\'accesso</a>',
  });

  collegaModulo(app.querySelector('form')!, RecuperoPasswordSchema, async (dati) => {
    await inviaRecuperoPassword(dati);
    // Stesso messaggio che l'account esista o no: non si rivela quali email sono registrate
    app.innerHTML = paginaAuth({
      titolo: 'Controlla la posta',
      corpo: `
        <div class="tc-auth__conferma">
          <span class="tc-auth__icona-conferma">${icona(MailCheck)}</span>
          <p>
            Se <strong>${esc(dati.email)}</strong> corrisponde a un account, riceverai a breve
            un link per impostare una nuova password.
          </p>
          <p class="text-body-secondary small mb-0">Il link vale per un'ora.</p>
        </div>`,
      piede: '<a href="/accedi">Torna all\'accesso</a>',
    });
    app.querySelector('h1')?.focus();
  });
}
