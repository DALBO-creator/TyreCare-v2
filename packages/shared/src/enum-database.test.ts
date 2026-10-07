import { describe, expect, it } from 'vitest';
import { Constants } from './database.types';
import { PosizioneSchema, StagioneSchema, UsuraSchema } from './pneumatici';

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
