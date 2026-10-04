import asyncio, sys, subprocess, time
sys.path.insert(0,'/tmp'); from bridge import *
make_test_page('/tmp/b200/admin/index.html','/tmp/b200/admin/test.html')
A='00000000-0000-0000-0000-00000000000a'
sql("update public.contact_requests set status='reported', report_reason='spam' where sender_id='00000000-0000-0000-0000-00000000000c'")
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(["python3","-m","http.server","8201","-d","/tmp/b200"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        c=await b.new_context(viewport={"width":1280,"height":1000}); await c.expose_function("__db",op)
        p=await c.new_page(); p.on("pageerror",lambda e: errs.append(str(e)))
        await p.goto("http://127.0.0.1:8201/admin/test.html"); await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{A}',email:'james@caliaircrew.com'}},aal:'aal2'}}))")
        await p.goto("about:blank"); await p.goto("http://127.0.0.1:8201/admin/test.html#requests"); await p.wait_for_timeout(2500)
        t=await p.inner_text("body"); i=t.find("Contact requests"); print(t[i:i+400].replace("\n"," | "))
        print("BODY:", t[:300].replace("\n"," | ")); await p.click("[data-cr]"); await p.wait_for_timeout(1500)
        print("after Reviewed:", sql("select status from public.contact_requests where sender_id='00000000-0000-0000-0000-00000000000c'"), "errors:", errs)
        await b.close()
    srv.terminate()
asyncio.run(main())
