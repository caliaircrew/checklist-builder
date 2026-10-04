\pset tuples_only on
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claims', '{"aal":"aal1"}', false); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); set role authenticated;
\echo '1 pilot C saves own private details'
insert into public.crew_private (legal_first, legal_last, faa_city, faa_state) values ('Charles','Captain','Carlsbad','CA');
select legal_first || ' ' || legal_last from public.crew_private;
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); set role authenticated;
\echo '2 another pilot reads it (expect 0) and cannot write it'
select count(*) from public.crew_private;
update public.crew_private set legal_last='Hacked'; 
reset role; select pg_temp.as_user(''); set role anon;
\echo '3 anonymous (expect permission denied)'
select count(*) from public.crew_private;
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
\echo '4 admin reads it'
select legal_first || ' ' || legal_last || ', ' || faa_city || ' ' || faa_state from public.crew_private;
