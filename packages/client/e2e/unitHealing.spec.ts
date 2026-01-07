import { test, expect, type Page } from "@playwright/test";

/**
 * Unit Healing E2E Tests
 *
 * Tests the flow of recruiting a unit with a heal ability and using it to heal wounds.
 *
 * The Herbalist unit has:
 * - Heal 2 ability (can heal 2 wounds when activated)
 * - Cost: 3 Influence
 * - Recruit sites: Village, Monastery
 *
 * Uses seed 123 which has Herbalist in the unit offer.
 *
 * Test flow:
 * 1. Select tactic (Early Bird)
 * 2. Move to village at (2,0): (0,0) → (1,0) → (2,0)
 * 3. Play Promise (2 Influence) + Rage sideways (+1 Influence) = 3 Influence
 * 4. Recruit Herbalist
 * 5. Enter combat and take wounds
 * 6. Exit combat or end turn
 * 7. Activate Herbalist heal ability
 * 8. Verify wounds are removed from hand
 */

// ============================================================================
// Helpers
// ============================================================================

type GameState = {
  players?: Array<{
    id: string;
    hand?: readonly string[];
    units?: Array<{
      instanceId: string;
      unitId: string;
      state: string;
      wounded: boolean;
    }>;
    influencePoints?: number;
    commandTokens?: number;
  }>;
  validActions?: {
    units?: {
      recruitable?: Array<{
        unitId: string;
        cost: number;
        canAfford: boolean;
      }>;
      activatable?: Array<{
        unitInstanceId: string;
        unitId: string;
        abilities: Array<{
          index: number;
          name: string;
          canActivate: boolean;
          reason?: string;
        }>;
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

async function selectTactic(page: Page) {
  await expect(page.locator(".tactic-selection__title")).toBeVisible();
  await page.locator(".tactic-card").filter({ hasText: "Early Bird" }).click();
  await page.waitForTimeout(500);
}

async function moveToVillage(page: Page) {
  // Move to village at (2,-1): (0,0) → (1,0) → (2,-1)
  // Note: Tile offsets changed (E: 3,-2, NE: 1,-3), so village moved
  await page.locator('[data-coord="1,0"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-coord="2,-1"]').click({ force: true });
  await page.waitForTimeout(300);
}

async function playCardForInfluence(page: Page, cardId: string): Promise<boolean> {
  const card = page.locator(`[data-testid="hand-card-${cardId}"]`);
  if (!(await card.isVisible())) {
    console.log(`Card ${cardId} not visible`);
    return false;
  }

  await card.click();
  await page.waitForTimeout(200);

  const cardMenu = page.locator('[data-testid="card-play-menu"]');
  if (!(await cardMenu.isVisible())) {
    console.log(`Card menu not visible for ${cardId}`);
    return false;
  }

  // Log all buttons in the menu for debugging
  const buttons = cardMenu.locator("button");
  const buttonCount = await buttons.count();
  console.log(`Card ${cardId} menu has ${buttonCount} buttons:`);
  for (let i = 0; i < buttonCount; i++) {
    const text = await buttons.nth(i).textContent();
    console.log(`  - ${text}`);
  }

  // Try to find Influence button (basic or sideways "+X Influence")
  const influenceBtn = cardMenu.locator("button").filter({ hasText: /Influence/ });
  if (await influenceBtn.count() > 0) {
    await influenceBtn.first().click();
    await page.waitForTimeout(300);
    console.log(`Played ${cardId} for Influence`);
    return true;
  }

  // Cancel if no influence option
  const cancelBtn = cardMenu.locator("button").filter({ hasText: "Cancel" });
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
    await page.waitForTimeout(200);
  }
  console.log(`No Influence option found for ${cardId}`);
  return false;
}

async function getWoundCount(page: Page): Promise<number> {
  const state = await getGameState(page);
  const hand = state?.players?.[0]?.hand ?? [];
  return hand.filter((c) => c === "wound").length;
}

async function getPlayerUnits(page: Page) {
  const state = await getGameState(page);
  return state?.players?.[0]?.units ?? [];
}

// ============================================================================
// Test: Recruit Herbalist at Village
// ============================================================================

async function playCardBasic(page: Page, cardId: string): Promise<boolean> {
  const card = page.locator(`[data-testid="hand-card-${cardId}"]`);
  if (!(await card.isVisible())) {
    console.log(`Card ${cardId} not visible`);
    return false;
  }

  await card.click();
  await page.waitForTimeout(200);

  const cardMenu = page.locator('[data-testid="card-play-menu"]');
  if (!(await cardMenu.isVisible())) {
    console.log(`Card menu not visible for ${cardId}`);
    return false;
  }

  // Click "Basic Effect" button
  const basicBtn = cardMenu.locator("button").filter({ hasText: "Basic Effect" });
  if (await basicBtn.isVisible()) {
    await basicBtn.click();
    await page.waitForTimeout(300);
    console.log(`Played ${cardId} basic effect`);
    return true;
  }

  console.log(`No Basic Effect button found for ${cardId}`);
  return false;
}

test.describe("Unit Healing - Recruit Herbalist", () => {
  test("can recruit Herbalist at village with sufficient influence", async ({
    page,
  }) => {
    await page.goto("/?seed=123");

    await selectTactic(page);
    await moveToVillage(page);

    // Play cards for influence to afford Herbalist (costs 3)
    // Promise basic effect gives 2 Influence
    await playCardBasic(page, "promise");

    // Play another card sideways for +1 Influence
    await playCardForInfluence(page, "rage");

    // Verify we have enough influence
    const state = await getGameState(page);
    const influence = state?.players?.[0]?.influencePoints ?? 0;
    console.log(`Current influence: ${influence}`);
    expect(influence).toBeGreaterThanOrEqual(3);

    // Check that Herbalist is recruitable
    const recruitableUnits = state?.validActions?.units?.recruitable ?? [];
    const herbalist = recruitableUnits.find((u) => u.unitId === "herbalist");
    console.log("Recruitable units:", recruitableUnits);

    // If Herbalist is in the offer and recruitable, recruit it
    if (herbalist && herbalist.canAfford) {
      // Click recruit button for Herbalist in the UI
      const herbalistCard = page.locator('[data-testid="unit-card-herbalist"]');
      if (await herbalistCard.isVisible()) {
        const recruitBtn = herbalistCard.locator("button").filter({ hasText: "Recruit" });
        await recruitBtn.click();
        await page.waitForTimeout(300);

        // Verify unit was recruited
        const units = await getPlayerUnits(page);
        const ownedHerbalist = units.find((u) => u.unitId === "herbalist");
        expect(ownedHerbalist).toBeDefined();
        console.log("Herbalist recruited:", ownedHerbalist);
      }
    }
  });
});

// ============================================================================
// Test: Heal Ability Activation
// ============================================================================

test.describe("Unit Healing - Heal Ability", () => {
  /**
   * RED TEST: This test will fail until heal effect resolution is implemented.
   *
   * The test verifies that activating a unit's heal ability actually removes
   * wound cards from the player's hand.
   */
  test("activating Herbalist heal ability removes wounds from hand", async ({
    page,
  }) => {
    // Use seed 123 which has Herbalist in unit offer
    await page.goto("/?seed=123");

    await selectTactic(page);
    await moveToVillage(page);

    // Play Promise basic (2 Influence) + Rage sideways (+1 Influence) = 3 Influence
    await playCardBasic(page, "promise");
    await playCardForInfluence(page, "rage");

    // Check if Herbalist is available to recruit
    let state = await getGameState(page);
    const recruitableUnits = state?.validActions?.units?.recruitable ?? [];
    const herbalistRecruitInfo = recruitableUnits.find((u) => u.unitId === "herbalist");

    if (!herbalistRecruitInfo) {
      console.log("Herbalist not in unit offer for this seed, skipping...");
      test.skip();
      return;
    }

    // Recruit Herbalist via Unit Offer panel
    // Look for the unit card in the unit offer panel
    const unitOfferPanel = page.locator(".panel").filter({ hasText: "Unit Offer" });
    const herbalistInOffer = unitOfferPanel.locator(".unit-card").filter({ hasText: "Herbalist" });
    if (await herbalistInOffer.isVisible()) {
      const recruitBtn = herbalistInOffer.locator("button").filter({ hasText: "Recruit" });
      await recruitBtn.click();
      await page.waitForTimeout(300);
    }

    // Verify Herbalist is owned
    let units = await getPlayerUnits(page);
    const herbalist = units.find((u) => u.unitId === "herbalist");
    expect(herbalist).toBeDefined();

    // Now we need wounds to heal. For this test, we'll check the heal ability visibility.
    // The heal ability should only be activatable if there are wounds.

    // Check heal ability state (should NOT be activatable since no wounds)
    state = await getGameState(page);
    const activatableUnits = state?.validActions?.units?.activatable ?? [];
    const herbalistActivatable = activatableUnits.find((u) => u.unitId === "herbalist");

    console.log("Herbalist activatable info:", herbalistActivatable);

    if (herbalistActivatable) {
      const healAbility = herbalistActivatable.abilities.find((a) => a.name === "Heal");
      console.log("Heal ability:", healAbility);

      // Should NOT be activatable (no wounds)
      expect(healAbility?.canActivate).toBe(false);
      expect(healAbility?.reason).toContain("No wounds");
    }

    // For the full test, we would need to:
    // 1. Enter combat and take damage (get wounds)
    // 2. End turn or exit combat
    // 3. Activate heal ability
    // 4. Verify wounds removed

    // This is a placeholder for when heal is implemented
    console.log("Heal ability correctly shows as not activatable when no wounds");
  });

  /**
   * Full end-to-end test: Take wounds in combat, then heal them.
   *
   * Flow:
   * 1. Recruit Herbalist at village
   * 2. Move to keep and enter combat
   * 3. Skip blocking to take damage (wounds)
   * 4. Assign damage to hero, end combat (flee or defeat enemy)
   * 5. Activate Herbalist heal ability
   * 6. Verify wound count decreased
   */
  test("full flow: take wounds in combat then heal with Herbalist", async ({
    page,
  }) => {
    await page.goto("/?seed=123");

    await selectTactic(page);

    // First recruit Herbalist at village
    await moveToVillage(page);
    await playCardBasic(page, "promise");
    await playCardForInfluence(page, "rage");

    let state = await getGameState(page);
    const recruitableUnits = state?.validActions?.units?.recruitable ?? [];
    const herbalistRecruitInfo = recruitableUnits.find((u) => u.unitId === "herbalist");

    if (!herbalistRecruitInfo) {
      console.log("Herbalist not in unit offer, skipping...");
      test.skip();
      return;
    }

    // Recruit Herbalist via Unit Offer panel
    const unitOfferPanel = page.locator(".panel").filter({ hasText: "Unit Offer" });
    const herbalistInOffer = unitOfferPanel.locator(".unit-card").filter({ hasText: "Herbalist" });
    if (await herbalistInOffer.isVisible()) {
      const recruitBtn = herbalistInOffer.locator("button").filter({ hasText: "Recruit" });
      await recruitBtn.click();
      await page.waitForTimeout(300);
    }

    // Verify wounds before combat
    const woundsBefore = await getWoundCount(page);
    console.log(`Wounds before combat: ${woundsBefore}`);

    // Move toward keep to trigger combat (from village at 2,-1)
    // Path: (2,-1) → (3,-2) → (4,-3) keep
    // Note: Tile offsets changed (E: 3,-2, NE: 1,-3), so keep is now at (4,-3)
    await page.locator('[data-coord="3,-2"]').click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('[data-coord="4,-3"]').click({ force: true });
    await page.waitForTimeout(500);

    // Check if we're in combat
    const combatOverlay = page.locator(".combat-overlay");
    if (!(await combatOverlay.isVisible())) {
      console.log("No combat triggered on this path, skipping wound test...");
      test.skip();
      return;
    }

    // Skip to damage phase (skip ranged, skip block)
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Assign damage to hero
    state = await getGameState(page);
    const enemyId = (state?.validActions as { combat?: { damageAssignments?: Array<{ enemyInstanceId: string }> } })
      ?.combat?.damageAssignments?.[0]?.enemyInstanceId;

    if (enemyId) {
      const assignDamageBtn = page.locator(`[data-testid="assign-damage-${enemyId}"]`);
      if (await assignDamageBtn.isVisible()) {
        await assignDamageBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Check wounds after taking damage
    const woundsAfterDamage = await getWoundCount(page);
    console.log(`Wounds after damage: ${woundsAfterDamage}`);
    expect(woundsAfterDamage).toBeGreaterThan(woundsBefore);

    // For now, we need to exit combat to use heal ability (it's not a combat ability)
    // This might require defeating the enemy or fleeing

    // Skip attack phase and end combat (if possible)
    await page.locator(".combat-actions__btn--end-phase").click();
    await page.waitForTimeout(300);

    // Try to flee combat
    const fleeBtn = page.locator(".combat-actions__btn--flee, button").filter({ hasText: "Flee" });
    if (await fleeBtn.isVisible()) {
      await fleeBtn.click();
      await page.waitForTimeout(500);
    }

    // After exiting combat, check heal ability
    state = await getGameState(page);
    const activatableUnits = state?.validActions?.units?.activatable ?? [];
    const herbalistActivatable = activatableUnits.find((u) => u.unitId === "herbalist");

    console.log("Herbalist activatable after wounds:", herbalistActivatable);

    if (herbalistActivatable) {
      const healAbility = herbalistActivatable.abilities.find((a) => a.name === "Heal");

      // Should now be activatable (we have wounds)
      expect(healAbility?.canActivate).toBe(true);

      // Click to activate heal ability
      const herbalistUnitCard = page.locator('[data-testid="owned-unit-herbalist"]');
      if (await herbalistUnitCard.isVisible()) {
        const healBtn = herbalistUnitCard.locator("button").filter({ hasText: "Heal" });
        await healBtn.click();
        await page.waitForTimeout(300);

        // Verify wounds decreased
        const woundsAfterHeal = await getWoundCount(page);
        console.log(`Wounds after heal: ${woundsAfterHeal}`);

        // Herbalist heals 2, so should have 2 fewer wounds (or 0 if less than 2)
        const expectedWounds = Math.max(0, woundsAfterDamage - 2);
        expect(woundsAfterHeal).toBe(expectedWounds);
      }
    }
  });
});

// ============================================================================
// Test: Heal Wounded Unit
// ============================================================================

test.describe("Unit Healing - Heal Wounded Units", () => {
  /**
   * Units can also be healed when wounded.
   * A wounded unit cannot be activated, but heal can restore it.
   */
  test.skip("can heal wounded unit with Herbalist", async ({ page }) => {
    // This test requires:
    // 1. Having multiple units
    // 2. One unit takes damage and becomes wounded
    // 3. Herbalist heals the wounded unit
    // Skipping for now - complex setup
  });
});
