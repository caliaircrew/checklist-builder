import asyncio, sys, json, subprocess, time
sys.path.insert(0,'/tmp'); from bridge import *
make_test_page('/tmp/b200/crew/index.html','/tmp/b200/crew/test.html')
C='00000000-0000-0000-0000-00000000000c'; E='00000000-0000-0000-0000-00000000000e'
AIR=open('/tmp/b200/crew/airports.json').read()
calls=[]
def fn(payload):
    p=json.loads(payload); calls.append(p)
    if p.get("action")=="send": return json.dumps({"ok":True,"message":"Sent. The pilot will reply to your email if they're interested."})
    if p.get("action")=="report": return json.dumps({"ok":True,"message":"Thanks. Cali Aircrew will review this request."})
    return json.dumps({"ok":False,"message":"?"})
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(["python3","-m","http.server","8200","-d","/tmp/b200"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        c=await b.new_context(viewport={"width":1180,"height":1000}); await c.expose_function("__db",op); await c.expose_function("__fn",fn)
        await c.route("**/airports.json", lambda r: r.fulfill(status=200,content_type="application/json",body=AIR))
        p=await c.new_page(); p.on("pageerror",lambda e: errs.append(str(e)))
        # signed out: Contact asks to sign in
        await p.goto(f"http://127.0.0.1:8200/crew/test.html#/p/{C}"); await p.wait_for_timeout(1500)
        print("contact button:", await p.locator("[data-contact]").count())
        await p.click("[data-contact]"); await p.wait_for_timeout(400); print("signed-out opens sign-in:", await p.locator(".modal").count()>0 and "email" in (await p.inner_text(".modal")).lower())
        # signed in as owner E
        await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{E}',email:'ownere@example.com'}},aal:'aal1'}}))"); await p.goto("about:blank")
        await p.goto(f"http://127.0.0.1:8200/crew/test.html#/p/{C}"); await p.wait_for_timeout(1500)
        await p.click("[data-contact]"); await p.wait_for_timeout(300)
        print("form title:", await p.inner_text(".modal h2"), "| aircraft options:", await p.locator("#cta option").count())
        await p.fill("#ctn","Call me at 415-555-1234"); await p.wait_for_timeout(100); print("phone warning:", await p.inner_text("#ctm"))
        await p.click("#cts"); await p.wait_for_timeout(200); print("blocked send, calls:", len(calls))
        await p.fill("#ctn","Need a CJ3 captain Oct 12, SJC to TEB"); 
        if await p.locator("#cta option").count()>1: await p.select_option("#cta", index=1)
        await p.click("#cts"); await p.wait_for_timeout(500)
        print("after send:", (await p.inner_text(".modal")).split("\n")[0], "| call:", {k:v for k,v in calls[-1].items() if k!="session"})
        # report page (no sign-in needed)
        await p.goto("about:blank"); await p.goto("http://127.0.0.1:8200/crew/test.html#/report/aaaaaaaa-0000-0000-0000-000000000001/"+"ab"*18); await p.wait_for_timeout(1200)
        await p.fill("#rpr","spam"); await p.click("#rps"); await p.wait_for_timeout(400)
        print("report:", (await p.inner_text("#app")).split("\n")[0:2], "| call:", {k:v for k,v in calls[-1].items() if k!="session"})
        # account switch
        B='00000000-0000-0000-0000-00000000000b'
        await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{B}',email:'pilotb@example.com'}},aal:'aal1'}}))")
        await p.goto("about:blank"); await p.goto("http://127.0.0.1:8200/crew/test.html#/account"); await p.wait_for_timeout(1500)
        print("ACCOUNT:", (await p.inner_text("#app"))[:300].replace("\n"," | ")); print("errs", errs); await p.wait_for_timeout(2000); print("ctok count", await p.locator("#ctok").count())
        print("switch on by default:", await p.is_checked("#ctok"))
        await p.uncheck("#ctok"); await p.wait_for_timeout(600); print("msg:", await p.inner_text("#ctmsg"), "| db:", sql(f"select contact_requests from public.member_settings where user_id='{B}'"))
        # own profile shows no contact form
        print("errors:", errs)
        await b.close()
    srv.terminate()
asyncio.run(main())
