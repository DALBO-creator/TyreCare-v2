import { ShieldCheck } from 'lucide';
import { registraApp2fa, stato2fa, verificaCodice2fa } from '../lib/admin-pannello';
import { esc } from '../lib/html';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, mostraPagina } from '../lib/router';
import { icona } from '../ui/icone';
import { paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE } from '../ui/modulo';
import { intestazioneSottopagina, mostraErroreInBox, nascondiBox } from './comune';

// Ingresso comune delle pagine /admin/*: ruolo ADMIN e verifica in due passaggi. Il database respinge
// comunque ogni richiesta admin senza aal2: questa schermata serve a ottenere la sessione giusta.

function paginaRiservata(titolo: string): string {
  return paginaApp(`
    ${intestazioneSottopagina(titolo, 'Amministratore')}
    <div class="tc-contenuto"><p>Pagina riservata all'amministratore.</p></div>`);
}

function moduloCodice(spiegazione: string, extra = ''): string {
  return `
    <div class="tc-contenuto">
      <div class="tc-avviso tc-avviso--info">
        ${icona(ShieldCheck)}<p class="mb-0">${spiegazione}</p>
      </div>
      ${extra}
      <form class="tc-modulo" data-modulo-2fa novalidate>
        ${RIQUADRO_ERRORE}
        <div class="mb-3">
          <label class="form-label" for="tc-codice-2fa">Codice di 6 cifre dell’app</label>
          <input class="form-control form-control-lg" id="tc-codice-2fa" name="codice"
            inputmode="numeric" autocomplete="one-time-code" maxlength="7" required
            aria-describedby="tc-codice-aiuto" />
          <div class="form-text" id="tc-codice-aiuto">Il codice cambia ogni 30 secondi.</div>
        </div>
        <button type="submit" class="btn btn-primary btn-lg w-100">Verifica</button>
      </form>
    </div>`;
}

/**
 * Vero se si può mostrare la pagina admin. Altrimenti disegna la pagina "riservata" o la verifica in
 * due passaggi (dopo il codice giusto ridisegna la stessa rotta) e torna falso.
 */
export async function accessoAdmin(app: HTMLElement, n: number, titolo: string): Promise<boolean> {
  const { profilo } = await caricaDatiUtente();
  if (profilo.ruolo !== 'ADMIN') {
    if (ancoraAttuale(n)) app.innerHTML = paginaRiservata(titolo);
    return false;
  }
  const stato = await stato2fa();
  if (stato.tipo === 'verificato') return true;

  let fattoreId: string;
  let corpo: string;
  if (stato.tipo === 'da-verificare') {
    fattoreId = stato.fattoreId;
    corpo = moduloCodice(
      'Per l’area amministratore serve la verifica in due passaggi: apri l’app di autenticazione e scrivi il codice di TyreCare.',
    );
  } else {
    const nuova = await registraApp2fa();
    fattoreId = nuova.fattoreId;
    corpo = moduloCodice(
      'Primo accesso all’area amministratore: proteggi l’account con un’app di autenticazione (Google Authenticator, Microsoft Authenticator, 1Password…). Inquadra il codice QR, poi scrivi il codice che compare.',
      `<figure class="text-center my-3">
        <img src="${esc(nuova.qr)}" width="200" height="200" alt="Codice QR per l’app di autenticazione"
          class="tc-qr" />
        <figcaption class="small text-body-secondary mt-2">
          Non riesci a inquadrarlo? Inserisci a mano questa chiave:<br />
          <code class="user-select-all text-break">${esc(nuova.segreto)}</code>
        </figcaption>
      </figure>`,
    );
  }
  if (!ancoraAttuale(n)) return false;
  app.innerHTML = paginaApp(
    `${intestazioneSottopagina('Verifica in due passaggi', 'Amministratore')}${corpo}`,
  );

  const modulo = app.querySelector<HTMLFormElement>('[data-modulo-2fa]')!;
  const campo = modulo.querySelector<HTMLInputElement>('input')!;
  const pulsante = modulo.querySelector<HTMLButtonElement>('button')!;
  const errore = modulo.querySelector<HTMLElement>('[data-errore-modulo]');
  campo.focus();
  modulo.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pulsante.disabled) return;
    pulsante.disabled = true;
    pulsante.textContent = 'Verifica…';
    nascondiBox(errore);
    try {
      await verificaCodice2fa(fattoreId, campo.value);
    } catch (err) {
      mostraErroreInBox(errore, err instanceof Error ? err.message : 'Codice non valido.');
      pulsante.disabled = false;
      pulsante.textContent = 'Verifica';
      campo.select();
      return;
    }
    if (ancoraAttuale(n)) await mostraPagina();
  });
  return false;
}
