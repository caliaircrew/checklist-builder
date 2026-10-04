import asyncio, sys
from playwright.async_api import async_playwright
url=sys.argv[1]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":820,"height":1180}, has_touch=True)
        await pg.goto(url); await pg.wait_for_timeout(500)
        res=[]
        for r in [2,5,7,3]:
            await pg.click(f'.row[data-s="0"][data-r="{r}"] [data-menu]'); await pg.wait_for_timeout(120)
            opened=await pg.evaluate("!!document.querySelector('.menu')")
            res.append(opened)
            if opened: await pg.click('.menu button[data-k="down"]'); await pg.wait_for_timeout(120)
        # open then tap outside, then open another
        await pg.click('.row[data-s="0"][data-r="1"] [data-menu]'); await pg.wait_for_timeout(100)
        await pg.mouse.click(5,600); await pg.wait_for_timeout(100)
        closed=not await pg.evaluate("!!document.querySelector('.menu')")
        await pg.click('.row[data-s="0"][data-r="4"] [data-menu]'); await pg.wait_for_timeout(100)
        res.append(("outside-close",closed, await pg.evaluate("!!document.querySelector('.menu')")))
        # open one menu, then directly tap another row's dots
        await pg.click('.row[data-s="0"][data-r="6"] [data-menu]'); await pg.wait_for_timeout(100)
        res.append(("switch", await pg.evaluate("document.querySelectorAll('.menu').length")))
        print(res); await b.close()
asyncio.run(main())
