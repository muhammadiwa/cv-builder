import { expect, test } from "@playwright/test";

/**
 * Smoke test: the landing page boots and the hero is visible.
 *
 * This is the load-bearing assertion that proves the Playwright harness
 * is wired correctly — the dev server starts, Next.js compiles the
 * route, and the rendered DOM is reachable from a browser.
 */
test("landing page renders the hero heading", async ({ page }) => {
  await page.goto("/");
  // The hero copy is ID-localized; we match a fragment we expect to be
  // stable across copy edits — "ATS" appears in the headline + nearby copy.
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator("body")).toContainText(/ATS/i);
});
