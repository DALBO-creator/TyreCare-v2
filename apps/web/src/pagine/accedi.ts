import { AccessoSchema } from '@tyrecare/shared';
import { accedi } from '../lib/auth';
import { esc } from '../lib/html';
import { paginaAuth } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { avvisoConferma, parametro } from './comune';

export function mostraAccedi(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'Accedi',
    sottotitolo: 'Lo stato dei tuoi pneumatici, sempre sotto controllo.',
    corpo: `
      ${avvisoConferma()}
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
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
          autocomplete: 'current-password',
        })}
        <a class="tc-auth__link-secondario" href="/password-dimenticata">Password dimenticata?</a>
        ${pulsanteInvio('Accedi', 'Accesso in corso…')}
      </form>`,
    // Il passaggio tra accesso e registrazione conserva `?dopo=` ed `?email=` (es. dall'invito)
    piede: `Non hai un account? <a href="/registrati${esc(location.search)}">Registrati</a><br><a href="/per-le-officine">Sei un'officina? Scopri TyreCare per le officine</a>`,
  });

  // Dopo l'accesso il cambio di pagina lo fa main.ts, quando Supabase segnala SIGNED_IN
  collegaModulo(app.querySelector('form')!, AccessoSchema, accedi);
}
