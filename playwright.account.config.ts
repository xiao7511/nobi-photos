import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/account-e2e',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4399',
    channel: process.env.NOBI_BROWSER_CHANNEL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js preview --outDir artifacts/account-dist --port 4399 --strictPort',
    url: 'http://127.0.0.1:4399',
    reuseExistingServer: false,
  },
})
