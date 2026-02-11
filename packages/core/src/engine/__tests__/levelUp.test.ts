import { describe, it, expect } from "vitest";
import {
  getLevelFromFame,
  getLevelsCrossed,
  getLevelUpType,
  LEVEL_STATS,
  LEVEL_UP_TYPE_ODD,
  LEVEL_UP_TYPE_EVEN,
  LEVEL_UP,
  COMMAND_SLOT_GAINED,
  LEVEL_UP_REWARDS_PENDING,
  SKILL_GAINED,
  ADVANCED_ACTION_GAINED,
  CARD_BLOOD_RAGE,
  CARD_INTIMIDATE,
  type SkillId,
  type CardId,
} from "@mage-knight/shared";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { createEndTurnCommand } from "../commands/endTurn/index.js";
import { createChooseLevelUpRewardsCommand } from "../commands/chooseLevelUpRewardsCommand.js";
import {
  SKILL_ARYTHEA_DARK_PATHS,
  SKILL_ARYTHEA_BURNING_POWER,
  SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
  SKILL_TOVAK_DOUBLE_TIME,
} from "../../data/skills/index.js";

describe("Level calculations", () => {
  describe("getLevelFromFame", () => {
    it("should return level 1 for 0-2 fame", () => {
      expect(getLevelFromFame(0)).toBe(1);
      expect(getLevelFromFame(2)).toBe(1);
    });

    it("should return level 2 for 3-7 fame", () => {
      expect(getLevelFromFame(3)).toBe(2);
      expect(getLevelFromFame(7)).toBe(2);
    });

    it("should return level 3 for 8-13 fame", () => {
      expect(getLevelFromFame(8)).toBe(3);
      expect(getLevelFromFame(13)).toBe(3);
    });

    it("should return level 10 for 71+ fame", () => {
      expect(getLevelFromFame(71)).toBe(10);
      expect(getLevelFromFame(100)).toBe(10);
    });
  });

  describe("getLevelsCrossed", () => {
    it("should return empty for no level change", () => {
      expect(getLevelsCrossed(0, 2)).toEqual([]);
      expect(getLevelsCrossed(5, 7)).toEqual([]);
    });

    it("should return single level for crossing one threshold", () => {
      expect(getLevelsCrossed(2, 3)).toEqual([2]); // Cross into level 2
      expect(getLevelsCrossed(7, 8)).toEqual([3]); // Cross into level 3
    });

    it("should return multiple levels for large fame gains", () => {
      expect(getLevelsCrossed(0, 10)).toEqual([2, 3]); // 0 → 10 crosses 3 and 8
      expect(getLevelsCrossed(0, 21)).toEqual([2, 3, 4, 5]);
    });
  });

  describe("getLevelUpType", () => {
    it("should return ODD for levels 3, 5, 7, 9", () => {
      expect(getLevelUpType(3)).toBe(LEVEL_UP_TYPE_ODD);
      expect(getLevelUpType(5)).toBe(LEVEL_UP_TYPE_ODD);
      expect(getLevelUpType(7)).toBe(LEVEL_UP_TYPE_ODD);
      expect(getLevelUpType(9)).toBe(LEVEL_UP_TYPE_ODD);
    });

    it("should return EVEN for levels 2, 4, 6, 8, 10", () => {
      expect(getLevelUpType(2)).toBe(LEVEL_UP_TYPE_EVEN);
      expect(getLevelUpType(4)).toBe(LEVEL_UP_TYPE_EVEN);
      expect(getLevelUpType(6)).toBe(LEVEL_UP_TYPE_EVEN);
      expect(getLevelUpType(8)).toBe(LEVEL_UP_TYPE_EVEN);
      expect(getLevelUpType(10)).toBe(LEVEL_UP_TYPE_EVEN);
    });
  });

  describe("LEVEL_STATS", () => {
    it("should have correct stats for level 1", () => {
      expect(LEVEL_STATS[1]).toEqual({
        armor: 2,
        handLimit: 5,
        commandSlots: 1,
      });
    });

    it("should increase armor at level 3", () => {
      expect(LEVEL_STATS[2].armor).toBe(2);
      expect(LEVEL_STATS[3].armor).toBe(3);
    });

    it("should increase hand limit at level 5", () => {
      expect(LEVEL_STATS[4].handLimit).toBe(5);
      expect(LEVEL_STATS[5].handLimit).toBe(6);
    });

    it("should increase command slots at odd levels", () => {
      expect(LEVEL_STATS[2].commandSlots).toBe(1);
      expect(LEVEL_STATS[3].commandSlots).toBe(2);
      expect(LEVEL_STATS[4].commandSlots).toBe(2);
      expect(LEVEL_STATS[5].commandSlots).toBe(3);
    });
  });
});

describe("Level up at end of turn", () => {
  it("should level up when fame crosses threshold", () => {
    // Create player with 7 fame who gained enough to reach level 3
    const player = createTestPlayer({
      fame: 8,
      level: 1,
      playedCardFromHandThisTurn: true,
      pendingLevelUps: [2, 3], // Crossed levels 2 and 3
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const command = createEndTurnCommand({ playerId: "player1" });
    const result = command.execute(state);

    // Verify level is now 3
    const updatedPlayer = result.state.players.find(
      (p) => p.id === "player1"
    );
    expect(updatedPlayer?.level).toBe(3);
  });

  it("should gain command slot at odd levels", () => {
    // Create player crossing into level 3
    const player = createTestPlayer({
      fame: 8,
      level: 2,
      commandTokens: 1,
      playedCardFromHandThisTurn: true,
      pendingLevelUps: [3], // Crossing into level 3
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const command = createEndTurnCommand({ playerId: "player1" });
    const result = command.execute(state);

    // Verify command slots increased
    const updatedPlayer = result.state.players.find(
      (p) => p.id === "player1"
    );
    expect(updatedPlayer?.commandTokens).toBe(2);

    // Verify COMMAND_SLOT_GAINED event
    const commandSlotEvent = result.events.find(
      (e) => e.type === COMMAND_SLOT_GAINED
    );
    expect(commandSlotEvent).toBeDefined();
    if (commandSlotEvent?.type === COMMAND_SLOT_GAINED) {
      expect(commandSlotEvent.newTotal).toBe(2);
    }
  });

  it("should queue rewards choice at even levels", () => {
    // Create player crossing into level 2
    const player = createTestPlayer({
      fame: 3,
      level: 1,
      playedCardFromHandThisTurn: true,
      pendingLevelUps: [2], // Crossing into level 2
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const command = createEndTurnCommand({ playerId: "player1" });
    const result = command.execute(state);

    // Verify LEVEL_UP_REWARDS_PENDING event
    const pendingEvent = result.events.find(
      (e) => e.type === LEVEL_UP_REWARDS_PENDING
    );
    expect(pendingEvent).toBeDefined();
    if (pendingEvent?.type === LEVEL_UP_REWARDS_PENDING) {
      expect(pendingEvent.pendingLevels).toEqual([2]);
    }
  });

  it("should emit LEVEL_UP events for each level crossed", () => {
    // Create player with multiple pending level ups
    const player = createTestPlayer({
      fame: 10,
      level: 1,
      playedCardFromHandThisTurn: true,
      pendingLevelUps: [2, 3],
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const command = createEndTurnCommand({ playerId: "player1" });
    const result = command.execute(state);

    // Verify LEVEL_UP events
    const levelUpEvents = result.events.filter((e) => e.type === LEVEL_UP);
    expect(levelUpEvents.length).toBe(2);

    // First level up: 1 → 2 (even)
    const firstLevelUp = levelUpEvents[0];
    if (firstLevelUp?.type === LEVEL_UP) {
      expect(firstLevelUp.oldLevel).toBe(1);
      expect(firstLevelUp.newLevel).toBe(2);
      expect(firstLevelUp.levelUpType).toBe(LEVEL_UP_TYPE_EVEN);
    }

    // Second level up: 2 → 3 (odd)
    const secondLevelUp = levelUpEvents[1];
    if (secondLevelUp?.type === LEVEL_UP) {
      expect(secondLevelUp.oldLevel).toBe(2);
      expect(secondLevelUp.newLevel).toBe(3);
      expect(secondLevelUp.levelUpType).toBe(LEVEL_UP_TYPE_ODD);
    }
  });

  it("should update armor and hand limit at appropriate levels", () => {
    // Player crossing from level 2 to level 5 (armor at 3, hand limit at 5)
    const player = createTestPlayer({
      fame: 21, // Level 5
      level: 2,
      armor: 2,
      handLimit: 5,
      playedCardFromHandThisTurn: true,
      pendingLevelUps: [3, 4, 5],
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const command = createEndTurnCommand({ playerId: "player1" });
    const result = command.execute(state);

    const updatedPlayer = result.state.players.find(
      (p) => p.id === "player1"
    );
    expect(updatedPlayer?.level).toBe(5);
    expect(updatedPlayer?.armor).toBe(3); // Increased at level 3
    expect(updatedPlayer?.handLimit).toBe(6); // Increased at level 5
    expect(updatedPlayer?.commandTokens).toBe(3); // Increased at levels 3 and 5
  });

  it("should clear pending level ups after processing", () => {
    const player = createTestPlayer({
      fame: 8,
      level: 1,
      playedCardFromHandThisTurn: true,
      pendingLevelUps: [2, 3],
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const command = createEndTurnCommand({ playerId: "player1" });
    const result = command.execute(state);

    const updatedPlayer = result.state.players.find(
      (p) => p.id === "player1"
    );
    expect(updatedPlayer?.pendingLevelUps).toEqual([]);
  });

  it("should not emit level up events if no pending level ups", () => {
    const player = createTestPlayer({
      fame: 0,
      level: 1,
      playedCardFromHandThisTurn: true,
      pendingLevelUps: [],
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const command = createEndTurnCommand({ playerId: "player1" });
    const result = command.execute(state);

    const levelUpEvents = result.events.filter((e) => e.type === LEVEL_UP);
    expect(levelUpEvents.length).toBe(0);
  });

  it("player with 7 fame gaining 1 more crosses to level 3 and gains command slot", () => {
    // This is the specific scenario from the spec validation
    // Simulate: player has 7 fame (level 2), gains 1 fame to reach 8 (level 3)
    // We track this by having pendingLevelUps already set (as combat would set it)
    const player = createTestPlayer({
      fame: 8, // After gaining 1 fame from 7
      level: 2,
      commandTokens: 1,
      playedCardFromHandThisTurn: true,
      pendingLevelUps: [3], // getLevelsCrossed(7, 8) returns [3]
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const command = createEndTurnCommand({ playerId: "player1" });
    const result = command.execute(state);

    const updatedPlayer = result.state.players.find(
      (p) => p.id === "player1"
    );
    expect(updatedPlayer?.level).toBe(3);
    expect(updatedPlayer?.commandTokens).toBe(2);
    expect(updatedPlayer?.armor).toBe(3); // Armor increases at level 3

    // Verify events
    const levelUpEvent = result.events.find((e) => e.type === LEVEL_UP);
    expect(levelUpEvent).toBeDefined();
    if (levelUpEvent?.type === LEVEL_UP) {
      expect(levelUpEvent.newLevel).toBe(3);
      expect(levelUpEvent.levelUpType).toBe(LEVEL_UP_TYPE_ODD);
    }

    const commandSlotEvent = result.events.find(
      (e) => e.type === COMMAND_SLOT_GAINED
    );
    expect(commandSlotEvent).toBeDefined();
    if (commandSlotEvent?.type === COMMAND_SLOT_GAINED) {
      expect(commandSlotEvent.newTotal).toBe(2);
    }
  });
});

describe("Choose level up rewards", () => {
  it("should add selected skill to player when picking from drawn pair", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);

    const updatedPlayer = result.state.players.find((p) => p.id === "player1");
    expect(updatedPlayer?.skills).toContain(SKILL_ARYTHEA_DARK_PATHS);
  });

  it("should move rejected skill to common pool when picking from drawn pair", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);

    // The rejected skill (burning_power) should be in common pool
    expect(result.state.offers.commonSkills).toContain(SKILL_ARYTHEA_BURNING_POWER);
    // Selected skill should NOT be in common pool
    expect(result.state.offers.commonSkills).not.toContain(SKILL_ARYTHEA_DARK_PATHS);
  });

  it("should move BOTH drawn skills to common pool when picking from common pool", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [SKILL_TOVAK_DOUBLE_TIME], // Start with one skill in common pool
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: true,
        skillId: SKILL_TOVAK_DOUBLE_TIME,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);

    // Player should have the skill from common pool
    const updatedPlayer = result.state.players.find((p) => p.id === "player1");
    expect(updatedPlayer?.skills).toContain(SKILL_TOVAK_DOUBLE_TIME);

    // BOTH drawn skills should be in common pool
    expect(result.state.offers.commonSkills).toContain(SKILL_ARYTHEA_DARK_PATHS);
    expect(result.state.offers.commonSkills).toContain(SKILL_ARYTHEA_BURNING_POWER);
    // Selected skill should be removed from common pool
    expect(result.state.offers.commonSkills).not.toContain(SKILL_TOVAK_DOUBLE_TIME);
  });

  it("should add selected AA to top of player deck", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      deck: ["existing_card" as CardId],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);

    const updatedPlayer = result.state.players.find((p) => p.id === "player1");
    // AA should be drawn into hand after selection (async flow: place on deck, then draw up to limit)
    expect(updatedPlayer?.hand).toContain(CARD_BLOOD_RAGE);
    // Existing card from deck should still be in hand or deck
    expect(updatedPlayer?.hand.concat(updatedPlayer?.deck ?? [])).toContain("existing_card" as CardId);
  });

  it("should remove selected AA from offer", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);

    // Selected AA should be removed from offer
    expect(result.state.offers.advancedActions.cards).not.toContain(CARD_BLOOD_RAGE);
    // Other AA should still be there
    expect(result.state.offers.advancedActions.cards).toContain(CARD_INTIMIDATE);
  });

  it("should remove pending level up reward after selection", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);

    const updatedPlayer = result.state.players.find((p) => p.id === "player1");
    expect(updatedPlayer?.pendingLevelUpRewards).toEqual([]);
  });

  it("should emit SKILL_GAINED and ADVANCED_ACTION_GAINED events", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);

    const skillEvent = result.events.find((e) => e.type === SKILL_GAINED);
    expect(skillEvent).toBeDefined();
    if (skillEvent?.type === SKILL_GAINED) {
      expect(skillEvent.playerId).toBe("player1");
      expect(skillEvent.skillId).toBe(SKILL_ARYTHEA_DARK_PATHS);
    }

    const aaEvent = result.events.find((e) => e.type === ADVANCED_ACTION_GAINED);
    expect(aaEvent).toBeDefined();
    if (aaEvent?.type === ADVANCED_ACTION_GAINED) {
      expect(aaEvent.playerId).toBe("player1");
      expect(aaEvent.cardId).toBe(CARD_BLOOD_RAGE);
    }
  });

  it("should handle multiple pending level up rewards sequentially", () => {
    const player = createTestPlayer({
      level: 4,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
        {
          level: 4,
          drawnSkills: [SKILL_ARYTHEA_HOT_SWORDSMANSHIP, "arythea_dark_negotiation" as SkillId],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    // Select rewards for level 2
    const command1 = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result1 = command1.execute(state);

    // Level 2 reward should be removed, level 4 should remain
    const updatedPlayer1 = result1.state.players.find((p) => p.id === "player1");
    expect(updatedPlayer1?.pendingLevelUpRewards.length).toBe(1);
    expect(updatedPlayer1?.pendingLevelUpRewards[0]?.level).toBe(4);
    expect(updatedPlayer1?.skills).toContain(SKILL_ARYTHEA_DARK_PATHS);

    // Now select rewards for level 4
    const command2 = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 4,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
      },
      advancedActionId: CARD_INTIMIDATE,
    });

    const result2 = command2.execute(result1.state);

    const updatedPlayer2 = result2.state.players.find((p) => p.id === "player1");
    expect(updatedPlayer2?.pendingLevelUpRewards.length).toBe(0);
    expect(updatedPlayer2?.skills).toContain(SKILL_ARYTHEA_DARK_PATHS);
    expect(updatedPlayer2?.skills).toContain(SKILL_ARYTHEA_HOT_SWORDSMANSHIP);
  });

  it("should throw error when selecting skill not in drawn skills or common pool", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_TOVAK_DOUBLE_TIME, // Not in drawn skills
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    expect(() => command.execute(state)).toThrow();
  });

  it("should throw error when selecting AA not in offer", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: "not_in_offer" as CardId, // Not in offer
    });

    expect(() => command.execute(state)).toThrow();
  });

  it("should replenish AA offer from deck after selection", () => {
    const player = createTestPlayer({
      level: 2,
      skills: [],
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_ARYTHEA_DARK_PATHS, SKILL_ARYTHEA_BURNING_POWER],
        },
      ],
    });

    const newAACard = "blood_ritual" as CardId;
    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
      decks: {
        advancedActions: [newAACard],
        spells: [],
        artifacts: [],
        units: { regular: [], elite: [] },
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);

    // New AA should be drawn from deck to replenish offer
    expect(result.state.offers.advancedActions.cards).toContain(newAACard);
    expect(result.state.offers.advancedActions.cards.length).toBe(2);
    // Deck should be empty now
    expect(result.state.decks.advancedActions.length).toBe(0);
  });

  describe("Integration: Level-up AA during end-of-turn", () => {
    it("should place level-up AA on top of deck after end-turn and selection", () => {
      // Create player who will level up to level 2 at end of turn
      const player = createTestPlayer({
        id: "player1",
        level: 1,
        playedCardFromHandThisTurn: true,
        pendingLevelUps: [2], // Will level up to 2
        deck: ["existing_card" as CardId],
        remainingHeroSkills: [
          SKILL_ARYTHEA_DARK_PATHS,
          SKILL_ARYTHEA_BURNING_POWER,
          SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
        ],
      });

      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
        },
      });

      // Step 1: Execute end-turn (triggers level-up processing)
      const endTurnCommand = createEndTurnCommand({ playerId: "player1" });
      const endTurnResult = endTurnCommand.execute(state);

      // Verify player is now level 2
      const leveledUpPlayer = endTurnResult.state.players[0];
      expect(leveledUpPlayer.level).toBe(2);

      // Verify pending level-up rewards are created
      expect(leveledUpPlayer.pendingLevelUpRewards).toHaveLength(1);
      expect(leveledUpPlayer.pendingLevelUpRewards[0]?.level).toBe(2);

      // Step 2: Player selects level-up reward (AA choice)
      const drawnSkills = leveledUpPlayer.pendingLevelUpRewards[0]?.drawnSkills ?? [];
      if (drawnSkills.length === 0) {
        throw new Error("No drawn skills in pending reward");
      }

      const chooseRewardCommand = createChooseLevelUpRewardsCommand({
        playerId: "player1",
        level: 2,
        skillChoice: {
          fromCommonPool: false,
          skillId: drawnSkills[0]!,
        },
        advancedActionId: CARD_BLOOD_RAGE,
      });

      const chooseRewardResult = chooseRewardCommand.execute(endTurnResult.state);

      // Verify AA is in hand after selection and draw (async flow: placed on deck, then drawn up to hand limit)
      const finalPlayer = chooseRewardResult.state.players[0];
      expect(finalPlayer.hand).toContain(CARD_BLOOD_RAGE);

      // Verify pending rewards are cleared
      expect(finalPlayer.pendingLevelUpRewards).toHaveLength(0);

      // Verify ADVANCED_ACTION_GAINED event
      const aaGainedEvent = chooseRewardResult.events.find(
        (e) => e.type === ADVANCED_ACTION_GAINED
      );
      expect(aaGainedEvent).toBeDefined();
    });
  });
});
