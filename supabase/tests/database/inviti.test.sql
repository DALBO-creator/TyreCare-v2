-- Test degli inviti del cliente (migrazione "inviti_cliente"). Richiede i dati di seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- Simula una richiesta dal client con il JWT dell'utente indicato (null = anonimo).
create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  if p_utente is null then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_utente, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

-- Crea un invito come l'utente indicato e salva il codice nella variabile `test.<nome>`.
create function pg_temp.invita(p_utente uuid, p_cliente uuid, p_email text, p_nome text)
returns text language plpgsql as $$
declare
  v_codice text;
begin
  perform pg_temp.come(p_utente);
  select codice into v_codice from public.crea_invito_cliente(p_cliente, p_email);
  perform set_config('test.' || p_nome, v_codice, false);
  return v_codice;
end;
$$;

-- Account di Franco Gialli (cliente C0002 di Gomme Rossi, non collegato), un account con un'altra email
-- e uno con l'email giusta ma non confermata. Un cliente in più per l'invito scaduto.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f1',
   'authenticated', 'authenticated', 'Franco.Gialli@tyrecare.test', now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f2',
   'authenticated', 'authenticated', 'altro@tyrecare.test', now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f3',
   'authenticated', 'authenticated', 'FRANCO.GIALLI@TYRECARE.TEST', null);
insert into public.clienti_officina (id, officina_id, nome, cognome) values
  ('c0000000-0000-4000-8000-0000000000f9', 'b0000000-0000-4000-8000-000000000001', 'Sara', 'Blu');

-- ---------------------------------------------------------------- chi può invitare
select matches(
  pg_temp.invita('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
    '  Franco.Gialli@TyreCare.test ', 'primo'),
  '^[0-9a-f]{32}$',
  'titolare: crea un invito, il codice è di 32 caratteri esadecimali'
);
select is(
  (select email from public.inviti_cliente where cliente_officina_id = 'c0000000-0000-4000-8000-000000000002'),
  'franco.gialli@tyrecare.test',
  'l''email è salvata pulita e in minuscolo'
);
select isnt(
  (select codice_hash from public.inviti_cliente limit 1), convert_to(current_setting('test.primo'), 'UTF8'),
  'il codice non è salvato in chiaro'
);
select lives_ok(
  $$select pg_temp.invita('a0000000-0000-4000-8000-000000000003',
      'c0000000-0000-4000-8000-000000000002', 'franco.gialli@tyrecare.test', 'secondo')$$,
  'operatore: crea un invito (nuovo invito per lo stesso cliente)'
);
select results_eq(
  $$select count(*) filter (where annullato_il is not null)::int, count(*)::int
    from public.inviti_cliente where cliente_officina_id = 'c0000000-0000-4000-8000-000000000002'$$,
  $$values (1, 2)$$,
  'il nuovo invito annulla il precedente'
);
select throws_ok(
  $$select * from public.crea_invito_cliente('c0000000-0000-4000-8000-000000000001', 'giulia@x.it')$$,
  'P0001', 'CLIENTE_GIA_COLLEGATO',
  'non si invita un cliente già collegato'
);
select throws_ok(
  $$select * from public.crea_invito_cliente('c0000000-0000-4000-8000-000000000002', 'non-una-email')$$,
  'P0001', 'EMAIL_NON_VALIDA',
  'email non valida'
);
select throws_ok(
  $$insert into public.inviti_cliente (officina_id, cliente_officina_id, email, codice_hash, scade_il)
    values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
            'x@y.it', '\x00', now() + interval '1 day')$$,
  '42501', null,
  'membro: non scrive direttamente nella tabella degli inviti'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000005');
select throws_ok(
  $$select * from public.crea_invito_cliente('c0000000-0000-4000-8000-000000000002', 'a@b.it')$$,
  '42501', null,
  'titolare di un''altra officina: non invita i clienti di Gomme Rossi'
);
select is_empty('select * from public.inviti_cliente', 'altra officina: non vede gli inviti');

select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select throws_ok(
  $$select * from public.crea_invito_cliente('c0000000-0000-4000-8000-000000000002', 'a@b.it')$$,
  '42501', null,
  'cliente: non crea inviti'
);
select is_empty('select * from public.inviti_cliente', 'cliente: non vede gli inviti');

-- ---------------------------------------------------------------- pagina dell'invito
select pg_temp.come(null);
select results_eq(
  format('select officina, email, stato from public.info_invito(%L)', current_setting('test.secondo')),
  $$values ('Gomme Rossi S.n.c.', 'franco.gialli@tyrecare.test', 'VALIDO')$$,
  'anonimo: legge officina, email e stato dell''invito dal codice'
);
select is(
  (select stato from public.info_invito(current_setting('test.primo'))), 'ANNULLATO',
  'il primo invito risulta annullato'
);
select is_empty(
  $$select * from public.info_invito('00000000000000000000000000000000')$$,
  'codice inesistente: nessuna informazione'
);
select throws_ok(
  format('select public.accetta_invito(%L)', current_setting('test.secondo')),
  '42501', null,
  'anonimo: non può accettare'
);

-- ---------------------------------------------------------------- accettare
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select throws_ok(
  format('select public.accetta_invito(%L)', current_setting('test.secondo')),
  'P0001', 'EMAIL_DIVERSA',
  'account con un''altra email: non accetta'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f3');
select throws_ok(
  format('select public.accetta_invito(%L)', current_setting('test.secondo')),
  'P0001', 'EMAIL_DIVERSA',
  'account con l''email dell''invito ma non confermata: non accetta'
);

select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select throws_ok(
  format('select public.accetta_invito(%L)', current_setting('test.primo')),
  'P0001', 'INVITO_ANNULLATO',
  'invito annullato: non si accetta'
);
select throws_ok(
  $$select public.accetta_invito('00000000000000000000000000000000')$$,
  'P0001', 'INVITO_NON_VALIDO',
  'codice inesistente: non si accetta'
);
select is_empty('select * from public.veicoli', 'Franco prima di accettare: nessun veicolo');
select is(
  public.accetta_invito(current_setting('test.secondo')), 'Gomme Rossi S.n.c.',
  'Franco (email con maiuscole diverse): accetta e riceve il nome dell''officina'
);
select results_eq(
  'select targa from public.veicoli',
  $$values ('EF456GH')$$,
  'Franco dopo aver accettato: vede la sua Golf nel garage'
);
select is(
  public.accetta_invito(current_setting('test.secondo')), 'Gomme Rossi S.n.c.',
  'accettare di nuovo lo stesso invito non è un errore'
);
select results_eq(
  format('select stato, usato_da_te from public.info_invito(%L)', current_setting('test.secondo')),
  $$values ('USATO', true)$$,
  'dopo: l''invito risulta usato da Franco'
);

-- ---------------------------------------------------------------- scaduto e annullato a mano
select pg_temp.invita('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-0000000000f9',
  'altro@tyrecare.test', 'terzo');
reset role;
update public.inviti_cliente set scade_il = now() - interval '1 minute'
  where cliente_officina_id = 'c0000000-0000-4000-8000-0000000000f9';
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select throws_ok(
  format('select public.accetta_invito(%L)', current_setting('test.terzo')),
  'P0001', 'INVITO_SCADUTO',
  'invito scaduto: non si accetta'
);

select pg_temp.invita('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-0000000000f9',
  'altro@tyrecare.test', 'quarto');
select public.annulla_invito_cliente('c0000000-0000-4000-8000-0000000000f9');
select is(
  (select stato from public.info_invito(current_setting('test.quarto'))), 'ANNULLATO',
  'titolare: annulla l''invito in corso'
);

select * from finish();
rollback;
