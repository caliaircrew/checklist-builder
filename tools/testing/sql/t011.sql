\pset tuples_only on
insert into auth.users (id,email) values ('00000000-0000-0000-0000-0000000000e1','leaver@example.com') on conflict do nothing;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claims', '{"aal":"aal1"}', false); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d'||''); 
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); set role authenticated;
\echo '1 pilot saves recovery, tries to mark it confirmed'
insert into public.account_recovery (backup_email, phone, backup_confirmed) values ('diane.backup@example.com','760-555-0101', true);
update public.account_recovery set backup_confirmed = true;
select backup_email || ' confirmed=' || backup_confirmed from public.account_recovery;
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); set role authenticated;
\echo '2 another pilot reads it (expect 0)'
select count(*) from public.account_recovery;
reset role; select pg_temp.as_user(''); set role anon;
\echo '3 anonymous asks for help; cannot read requests'
insert into public.help_requests (email, message) values ('lost@example.com', 'Lost my phone and my old email');
select count(*) from public.help_requests;
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
\echo '4 admin reads recovery + help'
select backup_email from public.account_recovery; select email || ': ' || message from public.help_requests;
\echo '5 admin cannot self-delete'
select public.delete_my_account('james@caliaircrew.com');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1'); set role authenticated;
\echo '6 member: wrong email blocked, right email deletes'
select public.delete_my_account('nope@example.com');
select public.delete_my_account('LEAVER@example.com');
reset role;
select 'leaver remains: ' || count(*) from auth.users where email='leaver@example.com';
select 'audit: ' || action || ' ' || target_email from public.admin_audit where action='self_delete';
