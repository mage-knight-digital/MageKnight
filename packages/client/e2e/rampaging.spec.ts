import { test, expect } from "@playwright/test";

/**
 * Rampaging Enemy E2E Tests
 *
 * Rampaging enemies (Orc Marauders, Draconum) have special movement rules:
 * 1. Cannot enter their hex - must defeat them from adjacent first
 * 2. Provoking - moving from one adjacent hex to another adjacent hex triggers combat
 * 3. Can challenge from adjacent - voluntary combat initiation (not tested here)
 */

test.describe("Rampaging Enemy Movement", () => {
  test("cannot move into hex with rampaging enemy", async ({ page }) => {
    // Use seed 123 which places a rampaging enemy at (3,-4)
    await page.goto("/?seed=123");

    // Select Early Bird tactic
    await expect(page.locator(".tactic-selection__title")).toBeVisible();
    await page.locator(".tactic-card").filter({ hasText: "Early Bird" }).click();
    await page.waitForTimeout(500);

    // Move toward the rampaging hex
    // Path: (0,0) → (0,-1) → (1,-2) → (2,-3)
    // At (2,-3) we're adjacent to the rampaging hex at (3,-4)
    await page.locator('[data-coord="0,-1"]').click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('[data-coord="1,-2"]').click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('[data-coord="2,-3"]').click({ force: true });
    await page.waitForTimeout(200);

    // Now at (2,-3) which is adjacent to (3,-4) with the rampaging enemy
    let eventLog = await page.locator(".debug-state").textContent();
    console.log("Event log before entering attempt:", eventLog?.slice(-300));

    // Try to move INTO the rampaging hex at (3,-4)
    // This should be BLOCKED - you can't enter a rampaging enemy's hex
    const rampagingHex = page.locator('[data-coord="3,-4"]');
    await rampagingHex.click({ force: true });
    await page.waitForTimeout(500);

    // Check what happened
    const eventLogAfter = await page.locator(".debug-state").textContent();
    console.log("Event log after attempt:", eventLogAfter?.slice(-300));

    // Check if we moved into (3,-4) (BAD) or were blocked (GOOD)
    const movedTo34 = eventLogAfter?.includes("→ (3,-4)");

    // The test should FAIL if we successfully moved into the rampaging hex
    expect(movedTo34).toBe(false);
  });

  test("moving around rampaging enemy triggers combat (provoking)", async ({ page }) => {
    // Use seed 123 which places a rampaging enemy at (3,-4)
    await page.goto("/?seed=123");

    // Select Early Bird tactic
    await expect(page.locator(".tactic-selection__title")).toBeVisible();
    await page.locator(".tactic-card").filter({ hasText: "Early Bird" }).click();
    await page.waitForTimeout(500);

    // Move toward the rampaging enemy at (3,-4)
    // Path: (0,0) → (0,-1) → (1,-2) → (2,-3)
    // At (2,-3) we're adjacent to (3,-4) but haven't provoked yet
    await page.locator('[data-coord="0,-1"]').click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('[data-coord="1,-2"]').click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('[data-coord="2,-3"]').click({ force: true });
    await page.waitForTimeout(200);

    // Verify no combat yet - we're adjacent but haven't skirted
    let eventLog = await page.locator(".debug-state").textContent();
    expect(eventLog?.includes("COMBAT_TRIGGERED")).toBe(false);

    // Now move to (3,-3) - this is ALSO adjacent to (3,-4)
    // This move is "skirting around" the rampaging enemy and should PROVOKE combat
    //
    // (2,-3) neighbors include (3,-4) - we're adjacent to the rampaging enemy
    // (3,-3) neighbors include (3,-4) - also adjacent to the rampaging enemy
    //
    // Per the rules:
    // 1. The move SUCCEEDS - we arrive at (3,-3)
    // 2. Movement immediately ENDS (can't move further this turn)
    // 3. Combat is TRIGGERED (mandatory fight with the rampaging enemy)

    console.log("Before skirting move:", eventLog?.slice(-300));

    await page.locator('[data-coord="3,-3"]').click({ force: true });
    await page.waitForTimeout(500);

    eventLog = await page.locator(".debug-state").textContent();
    console.log("After skirting move:", eventLog?.slice(-300));

    // Verify the skirting move completed (we should be at 3,-3)
    const moveCompleted = eventLog?.includes("(2,-3) → (3,-3)");
    console.log("Move completed to (3,-3):", moveCompleted);
    expect(moveCompleted).toBe(true);

    // Check if combat was triggered
    const combatTriggered = eventLog?.includes("COMBAT_TRIGGERED");
    const combatOverlayVisible = await page.locator(".combat-overlay").isVisible();

    console.log("Combat triggered event:", combatTriggered);
    console.log("Combat overlay visible:", combatOverlayVisible);

    // Combat should have been triggered by provoking the rampaging enemy
    expect(combatTriggered || combatOverlayVisible).toBe(true);

    await page.screenshot({ path: "test-results/rampaging-provoke.png" });
  });
});
