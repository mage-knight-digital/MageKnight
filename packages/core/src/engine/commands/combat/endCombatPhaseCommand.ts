/**
 * End combat phase command
 *
 * When combat ends with victory at a site:
 * - Triggers automatic conquest
 * - Clears enemies from hex
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  COMBAT_PHASE_CHANGED,
  COMBAT_ENDED,
  hexKey,
  createPlayerWithdrewEvent,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  type CombatPhase,
} from "../../../types/combat.js";
import type { Player } from "../../../types/player.js";
import type { HexState } from "../../../types/map.js";
import { createConquerSiteCommand } from "../conquerSiteCommand.js";

export const END_COMBAT_PHASE_COMMAND = "END_COMBAT_PHASE" as const;

function getNextPhase(current: CombatPhase): CombatPhase | null {
  switch (current) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return COMBAT_PHASE_BLOCK;
    case COMBAT_PHASE_BLOCK:
      return COMBAT_PHASE_ASSIGN_DAMAGE;
    case COMBAT_PHASE_ASSIGN_DAMAGE:
      return COMBAT_PHASE_ATTACK;
    case COMBAT_PHASE_ATTACK:
      return null; // Combat ends
  }
}

export interface EndCombatPhaseCommandParams {
  readonly playerId: string;
}

export function createEndCombatPhaseCommand(
  params: EndCombatPhaseCommandParams
): Command {
  return {
    type: END_COMBAT_PHASE_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const currentPhase = state.combat.phase;
      const nextPhase = getNextPhase(currentPhase);

      // Combat ends after Attack phase
      if (nextPhase === null) {
        const enemiesDefeated = state.combat.enemies.filter(
          (e) => e.isDefeated
        ).length;
        const enemiesSurvived = state.combat.enemies.filter(
          (e) => !e.isDefeated
        ).length;
        const victory = enemiesSurvived === 0;

        const events: GameEvent[] = [
          {
            type: COMBAT_ENDED,
            victory,
            totalFameGained: state.combat.fameGained,
            enemiesDefeated,
            enemiesSurvived,
          },
        ];

        let newState: GameState = { ...state, combat: null };

        // Find the player to get their position
        const player = state.players.find((p) => p.id === params.playerId);
        if (player?.position) {
          const key = hexKey(player.position);
          const hex = state.map.hexes[key];

          if (victory && hex) {
            // Clear enemies from hex on victory
            const updatedHex: HexState = {
              ...hex,
              enemies: [],
            };
            const updatedHexes = {
              ...newState.map.hexes,
              [key]: updatedHex,
            };
            newState = {
              ...newState,
              map: { ...newState.map, hexes: updatedHexes },
            };

            // Trigger conquest if at an unconquered site
            if (hex.site && !hex.site.isConquered) {
              const conquestCommand = createConquerSiteCommand({
                playerId: params.playerId,
                hexCoord: player.position,
                enemiesDefeated,
              });
              const conquestResult = conquestCommand.execute(newState);
              newState = conquestResult.state;
              events.push(...conquestResult.events);
            }
          }

          // Failed assault at fortified site — must withdraw
          // TODO: Per rulebook, if assaultOrigin is not a "safe space", Forced Withdrawal
          // rules apply (backtrack until safe, adding a Wound per space). This is an edge
          // case if player used special movement to reach an unsafe space before assaulting.
          if (
            !victory &&
            state.combat.isAtFortifiedSite &&
            state.combat.assaultOrigin
          ) {
            const playerIndex = newState.players.findIndex(
              (p) => p.id === params.playerId
            );
            const currentPlayer = newState.players[playerIndex];

            if (playerIndex !== -1 && currentPlayer?.position) {
              const updatedPlayer: Player = {
                ...currentPlayer,
                position: state.combat.assaultOrigin,
                hasCombattedThisTurn: true,
                hasTakenActionThisTurn: true,
              };
              const updatedPlayers: Player[] = [...newState.players];
              updatedPlayers[playerIndex] = updatedPlayer;
              newState = { ...newState, players: updatedPlayers };

              events.push(
                createPlayerWithdrewEvent(
                  params.playerId,
                  currentPlayer.position,
                  state.combat.assaultOrigin
                )
              );
            }
          } else {
            // Mark player as having combatted this turn (when not withdrawing)
            const playerIndex = newState.players.findIndex(
              (p) => p.id === params.playerId
            );
            const currentPlayer = newState.players[playerIndex];
            if (playerIndex !== -1 && currentPlayer) {
              const updatedPlayer: Player = {
                ...currentPlayer,
                hasCombattedThisTurn: true,
                hasTakenActionThisTurn: true,
              };
              const updatedPlayers: Player[] = [...newState.players];
              updatedPlayers[playerIndex] = updatedPlayer;
              newState = { ...newState, players: updatedPlayers };
            }
          }
        }

        return {
          state: newState,
          events,
        };
      }

      // Advance to next phase
      let updatedCombat = {
        ...state.combat,
        phase: nextPhase,
        attacksThisPhase: 0,
      };

      // When transitioning from BLOCK to ASSIGN_DAMAGE, calculate if all damage was blocked
      // This is used by conditional effects like Burning Shield
      if (
        currentPhase === COMBAT_PHASE_BLOCK &&
        nextPhase === COMBAT_PHASE_ASSIGN_DAMAGE
      ) {
        // All damage is blocked if every undefeated enemy is blocked
        const undefeatedEnemies = state.combat.enemies.filter(
          (e) => !e.isDefeated
        );
        const allBlocked =
          undefeatedEnemies.length === 0 ||
          undefeatedEnemies.every((e) => e.isBlocked);

        updatedCombat = {
          ...updatedCombat,
          allDamageBlockedThisPhase: allBlocked,
        };
      }

      return {
        state: { ...state, combat: updatedCombat },
        events: [
          {
            type: COMBAT_PHASE_CHANGED,
            previousPhase: currentPhase,
            newPhase: nextPhase,
          },
        ],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo END_COMBAT_PHASE");
    },
  };
}
