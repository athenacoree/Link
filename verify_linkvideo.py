import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        await page.goto("http://localhost:3000")
        await page.wait_for_timeout(2000)

        # Force state: hide authScreen, show appShell, activate vistaAilab (Link Video Hub)
        await page.evaluate("""() => {
            const auth = document.getElementById('authScreen');
            if (auth) auth.style.display = 'none';
            const shell = document.getElementById('appShell');
            if (shell) shell.style.display = 'block';

            document.querySelectorAll('.vista-app').forEach(v => v.classList.remove('active'));
            const vista = document.getElementById('vistaAilab');
            if (vista) {
                vista.classList.add('active');
                vista.style.display = 'block';
            }

            window.currentUser = { id: 1, username: 'testuser', is_admin: false };
            if (window.LinkVideo && typeof window.LinkVideo.init === 'function') {
                window.LinkVideo.init();
            }
        }""")

        await page.wait_for_timeout(3000)
        await page.screenshot(path="/home/jules/verification/verification.png")
        await browser.close()

asyncio.run(run())
