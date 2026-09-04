import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
    { name: 'Small Android', use: { viewport: { width: 360, height: 640 }, userAgent: devices['Pixel 5'].userAgent, isMobile: true, hasTouch: true } },
    { name: 'Narrow landscape', use: { viewport: { width: 740, height: 360 }, userAgent: devices['Pixel 5'].userAgent, isMobile: true, hasTouch: true } },
  ],
})
