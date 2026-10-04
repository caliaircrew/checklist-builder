\pset tuples_only on
set role service_role; select 'recipients: '||string_agg(email, ', ') from public.admin_alert_recipients(); reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
insert into public.member_settings (admin_emails) values (false) on conflict (user_id) do update set admin_emails = false;
reset role; set role service_role; select 'after James turns off: '||coalesce(string_agg(email, ', '),'(none)') from public.admin_alert_recipients(); reset role;
update public.member_settings set admin_emails = true where user_id='00000000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false); set role authenticated;
\echo 'member reads alert state (expect denied):'
select count(*) from public.admin_alert_state;
