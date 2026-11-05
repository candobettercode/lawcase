"""Public booking split-screen, keyboard and mobile checks.
Run: python3 scripts/qa/booking-layout.py with localhost:8080 running.
Requires Playwright. No hold is acquired and no booking is submitted.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    screenshots = Path("/tmp/browser/booking-layout-qa")
    screenshots.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for width in [1589, 1280, 1024, 900, 390, 360]:
            context = await browser.new_context(viewport={"width": 1280, "height": 1800}, timezone_id="Asia/Kolkata")
            page = await context.new_page()
            await page.set_viewport_size({"width": width, "height": 1000})
            await page.goto("http://localhost:8080", wait_until="networkidle")
            assert await page.get_by_role("navigation").count() == 0
            assert await page.get_by_role("button", name="In-person", exact=True).get_attribute("aria-pressed") == "true"
            assert await page.get_by_role("button", name="Phone", exact=True).count() == 0
            brand = await page.locator(".booking-brand").bounding_box()
            workspace = await page.locator(".booking-workspace").bounding_box()
            assert brand and workspace
            if width >= 1024:
                assert abs(brand["width"] / width - 0.4) < 0.01
                assert abs(workspace["width"] / width - 0.6) < 0.01
                assert await page.locator(".booking-brand").evaluate("el => getComputedStyle(el).position") == "fixed"
            else:
                assert workspace["y"] >= brand["y"] + brand["height"]
            day = page.locator('.booking-calendar button[aria-disabled="false"]').first
            await day.wait_for()
            await day.focus()
            await page.keyboard.press("Enter")
            await page.get_by_role("region", name="Available times").get_by_role("button", name="12h", exact=True).wait_for()
            assert not await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
            rect = await day.bounding_box()
            assert rect and rect["width"] >= 44 and rect["height"] >= 44
            assert await page.locator("#visitor-zone").input_value() in ["Asia/Kolkata", "Asia/Calcutta"]
            calendar = await page.locator(".booking-calendar").bounding_box()
            slots = await page.get_by_role("region", name="Available times").bounding_box()
            assert calendar and slots
            content_width = await page.locator(".booking-date-time").evaluate("el => el.getBoundingClientRect().width")
            if content_width < 620:
                assert slots["y"] >= calendar["y"] + calendar["height"]
            else:
                assert slots["x"] > calendar["x"]
            await page.screenshot(path=str(screenshots / f"booking-{width}.png"))
            print(f"{width}px: split/stack, default mode, keyboard, 44px targets, time zone and panel placement passed")
            await context.close()
        await browser.close()

asyncio.run(main())
