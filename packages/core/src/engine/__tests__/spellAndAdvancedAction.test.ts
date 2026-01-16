/**
 * Tests for spell purchase and advanced action learning
 *
 * RULES:
 * - Spells: Bought at conquered Mage Towers for 7 influence
 * - Monastery AAs: Bought at non-burned Monasteries for 6 influence
 * - Regular AAs: Only gained through level-up rewards (not purchased)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import {
  BUY_SPELL_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  INVALID_ACTION,
  CARD_GAINED,
  ADVANCED_ACTION_GAINED,
  OFFER_CARD_TAKEN,
  OFFER_REFRESHED,
  OFFER_TYPE_SPELLS,
  GAME_PHASE_ROUND,
  CARD_MARCH,
  CARD_FIREBALL,
  CARD_SNOWSTORM,
  CARD_RESTORATION,
  CARD_FIRE_BOLT,
  CARD_ICE_BOLT,
  CARD_BLOOD_RAGE,
  hexKey,
  SITE_REWARD_ADVANCED_ACTION,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import type { CardId, SiteReward } from "@mage-knight/shared";

describe("Spell Purchase and Advanced Action Learning", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a test state with a site at the player's position and offers
   */
  function createStateWithSiteAndOffers(
    site: Site,
    offers: {
      spells?: CardId[];
      advancedActions?: CardId[];
      monasteryAdvancedActions?: CardId[];
    },
    playerOverrides: Parameters<typeof createTestPlayer>[0] = {},
    decks?: {
      spells?: CardId[];
      advancedActions?: CardId[];
    }
  ) {
    const player = createTestPlayer({
      position: { q: 0, r: 0 },
      hand: [CARD_MARCH],
      ...playerOverrides,
    });

    const hex = {
      ...createTestHex(0, 0),
      site,
    };

    return createTestGameState({
      players: [player],
      phase: GAME_PHASE_ROUND,
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: hex,
        },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
      offers: {
        units: [],
        advancedActions: { cards: offers.advancedActions ?? [] },
        spells: { cards: offers.spells ?? [] },
        commonSkills: [],
        monasteryAdvancedActions: offers.monasteryAdvancedActions ?? [],
      },
      decks: {
        units: [],
        advancedActions: decks?.advancedActions ?? [],
        spells: decks?.spells ?? [],
        artifacts: [],
      },
    });
  }

  /**
   * Create a test state WITHOUT a site (for level-up tests where player isn't at a site)
   */
  function createStateWithoutSite(
    offers: {
      spells?: CardId[];
      advancedActions?: CardId[];
      monasteryAdvancedActions?: CardId[];
    },
    playerOverrides: Parameters<typeof createTestPlayer>[0] = {},
    decks?: {
      spells?: CardId[];
      advancedActions?: CardId[];
    }
  ) {
    const player = createTestPlayer({
      position: { q: 0, r: 0 },
      hand: [CARD_MARCH],
      ...playerOverrides,
    });

    const hex = {
      ...createTestHex(0, 0),
      site: undefined,
    };

    return createTestGameState({
      players: [player],
      phase: GAME_PHASE_ROUND,
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: hex,
        },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
      offers: {
        units: [],
        advancedActions: { cards: offers.advancedActions ?? [] },
        spells: { cards: offers.spells ?? [] },
        commonSkills: [],
        monasteryAdvancedActions: offers.monasteryAdvancedActions ?? [],
      },
      decks: {
        units: [],
        advancedActions: decks?.advancedActions ?? [],
        spells: decks?.spells ?? [],
        artifacts: [],
      },
    });
  }

  describe("BUY_SPELL action", () => {
    describe("successful purchase", () => {
      it("should buy a spell with 7 influence at mage tower", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL, CARD_SNOWSTORM] },
          {
            influencePoints: 7,
          }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        // Spell should be in discard
        expect(result.state.players[0].discard).toContain(CARD_FIREBALL);

        // Influence should be consumed
        expect(result.state.players[0].influencePoints).toBe(0);

        // Spell should be removed from offer
        expect(result.state.offers.spells.cards).not.toContain(CARD_FIREBALL);

        // Check events
        const gainedEvent = result.events.find((e) => e.type === CARD_GAINED);
        expect(gainedEvent).toBeDefined();

        const offerTakenEvent = result.events.find((e) => e.type === OFFER_CARD_TAKEN);
        expect(offerTakenEvent).toBeDefined();
        if (offerTakenEvent && offerTakenEvent.type === OFFER_CARD_TAKEN) {
          expect(offerTakenEvent.offerType).toBe(OFFER_TYPE_SPELLS);
          expect(offerTakenEvent.cardId).toBe(CARD_FIREBALL);
        }
      });

      it("should buy a spell with excess influence", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL] },
          {
            influencePoints: 10,
          }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        // Spell should be in discard
        expect(result.state.players[0].discard).toContain(CARD_FIREBALL);

        // Influence should be consumed (10 - 7 = 3)
        expect(result.state.players[0].influencePoints).toBe(3);
      });

      it("should replenish offer from deck when spell is taken", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL, CARD_SNOWSTORM] },
          { influencePoints: 7 },
          { spells: [CARD_RESTORATION] } // Deck has one card
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        // Offer should now have the deck card
        expect(result.state.offers.spells.cards).toContain(CARD_RESTORATION);
        expect(result.state.offers.spells.cards).toHaveLength(2);

        // Deck should be empty
        expect(result.state.decks.spells).toHaveLength(0);

        // Check for refreshed event
        const refreshedEvent = result.events.find((e) => e.type === OFFER_REFRESHED);
        expect(refreshedEvent).toBeDefined();
        if (refreshedEvent && refreshedEvent.type === OFFER_REFRESHED) {
          expect(refreshedEvent.offerType).toBe(OFFER_TYPE_SPELLS);
        }
      });
    });

    describe("validation", () => {
      it("should reject buying a spell not in offer", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_SNOWSTORM] }, // CARD_FIREBALL is not in offer
          { influencePoints: 7 }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        // Should not buy the spell
        expect(result.state.players[0].discard).not.toContain(CARD_FIREBALL);

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("not available");
        }
      });

      it("should reject buying spell when not at a site", () => {
        // Create state without a site at player position
        const player = createTestPlayer({
          position: { q: 0, r: 0 },
          hand: [CARD_MARCH],
          influencePoints: 7,
        });

        const hexWithoutSite = {
          ...createTestHex(0, 0),
          site: undefined,
        };

        const state = createTestGameState({
          players: [player],
          phase: GAME_PHASE_ROUND,
          map: {
            hexes: {
              [hexKey({ q: 0, r: 0 })]: hexWithoutSite,
            },
            tiles: [],
            tileDeck: { countryside: [], core: [] },
          },
          offers: {
            units: [],
            advancedActions: { cards: [] },
            spells: { cards: [CARD_FIREBALL] },
            commonSkills: [],
            monasteryAdvancedActions: [],
          },
        });

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
      });

      it("should reject buying spell at monastery (spells are Mage Tower only)", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { spells: [CARD_FIREBALL] },
          { influencePoints: 7 }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Mage Tower");
        }
      });

      it("should reject buying spell at village (wrong site type)", () => {
        const villageSite: Site = {
          type: SiteType.Village,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          villageSite,
          { spells: [CARD_FIREBALL] },
          { influencePoints: 7 }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Mage Tower");
        }
      });

      it("should reject buying spell at unconquered mage tower", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL] },
          { influencePoints: 7 }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("conquer");
        }
      });

      it("should reject buying spell with insufficient influence", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL] },
          {
            influencePoints: 6, // Need 7
          }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("influence");
        }
      });

      it("should reject buying spell with zero influence", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL] },
          {
            influencePoints: 0,
          }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
      });
    });
  });

  describe("LEARN_ADVANCED_ACTION action (Monastery)", () => {
    describe("successful purchase", () => {
      it("should buy monastery AA with 6 influence", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { monasteryAdvancedActions: [CARD_BLOOD_RAGE] },
          {
            influencePoints: 6,
          }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        // Advanced action should be in discard
        expect(result.state.players[0].discard).toContain(CARD_BLOOD_RAGE);

        // Influence should be consumed
        expect(result.state.players[0].influencePoints).toBe(0);

        // Card should be removed from monastery offer
        expect(result.state.offers.monasteryAdvancedActions).not.toContain(CARD_BLOOD_RAGE);

        // Check events
        const gainedEvent = result.events.find((e) => e.type === ADVANCED_ACTION_GAINED);
        expect(gainedEvent).toBeDefined();
      });

      it("should not replenish monastery offer (no deck)", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { monasteryAdvancedActions: [CARD_BLOOD_RAGE, CARD_FIRE_BOLT] },
          { influencePoints: 6 }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        // Monastery offer should just have one less card
        expect(result.state.offers.monasteryAdvancedActions).toHaveLength(1);
        expect(result.state.offers.monasteryAdvancedActions).toContain(CARD_FIRE_BOLT);

        // No refresh event for monastery
        const refreshedEvent = result.events.find((e) => e.type === OFFER_REFRESHED);
        expect(refreshedEvent).toBeUndefined();
      });
    });

    describe("validation", () => {
      it("should reject monastery AA not in monastery offer", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { monasteryAdvancedActions: [CARD_ICE_BOLT] }, // CARD_FIRE_BOLT not here
          { influencePoints: 6 }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: true,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("monastery");
        }
      });

      it("should reject monastery AA when not at monastery", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { monasteryAdvancedActions: [CARD_BLOOD_RAGE] },
          { influencePoints: 6 }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Monastery");
        }
      });

      it("should reject monastery AA at burned monastery", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: true,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { monasteryAdvancedActions: [CARD_BLOOD_RAGE] },
          { influencePoints: 6 }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("burned");
        }
      });

      it("should reject monastery AA with insufficient influence", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { monasteryAdvancedActions: [CARD_BLOOD_RAGE] },
          {
            influencePoints: 5, // Need 6
          }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("influence");
        }
      });
    });
  });

  describe("LEARN_ADVANCED_ACTION action (Level-up Reward)", () => {
    describe("successful selection", () => {
      it("should select AA from offer during level-up reward", () => {
        // Player doesn't need to be at a specific site for level-up rewards
        const state = createStateWithoutSite(
          { advancedActions: [CARD_FIRE_BOLT, CARD_ICE_BOLT] },
          {
            pendingRewards: [{ type: SITE_REWARD_ADVANCED_ACTION, count: 1 }] as SiteReward[],
          }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        // Advanced action should be in discard
        expect(result.state.players[0].discard).toContain(CARD_FIRE_BOLT);

        // Pending reward should be consumed
        expect(result.state.players[0].pendingRewards).toHaveLength(0);

        // Card should be removed from offer
        expect(result.state.offers.advancedActions.cards).not.toContain(CARD_FIRE_BOLT);

        // Check events
        const gainedEvent = result.events.find((e) => e.type === ADVANCED_ACTION_GAINED);
        expect(gainedEvent).toBeDefined();
      });

      it("should replenish regular offer from deck when taken", () => {
        const state = createStateWithoutSite(
          { advancedActions: [CARD_FIRE_BOLT] },
          {
            pendingRewards: [{ type: SITE_REWARD_ADVANCED_ACTION, count: 1 }] as SiteReward[],
          },
          { advancedActions: [CARD_ICE_BOLT] }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        // Offer should now have the deck card
        expect(result.state.offers.advancedActions.cards).toContain(CARD_ICE_BOLT);

        // Deck should be empty
        expect(result.state.decks.advancedActions).toHaveLength(0);

        // Check for refreshed event
        const refreshedEvent = result.events.find((e) => e.type === OFFER_REFRESHED);
        expect(refreshedEvent).toBeDefined();
      });
    });

    describe("validation", () => {
      it("should reject regular AA selection without level-up reward", () => {
        // No pending reward - just at a mage tower shouldn't be enough
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { advancedActions: [CARD_FIRE_BOLT] },
          {
            pendingRewards: [], // No pending reward
          }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("level");
        }
      });

      it("should reject regular AA not in offer", () => {
        const state = createStateWithoutSite(
          { advancedActions: [CARD_ICE_BOLT] }, // CARD_FIRE_BOLT is not in offer
          {
            pendingRewards: [{ type: SITE_REWARD_ADVANCED_ACTION, count: 1 }] as SiteReward[],
          }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("not available");
        }
      });
    });
  });
});
