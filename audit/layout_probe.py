"""Responsive audit: horizontal overflow, clipped nav links, clipped Present button, at five viewport sizes."""
import asyncio, json, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/"
SIZES = [(390, 844, "phone"), (768, 1024, "tablet"), (1024, 768, "small-laptop"), (1366, 768, "laptop"), (1920, 1080, "desktop")]
VIEWS = ["city", "dashboard", "detection", "repairs", "analytics", "preferences"]
JS = """() => {
  const vw = document.documentElement.clientWidth;
  const out = { pageOverflowX: document.documentElement.scrollWidth - vw, clipped: [], hiddenNav: [] };
  const header = document.querySelector('header');
  if (header) out.headerOverflowX = header.scrollWidth - header.clientWidth;
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= vw + 1; };
  for (const b of document.querySelectorAll('header button, header a')) {
    const r = b.getBoundingClientRect();
    if (r.width === 0) continue;
    let p = b.parentElement, clippedBy = null;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible') { const pr = p.getBoundingClientRect(); if (r.left < pr.left - 1 || r.right > pr.right + 1) { clippedBy = p.tagName; break; } }
      p = p.parentElement;
    }
    if (!visible(b) || clippedBy) out.clipped.push((b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 30));
  }
  const nav = document.querySelector('nav[aria-label="Main"]');
  out.navReachable = nav ? [...nav.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0).length : 0;
  const menuBtn = document.querySelector('[data-testid="nav-menu"]');
  out.menuButton = !!(menuBtn && menuBtn.getBoundingClientRect().width > 0);
  const tiny = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && !e.closest('svg') && e.innerText && e.innerText.trim() && parseFloat(getComputedStyle(e).fontSize) < 11 && e.getBoundingClientRect().width > 0);
  out.textUnder11px = tiny.length;
  return out;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        report = {}
        for w, h, name in SIZES:
            pg = await b.new_page(viewport={"width": w, "height": h})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
            for v in VIEWS:
                await pg.goto(f"{BASE}#{v}"); await pg.wait_for_timeout(2500 if v != "city" else 6000)
                r = await pg.evaluate(JS)
                report[f"{name}/{v}"] = r
                if v in ("city", "dashboard"):
                    await pg.screenshot(path=f"/home/claude/shots/probe_{name}_{v}.png")
            report[f"{name}/errors"] = errs
            await pg.close()
        await b.close()
        bad = 0
        for k, r in report.items():
            if k.endswith("/errors"):
                if r: print("ERR", k, r); bad += 1
                continue
            flags = []
            if r["pageOverflowX"] > 1: flags.append(f"page overflow {r['pageOverflowX']}px")
            if r.get("headerOverflowX", 0) > 1: flags.append(f"header overflow {r['headerOverflowX']}px")
            if r["clipped"]: flags.append(f"clipped {r['clipped']}")
            if r["navReachable"] < 9 and not r["menuButton"]: flags.append(f"only {r['navReachable']}/9 nav links rendered")
            print(("FAIL " if flags else "ok   ") + k, "; ".join(flags), f"(text<11px: {r['textUnder11px']})")
            bad += bool(flags)
        print("TOTAL FAILING CHECKS:", bad)
asyncio.run(main())
