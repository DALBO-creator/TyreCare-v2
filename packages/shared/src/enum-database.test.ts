import { describe, expect, it } from 'vitest';
import { Constants } from './database.types';
import { PosizioneSchema, StagioneSchema, UsuraSchema } from './pneumatici';
import { FasciaSchema, StatoPrenotazioneSchema } from './prenotazioni';

// Se fallisce: la migrazione e gli schemi Zod non sono più allineati (rigenerare con `npm run db:types`).
describe('enum degli pneumatici allineati al database', () => {
  it('stagione', () => {
    expect(StagioneSchema.options).toEqual(Constants.public.Enums.stagione);
  });

  it('posizione', () => {
    expect(PosizioneSchema.options).toEqual(Constants.public.Enums.posizione_pneumatico);
  });

  it('usura', () => {
    expect(UsuraSchema.options).toEqual(Constants.public.Enums.usura);
  });
});

describe('enum delle prenotazioni allineati al database', () => {
  it('fascia', () => {
    expect(FasciaSchema.options).toEqual(Constants.public.Enums.fascia_oraria);
  });

  it('stato', () => {
    expect(StatoPrenotazioneSchema.options).toEqual(Constants.public.Enums.stato_prenotazione);
  });
});
