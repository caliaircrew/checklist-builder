
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','james@caliaircrew.com'),('00000000-0000-0000-0000-00000000000c','pilotc@example.com'),('00000000-0000-0000-0000-00000000000d','pilotd@example.com');
insert into public.admins values ('00000000-0000-0000-0000-00000000000a');
insert into public.crew_profiles (user_id,published,display_name,crew_types,details) values
 ('00000000-0000-0000-0000-00000000000c',true,'Charlie Captain','{airplane_pilot}','{"role":"pic","cert":"atp","region":"socal","status":"now"}'),
 ('00000000-0000-0000-0000-00000000000d',true,'Delta FO','{airplane_pilot}','{"role":"sic","cert":"commercial","region":"norcal","status":"no"}');
insert into public.crew_aircraft (user_id,acft_seq,hours,part135,is_current,current_until) values ('00000000-0000-0000-0000-00000000000c',51,2150,'PIC',true,'2030-01-01'),('00000000-0000-0000-0000-00000000000d',51,500,'',false,null);
insert into public.moderation (user_id,approved) values ('00000000-0000-0000-0000-00000000000c',true),('00000000-0000-0000-0000-00000000000d',true);
