import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":820,"height":1180})
        dialogs=[]; accept={"v":True}
        async def on_d(d): dialogs.append(d.message.split("\n")[0]); await (d.accept() if accept["v"] else d.dismiss())
        pg.on("dialog", lambda d: asyncio.ensure_future(on_d(d)))
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///tmp/b143/checklists/index.html"); await pg.wait_for_timeout(500)
        st=lambda: pg.evaluate("JSON.parse(localStorage.getItem('acb-checklist-v1'))")
        async def pick(q):
            if await pg.is_visible("#aClr"): await pg.click("#aClr"); await pg.wait_for_timeout(80)
            await pg.fill("#aQ",q); await pg.wait_for_timeout(80); await pg.click("#aRes button >> nth=0"); await pg.wait_for_timeout(250)
        def items(s): return [(x['title'],[r.get('item') or r.get('text') for r in x['rows']]) for x in s['sections']]
        await pick("a36 bonanza"); s=await st(); it=items(s); allit=[i for _,l in it for i in l]
        print("1 Bonanza: dialogs",len(dialogs),"| sections",[t for t,_ in it])
        print("  has gear:", "Landing Gear Handle" in allit or "Positive Rate" in allit, "| magnetos:", "Magnetos" in allit, "| thrust rev/APU/ITT:", any(x in allit for x in ["Thrust Reversers","APU","ITT"]))
        await pick("phenom 300"); s=await st(); allit=[i for _,l in items(s) for i in l]
        print("2 Phenom 300: dialogs",len(dialogs),"| sections",len(s['sections']),"| magnetos/mixture:", any(x in allit for x in ["Magnetos","Mixture"]),"| ITT/N1:", "ITT" in allit and "N1 Rotation" in allit, "| climb/transition:", any(t=="CLIMB / TRANSITION" for t,_ in items(s)))
        await pick("citation xls"); s=await st(); print("3 Citation XLS (model): dialogs",len(dialogs),"| first section:", s['sections'][0]['title'], "| kind", s['basedOn']['kind'])
        # edit: delete a line, then switch aircraft -> must ask
        await pg.click('.row[data-s="0"][data-r="1"] [data-menu]'); await pg.click('.menu button[data-k="del"]'); await pg.wait_for_timeout(150)
        accept["v"]=False; await pick("cessna 172r"); s=await st()
        print("4 after edit, switch to 172S & CANCEL: dialogs",dialogs[-1:], "| still XLS lines:", s['sections'][0]['title'])
        accept["v"]=True
        await pg.click("#aLoad"); await pg.wait_for_timeout(250); s=await st()
        print("5 top Reset (aircraft now 172S): dialog",dialogs[-1:], "| first section:", s['sections'][0]['title'], "| kind", s['basedOn']['kind'])
        await pg.click('.sec[data-s="0"] [data-pick]'); await pg.wait_for_timeout(150)
        await pg.click('#pkList input[data-i="0"]'); await pg.click("#pkDone"); await pg.wait_for_timeout(150)
        n_before=len((await st())['sections'][0]['rows'])
        await pg.click("#resetDef"); await pg.wait_for_timeout(250); s=await st()
        print("6 Step-2 Reset after adding an item: rows",n_before,"->",len(s['sections'][0]['rows']),"| dialog",dialogs[-1:])
        await pick("phenom 300"); print("7 switch right after reset asks?", len(dialogs), "(no new dialog expected)")
        # note filtering: piston preflight pick list must not show the turbine-only fire-warning note
        await pick("archer"); await pg.click('.sec[data-s="0"] [data-pick]'); await pg.wait_for_timeout(150)
        await pg.select_option("#pkLib","PREFLIGHT"); await pg.wait_for_timeout(100)
        notes=await pg.evaluate("[...document.querySelectorAll('#pkList .pi.nt .it')].map(x=>x.textContent)")
        print("8 piston Preflight list notes:", notes)
        await pg.click("#pkDone")
        await pg.screenshot(path="/tmp/def_top.png", clip={"x":0,"y":60,"width":820,"height":520})
        print("errors",errs); await b.close()
asyncio.run(main())
