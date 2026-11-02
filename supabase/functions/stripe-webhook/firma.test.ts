import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verificaFirma } from './firma.ts';

const SEGRETO = 'whsec_prova';
const ADESSO = 1_793_000_000;
const CORPO = '{"id":"evt_prova","type":"customer.subscription.updated","data":{"object":{}}}';

const firma = (t: number, corpo = CORPO, segreto = SEGRETO): string =>
  createHmac('sha256', segreto).update(`${t}.${corpo}`).digest('hex');

describe('verificaFirma', () => {
  it('firma valida → true', async () => {
    const intestazione = `t=${ADESSO},v1=${firma(ADESSO)}`;
    expect(await verificaFirma(CORPO, intestazione, SEGRETO, ADESSO)).toBe(true);
  });

  it('v1 sbagliato → false', async () => {
    const sbagliata = firma(ADESSO).replace(/^./, (c) => (c === '0' ? '1' : '0'));
    expect(await verificaFirma(CORPO, `t=${ADESSO},v1=${sbagliata}`, SEGRETO, ADESSO)).toBe(false);
  });

  it('firmata con un altro segreto → false', async () => {
    const intestazione = `t=${ADESSO},v1=${firma(ADESSO, CORPO, 'whsec_altro')}`;
    expect(await verificaFirma(CORPO, intestazione, SEGRETO, ADESSO)).toBe(false);
  });

  it('corpo cambiato dopo la firma (es. JSON riserializzato) → false', async () => {
    const intestazione = `t=${ADESSO},v1=${firma(ADESSO)}`;
    const riserializzato = JSON.stringify(JSON.parse(CORPO), null, 2);
    expect(await verificaFirma(riserializzato, intestazione, SEGRETO, ADESSO)).toBe(false);
  });

  it('tolleranza: 300 s esatti → true, 301 s → false, in entrambe le direzioni', async () => {
    for (const t of [ADESSO - 300, ADESSO + 300]) {
      expect(await verificaFirma(CORPO, `t=${t},v1=${firma(t)}`, SEGRETO, ADESSO)).toBe(true);
    }
    for (const t of [ADESSO - 301, ADESSO + 301]) {
      expect(await verificaFirma(CORPO, `t=${t},v1=${firma(t)}`, SEGRETO, ADESSO)).toBe(false);
    }
  });

  it('tolleranza personalizzata', async () => {
    const t = ADESSO - 60;
    expect(await verificaFirma(CORPO, `t=${t},v1=${firma(t)}`, SEGRETO, ADESSO, 30)).toBe(false);
  });

  it('più v1, uno giusto (anche non il primo), più v0 → true', async () => {
    const intestazione = `t=${ADESSO},v1=${'a'.repeat(64)},v1=${firma(ADESSO)},v0=${'b'.repeat(64)}`;
    expect(await verificaFirma(CORPO, intestazione, SEGRETO, ADESSO)).toBe(true);
  });

  it('solo v0 giusto → false (si accetta solo v1)', async () => {
    expect(await verificaFirma(CORPO, `t=${ADESSO},v0=${firma(ADESSO)}`, SEGRETO, ADESSO)).toBe(
      false,
    );
  });

  it('il t dell’intestazione è quello firmato: cambiarlo invalida la firma', async () => {
    const intestazione = `t=${ADESSO + 1},v1=${firma(ADESSO)}`;
    expect(await verificaFirma(CORPO, intestazione, SEGRETO, ADESSO)).toBe(false);
  });

  it.each([
    ['nulla', null],
    ['vuota', ''],
    ['senza t', `v1=${firma(ADESSO)}`],
    ['senza v1', `t=${ADESSO}`],
    ['t non numerico', `t=abc,v1=${firma(ADESSO)}`],
    ['t con decimali', `t=${ADESSO}.5,v1=${firma(ADESSO)}`],
    ['spazzatura', 'ciao,=,,v1'],
  ])('intestazione %s → false senza eccezioni', async (_nome, intestazione) => {
    await expect(verificaFirma(CORPO, intestazione, SEGRETO, ADESSO)).resolves.toBe(false);
  });

  it('segreto vuoto → false', async () => {
    const intestazione = `t=${ADESSO},v1=${firma(ADESSO, CORPO, '')}`;
    expect(await verificaFirma(CORPO, intestazione, '', ADESSO)).toBe(false);
  });

  it('firma troncata (lunghezza diversa) → false', async () => {
    const intestazione = `t=${ADESSO},v1=${firma(ADESSO).slice(0, 63)}`;
    expect(await verificaFirma(CORPO, intestazione, SEGRETO, ADESSO)).toBe(false);
  });
});
