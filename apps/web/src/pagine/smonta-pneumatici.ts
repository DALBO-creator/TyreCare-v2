import { SmontaPneumaticiSchema, formattaTarga, oggiISO, type Posizione } from '@tyrecare/shared';
import { Info } from 'lucide';
import { smontaPneumatici } from '../lib/officina';
import { visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, caselle, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { ORDINE_POSIZIONI, POSIZIONI, intestazioneSottopagina, vaiConConferma } from './comune';
import { caricaSchedaDaUrl } from './veicolo';

/**
 * Smontaggio di pneumatici senza sostituirli (es. ruota di scorta tolta, gomme portate via dal
 * cliente): `/veicolo/pneumatici/smonta?id=…`. Restano nello storico con i loro controlli.
 */
export async function mostraSmontaPneumatici(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  const scheda = await caricaSchedaDaUrl(app, n);
  if (!scheda) return;

  const { veicolo, pneumatici } = scheda;
  const indietro = `/veicolo?id=${veicolo.id}`;
  const montati = new Map(
    ORDINE_POSIZIONI.flatMap((p) => {
      const pn = pneumatici.find((x) => x.posizione === p);
      return pn ? [[p, pn.id] as const] : [];
    }),
  );
  const posizioni = [...montati.keys()];
  const oggi = oggiISO();

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Smonta pneumatici', formattaTarga(veicolo.targa))}
    <div class="tc-contenuto">
      ${
        posizioni.length > 0
          ? `<form class="tc-auth__modulo" novalidate>
              ${RIQUADRO_ERRORE}
              ${caselle({
                nome: 'posizioni',
                etichetta: 'Posizioni da smontare',
                opzioni: posizioni.map((p) => [p, POSIZIONI[p].nome] as const),
                // Con un solo pneumatico montato (o solo la scorta da togliere) è già scelto
                selezionate: posizioni.length === 1 ? posizioni : [],
              })}
              <div class="tc-avviso tc-avviso--info">
                ${icona(Info)}
                <p class="mb-0">
                  Gli pneumatici smontati restano nello storico con i loro controlli. Per montarne
                  altri al loro posto usa invece "Cambia pneumatici".
                </p>
              </div>
              ${campo({
                nome: 'smontato_il',
                etichetta: 'Data di smontaggio',
                tipo: 'date',
                autocomplete: 'off',
                valore: oggi,
                attributi: `max="${oggi}"`,
              })}
              ${pulsanteInvio('Smonta pneumatici', 'Salvataggio…')}
              <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Annulla</a>
            </form>`
          : `<p class="text-body-secondary">Nessuno pneumatico montato su questo veicolo.</p>
            <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Torna al veicolo</a>`
      }
    </div>`);

  const modulo = app.querySelector('form');
  if (!modulo) return;
  collegaModulo(modulo, SmontaPneumaticiSchema, async ({ posizioni: scelte, smontato_il }) => {
    const ids = scelte.flatMap((p: Posizione) => montati.get(p) ?? []);
    await smontaPneumatici(ids, smontato_il);
    vaiConConferma(indietro, ids.length === 1 ? 'Pneumatico smontato.' : 'Pneumatici smontati.');
  });
}
