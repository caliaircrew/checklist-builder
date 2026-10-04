-- 017 contact_requests permissions. Users: James ...0a (admin), Charlie ...0c, Dana ...0d.
\pset tuples_only on
\set ON_ERROR_STOP off
set role service_role;
delete from public.contact_requests;
insert into public.contact_requests (sender_id, recipient_id, seq, sender_label, note, report_hash) values
 ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000d', 58, 'Charlie Ops', 'CJ3 trip Oct 12', 'h1'),
 ('00000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-00000000000a', null, 'Dana', 'Need a CFI', 'h2');
select 'service inserted: '||count(*) from public.contact_requests;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false); set role authenticated;
select 'Charlie sees (expect 1, his sent): '||count(*) from public.contact_requests;
select 'Charlie reads report_hash (expect permission denied):' ; select report_hash from public.contact_requests;
select 'Charlie inserts (expect permission denied):'; insert into public.contact_requests (sender_id, recipient_id, note) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000a','x');
select 'Charlie updates status (expect 0 rows):'; update public.contact_requests set status='cleared' returning id;
select 'Charlie deletes (expect permission denied):'; delete from public.contact_requests;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false); set role authenticated;
select 'Dana sees (expect 2, one sent one received): '||count(*) from public.contact_requests;
select 'Dana edits note (expect permission denied):'; update public.contact_requests set note='changed';
insert into public.member_settings (contact_requests) values (false) on conflict (user_id) do update set contact_requests = false;
select 'Dana turned requests off: '||contact_requests from public.member_settings where user_id = auth.uid();
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'James (admin) sees (expect 2): '||count(*) from public.contact_requests;
select 'James clears a report (expect 1 row):'; update public.contact_requests set status='cleared' where sender_id='00000000-0000-0000-0000-00000000000c' returning status;
select 'James sets status sent (expect policy violation):'; update public.contact_requests set status='sent' where sender_id='00000000-0000-0000-0000-00000000000c';
reset role;

set role anon;
select 'anon reads (expect permission denied):'; select count(*) from public.contact_requests;
reset role;
