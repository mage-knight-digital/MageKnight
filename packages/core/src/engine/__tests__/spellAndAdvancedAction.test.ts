/**
 * Tests for spell purchase and advanced action learning
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
  OFFER_TYPE_ADVANCED_ACTIONS,
  GAME_PHASE_ROUND,
  MANA_RED,
  MANA_BLUE,
  CARD_MARCH,
  CARD_FIREBALL,
  CARD_SNOWSTORM,
  CARD_RESTORATION,
  CARD_FIRE_BOLT,
  CARD_ICE_BOLT,
  CARD_BLOOD_RAGE,
  hexKey,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import type { CardId } from "@mage-knight/shared";

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

  describe("BUY_SPELL action", () => {
    describe("successful purchase", () => {
      it("should buy a spell with a mana token", () => {
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
            pureMana: [{ color: MANA_RED, fromSource: false }],
          }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
        });

        // Spell should be in discard
        expect(result.state.players[0].discard).toContain(CARD_FIREBALL);

        // Mana token should be consumed
        expect(result.state.players[0].pureMana).toHaveLength(0);

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

      it("should buy a spell with a crystal", () => {
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
            crystals: { red: 1, blue: 0, green: 0, white: 0 },
          }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
        });

        // Spell should be in discard
        expect(result.state.players[0].discard).toContain(CARD_FIREBALL);

        // Crystal should be consumed
        expect(result.state.players[0].crystals.red).toBe(0);
      });

      it("should buy a spell with a mana die from source", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL] },
          {}
        );

        // Add a red die to the source
        const stateWithDie = {
          ...state,
          source: {
            ...state.source,
            dice: [
              { id: "die1", color: MANA_RED, takenByPlayerId: null, isDepleted: false },
            ],
          },
        };

        const result = engine.processAction(stateWithDie, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
        });

        // Spell should be in discard
        expect(result.state.players[0].discard).toContain(CARD_FIREBALL);

        // Die should be marked as taken
        const die = result.state.source.dice.find((d) => d.id === "die1");
        expect(die?.takenByPlayerId).toBe("player1");
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
          { pureMana: [{ color: MANA_RED, fromSource: false }] },
          { spells: [CARD_RESTORATION] } // Deck has one card
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
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

      it("should allow buying spells at monastery", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { spells: [CARD_FIREBALL] },
          { pureMana: [{ color: MANA_RED, fromSource: false }] }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
        });

        // Spell should be in discard
        expect(result.state.players[0].discard).toContain(CARD_FIREBALL);
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
          { pureMana: [{ color: MANA_RED, fromSource: false }] }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
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

      it("should reject buying spell when not at spell site", () => {
        const villageSite: Site = {
          type: SiteType.Village, // Villages don't sell spells
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          villageSite,
          { spells: [CARD_FIREBALL] },
          { pureMana: [{ color: MANA_RED, fromSource: false }] }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
        });

        // Check for invalid action
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
          isConquered: false, // Not conquered
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL] },
          { pureMana: [{ color: MANA_RED, fromSource: false }] }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("conquer");
        }
      });

      it("should reject buying spell at burned monastery", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: true, // Burned
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { spells: [CARD_FIREBALL] },
          { pureMana: [{ color: MANA_RED, fromSource: false }] }
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("burned");
        }
      });

      it("should reject buying spell without matching mana", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { spells: [CARD_FIREBALL] },
          { pureMana: [{ color: MANA_BLUE, fromSource: false }] } // Blue, not red
        );

        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          manaPaid: MANA_RED, // Trying to pay with red but only have blue
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("mana");
        }
      });
    });
  });

  describe("LEARN_ADVANCED_ACTION action", () => {
    describe("successful learning", () => {
      it("should learn an advanced action from regular offer", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { advancedActions: [CARD_FIRE_BOLT, CARD_ICE_BOLT] },
          {}
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        // Advanced action should be in discard
        expect(result.state.players[0].discard).toContain(CARD_FIRE_BOLT);

        // Card should be removed from offer
        expect(result.state.offers.advancedActions.cards).not.toContain(CARD_FIRE_BOLT);

        // Check events
        const gainedEvent = result.events.find((e) => e.type === ADVANCED_ACTION_GAINED);
        expect(gainedEvent).toBeDefined();

        const offerTakenEvent = result.events.find((e) => e.type === OFFER_CARD_TAKEN);
        expect(offerTakenEvent).toBeDefined();
        if (offerTakenEvent && offerTakenEvent.type === OFFER_CARD_TAKEN) {
          expect(offerTakenEvent.offerType).toBe(OFFER_TYPE_ADVANCED_ACTIONS);
        }
      });

      it("should learn an advanced action from monastery offer", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { monasteryAdvancedActions: [CARD_BLOOD_RAGE] },
          {}
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        // Advanced action should be in discard
        expect(result.state.players[0].discard).toContain(CARD_BLOOD_RAGE);

        // Card should be removed from monastery offer
        expect(result.state.offers.monasteryAdvancedActions).not.toContain(CARD_BLOOD_RAGE);
      });

      it("should replenish regular offer from deck when taken", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { advancedActions: [CARD_FIRE_BOLT] },
          {},
          { advancedActions: [CARD_ICE_BOLT] } // Deck has one card
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
          {}
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
      it("should reject learning AA not in regular offer", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { advancedActions: [CARD_ICE_BOLT] }, // CARD_FIRE_BOLT is not in offer
          {}
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("not available");
        }
      });

      it("should reject learning AA not in monastery offer", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { monasteryAdvancedActions: [CARD_ICE_BOLT] }, // CARD_FIRE_BOLT not here
          {}
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: true,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("monastery");
        }
      });

      it("should reject learning AA at non-mage-tower site", () => {
        const villageSite: Site = {
          type: SiteType.Village,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          villageSite,
          { advancedActions: [CARD_FIRE_BOLT] },
          {}
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Mage Tower");
        }
      });

      it("should reject learning AA at unconquered mage tower", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { advancedActions: [CARD_FIRE_BOLT] },
          {}
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("conquer");
        }
      });

      it("should reject learning monastery AA at burned monastery", () => {
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: true, // Burned
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { monasteryAdvancedActions: [CARD_BLOOD_RAGE] },
          {}
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("burned");
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
          {}
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        // Check for invalid action
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Monastery");
        }
      });
    });
  });

  /**
   * =============================================================================
   * CORRECT GAME RULES - These tests document the actual Mage Knight rules
   * =============================================================================
   *
   * Current implementation has several rule violations. These tests should FAIL
   * until the implementation is corrected.
   *
   * RULE: Spells cost 7 INFLUENCE (not mana) at Mage Towers ONLY
   * RULE: Monasteries sell Advanced Actions (not spells) for 6 influence
   * RULE: Regular Advanced Actions are gained through LEVEL UP rewards only
   */
  describe("CORRECT RULES - Spell Purchase", () => {
    describe("spells should cost influence, not mana", () => {
      it.skip("should buy a spell with 7 influence at mage tower", () => {
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
            // Player has 7+ influence accumulated (not mana)
            influenceAccumulated: 7,
          }
        );

        // The action should NOT require manaPaid - it should use influence
        const result = engine.processAction(state, "player1", {
          type: BUY_SPELL_ACTION,
          cardId: CARD_FIREBALL,
          // No manaPaid - influence cost instead
        });

        expect(result.state.players[0].discard).toContain(CARD_FIREBALL);
        // Influence should be consumed
        expect(result.state.players[0].influenceAccumulated).toBe(0);
      });

      it.skip("should reject spell purchase with insufficient influence", () => {
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
            influenceAccumulated: 6, // Need 7
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
    });

    describe("spells should only be available at Mage Towers", () => {
      it.skip("should reject buying spells at monastery", () => {
        // RULE: Monasteries do NOT sell spells - they sell Advanced Actions
        const monasterySite: Site = {
          type: SiteType.Monastery,
          owner: null,
          isConquered: false,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          monasterySite,
          { spells: [CARD_FIREBALL] },
          { influenceAccumulated: 7 }
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
    });
  });

  describe("CORRECT RULES - Monastery Advanced Actions", () => {
    describe("monasteries should sell AAs for 6 influence", () => {
      it.skip("should buy monastery AA with 6 influence", () => {
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
            influenceAccumulated: 6,
          }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_BLOOD_RAGE,
          fromMonastery: true,
        });

        expect(result.state.players[0].discard).toContain(CARD_BLOOD_RAGE);
        expect(result.state.players[0].influenceAccumulated).toBe(0);
      });

      it.skip("should reject monastery AA purchase with insufficient influence", () => {
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
            influenceAccumulated: 5, // Need 6
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

  describe("CORRECT RULES - Regular Advanced Actions", () => {
    describe("regular AAs should only be gained through level up", () => {
      it.skip("should reject direct purchase of regular AA (not level up context)", () => {
        // RULE: Regular advanced actions from the offer are gained through
        // leveling up, not purchased with influence at mage towers
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
            // Player is NOT in a level-up reward selection context
            pendingRewards: [],
          }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        // Should be rejected - can only take AA during level up
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("level up");
        }
      });

      it.skip("should allow AA selection during level up reward", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: "player1",
          isConquered: true,
          isBurned: false,
        };

        const state = createStateWithSiteAndOffers(
          mageTowerSite,
          { advancedActions: [CARD_FIRE_BOLT, CARD_ICE_BOLT] },
          {
            // Player IS in a level-up reward context that offers AA choice
            pendingRewards: [{ type: "advancedAction" }],
          }
        );

        const result = engine.processAction(state, "player1", {
          type: LEARN_ADVANCED_ACTION_ACTION,
          cardId: CARD_FIRE_BOLT,
          fromMonastery: false,
        });

        expect(result.state.players[0].discard).toContain(CARD_FIRE_BOLT);
        // Pending reward should be consumed
        expect(result.state.players[0].pendingRewards).toHaveLength(0);
      });
    });
  });
});
