import '@fontsource-variable/inter';
import './styles/main.scss';
import { registerSW } from 'virtual:pwa-register';
import { mostraAnteprima } from './anteprima';
import { inizializzaAuth, sessioneCorrente } from './lib/auth';
import {
  PAGINA_ACCESSO,
  avviaRouter,
  destinazioneDopoAccesso,
  mostraPagina,
  rottaCorrente,
  vaiA,
  type Rotta,
} from './lib/router';
import { mostraAccedi } from './pagine/accedi';
import { mostraCambiaPassword } from './pagine/cambia-password';
import { mostraHome } from './pagine/home';
import { mostraModificaCliente } from './pagine/modifica-cliente';
import { mostraModificaControllo } from './pagine/modifica-controllo';
import { mostraModificaPneumatici } from './pagine/modifica-pneumatici';
import { mostraModificaProfilo } from './pagine/modifica-profilo';
import { mostraModificaVeicolo } from './pagine/modifica-veicolo';
import { mostraMontaPneumatici } from './pagine/monta-pneumatici';
import { mostraNonTrovata } from './pagine/non-trovata';
import { mostraNuovaPassword } from './pagine/nuova-password';
import { mostraNuovoCliente } from './pagine/nuovo-cliente';
import { mostraNuovoControllo } from './pagine/nuovo-controllo';
import { mostraNuovoVeicolo } from './pagine/nuovo-veicolo';
import { mostraPasswordDimenticata } from './pagine/password-dimenticata';
import { mostraProfilo } from './pagine/profilo';
import { mostraRegistrati } from './pagine/registrati';
import { mostraVeicolo } from './pagine/veicolo';

const ROTTE: Rotta[] = [
  { percorso: '/', accesso: 'utente', titolo: '', mostra: mostraHome },
  { percorso: '/profilo', accesso: 'utente', titolo: 'Profilo', mostra: mostraProfilo },
  {
    percorso: '/profilo/dati',
    accesso: 'utente',
    titolo: 'I tuoi dati',
    mostra: mostraModificaProfilo,
  },
  {
    percorso: '/profilo/password',
    accesso: 'utente',
    titolo: 'Cambia password',
    mostra: mostraCambiaPassword,
  },
  // Officina. L'accesso ai dati lo decide la RLS: un cliente su queste pagine non trova nulla
  {
    percorso: '/veicoli/nuovo',
    accesso: 'utente',
    titolo: 'Nuovo veicolo',
    mostra: mostraNuovoVeicolo,
  },
  {
    percorso: '/clienti/nuovo',
    accesso: 'utente',
    titolo: 'Nuovo cliente',
    mostra: mostraNuovoCliente,
  },
  {
    percorso: '/clienti/modifica',
    accesso: 'utente',
    titolo: 'Modifica cliente',
    mostra: mostraModificaCliente,
  },
  { percorso: '/veicolo', accesso: 'utente', titolo: 'Veicolo', mostra: mostraVeicolo },
  {
    percorso: '/veicolo/modifica',
    accesso: 'utente',
    titolo: 'Modifica veicolo',
    mostra: mostraModificaVeicolo,
  },
  {
    percorso: '/veicolo/pneumatici',
    accesso: 'utente',
    titolo: 'Monta pneumatici',
    mostra: mostraMontaPneumatici,
  },
  {
    percorso: '/veicolo/pneumatici/modifica',
    accesso: 'utente',
    titolo: 'Correggi pneumatici',
    mostra: mostraModificaPneumatici,
  },
  {
    percorso: '/veicolo/controllo',
    accesso: 'utente',
    titolo: 'Nuovo controllo',
    mostra: mostraNuovoControllo,
  },
  {
    percorso: '/controllo/modifica',
    accesso: 'utente',
    titolo: 'Correggi controllo',
    mostra: mostraModificaControllo,
  },
  { percorso: '/accedi', accesso: 'ospite', titolo: 'Accedi', mostra: mostraAccedi },
  { percorso: '/registrati', accesso: 'ospite', titolo: 'Registrati', mostra: mostraRegistrati },
  {
    percorso: '/password-dimenticata',
    accesso: 'ospite',
    titolo: 'Password dimenticata',
    mostra: mostraPasswordDimenticata,
  },
  {
    percorso: '/nuova-password',
    accesso: 'pubblica',
    titolo: 'Nuova password',
    mostra: mostraNuovaPassword,
  },
  // Pagina di riferimento del design system, con dati finti
  { percorso: '/anteprima', accesso: 'pubblica', titolo: 'Anteprima', mostra: mostraAnteprima },
];

const NON_TROVATA: Rotta = {
  percorso: '',
  accesso: 'pubblica',
  titolo: 'Pagina non trovata',
  mostra: mostraNonTrovata,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  await inizializzaAuth((evento) => {
    const rotta = rottaCorrente();
    if (evento === 'SIGNED_IN' && rotta.accesso === 'ospite') {
      vaiA(destinazioneDopoAccesso(), { sostituisci: true });
    } else if (evento === 'SIGNED_OUT' && rotta.accesso === 'utente') {
      vaiA(PAGINA_ACCESSO, { sostituisci: true });
    } else if (evento === 'PASSWORD_RECOVERY' && rotta.percorso !== '/nuova-password') {
      vaiA('/nuova-password', { sostituisci: true });
    } else if (evento === 'PASSWORD_RECOVERY') {
      void mostraPagina();
    }
  });
  await avviaRouter(app, {
    rotte: ROTTE,
    nonTrovata: NON_TROVATA,
    autenticato: () => sessioneCorrente() !== null,
  });
}

// Quando è disponibile una nuova versione dell'app chiede all'utente se ricaricare
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('È disponibile una nuova versione di TyreCare. Aggiornare ora?')) {
      void updateSW(true);
    }
  },
});
