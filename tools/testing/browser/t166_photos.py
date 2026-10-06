# 1.66 profile photos end to end: upload (pending, private) → admin approves → public profile + résumé PDF → admin removes.
import asyncio, sys, subprocess, time
sys.path.insert(0,'/tmp'); from bridge import *
for pg in ("crew","admin"): make_test_page(f'/tmp/b166p/{pg}/index.html',f'/tmp/b166p/{pg}/test.html')
A='00000000-0000-0000-0000-00000000000a'; C='00000000-0000-0000-0000-00000000000c'
AIR=open('/tmp/b166p/crew/airports.json').read()
from playwright.async_api import async_playwright
def ok(c,m): print(("PASS " if c else "FAIL ")+m)
async def page(c,who,email,url,aal="aal1"):
    p=await c.new_page(); p.on("pageerror",lambda e: print("PAGEERROR",e)); p.on("dialog",lambda d: asyncio.ensure_future(d.accept()))
    await p.goto(url.split("#")[0])
    if who: await p.evaluate(f"()=>localStorage.setItem('acb-auth',JSON.stringify({{user:{{id:'{who}',email:'{email}'}},aal:'{aal}'}}))")
    else: await p.evaluate("()=>localStorage.removeItem('acb-auth')")
    await p.goto("about:blank"); await p.goto(url); await p.wait_for_timeout(2000); return p
async def main():
    sql(f"update crew_profiles set photo='' where user_id='{C}'"); sql(f"update moderation set photo_ok='' where user_id='{C}'"); sql("delete from storage.objects where bucket_id='crew-photos'")
    srv=subprocess.Popen(["python3","-m","http.server","8267","-d","/tmp/b166p"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); c=await b.new_context(viewport={"width":820,"height":1180},accept_downloads=True); await c.expose_function("__db",op)
        await c.route("**/airports.json", lambda r: r.fulfill(status=200,content_type="application/json",body=AIR))
        base="http://127.0.0.1:8267"
        p=await page(c,C,"c@example.com",base+"/crew/test.html#/me")
        await p.set_input_files("#phf","/tmp/face.png"); await p.wait_for_timeout(1500)
        st=await p.inner_text("#phst"); ok("Waiting for review" in st,"after upload: "+st)
        ok(await p.locator("#phbox img").count()==1 and await p.locator("#prev img.avatar").count()==1,"own photo shown in editor and preview")
        path=sql(f"select photo from crew_profiles where user_id='{C}'")[0]["photo"]; ok(path.startswith(C+"/") and path.endswith(".jpg"),"stored as "+path)
        await p.screenshot(path="/tmp/ph_editor.png",clip={"x":0,"y":0,"width":820,"height":700})
        await p.check("#rph2"); await p.click("#save"); await p.wait_for_timeout(1500)
        ok(sql(f"select details->>'resume_photo' r from crew_profiles where user_id='{C}'")[0]["r"]=="true","résumé photo choice saved"); await p.close()
        p=await page(c,None,"",base+f"/crew/test.html#/p/{C}")
        ok(await p.locator(".pcard img.avatar").count()==0,"public profile: no photo before approval"); await p.close()
        p=await page(c,A,"james@caliaircrew.com",base+"/admin/test.html#review","aal2")
        ok(await p.locator("[data-pid] img").count()==1,"admin sees the photo in the queue")
        await p.click("[data-ph=ok]"); await p.wait_for_timeout(1500)
        ok(sql(f"select photo_ok from moderation where user_id='{C}'")[0]["photo_ok"]==path,"approved"); await p.close()
        p=await page(c,None,"",base+f"/crew/test.html#/p/{C}")
        ok(await p.locator(".pcard img.avatar").count()==1,"public profile shows the approved photo")
        await p.screenshot(path="/tmp/ph_public.png",clip={"x":0,"y":0,"width":820,"height":360})
        ok(await p.locator(".rlist img, .results img").count()==0,"(profile page only)")
        async with p.expect_download() as dl: await p.click("[data-resume]")
        f=await (await dl.value).path(); pdf=open(f,'rb').read(); open('/tmp/ph_resume.pdf','wb').write(pdf)
        ok(b"/DCTDecode" in pdf and b"/Im1 Do" in pdf,"résumé PDF embeds the photo"); await p.close()
        p=await page(c,None,"",base+"/crew/test.html#/")
        ok(await p.locator("img.avatar").count()==0,"search results: no photos"); await p.close()
        p=await page(c,A,"james@caliaircrew.com",base+"/admin/test.html#review","aal2")
        ok(await p.locator("[data-pid]").count()==0,"queue empty after approval"); await p.close()
        # new photo → pending again; admin removes it
        p=await page(c,C,"c@example.com",base+"/crew/test.html#/me"); await p.set_input_files("#phf","/tmp/face.png"); await p.wait_for_timeout(1500); await p.close()
        ok(sql("select count(*) n from storage.objects where bucket_id='crew-photos'")[0]["n"]==1,"old file deleted when replaced")
        p=await page(c,None,"",base+f"/crew/test.html#/p/{C}"); ok(await p.locator(".pcard img.avatar").count()==0,"changed photo hidden until re-approved"); await p.close()
        p=await page(c,A,"james@caliaircrew.com",base+"/admin/test.html#review","aal2"); await p.click("[data-ph=rm]"); await p.wait_for_timeout(1500); await p.close()
        ok(sql(f"select photo from crew_profiles where user_id='{C}'")[0]["photo"]=="" and sql("select count(*) n from storage.objects where bucket_id='crew-photos'")[0]["n"]==0,"admin removal clears profile and file")
        await b.close()
    srv.terminate()
asyncio.run(main())
