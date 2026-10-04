import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":820,"height":1180}, accept_downloads=True); pg=await ctx.new_page()
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///tmp/b143/checklists/index.html"); await pg.wait_for_timeout(400)
        await pg.fill("#aQ","a36"); await pg.wait_for_timeout(80); await pg.click("#aRes button >> nth=0"); await pg.wait_for_timeout(250)
        rows=lambda: pg.evaluate("JSON.parse(localStorage.getItem('acb-checklist-v1')).sections[0].rows.map(r=>r.item||r.text)")
        my=lambda: pg.evaluate("JSON.parse(localStorage.getItem('acb-myitems-v1')||'{}')")
        # 1. add two own items in Preflight via picker (save box ticked by default)
        await pg.click('.sec[data-s="0"] [data-pick]'); await pg.wait_for_timeout(150)
        for a,r in [("Oil Dipstick","SECURE"),("Prop Nicks","NONE")]:
            await pg.fill("#ownI",a); await pg.fill("#ownR",r); await pg.click("#ownAdd"); await pg.wait_for_timeout(60)
        await pg.click("#pkDone"); await pg.wait_for_timeout(150)
        # 2. save an existing line via the ... menu
        await pg.click('.row[data-s="0"][data-r="2"] [data-menu]'); await pg.wait_for_timeout(80)
        print("menu has save option:", await pg.evaluate("[...document.querySelectorAll('.menu button')].map(b=>b.textContent).filter(t=>t.includes('My items'))"))
        await pg.click('.menu button[data-k="my"]'); await pg.wait_for_timeout(80)
        print("1-2 My items stored:", await my())
        print("   preflight has own lines:", [x for x in await rows() if x in ("Oil Dipstick","Prop Nicks")])
        # 3. reset -> own lines gone from checklist, still in My items
        await pg.click("#resetDef"); await pg.wait_for_timeout(250)
        print("3 after reset, own lines in checklist:", [x for x in await rows() if x in ("Oil Dipstick","Prop Nicks")], "| My items kept:", len((await my()).get("PREFLIGHT",[])))
        # 4. picker shows My items at top; tick one back in; remove one from My items
        await pg.click('.sec[data-s="0"] [data-pick]'); await pg.wait_for_timeout(150)
        print("4 My items group:", await pg.evaluate("[...document.querySelectorAll('#pkList .pi.my .it')].map(x=>x.textContent)"))
        await pg.click('#pkList input[data-my="0"]'); await pg.wait_for_timeout(80)
        await pg.click('#pkList [data-myx="1"]'); await pg.wait_for_timeout(80)
        print("   after tick #0 and ✕ #1:", await pg.evaluate("[...document.querySelectorAll('#pkList .pi.my .it')].map(x=>x.textContent)"))
        await pg.click("#pkDone"); await pg.wait_for_timeout(120)
        print("   Oil Dipstick back in checklist:", "Oil Dipstick" in await rows())
        # 5. other section's picker does not show Preflight's items
        await pg.click('.sec[data-s="1"] [data-pick]'); await pg.wait_for_timeout(150)
        print("5 Before Start My items:", await pg.evaluate("document.querySelectorAll('#pkList .pi.my').length")); await pg.click("#pkDone")
        # 6. survives reload
        await pg.reload(); await pg.wait_for_timeout(400); print("6 after reload:", len((await my()).get("PREFLIGHT",[])))
        # 7. checklist file carries My items to a fresh device
        async with pg.expect_download() as d: await pg.click("#saveJson")
        path="/tmp/mytest.json"; await (await d.value).save_as(path); print("7 file has myItems:", list(json.load(open(path)).get("myItems",{}).keys()))
        ctx2=await b.new_context(); p2=await ctx2.new_page(); p2.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await p2.goto("file:///tmp/b143/checklists/index.html"); await p2.wait_for_timeout(300)
        await p2.set_input_files("#fileIn", path); await p2.wait_for_timeout(300)
        print("   fresh device after Open:", await p2.evaluate("JSON.parse(localStorage.getItem('acb-myitems-v1')||'{}')"))
        print("errors", errs); await b.close()
asyncio.run(main())
