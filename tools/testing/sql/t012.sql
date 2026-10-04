\pset tuples_only on
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
set role authenticated;
\echo 'member reads codes (expect denied)'
select count(*) from public.recovery_codes;
\echo 'member calls lookup (expect denied)'
select * from public.recovery_lookup('james@caliaircrew.com');
reset role; set role anon;
\echo 'anonymous calls lookup (expect denied)'
select * from public.recovery_lookup('james@caliaircrew.com');
reset role; set role service_role;
\echo 'service role (Edge Function) lookup works'
select sign_in_email || ' backup=[' || backup_email || ']' from public.recovery_lookup('JAMES@caliaircrew.com');
