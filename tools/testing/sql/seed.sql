
alter table public.crew_profiles disable trigger crew_bio_guard;
insert into auth.users (id,email,created_at,last_sign_in_at) values
 ('00000000-0000-0000-0000-00000000000a','james@caliaircrew.com', now()-interval '20 days', now()),
 ('00000000-0000-0000-0000-00000000000b','pilotb@example.com', now()-interval '3 days', now()),
 ('00000000-0000-0000-0000-00000000000c','pilotc@example.com', now()-interval '40 days', now()-interval '2 days'),
 ('00000000-0000-0000-0000-00000000000d','pilotd@example.com', now()-interval '1 days', now()),
 ('00000000-0000-0000-0000-00000000000e','ownere@example.com', now()-interval '10 days', null),
 ('00000000-0000-0000-0000-00000000000f','pilotf@example.com', now()-interval '2 days', now());
insert into public.admins values ('00000000-0000-0000-0000-00000000000a');
insert into auth.mfa_factors (user_id,status) values ('00000000-0000-0000-0000-00000000000a','verified'),('00000000-0000-0000-0000-00000000000e','verified');
insert into public.crew_profiles (user_id,published,display_name,crew_types,total_time,bio,details) values
 ('00000000-0000-0000-0000-00000000000b',true,'Bravo Pilot','{airplane_pilot}',1000,'','{"role":"pic","cert":"atp","region":"socal","status":"now"}'),
 ('00000000-0000-0000-0000-00000000000c',true,'Charlie Pilot','{airplane_pilot,cfi}',9000,'Corporate captain, 20 years.','{"role":"either","cert":"atp","region":"norcal","status":"notice"}'),
 ('00000000-0000-0000-0000-00000000000d',false,'Delta Draft','{airplane_pilot}',null,'','{}'),
 ('00000000-0000-0000-0000-00000000000f',true,'Foxtrot Pilot','{helicopter_pilot}',2500,'','{"role":"pic","cert":"commercial","region":"socal","status":"now"}');
insert into public.crew_aircraft (user_id,acft_seq,type_rated,hours,part135,is_current,current_until) values
 ('00000000-0000-0000-0000-00000000000b',51,true,2150,'PIC',true,'2024-01-01'),
 ('00000000-0000-0000-0000-00000000000c',58,true,640,'',true,'2030-01-01'),
 ('00000000-0000-0000-0000-00000000000f',624,false,1200,'PIC',false,null);
insert into public.moderation (user_id,approved) values ('00000000-0000-0000-0000-00000000000c',true);
insert into public.crew_bio_pending (user_id,bio) values ('00000000-0000-0000-0000-00000000000b','Call me at (760) 555-1212 for trips'),('00000000-0000-0000-0000-00000000000c','Corporate captain, 21 years. Now also CFII.');
insert into public.notify_signups (email,role) values ('o1@x.com','owner'),('o2@x.com','charter'),('p1@x.com','pilot');
insert into public.search_log (acft_seq,region,results) values (51,'socal',1),(371,'socal',0),(371,'socal',0),(null,'texas',0);
insert into public.aircraft_requests (user_id,request) values ('00000000-0000-0000-0000-00000000000b','Pilatus PC-24');
alter table public.crew_profiles enable trigger crew_bio_guard;
