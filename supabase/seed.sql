-- Dati di prova per lo sviluppo locale (eseguito da `supabase db reset`). NON usare in produzione.
--
-- Account (password per tutti: password123):
--   admin@tyrecare.test      ADMIN
--   titolare@tyrecare.test   OFFICINA, TITOLARE di "Gomme Rossi"
--   operatore@tyrecare.test  OFFICINA, OPERATORE di "Gomme Rossi"
--   cliente@tyrecare.test    CLIENTE (Giulia: la sua Panda è cliente di entrambe le officine)
--   titolare2@tyrecare.test  OFFICINA, TITOLARE di "Pneus Express"

-- Utenti di auth. I token vuoti ('') sono richiesti da GoTrue: con NULL il login fallisce.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('nome', u.nome, 'cognome', u.cognome),
  now(),
  now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@tyrecare.test', 'Ada', 'Admin'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'titolare@tyrecare.test', 'Mario', 'Rossi'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'operatore@tyrecare.test', 'Luca', 'Bianchi'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'cliente@tyrecare.test', 'Giulia', 'Verdi'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'titolare2@tyrecare.test', 'Paolo', 'Neri')
) as u (id, email, nome, cognome);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  id,
  id::text,
  'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users
where email like '%@tyrecare.test';

-- I profili li ha creati il trigger come CLIENTE: assegno i ruoli.
update public.profiles set ruolo = 'ADMIN' where id = 'a0000000-0000-4000-8000-000000000001';

-- Verifica in due passaggi dell'admin di prova (solo locale: il seed non va sul cloud). L'area admin la
-- richiede (is_admin vuole aal2). Chiave TOTP da inserire nell'app di autenticazione per provare a mano:
-- JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP. Gli e2e calcolano il codice da qui (e2e/tests/aiuti.ts).
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (
  'f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'TyreCare admin (sviluppo)', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
);
update public.profiles set ruolo = 'OFFICINA', telefono = '+39 333 1234567'
  where id in (
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000005'
  );

insert into public.officine (
  id, ragione_sociale, partita_iva, indirizzo, cap, citta, provincia,
  latitudine, longitudine, telefono, email, orari, stato_affiliazione
) values
  (
    'b0000000-0000-4000-8000-000000000001',
    'Gomme Rossi S.n.c.', '01234567890', 'Via Roma 10', '10121', 'Torino', 'TO',
    45.070312, 7.686856, '+39 011 1234567', 'info@gommerossi.test',
    '{"lun": [["08:30", "12:30"], ["14:30", "19:00"]], "mar": [["08:30", "12:30"], ["14:30", "19:00"]],
      "mer": [["08:30", "12:30"], ["14:30", "19:00"]], "gio": [["08:30", "12:30"], ["14:30", "19:00"]],
      "ven": [["08:30", "12:30"], ["14:30", "19:00"]], "sab": [["08:30", "12:30"]], "dom": []}',
    'ATTIVA'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'Pneus Express S.r.l.', '09876543210', 'Corso Francia 200', '10143', 'Torino', 'TO',
    45.076000, 7.640000, '+39 011 7654321', 'officina@pneusexpress.test',
    '{}',
    'IN_ATTESA'
  );

insert into public.officina_utenti (officina_id, profile_id, ruolo) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'TITOLARE'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'OPERATORE'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'TITOLARE');

-- ---------------------------------------------------------------------------------------------------
-- Fase 2 — dati di officina
-- ---------------------------------------------------------------------------------------------------
-- Gomme Rossi: Giulia (collegata al suo account) con la Panda, e un cliente senza account con una Golf.
-- Pneus Express: anche lì Giulia con la stessa Panda (scheda separata: i dati sono dell'officina).

insert into public.clienti_officina (id, officina_id, profile_id, codice_gestionale, nome, cognome, telefono)
values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'C0001', 'Giulia', 'Verdi', '+39 347 1112223'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   null, 'C0002', 'Franco', 'Gialli', '+39 348 4445556'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000004', null, 'Giulia', 'Verdi', null);

insert into public.veicoli (id, officina_id, cliente_officina_id, targa, marca, modello, anno) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'AB 123 CD', 'Fiat', 'Panda', 2019),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'EF456GH', 'Volkswagen', 'Golf', 2021),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000003', 'AB123CD', 'FIAT', 'Panda 1.2', 2019);

-- Pneumatici invernali della Panda da Gomme Rossi (come nella pagina /anteprima)
insert into public.pneumatici (id, officina_id, veicolo_id, posizione, stagione, misura, marca, modello, dot, montato_il)
select p.id, 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  p.posizione::public.posizione_pneumatico, 'INVERNALE', '175/65 R14 82T', 'Michelin', 'Alpin 6', '3823', '2025-11-10'
from (values
  ('e0000000-0000-4000-8000-000000000001'::uuid, 'ANT_SX'),
  ('e0000000-0000-4000-8000-000000000002'::uuid, 'ANT_DX'),
  ('e0000000-0000-4000-8000-000000000003'::uuid, 'POST_SX'),
  ('e0000000-0000-4000-8000-000000000004'::uuid, 'POST_DX')
) as p (id, posizione);

insert into public.controlli (id, officina_id, veicolo_id, eseguito_il, km, note, eseguito_da) values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000001', '2026-09-14', 41250,
   'Posteriore sinistro sotto il limite di legge: sostituire.', 'a0000000-0000-4000-8000-000000000003');

insert into public.misure_pneumatico (controllo_id, pneumatico_id, veicolo_id, officina_id, battistrada_mm, pressione_bar, usura)
select 'f0000000-0000-4000-8000-000000000001', m.pneumatico_id, 'd0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001', m.mm, 2.3, m.usura::public.usura
from (values
  ('e0000000-0000-4000-8000-000000000001'::uuid, 6.2, 'REGOLARE'),
  ('e0000000-0000-4000-8000-000000000002'::uuid, 3.4, 'REGOLARE'),
  ('e0000000-0000-4000-8000-000000000003'::uuid, 1.4, 'INTERNA'),
  ('e0000000-0000-4000-8000-000000000004'::uuid, 5.8, 'REGOLARE')
) as m (pneumatico_id, mm, usura);

-- ---------------------------------------------------------------------------------------------------
-- Fase 4 — catalogo dei servizi e prenotazioni
-- ---------------------------------------------------------------------------------------------------
-- Gomme Rossi: quattro servizi (uno non prenotabile dall'app). Giulia ha chiesto un cambio gomme per la
-- Panda il primo giorno di apertura dopo oggi, di mattina (la data cambia a ogni `db reset`).

insert into public.servizi_officina (id, officina_id, nome, descrizione, durata_minuti, prezzo_da, prenotabile)
values
  ('a1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Cambio gomme stagionale', 'Smontaggio, montaggio ed equilibratura di 4 pneumatici.', 45, 40.00, true),
  ('a1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Controllo pneumatici', 'Battistrada, pressione e usura di tutte le ruote, con report nell''app.', 20, null, true),
  ('a1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   'Convergenza', 'Controllo e regolazione dell''assetto.', 60, 50.00, true),
  ('a1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001',
   'Deposito gomme', 'Custodia delle gomme della stagione successiva.', null, 30.00, false);

insert into public.prenotazioni (
  id, officina_id, servizio_id, servizio, cliente_id, nome_cliente, telefono_cliente, targa, veicolo,
  giorno, fascia, note
)
select
  'a2000000-0000-4000-8000-000000000001', o.id, 'a1000000-0000-4000-8000-000000000001',
  'Cambio gomme stagionale', 'a0000000-0000-4000-8000-000000000004', 'Giulia Verdi', '+39 347 1112223',
  'AB123CD', 'Fiat Panda', g.giorno, 'MATTINA', 'Ho già le gomme estive in deposito da voi.'
from public.officine o
cross join lateral (
  select d::date as giorno
  from generate_series(public.oggi_in_italia() + 1, public.oggi_in_italia() + 14, interval '1 day') as d
  where 'MATTINA' = any (public.fasce_aperte(o.orari, d::date))
  order by d
  limit 1
) as g
where o.id = 'b0000000-0000-4000-8000-000000000001';
-- Una chiusura straordinaria di Gomme Rossi tra 20 e 22 giorni (lontana dai giorni usati dai test e2e)
insert into public.chiusure_officina (officina_id, dal, al, motivo) values
  ('b0000000-0000-4000-8000-000000000001', public.oggi_in_italia() + 20, public.oggi_in_italia() + 22,
   'Inventario');