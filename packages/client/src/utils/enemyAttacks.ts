import type { Element, EnemyAttack, EnemyDefinition } from "@mage-knight/shared";

export type EnemyAttackSource = Pick<
  EnemyDefinition,
  "attack" | "attackElement" | "attacks"
>;

export interface EnemyAttackGroup {
  readonly element: Element;
  readonly damage: number;
  readonly count: number;
}

export function getEnemyAttacks(source: EnemyAttackSource): readonly EnemyAttack[] {
  if (source.attacks && source.attacks.length > 0) {
    return source.attacks;
  }

  return [
    {
      damage: source.attack,
      element: source.attackElement,
    },
  ];
}

export function groupEnemyAttacks(
  attacks: readonly EnemyAttack[]
): EnemyAttackGroup[] {
  const groups: EnemyAttackGroup[] = [];

  for (const attack of attacks) {
    const existingIndex = groups.findIndex(
      (group) =>
        group.element === attack.element && group.damage === attack.damage
    );
    if (existingIndex >= 0) {
      const existing = groups[existingIndex];
      if (existing) {
        groups[existingIndex] = {
          ...existing,
          count: existing.count + 1,
        };
      }
      continue;
    }
    groups.push({
      element: attack.element,
      damage: attack.damage,
      count: 1,
    });
  }

  return groups;
}

export function getEnemyAttackElements(source: EnemyAttackSource): Element[] {
  const elements = new Set<Element>();
  for (const attack of getEnemyAttacks(source)) {
    elements.add(attack.element);
  }
  return [...elements];
}
