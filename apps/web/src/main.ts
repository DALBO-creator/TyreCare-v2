import '@fontsource-variable/inter';
import './styles/main.scss';
import { registerSW } from 'virtual:pwa-register';
import { mostraAnteprima } from './anteprima';
import { inizializzaAuth, sessioneCorrente } from './lib/auth';
import { fermaNotifiche } from './lib/notifiche';
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
import {
  mostraAppuntamenti,
  mostraAppuntamento,
  mostraProponi,
  mostraRifiuta,
} from './pagine/appuntamenti';
import { mostraCalendario } from './pagine/calendario';
import { mostraCambiaPassword } from './pagine/cambia-password';
import { mostraCliente } from './pagine/cliente';
import { mostraClienti } from './pagine/clienti';
import { mostraGarageVeicolo } from './pagine/garage-veicolo';
import { mostraHome } from './pagine/home';
import { mostraImporta } from './pagine/importa';
import { mostraInvitaCliente } from './pagine/invita-cliente';
import { mostraInvito } from './pagine/invito';
import { mostraModificaCliente } from './pagine/modifica-cliente';
import { mostraModificaControllo } from './pagine/modifica-controllo';
import { mostraModificaPneumatici } from './pagine/modifica-pneumatici';
import { mostraModificaProfilo } from './pagine/modifica-profilo';
import { mostraModificaVeicolo } from './pagine/modifica-veicolo';
import { mostraMontaPneumatici } from './pagine/monta-pneumatici';
import { mostraNonTrovata } from './pagine/non-trovata';
import { mostraNotifiche } from './pagine/notifiche';
import { mostraNuovaPassword } from './pagine/nuova-password';
import { mostraNuovoCliente } from './pagine/nuovo-cliente';
import { mostraNuovoControllo } from './pagine/nuovo-controllo';
import { mostraNuovoVeicolo } from './pagine/nuovo-veicolo';
import { mostraOfficina, mostraOfficine, mostraPrenota } from './pagine/officine';
import { mostraNuovaChiusura, mostraOrari } from './pagine/orari';
import { mostraPasswordDimenticata } from './pagine/password-dimenticata';
import { mostraPneumatico } from './pagine/pneumatico';
import { mostraProfilo } from './pagine/profilo';
import { mostraRegistrati } from './pagine/registrati';
import { mostraReport } from './pagine/report';
import { mostraModificaServizio, mostraNuovoServizio, mostraServizi } from './pagine/servizi';
import { mostraSmontaPneumatici } from './pagine/smonta-pneumatici';
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
  // Garage del cliente: i suoi veicoli uniti per targa tra le officine
  {
    percorso: '/garage/veicolo',
    accesso: 'utente',
    titolo: 'Il tuo veicolo',
    mostra: mostraGarageVeicolo,
  },
  // Report di un controllo: per il cliente e per l'officina che l'ha eseguito (lo decide la RLS)
  {
    percorso: '/controllo',
    accesso: 'utente',
    titolo: 'Report del controllo',
    mostra: mostraReport,
  },
  // Stato di salute di uno pneumatico: misure nel tempo, età e stima del consumo
  {
    percorso: '/pneumatico',
    accesso: 'utente',
    titolo: 'Stato di salute dello pneumatico',
    mostra: mostraPneumatico,
  },
  // Prenotazioni (Fase 4): officine e richiesta per il cliente, appuntamenti per tutti
  { percorso: '/officine', accesso: 'utente', titolo: 'Officine', mostra: mostraOfficine },
  { percorso: '/officina', accesso: 'utente', titolo: 'Officina', mostra: mostraOfficina },
  {
    percorso: '/prenota',
    accesso: 'utente',
    titolo: 'Chiedi un appuntamento',
    mostra: mostraPrenota,
  },
  {
    percorso: '/appuntamenti',
    accesso: 'utente',
    titolo: 'Appuntamenti',
    mostra: mostraAppuntamenti,
  },
  {
    percorso: '/appuntamenti/calendario',
    accesso: 'utente',
    titolo: 'Calendario',
    mostra: mostraCalendario,
  },
  {
    percorso: '/appuntamento',
    accesso: 'utente',
    titolo: 'Appuntamento',
    mostra: mostraAppuntamento,
  },
  {
    percorso: '/appuntamento/proponi',
    accesso: 'utente',
    titolo: 'Proponi un altro orario',
    mostra: mostraProponi,
  },
  {
    percorso: '/appuntamento/rifiuta',
    accesso: 'utente',
    titolo: 'Rifiuta o annulla',
    mostra: mostraRifiuta,
  },
  { percorso: '/servizi', accesso: 'utente', titolo: 'Servizi', mostra: mostraServizi },
  // Notifiche (Fase 5): le crea il database a ogni cambio di stato di una prenotazione
  { percorso: '/notifiche', accesso: 'utente', titolo: 'Notifiche', mostra: mostraNotifiche },
  {
    percorso: '/officina/orari',
    accesso: 'utente',
    titolo: 'Orari e chiusure',
    mostra: mostraOrari,
  },
  {
    percorso: '/officina/chiusura',
    accesso: 'utente',
    titolo: 'Nuova chiusura',
    mostra: mostraNuovaChiusura,
  },
  {
    percorso: '/servizi/nuovo',
    accesso: 'utente',
    titolo: 'Nuovo servizio',
    mostra: mostraNuovoServizio,
  },
  {
    percorso: '/servizi/modifica',
    accesso: 'utente',
    titolo: 'Modifica servizio',
    mostra: mostraModificaServizio,
  },
  // Officina. L'accesso ai dati lo decide la RLS: un cliente su queste pagine non trova nulla
  {
    percorso: '/veicoli/nuovo',
    accesso: 'utente',
    titolo: 'Nuovo veicolo',
    mostra: mostraNuovoVeicolo,
  },
  { percorso: '/clienti', accesso: 'utente', titolo: 'Clienti', mostra: mostraClienti },
  { percorso: '/cliente', accesso: 'utente', titolo: 'Cliente', mostra: mostraCliente },
  {
    percorso: '/cliente/invito',
    accesso: 'utente',
    titolo: "Invita nell'app",
    mostra: mostraInvitaCliente,
  },
  // Import di clienti e veicoli dal gestionale (CSV standard, solo TITOLARE)
  {
    percorso: '/clienti/importa',
    accesso: 'utente',
    titolo: 'Importa clienti e veicoli',
    mostra: mostraImporta,
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
    percorso: '/veicolo/pneumatici/smonta',
    accesso: 'utente',
    titolo: 'Smonta pneumatici',
    mostra: mostraSmontaPneumatici,
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
  // Invito dell'officina al cliente: si apre dal link dell'email, anche senza accesso
  { percorso: '/invito', accesso: 'pubblica', titolo: 'Invito', mostra: mostraInvito },
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
      fermaNotifiche();
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
