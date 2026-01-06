import { test, expect } from "@playwright/test";

/**
 * Test with seed 123 to reproduce specific bug
 */

test("seed 123 - select Early Bird tactic", async ({ page }) => {
  await page.goto("/?seed=123");

  // Wait for tactic selection
  await expect(page.locator(".tactic-selection__title")).toBeVisible();

  // Take screenshot of tactic selection
  await page.screenshot({
    path: "e2e/screenshots/seed123-01-tactic-selection.png",
    fullPage: true,
  });

  // Find and click Early Bird tactic
  const earlyBirdTactic = page.locator(".tactic-card").filter({ hasText: "Early Bird" });
  await expect(earlyBirdTactic).toBeVisible();
  await earlyBirdTactic.click();

  // Wait for game to load
  await page.waitForTimeout(500);

  // Take screenshot after tactic selection
  await page.screenshot({
    path: "e2e/screenshots/seed123-02-after-early-bird.png",
    fullPage: true,
  });

  // Verify hex grid is visible
  await expect(page.locator(".hex-grid")).toBeVisible();

  // Log explore ghost info
  const ghosts = page.locator('[data-type="explore"]');
  const ghostCount = await ghosts.count();
  console.log(`Found ${ghostCount} explore ghosts`);

  for (let i = 0; i < ghostCount; i++) {
    const ghost = ghosts.nth(i);
    const coord = await ghost.getAttribute("data-coord");
    console.log(`  Ghost ${i + 1} at: ${coord}`);
  }

  // Log player position
  const heroToken = page.locator(".hero-token");
  if (await heroToken.isVisible()) {
    const parent = heroToken.locator("xpath=..");
    const coordAttr = await parent.getAttribute("data-coord");
    console.log(`Player at: ${coordAttr}`);
  }
});

test("seed 123 - move right twice to plains", async ({ page }) => {
  await page.goto("/?seed=123");

  // Wait for tactic selection and select Early Bird
  await expect(page.locator(".tactic-selection__title")).toBeVisible();
  const earlyBirdTactic = page.locator(".tactic-card").filter({ hasText: "Early Bird" });
  await earlyBirdTactic.click();
  await page.waitForTimeout(500);

  // Verify game loaded
  await expect(page.locator(".hex-grid")).toBeVisible();

  // Log starting position
  const heroToken = page.locator(".hero-token");
  let parent = heroToken.locator("xpath=..");
  let coordAttr = await parent.getAttribute("data-coord");
  console.log(`Starting position: ${coordAttr}`);

  // First move: click on plains hex to the right (E direction from 0,0 is 1,0)
  // Looking for a plains hex with green highlight that's to the right
  const firstMoveTarget = page.locator('[data-coord="1,0"]');
  await firstMoveTarget.click({ force: true });
  await page.waitForTimeout(300);

  // Log position after first move
  parent = heroToken.locator("xpath=..");
  coordAttr = await parent.getAttribute("data-coord");
  console.log(`After first move: ${coordAttr}`);

  // Second move: click on next plains hex to the right (2,0 or 2,-1)
  const secondMoveTarget = page.locator('[data-coord="2,-1"]');
  await secondMoveTarget.click({ force: true });
  await page.waitForTimeout(300);

  // Log position after second move
  parent = heroToken.locator("xpath=..");
  coordAttr = await parent.getAttribute("data-coord");
  console.log(`After second move: ${coordAttr}`);

  // Take screenshot
  await page.screenshot({
    path: "e2e/screenshots/seed123-03-after-two-moves-right.png",
    fullPage: true,
  });

  // Log explore ghost info
  const ghosts = page.locator('[data-type="explore"]');
  const ghostCount = await ghosts.count();
  console.log(`Found ${ghostCount} explore ghosts`);

  for (let i = 0; i < ghostCount; i++) {
    const ghost = ghosts.nth(i);
    const coord = await ghost.getAttribute("data-coord");
    console.log(`  Ghost ${i + 1} at: ${coord}`);
  }

  // Third move: click on the village hex (should be at 2,0 based on the map layout)
  const villageHex = page.locator('[data-coord="2,0"]');
  await villageHex.click({ force: true });
  await page.waitForTimeout(300);

  // Log position after third move
  parent = heroToken.locator("xpath=..");
  coordAttr = await parent.getAttribute("data-coord");
  console.log(`After third move (village): ${coordAttr}`);

  // Take screenshot
  await page.screenshot({
    path: "e2e/screenshots/seed123-04-at-village.png",
    fullPage: true,
  });

  // Log explore ghost info after moving to village
  const ghostsAfterVillage = page.locator('[data-type="explore"]');
  const ghostCountAfterVillage = await ghostsAfterVillage.count();
  console.log(`Found ${ghostCountAfterVillage} explore ghosts at village`);

  for (let i = 0; i < ghostCountAfterVillage; i++) {
    const ghost = ghostsAfterVillage.nth(i);
    const coord = await ghost.getAttribute("data-coord");
    console.log(`  Ghost ${i + 1} at: ${coord}`);
  }

  // Fourth move: move to the mine hex (should be edge of E tile)
  const mineHex = page.locator('[data-coord="3,0"]');
  await mineHex.click({ force: true });
  await page.waitForTimeout(300);

  parent = heroToken.locator("xpath=..");
  coordAttr = await parent.getAttribute("data-coord");
  console.log(`After fourth move (mine): ${coordAttr}`);

  // Take screenshot
  await page.screenshot({
    path: "e2e/screenshots/seed123-05-at-mine.png",
    fullPage: true,
  });

  // Log explore ghost info at mine
  const ghostsAtMine = page.locator('[data-type="explore"]');
  const ghostCountAtMine = await ghostsAtMine.count();
  console.log(`Found ${ghostCountAtMine} explore ghosts at mine`);

  for (let i = 0; i < ghostCountAtMine; i++) {
    const ghost = ghostsAtMine.nth(i);
    const coord = await ghost.getAttribute("data-coord");
    console.log(`  Ghost ${i + 1} at: ${coord}`);
  }

  // Fifth move: move to the forest hex (E tile center at 3,-1)
  const forestHex = page.locator('[data-coord="3,-1"]');
  await forestHex.click({ force: true });
  await page.waitForTimeout(300);

  parent = heroToken.locator("xpath=..");
  coordAttr = await parent.getAttribute("data-coord");
  console.log(`After fifth move (forest - E tile center): ${coordAttr}`);

  // Log explore ghost info at E tile center
  const ghostsAtForest = page.locator('[data-type="explore"]');
  const ghostCountAtForest = await ghostsAtForest.count();
  console.log(`Found ${ghostCountAtForest} explore ghosts at E tile center`);

  // Sixth move: move to the outermost hills hex (4,-1) - E edge of E tile
  const outerHillsHex = page.locator('[data-coord="4,-1"]');
  await outerHillsHex.click({ force: true });
  await page.waitForTimeout(300);

  parent = heroToken.locator("xpath=..");
  coordAttr = await parent.getAttribute("data-coord");
  console.log(`After sixth move (outer hills): ${coordAttr}`);

  // Take screenshot
  await page.screenshot({
    path: "e2e/screenshots/seed123-06-at-outer-hills.png",
    fullPage: true,
  });

  // Log explore ghost info at outer edge
  const ghostsAtOuterHills = page.locator('[data-type="explore"]');
  const ghostCountAtOuterHills = await ghostsAtOuterHills.count();
  console.log(`Found ${ghostCountAtOuterHills} explore ghosts at outer hills`);

  for (let i = 0; i < ghostCountAtOuterHills; i++) {
    const ghost = ghostsAtOuterHills.nth(i);
    const coord = await ghost.getAttribute("data-coord");
    console.log(`  Ghost ${i + 1} at: ${coord}`);
  }

});

test("seed 123 - reproduce explore issue at (5,-3)", async ({ page }) => {
  await page.goto("/?seed=123");

  // Select Early Bird tactic
  await expect(page.locator(".tactic-selection__title")).toBeVisible();
  const earlyBirdTactic = page.locator(".tactic-card").filter({ hasText: "Early Bird" });
  await earlyBirdTactic.click();
  await page.waitForTimeout(500);

  const heroToken = page.locator(".hero-token");

  // (0,0) → (1,0)
  await page.locator('[data-coord="1,0"]').click({ force: true });
  await page.waitForTimeout(300);

  // (1,0) → (2,-1)
  await page.locator('[data-coord="2,-1"]').click({ force: true });
  await page.waitForTimeout(300);

  // (2,-1) → (3,-2)
  await page.locator('[data-coord="3,-2"]').click({ force: true });
  await page.waitForTimeout(300);

  let parent = heroToken.locator("xpath=..");
  let coordAttr = await parent.getAttribute("data-coord");
  console.log(`At position: ${coordAttr}`);

  // Explore - click the ghost at (5,-4)
  let ghosts = page.locator('[data-type="explore"]');
  let ghostCount = await ghosts.count();
  console.log(`Found ${ghostCount} explore ghosts`);

  if (ghostCount > 0) {
    await ghosts.first().click({ force: true });
    await page.waitForTimeout(500);
    console.log("Explored tile at (5,-4)");
  }

  // (3,-2) → (4,-3)
  await page.locator('[data-coord="4,-3"]').click({ force: true });
  await page.waitForTimeout(300);

  // (4,-3) → (5,-3)
  await page.locator('[data-coord="5,-3"]').click({ force: true });
  await page.waitForTimeout(300);

  parent = heroToken.locator("xpath=..");
  coordAttr = await parent.getAttribute("data-coord");
  console.log(`Final position: ${coordAttr}`);

  // Take screenshot
  await page.screenshot({
    path: "e2e/screenshots/seed123-reproduce-5-3.png",
    fullPage: true,
  });

  // Check for explore ghosts
  ghosts = page.locator('[data-type="explore"]');
  ghostCount = await ghosts.count();
  console.log(`Found ${ghostCount} explore ghosts at (5,-3)`);

  for (let i = 0; i < ghostCount; i++) {
    const ghost = ghosts.nth(i);
    const coord = await ghost.getAttribute("data-coord");
    console.log(`  Ghost ${i + 1} at: ${coord}`);
  }
});

test("seed 123 - explore NE direction from (3,-2)", async ({ page }) => {
  await page.goto("/?seed=123");

  // Select Early Bird tactic
  await expect(page.locator(".tactic-selection__title")).toBeVisible();
  const earlyBirdTactic = page.locator(".tactic-card").filter({ hasText: "Early Bird" });
  await earlyBirdTactic.click();
  await page.waitForTimeout(500);

  const heroToken = page.locator(".hero-token");

  // Move to (1,-1) - NE from start
  await page.locator('[data-coord="1,-1"]').click({ force: true });
  await page.waitForTimeout(300);

  // Move to (2,-2)
  await page.locator('[data-coord="2,-2"]').click({ force: true });
  await page.waitForTimeout(300);

  // Move to (3,-2) - this should be on NE tile edge
  await page.locator('[data-coord="3,-2"]').click({ force: true });
  await page.waitForTimeout(300);

  let parent = heroToken.locator("xpath=..");
  let coordAttr = await parent.getAttribute("data-coord");
  console.log(`At position: ${coordAttr}`);

  // Take screenshot
  await page.screenshot({
    path: "e2e/screenshots/seed123-10-at-3-2.png",
    fullPage: true,
  });

  // Check for explore ghosts
  let ghosts = page.locator('[data-type="explore"]');
  let ghostCount = await ghosts.count();
  console.log(`Found ${ghostCount} explore ghosts at (3,-2)`);

  for (let i = 0; i < ghostCount; i++) {
    const ghost = ghosts.nth(i);
    const coord = await ghost.getAttribute("data-coord");
    console.log(`  Ghost ${i + 1} at: ${coord}`);
  }

  // If there's an explore ghost, click it
  if (ghostCount > 0) {
    console.log("Clicking explore ghost...");
    await ghosts.first().click({ force: true });
    await page.waitForTimeout(500);

    // Take screenshot after explore
    await page.screenshot({
      path: "e2e/screenshots/seed123-11-after-ne-explore.png",
      fullPage: true,
    });

    // First move onto the newly explored tile
    // The tile center is at (5,-4), so let's move step by step toward it
    // Current position: (3,-2)
    // Move to (4,-3)
    await page.locator('[data-coord="4,-3"]').click({ force: true });
    await page.waitForTimeout(300);

    parent = heroToken.locator("xpath=..");
    coordAttr = await parent.getAttribute("data-coord");
    console.log(`After move 1: ${coordAttr}`);

    // Move to (5,-4) - new tile center
    await page.locator('[data-coord="5,-4"]').click({ force: true });
    await page.waitForTimeout(300);

    parent = heroToken.locator("xpath=..");
    coordAttr = await parent.getAttribute("data-coord");
    console.log(`After move 2 (new tile center): ${coordAttr}`);

    // Move to (6,-5) - a gateway hex for both NE and E explore directions
    // Gateway hexes are the edge hexes adjacent to where new tiles connect
    const gatewayHex = page.locator('[data-coord="6,-5"]');
    if (await gatewayHex.isVisible()) {
      await gatewayHex.click({ force: true });
      await page.waitForTimeout(300);

      parent = heroToken.locator("xpath=..");
      coordAttr = await parent.getAttribute("data-coord");
      console.log(`Moved to gateway hex: ${coordAttr}`);

      // Take screenshot
      await page.screenshot({
        path: "e2e/screenshots/seed123-12-at-gateway.png",
        fullPage: true,
      });

      // Check for explore ghosts at gateway hex
      ghosts = page.locator('[data-type="explore"]');
      ghostCount = await ghosts.count();
      console.log(`Found ${ghostCount} explore ghosts at gateway hex (6,-5)`);

      for (let i = 0; i < ghostCount; i++) {
        const ghost = ghosts.nth(i);
        const coord = await ghost.getAttribute("data-coord");
        console.log(`  Ghost ${i + 1} at: ${coord}`);
      }

      // Should have explore options for both NE (7,-7) and E (8,-5) directions
      expect(ghostCount).toBeGreaterThan(0);
    } else {
      console.log("Gateway hex (6,-5) not visible");
    }
  } else {
    console.log("No explore ghost available at (3,-2) - checking why...");
  }
});

/**
 * Regression test for explore bug:
 * - Ghost shows at (5,-4) but tile gets placed at (6,-2)
 * - After clicking ghost at (5,-4), hex (4,-3) should exist (it's part of tile at 5,-4)
 * - This test will FAIL until the bug is fixed
 */
test("seed 123 - explore ghost at (5,-4) should place tile there", async ({ page }) => {
  await page.goto("/?seed=123");

  // Select Early Bird tactic
  await expect(page.locator(".tactic-selection__title")).toBeVisible();
  await page.locator(".tactic-card").filter({ hasText: "Early Bird" }).click();
  await page.waitForTimeout(500);

  // Move: (0,0) → (1,0) → (2,-1) → (3,-2)
  await page.locator('[data-coord="1,0"]').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('[data-coord="2,-1"]').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('[data-coord="3,-2"]').click({ force: true });
  await page.waitForTimeout(300);

  // Verify we're at (3,-2)
  const heroToken = page.locator(".hero-token");
  let parent = heroToken.locator("xpath=..");
  let pos = await parent.getAttribute("data-coord");
  expect(pos).toBe("3,-2");

  // Find and click the ghost at (5,-4)
  const ghost = page.locator('[data-type="explore"][data-coord="5,-4"]');
  await expect(ghost).toBeVisible({ timeout: 2000 });
  await ghost.click({ force: true });
  await page.waitForTimeout(500);

  // After explore, hex (4,-3) should exist (it's part of tile centered at 5,-4)
  // If tile was wrongly placed at (6,-2), this hex won't exist
  const newHex = page.locator('[data-coord="4,-3"]');
  await expect(newHex).toBeVisible({ timeout: 2000 });

  // Try to move to (4,-3) - should succeed if tile is at correct position
  await newHex.click({ force: true });
  await page.waitForTimeout(300);

  parent = heroToken.locator("xpath=..");
  pos = await parent.getAttribute("data-coord");
  expect(pos).toBe("4,-3");
});
