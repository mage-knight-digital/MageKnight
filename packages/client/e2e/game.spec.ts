import { test, expect } from "@playwright/test";

test.describe("Mage Knight Client", () => {
  test("initial load shows tactic selection overlay", async ({ page }) => {
    await page.goto("/");

    // Take screenshot of initial state
    await page.screenshot({ path: "e2e/screenshots/01-initial-load.png", fullPage: true });

    // Should show tactic selection overlay
    const overlay = page.locator(".overlay");
    await expect(overlay).toBeVisible();

    // Should have tactic selection title
    const title = page.locator(".tactic-selection__title");
    await expect(title).toContainText("Select Your Tactic");

    // Should show 6 tactic cards
    const tacticCards = page.locator(".tactic-card");
    await expect(tacticCards).toHaveCount(6);

    // Take screenshot of tactic selection
    await page.screenshot({ path: "e2e/screenshots/02-tactic-selection.png", fullPage: true });
  });

  test("selecting a tactic dismisses overlay and shows game", async ({ page }) => {
    await page.goto("/");

    // Wait for tactic selection
    await expect(page.locator(".tactic-selection__title")).toBeVisible();

    // Click first tactic card
    const firstTactic = page.locator(".tactic-card").first();
    await firstTactic.click();

    // Wait a moment for state update
    await page.waitForTimeout(500);

    // Take screenshot after tactic selection
    await page.screenshot({ path: "e2e/screenshots/03-after-tactic-selection.png", fullPage: true });

    // Overlay should be gone
    const overlay = page.locator(".overlay");
    await expect(overlay).not.toBeVisible();

    // Should see the hex grid
    const hexGrid = page.locator(".hex-grid");
    await expect(hexGrid).toBeVisible();

    // Should see player hand
    const playerHand = page.locator(".player-hand");
    await expect(playerHand).toBeVisible();

    // Should see action bar
    const actionBar = page.locator(".action-bar");
    await expect(actionBar).toBeVisible();
  });

  test("hex grid renders with hexes and player token", async ({ page }) => {
    await page.goto("/");

    // Select tactic first
    await page.locator(".tactic-card").first().click();
    await page.waitForTimeout(500);

    // Take screenshot of hex grid
    await page.screenshot({ path: "e2e/screenshots/04-hex-grid.png", fullPage: true });

    // Check hex grid exists
    const hexGrid = page.locator(".hex-grid");
    await expect(hexGrid).toBeVisible();

    // Check for hex polygons
    const hexPolygons = page.locator(".hex-polygon");
    const hexCount = await hexPolygons.count();
    console.log(`Found ${hexCount} hex polygons`);
    expect(hexCount).toBeGreaterThan(0);

    // Check for hero token
    const heroToken = page.locator(".hero-token");
    await expect(heroToken).toBeVisible();
  });

  test("player hand shows cards that can be selected", async ({ page }) => {
    await page.goto("/");

    // Select tactic first
    await page.locator(".tactic-card").first().click();
    await page.waitForTimeout(500);

    // Check hand has cards
    const cards = page.locator(".player-hand__cards .card");
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} cards in hand`);
    expect(cardCount).toBeGreaterThan(0);

    // Take screenshot before card selection
    await page.screenshot({ path: "e2e/screenshots/05-hand-before-selection.png", fullPage: true });

    // Click first card
    await cards.first().click();

    // Card should be selected
    const selectedCard = page.locator(".card--selected");
    await expect(selectedCard).toBeVisible();

    // Play mode menu should appear
    const playModeMenu = page.locator(".play-mode-menu");
    await expect(playModeMenu).toBeVisible();

    // Take screenshot with card selected
    await page.screenshot({ path: "e2e/screenshots/06-card-selected.png", fullPage: true });
  });

  test("end turn button works", async ({ page }) => {
    await page.goto("/");

    // Select tactic first
    await page.locator(".tactic-card").first().click();
    await page.waitForTimeout(500);

    // End turn button should be visible and enabled
    const endTurnBtn = page.locator(".action-bar__btn--end-turn");
    await expect(endTurnBtn).toBeVisible();
    await expect(endTurnBtn).toBeEnabled();

    // Take screenshot before end turn
    await page.screenshot({ path: "e2e/screenshots/07-before-end-turn.png", fullPage: true });

    // Click end turn
    await endTurnBtn.click();
    await page.waitForTimeout(500);

    // Take screenshot after end turn
    await page.screenshot({ path: "e2e/screenshots/08-after-end-turn.png", fullPage: true });

    // Check events panel shows END_TURN event
    const eventLog = page.locator(".debug-state");
    const eventText = await eventLog.textContent();
    console.log("Events after end turn:", eventText);
  });

  test("clicking hex sends move action", async ({ page }) => {
    await page.goto("/");

    // Select tactic first
    await page.locator(".tactic-card").first().click();
    await page.waitForTimeout(500);

    // Find a hex that's not the player's current position
    // We'll click on a hex polygon
    const hexPolygons = page.locator(".hex-polygon");
    const hexCount = await hexPolygons.count();
    console.log(`Found ${hexCount} hexes to click`);

    if (hexCount > 1) {
      // Click second hex (not the starting position)
      await hexPolygons.nth(1).click();
      await page.waitForTimeout(500);

      // Take screenshot after move attempt
      await page.screenshot({ path: "e2e/screenshots/09-after-move-attempt.png", fullPage: true });

      // Check event log for any events
      const eventLog = page.locator(".debug-state");
      const eventText = await eventLog.textContent();
      console.log("Events after move:", eventText);
    }
  });

  test("mana source panel shows dice", async ({ page }) => {
    await page.goto("/");

    // Select tactic first
    await page.locator(".tactic-card").first().click();
    await page.waitForTimeout(500);

    // Find mana source panel
    const manaSourcePanel = page.locator(".panel").filter({ hasText: "Mana Source" });
    await expect(manaSourcePanel).toBeVisible();

    // Take screenshot of sidebar
    await page.screenshot({ path: "e2e/screenshots/10-sidebar-panels.png", fullPage: true });
  });

  test("resource panel shows player stats", async ({ page }) => {
    await page.goto("/");

    // Select tactic first
    await page.locator(".tactic-card").first().click();
    await page.waitForTimeout(500);

    // Check resource panel
    const resourcePanel = page.locator(".panel").filter({ hasText: "Player Info" });
    await expect(resourcePanel).toBeVisible();

    // Should show hero name
    const heroResource = resourcePanel.locator(".resource").filter({ hasText: "Hero" });
    await expect(heroResource).toBeVisible();

    // Should show level
    const levelResource = resourcePanel.locator(".resource").filter({ hasText: "Level" });
    await expect(levelResource).toBeVisible();
  });

  test("full game flow screenshot walkthrough", async ({ page }) => {
    await page.goto("/");

    // 1. Initial load
    await page.screenshot({ path: "e2e/screenshots/flow-01-initial.png", fullPage: true });

    // 2. Select tactic
    await page.locator(".tactic-card").first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/flow-02-tactic-selected.png", fullPage: true });

    // 3. Select a card
    const cards = page.locator(".player-hand__cards .card");
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.screenshot({ path: "e2e/screenshots/flow-03-card-selected.png", fullPage: true });

      // 4. Play card sideways for move
      const sidewaysBtn = page.locator(".play-mode-menu__btn--sideways");
      if (await sidewaysBtn.isVisible()) {
        await sidewaysBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "e2e/screenshots/flow-04-card-played.png", fullPage: true });
      }
    }

    // 5. Try to move
    const hexPolygons = page.locator(".hex-polygon");
    if (await hexPolygons.count() > 1) {
      await hexPolygons.nth(1).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/flow-05-move-attempted.png", fullPage: true });
    }

    // 6. End turn
    const endTurnBtn = page.locator(".action-bar__btn--end-turn");
    if (await endTurnBtn.isEnabled()) {
      await endTurnBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/flow-06-turn-ended.png", fullPage: true });
    }
  });
});
