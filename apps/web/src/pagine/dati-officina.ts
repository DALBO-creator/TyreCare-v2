import { LocateFixed } from 'lucide';
import { DatiOfficinaSchema } from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaDatiOfficina,
  salvaDatiOfficina,
  testoPosizione,
  type DatiOfficinaSalvati,
} from '../lib/dati-officina';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { gestisciErroreCaricamento, intestazioneSottopagina, vaiConConferma } from './comune';

// "Dati dell'officina" (Fase 4), solo per il TITOLARE: indirizzo, contatti e posizione sulla mappa, che i
// clienti useranno per trovare l'officina più vicina. Ragione sociale e partita IVA sono in sola lettura.

const AIUTO_POSIZIONE =
  "Su Google Maps tieni premuto sull'officina e copia le coordinate. Lasciala vuota se non vuoi indicarla: l'officina non comparirà ordinata per distanza.";

export async function mostraDatiOfficina(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  let officinaId: string;
  let nomeOfficina: string;
  let titolare: boolean;
  let dati: DatiOfficinaSalvati | null = null;
  try {
    const contesto = await caricaContestoOfficina();
    officinaId = contesto.attiva.officina.id;
    nomeOfficina = contesto.attiva.officina.ragione_sociale;
    titolare = eTitolare(contesto.officine, officinaId);
    if (titolare) dati = await caricaDatiOfficina(officinaId);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  if (!titolare || !dati) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina("Dati dell'officina", nomeOfficina)}
      <div class="tc-contenuto">
        <div class="tc-avviso tc-avviso--giallo" role="status">
          <p class="mb-0">Solo il titolare dell'officina può modificare i dati dell'officina.</p>
        </div>
      </div>`);
    return;
  }

  const d = dati;
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina("Dati dell'officina", 'Officina')}
    <div class="tc-contenuto">
      <section aria-labelledby="tc-anagrafica">
        <h2 id="tc-anagrafica" class="tc-etichetta">Anagrafica</h2>
        <p class="mb-1"><strong>${esc(d.ragione_sociale)}</strong></p>
        <p class="mb-1 text-body-secondary">Partita IVA ${esc(d.partita_iva)}</p>
        <p class="text-body-secondary">Ragione sociale e partita IVA le cambia l'amministratore.</p>
      </section>
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campo({
          nome: 'indirizzo',
          etichetta: 'Indirizzo',
          tipo: 'text',
          autocomplete: 'off',
          valore: d.indirizzo,
          attributi: 'maxlength="200"',
        })}
        <div class="tc-auth__coppia">
          ${campo({
            nome: 'cap',
            etichetta: 'CAP',
            tipo: 'text',
            autocomplete: 'off',
            valore: d.cap ?? '',
            attributi: 'inputmode="numeric" maxlength="5"',
          })}
          ${campo({
            nome: 'provincia',
            etichetta: 'Provincia',
            tipo: 'text',
            autocomplete: 'off',
            valore: d.provincia ?? '',
            aiuto: 'Sigla, es. TO',
            attributi: 'maxlength="2" autocapitalize="characters"',
          })}
        </div>
        ${campo({
          nome: 'citta',
          etichetta: 'Città',
          tipo: 'text',
          autocomplete: 'off',
          valore: d.citta,
          attributi: 'maxlength="100"',
        })}
        ${campo({
          nome: 'telefono',
          etichetta: 'Telefono',
          tipo: 'tel',
          autocomplete: 'off',
          valore: d.telefono ?? '',
          aiuto: 'Facoltativo, es. +39 011 1234567',
        })}
        ${campo({
          nome: 'email',
          etichetta: 'Email',
          tipo: 'email',
          autocomplete: 'off',
          valore: d.email ?? '',
          aiuto: 'Facoltativa: la vedono i clienti.',
        })}
        ${campo({
          nome: 'posizione',
          etichetta: 'Posizione sulla mappa',
          tipo: 'text',
          autocomplete: 'off',
          valore: testoPosizione(d),
          aiuto: AIUTO_POSIZIONE,
          attributi: 'autocapitalize="off" spellcheck="false"',
        })}
        <button type="button" class="btn btn-outline-light" data-posizione-attuale>
          ${icona(LocateFixed)} Usa la posizione attuale
        </button>
        ${pulsanteInvio('Salva dati', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/profilo">Annulla</a>
      </form>
      <section aria-labelledby="tc-sez-abbonamento">
        <h2 id="tc-sez-abbonamento" class="tc-etichetta">Abbonamento</h2>
        <a class="btn btn-outline-light btn-lg w-100" href="/officina/abbonamento">Abbonamento</a>
      </section>
    </div>`);

  const form = app.querySelector('form')!;
  collegaModulo(form, DatiOfficinaSchema, async (nuovi) => {
    await salvaDatiOfficina(officinaId, nuovi);
    vaiConConferma('/profilo', "Dati dell'officina salvati.");
  });

  // Utile se il titolare è in officina: il telefono dà le coordinate del punto in cui si trova
  const posizione = form.querySelector<HTMLInputElement>('[name="posizione"]')!;
  const errore = form.querySelector<HTMLElement>('#campo-posizione-errore')!;
  const mostra = (messaggio: string) => {
    errore.textContent = messaggio;
    errore.hidden = !messaggio;
  };
  app
    .querySelector<HTMLButtonElement>('[data-posizione-attuale]')!
    .addEventListener('click', () => {
      mostra('');
      if (!('geolocation' in navigator)) {
        mostra('Questo dispositivo non permette di leggere la posizione: incollala dalle mappe.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          posizione.value = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
          posizione.classList.remove('is-invalid');
          posizione.setAttribute('aria-invalid', 'false');
          mostra('');
        },
        () =>
          mostra(
            'Non riesco a leggere la posizione. Consenti l’accesso alla posizione al browser, oppure incollala dalle mappe.',
          ),
        { enableHighAccuracy: true, timeout: 15000 },
      );
    });
}
