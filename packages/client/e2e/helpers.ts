import { expect, type Page } from "@playwright/test";

/**
 * Shared E2E test helpers
 *
 * Reusable functions for common game operations like:
 * - Selecting tactics
 * - Playing cards
 * - Moving to locations
 * - Ending turns
 */

// ============================================================================
// Basic Actions
// ============================================================================

export async function selectTactic(page: Page, tacticId = "early_bird") {
  await expect(page.locator('[data-testid="tactic-selection-title"]')).toBeVisible();
  await page.locator(`[data-testid="tactic-card-${tacticId}"]`).click();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="tactic-selection-title"]')).not.toBeVisible();
}

export async function getMovePoints(page: Page): Promise<number> {
  const movePointsText = await page
    .locator(".resource")
    .filter({ hasText: "Move Points" })
    .locator(".resource__value")
    .textContent();
  return parseInt(movePointsText || "0", 10);
}

export async function playCardBasicEffect(page: Page, cardId: string) {
  const card = page.locator(`[data-testid="hand-card-${cardId}"]`).first();
  await expect(card).toBeVisible();
  await card.click();

  const playMenu = page.locator('[data-testid="card-play-menu"]');
  await expect(playMenu).toBeVisible();

  // Click "Basic Effect" button
  const basicButton = playMenu.locator("button").filter({ hasText: "Basic Effect" });
  await basicButton.click();
  await page.waitForTimeout(300);
}

export async function moveToHex(page: Page, q: number, r: number) {
  const targetHex = page.locator(`[data-coord="${q},${r}"]`);
  await expect(targetHex).toBeVisible();
  await targetHex.click();
  await page.waitForTimeout(300);
}

export async function endTurn(page: Page) {
  const endTurnButton = page.locator('[data-testid="end-turn-btn"]');
  await expect(endTurnButton).toBeVisible();
  await endTurnButton.click();
  await page.waitForTimeout(300);
}

export async function playCardSideways(page: Page, cardId: string) {
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

export async function playCardPoweredEffect(page: Page, cardId: string) {
  const card = page.locator(`[data-testid="hand-card-${cardId}"]`).first();
  await expect(card).toBeVisible();
  await card.click();

  const playMenu = page.locator('[data-testid="card-play-menu"]');
  await expect(playMenu).toBeVisible();

  // Click "Powered Effect" button
  const poweredButton = playMenu.locator("button").filter({ hasText: "Powered Effect" });
  await poweredButton.click();
  await page.waitForTimeout(300);
}

// ============================================================================
// Common Sequences (seed 123)
// ============================================================================

/**
 * Move to village at (2,-1) from starting position (0,0)
 * Takes 1 turn with seed 123:
 *   Turn 1: Play stamina (+2) + swiftness (+2) = 4 move → (0,0)→(1,0)→(2,-1)
 *
 * Initial hand (seed 123): stamina, mana_draw, rage, promise, swiftness
 * Prerequisite: Tactic must already be selected
 */
export async function moveToVillage(page: Page) {
  // Turn 1: Play stamina + swiftness (4 move), move to village (2,-1)
  await playCardBasicEffect(page, "stamina");
  await playCardBasicEffect(page, "swiftness");
  await moveToHex(page, 1, 0);
  await moveToHex(page, 2, -1);
}

/**
 * Move to explore position at (3,-3) from starting position (0,0)
 * Takes 2 turns with seed 123:
 *   Turn 1: Play stamina (+2) + swiftness (+2) = 4 move → (0,0)→(1,0)→(2,-1) → end turn
 *   Turn 2: Play stamina (+2) + crystallize sideways (+1) + rage sideways (+1)
 *           + promise sideways (+1) = 5 move → (2,-1)→(2,-2)→(3,-3) → end turn
 *
 * Turn 1 hand: stamina, mana_draw, rage, promise, swiftness
 * Turn 2 hand: mana_draw, rage, promise, stamina, crystallize
 * Turn 3 hand: mana_draw, march, tranquility, arythea_battle_versatility, march
 *
 * After this, player is at (3,-3) with 0 move points, ready for turn 3
 * Prerequisite: Tactic must already be selected
 */
export async function moveToExplorePosition(page: Page) {
  // Turn 1: Play stamina + swiftness (4 move), move to village (2,-1), end turn
  await playCardBasicEffect(page, "stamina");
  await playCardBasicEffect(page, "swiftness");
  await moveToHex(page, 1, 0);
  await moveToHex(page, 2, -1);
  await endTurn(page);

  // Turn 2: Play stamina (+2) + 3 sideways (+3) = 5 move, move to (3,-3), end turn
  await playCardBasicEffect(page, "stamina");
  await playCardSideways(page, "crystallize");
  await playCardSideways(page, "rage");
  await playCardSideways(page, "promise");
  await moveToHex(page, 2, -2);
  await moveToHex(page, 3, -3);
  await endTurn(page);
}

/**
 * Start game and move to village
 * Full sequence from page load to being at village (2,-1)
 */
export async function startGameAndMoveToVillage(page: Page, seed = 123) {
  await page.goto(`/?seed=${seed}`);
  await selectTactic(page);
  await moveToVillage(page);
}

/**
 * Move to keep at (4,-3) and trigger combat from starting position (0,0)
 * Takes 3 turns to reach keep which triggers combat:
 *   Turn 1: stamina (+2) + swiftness (+2) = 4 move → (1,0)→(2,-1)
 *   Turn 2: stamina (+2) + crystallize sideways (+1) = 3 move → (2,-2) (only 1 hex, save move)
 *   Turn 3: march powered (+4) → (3,-3) + mana_draw sideways (+1) → (4,-3) keep
 *
 * After entering keep, combat overlay should be visible
 * Prerequisite: Tactic must already be selected
 */
export async function moveToCombat(page: Page) {
  // Turn 1: Play stamina + swiftness (4 move), move (0,0)→(1,0)→(2,-1)
  await playCardBasicEffect(page, "stamina");
  await playCardBasicEffect(page, "swiftness");
  await moveToHex(page, 1, 0); // plains: -2
  await moveToHex(page, 2, -1); // plains: -2 (village)
  await endTurn(page);

  // Turn 2: Play stamina (+2) + crystallize sideways (+1) = 3 move → (2,-2)
  await playCardBasicEffect(page, "stamina");
  await playCardSideways(page, "crystallize");
  await moveToHex(page, 2, -2); // plains: -2
  await endTurn(page);

  // Turn 3: Play march powered (+4) → (3,-3) + mana_draw sideways (+1) → (4,-3) keep
  await playCardPoweredEffect(page, "march");
  await moveToHex(page, 3, -3); // forest: -3
  await playCardSideways(page, "mana_draw");
  await moveToHex(page, 4, -3); // hill with keep: -3, triggers combat

  // Wait for combat overlay
  const combatOverlay = page.locator('[data-testid="combat-overlay"]');
  await expect(combatOverlay).toBeVisible({ timeout: 3000 });
}

/**
 * Start game and navigate to combat
 * Full sequence from page load to combat overlay
 */
export async function startGameAndMoveToCombat(page: Page, seed = 123) {
  await page.goto(`/?seed=${seed}`);
  await selectTactic(page);
  await moveToCombat(page);
}

/**
 * Move to provoke rampaging enemy after explore
 * Prerequisite: Must be at (3,-3) after exploring (call moveToExplorePosition + explore first)
 *
 * Turn 4 (after explore): Hand has mana_draw, tranquility, arythea_battle_versatility, march, improvisation
 * Play march (+2) + mana_draw sideways (+1) = 3 move → (3,-3)→(3,-4)
 * This triggers provoke_rampaging combat with enemy at (4,-4)
 */
export async function moveToProvokeRampaging(page: Page) {
  // Turn 4: Play march + sideways for 3 move (forest terrain cost)
  await playCardBasicEffect(page, "march"); // +2 Move
  await playCardSideways(page, "mana_draw"); // +1 Move
  // Move from (3,-3) to (3,-4) - this provokes the rampaging enemy at (4,-4)
  await moveToHex(page, 3, -4);

  // Wait for combat overlay
  const combatOverlay = page.locator('[data-testid="combat-overlay"]');
  await expect(combatOverlay).toBeVisible({ timeout: 3000 });
}

/**
 * Full sequence to navigate to rampaging combat from game start
 * Takes 4 turns:
 *   Turns 1-2: Move to explore position (3,-3)
 *   Turn 3: Explore new tile, end turn
 *   Turn 4: Move to provoke rampaging enemy, triggering combat
 */
export async function navigateToRampagingCombat(page: Page, seed = 123) {
  await page.goto(`/?seed=${seed}`);
  await selectTactic(page);

  // Move to explore position (3,-3) over 2 turns
  await moveToExplorePosition(page);

  // Turn 3: Play march to get +2 move and explore
  await playCardBasicEffect(page, "march");

  // Click explore ghost to place new tile
  const exploreGhosts = page.locator('[data-type="explore"]');
  await expect(exploreGhosts.first()).toBeVisible();
  await exploreGhosts.first().click();
  await page.waitForTimeout(500);

  // End turn after exploring
  await endTurn(page);

  // Turn 4: Move to provoke the rampaging enemy
  await moveToProvokeRampaging(page);
}
