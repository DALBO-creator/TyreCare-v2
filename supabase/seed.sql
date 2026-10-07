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
