import asyncio, sys, subprocess, time
sys.path.insert(0,'/tmp'); from bridge import *
make_test_page('/tmp/b159/crew/index.html','/tmp/b159/crew/test.html')
B='00000000-0000-0000-0000-00000000000b'; C='00000000-0000-0000-0000-00000000000c'; E='00000000-0000-0000-0000-00000000000e'
AIR=open('/tmp/b159/crew/airports.json').read()
from playwright.async_api import async_playwright
async def run(c, who, prof, errs):
    p=await c.new_page(); p.on("pageerror",lambda e: errs.append(str(e)))
    await p.goto("http://127.0.0.1:8259/crew/test.html")
    await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{who}',email:'x@example.com'}},aal:'aal1'}}))")
    await p.goto("about:blank"); await p.goto(f"http://127.0.0.1:8259/crew/test.html#/p/{prof}"); await p.wait_for_timeout(1500)
    async with p.expect_download() as dl: await p.click("[data-resume]")
    await (await dl.value).path(); await p.wait_for_timeout(300)
    n=await p.locator(".resnudge").count()
    print(f"viewer {who[-1]} on {prof[-1]}: nudge={n}", (await p.inner_text(".resnudge")) if n else "")
    if n:
        await p.click(".resnudge a"); await p.wait_for_timeout(1500)
        y=await p.evaluate("()=>document.getElementById('h1w').getBoundingClientRect().top")
        print("  hash:", await p.evaluate("location.hash"), "| Work history heading top px:", round(y))
    await p.close()
async def main():
    srv=subprocess.Popen(["python3","-m","http.server","8259","-d","/tmp/b159"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        c=await b.new_context(viewport={"width":820,"height":1100},accept_downloads=True); await c.expose_function("__db",op)
        await c.route("**/airports.json", lambda r: r.fulfill(status=200,content_type="application/json",body=AIR))
        await run(c,B,B,errs); await run(c,C,C,errs); await run(c,E,C,errs)
        print("errors:", errs); await b.close()
    srv.terminate()
asyncio.run(main())
