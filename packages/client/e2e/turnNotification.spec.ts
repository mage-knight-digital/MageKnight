import { test, expect, type Page } from "@playwright/test";

/**
 * Turn Notification E2E Tests
 *
 * Tests that turn change notifications appear correctly when:
 * 1. A player ends their turn
 * 2. A new round starts
 *
 * Note: These tests use single-player mode since the client currently
 * only supports single-player. Multiplayer mechanics are tested at the
 * server level in GameServer.test.ts.
 */

// ============================================================================
// Helpers
// ============================================================================

async function selectTactic(page: Page, tacticId = "early_bird") {
  // Wait for tactic cards to be visible
  await expect(page.locator(`[data-testid="tactic-card-${tacticId}"]`)).toBeVisible({ timeout: 10000 });
  await page.locator(`[data-testid="tactic-card-${tacticId}"]`).click();
  // Wait for selection animation and transition to game
  await page.waitForTimeout(1000);
}

async function playCardSideways(page: Page, cardId: string) {
  const card = page.locator(`[data-testid="hand-card-${cardId}"]`).first();
  await expect(card).toBeVisible();
  await card.click();

  const playMenu = page.locator('[data-testid="card-play-menu"]');
  await expect(playMenu).toBeVisible();

  // Click "+1 Move" button (sideways effect)
  const sidewaysButton = playMenu.locator("button").filter({ hasText: "+1 Move" });
  await sidewaysButton.click();
  await page.waitForTimeout(300);
}

async function endTurn(page: Page) {
  const endTurnButton = page.locator('[data-testid="end-turn-btn"]');
  await expect(endTurnButton).toBeVisible();
  await endTurnButton.click();
  await page.waitForTimeout(300);
}

// ============================================================================
// Tests
// ============================================================================

test.describe("Turn Notifications", () => {
  test("shows turn notification toast after ending turn", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // Play a card sideways to satisfy minimum turn requirement
    await playCardSideways(page, "stamina");

    // End the turn
    await endTurn(page);

    // In single-player, the toast should say "Your turn" (since it's always your turn)
    const toast = page.locator('[data-testid="turn-notification-toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toHaveText(/Your turn/i);
  });

  test("turn notification toast auto-dismisses", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // Play a card and end turn
    await playCardSideways(page, "stamina");
    await endTurn(page);

    // Toast should appear
    const toast = page.locator('[data-testid="turn-notification-toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Toast should auto-dismiss after ~3 seconds
    await expect(toast).not.toBeVisible({ timeout: 5000 });
  });

  test("turn notification toast can be dismissed by clicking", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // Play a card and end turn
    await playCardSideways(page, "stamina");
    await endTurn(page);

    // Toast should appear
    const toast = page.locator('[data-testid="turn-notification-toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Click to dismiss
    await toast.click();

    // Toast should disappear immediately
    await expect(toast).not.toBeVisible({ timeout: 500 });
  });
});

test.describe("Mana Source Dice Count", () => {
  test("shows correct number of dice in mana source (1 player = 3 dice)", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // The mana source should be visible
    const manaSource = page.locator('[data-testid="mana-source-overlay"]');
    await expect(manaSource).toBeVisible({ timeout: 5000 });

    // For 1 player, should have 1+2 = 3 dice
    // Each die is a mana-die element inside the source
    const dice = manaSource.locator('[data-testid="mana-die"]');
    await expect(dice).toHaveCount(3);
  });
});
