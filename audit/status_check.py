"""Backend status indicator: connected → backend stopped → restarted, plus cold start with backend down."""
import asyncio, subprocess, time
from playwright.async_api import async_playwright
UI = "http://localhost:4173/"
def start_backend():
    subprocess.Popen("cd /home/claude/roadiq/backend && nohup python3 -m uvicorn app.main:app --port 8000 > /tmp/uvicorn.log 2>&1 &", shell=True)
    time.sleep(4)
def stop_backend():
    subprocess.run("pkill -f 'uvicorn app.main:app'", shell=True); time.sleep(1)
async def chips(pg):
    return await pg.locator('header').first.inner_text()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":1440,"height":900})
        await pg.goto(UI + "#detection"); await pg.wait_for_timeout(3500)
        h = await chips(pg); print("1 connected:", "Backend connected" in h, "| demo label:", "Demo dataset" in h)
        stop_backend()
        await pg.wait_for_timeout(17000)
        h = await chips(pg); print("2 after stop:", "Backend unavailable" in h)
        print("  run-detection disabled:", await pg.get_by_role("button", name="Run detection").is_disabled())
        await pg.screenshot(path="/home/claude/shots/status_down.png")
        start_backend()
        await pg.wait_for_timeout(17000)
        h = await chips(pg); print("3 after restart:", "Backend connected" in h)
        stop_backend()
        pg2 = await b.new_page(viewport={"width":1440,"height":900})
        await pg2.goto(UI + "#city"); await pg2.wait_for_timeout(9000)
        h = await chips(pg2); print("4 cold start, backend down:", "Backend unavailable · cached demo data" in h)
        await pg2.screenshot(path="/home/claude/shots/status_coldstart.png")
        await b.close()
    start_backend()
asyncio.run(main())
