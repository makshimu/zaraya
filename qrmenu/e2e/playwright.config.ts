import { defineConfig } from '@playwright/test'

// Runs against a live stack: `docker compose up -d` first, then `npx playwright test`.
export default defineConfig({
  testDir: './tests',
  // Tests change restaurant-wide settings (TTL, "table must be open"): run them one at a time
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://localhost',
    ignoreHTTPSErrors: true, // Caddy's local certificate for localhost
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
