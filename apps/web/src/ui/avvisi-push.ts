import { Smartphone } from 'lucide';
import { esc } from '../lib/html';
import { attivaPush, disattivaPush, statoPush, type StatoPush } from '../lib/push';
import { icona } from './icone';

// Sezione "Avvisi sul telefono" (Fase 5): nella pagina Notifiche per accendere e spegnere le push, e
// come invito subito dopo l'invio di una richiesta di appuntamento (lì compare solo se sono spente).

interface Testo {
  titolo: string;
  testo: string;
  pulsante?: string;
  azione?: 'attiva' | 'disattiva';
}

// Testo e pulsante per ogni stato delle push (pagina Notifiche)
const PUSH: Record<StatoPush, Testo> = {
  spente: {
    titolo: 'Avvisi sul telefono',
    testo: "Ricevi un avviso anche quando l'app è chiusa: richieste, conferme, cambi di orario.",
    pulsante: 'Avvisami su questo dispositivo',
    azione: 'attiva',
  },
  attive: {
    titolo: 'Avvisi sul telefono',
    testo: 'Gli avvisi sono attivi su questo dispositivo.',
    pulsante: 'Disattiva gli avvisi',
    azione: 'disattiva',
  },
  bloccate: {
    titolo: 'Avvisi sul telefono',
    testo:
      "Gli avvisi sono bloccati per TyreCare: riattivali dalle impostazioni del browser (icona accanto all'indirizzo).",
  },
  installa: {
    titolo: 'Avvisi sul telefono',
    testo: `Su iPhone gli avvisi arrivano solo con l'app nella schermata Home: tocca Condividi, poi "Aggiungi alla schermata Home", e apri TyreCare da lì.`,
  },
  'non-supportate': {
    titolo: 'Avvisi sul telefono',
    testo: 'Questo browser non riceve avvisi: le notifiche restano qui.',
  },
};

// Invito dopo una richiesta: niente pulsante per spegnerle, e un "fatto" dopo l'attivazione
const INVITO: Partial<Record<StatoPush, Testo>> = {
  spente: {
    titolo: 'Vuoi sapere subito quando risponde?',
    testo:
      "Attiva gli avvisi: ti arriva un messaggio sul telefono quando l'officina conferma o propone un altro orario, anche con l'app chiusa.",
    pulsante: 'Avvisami su questo dispositivo',
    azione: 'attiva',
  },
  attive: {
    titolo: 'Avvisi attivi',
    testo: "Ti avvisiamo su questo dispositivo appena l'officina risponde.",
  },
};

function sezione(t: Testo, errore: string): string {
  return `
    <section class="tc-push" aria-labelledby="tc-push-titolo">
      <span class="tc-lista__icona">${icona(Smartphone)}</span>
      <div class="tc-push__testo">
        <h2 id="tc-push-titolo" class="tc-push__titolo">${esc(t.titolo)}</h2>
        <p class="mb-0">${esc(t.testo)}</p>
        ${errore ? `<p class="tc-push__errore mb-0" role="alert">${esc(errore)}</p>` : ''}
        ${
          t.azione
            ? `<button type="button" class="btn ${
                t.azione === 'attiva' ? 'btn-primary' : 'btn-outline-light'
              } mt-3" data-push="${t.azione}">${esc(t.pulsante!)}</button>`
            : ''
        }
      </div>
    </section>`;
}

/**
 * Disegna la sezione delle push nel contenitore e collega il pulsante (il permesso si chiede solo dopo
 * un tocco). Con `invito` compare solo se sulle push si può ancora dire di sì (stato `spente`).
 */
export async function collegaAvvisiPush(
  contenitore: HTMLElement,
  { invito = false } = {},
): Promise<void> {
  const testi = invito ? INVITO : PUSH;
  const disegna = (stato: StatoPush, errore = '') => {
    const t = testi[stato] ?? PUSH[stato];
    contenitore.innerHTML = sezione(t, errore);
    contenitore.querySelector<HTMLButtonElement>('[data-push]')?.addEventListener('click', (e) => {
      const pulsante = e.currentTarget as HTMLButtonElement;
      pulsante.disabled = true;
      const azione = pulsante.dataset.push === 'attiva' ? attivaPush : disattivaPush;
      azione()
        .then((nuovo) => disegna(nuovo))
        .catch(() =>
          disegna(
            stato,
            'Non è stato possibile cambiare gli avvisi. Controlla la connessione e riprova.',
          ),
        );
    });
  };
  let stato: StatoPush;
  try {
    stato = await statoPush();
  } catch {
    stato = 'non-supportate';
  }
  if (invito && stato !== 'spente') return;
  disegna(stato);
}
