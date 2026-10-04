\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email, last_sign_in_at) values
 ('00000000-0000-0000-0000-00000000000a','james@caliaircrew.com', now()),
 ('00000000-0000-0000-0000-00000000000b','pilot@example.com', now()),
 ('00000000-0000-0000-0000-00000000000c','other@example.com', null);
insert into public.admins values ('00000000-0000-0000-0000-00000000000a');
insert into auth.mfa_factors (user_id, status) values ('00000000-0000-0000-0000-00000000000b','verified');
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claims', '{"aal":"aal2"}', false); end $$;
-- ===== pilot B (not admin)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
\echo '1 pilot calls admin_users (expect: Admins only)'
select count(*) from public.admin_users();
\echo '2 pilot creates profile with text (expect public text empty)'
insert into public.crew_profiles (user_id, published, display_name, bio) values ('00000000-0000-0000-0000-00000000000b', true, 'Pilot B', 'Hello owners');
insert into public.crew_bio_pending (bio) values ('Hello owners');
select 'public bio=[' || bio || ']' from public.crew_profiles where user_id='00000000-0000-0000-0000-00000000000b';
\echo '3 pilot tries to approve himself (expect: Admins only / RLS)'
select public.admin_moderate('00000000-0000-0000-0000-00000000000b', true, false, true, '', true);
insert into public.moderation (user_id, approved) values ('00000000-0000-0000-0000-00000000000b', true);
\echo '4 pilot logs a search, reads banner, cannot read search log'
insert into public.search_log (acft_seq, region, results) values (51, 'socal', 0);
select 'banner on=' || (value->>'on') from public.site_settings where key='banner';
select 'search rows visible to pilot: ' || count(*) from public.search_log;
\echo '5 pilot requests an aircraft'
insert into public.aircraft_requests (request) values ('Pilatus PC-24 with 2024 avionics');
reset role;
-- ===== anonymous visitor
select pg_temp.as_user(''); set role anon;
\echo '6 anonymous: pending text hidden, profile not listed yet, search insert ok'
select 'anon pending rows: ' || count(*) from public.crew_bio_pending;
select 'anon sees profiles: ' || count(*) from public.crew_profiles;
insert into public.search_log (acft_seq, region, results) values (58, '', 3);
reset role;
-- ===== admin James
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
\echo '7 admin users list'
select email || ' admin=' || is_admin || ' mfa=' || has_mfa || ' profile=' || has_profile from public.admin_users();
\echo '8 admin approves profile + text, verifies FAA'
select public.admin_moderate('00000000-0000-0000-0000-00000000000b', true, false, true, 'Checked FAA registry', true);
select 'public bio now=[' || bio || ']' from public.crew_profiles where user_id='00000000-0000-0000-0000-00000000000b';
\echo '9 metrics + search stats'
select (m->>'users_total') || ' users, ' || (m->>'searches_7d') || ' searches, pending text ' || (m->>'pending_text') || ', db bytes>0 ' || ((m->>'db_bytes')::bigint > 0) from public.admin_metrics() m;
select public.admin_search_stats(30)->'zero_results';
\echo '10 banner + partner'
select public.admin_set_banner(true, 'Directory now open in Arizona!', 'info');
insert into public.partners (name, category, url) values ('Example Insurance', 'insurance', 'https://example.com'), ('Old Partner', 'training', '');
update public.partners set ends_on = current_date - 1 where name = 'Old Partner';
\echo '11 remove authenticator for pilot (lost phone)'
select 'factors removed: ' || public.admin_remove_mfa('00000000-0000-0000-0000-00000000000b');
\echo '12 cannot remove last admin; cannot delete admin; wrong email blocked'
select public.admin_set_admin('00000000-0000-0000-0000-00000000000a', false);
select public.admin_delete_user('00000000-0000-0000-0000-00000000000a', 'james@caliaircrew.com');
select public.admin_delete_user('00000000-0000-0000-0000-00000000000b', 'wrong@example.com');
\echo '13 admin sees aircraft request'
select 'requests: ' || string_agg(request, '; ') from public.aircraft_requests;
reset role;
-- ===== pilot edits text after approval
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
\echo '14 pilot changes text directly (expect public text unchanged)'
update public.crew_profiles set bio = 'Call me at 555-1212' where user_id='00000000-0000-0000-0000-00000000000b';
select 'public bio still=[' || bio || ']' from public.crew_profiles where user_id='00000000-0000-0000-0000-00000000000b';
reset role;
select pg_temp.as_user(''); set role anon;
\echo '15 anonymous now sees listed profile; partners shows only current'
select 'anon sees profiles: ' || count(*) from public.crew_profiles;
select 'partners visible: ' || string_agg(name, ', ') from public.partners;
select 'banner: ' || (value->>'text') from public.site_settings;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
\echo '16 delete pilot with the right email; audit log'
select public.admin_delete_user('00000000-0000-0000-0000-00000000000b', 'PILOT@example.com');
select 'profiles left: ' || count(*) from public.crew_profiles;
select string_agg(action || '→' || target_email, ' | ' order by id) from public.admin_audit;
reset role;
