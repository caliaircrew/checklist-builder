// Contact function tests with stand-ins. Make the library first:
//   python3 -c "s=open(\x27supabase/functions/contact/index.ts\x27).read(); s=s[:s.index(\x27const adminClient\x27)].replace(\x27import { createClient } from \"npm:@supabase/supabase-js@2\";\x27,\x27\x27); open(\x27tools/testing/deno/contact_lib.ts\x27,\x27w\x27).write(s)"
//   deno run -A tools/testing/deno/contact_test.ts
Deno.env.set("RESEND_API_KEY","test"); 
const { handle, checkNote, checkLimits } = await import("./contact_lib.ts");
const SENDER="11111111-1111-1111-1111-111111111111", PILOT="22222222-2222-2222-2222-222222222222", OFF="33333333-3333-3333-3333-333333333333", HIDDEN="44444444-4444-4444-4444-444444444444";
type Row=Record<string,any>;
function fakeDb(){
  const T:Record<string,Row[]>={
    crew_profiles:[{user_id:PILOT,published:true,display_name:"Jane Pilot"},{user_id:OFF,published:true},{user_id:HIDDEN,published:true}],
    moderation:[{user_id:PILOT,approved:true,hidden:false},{user_id:OFF,approved:true,hidden:false},{user_id:HIDDEN,approved:true,hidden:true}],
    member_settings:[{user_id:OFF,contact_requests:false}],
    operator_profiles:[{user_id:SENDER,name:"Pacific Coast Jet",published:true,details:{}}],
    contact_requests:[]};
  let idn=0;
  const q=(t:string)=>{ let rows=()=>T[t]; const f:any[]=[]; let mode="select", upd:any=null, head=false, ins:any=null;
    const api:any={
      select(_c?:string,o?:any){ if(o&&o.head) head=true; return api},
      eq(k:string,v:any){f.push((r:Row)=>r[k]===v);return api}, neq(k:string,v:any){f.push((r:Row)=>r[k]!==v);return api},
      gte(k:string,v:any){f.push((r:Row)=>r[k]>=v);return api},
      insert(r:Row){ mode="insert"; ins={id:`aaaaaaaa-0000-0000-0000-${String(++idn).padStart(12,"0")}`,created_at:new Date().toISOString(),...r}; T[t].push(ins); return api},
      update(u:Row){mode="update";upd=u;return api},
      get list(){return rows().filter(r=>f.every(fn=>fn(r)))},
      maybeSingle(){return Promise.resolve({data:api.list[0]??null,error:null})},
      single(){return Promise.resolve({data:ins??api.list[0],error:null})},
      then(res:any){ if(mode==="update"){api.list.forEach(r=>Object.assign(r,upd));return res({error:null})} if(head) return res({count:api.list.length,error:null}); return res({data:api.list,error:null})}};
    return api};
  return {T, admin:{from:q, auth:{getUser:async(j:string)=>({data:{user:j==="tok"?{id:SENDER,email:"ops@pcj.test",email_confirmed_at:"x"}:j==="unconf"?{id:SENDER,email:"a@b.c"}:null}}),
      admin:{getUserById:async(id:string)=>({data:{user:{email:id===PILOT?"jane@pilot.test":"x@y.z"}}})}}}};
}
const mails:any[]=[]; let failMail=false;
const fetcher=async(u:string,o?:any)=>{ if(u.endsWith("aircraft-names.json")) return new Response(JSON.stringify({"58":"Cessna Citation CJ3"})); if(failMail) return new Response("x",{status:500}); mails.push(JSON.parse(o.body)); return new Response("{}")};
const call=async(db:any,body:any,tok="tok")=>{const r=await handle(new Request("http://x",{method:"POST",headers:{Authorization:"Bearer "+tok},body:JSON.stringify(body)}),db.admin,fetcher as any); return {s:r.status, ...(await r.json())}};
const ok=(c:boolean,m:string)=>{console.log((c?"PASS ":"FAIL ")+m); if(!c) Deno.exitCode=1};

ok(checkNote("Need a CJ3 captain for Oct 12")==="","plain note ok");
ok(!!checkNote("call 415-555-1234"),"phone blocked"); ok(!!checkNote("me@x.com"),"email blocked"); ok(!!checkNote("x".repeat(501)),"501 chars blocked");
ok(checkLimits(9,1)===""&&!!checkLimits(10,0)&&!!checkLimits(0,2),"limits 10/day, 2/pilot/week");

let db=fakeDb();
let r=await call(db,{action:"send",to:PILOT,note:"Need a CJ3 captain"},"");  ok(r.s===401,"signed out refused");
r=await call(db,{action:"send",to:PILOT,note:"hi"},"unconf"); ok(r.s===403,"unconfirmed email refused");
r=await call(db,{action:"send",to:SENDER,note:"hi"}); ok(r.s===400,"self refused");
r=await call(db,{action:"send",to:OFF,note:"hi"}); ok(r.s===403,"pilot with requests off refused");
r=await call(db,{action:"send",to:HIDDEN,note:"hi"}); ok(r.s===404,"hidden profile refused");
r=await call(db,{action:"send",to:PILOT,note:"Need a CJ3 captain for Oct 12",seq:58}); ok(r.ok&&r.s===200,"send ok");
const m=mails[0]; ok(m.to[0]==="jane@pilot.test"&&m.reply_to==="ops@pcj.test","to pilot, reply-to sender");
ok(m.subject==="Pacific Coast Jet wants to talk about a Cessna Citation CJ3","subject: "+m.subject);
ok(/crew\/#\/o\/1111/.test(m.text)&&/crew\/#\/report\/aaaaaaaa/.test(m.text),"email has sender profile + report link");
ok(!JSON.stringify(r).includes("jane@pilot.test"),"pilot email not returned to sender");
r=await call(db,{action:"send",to:PILOT,note:"second"}); ok(r.ok,"2nd to same pilot ok");
r=await call(db,{action:"send",to:PILOT,note:"third"}); ok(r.s===429,"3rd to same pilot this week refused");
failMail=true; db=fakeDb();
r=await call(db,{action:"send",to:PILOT,note:"x"}); ok(r.s===502&&db.T.contact_requests[0].status==="failed","failed send logged as failed");
failMail=false;
r=await call(db,{action:"send",to:PILOT,note:"y"}); r=await call(db,{action:"send",to:PILOT,note:"z"}); ok(r.ok,"failed send not counted toward pilot/week limit");
// daily limit across pilots
db=fakeDb(); for(let i=0;i<10;i++) db.T.contact_requests.push({sender_id:SENDER,recipient_id:"x"+i,status:"sent",created_at:new Date().toISOString()});
r=await call(db,{action:"send",to:PILOT,note:"x"}); ok(r.s===429,"11th today refused");
db.T.contact_requests.forEach(x=>x.status="failed"); r=await call(db,{action:"send",to:PILOT,note:"x"}); ok(r.ok,"failed ones don't count toward daily");
// report
const link=mails.at(-1).text.match(/report\/([0-9a-f-]{36})\/([0-9a-f]{36})/);
r=await call(db,{action:"report",id:link[1],code:"0".repeat(36)},""); ok(r.s===400,"wrong code refused");
r=await call(db,{action:"report",id:link[1],code:link[2],reason:"spam"},""); const row=db.T.contact_requests.find(x=>x.id===link[1]);
ok(r.ok&&row.status==="reported"&&row.report_reason==="spam"&&row.reported_at,"report without sign-in marks reported");
r=await call(db,{action:"report",id:link[1],code:link[2]},""); ok(r.ok&&/already/.test(r.message),"second report idempotent");
