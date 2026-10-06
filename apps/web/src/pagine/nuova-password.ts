import { CircleCheck } from 'lucide';
import { NuovaPasswordSchema, PASSWORD_MIN } from '@tyrecare/shared';
import { impostaNuovaPassword, sessioneCorrente } from '../lib/auth';
import { icona } from '../ui/icone';
import { paginaAuth } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';

/**
 * Arrivo dal link dell'email di recupero: Supabase legge il token dall'URL e apre una sessione
 * temporanea, con cui si può cambiare la password. Senza sessione il link è scaduto o già usato.
 */
export function mostraNuovaPassword(app: HTMLElement): void {
  if (!sessioneCorrente()) {
    app.innerHTML = paginaAuth({
      titolo: 'Link non valido',
      corpo: `
        <div class="tc-avviso tc-avviso--giallo">
          <p class="mb-0">
            Il link per cambiare la password è scaduto o è già stato usato. Richiedine uno nuovo.
          </p>
        </div>
        <a class="btn btn-primary btn-lg w-100 mt-4" href="/password-dimenticata">Richiedi un nuovo link</a>`,
    });
    return;
  }

  app.innerHTML = paginaAuth({
    titolo: 'Nuova password',
    sottotitolo: 'Scegli la password che userai da ora in poi.',
    corpo: `
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campo({
          nome: 'password',
          etichetta: 'Nuova password',
          tipo: 'password',
          autocomplete: 'new-password',
          aiuto: `Almeno ${PASSWORD_MIN} caratteri.`,
        })}
        ${pulsanteInvio('Salva la password', 'Salvataggio…')}
      </form>`,
  });

  collegaModulo(app.querySelector('form')!, NuovaPasswordSchema, async (dati) => {
    await impostaNuovaPassword(dati);
    app.innerHTML = paginaAuth({
      titolo: 'Password aggiornata',
      corpo: `
        <div class="tc-auth__conferma">
          <span class="tc-auth__icona-conferma">${icona(CircleCheck)}</span>
          <p class="mb-0">Da ora accedi con la nuova password.</p>
        </div>
        <a class="btn btn-primary btn-lg w-100 mt-4" href="/">Continua</a>`,
    });
    app.querySelector('h1')?.focus();
  });
}
