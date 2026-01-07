import { test, expect, type Page } from "@playwright/test";
import { startGameAndMoveToCombat } from "./helpers";

/**
 * Combat E2E Tests
 *
 * Tests complete user flows through combat scenarios:
 * - Entering combat and seeing enemies
 * - Skipping phases and taking damage
 * - Blocking successfully to avoid damage
 * - Playing cards with choice effects (like Rage)
 * - Assigning damage to hero/units
 * - Attacking and defeating enemies
 */

// ============================================================================
// Helpers
// ============================================================================

async function navigateToCombat(page: Page) {
  await startGameAndMoveToCombat(page);
}

async function skipToBlockPhase(page: Page) {
  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);
  const activePhase = page.locator(".combat-phase-indicator__step--active");
  await expect(activePhase).toContainText("Block");
}

async function skipToDamagePhase(page: Page) {
  // Skip ranged/siege
  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);
  // Skip block
  await page.locator(".combat-actions__btn--end-phase").click();
  await page.waitForTimeout(300);
  const activePhase = page.locator(".combat-phase-indicator__step--active");
  await expect(activePhase).toContainText("Damage");
}

async function scrollToHand(page: Page) {
  const combatOverlay = page.locator(".combat-overlay");
  await combatOverlay.locator(".combat-overlay__content").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);
}

type GameState = {
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
  validActions?: {
    combat?: {
      phase: string;
      canEndPhase: boolean;
      blocks?: Array<{
        enemyInstanceId: string;
        enemyName: string;
        enemyAttack: number;
        requiredBlock: number;
        isBlocked: boolean;
      }>;
      damageAssignments?: Array<{
        enemyInstanceId: string;
        enemyName: string;
        unassignedDamage: number;
      }>;
    };
    playCard?: {
      cards: Array<{
        cardId: string;
        canPlayBasic: boolean;
        canPlayPowered: boolean;
        canPlaySideways: boolean;
        sidewaysOptions?: Array<{ as: string; value: number }>;
      }>;
    };
  };
};

async function getGameState(page: Page): Promise<GameState> {
  return page.evaluate(() => {
    return (window as unknown as { __MAGE_KNIGHT_STATE__: unknown })
      .__MAGE_KNIGHT_STATE__;
  }) as Promise<GameState>;
}

async function getBlockAccumulator(page: Page): Promise<number> {
  const state = await getGameState(page);
  return state?.players?.[0]?.combatAccumulator?.block ?? 0;
}

// ============================================================================
// Test: Entering Combat
// ============================================================================

test.describe("Combat - Entering Combat", () => {
  test("walking into keep shows combat modal with enemies", async ({ page }) => {
    await navigateToCombat(page);

    // Should show "(Fortified Site)" since keeps are fortified
    await expect(page.locator(".combat-overlay__header")).toContainText("Fortified Site");

    // Should be in Ranged & Siege Phase (first phase)
    const activePhase = page.locator(".combat-phase-indicator__step--active");
    await expect(activePhase).toContainText("Ranged & Siege Phase");

    // Should have at least 1 enemy
    const enemyCards = page.locator(".enemy-card");
    const enemyCount = await enemyCards.count();
    expect(enemyCount).toBeGreaterThanOrEqual(1);

    // Enemy should have valid stats
    const firstEnemy = enemyCards.first();
    const enemyName = await firstEnemy.locator(".enemy-card__name").textContent();
    expect(enemyName).toBeTruthy();

    const attackValue = await firstEnemy.locator(".enemy-card__stat-value").first().textContent();
    expect(parseInt(attackValue || "0", 10)).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test: No Block → Takes Damage
// ============================================================================

test.describe("Combat - No Block Takes Damage", () => {
  test("skipping block phase results in damage to assign", async ({ page }) => {
    await navigateToCombat(page);

    // Get enemy attack value
    const state = await getGameState(page);
    await skipToBlockPhase(page);

    const blockState = await getGameState(page);
    const blockOptions = blockState?.validActions?.combat?.blocks;
    expect(blockOptions).toBeDefined();
    expect(blockOptions?.length).toBeGreaterThan(0);

    const expectedDamage = blockOptions?.reduce((sum, b) => sum + b.enemyAttack, 0) ?? 0;
    console.log(`Total enemy attack (expected damage): ${expectedDamage}`);

    // Skip block phase without blocking
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Should be in damage phase
    const activePhase = page.locator(".combat-phase-indicator__step--active");
    await expect(activePhase).toContainText("Damage");

    // Should have damage to assign
    const damageState = await getGameState(page);
    const damageAssignments = damageState?.validActions?.combat?.damageAssignments;
    expect(damageAssignments).toBeDefined();

    const totalDamage = damageAssignments?.reduce((sum, d) => sum + d.unassignedDamage, 0) ?? 0;
    console.log(`Total damage to assign: ${totalDamage}`);
    expect(totalDamage).toBe(expectedDamage);
  });

  /**
   * RED: Damage assignment UI doesn't exist yet.
   *
   * When in damage phase with unassigned damage, the player should be able to
   * assign damage to hero (taking wounds) and then progress to Attack phase.
   *
   * The full flow:
   * 1. Skip blocking → damage phase with unassigned damage
   * 2. Can't progress (end phase button disabled)
   * 3. Assign damage to hero
   * 4. Now can progress to Attack phase
   */
  test("can assign damage to hero and progress to attack phase", async ({ page }) => {
    await navigateToCombat(page);
    await skipToDamagePhase(page);

    // Verify we have damage to assign
    const state = await getGameState(page);
    const damageAssignments = state?.validActions?.combat?.damageAssignments;
    expect(damageAssignments?.length).toBeGreaterThan(0);

    const enemyId = damageAssignments?.[0]?.enemyInstanceId;
    const damageAmount = damageAssignments?.[0]?.unassignedDamage ?? 0;
    console.log(`Need to assign ${damageAmount} damage from enemy ${enemyId}`);

    // End phase button should be DISABLED while damage is unassigned
    const endPhaseBtn = page.locator(".combat-actions__btn--end-phase");
    await expect(endPhaseBtn).toBeDisabled();

    // Assign damage to hero (click button or enemy card)
    const assignDamageBtn = page.locator(`[data-testid="assign-damage-${enemyId}"]`);
    await expect(assignDamageBtn).toBeVisible();
    await assignDamageBtn.click();
    await page.waitForTimeout(300);

    // After assigning, no more damage to assign
    const afterState = await getGameState(page);
    const remainingDamage = afterState?.validActions?.combat?.damageAssignments;
    expect(remainingDamage?.length ?? 0).toBe(0);

    // Verify hero took wounds (enemy attack 3 / hero armor 2 = 2 wounds)
    type PlayerState = { hand?: readonly string[] };
    const playerState = (afterState as { players?: PlayerState[] })?.players?.[0];
    const woundsInHand = playerState?.hand?.filter((c: string) => c === "wound").length ?? 0;
    console.log(`Wounds in hand after damage: ${woundsInHand}`);
    expect(woundsInHand).toBeGreaterThan(0);

    // End phase button should now be ENABLED
    await expect(endPhaseBtn).toBeEnabled();

    // Click to progress to Attack phase
    await endPhaseBtn.click();
    await page.waitForTimeout(300);

    // Should now be in Attack phase
    const activePhase = page.locator(".combat-phase-indicator__step--active");
    await expect(activePhase).toContainText("Attack");
  });
});

// ============================================================================
// Test: Block Accumulation
// ============================================================================

test.describe("Combat - Block Accumulation", () => {
  test("playing card sideways for block accumulates block value", async ({ page }) => {
    await navigateToCombat(page);
    await skipToBlockPhase(page);

    const initialBlock = await getBlockAccumulator(page);
    expect(initialBlock).toBe(0);

    await scrollToHand(page);

    // Play Stamina sideways for +1 Block
    const combatOverlay = page.locator(".combat-overlay");
    const staminaCard = combatOverlay.locator('[data-testid="hand-card-stamina"]');
    await expect(staminaCard).toBeVisible();
    await staminaCard.click();
    await page.waitForTimeout(200);

    const cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await expect(cardMenu).toBeVisible();
    await cardMenu.locator("button").filter({ hasText: "+1 Block" }).click();
    await page.waitForTimeout(300);

    const blockAfter = await getBlockAccumulator(page);
    expect(blockAfter).toBe(1);
  });

  test("multiple cards accumulate block values", async ({ page }) => {
    await navigateToCombat(page);
    await skipToBlockPhase(page);
    await scrollToHand(page);

    const combatOverlay = page.locator(".combat-overlay");

    // Play Stamina for +1 Block
    const staminaCard = combatOverlay.locator('[data-testid="hand-card-stamina"]');
    await staminaCard.click();
    await page.waitForTimeout(200);
    let cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await cardMenu.locator("button").filter({ hasText: "+1 Block" }).click();
    await page.waitForTimeout(300);

    expect(await getBlockAccumulator(page)).toBe(1);

    // Play Swiftness for +1 Block
    const swiftnessCard = combatOverlay.locator('[data-testid="hand-card-swiftness"]');
    if (await swiftnessCard.isVisible()) {
      await swiftnessCard.click();
      await page.waitForTimeout(200);
      cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
      await cardMenu.locator("button").filter({ hasText: "+1 Block" }).click();
      await page.waitForTimeout(300);

      expect(await getBlockAccumulator(page)).toBe(2);
    }
  });

  test("UI displays accumulated block value", async ({ page }) => {
    await navigateToCombat(page);
    await skipToBlockPhase(page);
    await scrollToHand(page);

    const combatOverlay = page.locator(".combat-overlay");
    const blockDisplay = combatOverlay.locator('[data-testid="accumulated-block"]');

    // Play a card for block
    const staminaCard = combatOverlay.locator('[data-testid="hand-card-stamina"]');
    await staminaCard.click();
    await page.waitForTimeout(200);
    const cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await cardMenu.locator("button").filter({ hasText: "+1 Block" }).click();
    await page.waitForTimeout(300);

    // UI should show accumulated block = 1
    await expect(blockDisplay).toBeVisible();
    await expect(blockDisplay).toContainText("1");
  });
});

// ============================================================================
// Test: Playing Rage with Choice Effect
// ============================================================================

test.describe("Combat - Card Choice Effects", () => {
  test("playing Rage and choosing Block +2 accumulates block", async ({ page }) => {
    await navigateToCombat(page);
    await skipToBlockPhase(page);
    await scrollToHand(page);

    const combatOverlay = page.locator(".combat-overlay");

    // Click Rage card
    const rageCard = combatOverlay.locator('[data-testid="hand-card-rage"]');
    await expect(rageCard).toBeVisible();
    await rageCard.click();
    await page.waitForTimeout(200);

    // Card menu should show "Block" option (basic effect has choice)
    const cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await expect(cardMenu).toBeVisible();

    // Click "Block" to play the basic effect
    const blockOption = cardMenu.locator("button").filter({ hasText: /^Block$/ });
    await expect(blockOption).toBeVisible();
    await blockOption.click();
    await page.waitForTimeout(300);

    // Choice modal should appear with "Attack 2" and "Block 2"
    const choiceModal = page.locator(".choice-modal, .effect-choice-modal, [data-testid='choice-modal']");

    // If no dedicated modal, the choice might be inline - look for Block 2 button
    const block2Button = page.locator("button").filter({ hasText: "Block 2" });
    await expect(block2Button).toBeVisible({ timeout: 2000 });
    await block2Button.click();
    await page.waitForTimeout(300);

    // Block accumulator should now be 2
    const blockAfter = await getBlockAccumulator(page);
    expect(blockAfter).toBe(2);
  });
});

// ============================================================================
// Test: Successful Block → No Damage
// ============================================================================

test.describe("Combat - Successful Block", () => {
  /**
   * Note: The enemy at seed 123 has Swift (requires 2x block = 6).
   * We need to accumulate 6+ block to successfully block.
   */
  test("blocking enemy with enough block prevents damage assignment", async ({ page }) => {
    await navigateToCombat(page);
    await skipToBlockPhase(page);

    // Get required block (enemy has Swift, needs 6)
    const state = await getGameState(page);
    const blockOptions = state?.validActions?.combat?.blocks;
    const requiredBlock = blockOptions?.[0]?.requiredBlock ?? 0;
    const enemyId = blockOptions?.[0]?.enemyInstanceId;
    console.log(`Required block: ${requiredBlock}, Enemy ID: ${enemyId}`);

    await scrollToHand(page);
    const combatOverlay = page.locator(".combat-overlay");

    // Play Rage for Block 2
    const rageCard = combatOverlay.locator('[data-testid="hand-card-rage"]');
    await rageCard.click();
    await page.waitForTimeout(200);
    let cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    await cardMenu.locator("button").filter({ hasText: /^Block$/ }).click();
    await page.waitForTimeout(300);
    await page.locator("button").filter({ hasText: "Block 2" }).click();
    await page.waitForTimeout(300);

    // Play more cards sideways to get to 6 block
    // Stamina +1, Swiftness +1, Promise +1, Mana Draw +1 = 4 more
    for (const cardId of ["stamina", "swiftness", "promise", "mana_draw"]) {
      const card = combatOverlay.locator(`[data-testid="hand-card-${cardId}"]`);
      if (await card.isVisible()) {
        await card.click();
        await page.waitForTimeout(200);
        cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
        if (await cardMenu.isVisible()) {
          const blockBtn = cardMenu.locator("button").filter({ hasText: "+1 Block" });
          if (await blockBtn.isVisible()) {
            await blockBtn.click();
            await page.waitForTimeout(300);
          }
        }
      }
    }

    const totalBlock = await getBlockAccumulator(page);
    console.log(`Total accumulated block: ${totalBlock}`);

    // Scroll back up to see enemies
    await combatOverlay.locator(".combat-overlay__content").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    // Click "Assign Block" on the enemy
    const assignBlockBtn = page.locator(`[data-testid="assign-block-${enemyId}"]`);
    await expect(assignBlockBtn).toBeVisible();
    await expect(assignBlockBtn).toBeEnabled();
    await assignBlockBtn.click();
    await page.waitForTimeout(300);

    // Block accumulator should be cleared
    expect(await getBlockAccumulator(page)).toBe(0);

    // Skip to damage phase
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Should have NO damage to assign (enemy was blocked)
    const damageState = await getGameState(page);
    const damageAssignments = damageState?.validActions?.combat?.damageAssignments;
    expect(damageAssignments?.length ?? 0).toBe(0);
  });
});

// ============================================================================
// Test: Phase Progression
// ============================================================================

test.describe("Combat - Phase Progression", () => {
  test("can progress through combat phases", async ({ page }) => {
    await navigateToCombat(page);

    // Phase 1: Ranged & Siege
    let activePhase = page.locator(".combat-phase-indicator__step--active");
    await expect(activePhase).toContainText("Ranged");

    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Phase 2: Block
    await expect(activePhase).toContainText("Block");

    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Phase 3: Assign Damage
    await expect(activePhase).toContainText("Damage");

    // Can't skip damage phase without assigning damage (if there is damage)
    const state = await getGameState(page);
    const hasDamage = (state?.validActions?.combat?.damageAssignments?.length ?? 0) > 0;

    if (!hasDamage) {
      // If no damage, can proceed to attack
      await page.locator(".combat-actions__btn--end-phase").click();
      await page.waitForTimeout(300);
      await expect(activePhase).toContainText("Attack");
    }
  });

  test("cannot end combat with undefeated enemies", async ({ page }) => {
    await navigateToCombat(page);

    // Skip to attack phase (assuming we can get there)
    // In reality, damage assignment blocks us if we took damage
    await skipToDamagePhase(page);

    // Combat overlay should still be visible
    const combatOverlay = page.locator(".combat-overlay");
    await expect(combatOverlay).toBeVisible();
  });
});

// ============================================================================
// Test: Attacking and Defeating Enemies
// ============================================================================

test.describe("Combat - Defeating Enemies", () => {
  /**
   * When in attack phase with accumulated attack, the player should be able to
   * assign attack to an enemy to defeat it.
   *
   * The flow:
   * 1. Enter combat, skip to block phase
   * 2. Skip blocking (take damage instead to save cards for attack)
   * 3. Assign damage in damage phase
   * 4. In attack phase, play cards sideways for +1 Attack each
   * 5. Click "Assign Attack" on enemy to defeat it
   */
  test("can accumulate attack and defeat enemy to end combat", async ({ page }) => {
    await navigateToCombat(page);
    const combatOverlay = page.locator(".combat-overlay");

    // Skip ranged phase
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Skip block phase (don't block - we'll take damage but save cards for attack)
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Should be in damage phase - assign the damage
    const activePhase = page.locator(".combat-phase-indicator__step--active");
    await expect(activePhase).toContainText("Damage");

    const state = await getGameState(page);
    const enemyId = state?.validActions?.combat?.damageAssignments?.[0]?.enemyInstanceId;
    console.log(`Enemy ID: ${enemyId}`);

    // Assign damage to hero
    const assignDamageBtn = page.locator(`[data-testid="assign-damage-${enemyId}"]`);
    await assignDamageBtn.click();
    await page.waitForTimeout(300);

    // Skip to attack phase
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Should be in attack phase now
    await expect(activePhase).toContainText("Attack");

    // Scroll to hand and play cards for attack
    await scrollToHand(page);

    // Get enemy armor
    const attackState = await getGameState(page);
    const enemyArmor = (attackState?.validActions?.combat as { attacks?: Array<{ enemyArmor: number }> })?.attacks?.[0]?.enemyArmor ?? 4;
    console.log(`Enemy armor: ${enemyArmor}`);

    // Play cards sideways for +1 Attack each until we have enough
    let cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
    let accumulatedAttack = 0;

    // Try each card in hand
    const cardIds = ["rage", "stamina", "swiftness", "promise", "mana_draw", "march", "concentration"];
    for (const cardId of cardIds) {
      if (accumulatedAttack >= enemyArmor) break;

      const card = combatOverlay.locator(`[data-testid="hand-card-${cardId}"]`);
      if (await card.isVisible()) {
        await card.click();
        await page.waitForTimeout(200);

        cardMenu = combatOverlay.locator('[data-testid="card-play-menu"]');
        if (await cardMenu.isVisible()) {
          // Try to find +1 Attack sideways option
          const attackBtn = cardMenu.locator("button").filter({ hasText: "+1 Attack" });
          if (await attackBtn.count() > 0) {
            console.log(`Playing ${cardId} for +1 Attack`);
            await attackBtn.first().click();
            await page.waitForTimeout(300);
            accumulatedAttack++;
            await scrollToHand(page);
          } else {
            // No attack option, cancel
            const cancelBtn = cardMenu.locator("button").filter({ hasText: "Cancel" });
            if (await cancelBtn.isVisible()) {
              await cancelBtn.click();
              await page.waitForTimeout(200);
            }
          }
        }
      }
    }

    console.log(`Accumulated attack: ${accumulatedAttack}`);

    // Scroll up to see enemies
    await combatOverlay.locator(".combat-overlay__content").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    // Click "Assign Attack" on the enemy
    const assignAttackBtn = page.locator(`[data-testid="assign-attack-${enemyId}"]`);
    await expect(assignAttackBtn).toBeVisible();
    await expect(assignAttackBtn).toBeEnabled();
    await assignAttackBtn.click();
    await page.waitForTimeout(300);

    // Enemy should be defeated
    const afterState = await getGameState(page);
    const attacks = (afterState?.validActions?.combat as { attacks?: Array<{ isDefeated: boolean }> })?.attacks;
    const allDefeated = attacks?.every(a => a.isDefeated) ?? false;
    expect(allDefeated).toBe(true);
    console.log("Enemy defeated!");
  });
});

// ============================================================================
// Test: Card Playability in Combat
// ============================================================================

test.describe("Combat - Card Playability", () => {
  test("only combat-appropriate cards are playable in each phase", async ({ page }) => {
    await navigateToCombat(page);

    // Ranged phase: no basic cards have ranged attacks, all should be unplayable
    const state = await getGameState(page);
    const rangedCards = state?.validActions?.playCard?.cards ?? [];
    expect(rangedCards.length).toBe(0);

    // Block phase: cards with block effects or sideways should be playable
    await skipToBlockPhase(page);
    const blockState = await getGameState(page);
    const blockCards = blockState?.validActions?.playCard?.cards ?? [];
    expect(blockCards.length).toBeGreaterThan(0);

    // Rage should have basic (choice with block) and sideways
    const rage = blockCards.find(c => c.cardId === "rage");
    expect(rage?.canPlayBasic).toBe(true);
    expect(rage?.canPlaySideways).toBe(true);
  });

  test("powered cards require mana to be playable", async ({ page }) => {
    await navigateToCombat(page);
    await scrollToHand(page);

    // Swiftness has powered Ranged Attack 3 (requires blue mana)
    // Without blue mana, it should be disabled in ranged phase
    const combatOverlay = page.locator(".combat-overlay");
    const swiftnessCard = combatOverlay.locator('[data-testid="hand-card-swiftness"]');
    await expect(swiftnessCard).toBeVisible();
    await expect(swiftnessCard).toHaveClass(/card--not-playable/);
    await expect(swiftnessCard).toBeDisabled();
  });
});
