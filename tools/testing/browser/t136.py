import asyncio, sys, subprocess
sys.path.insert(0,'/tmp'); from bridge import *
make_test_page('/tmp/b136/crew/index.html','/tmp/b136/crew/test.html'); make_test_page('/tmp/b136/admin/index.html','/tmp/b136/admin/test.html')
D='00000000-0000-0000-0000-00000000000d'
subprocess.run(["su","postgres","-c",f"psql -q -d sb -c \"delete from public.account_recovery; delete from public.help_requests; delete from auth.mfa_factors where user_id='{D}'\""],check=True)
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        c=await b.new_context(viewport={"width":1180,"height":1000},accept_downloads=True); await c.expose_function("__db",op); p=await c.new_page(); p.on("pageerror",lambda e: errs.append(str(e))); p.on("dialog",lambda d: asyncio.ensure_future(d.accept()))
        await p.goto("file:///tmp/b136/crew/test.html#/account"); await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{D}',email:'pilotd@example.com'}},aal:'aal1'}}))"); await p.reload(); await p.wait_for_timeout(1200)
        print("1 account page:", await p.inner_text("h1"), "| sections:", await p.evaluate("[...document.querySelectorAll('.panel h2')].map(h=>h.textContent)"))
        await p.fill("#ne","diane.new@example.com"); await p.click("#nes"); await p.wait_for_timeout(300); print("2 change email:", await p.inner_text("#nem"), "|", await p.evaluate("window.__lastUpdateUser"))
        await p.click("#mfon"); await p.wait_for_timeout(500); print("3 QR shown:", await p.locator("#mfa img").count()==1)
        await p.fill("#mfc","111111"); await p.click("#mfok"); await p.wait_for_timeout(300); print("   wrong code:", await p.inner_text("#mfe"))
        await p.fill("#mfc","654321"); await p.click("#mfok"); await p.wait_for_timeout(500); print("   right code:", (await p.inner_text("#mfa")).split("\n")[0], "| db:", sql(f"select status from auth.mfa_factors where user_id='{D}'"))
        await p.fill("#rbe","pilotd@example.com"); await p.click("#rs"); await p.wait_for_timeout(300); print("4 same as sign-in blocked:", await p.inner_text("#rsm"))
        await p.fill("#rbe","diane.backup@example.com"); await p.fill("#rph","760-555-0101"); await p.click("#rs"); await p.wait_for_timeout(500); print("   saved:", await p.inner_text("#rsm"), sql("select backup_email, phone, backup_confirmed from public.account_recovery"))
        async with p.expect_download() as dl: await p.click("#dl")
        import json; d=json.load(open(await (await dl.value).path())); print("5 download keys:", sorted(d.keys())[:7], "... recovery:", d["recovery_contacts"][0]["backup_email"])
        await p.click("#mfoff"); await p.wait_for_timeout(600); print("6 authenticator off:", "Turn on" in await p.inner_text("#mfa"), sql(f"select count(*) n from auth.mfa_factors where user_id='{D}'")[0]["n"])
        # help request from sign-in box (signed out)
        q=await (await b.new_context(viewport={"width":390,"height":844})).new_page(); await q.context.expose_function("__db",op); q.on("pageerror",lambda e: errs.append(str(e)))
        await q.goto("file:///tmp/b136/crew/test.html#/me"); await q.wait_for_timeout(500); await q.click("#go"); await q.click("#sihelp"); await q.fill("#hre","diane.home@example.com"); await q.fill("#hrm","Lost my phone; old sign-in pilotd@example.com"); await q.click("#hrs"); await q.wait_for_timeout(500)
        print("7 help request:", (await q.inner_text(".box2 h2")), sql("select email, status from public.help_requests"))
        a=await c.new_page(); a.on("pageerror",lambda e: errs.append(str(e))); await a.goto("file:///tmp/b136/admin/test.html#requests"); await a.evaluate("()=>localStorage.setItem('acb-auth',JSON.stringify({user:{id:'00000000-0000-0000-0000-00000000000a',email:'james@caliaircrew.com'},aal:'aal1'}))"); await a.reload(); await a.wait_for_timeout(1300)
        print("8 admin Requests badge:", await a.inner_text("a[href='#requests']"), "| help row:", (await a.inner_text(".tbl tbody tr >> nth=0"))[:70])
        await a.click("a[href='#users']"); await a.wait_for_timeout(400); print("9 Users shows recovery:", "diane.backup@example.com" in await a.inner_text(".tbl"))
        # delete my account
        await p.fill("#de","wrong@example.com"); await p.click("#del"); await p.wait_for_timeout(400); print("10 wrong email:", await p.inner_text("#dem"))
        await p.fill("#de","pilotd@example.com"); await p.click("#del"); await p.wait_for_timeout(700); print("   deleted:", await p.inner_text("h1"), "| user rows:", sql(f"select count(*) n from auth.users where id='{D}'")[0]["n"], "| profile rows:", sql(f"select count(*) n from public.crew_profiles where user_id='{D}'")[0]["n"])
        print("errors:", errs); await b.close()
asyncio.run(main())
