import asyncio, sys, subprocess
sys.path.insert(0,'/tmp'); from bridge import *
U='00000000-0000-0000-0000-0000000000e4'
subprocess.run(["su","postgres","-c",f"psql -q -d sb -c \"insert into auth.users(id,email) values ('{U}','leaver4@example.com') on conflict do nothing; insert into public.crew_profiles(user_id,display_name) values ('{U}','Leaver') on conflict do nothing; insert into public.account_recovery(user_id,backup_email) values ('{U}','b@example.com') on conflict do nothing;\""],check=True)
make_test_page('/tmp/b136/crew/index.html','/tmp/b136/crew/test.html')
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        c=await b.new_context(viewport={"width":1180,"height":1000}); await c.expose_function("__db",op); p=await c.new_page(); p.on("pageerror",lambda e: errs.append(str(e))); p.on("dialog",lambda d: asyncio.ensure_future(d.accept()))
        await p.goto("file:///tmp/b136/crew/test.html#/account"); await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{U}',email:'leaver4@example.com'}},aal:'aal1'}}))"); await p.reload(); await p.wait_for_timeout(1200)
        await p.fill("#de","Leaver4@Example.com"); await p.click("#del")
        await p.wait_for_function("document.querySelector('h1') && document.querySelector('h1').textContent==='Account deleted' || (document.getElementById('dem')||{}).textContent", timeout=8000)
        print("page:", await p.inner_text("h1"), "| msg:", await p.evaluate("(document.getElementById('dem')||{}).textContent||''"))
        print("user rows:", sql(f"select count(*) n from auth.users where id='{U}'")[0]["n"], "| profile rows:", sql(f"select count(*) n from public.crew_profiles where user_id='{U}'")[0]["n"], "| recovery rows:", sql(f"select count(*) n from public.account_recovery where user_id='{U}'")[0]["n"], "| signed out:", await p.evaluate("localStorage.getItem('acb-auth')===null"))
        print("errors:", errs); await b.close()
asyncio.run(main())
