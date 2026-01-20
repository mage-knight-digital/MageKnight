/**
 * Shared site UI metadata for tooltips and panels.
 *
 * This keeps site text consistent across client components and avoids
 * duplicating hardcoded strings in multiple places.
 */

import type { TimeOfDay } from "./stateConstants.js";
import { TIME_OF_DAY_NIGHT } from "./stateConstants.js";

export interface SiteInfoContext {
  siteType: string;
  isConquered: boolean;
  timeOfDay?: TimeOfDay;
  hasUnrevealedEnemies?: boolean;
}

export interface SiteTooltipInfo {
  name: string;
  fight?: string;
  reward?: string;
  interaction?: string;
  special?: string[];
}

export interface SitePanelInfo {
  fight?: string;
  reward?: string;
  services?: string[];
  special?: string[];
  isFortified?: boolean;
  sections?: SitePanelSection[];
}

export interface SitePanelSection {
  title: string;
  body: string[];
}

interface SiteUiDefinition {
  name: string;
  tooltip: (context: SiteInfoContext) => Omit<SiteTooltipInfo, "name">;
  panel: (context: SiteInfoContext) => SitePanelInfo;
}

function getEnemyRevealNote(context: SiteInfoContext): string {
  return context.hasUnrevealedEnemies && context.timeOfDay === TIME_OF_DAY_NIGHT
    ? " (revealed on assault)"
    : "";
}

function getFortifiedRevealBody(context: SiteInfoContext): string[] | null {
  if (!context.hasUnrevealedEnemies) return null;
  if (context.timeOfDay === TIME_OF_DAY_NIGHT) {
    return [
      "Defenders are unrevealed at night and will be revealed on assault.",
    ];
  }
  return [
    "Defenders are revealed during the day if a hero is adjacent.",
  ];
}

const SITE_UI: Record<string, SiteUiDefinition> = {
  keep: {
    name: "Keep",
    tooltip: (context) => {
      if (context.isConquered) {
        return {
          interaction: "Recruit units",
          special: ["+1 Hand limit (end turn here)"],
        };
      }
      const revealNote = getEnemyRevealNote(context);
      return {
        fight: `1 Grey enemy${revealNote}`,
        special: ["Fortified (Siege required)", "Assault: −1 Reputation"],
      };
    },
    panel: (context) => {
      if (context.isConquered) {
        return {
          services: ["Recruit units"],
          special: ["+1 Hand limit when ending turn here"],
          sections: [
            {
              title: "Services",
              body: [
                "Recruit units with the keep icon.",
                "End your turn on or adjacent to a keep you own to increase hand limit by 1.",
              ],
            },
          ],
        };
      }
      const revealNote = getEnemyRevealNote(context);
      return {
        fight: `1 Grey enemy${revealNote}`,
        isFortified: true,
        sections: (() => {
          const revealBody = getFortifiedRevealBody(context);
          return [
            ...(revealBody
              ? [{
                  title: "Reveal",
                  body: revealBody,
                }]
              : []),
            {
              title: "Assault",
              body: [
                "Assaulting costs −1 Reputation.",
                "If you defeat the defenders, mark the keep with your Shield.",
              ],
            },
          ];
        })(),
      };
    },
  },
  mage_tower: {
    name: "Mage Tower",
    tooltip: (context) => {
      if (context.isConquered) {
        return {
          interaction: "Buy Spells: 7 Influence + mana matching spell",
        };
      }
      const revealNote = getEnemyRevealNote(context);
      return {
        fight: `1 Violet enemy${revealNote}`,
        reward: "1 Spell",
        special: ["Fortified (Siege required)", "Assault: −1 Reputation"],
      };
    },
    panel: (context) => {
      if (context.isConquered) {
        return {
          services: ["Buy Spells: 7 Influence + mana matching spell color"],
          sections: [
            {
              title: "Services",
              body: [
                "Buy spells for 7 Influence + mana matching the spell color.",
                "Recruit units with the mage tower icon.",
              ],
            },
          ],
        };
      }
      const revealNote = getEnemyRevealNote(context);
      return {
        fight: `1 Violet enemy${revealNote}`,
        reward: "1 Spell",
        isFortified: true,
        sections: (() => {
          const revealBody = getFortifiedRevealBody(context);
          return [
            ...(revealBody
              ? [{
                  title: "Reveal",
                  body: revealBody,
                }]
              : []),
            {
              title: "Assault",
              body: [
                "Assaulting costs −1 Reputation.",
                "If you defeat it, mark the tower with your Shield and claim the reward.",
              ],
            },
          ];
        })(),
      };
    },
  },
  tomb: {
    name: "Tomb",
    tooltip: (context) => ({
      fight: "1 Red Draconum",
      reward: context.isConquered ? "Fame only" : "Spell + Artifact",
      special: ["Night rules", "No units"],
    }),
    panel: (context) => ({
      fight: "1 Red Draconum",
      reward: context.isConquered ? "Fame only" : "Spell + Artifact",
      sections: [
        {
          title: context.isConquered ? "Re-enter" : "Enter",
          body: [
            "Enter as your action to draw and fight a red Draconum.",
            ...(context.isConquered
              ? ["You may enter again, but rewards are Fame only."]
              : ["If you defeat it, mark the tomb with your Shield."]),
          ],
        },
        {
          title: "Restrictions",
          body: [
            "Night rules apply for this combat.",
            "Units cannot be used.",
          ],
        },
        {
          title: "After Combat",
          body: [
            "The enemy token is discarded after combat.",
          ],
        },
      ],
    }),
  },
  ancient_ruins: {
    name: "Ancient Ruins",
    tooltip: () => ({
      fight: "Yellow token: Altar or Enemies",
      reward: "Varies by token",
      special: ["Altar: Pay 3 mana for 7 Fame"],
    }),
    panel: (context) => {
      const revealSection = !context.isConquered
        ? {
            title: "Reveal",
            body: context.timeOfDay === TIME_OF_DAY_NIGHT
              ? [
                  "The ruins token is face down at night and reveals on entry or at the start of the next day.",
                ]
              : [
                  "The ruins token is face up during the day.",
                ],
          }
        : null;
      return {
        fight: "Draw yellow token: Altar or Enemies",
        reward: "Varies by token",
        sections: [
          ...(revealSection ? [revealSection] : []),
          {
            title: "Ancient Altar",
            body: [
              "If the token shows three mana of one color, you may pay 3 mana of that color.",
              "If you do, gain 7 Fame, discard the token, and mark the site with a Shield.",
              "If you cannot or do not pay, nothing happens.",
            ],
          },
          {
            title: "Enemies With Treasure",
            body: [
              "If the token shows enemies, draw and fight the depicted enemies.",
              "Undefeated enemies remain on the space; defeated enemies are not replaced.",
              "Whoever defeats the last enemy discards the token, marks the site with a Shield, and claims the depicted reward at end of turn.",
            ],
          },
          {
            title: "Rewards",
            body: [
              "Artifact, Spell, Advanced Action, four crystals (one of each basic color), or a free Unit from the offer.",
            ],
          },
          {
            title: "Notes",
            body: [
              "Orcs and Draconum defeated in ruins do not grant Reputation.",
            ],
          },
        ],
      };
    },
  },
  magical_glade: {
    name: "Magical Glade",
    tooltip: () => ({
      interaction: "Start: Gold/black mana. End: Discard wound",
    }),
    panel: () => ({
      services: [
        "Start of turn: Gain gold mana (day) or black mana (night)",
        "End of turn: Discard 1 Wound from hand",
      ],
      sections: [
        {
          title: "Imbued With Magic",
          body: [
            "Start your turn here: gain gold mana by day or black mana by night.",
          ],
        },
        {
          title: "Healing Essence",
          body: [
            "End your turn here to discard one Wound from hand or discard pile.",
            "This is not healing and cannot be combined with healing effects.",
          ],
        },
      ],
    }),
  },
};

export function getSiteTooltipInfo(
  context: SiteInfoContext
): SiteTooltipInfo | null {
  const definition = SITE_UI[context.siteType];
  if (!definition) return null;
  return { name: definition.name, ...definition.tooltip(context) };
}

export function getSitePanelInfo(
  context: SiteInfoContext
): SitePanelInfo | null {
  const definition = SITE_UI[context.siteType];
  if (!definition) return null;
  return definition.panel(context);
}
