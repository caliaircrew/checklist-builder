import asyncio, sys, json, subprocess
sys.path.insert(0,'/tmp'); from bridge import *
make_test_page('/tmp/b138/crew/index.html','/tmp/b138/crew/test.html')
C='00000000-0000-0000-0000-00000000000c'
subprocess.run(["su","postgres","-c",f"psql -q -d sb -c \"insert into public.account_recovery(user_id,backup_email) values ('{C}','charlie.backup@example.com') on conflict (user_id) do update set backup_email='charlie.backup@example.com', backup_confirmed=false\""],check=True)
CODES={}
def fn(payload):   # stand-in for the Edge Function, same answers
    p=json.loads(payload); a=p["action"]; s=p.get("session")
    if a=="send_confirm":
        if not s: return json.dumps({"ok":False,"message":"Sign in first."})
        CODES[("confirm",s["user"]["id"])]="246810"; return json.dumps({"ok":True,"message":"We sent a 6-digit code to charlie.backup@example.com."})
    if a=="check_confirm":
        if p.get("code")!=CODES.get(("confirm",s["user"]["id"])): return json.dumps({"ok":False,"message":"That code didn't match or has expired."})
        subprocess.run(["su","postgres","-c",f"psql -q -d sb -c \"update public.account_recovery set backup_confirmed=true where user_id='{s['user']['id']}'\""],check=True)
        return json.dumps({"ok":True,"message":"Backup email confirmed."})
    if a=="recover_start": CODES[("recover",p["email"])]="135790"; return json.dumps({"ok":True,"message":"If that account has a confirmed backup email, we sent a code to it. It expires in 15 minutes."})
    if a=="recover_finish":
        if p.get("code")!=CODES.get(("recover",p["email"])): return json.dumps({"ok":False,"message":"That code didn't match or has expired."})
        return json.dumps({"ok":True,"message":"Done. Your sign-in email is now charlie.backup@example.com. Sign in with it to continue.","new_email":"charlie.backup@example.com"})
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        # 1) function not deployed yet
        c0=await b.new_context(viewport={"width":1180,"height":900}); await c0.expose_function("__db",op); p0=await c0.new_page(); p0.on("pageerror",lambda e: errs.append(str(e)))
        await p0.goto("file:///tmp/b138/crew/test.html#/account"); await p0.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{C}',email:'pilotc@example.com'}},aal:'aal1'}}))"); await p0.reload(); await p0.wait_for_timeout(1200)
        await p0.click("#bcs"); await p0.wait_for_timeout(300); print("1 not deployed yet:", (await p0.inner_text("#bconf")).split("\n")[-1])
        await c0.close()
        # 2) working
        c=await b.new_context(viewport={"width":1180,"height":900}); await c.expose_function("__db",op); await c.expose_function("__fn",fn); p=await c.new_page(); p.on("pageerror",lambda e: errs.append(str(e)))
        await p.goto("file:///tmp/b138/crew/test.html#/account"); await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{C}',email:'pilotc@example.com'}},aal:'aal1'}}))"); await p.reload(); await p.wait_for_timeout(1200)
        await p.click("#bcs"); await p.wait_for_timeout(300); print("2 code sent:", (await p.inner_text("#bconf")).split("\n")[0])
        await p.fill("#bcc","111111"); await p.click("#bcv"); await p.wait_for_timeout(200); print("   wrong code:", await p.inner_text("#bcm"))
        await p.fill("#bcc","246810"); await p.click("#bcv"); await p.wait_for_timeout(400); print("   confirmed:", (await p.inner_text("#bconf"))[:30], "| db:", sql(f"select backup_confirmed from public.account_recovery where user_id='{C}'")[0]["backup_confirmed"])
        # locked-out flow from sign-in box (signed out)
        q=await (await b.new_context(viewport={"width":390,"height":844})).new_page(); await q.context.expose_function("__db",op); await q.context.expose_function("__fn",fn); q.on("pageerror",lambda e: errs.append(str(e)))
        await q.goto("file:///tmp/b138/crew/test.html#/me"); await q.wait_for_timeout(500); await q.click("#go"); await q.click("#sirec"); await q.wait_for_timeout(200)
        await q.fill("#rfe","pilotc@example.com"); await q.click("#rfs"); await q.wait_for_timeout(300); print("3 recover start:", await q.inner_text("#rfm"))
        await q.fill("#rfc","135790"); await q.click("#rfv"); await q.wait_for_timeout(300); print("   finish:", (await q.inner_text("#rf")).split("\n")[0])
        await q.click("#rfgo"); await q.wait_for_timeout(300); print("4 sign-in opens prefilled:", await q.input_value("#sie"))
        await q.screenshot(path="/tmp/recover.png")
        print("errors:", errs); await b.close()
asyncio.run(main())
