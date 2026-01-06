import { test, expect, type Page } from "@playwright/test";

/**
 * Combat Block Accumulation E2E Tests
 *
 * Tests that block values accumulate as cards are played and are visible in the UI.
 * This is critical for players to know how much block they've built up before
 * declaring a block against an enemy.
 */

/**
 * Helper to navigate to combat with seed 123
 */
async function navigateToCombat(page: Page) {
  await page.goto("/?seed=123");

  // Select Early Bird tactic
  await expect(page.locator(".tactic-selection__title")).toBeVisible();
  await page.locator(".tactic-card").filter({ hasText: "Early Bird" }).click();
  await page.waitForTimeout(500);

  // Move to keep: (0,0) → (1,0) → (2,-1) → (3,-2) → (4,-2)
  await page.locator('[data-coord="1,0"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-coord="2,-1"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-coord="3,-2"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-coord="4,-2"]').click({ force: true });
  await page.waitForTimeout(500);

  // Verify combat overlay is visible
  const combatOverlay = page.locator(".combat-overlay");
  await expect(combatOverlay).toBeVisible({ timeout: 2000 });
}

type GameStateWithAccumulator = {
  players?: Array<{
    id: string;
    combatAccumulator?: {
      block: number;
      blockElements?: {
        physical: number;
        fire: number;
        ice: number;
        coldFire: number;
      };
    };
  }>;
};

test.describe("Combat Block Accumulation", () => {
  /**
   * Test that playing a card sideways for block accumulates the block value
   * and it's visible in the game state.
   *
   * This test verifies the core functionality:
   * 1. Start combat and enter Block phase
   * 2. Play a card sideways for +1 Block
   * 3. Verify the combatAccumulator.block value increased
   */
  test("playing card sideways for block should accumulate block value", async ({
    page,
  }) => {
    await navigateToCombat(page);

    // Skip to Block phase
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Verify we're in Block phase
    const activePhase = page.locator(".combat-phase-indicator__step--active");
    await expect(activePhase).toContainText("Block");

    // Check initial state - block should be 0
    const getBlockAccumulator = async () => {
      const state = (await page.evaluate(() => {
        return (window as unknown as { __MAGE_KNIGHT_STATE__: unknown })
          .__MAGE_KNIGHT_STATE__;
      })) as GameStateWithAccumulator;
      return state?.players?.[0]?.combatAccumulator?.block ?? null;
    };

    const initialBlock = await getBlockAccumulator();
    console.log(`Initial block accumulator: ${initialBlock}`);

    // Take screenshot before playing card
    await page.screenshot({
      path: "e2e/screenshots/combat-block-1-initial.png",
      fullPage: true,
    });

    // Scroll to hand
    const combatOverlay = page.locator(".combat-overlay");
    await combatOverlay.locator(".combat-overlay__content").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);

    // Play Stamina card sideways for +1 Block
    // Stamina has sidewaysValue > 0 but no basic block effect
    const staminaCard = combatOverlay.locator(
      '[data-testid="hand-card-stamina"]'
    );
    await expect(staminaCard).toBeVisible();
    await staminaCard.click();
    await page.waitForTimeout(200);

    // Card menu should appear
    const cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await expect(cardMenu).toBeVisible();

    // Click the +1 Block sideways option
    const sidewaysOption = cardMenu.locator("button").filter({ hasText: "+1 Block" });
    await expect(sidewaysOption).toBeVisible();
    await sidewaysOption.click();
    await page.waitForTimeout(300);

    // Take screenshot after playing card
    await page.screenshot({
      path: "e2e/screenshots/combat-block-2-after-first-card.png",
      fullPage: true,
    });

    // CRITICAL ASSERTION: Block accumulator should now be 1
    const blockAfterFirstCard = await getBlockAccumulator();
    console.log(`Block after first card: ${blockAfterFirstCard}`);

    // This is the KEY test - combatAccumulator.block should be exposed to client
    // If this fails, it means the client state doesn't include the accumulator
    expect(blockAfterFirstCard).not.toBeNull();
    expect(blockAfterFirstCard).toBe(1);
  });

  /**
   * Test that multiple cards accumulate block values correctly.
   */
  test("multiple cards should accumulate block values", async ({ page }) => {
    await navigateToCombat(page);

    // Skip to Block phase
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    const activePhase = page.locator(".combat-phase-indicator__step--active");
    await expect(activePhase).toContainText("Block");

    const getBlockAccumulator = async () => {
      const state = (await page.evaluate(() => {
        return (window as unknown as { __MAGE_KNIGHT_STATE__: unknown })
          .__MAGE_KNIGHT_STATE__;
      })) as GameStateWithAccumulator;
      return state?.players?.[0]?.combatAccumulator?.block ?? null;
    };

    const combatOverlay = page.locator(".combat-overlay");
    await combatOverlay.locator(".combat-overlay__content").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);

    // Play first card sideways for +1 Block (Stamina)
    const staminaCard = combatOverlay.locator(
      '[data-testid="hand-card-stamina"]'
    );
    await expect(staminaCard).toBeVisible();
    await staminaCard.click();
    await page.waitForTimeout(200);

    let cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await expect(cardMenu).toBeVisible();
    await cardMenu.locator("button").filter({ hasText: "+1 Block" }).click();
    await page.waitForTimeout(300);

    const blockAfterFirst = await getBlockAccumulator();
    console.log(`Block after first card: ${blockAfterFirst}`);
    expect(blockAfterFirst).toBe(1);

    // Play second card sideways for +1 Block (March)
    const marchCard = combatOverlay.locator('[data-testid="hand-card-march"]');
    if (await marchCard.isVisible()) {
      await marchCard.click();
      await page.waitForTimeout(200);

      cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
      await expect(cardMenu).toBeVisible();
      await cardMenu.locator("button").filter({ hasText: "+1 Block" }).click();
      await page.waitForTimeout(300);

      const blockAfterSecond = await getBlockAccumulator();
      console.log(`Block after second card: ${blockAfterSecond}`);
      expect(blockAfterSecond).toBe(2);
    }

    // Play a third card sideways for +1 Block (Swiftness)
    const swiftnessCard = combatOverlay.locator('[data-testid="hand-card-swiftness"]');
    if (await swiftnessCard.isVisible()) {
      await swiftnessCard.click();
      await page.waitForTimeout(200);

      cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
      await expect(cardMenu).toBeVisible();
      await cardMenu.locator("button").filter({ hasText: "+1 Block" }).click();
      await page.waitForTimeout(300);

      const blockAfterThird = await getBlockAccumulator();
      console.log(`Block after third card: ${blockAfterThird}`);
      // Should be at least 2 (some cards might not be in hand)
      // The key test is that block accumulates correctly
      expect(blockAfterThird).toBeGreaterThanOrEqual(2);
    }

    await page.screenshot({
      path: "e2e/screenshots/combat-block-3-multiple-cards.png",
      fullPage: true,
    });
  });

  /**
   * Test that the UI displays the accumulated block value.
   *
   * The CombatSummary component should show accumulated block so players
   * know how much total block they have before declaring a block action.
   */
  test("UI should display accumulated block value in combat summary", async ({
    page,
  }) => {
    await navigateToCombat(page);

    // Skip to Block phase
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    const activePhase = page.locator(".combat-phase-indicator__step--active");
    await expect(activePhase).toContainText("Block");

    const combatOverlay = page.locator(".combat-overlay");

    // Check if there's an accumulated block display
    // This should show the current block value from cards played
    const blockDisplay = combatOverlay.locator(
      '[data-testid="accumulated-block"]'
    );

    // This will FAIL if the UI doesn't have a block accumulator display
    // That's expected - we need to add this UI element
    const hasBlockDisplay = (await blockDisplay.count()) > 0;
    console.log(`Has accumulated block display: ${hasBlockDisplay}`);

    // If no display exists, the test documents what's missing
    if (!hasBlockDisplay) {
      console.log(
        "MISSING: UI should have a data-testid='accumulated-block' element showing accumulated block"
      );
    }

    // Scroll to hand and play a card
    await combatOverlay.locator(".combat-overlay__content").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);

    const staminaCard = combatOverlay.locator(
      '[data-testid="hand-card-stamina"]'
    );
    await staminaCard.click();
    await page.waitForTimeout(200);

    const cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await expect(cardMenu).toBeVisible();
    await cardMenu.locator("button").filter({ hasText: "+1 Block" }).click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: "e2e/screenshots/combat-block-4-ui-display.png",
      fullPage: true,
    });

    // After playing a card, the UI should show accumulated block = 1
    // This assertion will FAIL until the UI is implemented
    await expect(blockDisplay).toBeVisible();
    await expect(blockDisplay).toContainText("1");
  });
});
