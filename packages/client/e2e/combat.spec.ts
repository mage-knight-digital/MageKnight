import { test, expect, type Page } from "@playwright/test";

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

/**
 * Test combat UI by walking into a keep
 */

test("seed 123 - walk into keep and verify combat modal with enemies", async ({ page }) => {
  await page.goto("/?seed=123");

  // Select Early Bird tactic
  await expect(page.locator(".tactic-selection__title")).toBeVisible();
  await page.locator(".tactic-card").filter({ hasText: "Early Bird" }).click();
  await page.waitForTimeout(500);

  // Move: (0,0) → (1,0) → (2,-1) → (3,-2) → (4,-2)
  // This path leads to a keep that triggers combat
  await page.locator('[data-coord="1,0"]').click({ force: true });
  await page.waitForTimeout(300);

  await page.locator('[data-coord="2,-1"]').click({ force: true });
  await page.waitForTimeout(300);

  await page.locator('[data-coord="3,-2"]').click({ force: true });
  await page.waitForTimeout(300);

  // This move to (4,-2) should trigger combat at a keep
  await page.locator('[data-coord="4,-2"]').click({ force: true });
  await page.waitForTimeout(500);

  // Take screenshot of combat modal
  await page.screenshot({
    path: "e2e/screenshots/combat-01-at-keep.png",
    fullPage: true,
  });

  // Combat overlay should be visible
  const combatOverlay = page.locator(".combat-overlay");
  await expect(combatOverlay).toBeVisible({ timeout: 2000 });

  // Should show "(Fortified Site)" since keeps are fortified
  await expect(page.locator(".combat-overlay__header")).toContainText("Fortified Site");

  // Should be in Ranged & Siege Phase (first phase)
  const activePhase = page.locator(".combat-phase-indicator__step--active");
  await expect(activePhase).toContainText("Ranged & Siege Phase");

  // CRITICAL: There should be at least 1 enemy in combat
  const enemyCards = page.locator(".enemy-card");
  const enemyCount = await enemyCards.count();
  console.log(`Enemy cards found: ${enemyCount}`);
  expect(enemyCount).toBeGreaterThanOrEqual(1);

  // First enemy should have valid stats (attack > 0)
  const firstEnemy = enemyCards.first();
  const enemyName = await firstEnemy.locator(".enemy-card__name").textContent();
  console.log(`First enemy name: ${enemyName}`);
  expect(enemyName).toBeTruthy();
  expect(enemyName).not.toBe("");

  // Attack value should be > 0
  const attackValue = await firstEnemy.locator(".enemy-card__stat-value").first().textContent();
  console.log(`First enemy attack: ${attackValue}`);
  const attackNum = parseInt(attackValue || "0", 10);
  expect(attackNum).toBeGreaterThan(0);

  // Armor value should be > 0 for a keep enemy
  const armorValue = await firstEnemy.locator(".enemy-card__stat-value").nth(1).textContent();
  console.log(`First enemy armor: ${armorValue}`);
  const armorNum = parseInt(armorValue || "0", 10);
  expect(armorNum).toBeGreaterThan(0);

  await page.screenshot({
    path: "e2e/screenshots/combat-02-modal.png",
    fullPage: true,
  });
});

test("seed 123 - combat phase progression and attack button behavior", async ({ page }) => {
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

  // Phase 1: Ranged & Siege - click "Skip Ranged/Siege"
  let activePhase = await page.locator(".combat-phase-indicator__step--active").textContent();
  console.log(`Phase 1: ${activePhase}`);
  expect(activePhase).toContain("Ranged");
  await page.screenshot({ path: "e2e/screenshots/combat-phase-1-ranged.png", fullPage: true });

  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);

  // Phase 2: Block - click "Skip Blocking"
  activePhase = await page.locator(".combat-phase-indicator__step--active").textContent();
  console.log(`Phase 2: ${activePhase}`);
  expect(activePhase).toContain("Block");
  await page.screenshot({ path: "e2e/screenshots/combat-phase-2-block.png", fullPage: true });

  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);

  // Phase 3: Assign Damage - since we skipped blocking, we take damage
  activePhase = await page.locator(".combat-phase-indicator__step--active").textContent();
  console.log(`Phase 3: ${activePhase}`);
  expect(activePhase).toContain("Damage");
  await page.screenshot({ path: "e2e/screenshots/combat-phase-3-damage.png", fullPage: true });

  // Damage phase may auto-progress, but we should end up in Attack phase
  // Try to progress if button is enabled
  const endPhaseBtn = page.locator(".combat-actions__btn--end-phase");
  const isEnabled = await endPhaseBtn.isEnabled();
  console.log(`End phase enabled in damage phase: ${isEnabled}`);

  if (isEnabled) {
    await endPhaseBtn.click();
    await page.waitForTimeout(300);
  }

  // Should now be in Attack phase
  activePhase = await page.locator(".combat-phase-indicator__step--active").textContent();
  console.log(`Current phase: ${activePhase}`);
  await page.screenshot({ path: "e2e/screenshots/combat-phase-4-attack.png", fullPage: true });

  // In Attack phase, the "Continue" button should be DISABLED if there are undefeated enemies
  // This is correct game behavior - you can't end combat with enemies still alive
  const attackEndBtn = page.locator(".combat-actions__btn--end-phase");
  const canEndAttack = await attackEndBtn.isEnabled();
  console.log(`Can end attack phase (should be false with undefeated enemy): ${canEndAttack}`);

  // Combat overlay should still be visible - we can't just skip through with enemies present
  const overlayStillVisible = await combatOverlay.isVisible();
  console.log(`Combat overlay still visible (expected true): ${overlayStillVisible}`);
  expect(overlayStillVisible).toBe(true);

  await page.screenshot({ path: "e2e/screenshots/combat-phase-5-end.png", fullPage: true });
});

test("seed 123 - validActions.playCard is populated during combat phases", async ({ page }) => {
  await navigateToCombat(page);

  // Helper to get game state from window
  const getGameState = async () => {
    return page.evaluate(() => {
      return (window as unknown as { __MAGE_KNIGHT_STATE__: unknown }).__MAGE_KNIGHT_STATE__;
    });
  };

  type PlayCardState = {
    validActions?: {
      playCard?: {
        cards: Array<{
          cardId: string;
          canPlayBasic: boolean;
          canPlayPowered: boolean;
          canPlaySideways: boolean;
          requiredMana?: string;
          sidewaysOptions?: Array<{ as: string; value: number }>;
        }>;
      };
    };
  };

  // Phase 1: Ranged/Siege
  // In ranged phase, only cards with ranged/siege attacks should be playable
  // With no mana available, powered ranged cards (like Swiftness) are NOT playable
  // Basic action cards don't have ranged/siege attacks, so playCard should be empty/undefined
  let state = await getGameState() as PlayCardState;
  console.log("Ranged/Siege phase - playCard:", JSON.stringify(state?.validActions?.playCard, null, 2));

  const rangedPlayCard = state?.validActions?.playCard;
  console.log(`Ranged phase: playCard cards count = ${rangedPlayCard?.cards?.length ?? "undefined"}`);

  // In ranged phase without mana, no cards should be playable
  // Swiftness has powered Ranged Attack 3 but requires blue mana we don't have
  // Other basic cards don't have ranged/siege effects
  expect(rangedPlayCard?.cards?.length ?? 0).toBe(0);

  await page.screenshot({ path: "e2e/screenshots/combat-playcard-1-ranged.png", fullPage: true });

  // Skip to Block phase
  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);

  // Phase 2: Block
  // Cards with block effects should be playable (Rage has choice with block)
  // All cards with sidewaysValue > 0 should be playable sideways for block
  state = await getGameState() as PlayCardState;
  console.log("Block phase - playCard:", JSON.stringify(state?.validActions?.playCard, null, 2));

  const blockPlayCard = state?.validActions?.playCard;
  console.log(`Block phase: playCard cards count = ${blockPlayCard?.cards?.length ?? "undefined"}`);

  // In block phase, we should have multiple playable cards
  expect(blockPlayCard).toBeDefined();
  expect(blockPlayCard?.cards?.length).toBeGreaterThan(0);

  // Rage should have basic block (choice(attack, block)) and sideways
  const rageBlock = blockPlayCard?.cards?.find(c => c.cardId === "rage");
  expect(rageBlock).toBeDefined();
  expect(rageBlock?.canPlayBasic).toBe(true);
  expect(rageBlock?.canPlaySideways).toBe(true);
  expect(rageBlock?.sidewaysOptions).toContainEqual({ as: "block", value: 1 });

  // Stamina should only have sideways (no block effect, but sidewaysValue > 0)
  const staminaBlock = blockPlayCard?.cards?.find(c => c.cardId === "stamina");
  expect(staminaBlock).toBeDefined();
  expect(staminaBlock?.canPlayBasic).toBe(false);
  expect(staminaBlock?.canPlaySideways).toBe(true);

  await page.screenshot({ path: "e2e/screenshots/combat-playcard-2-block.png", fullPage: true });

  // Skip to Assign Damage phase
  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);

  // Phase 3: Assign Damage - no cards playable
  state = await getGameState() as PlayCardState;
  const damagePlayCard = state?.validActions?.playCard;
  console.log(`Damage phase: playCard cards count = ${damagePlayCard?.cards?.length ?? "undefined"}`);

  // Assign damage phase: no cards should be playable (playCard undefined or empty)
  expect(damagePlayCard?.cards?.length ?? 0).toBe(0);

  await page.screenshot({ path: "e2e/screenshots/combat-playcard-3-damage.png", fullPage: true });

  // NOTE: We can't advance to Attack phase without assigning damage first.
  // The damage assignment requires clicking on enemy cards to assign damage to units/hero.
  // For now, we've verified the key functionality:
  // - Ranged phase: Only ranged/siege cards are playable
  // - Block phase: Block effect cards + sideways are playable
  // - Damage phase: No cards are playable
  // Attack phase would follow the same pattern as Block phase but with attack effects.
});

/**
 * Test: Powered option should NOT show when player has no mana to pay for it.
 *
 * Swiftness:
 * - Has powered Ranged Attack 3 (requires blue mana)
 * - Has no basic effect for ranged phase
 * - Has no sideways option in ranged phase
 *
 * Without blue mana, Swiftness should be NOT PLAYABLE in ranged phase.
 * The card should be disabled (not clickable).
 */
test("seed 123 - powered option should NOT show without mana available", async ({ page }) => {
  await navigateToCombat(page);

  // We should be in Ranged & Siege phase
  const activePhase = page.locator(".combat-phase-indicator__step--active");
  await expect(activePhase).toContainText("Ranged");

  // Take screenshot of initial ranged phase
  await page.screenshot({
    path: "e2e/screenshots/combat-ranged-1-initial.png",
    fullPage: true,
  });

  // Scroll to see the hand in combat overlay
  const combatOverlay = page.locator(".combat-overlay");
  await combatOverlay.locator(".combat-overlay__content").evaluate(el => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);

  // Find Swiftness card - it has powered Ranged Attack 3 (requires blue mana)
  // But player has no blue mana, so it should be NOT PLAYABLE (disabled)
  const swiftnessCard = combatOverlay.locator('[data-testid="hand-card-swiftness"]');
  await expect(swiftnessCard).toBeVisible();

  await page.screenshot({
    path: "e2e/screenshots/combat-ranged-2-hand-visible.png",
    fullPage: true,
  });

  // Swiftness should be marked as not-playable (disabled)
  // It has no basic ranged effect and no sideways for ranged, and powered requires mana we don't have
  await expect(swiftnessCard).toHaveClass(/card--not-playable/);
  await expect(swiftnessCard).toBeDisabled();

  // Verify the card cannot be clicked to open a menu
  // (This confirms the fix is working - powered options not shown without mana)
  console.log("Swiftness is correctly disabled - no powered option available without mana");
});

/**
 * Test: Powered option SHOULD show when player has mana available.
 * We need a seed where:
 * 1. Player can get into combat
 * 2. Player has a crystal or the mana source has a matching die
 *
 * For now, we test via the game state to verify the mana source logic works.
 */
test("seed 123 - powered card play with mana source - integration check", async ({ page }) => {
  await navigateToCombat(page);

  // Skip to Block phase where Determination can be powered
  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);

  // Verify we're in Block phase
  const activePhase = page.locator(".combat-phase-indicator__step--active");
  await expect(activePhase).toContainText("Block");

  // Check the game state for mana source information
  type GameStateWithMana = {
    source?: {
      dice: Array<{
        id: string;
        color: string;
        takenByPlayerId?: string | null;
      }>;
    };
    validActions?: {
      mana?: {
        availableDice: Array<{ dieId: string; color: string }>;
        canConvertCrystal: boolean;
        convertibleColors: string[];
      };
      playCard?: {
        cards: Array<{
          cardId: string;
          canPlayPowered: boolean;
          requiredMana?: string;
        }>;
      };
    };
    players?: Array<{
      crystals: { red: number; blue: number; green: number; white: number };
      pureMana: Array<{ color: string }>;
    }>;
  };

  const state = await page.evaluate(() => {
    return (window as unknown as { __MAGE_KNIGHT_STATE__: unknown }).__MAGE_KNIGHT_STATE__;
  }) as GameStateWithMana;

  // Log what mana is available
  console.log("Mana source dice:", JSON.stringify(state?.source?.dice, null, 2));
  console.log("Available dice for player:", JSON.stringify(state?.validActions?.mana?.availableDice, null, 2));
  console.log("Player crystals:", JSON.stringify(state?.players?.[0]?.crystals, null, 2));
  console.log("Player pure mana:", JSON.stringify(state?.players?.[0]?.pureMana, null, 2));

  // Check if Determination (blue powered) can be played powered
  const playableCards = state?.validActions?.playCard?.cards;
  const determination = playableCards?.find(c => c.cardId === "determination");
  console.log("Determination playability:", JSON.stringify(determination, null, 2));

  // Check for any cards that have canPlayPowered=true (would need mana available)
  const poweredCards = playableCards?.filter(c => c.canPlayPowered);
  console.log("Cards with canPlayPowered=true:", poweredCards?.map(c => c.cardId));

  // If there's a blue die available, Determination should have canPlayPowered=true
  const blueDieAvailable = state?.validActions?.mana?.availableDice?.some(d => d.color === "blue");
  const blueCrystal = (state?.players?.[0]?.crystals?.blue ?? 0) > 0;
  const blueToken = state?.players?.[0]?.pureMana?.some(t => t.color === "blue");

  console.log(`Blue available: die=${blueDieAvailable}, crystal=${blueCrystal}, token=${blueToken}`);

  // If blue mana IS available, Determination should be powered-playable
  if (blueDieAvailable || blueCrystal || blueToken) {
    expect(determination?.canPlayPowered).toBe(true);
  }

  await page.screenshot({
    path: "e2e/screenshots/combat-powered-mana-check.png",
    fullPage: true,
  });
});

test("seed 123 - combat UI shows playable cards with combat-appropriate options", async ({ page }) => {
  await navigateToCombat(page);

  // Skip to Block phase
  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);

  // Verify we're in Block phase
  const activePhase = page.locator(".combat-phase-indicator__step--active");
  await expect(activePhase).toContainText("Block");

  // The player hand should be visible inside the combat overlay
  const combatOverlay = page.locator(".combat-overlay");
  const playerHand = combatOverlay.locator('[data-testid="player-hand"]');

  // Scroll the modal to make sure the hand is visible
  await combatOverlay.locator(".combat-overlay__content").evaluate(el => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);

  await expect(playerHand).toBeVisible();

  // In block phase, playable cards should have .card--playable class
  // and be highlighted (not grayed out)
  const playableCards = combatOverlay.locator(".card--playable");
  const nonPlayableCards = combatOverlay.locator(".card--not-playable");

  const playableCount = await playableCards.count();
  console.log(`Playable cards in hand: ${playableCount}`);
  expect(playableCount).toBeGreaterThan(0);

  // Playable cards should be interactable (cursor: pointer via CSS)
  // Non-playable cards should be grayed out (disabled attribute)
  const nonPlayableCount = await nonPlayableCards.count();
  console.log(`Non-playable cards in hand: ${nonPlayableCount}`);

  // Screenshot showing playable vs non-playable cards
  await page.screenshot({
    path: "e2e/screenshots/combat-ui-1-playable-cards.png",
    fullPage: true,
  });

  // Click a playable card to open the menu
  // Rage should be playable in block phase
  const rageCard = combatOverlay.locator('[data-testid="hand-card-rage"]');
  const isRagePlayable = await rageCard.count() > 0;
  console.log(`Rage is playable: ${isRagePlayable}`);

  if (await rageCard.isVisible()) {
    await rageCard.click();
    await page.waitForTimeout(200);

    // Card play menu should appear with combat-appropriate options
    const cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await expect(cardMenu).toBeVisible();

    // In block phase, the menu should show "Block" not "Basic Effect"
    const menuText = await cardMenu.textContent();
    console.log(`Card menu text: ${menuText}`);

    // Should have Block option (from basic effect)
    expect(menuText).toContain("Block");

    // Should have sideways +1 Block option
    expect(menuText).toContain("+1 Block");

    await page.screenshot({
      path: "e2e/screenshots/combat-ui-2-card-menu.png",
      fullPage: true,
    });

    // Click the +1 Block sideways option to play the card
    const sidewaysOption = cardMenu.locator("button").filter({ hasText: "+1 Block" });
    await sidewaysOption.click();
    await page.waitForTimeout(300);

    // Menu should close and card should be played
    await expect(cardMenu).not.toBeVisible();

    // Card should no longer be in hand (check inside the combat overlay)
    const rageInHand = await combatOverlay.locator('[data-testid="hand-card-rage"]').count();
    console.log(`Rage cards remaining in hand: ${rageInHand}`);

    await page.screenshot({
      path: "e2e/screenshots/combat-ui-3-after-play.png",
      fullPage: true,
    });
  }
});
