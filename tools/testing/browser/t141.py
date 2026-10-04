import asyncio, sys, json
sys.path.insert(0,'/tmp'); from bridge import *
make_test_page('/tmp/b141/crew/index.html','/tmp/b141/crew/test.html')
D='00000000-0000-0000-0000-00000000000d'
AIR=open('/tmp/b141/crew/airports.json').read()
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        c=await b.new_context(viewport={"width":1280,"height":1000}); await c.expose_function("__db",op)
        await c.route("**/airports.json", lambda r: r.fulfill(status=200,content_type="application/json",body=AIR))
        p=await c.new_page(); p.on("pageerror",lambda e: errs.append(str(e))); p.on("dialog",lambda d: asyncio.ensure_future(d.accept()))
        if not sql(f"select 1 from auth.users where id='{D}'"): sql(f"insert into auth.users(id,email) values('{D}','pilotd@example.com')")
        await p.goto("http://127.0.0.1:8141/crew/test.html#/me"); await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{D}',email:'pilotd@example.com'}},aal:'aal1'}}))"); await p.reload(); await p.wait_for_timeout(1500)
        await p.fill("#dn","Dana Pilot")
        for v in ["airplane_pilot","flight_attendant","mechanic","helicopter_pilot"]:
            box=p.locator(f"input[name=ct][value={v}]")
            if not await box.is_checked(): await box.check()
        await p.wait_for_timeout(200)
        print("role sections visible:", [await p.is_visible(x) for x in ("#secfa","#secmx","#secheli")])
        await p.fill("#apt","ccr"); await p.wait_for_timeout(200); print("airport hint:", await p.inner_text("#aptcity"))
        await p.fill("#apt","zzzz"); await p.wait_for_timeout(200); print("bad code hint:", await p.inner_text("#aptcity"))
        await p.fill("#apt","KVNY")
        # aircraft: add CJ3 and Citation XLS
        for q in ["cj3","citation xls"]:
            await p.fill("#acq",q); await p.wait_for_timeout(200); await p.locator("#acres button").first.click(); await p.wait_for_timeout(200)
        nowboxes=p.locator("[data-now]"); print("aircraft rows:", await nowboxes.count())
        await nowboxes.nth(1).uncheck(); await p.wait_for_timeout(150)
        await p.fill("#tt","6800"); await p.fill("#hpic","4200"); await p.fill("#htur","3900"); await p.fill("#hhel","650")
        await p.select_option("#rate","1500"); await p.check("#rexp"); await p.check("#rneg")
        await p.select_option("#fas","facts"); await p.select_option("#fay","2019")
        opts=await p.evaluate("[...document.querySelectorAll('#far option')].map(o=>o.value)"); await p.select_option("#far",opts[20]); await p.select_option("#cpr",opts[2])
        await p.check("#food"); await p.check("input[name=fsk][value=intl]"); await p.check("input[name=fsk][value=wine]")
        await p.check("input[name=mxc][value=ap]"); await p.check("input[name=mxc][value=ia]"); await p.check("input[name=mxe][value=fj44]"); await p.check("input[name=mxs][value=avionics]"); await p.check("#aog")
        await p.fill("#hht","400"); await p.fill("#hhp","250"); await p.check("input[name=hop][value=nvg]"); await p.check("input[name=hop][value=longline]"); await p.check("input[name=s73][value=r44]")
        await p.wait_for_timeout(300)
        prev=await p.inner_text("#prev")
        print("\nPREVIEW:\n"+"\n".join(l for l in prev.split("\n") if l.strip())[:1600])
        await p.click("#save"); await p.wait_for_timeout(1200); print("\nsave status:", await p.inner_text("#st"), await p.inner_text("#se"))
        d=sql(f"select details from public.crew_profiles where user_id='{D}'")[0]["details"]
        print("saved:", {k:d.get(k) for k in ["airport","rate","rate_exp","rate_neg","past","hrs_pic","fa_school","fa_recurrent","cpr_until","mx_certs","heli_ops","sfar73"]})
        await p.screenshot(path="/tmp/me141.png")
        # uncheck mechanic -> mechanic data cleared on save
        await p.locator("input[name=ct][value=mechanic]").uncheck(); await p.wait_for_timeout(150); print("mx hidden after unticking:", not await p.is_visible("#secmx"))
        await p.click("#save"); await p.wait_for_timeout(1000); print("mx cleared:", sql(f"select details->'mx_certs' m from public.crew_profiles where user_id='{D}'")[0]["m"])
        print("errors:", errs); await b.close()
asyncio.run(main())
