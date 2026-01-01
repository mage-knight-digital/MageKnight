/**
 * Enemy token types for Mage Knight
 */

// Branded ID type for enemy tokens
export type EnemyTokenId = string & { readonly __brand: "EnemyTokenId" };

// Enemy colors (token back colors)
export type EnemyColor = "green" | "red" | "brown" | "violet" | "gray" | "white";

// Attack types
export type AttackType = "physical" | "fire" | "ice" | "cold_fire";

// Enemy abilities as discriminated union
export type EnemyAbility =
  | { readonly type: "fortified" }
  | { readonly type: "swift" }
  | { readonly type: "brutal" }
  | { readonly type: "poison" }
  | { readonly type: "paralyze" }
  | { readonly type: "summon"; readonly pool: EnemyColor }
  | { readonly type: "resistance"; readonly element: "physical" | "fire" | "ice" };

// An enemy token definition
export interface EnemyToken {
  readonly id: EnemyTokenId;
  readonly name: string;
  readonly color: EnemyColor;
  readonly armor: number;
  readonly attack: number;
  readonly attackType: AttackType;
  readonly fame: number;
  readonly abilities: readonly EnemyAbility[];
}

// Token piles in game state
export interface EnemyTokenPiles {
  readonly drawPiles: Record<EnemyColor, readonly EnemyTokenId[]>;
  readonly discardPiles: Record<EnemyColor, readonly EnemyTokenId[]>;
}

// Helper to create empty enemy token piles
export function createEmptyEnemyTokenPiles(): EnemyTokenPiles {
  return {
    drawPiles: {
      green: [],
      red: [],
      brown: [],
      violet: [],
      gray: [],
      white: [],
    },
    discardPiles: {
      green: [],
      red: [],
      brown: [],
      violet: [],
      gray: [],
      white: [],
    },
  };
}
