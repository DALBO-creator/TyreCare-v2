// Distanza tra due punti sulla Terra, per ordinare le officine "vicino a me" (nessun servizio esterno).

export type Punto = { latitudine: number; longitudine: number };

const RAGGIO_TERRA_KM = 6371;
const radianti = (gradi: number) => (gradi * Math.PI) / 180;

/** Distanza in chilometri in linea d'aria (formula dell'emisenoverso, "haversine"). */
export function distanzaKm(a: Punto, b: Punto): number {
  const dLat = radianti(b.latitudine - a.latitudine);
  const dLon = radianti(b.longitudine - a.longitudine);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianti(a.latitudine)) * Math.cos(radianti(b.latitudine)) * Math.sin(dLon / 2) ** 2;
  // min(1, …) evita un NaN per errori di arrotondamento con punti agli antipodi
  return 2 * RAGGIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m" (a passi di 50 m) sotto 1 km, "3,2 km" sotto 10 km, "25 km" oltre; virgola italiana. */
export function formattaDistanza(km: number): string {
  const metri = Math.round((km * 1000) / 50) * 50;
  if (metri < 1000) return `${metri} m`;
  if (km < 9.95) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

type ConPosizione = { latitudine: number | null; longitudine: number | null };

/**
 * Le officine con coordinate, dalla più vicina; poi quelle senza coordinate, nell'ordine di partenza.
 * Ogni elemento riceve `distanza_km` (`null` se non si può calcolare). Non modifica l'elenco ricevuto.
 */
export function ordinaPerDistanza<T extends ConPosizione>(
  officine: readonly T[],
  posizione: Punto,
): (T & { distanza_km: number | null })[] {
  const con: (T & { distanza_km: number | null })[] = [];
  const senza: (T & { distanza_km: number | null })[] = [];
  for (const o of officine) {
    if (o.latitudine !== null && o.longitudine !== null) {
      con.push({
        ...o,
        distanza_km: distanzaKm(posizione, {
          latitudine: o.latitudine,
          longitudine: o.longitudine,
        }),
      });
    } else {
      senza.push({ ...o, distanza_km: null });
    }
  }
  con.sort((x, y) => x.distanza_km! - y.distanza_km!);
  return [...con, ...senza];
}
