import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for RegPulse E2E suite.
 *
 * Runs against `docker compose up` stack — frontend on :3000, backend on :8000.
 * Set `RP_BASE_URL` to point elsewhere (e.g. staging) on the command line.
 *
 * Local: `make e2e` (alias for `npx playwright test` from frontend/).
 * CI: spins up docker compose, waits for /api/v1/health, then runs this suite.
 */
const BASE_URL = process.env.RP_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
