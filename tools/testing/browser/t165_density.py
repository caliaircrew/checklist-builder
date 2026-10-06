import asyncio, json, subprocess, time
from playwright.async_api import async_playwright
names=["PREFLIGHT","COCKPIT PREPARATION","BEFORE START","ENGINE START","AFTER START","TAXI","BEFORE TAKEOFF","TAKEOFF","CLIMB","CRUISE","DESCENT","APPROACH","LANDING","AFTER LANDING","SHUTDOWN","SECURING"]
import random; random.seed(3)
S={"operator":"PACIFIC COAST JET","aircraft":"Cessna 560XL Citation XLS","revision":"","version":"1.0","sections":[
 {"id":"s%d"%i,"title":n,"rows":[{"type":"item","item":random.choice(["Battery switch","Avionics master","Fuel quantity","Flight controls","Trims","Parking brake","Transponder","Pitot/static heat","Ignition"])+(" check" if j%3==0 else ""),"resp":random.choice(["ON","OFF","CHECKED","SET","AS REQUIRED"]),"ff":False} for j in range(random.randint(10,17))]} for i,n in enumerate(names)]}
async def main():
    srv=subprocess.Popen(["python3","-m","http.server","8266","-d","/tmp/b166"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); c=await b.new_context(viewport={"width":1180,"height":820},accept_downloads=True); p=await c.new_page(); errs=[]; p.on("pageerror",lambda e: errs.append(str(e)))
        await p.goto("http://127.0.0.1:8266/checklists/"); await p.evaluate("s=>localStorage.setItem('acb-checklist-v1',s)",json.dumps(S)); await p.reload(); await p.wait_for_timeout(1200)
        await p.evaluate("()=>document.querySelector(\"#tabs button[data-v=preview]\").click()"); await p.wait_for_timeout(800)
        for d in ["0","1","2"]:
            await p.click(f"#denSeg button[data-d='{d}']"); await p.wait_for_timeout(700)
            print(d, await p.inner_text("#pgcount"), "pages in DOM:", await p.locator(".page").count())
            await p.locator(".page").first.screenshot(path=f"/tmp/den{d}.png")
            async with p.expect_download() as dl: await p.click("#dlPdf")
            f=await (await dl.value).path(); open(f"/tmp/den{d}.pdf","wb").write(open(f,"rb").read())
            async with p.expect_download() as dl: await p.click("#dlWord")
            f=await (await dl.value).path(); open(f"/tmp/den{d}.docx","wb").write(open(f,"rb").read())
        await p.reload(); await p.wait_for_timeout(1000); await p.evaluate("()=>document.querySelector(\"#tabs button[data-v=preview]\").click()"); await p.wait_for_timeout(600)
        print("after reload remembers:", await p.inner_text("#denSeg button.on"))
        print("errors", errs); await b.close()
    srv.terminate()
asyncio.run(main())
