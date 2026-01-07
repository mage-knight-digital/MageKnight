import { test, expect } from "@playwright/test";
import {
  selectTactic,
  moveToExplorePosition,
  playCardBasicEffect,
} from "./helpers";

/**
 * Explore E2E Tests
 *
 * Tests the exploration flow:
 * 1. Move to edge of map where explore ghosts appear
 * 2. Play movement card to have enough move points
 * 3. Click explore ghost to place new tile
 * 4. Verify tile was placed and fame gained
 */

test.describe("Exploration", () => {
  test("can explore new tile from edge position", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // Move to (3,-3) over 2 turns - this is at the edge where explore is available
    await moveToExplorePosition(page);

    // Turn 3: Play march to get +2 move
    await playCardBasicEffect(page, "march");

    // Should now see explore ghosts
    const exploreGhosts = page.locator('[data-type="explore"]');
    await expect(exploreGhosts.first()).toBeVisible();

    const ghostCount = await exploreGhosts.count();
    expect(ghostCount).toBeGreaterThan(0);

    // Click the explore ghost to place a new tile
    await exploreGhosts.first().click();
    await page.waitForTimeout(500);

    // Verify explore ghosts are gone (tile was placed)
    // The ghost we clicked should no longer exist
    const ghostsAfter = await page.locator('[data-type="explore"]').count();
    expect(ghostsAfter).toBeLessThan(ghostCount);
  });

  test("exploring grants fame", async ({ page }) => {
    await page.goto("/?seed=123");
    await selectTactic(page);

    // Get initial fame (should be 0)
    const getFame = async () => {
      const fameText = await page
        .locator(".resource")
        .filter({ hasText: "Fame" })
        .locator(".resource__value")
        .textContent();
      return parseInt(fameText || "0", 10);
    };

    const fameBefore = await getFame();
    expect(fameBefore).toBe(0);

    // Move to explore position and explore
    await moveToExplorePosition(page);
    await playCardBasicEffect(page, "march");

    const exploreGhosts = page.locator('[data-type="explore"]');
    await exploreGhosts.first().click();
    await page.waitForTimeout(500);

    // Fame should have increased by 1 for exploring
    const fameAfter = await getFame();
    expect(fameAfter).toBe(1);
  });
});
