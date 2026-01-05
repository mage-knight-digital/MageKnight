/**
 * Test cards for validating the conditional effects system
 *
 * These are real Mage Knight cards implemented using our effect system.
 * This is a SPIKE to validate the design - NOT production code.
 *
 * Goal: Implement 5-10 real cards and see if the system holds up.
 */

import type { CardEffect } from "../types/cards.js";
import {
  move,
  attack,
  block,
  influence,
  heal,
  compound,
  choice,
  rangedAttack,
  fireRangedAttack,
  iceRangedAttack,
  fireAttack,
  fireBlock,
  iceBlock,
  ifNight,
  ifInPhase,
  ifOnTerrain,
  ifBlockedSuccessfully,
  fireAttackPerEnemy,
  fireBlockPerEnemy,
} from "./effectHelpers.js";
import { COMBAT_PHASE_ATTACK } from "../types/combat.js";
import {
  TERRAIN_FOREST,
  TERRAIN_HILLS,
} from "@mage-knight/shared";

// ============================================================================
// CARDS THAT WORK WELL WITH THE CURRENT SYSTEM
// ============================================================================

/**
 * Ice Bolt (White Spell)
 * Basic: Ice Ranged Attack 3. Night: Ice Ranged Attack 5
 * Powered: Ice Ranged Attack 7
 *
 * Pattern: Day/Night bonus - works perfectly with ifNight
 */
export const ICE_BOLT = {
  id: "ice_bolt",
  name: "Ice Bolt",
  color: "white",
  basicEffect: ifNight(iceRangedAttack(5), iceRangedAttack(3)),
  poweredEffect: iceRangedAttack(7),
} as const;

/**
 * Fireball (Red Spell)
 * Basic: Fire Ranged Attack 3
 * Powered: Fire Ranged Attack 5
 *
 * Pattern: Simple elemental attack - no conditional needed
 */
export const FIREBALL = {
  id: "fireball",
  name: "Fireball",
  color: "red",
  basicEffect: fireRangedAttack(3),
  poweredEffect: fireRangedAttack(5),
} as const;

/**
 * Burning Shield (Advanced Action)
 * Basic: Fire Block 4. If used in successful block, can use as Fire Attack 4 in Attack phase
 * Powered: Same but Fire Attack 6
 *
 * Pattern: Nested conditional (blocked + phase)
 * This tests that compound + ifBlockedSuccessfully + ifInPhase work together
 */
export const BURNING_SHIELD = {
  id: "burning_shield",
  name: "Burning Shield",
  basicEffect: compound([
    fireBlock(4),
    ifBlockedSuccessfully(
      ifInPhase([COMBAT_PHASE_ATTACK], fireAttack(4))
    ),
  ]),
  poweredEffect: compound([
    fireBlock(4),
    ifBlockedSuccessfully(
      ifInPhase([COMBAT_PHASE_ATTACK], fireAttack(6))
    ),
  ]),
} as const;

/**
 * Cold Toughness (Tovak's Basic Action)
 * Basic: Attack 2 or Ice Block 3
 * Powered: Attack 4 or Ice Block 5
 *
 * Pattern: Choice effect with elemental option
 */
export const COLD_TOUGHNESS = {
  id: "cold_toughness",
  name: "Cold Toughness",
  basicEffect: choice([attack(2), iceBlock(3)]),
  poweredEffect: choice([attack(4), iceBlock(5)]),
} as const;

/**
 * One With the Land (Braevalar's Basic Action)
 * Basic: Move 2. In Forest or Hills: Move 4 instead
 * Powered: Move 6
 *
 * Pattern: Terrain conditional with multiple terrain types
 */
export const ONE_WITH_THE_LAND = {
  id: "one_with_the_land",
  name: "One With the Land",
  basicEffect: ifOnTerrain([TERRAIN_FOREST, TERRAIN_HILLS], move(4), move(2)),
  poweredEffect: move(6),
} as const;

/**
 * Rage (Basic Action - shared by all heroes)
 * Basic: Attack 2 or Block 2
 * Powered: Attack 4
 *
 * Pattern: Basic choice, becomes attack-only when powered
 */
export const RAGE = {
  id: "rage",
  name: "Rage",
  basicEffect: choice([attack(2), block(2)]),
  poweredEffect: attack(4),
} as const;

/**
 * Swiftness (Basic Action - shared by all heroes)
 * Basic: Move 2
 * Powered: Ranged Attack 3
 *
 * Pattern: Completely different effect when powered (common in MK)
 */
export const SWIFTNESS = {
  id: "swiftness",
  name: "Swiftness",
  basicEffect: move(2),
  poweredEffect: rangedAttack(3),
} as const;

/**
 * Promise (Basic Action - shared by all heroes)
 * Basic: Influence 2
 * Powered: Influence 4
 *
 * Pattern: Simple scaling
 */
export const PROMISE = {
  id: "promise",
  name: "Promise",
  basicEffect: influence(2),
  poweredEffect: influence(4),
} as const;

/**
 * Tranquility (Basic Action - shared by all heroes)
 * Basic: Heal 1 or Draw 1 card
 * Powered: Heal 2 or Draw 2 cards
 *
 * Pattern: Choice between different effect types
 * NOTE: We don't have a draw cards helper yet, so this is approximated
 */
export const TRANQUILITY = {
  id: "tranquility",
  name: "Tranquility",
  // For now just healing since we don't have drawCards effect in helpers
  basicEffect: heal(1),
  poweredEffect: heal(2),
  // Real version would be: choice([heal(1), drawCards(1)])
} as const;

// ============================================================================
// CARDS THAT REVEAL LIMITATIONS IN THE CURRENT SYSTEM
// ============================================================================

/**
 * Flame Wave (Red Spell)
 * Basic (Flame Wall): Fire Attack 5 OR Fire Block 7
 * Powered (Flame Wave): Same choice, +2 per enemy you are facing
 *
 * Pattern: SCALING BY ENEMY COUNT + CHOICE ✅ NOW WORKING!
 * Uses the new ScalingEffect system with SCALING_PER_ENEMY factor.
 */
export const FLAME_WAVE = {
  id: "flame_wave",
  name: "Flame Wave",
  color: "red",
  cardType: "spell",
  // Basic (Flame Wall): Fire Attack 5 OR Fire Block 7
  basicEffect: choice([fireAttack(5), fireBlock(7)]),
  // Powered (Flame Wave): Same choice, +2 per enemy
  poweredEffect: choice([
    fireAttackPerEnemy(5, 2),
    fireBlockPerEnemy(7, 2),
  ]),
} as const;

/**
 * Intimidate (Advanced Action)
 * Basic: Target enemy with Resistance ≤ 5 doesn't attack this combat
 * Powered: All enemies don't attack
 *
 * Pattern: ENEMY RESISTANCE CHECK
 * PROBLEM: We need CONDITION_TARGET_ENEMY_RESISTANCE_LTE
 * Also need an effect that prevents enemy attacks (modifier on enemy)
 */
export const INTIMIDATE = {
  id: "intimidate",
  name: "Intimidate",
  // CAN'T PROPERLY EXPRESS - need resistance check and enemy modifier
  // Placeholder: no-op (this would need new condition and modifier types)
  basicEffect: null as unknown as CardEffect,
  poweredEffect: null as unknown as CardEffect,
  _limitation: "Cannot express enemy resistance check or 'enemy skips attack' effect",
} as const;

/**
 * Underground Travel (Advanced Action)
 * Basic: Spend 2 Move points; teleport up to 2 tiles away. Must end on safe space.
 * Powered: Heal 3 instead (completely different effect!)
 *
 * Pattern: SPENDING RESOURCES + TELEPORTATION
 * PROBLEM: We can't express "spend X to do Y" - only gains
 * Also teleportation is a special movement type we don't have
 */
export const UNDERGROUND_TRAVEL = {
  id: "underground_travel",
  name: "Underground Travel",
  // CAN'T EXPRESS - need "spend" effect and teleportation
  basicEffect: null as unknown as CardEffect,
  poweredEffect: heal(3), // This part works!
  _limitation: "Cannot express 'spend X move points' or teleportation",
} as const;

/**
 * Space Bending (White Spell)
 * Effect: This turn, you may move to spaces up to 2 tiles away (ignoring terrain)
 *
 * Pattern: MOVEMENT MODIFIER (PERSISTENT FOR TURN)
 * PARTIAL: We have ApplyModifierEffect, but would need specific modifier type
 */
export const SPACE_BENDING = {
  id: "space_bending",
  name: "Space Bending",
  // Would need: applyModifier({ type: 'can_teleport', range: 2, duration: 'turn' })
  basicEffect: null as unknown as CardEffect,
  poweredEffect: null as unknown as CardEffect,
  _limitation: "Need specific modifier type for teleportation ability",
} as const;

/**
 * Noble Manners (Norowas's Basic Action)
 * Basic: Influence 2. If Reputation ≥ 3, gain +1 Influence.
 * Powered: Influence 4, same bonus
 *
 * Pattern: REPUTATION CHECK
 * PROBLEM: Need CONDITION_REPUTATION_GTE
 */
export const NOBLE_MANNERS = {
  id: "noble_manners",
  name: "Noble Manners",
  // CAN'T EXPRESS - need reputation condition
  basicEffect: influence(2), // Base part works
  poweredEffect: influence(4),
  _limitation: "Cannot express reputation check for bonus",
} as const;

// ============================================================================
// SUMMARY OF FINDINGS
// ============================================================================

/**
 * WHAT WORKS WELL:
 * - Day/Night bonuses (ifNight, ifDay)
 * - Terrain bonuses (ifOnTerrain) - now supports multiple terrains
 * - Combat phase restrictions (ifInPhase)
 * - Blocked successfully triggers (ifBlockedSuccessfully)
 * - Choice effects (choice)
 * - Compound effects (compound)
 * - Nested conditionals (compound + multiple ifs)
 * - Elemental attacks and blocks
 * - Basic resource gains (move, attack, block, influence, heal)
 *
 * WHAT'S MISSING:
 * 1. Enemy-based conditions:
 *    - CONDITION_ENEMY_RESISTANCE_LTE (Intimidate)
 *    - CONDITION_ENEMY_COUNT (Flame Wave scaling)
 *
 * 2. Resource spending effects:
 *    - "Spend X Move to do Y" (Underground Travel)
 *    - "Discard a card to do Y" (various cards)
 *
 * 3. Movement modifiers:
 *    - Teleportation (Space Bending, Underground Travel)
 *    - Flying (Wings of Wind)
 *    - Terrain cost reduction (already in modifier system?)
 *
 * 4. Player state conditions:
 *    - CONDITION_REPUTATION_GTE (Noble Manners)
 *    - CONDITION_CRYSTAL_COUNT (Golden Grail)
 *
 * 5. Enemy state modifiers:
 *    - "Enemy doesn't attack this combat" (Intimidate)
 *    - "Enemy loses resistance" (Threaten powered)
 *
 * 6. Scaling effects: ✅ NOW IMPLEMENTED!
 *    - "+X per enemy" (Flame Wave) - SCALING_PER_ENEMY
 *    - "+X per wound in hand" - SCALING_PER_WOUND_IN_HAND
 *    - "+X per unit" - SCALING_PER_UNIT
 *
 * VERDICT:
 * The effect system (conditionals + scaling) handles ~75-80% of real card patterns.
 * The remaining gaps are:
 * - Enemy-centric conditions and modifiers
 * - Spend/cost effects (vs pure gains)
 * - Player state conditions beyond combat
 */

export const WORKING_CARDS = [
  ICE_BOLT,
  FIREBALL,
  BURNING_SHIELD,
  COLD_TOUGHNESS,
  ONE_WITH_THE_LAND,
  RAGE,
  SWIFTNESS,
  PROMISE,
  TRANQUILITY,
  FLAME_WAVE, // Now working with scaling effects!
];

export const LIMITED_CARDS = [
  INTIMIDATE,
  UNDERGROUND_TRAVEL,
  SPACE_BENDING,
  NOBLE_MANNERS,
];
