import asyncio, sys, subprocess, time
sys.path.insert(0,'/tmp'); from bridge import *
C='00000000-0000-0000-0000-00000000000c'; AIR=open('/tmp/b160/crew/airports.json').read()
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(["python3","-m","http.server","8260","-d","/tmp/b160"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); c=await b.new_context(viewport={"width":820,"height":1180}); await c.expose_function("__db",op)
        await c.route("**/airports.json", lambda r: r.fulfill(status=200,content_type="application/json",body=AIR))
        p=await c.new_page(); errs=[]; p.on("pageerror",lambda e: errs.append(str(e))); p.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await p.goto("http://127.0.0.1:8260/crew/test.html")
        await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{C}',email:'c@example.com'}},aal:'aal1'}}))")
        await p.goto("about:blank"); await p.goto("http://127.0.0.1:8260/crew/test.html#/me"); await p.wait_for_timeout(1800)
        await p.fill("#pc0","1400"); await p.fill("#sic0","600"); await p.select_option("#dr0", index=2); await p.wait_for_timeout(300)
        await p.click("#save"); await p.wait_for_timeout(1500)
        print(sql(f"select details->'ac_pic', details->'ac_sic', details->'ac_rate' from crew_profiles where user_id='{C}'")); print("errors",errs)
        await b.close()
    srv.terminate()
asyncio.run(main())
