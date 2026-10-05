import { z } from 'zod';

/** Ruoli globali della piattaforma (PLAN §4). */
export const RuoloSchema = z.enum(['ADMIN', 'OFFICINA', 'CLIENTE']);
export type Ruolo = z.infer<typeof RuoloSchema>;

/** Livello di un utente all'interno della propria officina (PLAN P16). */
export const RuoloOfficinaSchema = z.enum(['TITOLARE', 'OPERATORE']);
export type RuoloOfficina = z.infer<typeof RuoloOfficinaSchema>;
