// Admin-alert tests (reports + contact volume). Make the library first:
//   python3 -c "s=open(\x27supabase/functions/reminders/index.ts\x27).read(); s=s[:s.index(\x27Deno.serve(\x27)].replace(\x27import { createClient } from \"npm:@supabase/supabase-js@2\";\x27,\x27\x27)+\x27\nexport { adminAlerts };\n\x27; open(\x27tools/testing/deno/rem_lib.ts\x27,\x27w\x27).write(s)"
//   deno run -A tools/testing/deno/admin_alerts_test.ts
Deno.env.set("RESEND_API_KEY","x");
const sent:any[]=[]; (globalThis as any).fetch=async(_u:string,o:any)=>{sent.push(JSON.parse(o.body));return new Response("{}")};
const { adminAlerts } = await import("./rem_lib.ts");
const now=new Date().toISOString();
const T:Record<string,any[]>={crew_profiles:[{user_id:"d",display_name:"Dana",published:true,updated_at:now}],operator_profiles:[],moderation:[{user_id:"d",approved:true,hidden:false}],
 crew_bio_pending:[],operator_about_pending:[],help_requests:[],
 contact_requests:[{id:"r1",sender_id:"c",recipient_id:"d",sender_label:"Charlie Ops",status:"reported",report_reason:"spam",created_at:now},
   ...Array.from({length:8},(_,i)=>({id:"v"+i,sender_id:"s",recipient_id:"x"+i,sender_label:"Busy Sender",status:"sent",created_at:now})),
   {id:"f1",sender_id:"s",recipient_id:"y",sender_label:"Busy Sender",status:"failed",created_at:now}]};
const state={id:1,notified:[] as string[]};
const q=(t:string)=>{const f:any[]=[];let upd:any=null;const api:any={select(){return api},eq(k:string,v:any){f.push((r:any)=>r[k]===v);return api},neq(k:string,v:any){f.push((r:any)=>r[k]!==v);return api},gte(k:string,v:any){f.push((r:any)=>r[k]>=v);return api},
 update(u:any){upd=u;return api},maybeSingle(){return Promise.resolve({data:t==="admin_alert_state"?state:null})},
 then(res:any){ if(t==="admin_alert_state"&&upd){Object.assign(state,upd);return res({error:null})} return res({data:(T[t]||[]).filter(r=>f.every(fn=>fn(r)))})}};return api};
const admin={from:q,rpc:async()=>({data:[{email:"james@x"}]})};
const ok=(c:boolean,m:string)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)Deno.exitCode=1};
let r=await adminAlerts(admin,false);
ok(r.emails===1,"one admin email sent"); const m=sent[0];
ok(/1 reported contact request/.test(m.subject)&&/contact-volume warning/.test(m.subject),"subject: "+m.subject);
ok(/Charlie Ops → Dana · spam/.test(m.text),"report line names sender, pilot, reason");
ok(/Busy Sender: 8 requests in 24 hours/.test(m.text),"volume counts 8 (failed one excluded)");
r=await adminAlerts(admin,false); ok(r.newItems===0&&sent.length===1,"not repeated next hour");
// 018: a photo waiting for review is announced once; an approved one is not.
T.crew_profiles.push({user_id:"e",display_name:"Eve",published:true,updated_at:now,photo:"e/1.jpg"},{user_id:"f",display_name:"Finn",published:false,updated_at:now,photo:"f/1.jpg"});
T.moderation.push({user_id:"e",approved:true,hidden:false,photo_ok:""},{user_id:"f",approved:false,hidden:false,photo_ok:"f/1.jpg"});
r=await adminAlerts(admin,false); const m2=sent[sent.length-1];
ok(r.newItems===1&&/1 photo to review/.test(m2.subject),"photo alert subject: "+m2.subject);
ok(/Eve/.test(m2.text)&&!/Finn/.test(m2.text.split("Profile photos")[1]||""),"only the unapproved photo is listed");
