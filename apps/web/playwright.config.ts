import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for @lolos/web.
 *
 * - `webServer.command` boots the Next.js dev server on the port we use
 *   in development. CI shares the same port; the `reuseExistingServer`
 *   flag lets local runs piggy-back on a long-running `pnpm dev`.
 * - We pin to chromium + webkit for the smoke pass; firefox can be added
 *   when the surface stabilises.
 * - In CI we drop parallelism to 1 to keep flakiness from concurrent
 *   port acquisition off the table.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
