import asyncio, sys, subprocess, time
sys.path.insert(0,'/tmp'); from bridge import *
make_test_page('/tmp/b160/crew/index.html','/tmp/b160/crew/test.html')
C='00000000-0000-0000-0000-00000000000c'
AIR=open('/tmp/b160/crew/airports.json').read()
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(["python3","-m","http.server","8260","-d","/tmp/b160"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        for w,h,name in [(820,1180,"portrait"),(1180,820,"landscape"),(390,844,"phone")]:
            c=await b.new_context(viewport={"width":w,"height":h},device_scale_factor=1); await c.expose_function("__db",op)
            await c.route("**/airports.json", lambda r: r.fulfill(status=200,content_type="application/json",body=AIR))
            p=await c.new_page(); p.on("pageerror",lambda e: errs.append(str(e)))
            await p.goto("http://127.0.0.1:8260/crew/test.html")
            await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{C}',email:'c@example.com'}},aal:'aal1'}}))")
            await p.goto("about:blank"); await p.goto("http://127.0.0.1:8260/crew/test.html#/me"); await p.wait_for_timeout(1800)
            n=await p.locator(".acrow").count(); print(name,"rows",n)
            if n:
                r=p.locator(".acrow").nth(1) if n>1 else p.locator(".acrow").first
                await r.scroll_into_view_if_needed(); await r.screenshot(path=f"/tmp/ac_{name}.png")
                # overflow check: any child wider than row
                ov=await p.evaluate("()=>{const out=[];document.querySelectorAll('.acrow').forEach(r=>{const R=r.getBoundingClientRect();r.querySelectorAll('*').forEach(e=>{const b=e.getBoundingClientRect();if(b.width&&b.right>R.right+1)out.push(e.tagName+'.'+e.className)})});return out.slice(0,5)}")
                print("  overflow:",ov)
                # type into PIC and check data saved in D via preview
                await p.fill(f"#pc0","1234"); await p.wait_for_timeout(300)
            await c.close()
        print("errors:",errs); await b.close()
    srv.terminate()
asyncio.run(main())
