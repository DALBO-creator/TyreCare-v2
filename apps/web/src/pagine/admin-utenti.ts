import { Ban, KeyRound, LockOpen, LogOut, MailCheck, Search, Users } from 'lucide';
import {
  bloccaUtente,
  cambiaRuolo,
  confermaEmail,
  correggiProfilo,
  cercaUtenti,
  disconnettiUtente,
  inviaReimpostaPassword,
  type UtenteAdmin,
} from '../lib/admin-pannello';
import { formattaDataOra } from '../lib/admin';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { chiediConferma } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { accessoAdmin } from './admin-comune';
import {
  ETICHETTE_RUOLO,
  gestisciErroreCaricamento,
  intestazioneSottopagina,
  parametro,
} from './comune';

// Account (/admin/utenti): ricerca e correzioni rapide. Ogni azione passa da una funzione `admin_*` del
// database, che controlla ruolo e 2FA e la annota nel registro.

/** Badge di una riga: cosa c'è di particolare nell'account. */
export function segnaliUtente(u: UtenteAdmin): { testo: string; classe: string }[] {
  const s: { testo: string; classe: string }[] = [
    { testo: ETICHETTE_RUOLO[u.ruolo], classe: 'nessuno' },
  ];
  if (u.bloccato) s.push({ testo: 'Bloccato', classe: 'rosso' });
  if (!u.email_confermata) s.push({ testo: 'Email da confermare', classe: 'giallo' });
  if (u.con_2fa) s.push({ testo: '2FA', classe: 'verde' });
  return s;
}

function riga(u: UtenteAdmin): string {
  const nome = `${u.nome} ${u.cognome}`.trim() || 'Senza nome';
  const admin = u.ruolo === 'ADMIN';
  return `
    <div class="tc-lista__riga flex-column align-items-stretch" data-utente="${u.id}">
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <strong class="text-break">${esc(nome)}</strong>
        <span class="d-flex gap-1 flex-wrap">
          ${segnaliUtente(u)
            .map((s) => `<span class="tc-stato tc-stato--${s.classe}">${esc(s.testo)}</span>`)
            .join('')}
        </span>
      </div>
      <small class="text-body-secondary text-break">
        ${esc(u.email)}${u.telefono ? ` · ${esc(u.telefono)}` : ''}<br />
        Iscritto il ${esc(formattaDataOra(u.created_at))} · ultimo accesso:
        ${u.ultimo_accesso ? esc(formattaDataOra(u.ultimo_accesso)) : 'mai'}
        ${u.officine ? `<br />Officine: ${esc(u.officine)}` : ''}<br />
        <span class="user-select-all">ID ${esc(u.id)}</span>
      </small>

      <details class="tc-storico">
        <summary>Correggi i dati</summary>
        <form class="mt-2" data-form-profilo novalidate>
          <div class="row g-2">
            <div class="col-sm-4">
              <label class="form-label small mb-1" for="tc-nome-${u.id}">Nome</label>
              <input class="form-control" id="tc-nome-${u.id}" name="nome" maxlength="100" value="${esc(u.nome)}" />
            </div>
            <div class="col-sm-4">
              <label class="form-label small mb-1" for="tc-cognome-${u.id}">Cognome</label>
              <input class="form-control" id="tc-cognome-${u.id}" name="cognome" maxlength="100" value="${esc(u.cognome)}" />
            </div>
            <div class="col-sm-4">
              <label class="form-label small mb-1" for="tc-tel-${u.id}">Telefono</label>
              <input class="form-control" id="tc-tel-${u.id}" name="telefono" inputmode="tel" maxlength="20" value="${esc(u.telefono ?? '')}" />
            </div>
          </div>
          ${
            admin
              ? ''
              : `<label class="form-label small mb-1 mt-2" for="tc-ruolo-${u.id}">Ruolo</label>
                <select class="form-select" id="tc-ruolo-${u.id}" name="ruolo">
                  ${(['CLIENTE', 'OFFICINA'] as const)
                    .map(
                      (r) =>
                        `<option value="${r}"${r === u.ruolo ? ' selected' : ''}>${ETICHETTE_RUOLO[r]}</option>`,
                    )
                    .join('')}
                </select>`
          }
          <button type="submit" class="btn btn-outline-light mt-2">Salva</button>
        </form>
      </details>

      <div class="tc-admin-azioni">
        ${
          u.email_confermata
            ? ''
            : `<button type="button" class="btn btn-outline-light" data-azione="conferma">${icona(MailCheck)} Conferma email</button>`
        }
        <button type="button" class="btn btn-outline-light" data-azione="password">${icona(KeyRound)} Email per nuova password</button>
        <button type="button" class="btn btn-outline-light" data-azione="disconnetti">${icona(LogOut)} Chiudi le sessioni</button>
        ${
          admin
            ? ''
            : u.bloccato
              ? `<button type="button" class="btn btn-outline-light" data-azione="sblocca">${icona(LockOpen)} Sblocca</button>`
              : `<button type="button" class="btn tc-pulsante-elimina mt-0" data-azione="blocca">${icona(Ban)} Blocca</button>`
        }
      </div>
      <div class="tc-avviso tc-avviso--rosso" data-errore-utente role="alert" hidden></div>
      <div class="tc-avviso tc-avviso--verde" data-ok-utente role="status" hidden></div>
    </div>`;
}

export async function mostraAdminUtenti(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const soloNonConfermati = parametro('filtro') === 'non-confermati';
  let testo = parametro('q') ?? '';

  let utenti: UtenteAdmin[];
  try {
    if (!(await accessoAdmin(app, n, 'Account'))) return;
    utenti = await cercaUtenti(testo);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Account', 'Amministratore')}
    <div class="tc-contenuto">
      <form class="tc-ricerca" role="search" data-cerca>
        <label class="form-label" for="tc-cerca">Cerca per email, nome, cognome, telefono o ID</label>
        <div class="tc-ricerca__campo">
          ${icona(Search)}
          <input class="form-control form-control-lg" id="tc-cerca" type="search" maxlength="100"
            autocomplete="off" spellcheck="false" enterkeyhint="search" value="${esc(testo)}" />
        </div>
      </form>
      ${
        soloNonConfermati
          ? '<p class="small text-body-secondary">Solo gli account con l’email da confermare. <a href="/admin/utenti">Mostra tutti</a></p>'
          : ''
      }
      <p class="visually-hidden" aria-live="polite" data-conteggio></p>
      <div data-elenco></div>
    </div>`);

  const elenco = app.querySelector<HTMLElement>('[data-elenco]')!;
  const conteggio = app.querySelector<HTMLElement>('[data-conteggio]')!;
  const disegna = () => {
    const visibili = soloNonConfermati ? utenti.filter((u) => !u.email_confermata) : utenti;
    conteggio.textContent = `${visibili.length} account trovati`;
    elenco.innerHTML = visibili.length
      ? `<div class="tc-lista">${visibili.map(riga).join('')}</div>
         ${visibili.length >= 50 ? '<p class="small text-body-secondary mt-2">Mostrati i primi 50: affina la ricerca.</p>' : ''}`
      : `<div class="tc-vuoto">
          <span class="tc-vuoto__icona">${icona(Users)}</span>
          <p class="tc-vuoto__titolo">Nessun account trovato</p>
        </div>`;
  };
  disegna();

  const ricarica = async () => {
    utenti = await cercaUtenti(testo);
    if (ancoraAttuale(n)) disegna();
  };

  app.querySelector<HTMLFormElement>('[data-cerca]')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    testo = app.querySelector<HTMLInputElement>('#tc-cerca')!.value;
    history.replaceState(
      null,
      '',
      testo ? `/admin/utenti?q=${encodeURIComponent(testo)}` : '/admin/utenti',
    );
    elenco.innerHTML = caricamento('Ricerca…');
    try {
      await ricarica();
    } catch (errore) {
      await gestisciErroreCaricamento(app, n, errore);
    }
  });

  const esito = (riga: HTMLElement, errore: unknown, ok?: string) => {
    const boxErr = riga.querySelector<HTMLElement>('[data-errore-utente]')!;
    const boxOk = riga.querySelector<HTMLElement>('[data-ok-utente]')!;
    boxErr.hidden = errore === undefined;
    boxOk.hidden = ok === undefined;
    if (errore !== undefined) {
      boxErr.textContent =
        errore instanceof Error ? errore.message : 'Operazione non riuscita. Riprova.';
    }
    if (ok !== undefined) boxOk.textContent = ok;
  };

  // Correzione dei dati e del ruolo
  elenco.addEventListener('submit', async (e) => {
    const modulo = (e.target as HTMLElement).closest<HTMLFormElement>('[data-form-profilo]');
    if (!modulo) return;
    e.preventDefault();
    const rigaEl = modulo.closest<HTMLElement>('[data-utente]')!;
    const u = utenti.find((x) => x.id === rigaEl.dataset.utente);
    const pulsante = modulo.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    if (!u || pulsante.disabled) return;
    const f = new FormData(modulo);
    const val = (k: string) => String(f.get(k) ?? '');
    pulsante.disabled = true;
    try {
      await correggiProfilo(u.id, {
        nome: val('nome'),
        cognome: val('cognome'),
        telefono: val('telefono'),
      });
      const ruolo = val('ruolo');
      if ((ruolo === 'CLIENTE' || ruolo === 'OFFICINA') && ruolo !== u.ruolo)
        await cambiaRuolo(u.id, ruolo);
      await ricarica();
      const nuova = elenco.querySelector<HTMLElement>(`[data-utente="${u.id}"]`);
      if (nuova) esito(nuova, undefined, 'Dati salvati.');
    } catch (errore) {
      esito(rigaEl, errore);
      pulsante.disabled = false;
    }
  });

  // Azioni rapide
  elenco.addEventListener('click', (e) => {
    const pulsante = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-azione]');
    if (!pulsante) return;
    const rigaEl = pulsante.closest<HTMLElement>('[data-utente]')!;
    const u = utenti.find((x) => x.id === rigaEl.dataset.utente);
    if (!u) return;
    const chi = `${u.nome} ${u.cognome}`.trim() || u.email;

    const esegui = async (azione: () => Promise<void>, ok: string) => {
      await azione();
      await ricarica();
      const nuova = elenco.querySelector<HTMLElement>(`[data-utente="${u.id}"]`);
      if (nuova) esito(nuova, undefined, ok);
    };

    switch (pulsante.dataset.azione) {
      case 'password':
        pulsante.disabled = true;
        inviaReimpostaPassword(u.email)
          .then(() => esito(rigaEl, undefined, `Email per la nuova password inviata a ${u.email}.`))
          .catch((err: unknown) => esito(rigaEl, err))
          .finally(() => (pulsante.disabled = false));
        return;
      case 'conferma':
        pulsante.disabled = true;
        esegui(() => confermaEmail(u.id), 'Email confermata: ora può accedere.').catch(
          (err: unknown) => {
            esito(rigaEl, err);
            pulsante.disabled = false;
          },
        );
        return;
      case 'disconnetti':
        chiediConferma({
          titolo: 'Chiudere le sessioni?',
          testo: `«${chi}» dovrà accedere di nuovo su tutti i dispositivi (al più tardi entro un’ora).`,
          pulsante: 'Chiudi le sessioni',
          iconaPulsante: LogOut,
          inCorso: 'Chiusura…',
          origine: pulsante,
          azione: () => esegui(() => disconnettiUtente(u.id), 'Sessioni chiuse.'),
        });
        return;
      case 'blocca':
        chiediConferma({
          titolo: 'Bloccare l’account?',
          testo: `«${chi}» non potrà più accedere finché non lo sblocchi; le sue sessioni si chiudono. I dati restano.`,
          pulsante: 'Blocca',
          iconaPulsante: Ban,
          inCorso: 'Blocco…',
          origine: pulsante,
          azione: () => esegui(() => bloccaUtente(u.id, true), 'Account bloccato.'),
        });
        return;
      case 'sblocca':
        pulsante.disabled = true;
        esegui(() => bloccaUtente(u.id, false), 'Account sbloccato.').catch((err: unknown) => {
          esito(rigaEl, err);
          pulsante.disabled = false;
        });
        return;
    }
  });
}
