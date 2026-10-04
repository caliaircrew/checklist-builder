\pset tuples_only on
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false); set role authenticated;
\echo '1 operator C saves a favorite and a search'
insert into public.favorites(crew_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;
insert into public.saved_searches(name, filters) values ('Test', '{"seq":58}');
select count(*) from public.favorites; select name from public.saved_searches;
reset role; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false); set role authenticated;
\echo '2 D cannot see C''s favorites or searches'
select count(*) from public.favorites; select count(*) from public.saved_searches;
reset role; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false); set role authenticated;
\echo '3 limit of 10'
insert into public.saved_searches(name) select 'x'||g from generate_series(1,9) g;
insert into public.saved_searches(name) values ('eleventh');
reset role; set role service_role;
\echo '4 service role sees owners'
select count(*) from public.search_alert_owners();
reset role; delete from public.saved_searches; delete from public.favorites;
