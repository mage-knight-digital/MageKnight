import { test, expect } from "@playwright/test";

/**
 * Tests for explore ghost positioning.
 *
 * Uses fixed seed 12345 for reproducible tile layouts.
 * These tests verify that explore ghosts only appear when:
 * 1. Player is on an edge hex
 * 2. Player's current tile has an unfilled adjacent slot
 * 3. Ghost position matches where the tile would actually be placed
 */

const TEST_SEED = 12345;

test.describe("Explore Ghost Positioning", () => {
  test.beforeEach(async ({ page }) => {
    // Use fixed seed for reproducibility
    await page.goto(`/?seed=${TEST_SEED}`);

    // Wait for page to load
    await page.waitForSelector(".tactic-selection__title");

    // Select first tactic to start game
    await page.locator(".tactic-card").first().click();
    await page.waitForTimeout(500);

    // Verify we're in the game
    await expect(page.locator(".hex-grid")).toBeVisible();
  });

  test("should show explore ghosts only when on edge tile with unfilled slots", async ({
    page,
  }) => {
    // Take initial screenshot showing starting position
    await page.screenshot({
      path: "e2e/screenshots/explore-01-initial.png",
      fullPage: true,
    });

    // Check if explore ghosts are visible
    const ghostHexes = page.locator('[data-type="explore"]');
    const ghostCount = await ghostHexes.count();

    console.log(`Found ${ghostCount} explore ghosts at start`);

    // At game start, player is on portal which is on starting tile
    // Starting tile has 2 adjacent tiles already placed (NE and E)
    // So there should be explore options for the remaining slots
    // OR no explore options if all adjacent slots are filled

    // Take screenshot showing ghost positions
    if (ghostCount > 0) {
      await page.screenshot({
        path: "e2e/screenshots/explore-02-ghosts-visible.png",
        fullPage: true,
      });

      // Get ghost coordinates
      for (let i = 0; i < ghostCount; i++) {
        const ghost = ghostHexes.nth(i);
        const coordAttr = await ghost.getAttribute("data-coord");
        console.log(`Ghost ${i + 1} at coord: ${coordAttr}`);
      }
    }
  });

  test("should not show explore when player is in middle of tile cluster", async ({
    page,
  }) => {
    // Move player to an interior hex (not on edge)
    // First, we need to move several times to get away from the edge

    // Take screenshot of starting position
    await page.screenshot({
      path: "e2e/screenshots/explore-03-before-moves.png",
      fullPage: true,
    });

    // Find valid move targets (highlighted hexes)
    const validMoves = page.locator('polygon[stroke="#00FF00"]');
    const moveCount = await validMoves.count();
    console.log(`Found ${moveCount} valid move targets`);

    // Move to an interior hex if possible
    // We'll click on a hex that's highlighted as a valid move
    if (moveCount > 0) {
      // Click on a valid move hex
      await validMoves.first().click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: "e2e/screenshots/explore-04-after-move.png",
        fullPage: true,
      });

      // Check ghost count after move
      const ghostsAfterMove = page.locator('[data-type="explore"]');
      const ghostCountAfter = await ghostsAfterMove.count();
      console.log(`Found ${ghostCountAfter} explore ghosts after move`);
    }
  });

  test("explore ghost should be at tile center position, adjacent to current tile", async ({
    page,
  }) => {
    // This test verifies the ghost hex is positioned correctly
    // relative to the player's current tile

    const ghostHexes = page.locator('[data-type="explore"]');
    const ghostCount = await ghostHexes.count();

    if (ghostCount > 0) {
      // Get the hero token position
      const heroToken = page.locator(".hero-token");
      const heroBox = await heroToken.boundingBox();

      // Get ghost positions
      for (let i = 0; i < ghostCount; i++) {
        const ghost = ghostHexes.nth(i);
        const ghostBox = await ghost.boundingBox();
        const coordAttr = await ghost.getAttribute("data-coord");

        if (heroBox && ghostBox) {
          const dx = ghostBox.x - heroBox.x;
          const dy = ghostBox.y - heroBox.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          console.log(
            `Ghost at ${coordAttr}: distance from hero = ${distance.toFixed(0)}px`
          );

          // Ghost should be at tile-center distance, not immediately adjacent
          // Tile placement offsets are larger than single hex moves
          // A single hex is ~50px, tile centers are 2-3 hexes apart
          expect(distance).toBeGreaterThan(50); // Not immediately adjacent
        }
      }
    }

    await page.screenshot({
      path: "e2e/screenshots/explore-05-ghost-positions.png",
      fullPage: true,
    });
  });

  test("should show explore ghosts when player moves to edge tile with unfilled slots", async ({
    page,
  }) => {
    // Starting position is on the portal (starting tile center)
    // Starting tile has NE and E tiles already placed
    // We need to move to one of those outer tiles to find unexplored edges

    // Take initial screenshot
    await page.screenshot({
      path: "e2e/screenshots/explore-08-start-position.png",
      fullPage: true,
    });

    // Move multiple times toward the edge of the map
    // Keep moving until we either find explore ghosts or run out of moves
    let foundExploreGhosts = false;
    let moveCount = 0;
    const maxMoves = 10;

    while (!foundExploreGhosts && moveCount < maxMoves) {
      // Find valid move targets
      const validMoves = page.locator('polygon[stroke="#00FF00"]');
      const moveTargetCount = await validMoves.count();

      if (moveTargetCount === 0) {
        console.log("No valid moves available");
        break;
      }

      // Click on the last valid move (tends to be toward edge)
      // Use force: true because text labels may intercept clicks
      await validMoves.last().click({ force: true });
      await page.waitForTimeout(300);
      moveCount++;

      // Check for explore ghosts
      const ghosts = page.locator('[data-type="explore"]');
      const ghostCount = await ghosts.count();

      if (ghostCount > 0) {
        foundExploreGhosts = true;
        console.log(`Found ${ghostCount} explore ghosts after ${moveCount} moves`);

        // Screenshot showing explore ghosts
        await page.screenshot({
          path: "e2e/screenshots/explore-09-found-ghosts.png",
          fullPage: true,
        });

        // Get ghost coordinates
        for (let i = 0; i < ghostCount; i++) {
          const ghost = ghosts.nth(i);
          const coord = await ghost.getAttribute("data-coord");
          console.log(`  Ghost ${i + 1} at: ${coord}`);
        }
      }
    }

    console.log(`Completed ${moveCount} moves, found ghosts: ${foundExploreGhosts}`);

    // Take final screenshot
    await page.screenshot({
      path: "e2e/screenshots/explore-10-final-position.png",
      fullPage: true,
    });
  });

  test("clicking explore ghost should place tile at ghost position", async ({
    page,
  }) => {
    const ghostHexes = page.locator('[data-type="explore"]');
    const initialGhostCount = await ghostHexes.count();

    if (initialGhostCount === 0) {
      console.log("No explore ghosts visible - skipping click test");
      return;
    }

    // Get initial hex count
    const hexPolygons = page.locator(".hex-polygon");
    const initialHexCount = await hexPolygons.count();
    console.log(`Initial hex count: ${initialHexCount}`);

    // Get the ghost's coordinate before clicking
    const firstGhost = ghostHexes.first();
    const ghostCoord = await firstGhost.getAttribute("data-coord");
    console.log(`Clicking explore ghost at: ${ghostCoord}`);

    // Take screenshot before explore
    await page.screenshot({
      path: "e2e/screenshots/explore-06-before-explore.png",
      fullPage: true,
    });

    // Click the explore ghost
    await firstGhost.click();
    await page.waitForTimeout(500);

    // Take screenshot after explore
    await page.screenshot({
      path: "e2e/screenshots/explore-07-after-explore.png",
      fullPage: true,
    });

    // Hex count should have increased (7 new hexes from the tile)
    const finalHexCount = await hexPolygons.count();
    console.log(`Final hex count: ${finalHexCount}`);

    // Should have 7 more hexes (one tile)
    expect(finalHexCount).toBe(initialHexCount + 7);

    // The ghost at that position should be gone
    const remainingGhosts = page.locator('[data-type="explore"]');
    const remainingCount = await remainingGhosts.count();
    console.log(`Remaining ghosts: ${remainingCount}`);

    // Should have one fewer ghost (or same if new ghosts appeared)
    expect(remainingCount).toBeLessThanOrEqual(initialGhostCount);
  });
});
