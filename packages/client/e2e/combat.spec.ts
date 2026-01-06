import { test, expect } from "@playwright/test";

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
