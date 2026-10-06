# Test bridge: a fake supabase-js client in the page that sends every call to the REAL local PostgreSQL
# (same tables, functions and row-level security), playing the signed-in user's role.
import json, psycopg2, psycopg2.extras, re, uuid, datetime, decimal
CONN = dict(host="localhost", dbname="sb", user="postgres", password="pg")
def reset_db():
    import subprocess
    subprocess.run(["su","postgres","-c","psql -qc 'drop database if exists sb' -c 'create database sb'"],check=True,capture_output=True)
    for f in ["/tmp/sb_stub.sql"]+[f"/tmp/ghrepo/supabase/{n}.sql" for n in ["001_checklists","002_directory","004_profile_choices","006_currency_details","007_admin"]]:
        r=subprocess.run(["su","postgres","-c",f"psql -q -v ON_ERROR_STOP=1 -d sb -f {f}"],capture_output=True,text=True)
        assert r.returncode==0, (f, r.stderr[-500:])
def sql(q, args=None, role=None, uid=None, aal="aal1"):
    c=psycopg2.connect(**CONN); c.autocommit=False
    try:
        cur=c.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if role:
            cur.execute("select set_config('request.jwt.claim.sub', %s, true), set_config('request.jwt.claims', %s, true)", (uid or "", json.dumps({"aal":aal})))
            cur.execute(f"set local role {role}")
        cur.execute(q, args)
        rows=cur.fetchall() if cur.description else []
        c.commit(); return rows
    finally: c.close()
def jsonable(o):
    if isinstance(o,(datetime.datetime,datetime.date)): return o.isoformat()
    if isinstance(o,decimal.Decimal): return float(o)
    if isinstance(o,uuid.UUID): return str(o)
    return str(o)
BLOBS={}
IDENT=re.compile(r'^[a-z_][a-z0-9_]*$')
def op(name, payload):
    p=json.loads(payload); s=p.get("session"); uid=s["user"]["id"] if s else None; role="authenticated" if s else "anon"; aal=(s or {}).get("aal","aal1")
    def run(q,a=None): return sql(q,a,role,uid,aal)
    try:
        if name=="otp": return json.dumps({})
        if name=="verify":
            em=p["email"].lower(); r=sql("select id from auth.users where lower(email)=%s",(em,))
            if not r: r=sql("insert into auth.users(email,last_sign_in_at) values(%s,now()) returning id",(em,))
            else: sql("update auth.users set last_sign_in_at=now() where lower(email)=%s",(em,))
            return json.dumps({"uid":str(r[0]["id"])})
        if name=="enroll":
            r=sql("insert into auth.mfa_factors(user_id,status) values(%s,'unverified') returning id",(uid,)); return json.dumps({"id":str(r[0]["id"])})
        if name=="unenroll":
            sql("delete from auth.mfa_factors where id=%s and user_id=%s",(p["factorId"],uid)); return json.dumps({})
        if name=="verifyfactor":
            sql("update auth.mfa_factors set status='verified' where id=%s and user_id=%s",(p["factorId"],uid)); return json.dumps({})
        if name=="factors":
            r=sql("select id,status from auth.mfa_factors where user_id=%s",(uid,)) if uid else []
            return json.dumps({"factors":[{"id":str(x["id"]),"status":x["status"]} for x in r]})
        if name in ("st_upload","st_remove","st_list","st_sign"):   # Supabase Storage stand-in: rows in storage.objects (policies apply), bytes in BLOBS
            b=p["bucket"]
            if name=="st_upload":
                run("insert into storage.objects(bucket_id,name) values(%s,%s)",(b,p["path"])); BLOBS[(b,p["path"])]=p["b64"]; return json.dumps({"data":{"path":p["path"]}})
            if name=="st_remove":
                r=run("delete from storage.objects where bucket_id=%s and name = any(%s) returning name",(b,p["paths"]))
                for x in r: BLOBS.pop((b,x["name"]),None)
                return json.dumps({"data":[{"name":x["name"]} for x in r]})
            if name=="st_list":
                r=run("select name from storage.objects where bucket_id=%s and name like %s",(b,p["prefix"].rstrip("/")+"/%"))
                return json.dumps({"data":[{"name":x["name"].split("/")[-1]} for x in r]})
            r=run("select name from storage.objects where bucket_id=%s and name=%s",(b,p["path"]))
            if not r or (b,p["path"]) not in BLOBS: return json.dumps({"error":{"message":"Object not found"}})
            return json.dumps({"data":{"signedUrl":"data:image/jpeg;base64,"+BLOBS[(b,p["path"])]}})
        if name=="rpc":
            fn=p["fn"]; assert IDENT.match(fn); args=p.get("args") or {}
            for k in args: assert IDENT.match(k)
            q=f"select * from public.{fn}(" + ", ".join(f"{k} => %({k})s" for k in args) + ")"
            rows=run(q,args)
            if len(rows)==1 and len(rows[0])==1 and fn not in ("admin_users",): data=list(rows[0].values())[0]
            else: data=rows
            if rows and fn in ("admin_moderate","admin_set_banner","admin_decline_text","admin_set_admin","admin_delete_user"): data=None
            return json.dumps({"data":data},default=jsonable)
        t=p["table"]; assert IDENT.match(t)
        if name=="select":
            where=[]; args={}
            for i,(c,v) in enumerate(p.get("filters",[])): assert IDENT.match(c); where.append(f"{c} = %(f{i})s"); args[f"f{i}"]=v
            cl=[c.strip() for c in str(p.get("cols") or "*").split(",")]   # honour a plain column list (column-level grants, e.g. 017)
            cols="*" if cl==["*"] or not all(IDENT.match(c) for c in cl) else ", ".join(cl)
            q=f"select {cols} from public.{t}" + (" where "+" and ".join(where) if where else "")
            if p.get("order"): q+=" order by "+", ".join(f"{c} {'asc' if a else 'desc'}" for c,a in p["order"] if IDENT.match(c))
            if p.get("limit"): q+=f" limit {int(p['limit'])}"
            return json.dumps({"rows":run(q,args)},default=jsonable)
        if name in ("insert","upsert"):
            out=[]
            for r in p["rows"]:
                cols=[c for c in r if IDENT.match(c)]; vals={c:(json.dumps(r[c]) if isinstance(r[c],(dict,)) else r[c]) for c in cols}
                q=f"insert into public.{t} ({', '.join(cols)}) values ({', '.join('%('+c+')s' + ('::uuid[]' if c=='seen' else '') for c in cols)})"
                if name=="upsert":
                    oc=p.get("onConflict") or "user_id"; upd=[c for c in cols if c!=oc]
                    q+=f" on conflict ({oc}) do update set "+", ".join(f"{c}=excluded.{c}" for c in upd)
                run(q,vals)
            return json.dumps({})
        if name=="update":
            sets=p["values"]; [IDENT.match(c) or (_ for _ in ()).throw(Exception("bad col")) for c in sets]
            where=[]; args={f"s_{c}":v for c,v in sets.items()}
            for i,(c,v) in enumerate(p.get("filters",[])): where.append(f"{c} = %(f{i})s"); args[f"f{i}"]=v
            run(f"update public.{t} set "+", ".join(f"{c}=%(s_{c})s" for c in sets)+" where "+" and ".join(where), args); return json.dumps({})
        if name=="delete":
            where=[]; args={}
            for i,(c,v) in enumerate(p.get("filters",[])): where.append(f"{c} = %(f{i})s"); args[f"f{i}"]=v
            run(f"delete from public.{t} where "+" and ".join(where), args); return json.dumps({})
    except Exception as e:
        msg=getattr(e,"pgerror",None) or str(e); msg=(msg or "").split("\n")[0].replace("ERROR:  ","")
        return json.dumps({"error":{"message":msg}})
    return json.dumps({"error":{"message":"bad op "+name}})
MOCK=r'''window.supabase={createClient(url,key,opts){
 const SK=opts.auth.storageKey; const ls=[]; const getS=()=>JSON.parse(localStorage.getItem(SK)||"null"); const setS=x=>{x?localStorage.setItem(SK,JSON.stringify(x)):localStorage.removeItem(SK)};
 const emit=(ev,x)=>ls.forEach(cb=>cb(ev,x));
 const call=(op,p)=>window.__db(op,JSON.stringify(Object.assign({},p,{session:getS()}))).then(x=>JSON.parse(x));
 const auth={onAuthStateChange(cb){ls.push(cb); setTimeout(()=>cb("INITIAL_SESSION",getS()),0); return {data:{subscription:{unsubscribe(){}}}}},
  async getSession(){return {data:{session:getS()},error:null}},
  async signInWithOtp({email}){await call("otp",{email}); return {data:{},error:null}},
  async verifyOtp({email,token}){if(token!=="123456") return {data:null,error:{message:"Token has expired or is invalid"}}; const r=await call("verify",{email}); const x={user:{id:r.uid,email},aal:"aal1"}; setS(x); emit("SIGNED_IN",x); return {data:{session:x},error:null}},
  async signOut(){setS(null); emit("SIGNED_OUT",null); return {error:null}},
  async updateUser(attrs){window.__lastUpdateUser=attrs; return {data:{},error:null}}, async refreshSession(){return {data:{},error:null}},
  mfa:{async getAuthenticatorAssuranceLevel(){const x=getS(); if(!x) return {data:{currentLevel:null,nextLevel:null}}; const f=await call("factors",{}); const has=(f.factors||[]).some(v=>v.status==="verified"); return {data:{currentLevel:x.aal,nextLevel:has?"aal2":x.aal},error:null}},
   async listFactors(){const f=await call("factors",{}); const t=(f.factors||[]).map(v=>({id:v.id,status:v.status,factor_type:"totp"})); return {data:{all:t,totp:t.filter(x=>x.status==="verified")},error:null}},
   async enroll(){const r=await call("enroll",{}); return {data:{id:r.id,totp:{qr_code:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",secret:"JBSWY3DPEHPK3PXP"}},error:null}},
   async unenroll({factorId}){await call("unenroll",{factorId}); return {error:null}},
   async challenge({factorId}){return {data:{id:"ch-"+factorId},error:null}},
   async verify({factorId,code}){if(code!=="654321") return {error:{message:"Invalid TOTP code entered"}}; await call("verifyfactor",{factorId}); const x=getS(); x.aal="aal2"; setS(x); return {data:{},error:null}}}};
 const from=t=>{
  const sel=(cols)=>{const f=[],o=[];let lim=null; const run=()=>call("select",{table:t,cols:typeof cols==="string"?cols:"*",filters:f,order:o,limit:lim}); const q={eq(c,v){f.push([c,v]);return q}, order(c,opt){o.push([c,!opt||opt.ascending!==false]);return q}, limit(n){lim=n;return q},
     maybeSingle(){return run().then(r=>({data:(r.rows||[])[0]||null,error:r.error||null}))}, then(res,rej){return run().then(r=>res({data:r.rows||null,error:r.error||null}),rej)}}; return q};
  const w=(op,extra)=>{const f=[]; const q={eq(c,v){f.push([c,v]);return q}, then(res,rej){return call(op,Object.assign({table:t,filters:f},extra)).then(r=>res({error:r.error||null}),rej)}}; return q};
  return {select:sel, upsert(rows,o){return call("upsert",{table:t,rows:Array.isArray(rows)?rows:[rows],onConflict:o&&o.onConflict}).then(r=>({error:r.error||null}))},
   insert(rows){return call("insert",{table:t,rows:Array.isArray(rows)?rows:[rows]}).then(r=>({error:r.error||null}))},
   update(values){return w("update",{values})}, delete(){return w("delete",{})}};};
 const rpc=(fn,args)=>call("rpc",{fn,args:args||{}}).then(r=>({data:r.error?null:r.data,error:r.error||null}));
 const functions={async invoke(name,{body}){ if(!window.__fn) return {data:null,error:{message:"Failed to send a request to the Edge Function",context:{json:async()=>{throw new Error("no body")}}}};
   const r=JSON.parse(await window.__fn(JSON.stringify(Object.assign({},body,{session:getS()})))); if(r.ok) return {data:r,error:null}; return {data:null,error:{message:"non-2xx",context:{json:async()=>r}}}; }};
 const b64=blob=>new Promise(r=>{const f=new FileReader(); f.onload=()=>r(String(f.result).split(",")[1]); f.readAsDataURL(blob)});
 const storage={from(bucket){return {
   async upload(path,blob,o){const r=await call("st_upload",{bucket,path,b64:await b64(blob)}); return {data:r.data||null,error:r.error||null}},
   async remove(paths){const r=await call("st_remove",{bucket,paths}); return {data:r.data||null,error:r.error||null}},
   async list(prefix){const r=await call("st_list",{bucket,prefix:prefix||""}); return {data:r.data||null,error:r.error||null}},
   async createSignedUrl(path,ttl){const r=await call("st_sign",{bucket,path}); return {data:r.data||null,error:r.error||null}}}}};
 return {auth,from,rpc,functions,storage}; }};'''
def make_test_page(src, dst):
    s=open(src,encoding='utf-8').read(); i=s.index('var supabase=(function(e){'); j=s.index('</script>',i)
    open(dst,'w',encoding='utf-8').write(s[:i]+MOCK+s[j:])
