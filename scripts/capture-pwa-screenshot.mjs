import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 })
await page.addInitScript(() => sessionStorage.setItem('momentum-demo-active', '1'))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.getByRole('heading', { name: /Tayah/ }).waitFor()
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: 'public/screenshots/today-mobile.png' })
await browser.close()
