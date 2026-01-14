import { test, expect } from "@playwright/test";

/**
 * Quick test to capture a screenshot of the combat UI for analysis
 */
test("capture combat UI via debug panel", async ({ page }) => {
  // Use a seed that gets us into combat quickly
  await page.goto("/?seed=123");
  await page.waitForTimeout(500);

  // Select tactic
  await expect(page.locator('[data-testid="tactic-hand"]')).toBeVisible();
  await page.locator('[data-testid="tactic-card-early_bird"]').click();
  await page.waitForTimeout(1200);

  // Open debug panel (the wrench icon in bottom right)
  const debugToggle = page.locator('.debug-panel__toggle');
  await debugToggle.click();
  await page.waitForTimeout(200);

  // Click "Enter Combat with Selected Enemy" button
  const enterCombatBtn = page.locator('button').filter({ hasText: 'Enter Combat with Selected Enemy' });
  await enterCombatBtn.click();
  await page.waitForTimeout(500);

  // Close debug panel
  await page.locator('.debug-panel button').filter({ hasText: '×' }).click();
  await page.waitForTimeout(200);

  // Take screenshot of combat overlay
  await page.screenshot({ path: "e2e/screenshots/combat-overlay.png" });
});
