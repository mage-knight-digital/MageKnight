import { test, expect } from "@playwright/test";

/**
 * Basic movement test with seed 123
 * Tests the happy path: start game -> pick tactic -> play card for move
 */
test.describe("Movement - seed 123", () => {
  test("can select tactic card at game start", async ({ page }) => {
    await page.goto("/?seed=123");

    // Should show tactic selection overlay
    await expect(page.locator(".tactic-selection__title")).toBeVisible();

    // Select Early Bird tactic
    await page.locator(".tactic-card").filter({ hasText: "Early Bird" }).click();
    await page.waitForTimeout(500);

    // Tactic overlay should be gone
    await expect(page.locator(".tactic-selection__title")).not.toBeVisible();

    // Game board should be visible
    await expect(page.locator(".hex-grid")).toBeVisible();

    // Player hand should be visible
    await expect(page.locator('[data-testid="player-hand"]')).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/movement-01-after-tactic.png",
      fullPage: true,
    });
  });

  test("Stamina card should be playable at start of turn", async ({ page }) => {
    await page.goto("/?seed=123");

    // Select Early Bird tactic
    await expect(page.locator(".tactic-selection__title")).toBeVisible();
    await page.locator(".tactic-card").filter({ hasText: "Early Bird" }).click();
    await page.waitForTimeout(500);

    // Find Stamina card
    const staminaCard = page.locator('[data-testid="hand-card-stamina"]');
    await expect(staminaCard).toBeVisible();

    // Stamina should be PLAYABLE (not disabled) at start of turn
    // This is the bug - cards are currently all disabled
    await expect(staminaCard).toHaveClass(/card--playable/);
    await expect(staminaCard).toBeEnabled();

    // Click Stamina to open play menu
    await staminaCard.click();

    // Play mode menu should appear
    const playMenu = page.locator('[data-testid="card-play-menu"]');
    await expect(playMenu).toBeVisible();

    // Should have +2 Move option (Stamina basic effect)
    await expect(playMenu).toContainText("Move");

    await page.screenshot({
      path: "e2e/screenshots/movement-02-stamina-menu.png",
      fullPage: true,
    });
  });
});
