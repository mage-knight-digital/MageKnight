import type { LegalAction } from "../rust/types";
import { actionType, actionData } from "../rust/types";

/** Convert underscore_case ID to Title Case display name. */
function humanizeId(id: unknown): string {
  if (typeof id !== "string") return String(id ?? "?");
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Insert spaces before capitals in PascalCase: "EndTurn" → "End Turn". */
function humanizeVariant(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Format a LegalAction into a concise human-readable label. */
export function formatAction(action: LegalAction): string {
  const type = actionType(action);
  const data = actionData(action);

  switch (type) {
    case "PlayCardBasic":
      return `Play ${humanizeId(data?.card_id as string)} (basic)`;
    case "PlayCardPowered":
      return `Play ${humanizeId(data?.card_id as string)} (${data?.mana_color} powered)`;
    case "PlayCardSideways": {
      const sideways = data?.sideways_as as string | undefined;
      const suffix = sideways ? ` → ${humanizeId(sideways)}` : "";
      return `${humanizeId(data?.card_id as string)} sideways${suffix}`;
    }
    case "SelectTactic":
      return `Tactic: ${humanizeId(data?.tactic_id as string)}`;
    case "Move": {
      const t = data?.target as { q: number; r: number } | undefined;
      return t ? `Move to (${t.q},${t.r})` : "Move";
    }
    case "Explore":
      return "Explore";
    case "EndTurn":
      return "End Turn";
    case "BeginInteraction":
      return "Begin Interaction";
    case "DeclareRest":
      return "Declare Rest";
    case "ForfeitTurn":
      return "Forfeit Turn";
    case "ResolveChoice":
      return `Choose option ${data?.choice_index}`;
    case "ChallengeRampaging":
      return "Challenge rampaging";
    case "UseSkill":
      return `Skill: ${humanizeId(data?.skill_id as string)}`;
    case "RecruitUnit":
      return `Recruit ${humanizeId(data?.unit_id as string)}`;
    case "ActivateUnit":
      return `Activate unit`;
    case "BuySpell":
      return `Buy spell: ${humanizeId(data?.spell_id as string ?? "?")}`;
    case "LearnAdvancedAction":
      return `Learn AA: ${humanizeId(data?.advanced_action_id as string ?? "?")}`;
    case "ChooseLevelUpSkill":
      return `Level skill #${data?.skill_index ?? "?"}${data?.from_common_pool ? " (common)" : ""}`;
    case "ChooseLevelUpAdvancedAction":
      return `Level AA: ${humanizeId(data?.advanced_action_id as string ?? "?")}`;
    default: {
      // Fallback: humanize variant name + first string field value
      const label = humanizeVariant(type);
      if (data) {
        const firstVal = Object.values(data).find((v) => typeof v === "string");
        if (firstVal) return `${label}: ${humanizeId(firstVal as string)}`;
      }
      return label;
    }
  }
}
