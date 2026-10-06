-- Dati di prova per lo sviluppo locale (eseguito da `supabase db reset`). NON usare in produzione.
--
-- Account (password per tutti: password123):
--   admin@tyrecare.test      ADMIN
--   titolare@tyrecare.test   OFFICINA, TITOLARE di "Gomme Rossi"
--   operatore@tyrecare.test  OFFICINA, OPERATORE di "Gomme Rossi"
--   cliente@tyrecare.test    CLIENTE

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
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'cliente@tyrecare.test', 'Giulia', 'Verdi')
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
  where id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003');

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
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'OPERATORE');
