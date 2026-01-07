import { test, expect, type Page } from "@playwright/test";

/**
 * Movement E2E Tests
 *
 * Tests the core movement flow:
 * 1. Select tactic to start game
 * 2. Play movement cards to gain move points
 * 3. Move to adjacent hexes
 * 4. Verify move points decrease correctly
 */

// ============================================================================
// Helpers
// ============================================================================

async function selectTactic(page: Page, tacticId = "early_bird") {
  await expect(page.locator('[data-testid="tactic-selection-title"]')).toBeVisible();
  await page.locator(`[data-testid="tactic-card-${tacticId}"]`).click();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="tactic-selection-title"]')).not.toBeVisible();
}

async function getMovePoints(page: Page): Promise<number> {
  const movePointsText = await page
    .locator(".resource")
    .filter({ hasText: "Move Points" })
    .locator(".resource__value")
    .textContent();
  return parseInt(movePointsText || "0", 10);
}

async function playCardBasicEffect(page: Page, cardId: string) {
  const card = page.locator(`[data-testid="hand-card-${cardId}"]`);
  await expect(card).toBeVisible();
  await card.click();

  const playMenu = page.locator('[data-testid="card-play-menu"]');
  await expect(playMenu).toBeVisible();

  // Click "Basic Effect" button (for Stamina this gives +2 Move)
  const basicButton = playMenu.locator("button").filter({ hasText: "Basic Effect" });
  await basicButton.click();
  await page.waitForTimeout(300);
}

// ============================================================================
// Tests
// ============================================================================

test.describe("Movement", () => {
  test("can select tactic card at game start", async ({ page }) => {
    await page.goto("/?seed=123");

    // Should show tactic selection overlay
    await expect(page.locator('[data-testid="tactic-selection-title"]')).toBeVisible();

    // Select Early Bird tactic
    await selectTactic(page);

    // Game board should be visible
    await expect(page.locator('[data-testid="hex-grid"]')).toBeVisible();

    // Player hand should be visible
    await expect(page.locator('[data-testid="player-hand"]')).toBeVisible();
  });

  test("starts with 0 move points", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    const movePoints = await getMovePoints(page);
    expect(movePoints).toBe(0);
  });

  test("playing Stamina card grants +2 move points", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // Verify starting at 0 move points
    const before = await getMovePoints(page);
    expect(before).toBe(0);

    // Play Stamina for +2 Move
    await playCardBasicEffect(page, "stamina");

    // Verify move points increased by 2
    const after = await getMovePoints(page);
    expect(after).toBe(2);
  });

  test("can move to adjacent hex after gaining move points", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // Play Stamina for +2 Move
    await playCardBasicEffect(page, "stamina");
    const movePointsBefore = await getMovePoints(page);

    // Player starts at (0,0). Click on adjacent hex (1,0) - plains cost 2
    const targetHex = page.locator('[data-coord="1,0"]');
    await expect(targetHex).toBeVisible();
    await targetHex.click();
    await page.waitForTimeout(300);

    // Verify move points decreased (plains cost 2 during day)
    const movePointsAfter = await getMovePoints(page);
    expect(movePointsAfter).toBe(movePointsBefore - 2);
  });

  test("cannot move without sufficient move points", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // Verify at 0 move points
    const movePoints = await getMovePoints(page);
    expect(movePoints).toBe(0);

    // Try to click an adjacent hex - should not move
    const targetHex = page.locator('[data-coord="1,0"]');
    await targetHex.click({ force: true });
    await page.waitForTimeout(300);

    // Move points should still be 0 (no movement occurred)
    const movePointsAfter = await getMovePoints(page);
    expect(movePointsAfter).toBe(0);
  });
});
