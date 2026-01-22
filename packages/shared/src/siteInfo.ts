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
  /** For mines: the color of crystal this mine produces */
  mineColor?: "white" | "green" | "red" | "blue";
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
  /** Static name or function for dynamic names (e.g., "Blue Mine") */
  name: string | ((context: SiteInfoContext) => string);
  tooltip: (context: SiteInfoContext) => Omit<SiteTooltipInfo, "name">;
  panel: (context: SiteInfoContext) => SitePanelInfo;
}

function getEnemyRevealNote(context: SiteInfoContext): string {
  return context.hasUnrevealedEnemies && context.timeOfDay === TIME_OF_DAY_NIGHT
    ? " (revealed on assault)"
    : "";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  mine: {
    name: (context) => `${capitalize(context.mineColor || "white")} Mine`,
    tooltip: (context) => {
      const color = context.mineColor || "white";
      return {
        interaction: `End turn: Gain ${color} crystal`,
      };
    },
    panel: (context) => {
      const color = context.mineColor || "white";
      return {
        services: [`End turn here to gain a ${color} crystal`],
        sections: [
          {
            title: "Crystal Production",
            body: [
              `End your turn on this mine to gain one ${color} mana crystal to your inventory.`,
              "Crystals are permanent mana storage (max 3 per color).",
            ],
          },
        ],
      };
    },
  },
  village: {
    name: "Village",
    tooltip: () => ({
      interaction: "Recruit units, Heal (3 Inf = 1 HP)",
      special: ["Plunder: Draw 2 cards, −1 Rep"],
    }),
    panel: () => ({
      services: [
        "Recruit units with village icon",
        "Heal: 3 Influence = 1 Healing",
      ],
      sections: [
        {
          title: "Recruiting",
          body: [
            "Units with the village icon can be recruited here.",
            "Pay the unit's cost in Influence to add it to your Units area.",
          ],
        },
        {
          title: "Healing",
          body: [
            "Pay 3 Influence to gain 1 point of Healing.",
            "You may buy multiple points of Healing.",
          ],
        },
        {
          title: "Plundering",
          body: [
            "You may plunder this village during another player's turn.",
            "Draw 2 cards and lose 1 Reputation.",
            "You can only plunder a village once between each of your turns.",
          ],
        },
      ],
    }),
  },
  monastery: {
    name: (context) => context.isConquered ? "Burned Monastery" : "Monastery",
    tooltip: (context) => {
      if (context.isConquered) {
        return {
          interaction: "Destroyed - no services available",
        };
      }
      return {
        interaction: "Recruit, Heal (2 Inf), Buy AA (6 Inf)",
        special: ["Burn: −3 Rep, fight violet, no units"],
      };
    },
    panel: (context) => {
      if (context.isConquered) {
        return {
          sections: [
            {
              title: "Destroyed",
              body: [
                "This monastery has been burned and no longer provides services.",
              ],
            },
          ],
        };
      }
      return {
        services: [
          "Recruit units with monastery icon",
          "Heal: 2 Influence = 1 Healing",
          "Buy Advanced Actions: 6 Influence",
        ],
        sections: [
          {
            title: "Recruiting",
            body: [
              "Units with the monastery icon can be recruited here.",
              "Pay the unit's cost in Influence to add it to your Units area.",
            ],
          },
          {
            title: "Healing",
            body: [
              "Pay 2 Influence to gain 1 point of Healing.",
              "You may buy multiple points of Healing.",
            ],
          },
          {
            title: "Training",
            body: [
              "When a monastery is revealed, put the top card of the Advanced Action deck face up in the unit offer.",
              "Advanced Actions in the unit offer can be bought at any monastery for 6 Influence.",
            ],
          },
          {
            title: "Burning a Monastery",
            body: [
              "You can try to burn a monastery as your action for the turn.",
              "If you do, you get −3 Reputation. Draw a random violet enemy token to fight.",
              "Your units cannot be used in this combat.",
              "If you defeat the enemy, mark the space with your Shield and gain an Artifact as reward. The monastery is now destroyed.",
              "Whether you defeat the enemy or not, discard it afterwards. Next time, a new token will be drawn.",
            ],
          },
        ],
      };
    },
  },
};

export function getSiteTooltipInfo(
  context: SiteInfoContext
): SiteTooltipInfo | null {
  const definition = SITE_UI[context.siteType];
  if (!definition) return null;
  const name = typeof definition.name === "function"
    ? definition.name(context)
    : definition.name;
  return { name, ...definition.tooltip(context) };
}

export function getSitePanelInfo(
  context: SiteInfoContext
): SitePanelInfo | null {
  const definition = SITE_UI[context.siteType];
  if (!definition) return null;
  return definition.panel(context);
}
