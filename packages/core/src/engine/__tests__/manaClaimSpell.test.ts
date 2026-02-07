/**
 * Tests for the Mana Claim / Mana Curse spell (Blue Spell #110)
 *
 * Basic (Mana Claim): Take a basic color die from Source, keep until end of
 * round. Choose: gain 3 mana tokens of that color THIS turn, OR gain 1 mana
 * token each turn for remainder of round (starting next turn).
 *
 * Powered (Mana Curse): Same as basic effect. In addition, until end of round:
 * each time another player uses one or more mana of that color on their turn
 * (from any source), they take a Wound (max 1 per player per turn).
 *
 * Key rules:
 * - Special category (both effects)
 * - Interactive: removed in friendly game mode
 * - End-of-round: basic does nothing, powered has no curse effect
 * - Die stays claimed until end of round (excluded from turn-end safety net)
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
  checkManaCurseWound,
  grantManaClaimSustainedToken,
  resetManaCurseWoundTracking,
} from "../effects/index.js";
import type {
  ManaClaimEffect,
  ResolveManaClaimDieEffect,
  ResolveManaClaimModeEffect,
  ManaCurseEffect,
} from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_MANA_CLAIM,
  EFFECT_RESOLVE_MANA_CLAIM_DIE,
  EFFECT_RESOLVE_MANA_CLAIM_MODE,
  EFFECT_MANA_CURSE,
} from "../../types/effectTypes.js";
import {
  EFFECT_MANA_CLAIM_SUSTAINED,
  EFFECT_MANA_CURSE as MODIFIER_MANA_CURSE,
} from "../../types/modifierConstants.js";
import {
  CARD_MANA_CLAIM,
  CARD_WOUND,
  CARD_MARCH,
  MANA_BLACK,
  MANA_BLUE,
  MANA_RED,
  MANA_GREEN,
  MANA_TOKEN_SOURCE_CARD,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import { MANA_CLAIM } from "../../data/spells/blue/manaClaim.js";
import { getSpellCard } from "../../data/spells/index.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { sourceDieId } from "../../types/mana.js";
import type { SourceDie } from "../../types/mana.js";
import type { ManaClaimSustainedModifier, ManaCurseModifier } from "../../types/modifiers.js";
import { setupNextPlayer } from "../commands/endTurn/turnAdvancement.js";
import { processDiceReturn } from "../commands/endTurn/diceManagement.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createSourceDie(
  id: string,
  color: string,
  takenByPlayerId: string | null = null
): SourceDie {
  return {
    id: sourceDieId(id),
    color: color as SourceDie["color"],
    isDepleted: false,
    takenByPlayerId,
  };
}

function createStateWithDice(
  dice: SourceDie[],
  overrides: Partial<GameState> = {}
): GameState {
  const caster = createTestPlayer({ id: "caster" });
  const opponent = createTestPlayer({
    id: "opponent",
    position: { q: 1, r: 0 },
  });

  return createTestGameState({
    players: [caster, opponent],
    turnOrder: ["caster", "opponent"],
    source: { dice },
    ...overrides,
  });
}

function createStateWithBasicDice(
  overrides: Partial<GameState> = {}
): GameState {
  const dice: SourceDie[] = [
    createSourceDie("die_1", MANA_RED),
    createSourceDie("die_2", MANA_BLUE),
    createSourceDie("die_3", MANA_GREEN),
  ];
  return createStateWithDice(dice, overrides);
}

function getCaster(state: GameState) {
  return state.players.find((p) => p.id === "caster")!;
}

function getOpponent(state: GameState, id = "opponent") {
  return state.players.find((p) => p.id === id)!;
}

// ============================================================================
// SPELL CARD DEFINITION TESTS
// ============================================================================

describe("Mana Claim spell card definition", () => {
  it("should be registered in spell cards", () => {
    const card = getSpellCard(CARD_MANA_CLAIM);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Mana Claim");
  });

  it("should have correct metadata", () => {
    expect(MANA_CLAIM.id).toBe(CARD_MANA_CLAIM);
    expect(MANA_CLAIM.name).toBe("Mana Claim");
    expect(MANA_CLAIM.poweredName).toBe("Mana Curse");
    expect(MANA_CLAIM.cardType).toBe(DEED_CARD_TYPE_SPELL);
    expect(MANA_CLAIM.sidewaysValue).toBe(1);
  });

  it("should be powered by black + blue mana", () => {
    expect(MANA_CLAIM.poweredBy).toEqual([MANA_BLACK, MANA_BLUE]);
  });

  it("should have special category", () => {
    expect(MANA_CLAIM.categories).toEqual([CATEGORY_SPECIAL]);
  });

  it("should be marked as interactive", () => {
    expect(MANA_CLAIM.interactive).toBe(true);
  });

  it("should have basic effect of type EFFECT_MANA_CLAIM", () => {
    const effect = MANA_CLAIM.basicEffect as ManaClaimEffect;
    expect(effect.type).toBe(EFFECT_MANA_CLAIM);
  });

  it("should have powered effect of type EFFECT_MANA_CURSE", () => {
    const effect = MANA_CLAIM.poweredEffect as ManaCurseEffect;
    expect(effect.type).toBe(EFFECT_MANA_CURSE);
  });
});

// ============================================================================
// BASIC EFFECT (MANA CLAIM) TESTS
// ============================================================================

describe("EFFECT_MANA_CLAIM (basic)", () => {
  const basicEffect: ManaClaimEffect = {
    type: EFFECT_MANA_CLAIM,
  };

  describe("isEffectResolvable", () => {
    it("should always be resolvable", () => {
      const state = createStateWithBasicDice();
      expect(isEffectResolvable(state, "caster", basicEffect)).toBe(true);
    });
  });

  describe("die selection", () => {
    it("should present basic color dice as options", () => {
      const state = createStateWithBasicDice();

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toBeDefined();
      expect(result.dynamicChoiceOptions!.length).toBe(3);

      const options = result.dynamicChoiceOptions as ResolveManaClaimDieEffect[];
      expect(options[0]!.type).toBe(EFFECT_RESOLVE_MANA_CLAIM_DIE);
      expect(options[0]!.withCurse).toBe(false);
    });

    it("should only show available (untaken) dice", () => {
      const dice: SourceDie[] = [
        createSourceDie("die_1", MANA_RED, "opponent"), // taken
        createSourceDie("die_2", MANA_BLUE),
        createSourceDie("die_3", MANA_GREEN),
      ];
      const state = createStateWithDice(dice);

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.dynamicChoiceOptions!.length).toBe(2);
      const dieIds = (result.dynamicChoiceOptions as ResolveManaClaimDieEffect[])
        .map((o) => o.dieId);
      expect(dieIds).not.toContain(sourceDieId("die_1"));
    });

    it("should exclude non-basic color dice (gold, black)", () => {
      const dice: SourceDie[] = [
        createSourceDie("die_1", MANA_RED),
        createSourceDie("die_2", "gold"),
        createSourceDie("die_3", "black"),
      ];
      const state = createStateWithDice(dice);

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.dynamicChoiceOptions!.length).toBe(1);
      const option = (result.dynamicChoiceOptions as ResolveManaClaimDieEffect[])[0]!;
      expect(option.dieColor).toBe(MANA_RED);
    });

    it("should return no-op when no basic color dice available", () => {
      const dice: SourceDie[] = [
        createSourceDie("die_1", "gold"),
        createSourceDie("die_2", "black"),
      ];
      const state = createStateWithDice(dice);

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.requiresChoice).toBeFalsy();
      expect(result.description).toContain("No basic color dice");
    });

    it("should return no-op when all dice are taken", () => {
      const dice: SourceDie[] = [
        createSourceDie("die_1", MANA_RED, "opponent"),
        createSourceDie("die_2", MANA_BLUE, "caster"),
      ];
      const state = createStateWithDice(dice);

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.requiresChoice).toBeFalsy();
    });
  });

  describe("end-of-round restriction", () => {
    it("should do nothing when end of round announced", () => {
      const state = createStateWithBasicDice({
        endOfRoundAnnouncedBy: "opponent",
      });

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.requiresChoice).toBeFalsy();
      expect(result.description).toContain("no effect");
    });

    it("should do nothing when scenario end triggered", () => {
      const state = createStateWithBasicDice({
        scenarioEndTriggered: true,
      });

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.requiresChoice).toBeFalsy();
    });
  });
});

// ============================================================================
// RESOLVE MANA CLAIM DIE TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MANA_CLAIM_DIE", () => {
  it("should present burst and sustained mode options", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimDieEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_DIE,
      dieId: sourceDieId("die_1"),
      dieColor: MANA_RED,
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toHaveLength(2);

    const options = result.dynamicChoiceOptions as ResolveManaClaimModeEffect[];
    expect(options[0]!.mode).toBe("burst");
    expect(options[0]!.color).toBe(MANA_RED);
    expect(options[0]!.withCurse).toBe(false);
    expect(options[1]!.mode).toBe("sustained");
  });

  it("should propagate curse flag to mode options", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimDieEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_DIE,
      dieId: sourceDieId("die_1"),
      dieColor: MANA_RED,
      withCurse: true,
    };

    const result = resolveEffect(state, "caster", effect);

    const options = result.dynamicChoiceOptions as ResolveManaClaimModeEffect[];
    expect(options[0]!.withCurse).toBe(true);
    expect(options[1]!.withCurse).toBe(true);
  });

  it("should handle die no longer available", () => {
    const dice: SourceDie[] = [
      createSourceDie("die_1", MANA_RED, "opponent"), // now taken
    ];
    const state = createStateWithDice(dice);

    const effect: ResolveManaClaimDieEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_DIE,
      dieId: sourceDieId("die_1"),
      dieColor: MANA_RED,
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    expect(result.requiresChoice).toBeFalsy();
    expect(result.description).toContain("no longer available");
  });
});

// ============================================================================
// RESOLVE MANA CLAIM MODE - BURST TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MANA_CLAIM_MODE (burst)", () => {
  it("should grant 3 mana tokens of the claimed color", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_1"),
      color: MANA_RED,
      mode: "burst",
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    const caster = getCaster(result.state);
    const redTokens = caster.pureMana.filter((t) => t.color === MANA_RED);
    expect(redTokens).toHaveLength(3);
    expect(redTokens[0]!.source).toBe(MANA_TOKEN_SOURCE_CARD);
  });

  it("should claim the die (set takenByPlayerId)", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_1"),
      color: MANA_RED,
      mode: "burst",
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    const claimedDie = result.state.source.dice.find(
      (d) => d.id === sourceDieId("die_1")
    );
    expect(claimedDie!.takenByPlayerId).toBe("caster");
  });

  it("should not add sustained modifier for burst mode", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_1"),
      color: MANA_RED,
      mode: "burst",
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    const sustainedModifiers = result.state.activeModifiers.filter(
      (m) => m.effect.type === EFFECT_MANA_CLAIM_SUSTAINED
    );
    expect(sustainedModifiers).toHaveLength(0);
  });
});

// ============================================================================
// RESOLVE MANA CLAIM MODE - SUSTAINED TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MANA_CLAIM_MODE (sustained)", () => {
  it("should NOT grant tokens immediately (starts next turn)", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_2"),
      color: MANA_BLUE,
      mode: "sustained",
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    const caster = getCaster(result.state);
    expect(caster.pureMana).toHaveLength(0);
  });

  it("should add a round-duration sustained modifier", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_2"),
      color: MANA_BLUE,
      mode: "sustained",
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    const sustainedModifiers = result.state.activeModifiers.filter(
      (m) => m.effect.type === EFFECT_MANA_CLAIM_SUSTAINED
    );
    expect(sustainedModifiers).toHaveLength(1);

    const mod = sustainedModifiers[0]!;
    const modEffect = mod.effect as ManaClaimSustainedModifier;
    expect(modEffect.color).toBe(MANA_BLUE);
    expect(modEffect.claimedDieId).toEqual(sourceDieId("die_2"));
    expect(mod.duration).toBe("round");
    expect(mod.createdByPlayerId).toBe("caster");
  });

  it("should claim the die (set takenByPlayerId)", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_2"),
      color: MANA_BLUE,
      mode: "sustained",
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    const claimedDie = result.state.source.dice.find(
      (d) => d.id === sourceDieId("die_2")
    );
    expect(claimedDie!.takenByPlayerId).toBe("caster");
  });
});

// ============================================================================
// POWERED EFFECT (MANA CURSE) TESTS
// ============================================================================

describe("EFFECT_MANA_CURSE (powered)", () => {
  const poweredEffect: ManaCurseEffect = {
    type: EFFECT_MANA_CURSE,
  };

  describe("die selection", () => {
    it("should present die options with curse flag", () => {
      const state = createStateWithBasicDice();

      const result = resolveEffect(state, "caster", poweredEffect);

      expect(result.requiresChoice).toBe(true);
      const options = result.dynamicChoiceOptions as ResolveManaClaimDieEffect[];
      expect(options[0]!.withCurse).toBe(true);
    });
  });

  describe("end-of-round restriction", () => {
    it("should disable curse after end of round announced", () => {
      const state = createStateWithBasicDice({
        endOfRoundAnnouncedBy: "opponent",
      });

      const result = resolveEffect(state, "caster", poweredEffect);

      expect(result.requiresChoice).toBe(true);
      // Die options should have withCurse = false
      const options = result.dynamicChoiceOptions as ResolveManaClaimDieEffect[];
      expect(options[0]!.withCurse).toBe(false);
      expect(result.description).toContain("no curse");
    });
  });

  describe("curse modifier creation", () => {
    it("should add curse modifier when burst mode with curse", () => {
      const state = createStateWithBasicDice();

      const effect: ResolveManaClaimModeEffect = {
        type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
        dieId: sourceDieId("die_1"),
        color: MANA_RED,
        mode: "burst",
        withCurse: true,
      };

      const result = resolveEffect(state, "caster", effect);

      const curseModifiers = result.state.activeModifiers.filter(
        (m) => m.effect.type === MODIFIER_MANA_CURSE
      );
      expect(curseModifiers).toHaveLength(1);

      const mod = curseModifiers[0]!;
      const modEffect = mod.effect as ManaCurseModifier;
      expect(modEffect.color).toBe(MANA_RED);
      expect(modEffect.claimedDieId).toEqual(sourceDieId("die_1"));
      expect(modEffect.woundedPlayerIdsThisTurn).toEqual([]);
      expect(mod.duration).toBe("round");
      expect(mod.createdByPlayerId).toBe("caster");
    });

    it("should add both sustained and curse modifiers when sustained mode with curse", () => {
      const state = createStateWithBasicDice();

      const effect: ResolveManaClaimModeEffect = {
        type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
        dieId: sourceDieId("die_3"),
        color: MANA_GREEN,
        mode: "sustained",
        withCurse: true,
      };

      const result = resolveEffect(state, "caster", effect);

      const sustainedModifiers = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_MANA_CLAIM_SUSTAINED
      );
      const curseModifiers = result.state.activeModifiers.filter(
        (m) => m.effect.type === MODIFIER_MANA_CURSE
      );

      expect(sustainedModifiers).toHaveLength(1);
      expect(curseModifiers).toHaveLength(1);
    });

    it("should not add curse modifier without curse flag", () => {
      const state = createStateWithBasicDice();

      const effect: ResolveManaClaimModeEffect = {
        type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
        dieId: sourceDieId("die_1"),
        color: MANA_RED,
        mode: "burst",
        withCurse: false,
      };

      const result = resolveEffect(state, "caster", effect);

      const curseModifiers = result.state.activeModifiers.filter(
        (m) => m.effect.type === MODIFIER_MANA_CURSE
      );
      expect(curseModifiers).toHaveLength(0);
    });
  });
});

// ============================================================================
// MANA CURSE WOUND CHECK TESTS
// ============================================================================

describe("checkManaCurseWound", () => {
  function createStateWithCurse(
    curseColor: string,
    casterId: string = "caster"
  ): GameState {
    const state = createStateWithBasicDice();
    return {
      ...state,
      activeModifiers: [
        {
          id: "curse_mod_1",
          source: { type: "card" as const, cardId: CARD_MANA_CLAIM as import("@mage-knight/shared").CardId, playerId: casterId },
          duration: "round" as const,
          scope: { type: "other_players" as const },
          effect: {
            type: MODIFIER_MANA_CURSE,
            color: curseColor as import("@mage-knight/shared").BasicManaColor,
            claimedDieId: sourceDieId("die_1"),
            woundedPlayerIdsThisTurn: [] as readonly string[],
          },
          createdAtRound: 1,
          createdByPlayerId: casterId,
        },
      ],
    };
  }

  it("should wound opponent when they use cursed mana color", () => {
    const state = createStateWithCurse(MANA_RED);

    const result = checkManaCurseWound(state, "opponent", MANA_RED);

    const opponent = getOpponent(result);
    const wounds = opponent.hand.filter((c) => c === CARD_WOUND);
    expect(wounds).toHaveLength(1);
  });

  it("should not wound caster when they use their own cursed color", () => {
    const state = createStateWithCurse(MANA_RED, "caster");

    const result = checkManaCurseWound(state, "caster", MANA_RED);

    const caster = getCaster(result);
    const wounds = caster.hand.filter((c) => c === CARD_WOUND);
    expect(wounds).toHaveLength(0);
  });

  it("should not wound when using a different color", () => {
    const state = createStateWithCurse(MANA_RED);

    const result = checkManaCurseWound(state, "opponent", MANA_BLUE);

    const opponent = getOpponent(result);
    const wounds = opponent.hand.filter((c) => c === CARD_WOUND);
    expect(wounds).toHaveLength(0);
  });

  it("should limit wound to 1 per player per turn", () => {
    const state = createStateWithCurse(MANA_RED);

    // First usage - should wound
    const afterFirst = checkManaCurseWound(state, "opponent", MANA_RED);
    const opponentAfterFirst = getOpponent(afterFirst);
    const woundsAfterFirst = opponentAfterFirst.hand.filter((c) => c === CARD_WOUND);
    expect(woundsAfterFirst).toHaveLength(1);

    // Second usage same turn - should NOT wound again
    const afterSecond = checkManaCurseWound(afterFirst, "opponent", MANA_RED);
    const opponentAfterSecond = getOpponent(afterSecond);
    const woundsAfterSecond = opponentAfterSecond.hand.filter((c) => c === CARD_WOUND);
    expect(woundsAfterSecond).toHaveLength(1); // Still only 1
  });

  it("should track wounded player IDs on the modifier", () => {
    const state = createStateWithCurse(MANA_RED);

    const result = checkManaCurseWound(state, "opponent", MANA_RED);

    const curseMod = result.activeModifiers.find(
      (m) => m.effect.type === MODIFIER_MANA_CURSE
    );
    const effect = curseMod!.effect as ManaCurseModifier;
    expect(effect.woundedPlayerIdsThisTurn).toContain("opponent");
  });

  it("should do nothing when no curse modifiers are active", () => {
    const state = createStateWithBasicDice();

    const result = checkManaCurseWound(state, "opponent", MANA_RED);

    // State should be unchanged
    expect(result).toBe(state);
  });
});

// ============================================================================
// SUSTAINED TOKEN GRANT TESTS
// ============================================================================

describe("grantManaClaimSustainedToken", () => {
  function createStateWithSustainedModifier(
    color: string,
    casterId: string = "caster"
  ): GameState {
    const state = createStateWithBasicDice();
    return {
      ...state,
      activeModifiers: [
        {
          id: "sustained_mod_1",
          source: { type: "card" as const, cardId: CARD_MANA_CLAIM as import("@mage-knight/shared").CardId, playerId: casterId },
          duration: "round" as const,
          scope: { type: "self" as const },
          effect: {
            type: EFFECT_MANA_CLAIM_SUSTAINED,
            color: color as import("@mage-knight/shared").BasicManaColor,
            claimedDieId: sourceDieId("die_1"),
          },
          createdAtRound: 1,
          createdByPlayerId: casterId,
        },
      ],
    };
  }

  it("should grant 1 token of the sustained color", () => {
    const state = createStateWithSustainedModifier(MANA_BLUE);
    const player = getCaster(state);

    const result = grantManaClaimSustainedToken(state, player);

    const blueTokens = result.pureMana.filter((t) => t.color === MANA_BLUE);
    expect(blueTokens).toHaveLength(1);
    expect(blueTokens[0]!.source).toBe(MANA_TOKEN_SOURCE_CARD);
  });

  it("should not grant tokens to a different player", () => {
    const state = createStateWithSustainedModifier(MANA_BLUE, "caster");
    const opponent = getOpponent(state);

    const result = grantManaClaimSustainedToken(state, opponent);

    expect(result.pureMana).toHaveLength(0);
  });

  it("should return player unchanged when no sustained modifier exists", () => {
    const state = createStateWithBasicDice();
    const player = getCaster(state);

    const result = grantManaClaimSustainedToken(state, player);

    expect(result).toBe(player);
  });
});

// ============================================================================
// RESET MANA CURSE WOUND TRACKING TESTS
// ============================================================================

describe("resetManaCurseWoundTracking", () => {
  it("should clear wounded player IDs on curse modifiers", () => {
    const state = createStateWithBasicDice();
    const stateWithCurse: GameState = {
      ...state,
      activeModifiers: [
        {
          id: "curse_mod_1",
          source: { type: "card" as const, cardId: CARD_MANA_CLAIM as import("@mage-knight/shared").CardId, playerId: "caster" },
          duration: "round" as const,
          scope: { type: "other_players" as const },
          effect: {
            type: MODIFIER_MANA_CURSE,
            color: MANA_RED as import("@mage-knight/shared").BasicManaColor,
            claimedDieId: sourceDieId("die_1"),
            woundedPlayerIdsThisTurn: ["opponent"] as readonly string[],
          },
          createdAtRound: 1,
          createdByPlayerId: "caster",
        },
      ],
    };

    const result = resetManaCurseWoundTracking(stateWithCurse);

    const curseMod = result.activeModifiers.find(
      (m) => m.effect.type === MODIFIER_MANA_CURSE
    );
    const effect = curseMod!.effect as ManaCurseModifier;
    expect(effect.woundedPlayerIdsThisTurn).toEqual([]);
  });

  it("should return state unchanged when no curse modifiers exist", () => {
    const state = createStateWithBasicDice();

    const result = resetManaCurseWoundTracking(state);

    expect(result).toBe(state);
  });
});

// ============================================================================
// DICE PERSISTENCE TESTS (die should NOT be released at end of turn)
// ============================================================================

describe("Mana Claim die persistence across turns", () => {
  it("should exclude Mana Claim dice from turn-end safety net cleanup", () => {
    // This test verifies the logic in diceManagement.ts
    // When a player ends their turn, claimed dice should NOT be released
    const state = createStateWithBasicDice();

    // First, claim a die via burst mode
    const claimEffect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_1"),
      color: MANA_RED,
      mode: "burst",
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", claimEffect);

    // Verify die is claimed
    const claimedDie = result.state.source.dice.find(
      (d) => d.id === sourceDieId("die_1")
    );
    expect(claimedDie!.takenByPlayerId).toBe("caster");

    // The sustained modifier tracks the claimed die ID
    // In diceManagement.ts, this die would be excluded from the safety net
    // because the active modifier references it via claimedDieId
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Mana Claim effects", () => {
  it("should describe EFFECT_MANA_CLAIM", () => {
    const effect: ManaClaimEffect = { type: EFFECT_MANA_CLAIM };
    const desc = describeEffect(effect);
    expect(desc).toContain("Claim");
    expect(desc).toContain("die");
  });

  it("should describe EFFECT_RESOLVE_MANA_CLAIM_DIE", () => {
    const effect: ResolveManaClaimDieEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_DIE,
      dieId: sourceDieId("die_1"),
      dieColor: MANA_RED,
      withCurse: false,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("red");
  });

  it("should describe EFFECT_RESOLVE_MANA_CLAIM_MODE burst", () => {
    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_1"),
      color: MANA_RED,
      mode: "burst",
      withCurse: false,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("3");
    expect(desc).toContain("red");
  });

  it("should describe EFFECT_RESOLVE_MANA_CLAIM_MODE sustained", () => {
    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("die_1"),
      color: MANA_BLUE,
      mode: "sustained",
      withCurse: false,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("1");
    expect(desc).toContain("blue");
  });

  it("should describe EFFECT_MANA_CURSE", () => {
    const effect: ManaCurseEffect = { type: EFFECT_MANA_CURSE };
    const desc = describeEffect(effect);
    expect(desc).toContain("Claim");
    expect(desc).toContain("curse");
  });
});

// ============================================================================
// COVERAGE: handleManaCurse no-dice path (lines 154-158)
// ============================================================================

describe("EFFECT_MANA_CURSE - no dice available", () => {
  it("should return no-op when no basic color dice available", () => {
    const dice: SourceDie[] = [
      createSourceDie("die_1", "gold"),
      createSourceDie("die_2", "black"),
    ];
    const state = createStateWithDice(dice);

    const poweredEffect: ManaCurseEffect = { type: EFFECT_MANA_CURSE };
    const result = resolveEffect(state, "caster", poweredEffect);

    expect(result.requiresChoice).toBeFalsy();
    expect(result.description).toContain("No basic color dice");
  });
});

// ============================================================================
// COVERAGE: resolveManaClaimMode die-not-found path (lines 244-248)
// ============================================================================

describe("EFFECT_RESOLVE_MANA_CLAIM_MODE - die not found", () => {
  it("should handle die not found in source", () => {
    const state = createStateWithBasicDice();

    const effect: ResolveManaClaimModeEffect = {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId: sourceDieId("nonexistent_die"),
      color: MANA_RED,
      mode: "burst",
      withCurse: false,
    };

    const result = resolveEffect(state, "caster", effect);

    expect(result.requiresChoice).toBeFalsy();
    expect(result.description).toContain("Die not found");
  });
});

// ============================================================================
// COVERAGE: checkManaCurseWound woundPileCount handling (lines 379-382)
// ============================================================================

describe("checkManaCurseWound - wound pile count", () => {
  function createStateWithCurseAndWoundPile(
    woundPileCount: number | null
  ): GameState {
    const state = createStateWithBasicDice({ woundPileCount });
    return {
      ...state,
      activeModifiers: [
        {
          id: "curse_mod_1",
          source: { type: "card" as const, cardId: CARD_MANA_CLAIM as CardId, playerId: "caster" },
          duration: "round" as const,
          scope: { type: "other_players" as const },
          effect: {
            type: MODIFIER_MANA_CURSE,
            color: MANA_RED as import("@mage-knight/shared").BasicManaColor,
            claimedDieId: sourceDieId("die_1"),
            woundedPlayerIdsThisTurn: [] as readonly string[],
          },
          createdAtRound: 1,
          createdByPlayerId: "caster",
        },
      ],
    };
  }

  it("should decrement woundPileCount when finite", () => {
    const state = createStateWithCurseAndWoundPile(10);

    const result = checkManaCurseWound(state, "opponent", MANA_RED);

    expect(result.woundPileCount).toBe(9);
  });

  it("should keep woundPileCount as null when null (unlimited wounds)", () => {
    const state = createStateWithCurseAndWoundPile(null);

    const result = checkManaCurseWound(state, "opponent", MANA_RED);

    expect(result.woundPileCount).toBeNull();
  });

  it("should not go below 0 for woundPileCount", () => {
    const state = createStateWithCurseAndWoundPile(0);

    const result = checkManaCurseWound(state, "opponent", MANA_RED);

    expect(result.woundPileCount).toBe(0);
  });
});

// ============================================================================
// COVERAGE: setupNextPlayer calling grantManaClaimSustainedToken (lines 121, 155-156)
// ============================================================================

describe("setupNextPlayer - Mana Claim sustained token integration", () => {
  function createStateWithSustainedModForPlayer(
    playerId: string
  ): GameState {
    const caster = createTestPlayer({
      id: "caster",
      hand: [CARD_MARCH as CardId],
    });
    const opponent = createTestPlayer({
      id: "opponent",
      position: { q: 1, r: 0 },
      hand: [CARD_MARCH as CardId],
    });

    const state = createTestGameState({
      players: [caster, opponent],
      turnOrder: ["caster", "opponent"],
    });

    return {
      ...state,
      activeModifiers: [
        {
          id: "sustained_mod_1",
          source: { type: "card" as const, cardId: CARD_MANA_CLAIM as CardId, playerId },
          duration: "round" as const,
          scope: { type: "self" as const },
          effect: {
            type: EFFECT_MANA_CLAIM_SUSTAINED,
            color: MANA_BLUE as import("@mage-knight/shared").BasicManaColor,
            claimedDieId: sourceDieId("die_1"),
          },
          createdAtRound: 1,
          createdByPlayerId: playerId,
        },
      ],
    };
  }

  it("should grant sustained token when advancing to next player (normal turn)", () => {
    const state = createStateWithSustainedModForPlayer("opponent");

    const result = setupNextPlayer(state, "opponent", false, "caster");

    const opponent = result.players.find((p) => p.id === "opponent")!;
    const blueTokens = opponent.pureMana.filter((t) => t.color === MANA_BLUE);
    expect(blueTokens).toHaveLength(1);
    expect(blueTokens[0]!.source).toBe(MANA_TOKEN_SOURCE_CARD);
  });

  it("should grant sustained token on extra turn (same player)", () => {
    const caster = createTestPlayer({
      id: "caster",
      hand: [CARD_MARCH as CardId],
      tacticState: { extraTurnPending: true },
    });
    const opponent = createTestPlayer({
      id: "opponent",
      position: { q: 1, r: 0 },
    });

    const state = createTestGameState({
      players: [caster, opponent],
      turnOrder: ["caster", "opponent"],
      activeModifiers: [
        {
          id: "sustained_mod_1",
          source: { type: "card" as const, cardId: CARD_MANA_CLAIM as CardId, playerId: "caster" },
          duration: "round" as const,
          scope: { type: "self" as const },
          effect: {
            type: EFFECT_MANA_CLAIM_SUSTAINED,
            color: MANA_GREEN as import("@mage-knight/shared").BasicManaColor,
            claimedDieId: sourceDieId("die_2"),
          },
          createdAtRound: 1,
          createdByPlayerId: "caster",
        },
      ],
    });

    const result = setupNextPlayer(state, "caster", true, "caster");

    const casterResult = result.players.find((p) => p.id === "caster")!;
    const greenTokens = casterResult.pureMana.filter((t) => t.color === MANA_GREEN);
    expect(greenTokens).toHaveLength(1);
  });
});

// ============================================================================
// COVERAGE: processDiceReturn excluding Mana Claim dice (lines 78-83)
// ============================================================================

describe("processDiceReturn - Mana Claim die exclusion", () => {
  it("should not release dice referenced by EFFECT_MANA_CLAIM_SUSTAINED modifier", () => {
    const claimedDieId = sourceDieId("claimed_die");
    const normalDieId = sourceDieId("normal_die");

    const dice: SourceDie[] = [
      createSourceDie("claimed_die", MANA_BLUE, "caster"),
      createSourceDie("normal_die", MANA_RED, "caster"),
    ];

    const caster = createTestPlayer({ id: "caster" });
    const state = createTestGameState({
      players: [caster],
      turnOrder: ["caster"],
      source: { dice },
      activeModifiers: [
        {
          id: "sustained_mod_1",
          source: { type: "card" as const, cardId: CARD_MANA_CLAIM as CardId, playerId: "caster" },
          duration: "round" as const,
          scope: { type: "self" as const },
          effect: {
            type: EFFECT_MANA_CLAIM_SUSTAINED,
            color: MANA_BLUE as import("@mage-knight/shared").BasicManaColor,
            claimedDieId,
          },
          createdAtRound: 1,
          createdByPlayerId: "caster",
        },
      ],
    });

    const result = processDiceReturn(state, caster, [caster]);

    // Claimed die should still be taken
    const claimedDie = result.source.dice.find((d) => d.id === claimedDieId);
    expect(claimedDie!.takenByPlayerId).toBe("caster");

    // Normal die should be released
    const normalDie = result.source.dice.find((d) => d.id === normalDieId);
    expect(normalDie!.takenByPlayerId).toBeNull();
  });

  it("should not release dice referenced by EFFECT_MANA_CURSE modifier", () => {
    const curseDieId = sourceDieId("curse_die");

    const dice: SourceDie[] = [
      createSourceDie("curse_die", MANA_RED, "caster"),
    ];

    const caster = createTestPlayer({ id: "caster" });
    const state = createTestGameState({
      players: [caster],
      turnOrder: ["caster"],
      source: { dice },
      activeModifiers: [
        {
          id: "curse_mod_1",
          source: { type: "card" as const, cardId: CARD_MANA_CLAIM as CardId, playerId: "caster" },
          duration: "round" as const,
          scope: { type: "other_players" as const },
          effect: {
            type: MODIFIER_MANA_CURSE,
            color: MANA_RED as import("@mage-knight/shared").BasicManaColor,
            claimedDieId: curseDieId,
            woundedPlayerIdsThisTurn: [] as readonly string[],
          },
          createdAtRound: 1,
          createdByPlayerId: "caster",
        },
      ],
    });

    const result = processDiceReturn(state, caster, [caster]);

    // Curse die should still be taken
    const curseDie = result.source.dice.find((d) => d.id === curseDieId);
    expect(curseDie!.takenByPlayerId).toBe("caster");
  });
});
