// Verifica della firma del webhook di Stripe (T185). La usa `index.ts`.
// Senza import e senza Deno (solo Web Crypto e TextEncoder globali), così la provano anche i test di
// vitest (project `funzioni`).
//
// Stripe manda l'intestazione `Stripe-Signature: t=<secondi>,v1=<hex>[,v1=<hex>][,v0=<hex>]`: la firma
// è l'HMAC-SHA256 di `${t}.${corpo}` con il segreto `whsec_…` come chiave (il segreto intero, come
// testo). Il corpo è quello grezzo della richiesta, mai il JSON riserializzato.

const codifica = new TextEncoder();

/** Confronto a tempo costante di due stringhe: lunghezze diverse → false. */
const ugualiTempoCostante = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let differenza = 0;
  for (let i = 0; i < a.length; i++) differenza |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return differenza === 0;
};

const esadecimale = (byte: ArrayBuffer): string =>
  Array.from(new Uint8Array(byte), (b) => b.toString(16).padStart(2, '0')).join('');

/** Legge `t` e tutti i `v1` dell'intestazione; il resto (`v0`, chiavi sconosciute) si ignora. */
const leggiIntestazione = (intestazione: string): { t: number; firme: string[] } | null => {
  let t: number | null = null;
  const firme: string[] = [];
  for (const parte of intestazione.split(',')) {
    const uguale = parte.indexOf('=');
    if (uguale < 0) continue;
    const chiave = parte.slice(0, uguale).trim();
    const valore = parte.slice(uguale + 1).trim();
    if (chiave === 't') {
      if (!/^\d+$/.test(valore)) return null;
      t = Number(valore);
    } else if (chiave === 'v1' && valore) {
      firme.push(valore);
    }
  }
  if (t === null || firme.length === 0) return null;
  return { t, firme };
};

/**
 * `true` se almeno una firma `v1` dell'intestazione è quella di `${t}.${corpo}` con `segreto` e `t` dista
 * da `adessoSec` al massimo `tolleranzaSec` secondi. Intestazione malformata, segreto vuoto o `t` non
 * numerico → `false`, mai un'eccezione.
 */
export async function verificaFirma(
  corpo: string,
  intestazione: string | null,
  segreto: string,
  adessoSec: number,
  tolleranzaSec = 300,
): Promise<boolean> {
  if (!intestazione || !segreto) return false;
  const letta = leggiIntestazione(intestazione);
  if (!letta) return false;
  if (Math.abs(adessoSec - letta.t) > tolleranzaSec) return false;

  const chiave = await crypto.subtle.importKey(
    'raw',
    codifica.encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const attesa = esadecimale(
    await crypto.subtle.sign('HMAC', chiave, codifica.encode(`${letta.t}.${corpo}`)),
  );
  // Si confrontano tutte le firme senza fermarsi alla prima giusta (niente scorciatoie misurabili).
  let valida = false;
  for (const firma of letta.firme) valida = ugualiTempoCostante(firma, attesa) || valida;
  return valida;
}
