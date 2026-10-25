import { esci } from '../lib/auth';
import { eliminaAccount } from '../lib/profilo';
import { collegaElimina, pulsanteElimina } from '../ui/conferma';
import { paginaApp } from '../ui/layout';
import { impostaConferma, intestazioneSottopagina } from './comune';

/** Eliminazione dell'account da utente autenticato; i casi vietati li segnala il database. */
export function mostraEliminaAccount(app: HTMLElement): void {
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Elimina il tuo account')}
    <div class="tc-contenuto">
      <p>
        Verranno eliminati il tuo account, il tuo profilo, le notifiche, i commenti e le
        prenotazioni passate.
      </p>
      <p>
        Le officine di cui sei cliente conservano la tua scheda e i tuoi veicoli, ma non sono più
        collegati all'app.
      </p>
      <p><strong>L'operazione non si può annullare.</strong></p>
      ${pulsanteElimina('Elimina il mio account')}
      <a class="btn btn-outline-light btn-lg w-100" href="/profilo">Annulla</a>
    </div>`);

  collegaElimina(app, {
    titolo: 'Eliminare il tuo account?',
    testo:
      "Account, profilo, notifiche, commenti e prenotazioni passate verranno eliminati. L'operazione non si può annullare.",
    pulsante: 'Sì, elimina',
    azione: async () => {
      await eliminaAccount();
      // Il messaggio resta in attesa: il ritorno all'accesso lo fa main.ts su SIGNED_OUT
      impostaConferma('Il tuo account è stato eliminato.');
      await esci();
    },
  });
}
