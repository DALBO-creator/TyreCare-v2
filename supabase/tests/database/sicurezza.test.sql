-- Sicurezza (lancio): permessi minimi, 2FA dell'amministratore e degli utenti, percorsi IDOR.
-- Richiede i dati di seed.sql. Eseguire con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- Simula una richiesta dal client: utente (null = anonimo) e livello della sessione (aal1/aal2).
create function pg_temp.come(p_utente uuid, p_aal text default 'aal1') returns void
language plpgsql as $$
begin
  if p_utente is null then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', p_aal)::text,
      true
    );
  end if;
end;
$$;

\set admin '\'a0000000-0000-4000-8000-000000000001\''
\set titolare '\'a0000000-0000-4000-8000-000000000002\''
\set operatore '\'a0000000-0000-4000-8000-000000000003\''
\set cliente '\'a0000000-0000-4000-8000-000000000004\''
\set officina '\'b0000000-0000-4000-8000-000000000001\''
\set altra '\'b0000000-0000-4000-8000-000000000002\''

-- ---------------------------------------------------------------- struttura (come i database advisors)
select is_empty(
  $$select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity$$,
  'ogni tabella di public ha la RLS attiva'
);
select is_empty(
  $$select p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and not coalesce('search_path=""' = any (p.proconfig), false)$$,
  'ogni funzione security definer ha search_path vuoto'
);
select is_empty(
  $$select p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not coalesce(p.proconfig::text, '') like '%search_path=%'$$,
  'ogni funzione ha un search_path fissato'
);
select is_empty(
  $$select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
      and not coalesce(c.reloptions::text, '') like '%security_invoker=true%'$$,
  'nessuna vista senza security_invoker'
);
select set_eq(
  $$select table_name::text || ':' || privilege_type::text from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'$$,
  $$values ('officine:SELECT'), ('servizi_officina:SELECT'), ('chiusure_officina:SELECT')$$,
  'anon: solo lettura delle tre tabelle pubbliche'
);
select is_empty(
  $$select table_name from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')$$,
  'nessun TRUNCATE / REFERENCES / TRIGGER ai ruoli dell''app'
);
select set_eq(
  $$select p.proname::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
      and p.prosecdef$$,
  $$values ('fasce_piene'), ('info_invito'), ('report_pubblico'), ('controlla_richiesta')$$,
  'anon: solo le funzioni security definer pubbliche previste'
);
select is_empty(
  $$select p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prorettype = 'pg_catalog.trigger'::regtype
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'))$$,
  'le funzioni dei trigger non si chiamano dall''API'
);
select is_empty(
  $$select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
      and exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polpermissive)
      and not exists (
        select 1 from pg_policy p
        where p.polrelid = c.oid and not p.polpermissive and p.polname = '2fa: sessione al secondo livello'
      )$$,
  'ogni tabella con policy ha anche quella restrittiva della 2FA'
);

-- ---------------------------------------------------------------- anonimo
select pg_temp.come(null);
select throws_ok('select * from public.profiles', '42501', null, 'anonimo: profili negati');
select throws_ok('select * from public.clienti_officina', '42501', null, 'anonimo: clienti negati');
select throws_ok('select * from public.veicoli', '42501', null, 'anonimo: veicoli negati');
select throws_ok('select * from public.link_report', '42501', null, 'anonimo: link dei report negati');
select throws_ok(
  $$insert into public.errori_app (messaggio) values ('x')$$, '42501', null,
  'anonimo: non scrive errori'
);
select throws_ok('select public.is_admin()', '42501', null, 'anonimo: is_admin non si chiama');
select is(public.report_pubblico('codice-inventato'), null, 'report pubblico: codice sbagliato, nessun dato');
select is(public.report_pubblico(''), null, 'report pubblico: codice vuoto, nessun dato');

-- ---------------------------------------------------------------- is_admin e aal
reset role;
select pg_temp.come(:admin, 'aal1');
select is(public.is_admin(), false, 'admin con aal1: is_admin falso');
select is(
  (select count(*) from public.officine)::int, 1,
  'admin con aal1: vede le officine come un utente qualsiasi'
);
select is_empty('select * from public.errori_app', 'admin con aal1: non legge gli errori');
select throws_ok(
  format('select public.attiva_officina(%L)', :altra::text), '42501', null,
  'admin con aal1: non attiva le officine'
);
select is_empty(
  format($$update public.profiles set ruolo = 'ADMIN' where id = %L returning id$$, :cliente::text),
  'admin con aal1: non promuove nessuno'
);
reset role;
select pg_temp.come(:admin, 'aal2');
select is(public.is_admin(), true, 'admin con aal2: is_admin vero');
select is((select count(*) from public.officine)::int, 2, 'admin con aal2: vede tutte le officine');
reset role;
select pg_temp.come(:cliente, 'aal2');
select is(public.is_admin(), false, 'cliente con aal2: non è admin');

-- ---------------------------------------------------------------- 2FA attiva: serve aal2
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), :titolare, 'test', 'totp', 'verified', now(), now(), 'segreto');

select pg_temp.come(:titolare, 'aal1');
select is(public.mfa_soddisfatta(), false, '2FA attiva e aal1: non soddisfatta');
select is_empty('select * from public.clienti_officina', '2FA attiva e aal1: nessun cliente');
select is_empty('select * from public.profiles', '2FA attiva e aal1: nessun profilo');
select is_empty('select * from public.notifiche', '2FA attiva e aal1: nessuna notifica');
select throws_ok('select public.controlla_richiesta()', '42501', 'MFA_RICHIESTA', '2FA attiva e aal1: API rifiutata');
reset role;
select pg_temp.come(:titolare, 'aal2');
select isnt_empty('select * from public.clienti_officina', '2FA attiva e aal2: clienti visibili');
select lives_ok('select public.controlla_richiesta()', '2FA attiva e aal2: API permessa');
reset role;
select pg_temp.come(:operatore, 'aal1');
select lives_ok('select public.controlla_richiesta()', 'senza 2FA: API permessa con aal1');
select isnt_empty('select * from public.clienti_officina', 'senza 2FA: clienti visibili con aal1');

-- ---------------------------------------------------------------- membri dell'officina
reset role;
select pg_temp.come(:titolare, 'aal2');
select throws_ok(
  format(
    $$insert into public.officina_utenti (officina_id, profile_id, ruolo) values (%L, %L, 'OPERATORE')$$,
    :officina::text, :cliente::text
  ),
  '42501', null,
  'titolare: non aggiunge un utente qualsiasi alla propria officina'
);
select throws_ok(
  format(
    $$update public.officina_utenti set profile_id = %L where profile_id = %L$$,
    :cliente::text, :operatore::text
  ),
  '42501', null,
  'titolare: non sostituisce un membro con un altro utente'
);
select is_empty(
  format('select * from public.profiles where id = %L', :cliente::text),
  'titolare: non legge il profilo di un cliente'
);

-- ---------------------------------------------------------------- IDOR tra officine e tra clienti
select is_empty(
  format('select * from public.clienti_officina where officina_id = %L', :altra::text),
  'titolare: non legge i clienti di un''altra officina'
);
select throws_ok(
  format(
    $$insert into public.clienti_officina (officina_id, nome, cognome) values (%L, 'X', 'Y')$$,
    :altra::text
  ),
  '42501', null,
  'titolare: non scrive clienti in un''altra officina'
);

-- ---------------------------------------------------------------- endpoint push
reset role;
select pg_temp.come(:cliente, 'aal1');
select throws_ok(
  $$select public.iscrivi_push('https://attaccante.example/raccogli', 'chiave', 'auth')$$,
  '23514', null,
  'push: endpoint di un servizio sconosciuto rifiutato'
);
select lives_ok(
  $$select public.iscrivi_push('https://fcm.googleapis.com/fcm/send/abc123', 'chiave', 'auth')$$,
  'push: endpoint di un servizio conosciuto accettato'
);

select * from finish();
rollback;
