-- Test del link pubblico del report di un controllo (migrazione "link_report"). Richiede i dati di
-- seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

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

-- Il controllo della Panda di Gomme Rossi (la Panda di Pneus Express non ha controlli nel seed) e i
-- codici creati, conservati tra un ruolo e l'altro.
create temp table dati (nome text primary key, valore text);
grant all on table dati to authenticated, anon;
insert into dati
select 'controllo', c.id::text
from public.controlli c
join public.veicoli v on v.id = c.veicolo_id
where v.targa = 'AB123CD' and c.officina_id = 'b0000000-0000-4000-8000-000000000001'
order by c.eseguito_il desc, c.id
limit 1;

create function pg_temp.controllo() returns uuid language sql as $$
  select valore::uuid from dati where nome = 'controllo';
$$;
create function pg_temp.codice(p_nome text) returns text language sql as $$
  select valore from dati where nome = p_nome;
$$;

-- ---------------------------------------------------------------- chi può creare un link
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
insert into dati values ('primo', public.crea_link_report(pg_temp.controllo()));
select matches(pg_temp.codice('primo'), '^[0-9a-f]{32}$',
  'operatore: crea un link, il codice è di 32 caratteri esadecimali');
select is(
  (select count(*)::int from public.link_report
   where controllo_id = pg_temp.controllo() and scade_il between now() + interval '29 days 23 hours'
     and now() + interval '30 days 1 hour'),
  1,
  'il link scade dopo 30 giorni'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select throws_ok(
  format('select public.crea_link_report(%L)', pg_temp.controllo()),
  '42501', null, 'cliente: non può creare un link'
);
select throws_ok(
  format('select public.revoca_link_report(%L)', pg_temp.controllo()),
  '42501', null, 'cliente: non può disattivare i link'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000005');
select throws_ok(
  format('select public.crea_link_report(%L)', pg_temp.controllo()),
  '42501', null, 'titolare di un''altra officina: non può creare un link'
);
select throws_ok(
  format('select public.revoca_link_report(%L)', pg_temp.controllo()),
  '42501', null, 'titolare di un''altra officina: non può disattivare i link'
);
select throws_ok(
  $$select public.crea_link_report('f0000000-0000-4000-8000-0000000000ff')$$,
  '42501', null, 'controllo inesistente: stesso errore, non si rivela se esiste'
);

-- ---------------------------------------------------------------- chi apre il link
select pg_temp.come(null);
select is(
  public.report_pubblico(pg_temp.codice('primo'))->'veicolo'->>'targa', 'AB123CD',
  'anon con il codice: legge il report del controllo'
);
select ok(
  not (public.report_pubblico(pg_temp.codice('primo')) ? 'cliente')
    and not (public.report_pubblico(pg_temp.codice('primo'))->'veicolo' ? 'cliente_officina_id'),
  'il report non contiene dati del cliente'
);
select ok(
  public.report_pubblico(repeat('0', 32)) is null and public.report_pubblico('') is null
    and public.report_pubblico(null) is null,
  'codice sbagliato, vuoto o nullo: null'
);
select throws_ok(
  $$select * from public.link_report$$, '42501', null, 'anon: non legge la tabella link_report'
);

-- ---------------------------------------------------------------- scadenza e disattivazione
-- Link scaduto: la scadenza si sposta come postgres (nessuno può scrivere la tabella dall'app).
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
insert into dati values ('scaduto', public.crea_link_report(pg_temp.controllo()));
reset role;
update public.link_report set scade_il = now() - interval '1 minute'
where codice_hash = public.impronta_codice(pg_temp.codice('scaduto'));
select pg_temp.come(null);
select is(public.report_pubblico(pg_temp.codice('scaduto')), null, 'link scaduto: null');

select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select public.revoca_link_report(pg_temp.controllo());
select pg_temp.come(null);
select is(public.report_pubblico(pg_temp.codice('primo')), null, 'dopo revoca_link_report: null');

-- ---------------------------------------------------------------- lettura dei link
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select results_eq(
  $$select count(*)::int, count(revocato_il)::int from public.link_report
    where controllo_id = pg_temp.controllo()$$,
  $$values (2, 1)$$,
  'titolare: legge i link della sua officina (quello scaduto non viene revocato)'
);

-- Caso negato (T083): un'officina non vede i link di un'altra, anche se nella tabella ce ne sono.
select pg_temp.come('a0000000-0000-4000-8000-000000000005');
select is(
  (select count(*) from public.link_report
   where officina_id = 'b0000000-0000-4000-8000-000000000001')::int,
  0,
  'titolare di un''altra officina: non legge i link di Gomme Rossi'
);

-- ---------------------------------------------------------------- officina sospesa (T083, R12)
reset role;
select ok(
  has_function_privilege('anon', 'public.report_pubblico(text)', 'execute'),
  'anon: può ancora eseguire report_pubblico'
);

-- Un codice nuovo e valido: 'primo' è stato disattivato più in alto.
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
insert into dati values ('sospesa', public.crea_link_report(pg_temp.controllo()));

select pg_temp.come('a0000000-0000-4000-8000-000000000001');
update public.officine set stato_affiliazione = 'SOSPESA'
where id = 'b0000000-0000-4000-8000-000000000001';
select is(
  (select stato_affiliazione::text from public.officine
   where id = 'b0000000-0000-4000-8000-000000000001'),
  'SOSPESA',
  'admin: Gomme Rossi è sospesa'
);
select pg_temp.come(null);
select is(
  public.report_pubblico(pg_temp.codice('sospesa')), null,
  'officina SOSPESA: il link valido non mostra il report'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000001');
update public.officine set stato_affiliazione = 'IN_ATTESA'
where id = 'b0000000-0000-4000-8000-000000000001';
select is(
  (select stato_affiliazione::text from public.officine
   where id = 'b0000000-0000-4000-8000-000000000001'),
  'IN_ATTESA',
  'admin: Gomme Rossi è in attesa'
);
select pg_temp.come(null);
select is(
  public.report_pubblico(pg_temp.codice('sospesa'))->'veicolo'->>'targa', 'AB123CD',
  'officina IN_ATTESA: il report si legge (R12)'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000001');
update public.officine set stato_affiliazione = 'ATTIVA'
where id = 'b0000000-0000-4000-8000-000000000001';
select is(
  (select stato_affiliazione::text from public.officine
   where id = 'b0000000-0000-4000-8000-000000000001'),
  'ATTIVA',
  'admin: Gomme Rossi è di nuovo attiva'
);
select pg_temp.come(null);
select is(
  public.report_pubblico(pg_temp.codice('sospesa'))->'veicolo'->>'targa', 'AB123CD',
  'officina di nuovo ATTIVA: il report torna'
);

select * from finish();
rollback;
