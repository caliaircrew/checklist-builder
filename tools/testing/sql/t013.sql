\pset tuples_only on
\echo '1 service role sees candidates'
set role service_role; select kind||' '||ref||' '||school||' '||through from public.reminder_candidates() where user_id='00000000-0000-0000-0000-00000000000d' order by 1; reset role;
\echo '2 member turns reminders off -> no candidates'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false); set role authenticated;
insert into public.member_settings (currency_emails) values (false) on conflict (user_id) do update set currency_emails=false;
reset role; set role service_role; select count(*) from public.reminder_candidates() where user_id='00000000-0000-0000-0000-00000000000d'; reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false); set role authenticated; update public.member_settings set currency_emails=true; reset role;
\echo '3 member cannot read the log or call the lookup; cannot change another member'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false); set role authenticated;
select count(*) from public.reminder_log;
select count(*) from public.reminder_candidates();
update public.member_settings set currency_emails=false where user_id='00000000-0000-0000-0000-00000000000d';
reset role; select 'D still on: '||currency_emails from public.member_settings where user_id='00000000-0000-0000-0000-00000000000d';
\echo '4 log is unique per reminder'
insert into public.reminder_log(user_id,kind,ref,through,stage) values ('00000000-0000-0000-0000-00000000000d','cpr','','2025-11','lapsed');
insert into public.reminder_log(user_id,kind,ref,through,stage) values ('00000000-0000-0000-0000-00000000000d','cpr','','2025-11','lapsed');
