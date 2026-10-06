-- 019 profile photos: permission checks. Charlie ...0c (published+approved in seed), Dana ...0d, admin James ...0a.
\set ON_ERROR_STOP 0
begin;
reset role; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false); set role authenticated;
insert into storage.objects (bucket_id,name) values ('crew-photos','00000000-0000-0000-0000-00000000000c/1759600000000.jpg');
select 'T1 own upload ok' as t;
savepoint s; insert into storage.objects (bucket_id,name) values ('crew-photos','00000000-0000-0000-0000-00000000000d/1759600000000.jpg'); select 'T2 FAIL: wrote into another folder'; rollback to s;
savepoint s; insert into storage.objects (bucket_id,name) values ('crew-photos','00000000-0000-0000-0000-00000000000c/evil.png'); select 'T3 FAIL: bad name'; rollback to s;
update public.crew_profiles set photo='00000000-0000-0000-0000-00000000000c/1759600000000.jpg' where user_id='00000000-0000-0000-0000-00000000000c';
select 'T4 set own photo ok';
savepoint s; update public.crew_profiles set photo='00000000-0000-0000-0000-00000000000d/1759600000000.jpg' where user_id='00000000-0000-0000-0000-00000000000c'; select 'T5 FAIL: pointed at another folder'; rollback to s;
savepoint s; update public.moderation set photo_ok='x' where user_id='00000000-0000-0000-0000-00000000000c'; rollback to s;
select 'T6 self-approve rows changed: ' || (select count(*) from public.moderation where photo_ok='x');
savepoint s; select public.admin_photo('00000000-0000-0000-0000-00000000000c', true); select 'T7 FAIL: member approved own photo'; rollback to s;
-- pending: anon cannot see it
reset role; select set_config('request.jwt.claim.sub','',false); set role anon;
select 'T8 anon sees pending: ' || count(*) from storage.objects where bucket_id='crew-photos';
-- Dana cannot see it
reset role; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false); set role authenticated;
select 'T9 other member sees pending: ' || count(*) from storage.objects where bucket_id='crew-photos';
savepoint s; delete from storage.objects where bucket_id='crew-photos'; select 'T10 other member deleted: ' || 0; rollback to s;
-- admin sees queue and approves
reset role; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'T11 queue: ' || string_agg(photo, ',') from public.admin_photo_queue();
select 'T12 admin sees: ' || count(*) from storage.objects where bucket_id='crew-photos';
select 'T13 approve -> ' || public.admin_photo('00000000-0000-0000-0000-00000000000c', true);
select 'T14 queue after: ' || count(*) from public.admin_photo_queue();
reset role; select set_config('request.jwt.claim.sub','',false); set role anon;
select 'T15 anon sees approved: ' || count(*) from storage.objects where bucket_id='crew-photos';
-- member changes photo -> back to pending, old approved file no longer public
reset role; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false); set role authenticated;
insert into storage.objects (bucket_id,name) values ('crew-photos','00000000-0000-0000-0000-00000000000c/1759600099999.jpg');
update public.crew_profiles set photo='00000000-0000-0000-0000-00000000000c/1759600099999.jpg' where user_id='00000000-0000-0000-0000-00000000000c';
reset role; select set_config('request.jwt.claim.sub','',false); set role anon;
select 'T16 anon sees after change: ' || count(*) from storage.objects where bucket_id='crew-photos';
-- admin removes
reset role; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'T17 remove -> ' || public.admin_photo('00000000-0000-0000-0000-00000000000c', false);
delete from storage.objects where name='00000000-0000-0000-0000-00000000000c/1759600099999.jpg';
select 'T18 photo cleared: ' || (select photo='' from public.crew_profiles where user_id='00000000-0000-0000-0000-00000000000c') || ' file gone: ' || not exists(select 1 from storage.objects where name like '%1759600099999%');
rollback;
