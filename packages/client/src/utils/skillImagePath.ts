import type { SkillId } from "@mage-knight/shared";
import { assetUrl } from "../assets/assetPaths";

/**
 * Skill portraits live under skills/ as `{stem}.jpg` in the static asset tree.
 * Some scans use a `_co-op` suffix or a different base name than the engine {@link SkillId}.
 */
const SKILL_IMAGE_STEM_BY_ID = {
  arythea_ritual_of_pain: "arythea_ritual_of_pain_co-op",
  braevalar_natures_vengeance: "braevalar_natures_vengeance_co-op",
  goldyx_source_opening: "goldyx_source_opening_co-op",
  krang_mana_enhancement: "krang_mana_enhancement_co-op",
  tovak_mana_overload: "tovak_mana_overload_co-op",
  wolfhawk_wolfs_howl: "wolfhawk_howl_of_the_pack_co-op",
} as const satisfies Record<string, string>;

export function skillImagePath(skillId: SkillId): string {
  const stem =
    skillId in SKILL_IMAGE_STEM_BY_ID
      ? SKILL_IMAGE_STEM_BY_ID[skillId as keyof typeof SKILL_IMAGE_STEM_BY_ID]
      : skillId;
  return assetUrl(`skills/${stem}.jpg`);
}
