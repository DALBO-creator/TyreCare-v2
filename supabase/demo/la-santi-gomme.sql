-- =====================================================================================================
-- DEMO "La Santi Gomme" — dati realistici per mostrare TyreCare al titolare dell'officina
-- =====================================================================================================
--
-- Da eseguire nel SQL Editor del progetto cloud SOLO DOPO
-- aver allineato le migrazioni con `npx supabase db push` (vedi DOCS/pilota/demo-la-santi.md).
--
-- Cosa fa, tutto in una transazione (se qualcosa va storto non cambia niente):
--   1. trova i due account: l'officina (titolare) e il cliente, dalle email qui sotto;
--   2. SVUOTA i dati di prova: clienti, veicoli, gomme, controlli, appuntamenti, servizi, chiusure, import,
--      richieste su strada e notifiche dei due account (i commenti mandati dall'app restano);
--   3. trasforma "Officina di prova TyreCare" in "La Santi Gomme" (indirizzo, orari, contatti) e la mette
--      con l'abbonamento annuale attivo e gratuito per il primo anno (officina pilota);
--   4. crea il catalogo dei servizi, 12 veicoli in stati diversi con lo storico dei controlli, gli
--      appuntamenti (passati, di oggi in poi), una richiesta di aiuto su strada, gli import dal
--      gestionale e le notifiche già lette/da leggere;
--   5. crea 7 clienti "finti" dell'app (account che non possono accedere, email *.invalid, segnati con
--      `raw_app_meta_data.demo = true`): servono perché ogni appuntamento ha un account cliente.
--
-- Le date sono relative al giorno in cui si esegue lo script e cadono sempre nei giorni e nelle fasce di
-- apertura. Si può rieseguire: riparte da zero. Durante il caricamento i trigger delle notifiche sono
-- spenti (niente push vere, niente notifiche "di adesso"): le notifiche si scrivono a mano con l'ora
-- giusta. Per togliere solo i clienti finti: sezione "PULIZIA" in fondo a DOCS/pilota/demo-la-santi.md.
-- =====================================================================================================

begin;

-- -----------------------------------------------------------------------------------------------------
-- 0. Parametri e controlli
-- -----------------------------------------------------------------------------------------------------
create temp table demo_param on commit drop as
select
  'albodavide1@gmail.com'::text as email_officina,
  'albodavidexd@gmail.com'::text as email_cliente;

create temp table demo_id (
  officina uuid,
  titolare uuid,
  cliente uuid,
  cliente_nome text,
  cliente_cognome text,
  cliente_tel text
) on commit drop;

do $$
declare
  v_tit uuid;
  v_cli uuid;
  v_off uuid;
  v_n integer;
begin
  select u.id into v_tit from auth.users u, demo_param p where lower(u.email) = p.email_officina;
  select u.id into v_cli from auth.users u, demo_param p where lower(u.email) = p.email_cliente;
  if v_tit is null then
    raise exception 'Account officina non trovato: controlla l''email in demo_param';
  end if;
  if v_cli is null then
    raise exception 'Account cliente non trovato: controlla l''email in demo_param';
  end if;

  -- L'officina di cui è titolare; se sono più di una, quella "di prova" (o già "Santi"), altrimenti
  -- lo script si ferma.
  select count(*) into v_n from public.officina_utenti where profile_id = v_tit and ruolo = 'TITOLARE';
  if v_n = 0 then
    raise exception 'L''account officina non è titolare di nessuna officina';
  elsif v_n > 1 then
    select u.officina_id into v_off
    from public.officina_utenti u join public.officine o on o.id = u.officina_id
    where u.profile_id = v_tit and u.ruolo = 'TITOLARE'
      and (o.ragione_sociale ilike '%prova%' or o.ragione_sociale ilike '%santi%');
    if v_off is null then
      raise exception 'L''account è titolare di % officine e nessuna sembra quella di prova', v_n;
    end if;
  else
    select officina_id into v_off from public.officina_utenti
    where profile_id = v_tit and ruolo = 'TITOLARE';
  end if;

  -- Schema aggiornato? (colonne e tabelle delle ultime migrazioni)
  if to_regclass('public.commenti') is null or to_regclass('public.abbonamenti') is null
    or to_regclass('public.richieste_strada') is null
    or not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'profiles'
                     and column_name = 'email_notifiche') then
    raise exception 'Il database non ha le ultime migrazioni: esegui prima `npx supabase db push`';
  end if;

  insert into demo_id
  select v_off, v_tit, v_cli,
    coalesce(nullif(trim(p.nome), ''), 'Davide'),
    coalesce(nullif(trim(p.cognome), ''), 'Albo'),
    case when p.telefono ~ '^\+?[0-9 ]{6,20}$' then p.telefono else '+39 345 210 7788' end
  from public.profiles p where p.id = v_cli;
end;
$$;

-- Trigger spenti durante il caricamento (riaccesi in fondo, sempre nella stessa transazione)
alter table public.prenotazioni disable trigger prenotazioni_notifica;
alter table public.controlli disable trigger controlli_notifica_esito;
alter table public.notifiche disable trigger notifiche_push;

-- -----------------------------------------------------------------------------------------------------
-- 1. Svuota i dati di prova
-- -----------------------------------------------------------------------------------------------------
-- Clienti finti di una esecuzione precedente (a cascata: profili, appuntamenti, notifiche, richieste)
delete from auth.users where raw_app_meta_data ->> 'demo' = 'true';

delete from public.notifiche
where destinatario_id in (select titolare from demo_id union select cliente from demo_id);
delete from public.prenotazioni
where officina_id = (select officina from demo_id) or cliente_id = (select cliente from demo_id);
delete from public.richieste_strada
where officina_id = (select officina from demo_id) or cliente_id = (select cliente from demo_id);
-- Veicoli: a cascata gomme, controlli, misure e link dei report
delete from public.veicoli where officina_id = (select officina from demo_id);
-- Clienti: a cascata gli inviti
delete from public.clienti_officina where officina_id = (select officina from demo_id);
-- Il cliente collegato ad altre officine: lo si scollega soltanto (i dati sono di quelle officine)
update public.clienti_officina set profile_id = null where profile_id = (select cliente from demo_id);
delete from public.servizi_officina where officina_id = (select officina from demo_id);
delete from public.chiusure_officina where officina_id = (select officina from demo_id);
delete from public.import_log where officina_id = (select officina from demo_id);
delete from public.import_mappature where officina_id = (select officina from demo_id);

-- -----------------------------------------------------------------------------------------------------
-- 2. L'officina diventa La Santi Gomme
-- -----------------------------------------------------------------------------------------------------
update public.officine set
  ragione_sociale = 'La Santi Gomme',
  indirizzo = 'Via della Scienza, 6',
  cap = '25039',
  citta = 'Travagliato',
  provincia = 'BS',
  -- Posizione approssimativa (Travagliato): si corregge da "Dati dell'officina"
  latitudine = 45.5205,
  longitudine = 10.0820,
  telefono = '030 6864669',
  email = 'info@lasantigommesrl.it',
  orari = '{"lun": [["08:00", "12:00"], ["14:00", "18:00"]],
            "mar": [["08:00", "12:00"], ["14:00", "18:00"]],
            "mer": [["08:00", "12:00"], ["14:00", "18:00"]],
            "gio": [["08:00", "12:00"], ["14:00", "18:00"]],
            "ven": [["08:00", "12:00"], ["14:00", "18:00"]],
            "sab": [["08:00", "12:00"]],
            "dom": []}',
  capienza_fascia = 4,
  intervento_strada = true,
  raggio_strada_km = 30,
  stato_affiliazione = 'ATTIVA'
where id = (select officina from demo_id);

insert into public.abbonamenti (officina_id, piano, stato, iniziato_il, scade_il, importo_concordato, note_admin)
select officina, 'ANNUALE', 'ATTIVO', current_date, current_date + 364, 0, 'Officina pilota: primo anno gratuito.'
from demo_id
on conflict (officina_id) do update
set piano = excluded.piano, stato = excluded.stato, iniziato_il = excluded.iniziato_il,
    scade_il = excluded.scade_il, importo_concordato = excluded.importo_concordato,
    note_admin = excluded.note_admin;

-- Giorno di apertura: oggi + p giorni, spostato in avanti (p >= 0) o indietro (p < 0) finché la fascia
-- è aperta. Le ore sono in ora italiana.
create or replace function pg_temp.g(p integer, f text default 'MATTINA') returns date
language plpgsql stable as $$
declare
  v_orari jsonb := (select orari from public.officine where id = (select officina from demo_id));
  d date := public.oggi_in_italia() + p;
begin
  while not (f::public.fascia_oraria = any (public.fasce_aperte(v_orari, d))) loop
    d := d + case when p >= 0 then 1 else -1 end;
  end loop;
  return d;
end;
$$;

create or replace function pg_temp.ora(d date, t text) returns timestamptz
language sql immutable as $$ select (d + t::time) at time zone 'Europe/Rome' $$;

-- -----------------------------------------------------------------------------------------------------
-- 3. Servizi (prezzi indicativi "da", modificabili da Servizi)
-- -----------------------------------------------------------------------------------------------------
insert into public.servizi_officina (id, officina_id, nome, descrizione, durata_minuti, prezzo_da, prenotabile)
select s.id::uuid, (select officina from demo_id), s.nome, s.descr, s.durata, s.prezzo, s.prenotabile
from (values
  ('de600000-0000-4000-8000-000000000001', 'Cambio gomme stagionale',
   'Smontaggio e montaggio di 4 pneumatici con equilibratura, controllo di pressione e battistrada. '
   || 'Il report del controllo arriva nell''app.', 45, 45.00, true),
  ('de600000-0000-4000-8000-000000000002', 'Riparazione pneumatici',
   'Riparazione di forature con fungo dall''interno, quando il danno lo consente. Se non è riparabile '
   || 'ti proponiamo la sostituzione.', 30, 20.00, true),
  ('de600000-0000-4000-8000-000000000003', 'Equilibratura e convergenza',
   'Equilibratura delle 4 ruote e controllo e regolazione dell''assetto: niente vibrazioni e gomme che '
   || 'si consumano in modo regolare.', 60, 60.00, true),
  ('de600000-0000-4000-8000-000000000004', 'Deposito gomme',
   'Custodia stagionale del treno di gomme (con o senza cerchi): pulite, controllate e pronte per il '
   || 'prossimo cambio. Prezzo a stagione.', null, 50.00, true),
  ('de600000-0000-4000-8000-000000000005', 'Raddrizzatura cerchi',
   'Raddrizzatura di cerchi in lega o in ferro piegati da buche o urti, con verifica dell''equilibratura. '
   || 'Prezzo per cerchio.', 60, 50.00, true),
  ('de600000-0000-4000-8000-000000000006', 'Intervento su strada',
   'Foratura o gomma danneggiata entro 30 km da Travagliato: chiamaci o usa "Aiuto su strada" '
   || 'nell''app. Prezzo indicativo, dipende dalla distanza.', null, 60.00, false)
) as s (id, nome, descr, durata, prezzo, prenotabile);

-- Chiusure straordinarie (solo quelle ancora da venire)
insert into public.chiusure_officina (officina_id, dal, al, motivo)
select (select officina from demo_id), c.dal, c.al, c.motivo
from (values
  (make_date(extract(year from public.oggi_in_italia())::int, 12, 8),
   make_date(extract(year from public.oggi_in_italia())::int, 12, 8), 'Immacolata'),
  (make_date(extract(year from public.oggi_in_italia())::int, 12, 24),
   make_date(extract(year from public.oggi_in_italia())::int, 12, 26), 'Chiusura natalizia')
) as c (dal, al, motivo)
where c.al >= public.oggi_in_italia();

-- -----------------------------------------------------------------------------------------------------
-- 4. Clienti "finti" dell'app (non possono accedere: password casuale, email .invalid)
-- -----------------------------------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email,
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now() - u.da,
  '{"provider": "email", "providers": ["email"], "demo": true}'::jsonb,
  jsonb_build_object('nome', u.nome, 'cognome', u.cognome),
  now() - u.da, now() - u.da, '', '', '', ''
from (values
  ('de000000-0000-4000-8000-000000000001', 'marco.bertoli@demo.tyrecare.invalid', 'Marco', 'Bertoli', interval '160 days'),
  ('de000000-0000-4000-8000-000000000002', 'giulia.ferrari@demo.tyrecare.invalid', 'Giulia', 'Ferrari', interval '75 days'),
  ('de000000-0000-4000-8000-000000000003', 'luca.zanardelli@demo.tyrecare.invalid', 'Luca', 'Zanardelli', interval '50 days'),
  ('de000000-0000-4000-8000-000000000004', 'sara.bonomi@demo.tyrecare.invalid', 'Sara', 'Bonomi', interval '40 days'),
  ('de000000-0000-4000-8000-000000000005', 'andrea.pedrali@demo.tyrecare.invalid', 'Andrea', 'Pedrali', interval '30 days'),
  ('de000000-0000-4000-8000-000000000006', 'chiara.lanzoni@demo.tyrecare.invalid', 'Chiara', 'Lanzoni', interval '2 days'),
  ('de000000-0000-4000-8000-000000000007', 'francesco.tonoli@demo.tyrecare.invalid', 'Francesco', 'Tonoli', interval '20 days')
) as u (id, email, nome, cognome, da);

update public.profiles p set telefono = t.tel
from (values
  ('de000000-0000-4000-8000-000000000001', '+39 347 812 4410'),
  ('de000000-0000-4000-8000-000000000002', '+39 333 905 1287'),
  ('de000000-0000-4000-8000-000000000003', '+39 340 266 7315'),
  ('de000000-0000-4000-8000-000000000004', '+39 349 471 0938'),
  ('de000000-0000-4000-8000-000000000005', '+39 338 620 5541'),
  ('de000000-0000-4000-8000-000000000006', '+39 371 448 2096'),
  ('de000000-0000-4000-8000-000000000007', '+39 335 718 3364')
) as t (id, tel)
where p.id = t.id::uuid;

-- -----------------------------------------------------------------------------------------------------
-- 5. Clienti dell'officina (10 + il cliente vero) e veicoli (12)
-- -----------------------------------------------------------------------------------------------------
insert into public.clienti_officina (
  id, officina_id, profile_id, codice_gestionale, nome, cognome, ragione_sociale, telefono, email, note,
  origine, created_at
)
select c.id::uuid, (select officina from demo_id), c.profilo::uuid, c.codice, c.nome, c.cognome, c.rs,
  c.tel, c.email, c.note, c.origine::public.origine_dato, now() - c.da
from (values
  ('de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'C0412', 'Marco', 'Bertoli', null,
   '+39 347 812 4410', null, 'Invernali in deposito da noi (Pirelli Sottozero 3).', 'APP', interval '160 days'),
  ('de100000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000002', 'C0538', 'Giulia', 'Ferrari', null,
   '+39 333 905 1287', null, '', 'APP', interval '75 days'),
  ('de100000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000003', 'C0617', 'Luca', 'Zanardelli', null,
   '+39 340 266 7315', null, 'Estive in deposito da noi con i cerchi.', 'APP', interval '50 days'),
  ('de100000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000004', 'C0702', 'Sara', 'Bonomi', null,
   '+39 349 471 0938', null, '', 'APP', interval '40 days'),
  ('de100000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000005', 'C0745', 'Andrea', 'Pedrali', null,
   '+39 338 620 5541', null, 'Ha chiesto un preventivo per 2 gomme posteriori.', 'APP', interval '30 days'),
  ('de100000-0000-4000-8000-000000000006', null, 'C1042', '', '', 'Edil Franciacorta S.r.l.',
   '030 7721845', 'amministrazione@edilfranciacorta.invalid', 'Furgone aziendale: fattura a fine mese.', 'IMPORT', interval '20 days'),
  ('de100000-0000-4000-8000-000000000007', null, 'C0871', 'Roberto', 'Gatti', null,
   '+39 339 154 8820', null, '', 'IMPORT', interval '20 days'),
  ('de100000-0000-4000-8000-000000000008', null, 'C0915', 'Elena', 'Marchetti', null,
   '+39 346 337 9102', null, 'Avvisata per le anteriori da sostituire.', 'IMPORT', interval '20 days'),
  ('de100000-0000-4000-8000-000000000009', 'de000000-0000-4000-8000-000000000007', 'C0958', 'Francesco', 'Tonoli', null,
   '+39 335 718 3364', null, '', 'APP', interval '20 days'),
  ('de100000-0000-4000-8000-000000000010', null, 'C1118', 'Giovanni', 'Pasini', null,
   '+39 328 590 6613', null, 'Cliente nuovo: passa per il deposito delle invernali.', 'APP', interval '3 days')
) as c (id, profilo, codice, nome, cognome, rs, tel, email, note, origine, da);

-- Il cliente vero (il suo account vede questi veicoli nel garage)
insert into public.clienti_officina (id, officina_id, profile_id, codice_gestionale, nome, cognome, telefono,
  email, origine, created_at)
select 'de100000-0000-4000-8000-000000000011', officina, cliente, 'C0390', cliente_nome, cliente_cognome,
  cliente_tel, (select email_cliente from demo_param), 'APP', now() - interval '200 days'
from demo_id;

insert into public.veicoli (id, officina_id, cliente_officina_id, targa, marca, modello, anno, origine, created_at)
select v.id::uuid, (select officina from demo_id), v.cliente::uuid, v.targa, v.marca, v.modello, v.anno,
  v.origine::public.origine_dato, now() - v.da
from (values
  -- Fuori stagione: estive ancora montate, cambio richiesto
  ('de200000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', 'GH512KT', 'Audi', 'A4 Avant', 2020, 'APP', interval '160 days'),
  -- 4 stagioni sotto la soglia consigliata (giallo)
  ('de200000-0000-4000-8000-000000000002', 'de100000-0000-4000-8000-000000000002', 'GA318PL', 'Toyota', 'Yaris Hybrid', 2022, 'APP', interval '75 days'),
  -- Invernali appena montate (verde)
  ('de200000-0000-4000-8000-000000000003', 'de100000-0000-4000-8000-000000000003', 'GE774ZR', 'BMW', 'X1 sDrive18d', 2021, 'APP', interval '50 days'),
  -- Estive consumate e fuori stagione, cambio domani
  ('de200000-0000-4000-8000-000000000004', 'de100000-0000-4000-8000-000000000004', 'FY209BN', 'Peugeot', '3008', 2020, 'APP', interval '40 days'),
  -- Posteriori sotto il limite di legge (rosso)
  ('de200000-0000-4000-8000-000000000005', 'de100000-0000-4000-8000-000000000005', 'EZ641HD', 'Ford', 'Fiesta', 2016, 'APP', interval '30 days'),
  -- Furgone con usura sui bordi (giallo), dal gestionale
  ('de200000-0000-4000-8000-000000000006', 'de100000-0000-4000-8000-000000000006', 'FL883TS', 'Fiat', 'Ducato', 2018, 'IMPORT', interval '20 days'),
  -- Ultimo controllo di oltre un anno fa (da ricontrollare), dal gestionale
  ('de200000-0000-4000-8000-000000000007', 'de100000-0000-4000-8000-000000000007', 'FR455MV', 'Jeep', 'Compass', 2019, 'IMPORT', interval '20 days'),
  -- Anteriori sotto il limite e fuori stagione (rosso)
  ('de200000-0000-4000-8000-000000000008', 'de100000-0000-4000-8000-000000000008', 'EP127XC', 'Lancia', 'Ypsilon', 2014, 'IMPORT', interval '20 days'),
  -- Invernali montate ieri, appuntamento ancora da chiudere
  ('de200000-0000-4000-8000-000000000009', 'de100000-0000-4000-8000-000000000009', 'FV093AR', 'Volkswagen', 'Polo', 2018, 'APP', interval '20 days'),
  -- Nessun controllo
  ('de200000-0000-4000-8000-000000000010', 'de100000-0000-4000-8000-000000000010', 'EH562DK', 'Renault', 'Clio', 2015, 'APP', interval '3 days'),
  -- Del cliente vero: Golf con le invernali appena montate (verde), Panda 4 stagioni (giallo)
  ('de200000-0000-4000-8000-000000000011', 'de100000-0000-4000-8000-000000000011', 'FX482RN', 'Volkswagen', 'Golf', 2019, 'APP', interval '200 days'),
  ('de200000-0000-4000-8000-000000000012', 'de100000-0000-4000-8000-000000000011', 'FF913LB', 'Fiat', 'Panda', 2017, 'APP', interval '200 days')
) as v (id, cliente, targa, marca, modello, anno, origine, da);

-- -----------------------------------------------------------------------------------------------------
-- 6. Gomme (treni montati e smontati)
-- -----------------------------------------------------------------------------------------------------
-- Un treno = 4 gomme con id 'de3VVTT0-…-00000000000P': VV veicolo, TT treno, P posizione (1-4)
create temp table demo_treno (
  veicolo int, treno int, stagione text, misura text, marca text, modello text, dot text,
  montato date, smontato date, origine text default 'APP'
) on commit drop;

insert into demo_treno values
  -- 1 Audi A4: invernali smontate in aprile (in deposito), estive montate
  (1, 1, 'INVERNALE', '225/50 R17 98V', 'Pirelli', 'Sottozero 3', '4024', pg_temp.g(-370), pg_temp.g(-205)),
  (1, 2, 'ESTIVO', '225/50 R17 98Y', 'Michelin', 'Pilot Sport 5', '0824', pg_temp.g(-205), null),
  -- 2 Yaris: 4 stagioni
  (2, 1, 'QUATTRO_STAGIONI', '185/65 R15 92V', 'Michelin', 'CrossClimate 2', '1123', pg_temp.g(-560), null),
  -- 3 X1: estive smontate e invernali montate 12 giorni fa
  (3, 1, 'ESTIVO', '225/55 R17 101W', 'Bridgestone', 'Turanza 6', '1424', pg_temp.g(-205), pg_temp.g(-12)),
  (3, 2, 'INVERNALE', '225/55 R17 101V', 'Pirelli', 'Scorpion Winter 2', '3925', pg_temp.g(-12), null),
  -- 4 3008: estive montate (consumate)
  (4, 1, 'ESTIVO', '225/55 R18 98V', 'Continental', 'EcoContact 6', '1022', pg_temp.g(-560), null),
  -- 5 Fiesta: 4 stagioni
  (5, 1, 'QUATTRO_STAGIONI', '195/60 R15 88H', 'Goodyear', 'Vector 4Seasons Gen-2', '2721', pg_temp.g(-900), null),
  -- 6 Ducato: 4 stagioni da furgone
  (6, 1, 'QUATTRO_STAGIONI', '225/75 R16C 121R', 'Michelin', 'Agilis CrossClimate', '0523', pg_temp.g(-420), null),
  -- 7 Compass: invernali montate un anno fa (dal gestionale)
  (7, 1, 'INVERNALE', '215/60 R17 96H', 'Nokian', 'Snowproof 2 SUV', '3324', date '2025-10-20', null),
  -- 8 Ypsilon: estive vecchie
  (8, 1, 'ESTIVO', '185/55 R15 82H', 'Hankook', 'Kinergy Eco 2', '1820', pg_temp.g(-950), null),
  -- 9 Polo: estive smontate ieri, invernali nuove montate
  (9, 1, 'ESTIVO', '185/65 R15 88T', 'Bridgestone', 'Turanza T005', '0923', pg_temp.g(-205), pg_temp.g(-1)),
  (9, 2, 'INVERNALE', '185/65 R15 88T', 'Michelin', 'Alpin 7', '3626', pg_temp.g(-1), null),
  -- 11 Golf (cliente vero): estive smontate 5 giorni fa (in deposito), invernali montate
  (11, 1, 'ESTIVO', '205/55 R16 91V', 'Bridgestone', 'Turanza T005', '1024', pg_temp.g(-215), pg_temp.g(-5)),
  (11, 2, 'INVERNALE', '205/55 R16 91H', 'Michelin', 'Alpin 6', '3524', pg_temp.g(-5), null),
  -- 12 Panda (cliente vero): 4 stagioni
  (12, 1, 'QUATTRO_STAGIONI', '175/65 R14 82T', 'Goodyear', 'Vector 4Seasons Gen-3', '2223', pg_temp.g(-640), null);
update demo_treno set origine = 'IMPORT' where veicolo = 7;

create or replace function pg_temp.vid(v int) returns uuid language sql immutable as
$$ select ('de200000-0000-4000-8000-' || lpad(v::text, 12, '0'))::uuid $$;
create or replace function pg_temp.pid(v int, t int, pos int) returns uuid language sql immutable as
$$ select ('de3' || lpad(v::text, 2, '0') || lpad(t::text, 2, '0') || '0-0000-4000-8000-'
           || lpad(pos::text, 12, '0'))::uuid $$;

insert into public.pneumatici (id, officina_id, veicolo_id, posizione, stagione, misura, marca, modello, dot,
  montato_il, smontato_il, origine)
select pg_temp.pid(t.veicolo, t.treno, p.n), (select officina from demo_id), pg_temp.vid(t.veicolo),
  p.pos::public.posizione_pneumatico, t.stagione::public.stagione, t.misura, t.marca, t.modello, t.dot,
  t.montato, t.smontato, t.origine::public.origine_dato
from demo_treno t
cross join (values (1, 'ANT_SX'), (2, 'ANT_DX'), (3, 'POST_SX'), (4, 'POST_DX')) as p (n, pos);

-- -----------------------------------------------------------------------------------------------------
-- 7. Controlli con le misure (battistrada mm, pressione bar, usura) per ANT_SX, ANT_DX, POST_SX, POST_DX
-- -----------------------------------------------------------------------------------------------------
create temp table demo_controllo (
  n int, veicolo int, treno int, giorno date, km int, note text,
  mm numeric[], bar numeric[], usura text[], origine text default 'APP', documento text
) on commit drop;

insert into demo_controllo (n, veicolo, treno, giorno, km, note, mm, bar, usura) values
  -- Audi A4: controllo estivo in luglio, gomme buone ma ora fuori stagione
  (1, 1, 2, pg_temp.g(-120), 38750, 'Controllo prima delle ferie: tutto regolare.',
   '{6.4,6.3,6.8,6.9}', '{2.5,2.5,2.4,2.4}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}'),
  -- Yaris: convergenza; anteriori sotto i 4 mm consigliati per le 4 stagioni
  (2, 2, 1, pg_temp.g(-16), 41320,
   'Fatta convergenza (anteriori aperte). Anteriori a 3,6 mm: da cambiare entro fine inverno.',
   '{3.6,3.5,4.4,4.5}', '{2.3,2.3,2.2,2.2}', '{INTERNA,INTERNA,REGOLARE,REGOLARE}'),
  -- X1: cambio stagionale, invernali nuove
  (3, 3, 2, pg_temp.g(-12), 27410, 'Montate invernali nuove. Estive (Turanza 6, 5,2 mm) in deposito con i cerchi.',
   '{8.1,8.1,8.0,8.1}', '{2.6,2.6,2.6,2.6}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}'),
  -- 3008: estive consumate, fuori stagione
  (4, 4, 1, pg_temp.g(-40, 'POMERIGGIO'), 64980,
   'Estive al limite consigliato: per la prossima estate servono gomme nuove.',
   '{2.8,2.7,3.4,3.3}', '{2.4,2.4,2.3,2.3}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}'),
  -- Fiesta: foratura riparata, posteriori sotto il limite
  (5, 5, 1, pg_temp.g(-9, 'POMERIGGIO'), 112400,
   'Riparata foratura sul posteriore sinistro. Posteriori sotto il limite di legge: sostituire al più presto, preventivo inviato.',
   '{3.9,3.8,1.4,1.5}', '{2.2,2.2,2.0,2.0}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}'),
  -- Ducato: usura sui bordi da pressione bassa
  (6, 6, 1, pg_temp.g(-30), 158300,
   'Usura sui bordi delle anteriori: pressione trovata a 3,6 bar, riportata a 4,5. Ricontrollare tra un mese.',
   '{3.8,3.9,6.2,6.1}', '{4.5,4.5,4.8,4.8}', '{BORDI,BORDI,REGOLARE,REGOLARE}'),
  -- Polo: invernali nuove montate ieri
  (9, 9, 2, pg_temp.g(-1), 73560, 'Montate invernali nuove. Estive (2,9 mm) smaltite su richiesta del cliente.',
   '{8.0,8.0,8.0,8.0}', '{2.4,2.4,2.3,2.3}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}'),
  -- Ypsilon: anteriori sotto il limite di legge
  (8, 8, 1, pg_temp.g(-38), 131900,
   'Anteriori sotto il limite di legge (1,5 e 1,4 mm), taglio sul fianco dell''anteriore destra. Cliente avvisata.',
   '{1.5,1.4,3.1,3.0}', '{2.2,2.1,2.0,2.0}', '{ESTERNA,ESTERNA,REGOLARE,REGOLARE}'),
  -- Golf (cliente vero): 3 controlli in 2 mesi
  (11, 11, 1, pg_temp.g(-61), 48210,
   'Vibrazioni al volante sopra i 110 km/h: equilibrate le 4 ruote e regolata la convergenza.',
   '{5.4,5.3,5.9,6.0}', '{2.4,2.4,2.2,2.2}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}'),
  (12, 11, 1, pg_temp.g(-33, 'POMERIGGIO'), 50080,
   'Riparata foratura (vite) sul posteriore destro con fungo. Pressioni ripristinate.',
   '{5.1,5.0,5.7,5.6}', '{2.4,2.4,2.2,2.2}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}'),
  (13, 11, 2, pg_temp.g(-5), 51940,
   'Cambio stagionale: montate le invernali. Estive (Turanza T005, 4,8 mm) pulite e messe in deposito.',
   '{7.2,7.3,7.0,7.1}', '{2.5,2.5,2.3,2.3}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}'),
  -- Panda (cliente vero): 3 controlli, usura interna che peggiora
  (14, 12, 1, pg_temp.g(-57), 61430, 'Leggera usura interna sull''anteriore sinistra: da tenere d''occhio.',
   '{4.7,4.8,5.6,5.5}', '{2.2,2.2,2.0,2.0}', '{INTERNA,REGOLARE,REGOLARE,REGOLARE}'),
  (15, 12, 1, pg_temp.g(-26), 62610,
   'Pressioni basse (1,9 bar) riportate a 2,2. Usura interna sulle anteriori in aumento: consigliata la convergenza.',
   '{4.3,4.4,5.4,5.3}', '{2.2,2.2,2.0,2.0}', '{INTERNA,INTERNA,REGOLARE,REGOLARE}'),
  (16, 12, 1, pg_temp.g(-2), 63880,
   'Anteriori sotto i 4 mm consigliati con usura interna: convergenza prenotata. Valutare anteriori nuove entro l''inverno.',
   '{3.8,3.9,5.2,5.1}', '{2.2,2.2,2.0,2.0}', '{INTERNA,INTERNA,REGOLARE,REGOLARE}');

-- Compass: unico controllo, importato dal gestionale (oltre un anno fa)
insert into demo_controllo (n, veicolo, treno, giorno, km, note, mm, bar, usura, origine, documento) values
  (7, 7, 1, date '2025-10-20', 45100, 'Montate invernali nuove.',
   '{8.2,8.2,8.3,8.3}', '{2.4,2.4,2.4,2.4}', '{REGOLARE,REGOLARE,REGOLARE,REGOLARE}', 'IMPORT', 'FT 2025/1187');

create or replace function pg_temp.cid(n int) returns uuid language sql immutable as
$$ select ('de400000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

insert into public.controlli (id, officina_id, veicolo_id, eseguito_il, km, note, origine, codice_documento,
  eseguito_da, created_at)
select pg_temp.cid(c.n), d.officina, pg_temp.vid(c.veicolo), c.giorno, c.km, c.note,
  c.origine::public.origine_dato, c.documento, case when c.origine = 'APP' then d.titolare end,
  pg_temp.ora(c.giorno, case when c.n % 2 = 0 then '10:40' else '16:20' end)
from demo_controllo c cross join demo_id d;

insert into public.misure_pneumatico (controllo_id, pneumatico_id, veicolo_id, officina_id, battistrada_mm,
  pressione_bar, usura, created_at)
select pg_temp.cid(c.n), pg_temp.pid(c.veicolo, c.treno, p.n), pg_temp.vid(c.veicolo), d.officina,
  c.mm[p.n], c.bar[p.n], c.usura[p.n]::public.usura, pg_temp.ora(c.giorno, '10:40')
from demo_controllo c cross join demo_id d cross join generate_series(1, 4) as p (n);

-- Danno sul fianco della Ypsilon
update public.misure_pneumatico set danni = 'Taglio sul fianco esterno: non riparabile.'
where controllo_id = pg_temp.cid(8) and pneumatico_id = pg_temp.pid(8, 1, 2);

-- -----------------------------------------------------------------------------------------------------
-- 8. Appuntamenti
-- -----------------------------------------------------------------------------------------------------
create temp table demo_pren (
  n int, cliente text, servizio int, targa text, veicolo text, giorno date, fascia text, ora text,
  stato text, note text default '', messaggio text default '', creata interval
) on commit drop;

insert into demo_pren values
  -- Cliente vero ("io" = l'account cliente)
  (1, 'io', 3, 'FX482RN', 'Volkswagen Golf', pg_temp.g(-61), 'MATTINA', '09:00', 'COMPLETATA',
   'Vibrazioni al volante in autostrada.', '', interval '66 days'),
  (2, 'io', 3, 'FF913LB', 'Fiat Panda', pg_temp.g(-40), 'POMERIGGIO', '15:00', 'ANNULLATA',
   '', 'Ti aspettiamo alle 15.', interval '45 days'),
  (3, 'io', 2, 'FX482RN', 'Volkswagen Golf', pg_temp.g(-33, 'POMERIGGIO'), 'POMERIGGIO', '14:30', 'COMPLETATA',
   'Spia della pressione accesa, la posteriore destra si sgonfia.', 'Passa pure alle 14:30.', interval '34 days'),
  (4, 'io', 1, 'FX482RN', 'Volkswagen Golf', pg_temp.g(-5), 'MATTINA', '08:30', 'COMPLETATA',
   'Le invernali sono nel vostro deposito.', '', interval '12 days'),
  (5, 'io', 3, 'FF913LB', 'Fiat Panda', pg_temp.g(3), 'MATTINA', '08:30', 'CONFERMATA',
   'Convergenza consigliata all''ultimo controllo.', 'Ti aspettiamo alle 8:30, ci vuole circa un''ora.',
   interval '1 day 20 hours'),
  -- Altri clienti, passati
  (10, '3', 1, 'GE774ZR', 'BMW X1', pg_temp.g(-12), 'MATTINA', '09:30', 'COMPLETATA',
   'Invernali nuove, ho già scelto le Scorpion Winter 2.', '', interval '18 days'),
  (11, '2', 3, 'GA318PL', 'Toyota Yaris Hybrid', pg_temp.g(-16), 'MATTINA', '10:00', 'COMPLETATA',
   'L''auto tira a destra.', '', interval '21 days'),
  (12, '5', 2, 'EZ641HD', 'Ford Fiesta', pg_temp.g(-9, 'POMERIGGIO'), 'POMERIGGIO', '16:00', 'COMPLETATA',
   'Gomma posteriore a terra, sono riuscito ad arrivare piano.', '', interval '9 days 4 hours'),
  (13, '1', 3, 'GH512KT', 'Audi A4 Avant', pg_temp.g(-14), 'MATTINA', '11:00', 'NON_PRESENTATO',
   '', '', interval '20 days'),
  (14, '4', 5, 'FY209BN', 'Peugeot 3008', pg_temp.g(-22, 'POMERIGGIO'), 'POMERIGGIO', null, 'RIFIUTATA',
   'Cerchio anteriore piegato da una buca.',
   'Dalle foto il cerchio è crepato: va sostituito, non raddrizzato. Passa per un preventivo.',
   interval '24 days'),
  (15, '1', 2, 'GH512KT', 'Audi A4 Avant', pg_temp.g(-25), 'MATTINA', '08:00', 'COMPLETATA',
   'Chiodo nella posteriore sinistra.', '', interval '26 days'),
  -- Ieri: lavoro fatto ma appuntamento ancora da chiudere
  (16, '7', 1, 'FV093AR', 'Volkswagen Polo', pg_temp.g(-1), 'MATTINA', '09:00', 'CONFERMATA',
   'Vorrei invernali nuove, le estive le potete smaltire.', '', interval '8 days'),
  -- Prossimi giorni
  (20, '4', 1, 'FY209BN', 'Peugeot 3008', pg_temp.g(1), 'MATTINA', '08:30', 'CONFERMATA',
   'Ho le invernali in garage, le porto io.', 'Ti aspettiamo alle 8:30.', interval '4 days'),
  (21, '2', 1, 'GD105KS', 'Fiat 500X', pg_temp.g(2, 'POMERIGGIO'), 'POMERIGGIO', '14:00', 'CONFERMATA',
   'È l''auto di mio marito, invernali in deposito da voi.', '', interval '3 days'),
  (22, '1', 1, 'GH512KT', 'Audi A4 Avant', pg_temp.g(2), 'MATTINA', null, 'RICHIESTA',
   'Le invernali sono nel vostro deposito.', '', interval '5 hours'),
  (23, '6', 2, 'EH510PS', 'Citroën C3', pg_temp.g(1, 'POMERIGGIO'), 'POMERIGGIO', null, 'RICHIESTA',
   'Anteriore destra che si sgonfia lentamente.', '', interval '2 hours'),
  (24, '5', 3, 'EZ641HD', 'Ford Fiesta', pg_temp.g(4, 'POMERIGGIO'), 'POMERIGGIO', null, 'RICHIESTA',
   'Montaggio delle 2 posteriori nuove come da preventivo, con equilibratura.', '', interval '1 day 3 hours'),
  (25, '3', 5, 'GE774ZR', 'BMW X1', pg_temp.g(5, 'POMERIGGIO'), 'POMERIGGIO', '17:00', 'PROPOSTA',
   'Cerchio estivo piegato, da sistemare prima di metterlo in deposito.',
   'Il pomeriggio è pieno fino alle 17: va bene alle 17:00?', interval '1 day');

-- Chi prenota: 'io' è l'account cliente vero, un numero è il cliente finto con quel numero
create or replace function pg_temp.utente(c text) returns uuid language sql stable as $$
  select case when c = 'io' then (select cliente from demo_id)
    else ('de000000-0000-4000-8000-' || lpad(c, 12, '0'))::uuid end $$;

insert into public.prenotazioni (id, officina_id, servizio_id, servizio, cliente_id, nome_cliente,
  telefono_cliente, targa, veicolo, giorno, fascia, note, stato, appuntamento, messaggio_officina,
  gestita_da, created_at, updated_at, promemoria_per)
select
  ('de500000-0000-4000-8000-' || lpad(p.n::text, 12, '0'))::uuid,
  d.officina,
  s.id, s.nome,
  pg_temp.utente(p.cliente),
  case when p.cliente = 'io' then trim(d.cliente_nome || ' ' || d.cliente_cognome)
    else trim(pr.nome || ' ' || pr.cognome) end,
  coalesce(case when pr.telefono ~ '^\+?[0-9 ]{6,20}$' then pr.telefono end, d.cliente_tel),
  p.targa, p.veicolo, p.giorno, p.fascia::public.fascia_oraria, p.note,
  p.stato::public.stato_prenotazione,
  case when p.ora is not null then pg_temp.ora(p.giorno, p.ora) end,
  p.messaggio,
  case when p.stato <> 'RICHIESTA' then d.titolare end,
  now() - p.creata,
  case when p.stato = 'RICHIESTA' then now() - p.creata else now() - p.creata + interval '3 hours' end,
  -- Promemoria già mandati per gli appuntamenti passati; quelli futuri li manda il job delle 18
  case when p.ora is not null and p.giorno < public.oggi_in_italia() then pg_temp.ora(p.giorno, p.ora) end
from demo_pren p
cross join demo_id d
join public.servizi_officina s on s.id = ('de600000-0000-4000-8000-' || lpad(p.servizio::text, 12, '0'))::uuid
join public.profiles pr on pr.id = pg_temp.utente(p.cliente);

-- -----------------------------------------------------------------------------------------------------
-- 9. Aiuto su strada (richiesta chiusa la settimana scorsa) e import dal gestionale
-- -----------------------------------------------------------------------------------------------------
insert into public.richieste_strada (cliente_id, latitudine, longitudine, descrizione, telefono, targa, stato,
  officina_id, accettata_il, scade_il, created_at, updated_at)
select 'de000000-0000-4000-8000-000000000002', 45.5070, 10.1510,
  'Foratura sulla tangenziale sud all''uscita Roncadelle, anteriore destra a terra.', '+39 333 905 1287',
  'GA318PL', 'CHIUSA', officina, now() - interval '6 days 23 hours 52 minutes',
  now() - interval '6 days 22 hours', now() - interval '7 days', now() - interval '6 days 23 hours'
from demo_id;

insert into public.import_log (officina_id, tipo, nome_file, righe_importate, righe_scartate, clienti_nuovi,
  veicoli_nuovi, controlli_nuovi, pneumatici_nuovi, misure_nuove, eseguito_da, created_at)
select officina, 'CLIENTI_VEICOLI', 'clienti_gestityre.xlsx', 3, 0, 3, 3, 0, 0, 0, titolare,
  now() - interval '20 days 2 hours'
from demo_id
union all
select officina, 'CONTROLLI', 'controlli_gestityre.xlsx', 1, 0, 0, 0, 1, 4, 4, titolare,
  now() - interval '20 days 1 hour'
from demo_id;

-- -----------------------------------------------------------------------------------------------------
-- 10. Notifiche dei due account (con l'ora in cui sarebbero arrivate; le più recenti da leggere)
-- -----------------------------------------------------------------------------------------------------
create or replace function pg_temp.pren(n int) returns uuid language sql immutable as
$$ select ('de500000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- Testo "quando" e officina come nei trigger
create or replace temp view demo_pv as
select p.*, public.testo_quando(p.giorno, p.fascia, p.appuntamento) as quando,
  (select ragione_sociale from public.officine where id = p.officina_id) as officina
from public.prenotazioni p
where p.id::text like 'de500000-%';

-- Al cliente vero
insert into public.notifiche (destinatario_id, tipo, titolo, testo, link, prenotazione_id, letta_il,
  created_at, chiave)
select (select cliente from demo_id), n.tipo::public.tipo_notifica, n.titolo, n.testo, n.link, n.pren,
  case when n.letta then n.creata + interval '25 minutes' end, n.creata, n.chiave
from (
  select 'CONFERMATA' as tipo, 'Appuntamento confermato' as titolo,
    v.officina || ' ti aspetta ' || v.quando || ' · ' || v.servizio as testo,
    '/appuntamento?id=' || v.id as link, v.id as pren, true as letta,
    v.created_at + interval '3 hours' as creata, null as chiave
  from demo_pv v where v.id in (pg_temp.pren(1), pg_temp.pren(4))
  union all
  select 'CONFERMATA', 'Appuntamento confermato',
    v.officina || ' ti aspetta ' || v.quando || ' · ' || v.servizio
      || case when v.messaggio_officina <> '' then E'\n«' || v.messaggio_officina || '»' else '' end,
    '/appuntamento?id=' || v.id, v.id, v.id <> pg_temp.pren(5), v.created_at + interval '3 hours', null
  from demo_pv v where v.id in (pg_temp.pren(2), pg_temp.pren(3), pg_temp.pren(5))
  union all
  select 'PROMEMORIA', 'Domani hai un appuntamento',
    v.officina || ' ti aspetta ' || v.quando || ' · ' || v.servizio,
    '/appuntamento?id=' || v.id, v.id, true, pg_temp.ora(v.giorno - 1, '18:00'), null
  from demo_pv v where v.id in (pg_temp.pren(1), pg_temp.pren(3), pg_temp.pren(4))
  union all
  -- Promemoria del cambio stagionale per la Golf (con la chiave del job: non si ripete)
  select 'CAMBIO_STAGIONE', 'È ora delle gomme invernali',
    'Sul veicolo ' || public.testo_veicolo('FX482RN', 'Volkswagen', 'Golf') || ' risultano montate gomme '
      || 'estive: dal 15 novembre su molte strade servono gomme invernali o catene a bordo. Prenota il '
      || 'cambio dall''app.',
    '/garage/veicolo?targa=FX482RN', null, true,
    greatest(pg_temp.ora(make_date(extract(year from public.oggi_in_italia())::int, 10, 15), '09:00'),
             now() - interval '20 days'),
    'CAMBIO_STAGIONE:INVERNALE:' || extract(year from public.oggi_in_italia()) || ':FX482RN'
  union all
  -- Esito dell'ultimo controllo della Panda (gomme gialle)
  select 'ESITO_CONTROLLO', 'Gomme da tenere d''occhio',
    'La Santi Gomme ha controllato ' || public.testo_veicolo('FF913LB', 'Fiat', 'Panda')
      || ': 2 gomme sotto la soglia consigliata. Apri il report per i dettagli.',
    '/controllo?id=' || pg_temp.cid(16), null, false, pg_temp.ora(pg_temp.g(-2), '11:05'),
    'ESITO_CONTROLLO:' || pg_temp.cid(16)
) as n;

-- A chi lavora nell'officina
insert into public.notifiche (destinatario_id, tipo, titolo, testo, link, prenotazione_id, letta_il,
  created_at)
select u.profile_id, n.tipo::public.tipo_notifica, n.titolo, n.testo, n.link, n.pren,
  case when n.letta then n.creata + interval '40 minutes' end, n.creata
from (
  -- Nuove richieste: le tre da confermare (non lette) e quelle già gestite (lette)
  select 'NUOVA_RICHIESTA' as tipo, 'Nuova richiesta di appuntamento' as titolo,
    v.nome_cliente || ' · ' || v.servizio || ' · '
      || public.testo_quando(v.giorno, v.fascia, null) as testo,
    '/appuntamento?id=' || v.id as link, v.id as pren, v.stato <> 'RICHIESTA' as letta,
    v.created_at as creata
  from demo_pv v where v.created_at > now() - interval '30 days'
  union all
  -- Bonomi aveva accettato l'orario proposto
  select 'PROPOSTA_ACCETTATA', 'Orario accettato',
    v.nome_cliente || ' · ' || v.servizio || ' · ' || v.quando,
    '/appuntamento?id=' || v.id, v.id, true, v.created_at + interval '6 hours'
  from demo_pv v where v.id = pg_temp.pren(20)
  union all
  -- Il cliente vero aveva annullato la convergenza della Panda
  select 'ANNULLATA', 'Appuntamento annullato',
    v.nome_cliente || ' · ' || v.servizio || ' · ' || v.quando,
    '/appuntamento?id=' || v.id, v.id, true, pg_temp.ora(v.giorno - 2, '20:15')
  from demo_pv v where v.id = pg_temp.pren(2)
  union all
  select 'STRADA_RICHIESTA', 'Richiesta di aiuto su strada',
    'Un automobilista fermo a 6 km da La Santi Gomme chiede aiuto per una gomma. Apri la pagina per i '
      || 'dettagli.',
    '/officina/strada', null, true, now() - interval '7 days'
) as n
cross join demo_id d
join public.officina_utenti u on u.officina_id = d.officina;

-- -----------------------------------------------------------------------------------------------------
-- 11. Trigger di nuovo accesi e riepilogo
-- -----------------------------------------------------------------------------------------------------
alter table public.prenotazioni enable trigger prenotazioni_notifica;
alter table public.controlli enable trigger controlli_notifica_esito;
alter table public.notifiche enable trigger notifiche_push;

select 'officina' as cosa, ragione_sociale || ' · ' || indirizzo || ', ' || citta as valore
from public.officine where id = (select officina from demo_id)
union all select 'servizi', count(*)::text from public.servizi_officina where officina_id = (select officina from demo_id)
union all select 'clienti', count(*)::text from public.clienti_officina where officina_id = (select officina from demo_id)
union all select 'veicoli', count(*)::text from public.veicoli where officina_id = (select officina from demo_id)
union all select 'controlli', count(*)::text from public.controlli where officina_id = (select officina from demo_id)
union all select 'appuntamenti', count(*)::text from public.prenotazioni where officina_id = (select officina from demo_id)
union all select 'notifiche officina', count(*)::text from public.notifiche where destinatario_id = (select titolare from demo_id)
union all select 'notifiche cliente', count(*)::text from public.notifiche where destinatario_id = (select cliente from demo_id);

commit;
