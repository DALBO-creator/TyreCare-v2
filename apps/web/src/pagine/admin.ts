import { formattaEuro } from '@tyrecare/shared';
import {
  Building2,
  ChevronRight,
  ExternalLink,
  ScrollText,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide';
import { caricaRiepilogo, type Riepilogo } from '../lib/admin-pannello';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { accessoAdmin } from './admin-comune';
import { gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

// Pannello dell'amministratore (/admin): numeri della piattaforma, cose da guardare e strumenti.

function numero(valore: number, etichetta: string, testo?: string): string {
  return `
    <div class="tc-riepilogo__voce">
      <span class="tc-riepilogo__numero">${esc(testo ?? valore.toLocaleString('it-IT'))}</span>
      <span class="tc-riepilogo__etichetta">${esc(etichetta)}</span>
    </div>`;
}

function link(
  ic: Parameters<typeof icona>[0],
  etichetta: string,
  href: string,
  dettaglio = '',
): string {
  return `
    <a class="tc-lista__riga" href="${href}">
      <span class="tc-lista__icona">${icona(ic)}</span>
      <span class="tc-lista__testo">${esc(etichetta)}${
        dettaglio ? `<small class="d-block text-body-secondary">${esc(dettaglio)}</small>` : ''
      }</span>
      ${icona(ChevronRight)}
    </a>`;
}

/** Le cose che chiedono un intervento, come avvisi con il collegamento alla pagina giusta. */
export function avvisiAdmin(r: Riepilogo): { testo: string; href: string }[] {
  const avvisi: { testo: string; href: string }[] = [];
  const plurale = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`;
  if (r.officine_in_attesa) {
    avvisi.push({
      testo:
        plurale(r.officine_in_attesa, 'officina aspetta', 'officine aspettano') + ' l’attivazione',
      href: '/admin/officine',
    });
  }
  if (r.prove_in_scadenza) {
    avvisi.push({
      testo: plurale(r.prove_in_scadenza, 'prova scade', 'prove scadono') + ' entro 7 giorni',
      href: '/admin/officine',
    });
  }
  if (r.utenti_non_confermati) {
    avvisi.push({
      testo:
        plurale(r.utenti_non_confermati, 'account non ha', 'account non hanno') +
        ' confermato l’email',
      href: '/admin/utenti?filtro=non-confermati',
    });
  }
  if (r.commenti_7_giorni) {
    avvisi.push({
      testo:
        plurale(r.commenti_7_giorni, 'commento nuovo', 'commenti nuovi') + ' negli ultimi 7 giorni',
      href: '/admin/commenti',
    });
  }
  return avvisi;
}

export async function mostraAdmin(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let r: Riepilogo;
  try {
    if (!(await accessoAdmin(app, n, 'Pannello amministratore'))) return;
    r = await caricaRiepilogo();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  const avvisi = avvisiAdmin(r);
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Pannello', 'Amministratore')}
    <div class="tc-contenuto">
      ${
        avvisi.length
          ? `<section aria-labelledby="tc-admin-avvisi">
              <h2 id="tc-admin-avvisi" class="tc-etichetta">Da guardare</h2>
              ${avvisi
                .map(
                  (a) => `<a class="tc-avviso tc-avviso--giallo tc-avviso--link" href="${a.href}">
                    ${icona(TriangleAlert)}<p class="mb-0">${esc(a.testo)}</p>${icona(ChevronRight)}
                  </a>`,
                )
                .join('')}
            </section>`
          : `<div class="tc-avviso tc-avviso--verde" role="status">
              ${icona(ShieldCheck)}<p class="mb-0">Niente da sistemare per ora.</p>
            </div>`
      }

      <section aria-labelledby="tc-admin-account">
        <h2 id="tc-admin-account" class="tc-etichetta">Account</h2>
        <div class="tc-riepilogo tc-riepilogo--admin">
          ${numero(r.utenti, 'Account')}
          ${numero(r.utenti_7_giorni, 'Nuovi in 7 giorni')}
          ${numero(r.accessi_24_ore, 'Accessi in 24 ore')}
          ${numero(r.utenti_bloccati, 'Bloccati')}
        </div>
      </section>

      <section aria-labelledby="tc-admin-officine">
        <h2 id="tc-admin-officine" class="tc-etichetta">Officine</h2>
        <div class="tc-riepilogo tc-riepilogo--admin">
          ${numero(r.officine_attive, 'Attive')}
          ${numero(r.officine_in_attesa, 'In attesa')}
          ${numero(r.officine_sospese, 'Sospese')}
        </div>
      </section>

      <section aria-labelledby="tc-admin-abbonamenti">
        <h2 id="tc-admin-abbonamenti" class="tc-etichetta">Abbonamenti</h2>
        <div class="tc-riepilogo tc-riepilogo--admin">
          ${numero(r.abbonamenti_attivi, 'Attivi')}
          ${numero(r.prove_in_corso, 'In prova')}
          ${numero(r.abbonamenti_scaduti, 'Abbonamenti scaduti')}
          ${numero(r.ricavo_mensile, 'Ricavo al mese', formattaEuro(r.ricavo_mensile))}
        </div>
        <p class="small text-body-secondary mt-2">IVA esclusa, solo abbonamenti attivi</p>
      </section>

      <section aria-labelledby="tc-admin-uso">
        <h2 id="tc-admin-uso" class="tc-etichetta">Uso</h2>
        <div class="tc-riepilogo tc-riepilogo--admin">
          ${numero(r.clienti, 'Clienti delle officine')}
          ${numero(r.veicoli, 'Veicoli')}
          ${numero(r.controlli, 'Controlli')}
          ${numero(r.controlli_7_giorni, 'Controlli in 7 giorni')}
          ${numero(r.prenotazioni_in_corso, 'Appuntamenti in corso')}
          ${numero(r.prenotazioni_7_giorni, 'Richieste in 7 giorni')}
          ${numero(r.iscrizioni_push, 'Dispositivi con notifiche')}
          ${numero(r.commenti_7_giorni, 'Commenti in 7 giorni')}
        </div>
      </section>

      <section aria-labelledby="tc-admin-strumenti">
        <h2 id="tc-admin-strumenti" class="tc-etichetta">Strumenti</h2>
        <nav class="tc-lista" aria-labelledby="tc-admin-strumenti">
          ${link(Users, 'Account', '/admin/utenti', 'Cerca, correggi, conferma email, blocca')}
          ${link(Building2, 'Officine', '/admin/officine', 'Attiva, sospendi, rifiuta, piano')}
          ${link(MessageSquare, 'Commenti degli utenti', '/admin/commenti')}
          ${link(ScrollText, 'Registro delle azioni', '/admin/registro', 'Tutto quello che fa l’amministratore')}
        </nav>
      </section>

      <p class="small text-body-secondary mt-4">
        ${icona(ExternalLink)} Log tecnici, copie di sicurezza e chiavi restano nella dashboard di Supabase.
      </p>
    </div>`);
}
