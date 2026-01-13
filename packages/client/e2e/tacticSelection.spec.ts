import { test, expect } from "@playwright/test";

/**
 * Visual screenshot test for tactic selection UI iteration.
 * Run with: pnpm exec playwright test tacticSelection --headed
 * Screenshots saved to: e2e/screenshots/tactic-*.png
 */

test.describe("Tactic Selection Visual", () => {
  test("captures tactic selection with board visible", async ({ page }) => {
    await page.goto("/?seed=123");

    // Wait for tactic hand to appear (new non-modal approach)
    await expect(page.locator('[data-testid="tactic-card-early_bird"]')).toBeVisible();

    // Wait for entrance animations
    await page.waitForTimeout(500);

    // Capture - should show board with tactic cards fanned above hand
    await page.screenshot({
      path: "e2e/screenshots/tactic-day.png",
      fullPage: false,
    });
  });

  test("captures tactic card hover state", async ({ page }) => {
    await page.goto("/?seed=123");

    await expect(page.locator('[data-testid="tactic-card-rethink"]')).toBeVisible();
    await page.waitForTimeout(500);

    // Hover over Rethink card
    const rethinkCard = page.locator('[data-testid="tactic-card-rethink"]');
    await rethinkCard.hover();
    await page.waitForTimeout(200);

    await page.screenshot({
      path: "e2e/screenshots/tactic-hover.png",
      fullPage: false,
    });
  });

  test("captures card selection animation", async ({ page }) => {
    await page.goto("/?seed=123");

    await expect(page.locator('[data-testid="tactic-card-early_bird"]')).toBeVisible();
    await page.waitForTimeout(500);

    // Click to select Early Bird
    const earlyBirdCard = page.locator('[data-testid="tactic-card-early_bird"]');
    await earlyBirdCard.click();

    // Capture mid-animation (selected card glowing, others fading)
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "e2e/screenshots/tactic-selected.png",
      fullPage: false,
    });
  });
});
