# Enemy Abilities Reference

Source: Mage Knight Ultimate Edition Rulebook

This document describes all enemy abilities that appear on enemy tokens.

## Offensive Abilities

| Ability | Effect |
|---------|--------|
| **Swift** | To block this enemy, you need twice as much Block as its Attack value. |
| **Brutal** | If unblocked, it deals twice as much damage as its Attack value. |
| **Poison** | If a Unit gets Wounded because of an attack from an enemy with Poison, it is given two Wound cards instead of one. For each Wound a Hero takes into their hand from a Poisonous attack, they also put one Wound into their discard pile. |
| **Paralyze** | If a Unit gets Wounded because of an attack from an enemy with Paralyze, it is immediately destroyed (removed from the game). If a Hero takes one or more Wounds into their hand from a Paralyzing attack, they must immediately discard any non-Wound cards from their hand. |
| **Summon** | At the start of the Block phase, draw a random Brown token for this enemy. The summoned enemy replaces the summoner in the Block and Assign Damage phases, then it is discarded. The summoner returns in the Attack phase. |
| **Assassination** | Damage from this attack cannot be assigned to Units; if unblocked, it has to be all assigned to the hero. |
| **Cumbersome** | In the Block phase, you may spend Move points; for each Move point spent, the attack is reduced by 1 for the rest of the turn. An attack reduced to 0 is considered successfully blocked. |
| **Vampiric** | An enemy with the Vampiric ability has its Armor value increased by 1, for the rest of the combat, for each unit its attacks wound and for each wound its attacks cause to be added to a player's hand. |

## Defensive Abilities

| Ability | Effect |
|---------|--------|
| **Fortified** | Only Siege Attacks can be used against this enemy in the Ranged and Siege Attacks phase. If also defending a fortified site, no attacks at all in that phase. |
| **Physical Resistance** | All physical Attacks (including cards played sideways) are inefficient (halved, rounded down). |
| **Fire Resistance** | All Fire Attacks are inefficient (halved). The enemy ignores any non-Attack effects of red cards or Unit abilities powered by red mana. |
| **Ice Resistance** | All Ice Attacks are inefficient (halved). The enemy ignores any non-Attack effects of blue cards or Unit abilities powered by blue mana. |
| **Elusive** | An elusive enemy has two Armor values. The lower value is used only in the Attack phase, and only if all of the enemy's attacks are successfully Blocked. |
| **Unfortified** | All site fortifications are ignored for this enemy. Summoned enemies have this ability. |
| **Arcane Immunity** | The enemy is not affected by any non-Attack/Block effects. Effects that directly affect enemy attacks still apply. |

## Attack Element Types

| Element | Blocking |
|---------|----------|
| **Physical Attack** | Any Block type is efficient. |
| **Fire Attack** | Only Ice and Cold Fire Blocks are efficient (others are halved). |
| **Ice Attack** | Only Fire and Cold Fire Blocks are efficient (others are halved). |
| **Cold Fire Attack** | Only Cold Fire Blocks are efficient (all others are halved). |

## Special Enemy Types

### Rampaging Enemies

Rampaging enemies (Orc Marauders and Draconum) roam the map and have special rules:

- **Movement blocked**: You cannot enter a space occupied by a rampaging enemy until defeated.
- **Provocation**: Moving from one space adjacent to a rampaging enemy to another space adjacent to the same enemy provokes an attack - your movement ends immediately and combat begins.
- **Challenge**: If standing adjacent to a rampaging enemy, you can challenge it to combat.
- **Reward**: Defeating rampaging Orcs grants +1 Reputation. Defeating rampaging Draconum grants +2 Reputation.

### Summoned Enemies

When an enemy with Summon attacks:

1. At the start of the Block phase, draw a random Brown enemy token
2. The summoned enemy replaces the summoner for Block and Assign Damage phases
3. Block the summoned enemy's attack (using its abilities, not the summoner's)
4. Assign damage from the summoned enemy (using its abilities)
5. If blocked successfully, discard the summoned enemy (no Fame gained)
6. The summoner returns in the Attack phase and can be attacked normally

## Multiple Attacks

Some enemies have multiple attacks (shown as multiple attack values on their token):

- Each attack must be handled separately (blocked or damage assigned)
- Effects that prevent an enemy from attacking prevent all their attacks
- An enemy is considered "successfully blocked" only if ALL its attacks are blocked

---

## Currently Implemented Abilities

The following abilities are currently in the game code (`shared/src/enemies.ts`):

- Swift
- Brutal
- Poison
- Paralyze
- Summon
- Cumbersome
- Fortified
- Unfortified

### Not Yet Implemented

- Assassination
- Vampiric
- Elusive
- Arcane Immunity
- Defend (from Lost Legion)
