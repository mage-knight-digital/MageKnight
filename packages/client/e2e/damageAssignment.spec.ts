import { test, expect } from "@playwright/test";
import { navigateToRampagingCombat } from "./helpers";

/**
 * Damage Assignment E2E Tests
 *
 * Tests the combat damage assignment flow:
 * 1. Navigate into combat (via rampaging enemy provoke)
 * 2. Skip ranged/siege phase
 * 3. Skip block phase (take full damage)
 * 4. Assign damage to hero (creates wounds)
 * 5. Skip attack phase
 * 6. Verify wounds appear in hand after combat
 */

test.describe("Combat Damage Assignment", () => {
  test("skipping block and assigning damage adds wounds to hand", async ({ page }) => {
    // Navigate to combat with rampaging enemy
    await navigateToRampagingCombat(page);

    // Verify we're in combat
    const combatOverlay = page.locator('[data-testid="combat-overlay"]');
    await expect(combatOverlay).toBeVisible();

    // Phase 1: Skip ranged/siege
    const endPhaseBtn = page.locator('[data-testid="end-combat-phase-btn"]');
    await expect(endPhaseBtn).toBeVisible();
    await expect(endPhaseBtn).toHaveText("Skip Ranged/Siege");
    await endPhaseBtn.click();
    await page.waitForTimeout(300);

    // Phase 2: Skip block (take full damage)
    await expect(endPhaseBtn).toHaveText("Skip Blocking");
    await endPhaseBtn.click();
    await page.waitForTimeout(300);

    // Phase 3: Assign damage
    // Find the assign damage button on the enemy card and click it
    const assignDamageBtn = page.locator('[data-testid^="assign-damage-"]').first();
    await expect(assignDamageBtn).toBeVisible();
    await assignDamageBtn.click();
    await page.waitForTimeout(300);

    // Continue after assigning damage
    await expect(endPhaseBtn).toHaveText("Continue");
    await endPhaseBtn.click();
    await page.waitForTimeout(300);

    // Phase 4: Skip attack
    await expect(endPhaseBtn).toHaveText("Skip Attack");
    await endPhaseBtn.click();
    await page.waitForTimeout(300);

    // Combat should end - overlay should disappear
    await expect(combatOverlay).not.toBeVisible({ timeout: 3000 });

    // Verify wounds appear in hand
    const woundCards = page.locator('[data-testid="hand-card-wound"]');
    await expect(woundCards.first()).toBeVisible();
    const woundCount = await woundCards.count();
    expect(woundCount).toBeGreaterThan(0);
  });
});
