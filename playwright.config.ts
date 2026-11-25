import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir:'tests',testMatch:'**/*.spec.ts', timeout:120_000, workers:1,
  use:{actionTimeout:15_000,baseURL:'http://127.0.0.1:4173',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined}},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}],
  webServer:{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --strictPort',url:'http://127.0.0.1:4173/kartvizit/',reuseExistingServer:!process.env.CI},
})
