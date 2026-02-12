"""Auto-generated valid action enumeration from network protocol schemas. Do not edit by hand."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

ACTION_ACTIVATE_TACTIC = "ACTIVATE_TACTIC"
ACTION_ACTIVATE_UNIT = "ACTIVATE_UNIT"
ACTION_ALTAR_TRIBUTE = "ALTAR_TRIBUTE"
ACTION_ANNOUNCE_END_OF_ROUND = "ANNOUNCE_END_OF_ROUND"
ACTION_ASSIGN_ATTACK = "ASSIGN_ATTACK"
ACTION_ASSIGN_BANNER = "ASSIGN_BANNER"
ACTION_ASSIGN_BLOCK = "ASSIGN_BLOCK"
ACTION_ASSIGN_DAMAGE = "ASSIGN_DAMAGE"
ACTION_BURN_MONASTERY = "BURN_MONASTERY"
ACTION_BUY_HEALING = "BUY_HEALING"
ACTION_BUY_SPELL = "BUY_SPELL"
ACTION_CANCEL_COOPERATIVE_PROPOSAL = "CANCEL_COOPERATIVE_PROPOSAL"
ACTION_CHALLENGE_RAMPAGING = "CHALLENGE_RAMPAGING"
ACTION_CHOOSE_LEVEL_UP_REWARDS = "CHOOSE_LEVEL_UP_REWARDS"
ACTION_COMPLETE_REST = "COMPLETE_REST"
ACTION_CONVERT_INFLUENCE_TO_BLOCK = "CONVERT_INFLUENCE_TO_BLOCK"
ACTION_CONVERT_MOVE_TO_ATTACK = "CONVERT_MOVE_TO_ATTACK"
ACTION_DEBUG_ADD_FAME = "DEBUG_ADD_FAME"
ACTION_DEBUG_TRIGGER_LEVEL_UP = "DEBUG_TRIGGER_LEVEL_UP"
ACTION_DECLARE_ATTACK = "DECLARE_ATTACK"
ACTION_DECLARE_BLOCK = "DECLARE_BLOCK"
ACTION_DECLARE_REST = "DECLARE_REST"
ACTION_DISBAND_UNIT = "DISBAND_UNIT"
ACTION_END_COMBAT_PHASE = "END_COMBAT_PHASE"
ACTION_END_TURN = "END_TURN"
ACTION_ENTER_COMBAT = "ENTER_COMBAT"
ACTION_ENTER_SITE = "ENTER_SITE"
ACTION_EXPLORE = "EXPLORE"
ACTION_INTERACT = "INTERACT"
ACTION_LEARN_ADVANCED_ACTION = "LEARN_ADVANCED_ACTION"
ACTION_MOVE = "MOVE"
ACTION_PAY_HEROES_ASSAULT_INFLUENCE = "PAY_HEROES_ASSAULT_INFLUENCE"
ACTION_PAY_THUGS_DAMAGE_INFLUENCE = "PAY_THUGS_DAMAGE_INFLUENCE"
ACTION_PLAY_CARD = "PLAY_CARD"
ACTION_PLAY_CARD_SIDEWAYS = "PLAY_CARD_SIDEWAYS"
ACTION_PLUNDER_VILLAGE = "PLUNDER_VILLAGE"
ACTION_PROPOSE_COOPERATIVE_ASSAULT = "PROPOSE_COOPERATIVE_ASSAULT"
ACTION_RECRUIT_UNIT = "RECRUIT_UNIT"
ACTION_REROLL_SOURCE_DICE = "REROLL_SOURCE_DICE"
ACTION_RESOLVE_ARTIFACT_CRYSTAL_COLOR = "RESOLVE_ARTIFACT_CRYSTAL_COLOR"
ACTION_RESOLVE_BANNER_PROTECTION = "RESOLVE_BANNER_PROTECTION"
ACTION_RESOLVE_BOOK_OF_WISDOM = "RESOLVE_BOOK_OF_WISDOM"
ACTION_RESOLVE_CHOICE = "RESOLVE_CHOICE"
ACTION_RESOLVE_CRYSTAL_JOY_RECLAIM = "RESOLVE_CRYSTAL_JOY_RECLAIM"
ACTION_RESOLVE_DECOMPOSE = "RESOLVE_DECOMPOSE"
ACTION_RESOLVE_DEEP_MINE = "RESOLVE_DEEP_MINE"
ACTION_RESOLVE_DISCARD = "RESOLVE_DISCARD"
ACTION_RESOLVE_DISCARD_FOR_ATTACK = "RESOLVE_DISCARD_FOR_ATTACK"
ACTION_RESOLVE_DISCARD_FOR_BONUS = "RESOLVE_DISCARD_FOR_BONUS"
ACTION_RESOLVE_DISCARD_FOR_CRYSTAL = "RESOLVE_DISCARD_FOR_CRYSTAL"
ACTION_RESOLVE_GLADE_WOUND = "RESOLVE_GLADE_WOUND"
ACTION_RESOLVE_HEX_COST_REDUCTION = "RESOLVE_HEX_COST_REDUCTION"
ACTION_RESOLVE_MAXIMAL_EFFECT = "RESOLVE_MAXIMAL_EFFECT"
ACTION_RESOLVE_MEDITATION = "RESOLVE_MEDITATION"
ACTION_RESOLVE_SOURCE_OPENING_REROLL = "RESOLVE_SOURCE_OPENING_REROLL"
ACTION_RESOLVE_STEADY_TEMPO = "RESOLVE_STEADY_TEMPO"
ACTION_RESOLVE_TACTIC_DECISION = "RESOLVE_TACTIC_DECISION"
ACTION_RESOLVE_TERRAIN_COST_REDUCTION = "RESOLVE_TERRAIN_COST_REDUCTION"
ACTION_RESOLVE_TRAINING = "RESOLVE_TRAINING"
ACTION_RESOLVE_UNIT_MAINTENANCE = "RESOLVE_UNIT_MAINTENANCE"
ACTION_RESPOND_TO_COOPERATIVE_PROPOSAL = "RESPOND_TO_COOPERATIVE_PROPOSAL"
ACTION_REST = "REST"
ACTION_RETURN_INTERACTIVE_SKILL = "RETURN_INTERACTIVE_SKILL"
ACTION_SELECT_REWARD = "SELECT_REWARD"
ACTION_SELECT_TACTIC = "SELECT_TACTIC"
ACTION_SPEND_MOVE_ON_CUMBERSOME = "SPEND_MOVE_ON_CUMBERSOME"
ACTION_UNASSIGN_ATTACK = "UNASSIGN_ATTACK"
ACTION_UNASSIGN_BLOCK = "UNASSIGN_BLOCK"
ACTION_UNDO = "UNDO"
ACTION_USE_BANNER_FEAR = "USE_BANNER_FEAR"
ACTION_USE_SKILL = "USE_SKILL"
MODE_CANNOT_ACT = "cannot_act"
MODE_COMBAT = "combat"
MODE_NORMAL_TURN = "normal_turn"
MODE_PENDING_ARTIFACT_CRYSTAL_COLOR = "pending_artifact_crystal_color"
MODE_PENDING_BANNER_PROTECTION = "pending_banner_protection"
MODE_PENDING_BOOK_OF_WISDOM = "pending_book_of_wisdom"
MODE_PENDING_CHOICE = "pending_choice"
MODE_PENDING_CRYSTAL_JOY_RECLAIM = "pending_crystal_joy_reclaim"
MODE_PENDING_DECOMPOSE = "pending_decompose"
MODE_PENDING_DEEP_MINE = "pending_deep_mine"
MODE_PENDING_DISCARD_COST = "pending_discard_cost"
MODE_PENDING_DISCARD_FOR_ATTACK = "pending_discard_for_attack"
MODE_PENDING_DISCARD_FOR_BONUS = "pending_discard_for_bonus"
MODE_PENDING_DISCARD_FOR_CRYSTAL = "pending_discard_for_crystal"
MODE_PENDING_GLADE_WOUND = "pending_glade_wound"
MODE_PENDING_HEX_COST_REDUCTION = "pending_hex_cost_reduction"
MODE_PENDING_LEVEL_UP = "pending_level_up"
MODE_PENDING_MAXIMAL_EFFECT = "pending_maximal_effect"
MODE_PENDING_MEDITATION = "pending_meditation"
MODE_PENDING_SOURCE_OPENING_REROLL = "pending_source_opening_reroll"
MODE_PENDING_STEADY_TEMPO = "pending_steady_tempo"
MODE_PENDING_TACTIC_DECISION = "pending_tactic_decision"
MODE_PENDING_TERRAIN_COST_REDUCTION = "pending_terrain_cost_reduction"
MODE_PENDING_TRAINING = "pending_training"
MODE_PENDING_UNIT_MAINTENANCE = "pending_unit_maintenance"
MODE_TACTICS_SELECTION = "tactics_selection"

KNOWN_VALID_ACTION_MODES: tuple[str, ...] = ("cannot_act", "combat", "normal_turn", "pending_artifact_crystal_color", "pending_banner_protection", "pending_book_of_wisdom", "pending_choice", "pending_crystal_joy_reclaim", "pending_decompose", "pending_deep_mine", "pending_discard_cost", "pending_discard_for_attack", "pending_discard_for_bonus", "pending_discard_for_crystal", "pending_glade_wound", "pending_hex_cost_reduction", "pending_level_up", "pending_maximal_effect", "pending_meditation", "pending_source_opening_reroll", "pending_steady_tempo", "pending_tactic_decision", "pending_terrain_cost_reduction", "pending_training", "pending_unit_maintenance", "tactics_selection",)
KNOWN_TACTIC_DECISION_TYPES: tuple[str, ...] = ("mana_steal", "midnight_meditation", "preparation", "rethink", "sparing_power",)

@dataclass(frozen=True)
class CandidateAction:
    action: dict[str, Any]
    source: str

def enumerate_valid_actions_from_state(state: dict[str, Any], player_id: str) -> list[CandidateAction]:
    """Auto-generated from network protocol schemas to enumerate valid player actions."""
    valid_actions = _as_dict(state.get("validActions"))
    if valid_actions is None:
        return []

    mode = _as_str(valid_actions.get("mode"))
    if mode is None:
        return []

    actions: list[CandidateAction] = []

    if mode == MODE_CANNOT_ACT:
        return actions

    if mode == MODE_TACTICS_SELECTION:
        tactics = _as_dict(valid_actions.get("tactics"))
        available = _as_list(tactics.get("availableTactics") if tactics else None)
        for tactic_id in available:
            if isinstance(tactic_id, str):
                actions.append(CandidateAction({"type": ACTION_SELECT_TACTIC, "tacticId": tactic_id}, "tactics.available"))
        return actions

    if mode == MODE_PENDING_TACTIC_DECISION:
        decision = _as_dict(valid_actions.get("tacticDecision"))
        if decision is None:
            return actions
        actions.extend(_actions_for_tactic_decision(decision, "pending_tactic_decision"))
        return actions

    if mode == MODE_PENDING_CHOICE:
        player = _find_player(state, player_id)
        pending_choice = _as_dict(player.get("pendingChoice") if player else None)
        options = _as_list(pending_choice.get("options") if pending_choice else None)
        for idx, _ in enumerate(options):
            actions.append(CandidateAction({"type": ACTION_RESOLVE_CHOICE, "choiceIndex": idx}, "pending_choice.index"))
        return actions

    _append_common_blocking_actions(valid_actions, actions)

    pending_dispatch = {
        "pending_artifact_crystal_color": _actions_pending_artifact_crystal_color,
        "pending_banner_protection": _actions_pending_banner_protection,
        "pending_book_of_wisdom": _actions_pending_book_of_wisdom,
        "pending_crystal_joy_reclaim": _actions_pending_crystal_joy,
        "pending_decompose": _actions_pending_decompose,
        "pending_deep_mine": _actions_pending_deep_mine,
        "pending_discard_cost": _actions_pending_discard_cost,
        "pending_discard_for_attack": _actions_pending_discard_for_attack,
        "pending_discard_for_bonus": _actions_pending_discard_for_bonus,
        "pending_discard_for_crystal": _actions_pending_discard_for_crystal,
        "pending_glade_wound": _actions_pending_glade,
        "pending_hex_cost_reduction": _actions_pending_hex_cost_reduction,
        "pending_level_up": _actions_pending_level_up,
        "pending_maximal_effect": _actions_pending_maximal_effect,
        "pending_meditation": _actions_pending_meditation,
        "pending_source_opening_reroll": _actions_pending_source_opening_reroll,
        "pending_steady_tempo": _actions_pending_steady_tempo,
        "pending_terrain_cost_reduction": _actions_pending_terrain_cost_reduction,
        "pending_training": _actions_pending_training,
        "pending_unit_maintenance": _actions_pending_unit_maintenance,
    }

    resolver = pending_dispatch.get(mode)
    if resolver is not None:
        actions.extend(resolver(valid_actions))
        return actions

    if mode == MODE_COMBAT:
        actions.extend(_actions_combat(valid_actions))
        return actions

    if mode == MODE_NORMAL_TURN:
        actions.extend(_actions_normal_turn(state, valid_actions, player_id))
        return actions

    return actions

def _actions_pending_glade(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    glade = _as_dict(valid_actions.get("gladeWound"))
    if glade is None:
        return []

    actions: list[CandidateAction] = [CandidateAction({"type": ACTION_RESOLVE_GLADE_WOUND, "choice": "skip"}, "glade.skip")]
    if bool(glade.get("hasWoundsInHand")):
        actions.append(CandidateAction({"type": ACTION_RESOLVE_GLADE_WOUND, "choice": "hand"}, "glade.hand"))
    if bool(glade.get("hasWoundsInDiscard")):
        actions.append(CandidateAction({"type": ACTION_RESOLVE_GLADE_WOUND, "choice": "discard"}, "glade.discard"))
    return actions


def _actions_pending_deep_mine(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    deep_mine = _as_dict(valid_actions.get("deepMine"))
    colors = _as_list(deep_mine.get("availableColors") if deep_mine else None)
    return [
        CandidateAction({"type": ACTION_RESOLVE_DEEP_MINE, "color": color}, "deep_mine.color")
        for color in colors
        if isinstance(color, str)
    ]


def _actions_pending_discard_cost(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("discardCost"))
    if options is None:
        return []
    available = [card for card in _as_list(options.get("availableCardIds")) if isinstance(card, str)]
    count = int(options.get("count", 0))
    actions: list[CandidateAction] = []
    if count > 0 and len(available) >= count:
        actions.append(
            CandidateAction({"type": ACTION_RESOLVE_DISCARD, "cardIds": available[:count]}, "discard_cost.required")
        )
    if bool(options.get("optional")):
        actions.append(CandidateAction({"type": ACTION_RESOLVE_DISCARD, "cardIds": []}, "discard_cost.optional_skip"))
    return actions


def _actions_pending_discard_for_attack(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("discardForAttack"))
    if options is None:
        return []
    available = [card for card in _as_list(options.get("availableCardIds")) if isinstance(card, str)]
    actions = [CandidateAction({"type": ACTION_RESOLVE_DISCARD_FOR_ATTACK, "cardIds": []}, "discard_for_attack.none")]
    for card in available:
        actions.append(CandidateAction({"type": ACTION_RESOLVE_DISCARD_FOR_ATTACK, "cardIds": [card]}, "discard_for_attack.one"))
    return actions


def _actions_pending_discard_for_bonus(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("discardForBonus"))
    if options is None:
        return []
    count = int(options.get("choiceCount", 0))
    return [
        CandidateAction(
            {"type": ACTION_RESOLVE_DISCARD_FOR_BONUS, "cardIds": [], "choiceIndex": idx},
            "discard_for_bonus.choice",
        )
        for idx in range(count)
    ]


def _actions_pending_discard_for_crystal(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("discardForCrystal"))
    if options is None:
        return []
    available = [card for card in _as_list(options.get("availableCardIds")) if isinstance(card, str)]
    actions: list[CandidateAction] = []
    for card in available:
        actions.append(
            CandidateAction(
                {"type": ACTION_RESOLVE_DISCARD_FOR_CRYSTAL, "cardId": card},
                "discard_for_crystal.card",
            )
        )
    if bool(options.get("optional")):
        actions.append(CandidateAction({"type": ACTION_RESOLVE_DISCARD_FOR_CRYSTAL, "cardId": None}, "discard_for_crystal.skip"))
    return actions


def _actions_pending_artifact_crystal_color(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("artifactCrystalColor"))
    colors = _as_list(options.get("availableColors") if options else None)
    return [
        CandidateAction({"type": ACTION_RESOLVE_ARTIFACT_CRYSTAL_COLOR, "color": color}, "artifact_crystal_color")
        for color in colors
        if isinstance(color, str)
    ]


def _actions_pending_decompose(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("decompose"))
    cards = _as_list(options.get("availableCardIds") if options else None)
    return [
        CandidateAction({"type": ACTION_RESOLVE_DECOMPOSE, "cardId": card_id}, "decompose.card")
        for card_id in cards
        if isinstance(card_id, str)
    ]


def _actions_pending_maximal_effect(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("maximalEffect"))
    cards = _as_list(options.get("availableCardIds") if options else None)
    return [
        CandidateAction({"type": ACTION_RESOLVE_MAXIMAL_EFFECT, "cardId": card_id}, "maximal_effect.card")
        for card_id in cards
        if isinstance(card_id, str)
    ]


def _actions_pending_book_of_wisdom(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("bookOfWisdom"))
    if options is None:
        return []
    if _as_str(options.get("phase")) == "select_from_offer":
        cards = _as_list(options.get("availableOfferCards"))
    else:
        cards = _as_list(options.get("availableCardIds"))
    return [
        CandidateAction({"type": ACTION_RESOLVE_BOOK_OF_WISDOM, "cardId": card_id}, "book_of_wisdom.card")
        for card_id in cards
        if isinstance(card_id, str)
    ]


def _actions_pending_training(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("training"))
    if options is None:
        return []
    if _as_str(options.get("phase")) == "select_from_offer":
        cards = _as_list(options.get("availableOfferCards"))
    else:
        cards = _as_list(options.get("availableCardIds"))
    return [
        CandidateAction({"type": ACTION_RESOLVE_TRAINING, "cardId": card_id}, "training.card")
        for card_id in cards
        if isinstance(card_id, str)
    ]


def _actions_pending_crystal_joy(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("crystalJoyReclaim"))
    cards = _as_list(options.get("eligibleCardIds") if options else None)
    actions = [CandidateAction({"type": ACTION_RESOLVE_CRYSTAL_JOY_RECLAIM}, "crystal_joy.skip")]
    actions.extend(
        CandidateAction({"type": ACTION_RESOLVE_CRYSTAL_JOY_RECLAIM, "cardId": card_id}, "crystal_joy.card")
        for card_id in cards
        if isinstance(card_id, str)
    )
    return actions


def _actions_pending_steady_tempo(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("steadyTempo"))
    if options is None:
        return []
    if bool(options.get("canPlace")):
        return [
            CandidateAction({"type": ACTION_RESOLVE_STEADY_TEMPO, "place": True}, "steady_tempo.place"),
            CandidateAction({"type": ACTION_RESOLVE_STEADY_TEMPO, "place": False}, "steady_tempo.skip"),
        ]
    return [CandidateAction({"type": ACTION_RESOLVE_STEADY_TEMPO, "place": False}, "steady_tempo.skip")]


def _actions_pending_meditation(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("meditation"))
    if options is None:
        return []

    phase = _as_str(options.get("phase"))
    if phase == "place_cards":
        return [
            CandidateAction({"type": ACTION_RESOLVE_MEDITATION, "placeOnTop": True}, "meditation.place.top"),
            CandidateAction({"type": ACTION_RESOLVE_MEDITATION, "placeOnTop": False}, "meditation.place.bottom"),
        ]

    eligible = [card for card in _as_list(options.get("eligibleCardIds")) if isinstance(card, str)]
    count = int(options.get("selectCount", 0))
    selected = eligible[: max(count, 0)]
    return [CandidateAction({"type": ACTION_RESOLVE_MEDITATION, "selectedCardIds": selected}, "meditation.select")]


def _actions_pending_banner_protection(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    return [
        CandidateAction({"type": ACTION_RESOLVE_BANNER_PROTECTION, "removeAll": True}, "banner_protection.remove"),
        CandidateAction({"type": ACTION_RESOLVE_BANNER_PROTECTION, "removeAll": False}, "banner_protection.skip"),
    ]


def _actions_pending_source_opening_reroll(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    return [
        CandidateAction({"type": ACTION_RESOLVE_SOURCE_OPENING_REROLL, "reroll": True}, "source_opening.reroll"),
        CandidateAction({"type": ACTION_RESOLVE_SOURCE_OPENING_REROLL, "reroll": False}, "source_opening.keep"),
    ]


def _actions_pending_level_up(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("levelUpRewards"))
    if options is None:
        return []

    level = options.get("level")
    available_aas = [card for card in _as_list(options.get("availableAAs")) if isinstance(card, str)]
    drawn = [skill for skill in _as_list(options.get("drawnSkills")) if isinstance(skill, str)]
    common = [skill for skill in _as_list(options.get("commonPoolSkills")) if isinstance(skill, str)]

    if not isinstance(level, int) or not available_aas:
        return []

    actions: list[CandidateAction] = []
    if drawn:
        actions.append(
            CandidateAction(
                {
                    "type": ACTION_CHOOSE_LEVEL_UP_REWARDS,
                    "level": level,
                    "skillChoice": {"fromCommonPool": False, "skillId": drawn[0]},
                    "advancedActionId": available_aas[0],
                },
                "level_up.drawn",
            )
        )
    if common:
        actions.append(
            CandidateAction(
                {
                    "type": ACTION_CHOOSE_LEVEL_UP_REWARDS,
                    "level": level,
                    "skillChoice": {"fromCommonPool": True, "skillId": common[0]},
                    "advancedActionId": available_aas[0],
                },
                "level_up.common",
            )
        )

    return actions


def _actions_pending_unit_maintenance(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("unitMaintenance"))
    units = _as_list(options.get("units") if options else None)
    if not units:
        return []

    first = _as_dict(units[0])
    if first is None:
        return []

    unit_instance_id = _as_str(first.get("unitInstanceId"))
    if unit_instance_id is None:
        return []

    colors = [color for color in _as_list(first.get("availableCrystalColors")) if isinstance(color, str)]
    actions = [
        CandidateAction(
            {"type": ACTION_RESOLVE_UNIT_MAINTENANCE, "unitInstanceId": unit_instance_id, "keepUnit": False},
            "unit_maintenance.disband",
        )
    ]
    for color in colors:
        actions.append(
            CandidateAction(
                {
                    "type": ACTION_RESOLVE_UNIT_MAINTENANCE,
                    "unitInstanceId": unit_instance_id,
                    "keepUnit": True,
                    "crystalColor": color,
                    "newManaTokenColor": color,
                },
                "unit_maintenance.keep",
            )
        )
    return actions


def _actions_pending_hex_cost_reduction(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("hexCostReduction"))
    coords = _as_list(options.get("availableCoordinates") if options else None)
    return [
        CandidateAction({"type": ACTION_RESOLVE_HEX_COST_REDUCTION, "coordinate": coord}, "hex_cost_reduction.coordinate")
        for coord in coords
        if isinstance(coord, dict)
    ]


def _actions_pending_terrain_cost_reduction(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    options = _as_dict(valid_actions.get("terrainCostReduction"))
    terrains = _as_list(options.get("availableTerrains") if options else None)
    return [
        CandidateAction({"type": ACTION_RESOLVE_TERRAIN_COST_REDUCTION, "terrain": terrain}, "terrain_cost_reduction.terrain")
        for terrain in terrains
        if isinstance(terrain, str)
    ]


def _actions_combat(valid_actions: dict[str, Any]) -> list[CandidateAction]:
    actions: list[CandidateAction] = []
    combat = _as_dict(valid_actions.get("combat"))
    if combat is None:
        return actions

    for option in _as_list(combat.get("assignableAttacks")):
        payload = _as_dict(option)
        if payload is None:
            continue
        enemy = _as_str(payload.get("enemyInstanceId"))
        attack_type = _as_str(payload.get("attackType"))
        element = _as_str(payload.get("element"))
        amount = payload.get("amount")
        if enemy and attack_type and element and isinstance(amount, int):
            actions.append(
                CandidateAction(
                    {
                        "type": ACTION_ASSIGN_ATTACK,
                        "enemyInstanceId": enemy,
                        "attackType": attack_type,
                        "element": element,
                        "amount": amount,
                    },
                    "combat.assign_attack",
                )
            )

    for option in _as_list(combat.get("assignableBlocks")):
        payload = _as_dict(option)
        if payload is None:
            continue
        enemy = _as_str(payload.get("enemyInstanceId"))
        element = _as_str(payload.get("element"))
        amount = payload.get("amount")
        if enemy and element and isinstance(amount, int):
            actions.append(
                CandidateAction(
                    {
                        "type": ACTION_ASSIGN_BLOCK,
                        "enemyInstanceId": enemy,
                        "element": element,
                        "amount": amount,
                    },
                    "combat.assign_block",
                )
            )

    for option in _as_list(combat.get("damageAssignments")):
        payload = _as_dict(option)
        if payload is None:
            continue
        enemy = _as_str(payload.get("enemyInstanceId"))
        if enemy is None:
            continue
        action = {"type": ACTION_ASSIGN_DAMAGE, "enemyInstanceId": enemy}
        attack_index = payload.get("attackIndex")
        if isinstance(attack_index, int):
            action["attackIndex"] = attack_index
        actions.append(CandidateAction(action, "combat.assign_damage"))

    for option in _as_list(combat.get("blocks")):
        payload = _as_dict(option)
        if payload is None:
            continue
        enemy = _as_str(payload.get("enemyInstanceId"))
        if enemy is None:
            continue
        action = {"type": ACTION_DECLARE_BLOCK, "targetEnemyInstanceId": enemy}
        attack_index = payload.get("attackIndex")
        if isinstance(attack_index, int):
            action["attackIndex"] = attack_index
        actions.append(CandidateAction(action, "combat.declare_block"))

    for option in _as_list(combat.get("moveToAttackConversions")):
        payload = _as_dict(option)
        if payload is None:
            continue
        conversion_type = _as_str(payload.get("attackType"))
        cost_per_point = payload.get("costPerPoint")
        max_gainable = payload.get("maxAttackGainable")
        if conversion_type and isinstance(cost_per_point, int) and isinstance(max_gainable, int) and max_gainable > 0:
            actions.append(
                CandidateAction(
                    {
                        "type": ACTION_CONVERT_MOVE_TO_ATTACK,
                        "movePointsToSpend": cost_per_point,
                        "conversionType": conversion_type,
                    },
                    "combat.convert_move_to_attack",
                )
            )

    influence_conversion = _as_dict(combat.get("influenceToBlockConversion"))
    if influence_conversion is not None:
        cost_per_point = influence_conversion.get("costPerPoint")
        max_gainable = influence_conversion.get("maxBlockGainable")
        if isinstance(cost_per_point, int) and isinstance(max_gainable, int) and max_gainable > 0:
            actions.append(
                CandidateAction(
                    {
                        "type": ACTION_CONVERT_INFLUENCE_TO_BLOCK,
                        "influencePointsToSpend": cost_per_point,
                    },
                    "combat.convert_influence_to_block",
                )
            )

    for option in _as_list(combat.get("cumbersomeOptions")):
        payload = _as_dict(option)
        if payload is None:
            continue
        enemy = _as_str(payload.get("enemyInstanceId"))
        max_reduction = payload.get("maxAdditionalReduction")
        if enemy and isinstance(max_reduction, int) and max_reduction > 0:
            actions.append(
                CandidateAction(
                    {
                        "type": ACTION_SPEND_MOVE_ON_CUMBERSOME,
                        "enemyInstanceId": enemy,
                        "movePointsToSpend": 1,
                    },
                    "combat.cumbersome",
                )
            )

    for option in _as_list(combat.get("thugsDamagePaymentOptions")):
        payload = _as_dict(option)
        if payload is None:
            continue
        unit_instance_id = _as_str(payload.get("unitInstanceId"))
        can_afford = bool(payload.get("canAfford"))
        already_paid = bool(payload.get("alreadyPaid"))
        if unit_instance_id and can_afford and not already_paid:
            actions.append(
                CandidateAction(
                    {
                        "type": ACTION_PAY_THUGS_DAMAGE_INFLUENCE,
                        "unitInstanceId": unit_instance_id,
                    },
                    "combat.thugs_payment",
                )
            )

    if bool(combat.get("canPayHeroesAssaultInfluence")):
        actions.append(CandidateAction({"type": ACTION_PAY_HEROES_ASSAULT_INFLUENCE}, "combat.heroes_assault_payment"))

    for option in _as_list(combat.get("bannerFearOptions")):
        payload = _as_dict(option)
        if payload is None:
            continue
        unit_instance_id = _as_str(payload.get("unitInstanceId"))
        targets = _as_list(payload.get("targets"))
        for target in targets:
            target_payload = _as_dict(target)
            if target_payload is None or unit_instance_id is None:
                continue
            target_enemy = _as_str(target_payload.get("enemyInstanceId"))
            if target_enemy is None:
                continue
            action = {
                "type": ACTION_USE_BANNER_FEAR,
                "unitInstanceId": unit_instance_id,
                "targetEnemyInstanceId": target_enemy,
            }
            attack_index = target_payload.get("attackIndex")
            if isinstance(attack_index, int):
                action["attackIndex"] = attack_index
            actions.append(CandidateAction(action, "combat.banner_fear"))

    if bool(combat.get("canEndPhase")):
        actions.append(CandidateAction({"type": ACTION_END_COMBAT_PHASE}, "combat.end_phase"))

    return actions


def _actions_normal_turn(state: dict[str, Any], valid_actions: dict[str, Any], player_id: str) -> list[CandidateAction]:
    actions: list[CandidateAction] = []
    turn = _as_dict(valid_actions.get("turn"))

    for target in _as_list(_as_dict(valid_actions.get("move")) and _as_dict(valid_actions.get("move")) .get("targets")):
        payload = _as_dict(target)
        if payload is None:
            continue
        hex_coord = payload.get("hex")
        if isinstance(hex_coord, dict):
            actions.append(CandidateAction({"type": ACTION_MOVE, "target": hex_coord}, "normal.move"))

    explore = _as_dict(valid_actions.get("explore"))
    for direction in _as_list(explore.get("directions") if explore else None):
        payload = _as_dict(direction)
        if payload is None:
            continue
        direction_value = payload.get("direction")
        from_tile = payload.get("fromTileCoord")
        if isinstance(direction_value, str) and isinstance(from_tile, dict):
            actions.append(
                CandidateAction(
                    {"type": ACTION_EXPLORE, "direction": direction_value, "fromTileCoord": from_tile},
                    "normal.explore",
                )
            )

    site = _as_dict(valid_actions.get("sites"))
    if site is not None:
        if bool(site.get("canEnter")):
            actions.append(CandidateAction({"type": ACTION_ENTER_SITE}, "normal.site.enter"))
        if bool(site.get("canInteract")):
            actions.append(CandidateAction({"type": ACTION_INTERACT}, "normal.site.interact"))

        interact_options = _as_dict(site.get("interactOptions"))
        offers = _as_dict(state.get("offers"))
        if interact_options is not None:
            if bool(interact_options.get("canHeal")):
                actions.append(CandidateAction({"type": ACTION_BUY_HEALING, "amount": 1}, "normal.site.heal"))
            if bool(interact_options.get("canBuySpells")):
                spells = _as_dict(offers.get("spells") if offers else None)
                for card_id in _as_list(spells.get("cards") if spells else None):
                    if isinstance(card_id, str):
                        actions.append(CandidateAction({"type": ACTION_BUY_SPELL, "cardId": card_id}, "normal.site.buy_spell"))
            if bool(interact_options.get("canBuyAdvancedActions")):
                monastery = _as_list(offers.get("monasteryAdvancedActions") if offers else None)
                for card_id in monastery:
                    if isinstance(card_id, str):
                        actions.append(
                            CandidateAction(
                                {
                                    "type": ACTION_LEARN_ADVANCED_ACTION,
                                    "cardId": card_id,
                                    "fromMonastery": True,
                                },
                                "normal.site.buy_aa",
                            )
                        )
            if bool(interact_options.get("canBurnMonastery")):
                actions.append(CandidateAction({"type": ACTION_BURN_MONASTERY}, "normal.site.burn_monastery"))
            if bool(interact_options.get("canPlunderVillage")):
                actions.append(CandidateAction({"type": ACTION_PLUNDER_VILLAGE}, "normal.site.plunder_village"))

    challenge = _as_dict(valid_actions.get("challenge"))
    for target_hex in _as_list(challenge.get("targetHexes") if challenge else None):
        if isinstance(target_hex, dict):
            actions.append(CandidateAction({"type": ACTION_CHALLENGE_RAMPAGING, "targetHex": target_hex}, "normal.challenge"))

    play_card = _as_dict(valid_actions.get("playCard"))
    for card in _as_list(play_card.get("cards") if play_card else None):
        payload = _as_dict(card)
        if payload is None:
            continue
        card_id = _as_str(payload.get("cardId"))
        if card_id is None:
            continue

        if bool(payload.get("canPlayBasic")):
            actions.append(CandidateAction({"type": ACTION_PLAY_CARD, "cardId": card_id, "powered": False}, "normal.play_card.basic"))

        if bool(payload.get("canPlayPowered")):
            mana_options = _as_list(payload.get("poweredManaOptions"))
            if mana_options:
                is_spell = bool(payload.get("isSpell"))
                if is_spell and len(mana_options) == 2:
                    actions.append(CandidateAction(
                        {"type": ACTION_PLAY_CARD, "cardId": card_id, "powered": True, "manaSources": mana_options},
                        "normal.play_card.powered",
                    ))
                elif not is_spell and len(mana_options) >= 1:
                    actions.append(CandidateAction(
                        {"type": ACTION_PLAY_CARD, "cardId": card_id, "powered": True, "manaSource": mana_options[0]},
                        "normal.play_card.powered",
                    ))

        if bool(payload.get("canPlaySideways")):
            for option in _as_list(payload.get("sidewaysOptions")):
                sideways = _as_dict(option)
                if sideways is None:
                    continue
                as_value = _as_str(sideways.get("as"))
                if as_value:
                    actions.append(
                        CandidateAction(
                            {"type": ACTION_PLAY_CARD_SIDEWAYS, "cardId": card_id, "as": as_value},
                            "normal.play_card.sideways",
                        )
                    )

    units = _as_dict(valid_actions.get("units"))
    player = _find_player(state, player_id)
    for recruit in _as_list(units.get("recruitable") if units else None):
        payload = _as_dict(recruit)
        if payload is None:
            continue
        unit_id = _as_str(payload.get("unitId"))
        cost = payload.get("cost")
        if unit_id and isinstance(cost, int) and bool(payload.get("canAfford")):
            recruit_mana_options = _as_list(payload.get("recruitManaOptions"))
            if recruit_mana_options:
                # Unit requires mana (e.g. Magic Familiars): emit one action per valid (manaSource, manaTokenColor)
                for opt in recruit_mana_options:
                    opt_dict = _as_dict(opt)
                    if opt_dict is None:
                        continue
                    mana_source = _as_dict(opt_dict.get("manaSource"))
                    token_color = opt_dict.get("manaTokenColor")
                    if mana_source is not None and token_color is not None:
                        action = _make_recruit_action(
                            unit_id, cost, payload, player, mana_source, token_color
                        )
                        if action is not None:
                            actions.append(CandidateAction(action, "normal.units.recruit"))
            else:
                action = _make_recruit_action(unit_id, cost, payload, player, None, None)
                if action is not None:
                    actions.append(CandidateAction(action, "normal.units.recruit"))

    for unit in _as_list(units.get("activatable") if units else None):
        payload = _as_dict(unit)
        if payload is None:
            continue
        unit_instance_id = _as_str(payload.get("unitInstanceId"))
        if unit_instance_id is None:
            continue
        for ability in _as_list(payload.get("abilities")):
            ability_payload = _as_dict(ability)
            if ability_payload is None:
                continue
            if not bool(ability_payload.get("canActivate")):
                continue
            if ability_payload.get("manaCost") is not None:
                continue
            index = ability_payload.get("index")
            if isinstance(index, int):
                actions.append(
                    CandidateAction(
                        {
                            "type": "ACTIVATE_UNIT",
                            "unitInstanceId": unit_instance_id,
                            "abilityIndex": index,
                        },
                        "normal.units.activate",
                    )
                )

    skills = _as_dict(valid_actions.get("skills"))
    for skill in _as_list(skills.get("activatable") if skills else None):
        payload = _as_dict(skill)
        if payload is None:
            continue
        skill_id = _as_str(payload.get("skillId"))
        if skill_id:
            actions.append(CandidateAction({"type": ACTION_USE_SKILL, "skillId": skill_id}, "normal.skills.activate"))

    returnable_skills = _as_dict(valid_actions.get("returnableSkills"))
    for skill in _as_list(returnable_skills.get("returnable") if returnable_skills else None):
        payload = _as_dict(skill)
        if payload is None:
            continue
        skill_id = _as_str(payload.get("skillId"))
        if skill_id:
            actions.append(CandidateAction({"type": ACTION_RETURN_INTERACTIVE_SKILL, "skillId": skill_id}, "normal.skills.return"))

    learning = _as_dict(valid_actions.get("learningAAPurchase"))
    if learning is not None and bool(learning.get("canAfford")):
        for card_id in _as_list(learning.get("availableCards")):
            if isinstance(card_id, str):
                actions.append(
                    CandidateAction(
                        {
                            "type": ACTION_LEARN_ADVANCED_ACTION,
                            "cardId": card_id,
                            "fromMonastery": False,
                            "fromLearning": True,
                        },
                        "normal.learning_aa",
                    )
                )

    banners = _as_dict(valid_actions.get("banners"))
    for banner in _as_list(banners.get("assignable") if banners else None):
        payload = _as_dict(banner)
        if payload is None:
            continue
        banner_card_id = _as_str(payload.get("bannerCardId"))
        if banner_card_id is None:
            continue
        for unit_id in _as_list(payload.get("targetUnits")):
            if isinstance(unit_id, str):
                actions.append(
                    CandidateAction(
                        {
                            "type": ACTION_ASSIGN_BANNER,
                            "bannerCardId": banner_card_id,
                            "targetUnitInstanceId": unit_id,
                        },
                        "normal.banners.assign",
                    )
                )

    tactic_effects = _as_dict(valid_actions.get("tacticEffects"))
    if tactic_effects is not None:
        pending_decision = _as_dict(tactic_effects.get("pendingDecision"))
        if pending_decision is not None:
            actions.extend(_actions_for_tactic_decision(pending_decision, "normal.tactic.pending"))

        if player:
            selected_tactic_id = _as_str(player.get("selectedTacticId"))
            can_activate = _as_dict(tactic_effects.get("canActivate"))
            if selected_tactic_id and can_activate and any(bool(val) for val in can_activate.values()):
                actions.append(
                    CandidateAction(
                        {"type": ACTION_ACTIVATE_TACTIC, "tacticId": selected_tactic_id},
                        "normal.tactic.activate",
                    )
                )

        can_reroll = _as_dict(tactic_effects.get("canRerollSourceDice"))
        selected_die_ids = _select_reroll_die_ids(state, can_reroll)
        if selected_die_ids:
            actions.append(CandidateAction({"type": ACTION_REROLL_SOURCE_DICE, "dieIds": selected_die_ids}, "normal.tactic.reroll"))

    if turn is not None:
        if bool(turn.get("canCompleteRest")):
            rest_discard = _as_dict(turn.get("restDiscard"))
            discard_card_ids = _build_complete_rest_discard(rest_discard)
            if discard_card_ids is not None:
                actions.append(
                    CandidateAction(
                        {"type": ACTION_COMPLETE_REST, "discardCardIds": discard_card_ids},
                        "normal.turn.complete_rest",
                    )
                )
        if bool(turn.get("canDeclareRest")):
            actions.append(CandidateAction({"type": ACTION_DECLARE_REST}, "normal.turn.declare_rest"))
        if bool(turn.get("canEndTurn")):
            actions.append(CandidateAction({"type": ACTION_END_TURN}, "normal.turn.end_turn"))
        if bool(turn.get("canAnnounceEndOfRound")):
            actions.append(CandidateAction({"type": ACTION_ANNOUNCE_END_OF_ROUND}, "normal.turn.announce_end_round"))

    return actions


def _append_common_blocking_actions(valid_actions: dict[str, Any], actions: list[CandidateAction]) -> None:
    turn = _as_dict(valid_actions.get("turn"))
    if turn is None:
        return

    if bool(turn.get("canUndo")):
        actions.append(CandidateAction({"type": ACTION_UNDO}, "turn.undo"))
    if bool(turn.get("canEndTurn")):
        actions.append(CandidateAction({"type": ACTION_END_TURN}, "turn.end_turn"))


def _actions_for_tactic_decision(decision: dict[str, Any], source_prefix: str) -> list[CandidateAction]:
    decision_type = _as_str(decision.get("type"))
    if decision_type is None:
        return []

    actions: list[CandidateAction] = []
    if decision_type in {"rethink", "midnight_meditation"}:
        actions.append(
            CandidateAction(
                {
                    "type": ACTION_RESOLVE_TACTIC_DECISION,
                    "decision": {"type": decision_type, "cardIds": []},
                },
                f"{source_prefix}.cards",
            )
        )
    elif decision_type == "mana_steal":
        available_dice = _as_list(decision.get("availableDiceIds"))
        for die_id in available_dice:
            if isinstance(die_id, str):
                actions.append(
                    CandidateAction(
                        {
                            "type": ACTION_RESOLVE_TACTIC_DECISION,
                            "decision": {"type": decision_type, "dieId": die_id},
                        },
                        f"{source_prefix}.die",
                    )
                )
    elif decision_type == "preparation":
        snapshot = _as_list(decision.get("deckSnapshot"))
        for card_id in snapshot:
            if isinstance(card_id, str):
                actions.append(
                    CandidateAction(
                        {
                            "type": ACTION_RESOLVE_TACTIC_DECISION,
                            "decision": {"type": decision_type, "cardId": card_id},
                        },
                        f"{source_prefix}.card",
                    )
                )
    elif decision_type == "sparing_power":
        actions.append(
            CandidateAction(
                {
                    "type": ACTION_RESOLVE_TACTIC_DECISION,
                    "decision": {"type": decision_type, "choice": "take"},
                },
                f"{source_prefix}.sparing.take",
            )
        )
        if bool(decision.get("canStash")):
            actions.append(
                CandidateAction(
                    {
                        "type": ACTION_RESOLVE_TACTIC_DECISION,
                        "decision": {"type": decision_type, "choice": "stash"},
                    },
                    f"{source_prefix}.sparing.stash",
                )
            )

    return actions


def _select_reroll_die_ids(state: dict[str, Any], can_reroll: dict[str, Any] | None) -> list[str]:
    if can_reroll is None:
        return []

    available_ids = [
        die_id
        for die_id in _as_list(can_reroll.get("availableDiceIds"))
        if isinstance(die_id, str)
    ]
    if not available_ids:
        return []

    if bool(can_reroll.get("mustPickDepletedFirst")):
        required_first_ids = [
            die_id
            for die_id in _as_list(can_reroll.get("requiredFirstDiceIds"))
            if isinstance(die_id, str) and die_id in available_ids
        ]
        if required_first_ids:
            return [required_first_ids[0]]

        # Backward-compatible fallback for older servers that do not provide
        # requiredFirstDiceIds: derive the constrained subset from source dice.
        source = _as_dict(state.get("source"))
        source_dice = _as_list(source.get("dice") if source else None)
        prioritized_ids: list[str] = []
        for die in source_dice:
            payload = _as_dict(die)
            if payload is None:
                continue
            die_id = _as_str(payload.get("id"))
            if die_id is None or die_id not in available_ids:
                continue
            color = _as_str(payload.get("color")) or ""
            is_depleted = bool(payload.get("isDepleted"))
            if is_depleted or color.lower() == "gold":
                prioritized_ids.append(die_id)
        if prioritized_ids:
            return [prioritized_ids[0]]

    return [available_ids[0]]


def _is_wound_card_id(card_id: str) -> bool:
    return card_id == "wound"


def _build_complete_rest_discard(rest_discard: dict[str, Any] | None) -> list[str] | None:
    if rest_discard is None:
        return None

    rest_type = _as_str(rest_discard.get("restType"))
    discardable = [
        card for card in _as_list(rest_discard.get("discardableCardIds")) if isinstance(card, str)
    ]
    allow_empty = bool(rest_discard.get("allowEmptyDiscard"))

    if rest_type == "standard":
        non_wounds = [card for card in discardable if not _is_wound_card_id(card)]
        if not non_wounds:
            return None
        # Standard Rest requires exactly one non-wound; wounds are optional.
        return [non_wounds[0]]

    if rest_type == "slow_recovery":
        if allow_empty:
            return []
        if discardable:
            return [discardable[0]]
        return None

    if allow_empty:
        return []
    if discardable:
        return [discardable[0]]
    return None


def _find_player(state: dict[str, Any], player_id: str) -> dict[str, Any] | None:
    players = _as_list(state.get("players"))
    for entry in players:
        payload = _as_dict(entry)
        if payload and payload.get("id") == player_id:
            return payload
    return None


def _as_dict(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    return None


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def _as_str(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


def _make_recruit_action(
    unit_id: str,
    cost: int,
    payload: dict[str, Any],
    player: dict[str, Any] | None,
    mana_source: dict[str, Any] | None,
    mana_token_color: Any,
) -> dict[str, Any] | None:
    """Build RECRUIT_UNIT action dict; include manaSource/manaTokenColor when required (e.g. Magic Familiars)."""
    action: dict[str, Any] = {
        "type": ACTION_RECRUIT_UNIT,
        "unitId": unit_id,
        "influenceSpent": cost,
    }
    if bool(payload.get("requiresDisband")) and player:
        unit_list = _as_list(player.get("units"))
        if unit_list:
            first_unit = _as_dict(unit_list[0])
            unit_instance_id = _as_str(first_unit.get("instanceId") if first_unit else None)
            if unit_instance_id:
                action["disbandUnitInstanceId"] = unit_instance_id
    if mana_source is not None and mana_token_color is not None:
        action["manaSource"] = mana_source
        action["manaTokenColor"] = mana_token_color
    return action
