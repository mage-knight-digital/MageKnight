import { test, expect } from "@playwright/test";
import { navigateToRampagingCombat } from "./helpers";

/**
 * Rampaging Enemy E2E Tests
 *
 * Rampaging enemies (Orc Marauders, Draconum) have special movement rules:
 * 1. Cannot enter their hex - must defeat them from adjacent first
 * 2. Provoking - moving from one adjacent hex to another adjacent hex triggers combat
 * 3. Can challenge from adjacent - voluntary combat initiation (not tested here)
 *
 * To reach a rampaging enemy (at 4,-4 on explored tile):
 * 1. Move to explore position (3,-3) over 2 turns
 * 2. Explore the new tile
 * 3. Move to (3,-4) which is adjacent to rampaging enemy at (4,-4)
 *    This triggers provoke_rampaging combat
 */

test.describe("Rampaging Enemy Movement", () => {
  test("moving around rampaging enemy triggers combat (provoking)", async ({ page }) => {
    await navigateToRampagingCombat(page);

    // Verify combat was triggered
    const combatOverlay = page.locator('[data-testid="combat-overlay"]');
    await expect(combatOverlay).toBeVisible();
  });
});
