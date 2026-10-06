import asyncio, sys, subprocess, time
sys.path.insert(0,'/tmp'); from bridge import *
make_test_page('/tmp/b167/crew/index.html','/tmp/b167/crew/test.html')
C='00000000-0000-0000-0000-00000000000c'; D_='00000000-0000-0000-0000-00000000000d'
AIR=open('/tmp/b167/crew/airports.json').read()
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(["python3","-m","http.server","8269","-d","/tmp/b167"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); c=await b.new_context(viewport={"width":1180,"height":820},accept_downloads=True); await c.expose_function("__db",op)
        await c.route("**/airports.json", lambda r: r.fulfill(status=200,content_type="application/json",body=AIR))
        p=await c.new_page(); errs=[]; p.on("pageerror",lambda e: errs.append(str(e)))
        await p.goto("http://127.0.0.1:8269/crew/test.html"); await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{D_}',email:'d@example.com'}},aal:'aal1'}}))")
        await p.goto("about:blank"); await p.goto(f"http://127.0.0.1:8269/crew/test.html#/p/{C}"); await p.wait_for_timeout(2000)
        print("quick row buttons:", await p.locator(".qacts button").all_inner_texts())
        await p.locator(".pcard").screenshot(path="/tmp/qa.png")
        await p.click(".qacts [data-fav]"); await p.wait_for_timeout(800)
        print("save both updated:", await p.locator("[data-fav]").all_inner_texts())
        async with p.expect_download() as dl: await p.click(".qacts [data-resume]")
        print("résumé from top row:", (await dl.value).suggested_filename)
        await p.goto("about:blank"); await p.goto("http://127.0.0.1:8269/crew/test.html#/me"); await p.wait_for_timeout(1500)
        print("editor preview has no quick row:", await p.locator("#prev .qacts").count()==0)
        print("errors", errs); await b.close()
    srv.terminate()
asyncio.run(main())
