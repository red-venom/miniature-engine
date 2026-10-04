import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

// Use a pre-installed Chromium when the sandbox cannot download Playwright's own build.
const local = '/opt/pw-browsers/chromium'
export default defineConfig({
  testDir: 'e2e',
  use: {
    deviceScaleFactor: 2,
    viewport: { width: 1100, height: 900 },
    launchOptions: existsSync(local) ? { executablePath: local } : {},
  },
})
