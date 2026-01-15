/**
 * Core types for Mage Knight game
 *
 * Note: CardId, SkillId, ManaColor, BasicManaColor are defined in @mage-knight/shared
 * and should be imported from there directly.
 */

// Player types
export type {
  ManaToken,
  SkillCooldowns,
  Crystals,
  Player,
  ElementalAttackValues,
  AccumulatedAttack,
  CombatAccumulator,
} from "./player.js";
export {
  createEmptyElementalValues,
  createEmptyCombatAccumulator,
  getTotalElementalValue,
  getTotalAttack,
  getTotalBlock,
} from "./player.js";

// Units
export type { PlayerUnit } from "./unit.js";
export { createPlayerUnit, readyAllUnits } from "./unit.js";

// Hero types
export type { HeroDefinition } from "./hero.js";
export { Hero, HEROES } from "./hero.js";

// Enemy types (before map, since map imports EnemyTokenId)
export type {
  EnemyTokenId,
  EnemyColor,
  AttackType,
  EnemyAbility,
  EnemyToken,
  EnemyTokenPiles,
} from "./enemy.js";
export { createEmptyEnemyTokenPiles } from "./enemy.js";

// Map types
export type {
  CityColor,
  MineColor,
  Site,
  HexEnemy,
  HexState,
  TilePlacement,
  TileSlot,
  TileDeck,
  MapState,
} from "./map.js";
export { TileId, SiteType, RampagingEnemyType, createEmptyMapState } from "./map.js";

// Mana source types
export type {
  SpecialManaColor,
  SourceDieId,
  SourceDie,
  ManaSource,
  CrystalInventory,
} from "./mana.js";
export {
  sourceDieId,
  createEmptyManaSource,
  createEmptyCrystalInventory,
} from "./mana.js";

// Offers types
export type { CardOffer, GameOffers } from "./offers.js";
export { createEmptyOffers } from "./offers.js";

// Card types
export type {
  DeedCardType,
  Element,
  GainMoveEffect,
  GainInfluenceEffect,
  GainAttackEffect,
  GainBlockEffect,
  GainHealingEffect,
  GainManaEffect,
  DrawCardsEffect,
  ApplyModifierEffect,
  CompoundEffect,
  ChoiceEffect,
  ConditionalEffect,
  ScalableBaseEffect,
  ScalingEffect,
  CombatEnemyTargetTemplate,
  SelectCombatEnemyEffect,
  ResolveCombatEnemyTargetEffect,
  CardEffect,
  DeedCard,
} from "./cards.js";
export {
  DEED_CARD_TYPE_BASIC_ACTION,
  DEED_CARD_TYPE_ADVANCED_ACTION,
  DEED_CARD_TYPE_SPELL,
  DEED_CARD_TYPE_ARTIFACT,
  DEED_CARD_TYPE_WOUND,
} from "./cards.js";

// Card effect type constants
export type { CombatType, CardColor } from "./effectTypes.js";
export {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  CARD_COLOR_RED,
  CARD_COLOR_BLUE,
  CARD_COLOR_GREEN,
  CARD_COLOR_WHITE,
  CARD_COLOR_WOUND,
  MANA_ANY,
} from "./effectTypes.js";

// Scaling types
export type {
  ScalingFactor,
  ScalingPerEnemyFactor,
  ScalingPerWoundInHandFactor,
  ScalingPerUnitFactor,
} from "./scaling.js";
export {
  SCALING_PER_ENEMY,
  SCALING_PER_WOUND_IN_HAND,
  SCALING_PER_UNIT,
} from "./scaling.js";

// Card ID constants (re-exported from @mage-knight/shared)
export type { BasicActionCardId, SharedBasicActionCardId, HeroSpecificCardId } from "@mage-knight/shared";
export {
  // Shared basic actions
  CARD_RAGE,
  CARD_DETERMINATION,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_TRANQUILITY,
  CARD_PROMISE,
  CARD_THREATEN,
  CARD_CRYSTALLIZE,
  CARD_MANA_DRAW,
  CARD_CONCENTRATION,
  CARD_IMPROVISATION,
  // Hero-specific cards
  CARD_ARYTHEA_BATTLE_VERSATILITY,
  CARD_ARYTHEA_MANA_PULL,
  CARD_GOLDYX_CRYSTAL_JOY,
  CARD_GOLDYX_WILL_FOCUS,
  CARD_NOROWAS_NOBLE_MANNERS,
  CARD_NOROWAS_REJUVENATE,
  CARD_TOVAK_COLD_TOUGHNESS,
  CARD_TOVAK_INSTINCT,
  CARD_WOLFHAWK_SWIFT_REFLEXES,
  CARD_WOLFHAWK_TIRELESSNESS,
  CARD_KRANG_SAVAGE_HARVESTING,
  CARD_KRANG_RUTHLESS_COERCION,
  CARD_BRAEVALAR_DRUIDIC_PATHS,
  CARD_BRAEVALAR_ONE_WITH_THE_LAND,
  // Wound
  CARD_WOUND,
} from "@mage-knight/shared";

// Deck types
export type { GameDecks } from "./decks.js";
export { createEmptyDecks } from "./decks.js";

// City types
export type { CityShield, CityState } from "./city.js";
export { determineCityLeader, createCityState } from "./city.js";

// Combat types
export type {
  CombatPhase,
  CombatAttackType,
  CombatEnemy,
  CombatState,
  CombatStateOptions,
} from "./combat.js";
export {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  createCombatState,
} from "./combat.js";

// Modifier types
export type {
  ModifierDuration,
  ModifierScope,
  ModifierSource,
  TerrainCostModifier,
  SidewaysValueModifier,
  CombatValueModifier,
  EnemyStatModifier,
  RuleOverrideModifier,
  AbilityNullifierModifier,
  EnemySkipAttackModifier,
  ModifierEffect,
  ActiveModifier,
} from "./modifiers.js";

// Condition types
export type {
  EffectCondition,
  InPhaseCondition,
  TimeOfDayCondition,
  OnTerrainCondition,
  InCombatCondition,
  BlockedSuccessfullyCondition,
  EnemyDefeatedThisCombatCondition,
  ManaUsedThisTurnCondition,
  HasWoundsInHandCondition,
} from "./conditions.js";
export {
  CONDITION_IN_PHASE,
  CONDITION_TIME_OF_DAY,
  CONDITION_ON_TERRAIN,
  CONDITION_IN_COMBAT,
  CONDITION_BLOCKED_SUCCESSFULLY,
  CONDITION_ENEMY_DEFEATED_THIS_COMBAT,
  CONDITION_MANA_USED_THIS_TURN,
  CONDITION_HAS_WOUNDS_IN_HAND,
} from "./conditions.js";
