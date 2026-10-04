\pset tuples_only on
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','james@caliaircrew.com'),('00000000-0000-0000-0000-00000000000b','owner@example.com');
insert into public.admins values ('00000000-0000-0000-0000-00000000000a');
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claims', '{"aal":"aal1"}', false); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
\echo '1 owner creates operator profile (about stripped, kind school ok)'
insert into public.operator_profiles (user_id,published,name,kind,about,details) values ('00000000-0000-0000-0000-00000000000b',true,'Coastal Jets','charter','Fly with us','{"region":"socal","looking":["pic","sic"]}');
insert into public.operator_about_pending (about) values ('Fly with us');
insert into public.operator_aircraft (acft_seq,how_many) values (51,2);
select 'public about=[' || about || '] details region=' || (details->>'region') from public.operator_profiles;
\echo '2 owner tries to approve self'
select public.admin_moderate_operator('00000000-0000-0000-0000-00000000000b',true,false,'',true);
reset role; select pg_temp.as_user(''); set role anon;
\echo '3 anonymous before approval: operators visible / aircraft rows'
select count(*) from public.operator_profiles; select count(*) from public.operator_aircraft;
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
\echo '4 admin approves operator + text; crew approval untouched'
select public.admin_moderate_operator('00000000-0000-0000-0000-00000000000b',true,false,'',true);
select 'op_approved=' || op_approved || ' crew approved=' || approved from public.moderation;
reset role; select pg_temp.as_user(''); set role anon;
\echo '5 anonymous after approval'
select name || ' about=' || about from public.operator_profiles; select acft_seq || ' x' || how_many from public.operator_aircraft; select acft_seq || ': ' || operators || ' operator(s)' from public.aircraft_operator_counts;
\echo '6 crew profile of same user is NOT listed by operator approval'
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
insert into public.crew_profiles (user_id,published,display_name) values ('00000000-0000-0000-0000-00000000000b',true,'Owner Pilot');
reset role; select pg_temp.as_user(''); set role anon;
select 'anon crew rows: ' || count(*) from public.crew_profiles;
reset role;
select string_agg(action, ', ' order by id) from public.admin_audit;
