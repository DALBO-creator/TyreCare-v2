-- Test delle iscrizioni alle notifiche push (migrazione "notifiche_push"). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

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
      json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', 'aal2')::text,
      true
    );
  end if;
end;
$$;

-- Giulia (cliente) iscrive il suo telefono
select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select lives_ok(
  $$select public.iscrivi_push('https://push.example/giulia', 'chiave', 'auth')$$,
  'cliente: iscrive il suo dispositivo'
);
select lives_ok(
  $$select public.iscrivi_push('https://push.example/giulia', 'chiave2', 'auth2')$$,
  'cliente: iscriversi di nuovo sostituisce l''iscrizione'
);
select is((select count(*)::int from public.iscrizioni_push), 1, 'cliente: una sola iscrizione');
select throws_ok(
  $$insert into public.iscrizioni_push (profile_id, endpoint, p256dh, auth)
    values ('a0000000-0000-4000-8000-000000000002', 'https://push.example/x', 'k', 'a')$$,
  '42501', null,
  'cliente: non iscrive dispositivi per altri'
);

-- Lo stesso browser con un altro account (Luca): l'iscrizione passa a lui
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.iscrizioni_push), 0, 'operatore: non vede quelle altrui');
select public.iscrivi_push('https://push.example/giulia', 'chiave3', 'auth3');
reset role;
select is(
  (select profile_id from public.iscrizioni_push where endpoint = 'https://push.example/giulia'),
  'a0000000-0000-4000-8000-000000000003'::uuid,
  'stesso browser, altro account: l''iscrizione è del nuovo account'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000003');
delete from public.iscrizioni_push;
reset role;
select is((select count(*)::int from public.iscrizioni_push), 0, 'operatore: elimina la sua iscrizione');

select pg_temp.come(null);
select throws_ok(
  $$select public.iscrivi_push('https://push.example/anon', 'k', 'a')$$,
  '42501', null,
  'anonimo: non si iscrive'
);

select * from finish();
rollback;
