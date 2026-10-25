import '@fontsource-variable/inter';
import './styles/main.scss';
import { registerSW } from 'virtual:pwa-register';
import { inizializzaAuth, sessioneCorrente } from './lib/auth';
import { fermaNotifiche } from './lib/notifiche';
import { pigra } from './lib/pigra';
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
import { mostraHome } from './pagine/home';
import { mostraNonTrovata } from './pagine/non-trovata';
import { mostraRegistrati } from './pagine/registrati';

const ROTTE: Rotta[] = [
  { percorso: '/', accesso: 'utente', titolo: '', mostra: mostraHome },
  {
    percorso: '/profilo',
    accesso: 'utente',
    titolo: 'Profilo',
    mostra: pigra(() => import('./pagine/profilo'), 'mostraProfilo'),
  },
  {
    percorso: '/profilo/dati',
    accesso: 'utente',
    titolo: 'I tuoi dati',
    mostra: pigra(() => import('./pagine/modifica-profilo'), 'mostraModificaProfilo'),
  },
  {
    percorso: '/commento',
    accesso: 'utente',
    titolo: 'Invia un commento',
    mostra: pigra(() => import('./pagine/commento'), 'mostraCommento'),
  },
  {
    percorso: '/profilo/password',
    accesso: 'utente',
    titolo: 'Cambia password',
    mostra: pigra(() => import('./pagine/cambia-password'), 'mostraCambiaPassword'),
  },
  {
    percorso: '/profilo/elimina',
    accesso: 'utente',
    titolo: 'Elimina il tuo account',
    mostra: pigra(() => import('./pagine/elimina-account'), 'mostraEliminaAccount'),
  },
  // Garage del cliente: i suoi veicoli uniti per targa tra le officine
  {
    percorso: '/garage/veicolo',
    accesso: 'utente',
    titolo: 'Il tuo veicolo',
    mostra: pigra(() => import('./pagine/garage-veicolo'), 'mostraGarageVeicolo'),
  },
  // Report di un controllo: per il cliente e per l'officina che l'ha eseguito (lo decide la RLS)
  {
    percorso: '/controllo',
    accesso: 'utente',
    titolo: 'Report del controllo',
    mostra: pigra(() => import('./pagine/report'), 'mostraReport'),
  },
  // Stato di salute di uno pneumatico: misure nel tempo, età e stima del consumo
  {
    percorso: '/pneumatico',
    accesso: 'utente',
    titolo: 'Stato di salute dello pneumatico',
    mostra: pigra(() => import('./pagine/pneumatico'), 'mostraPneumatico'),
  },
  // Prenotazioni (Fase 4): officine e richiesta per il cliente, appuntamenti per tutti
  {
    percorso: '/officine',
    accesso: 'utente',
    titolo: 'Officine',
    mostra: pigra(() => import('./pagine/officine'), 'mostraOfficine'),
  },
  {
    percorso: '/officina',
    accesso: 'utente',
    titolo: 'Officina',
    mostra: pigra(() => import('./pagine/officine'), 'mostraOfficina'),
  },
  {
    percorso: '/prenota',
    accesso: 'utente',
    titolo: 'Chiedi un appuntamento',
    mostra: pigra(() => import('./pagine/officine'), 'mostraPrenota'),
  },
  {
    percorso: '/appuntamenti',
    accesso: 'utente',
    titolo: 'Appuntamenti',
    mostra: pigra(() => import('./pagine/appuntamenti'), 'mostraAppuntamenti'),
  },
  {
    percorso: '/appuntamenti/calendario',
    accesso: 'utente',
    titolo: 'Calendario',
    mostra: pigra(() => import('./pagine/calendario'), 'mostraCalendario'),
  },
  {
    percorso: '/appuntamento',
    accesso: 'utente',
    titolo: 'Appuntamento',
    mostra: pigra(() => import('./pagine/appuntamenti'), 'mostraAppuntamento'),
  },
  {
    percorso: '/appuntamento/proponi',
    accesso: 'utente',
    titolo: 'Proponi un altro orario',
    mostra: pigra(() => import('./pagine/appuntamenti'), 'mostraProponi'),
  },
  {
    percorso: '/appuntamento/rifiuta',
    accesso: 'utente',
    titolo: 'Rifiuta o annulla',
    mostra: pigra(() => import('./pagine/appuntamenti'), 'mostraRifiuta'),
  },
  {
    percorso: '/servizi',
    accesso: 'utente',
    titolo: 'Servizi',
    mostra: pigra(() => import('./pagine/servizi'), 'mostraServizi'),
  },
  // Notifiche (Fase 5): le crea il database a ogni cambio di stato di una prenotazione
  {
    percorso: '/notifiche',
    accesso: 'utente',
    titolo: 'Notifiche',
    mostra: pigra(() => import('./pagine/notifiche'), 'mostraNotifiche'),
  },
  {
    percorso: '/officina/orari',
    accesso: 'utente',
    titolo: 'Orari e chiusure',
    mostra: pigra(() => import('./pagine/orari'), 'mostraOrari'),
  },
  {
    percorso: '/officina/dati',
    accesso: 'utente',
    titolo: "Dati dell'officina",
    mostra: pigra(() => import('./pagine/dati-officina'), 'mostraDatiOfficina'),
  },
  {
    percorso: '/officina/chiusura',
    accesso: 'utente',
    titolo: 'Nuova chiusura',
    mostra: pigra(() => import('./pagine/orari'), 'mostraNuovaChiusura'),
  },
  {
    percorso: '/servizi/nuovo',
    accesso: 'utente',
    titolo: 'Nuovo servizio',
    mostra: pigra(() => import('./pagine/servizi'), 'mostraNuovoServizio'),
  },
  {
    percorso: '/servizi/modifica',
    accesso: 'utente',
    titolo: 'Modifica servizio',
    mostra: pigra(() => import('./pagine/servizi'), 'mostraModificaServizio'),
  },
  // Officina. L'accesso ai dati lo decide la RLS: un cliente su queste pagine non trova nulla
  {
    percorso: '/veicoli/nuovo',
    accesso: 'utente',
    titolo: 'Nuovo veicolo',
    mostra: pigra(() => import('./pagine/nuovo-veicolo'), 'mostraNuovoVeicolo'),
  },
  {
    percorso: '/clienti',
    accesso: 'utente',
    titolo: 'Clienti',
    mostra: pigra(() => import('./pagine/clienti'), 'mostraClienti'),
  },
  {
    percorso: '/cliente',
    accesso: 'utente',
    titolo: 'Cliente',
    mostra: pigra(() => import('./pagine/cliente'), 'mostraCliente'),
  },
  {
    percorso: '/cliente/invito',
    accesso: 'utente',
    titolo: "Invita nell'app",
    mostra: pigra(() => import('./pagine/invita-cliente'), 'mostraInvitaCliente'),
  },
  {
    percorso: '/cliente/unisci',
    accesso: 'utente',
    titolo: 'Unisci clienti',
    mostra: pigra(() => import('./pagine/unisci-cliente'), 'mostraUnisciCliente'),
  },
  // Import di clienti e veicoli dal gestionale (CSV standard, solo TITOLARE)
  {
    percorso: '/clienti/importa',
    accesso: 'utente',
    titolo: 'Importa clienti e veicoli',
    mostra: pigra(() => import('./pagine/importa'), 'mostraImporta'),
  },
  {
    percorso: '/clienti/importa-controlli',
    accesso: 'utente',
    titolo: 'Importa i controlli',
    mostra: pigra(() => import('./pagine/importa-controlli'), 'mostraImportaControlli'),
  },
  {
    percorso: '/clienti/nuovo',
    accesso: 'utente',
    titolo: 'Nuovo cliente',
    mostra: pigra(() => import('./pagine/nuovo-cliente'), 'mostraNuovoCliente'),
  },
  {
    percorso: '/clienti/modifica',
    accesso: 'utente',
    titolo: 'Modifica cliente',
    mostra: pigra(() => import('./pagine/modifica-cliente'), 'mostraModificaCliente'),
  },
  {
    percorso: '/veicolo',
    accesso: 'utente',
    titolo: 'Veicolo',
    mostra: pigra(() => import('./pagine/veicolo'), 'mostraVeicolo'),
  },
  {
    percorso: '/veicolo/modifica',
    accesso: 'utente',
    titolo: 'Modifica veicolo',
    mostra: pigra(() => import('./pagine/modifica-veicolo'), 'mostraModificaVeicolo'),
  },
  {
    percorso: '/veicolo/pneumatici',
    accesso: 'utente',
    titolo: 'Monta pneumatici',
    mostra: pigra(() => import('./pagine/monta-pneumatici'), 'mostraMontaPneumatici'),
  },
  {
    percorso: '/veicolo/pneumatici/modifica',
    accesso: 'utente',
    titolo: 'Correggi pneumatici',
    mostra: pigra(() => import('./pagine/modifica-pneumatici'), 'mostraModificaPneumatici'),
  },
  {
    percorso: '/veicolo/pneumatici/smonta',
    accesso: 'utente',
    titolo: 'Smonta pneumatici',
    mostra: pigra(() => import('./pagine/smonta-pneumatici'), 'mostraSmontaPneumatici'),
  },
  {
    percorso: '/veicolo/controllo',
    accesso: 'utente',
    titolo: 'Nuovo controllo',
    mostra: pigra(() => import('./pagine/nuovo-controllo'), 'mostraNuovoControllo'),
  },
  {
    percorso: '/controllo/modifica',
    accesso: 'utente',
    titolo: 'Correggi controllo',
    mostra: pigra(() => import('./pagine/modifica-controllo'), 'mostraModificaControllo'),
  },
  { percorso: '/accedi', accesso: 'ospite', titolo: 'Accedi', mostra: mostraAccedi },
  { percorso: '/registrati', accesso: 'ospite', titolo: 'Registrati', mostra: mostraRegistrati },
  {
    percorso: '/password-dimenticata',
    accesso: 'ospite',
    titolo: 'Password dimenticata',
    mostra: pigra(() => import('./pagine/password-dimenticata'), 'mostraPasswordDimenticata'),
  },
  {
    percorso: '/nuova-password',
    accesso: 'pubblica',
    titolo: 'Nuova password',
    mostra: pigra(() => import('./pagine/nuova-password'), 'mostraNuovaPassword'),
  },
  // Invito dell'officina al cliente: si apre dal link dell'email, anche senza accesso
  {
    percorso: '/invito',
    accesso: 'pubblica',
    titolo: 'Invito',
    mostra: pigra(() => import('./pagine/invito'), 'mostraInvito'),
  },
  // Pagina di riferimento del design system, con dati finti
  {
    percorso: '/anteprima',
    accesso: 'pubblica',
    titolo: 'Anteprima',
    mostra: pigra(() => import('./anteprima'), 'mostraAnteprima'),
  },
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
