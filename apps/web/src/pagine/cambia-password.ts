import { CambioPasswordSchema, PASSWORD_MIN } from '@tyrecare/shared';
import { cambiaPassword } from '../lib/auth';
import { paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { intestazioneSottopagina } from './comune';
import { tornaAlProfilo } from './profilo';

/** Cambio password da utente già autenticato (chi l'ha dimenticata usa il recupero via email). */
export function mostraCambiaPassword(app: HTMLElement): void {
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Cambia password')}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campo({
          nome: 'attuale',
          etichetta: 'Password attuale',
          tipo: 'password',
          autocomplete: 'current-password',
        })}
        ${campo({
          nome: 'password',
          etichetta: 'Nuova password',
          tipo: 'password',
          autocomplete: 'new-password',
          aiuto: `Almeno ${PASSWORD_MIN} caratteri.`,
        })}
        ${pulsanteInvio('Cambia password', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/profilo">Annulla</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, CambioPasswordSchema, async (dati) => {
    await cambiaPassword(dati);
    tornaAlProfilo('Password aggiornata: da ora accedi con quella nuova.');
  });
}
