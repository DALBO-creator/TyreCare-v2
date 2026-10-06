import { describe, expect, it } from 'vitest';
import { Constants } from './database.types';
import { RuoloOfficinaSchema, RuoloSchema } from './ruoli';

// Se fallisce: la migrazione e gli schemi Zod non sono più allineati (rigenerare con `npm run db:types`).
describe('ruoli allineati al database', () => {
  it('ruolo globale', () => {
    expect(RuoloSchema.options).toEqual(Constants.public.Enums.ruolo);
  });

  it('ruolo in officina', () => {
    expect(RuoloOfficinaSchema.options).toEqual(Constants.public.Enums.ruolo_officina);
  });
});
