/**
 * Hero types for Mage Knight
 *
 * HeroId is a string literal type representing the hero identifiers.
 * This is defined in shared (not core) so it can be imported by the client
 * for the setup screen without creating a core → client dependency.
 */

// Base game heroes
export const HERO_ARYTHEA = "arythea" as const;
export const HERO_TOVAK = "tovak" as const;
export const HERO_GOLDYX = "goldyx" as const;
export const HERO_NOROWAS = "norowas" as const;

// Lost Legion expansion heroes
export const HERO_WOLFHAWK = "wolfhawk" as const;
export const HERO_KRANG = "krang" as const;

// Shades of Tezla expansion hero
export const HERO_BRAEVALAR = "braevalar" as const;

/** String literal type for hero identifiers */
export type HeroId =
  | typeof HERO_ARYTHEA
  | typeof HERO_TOVAK
  | typeof HERO_GOLDYX
  | typeof HERO_NOROWAS
  | typeof HERO_WOLFHAWK
  | typeof HERO_KRANG
  | typeof HERO_BRAEVALAR;

/** Array of base game heroes (always available) */
export const BASE_HEROES: readonly HeroId[] = [
  HERO_ARYTHEA,
  HERO_TOVAK,
  HERO_GOLDYX,
  HERO_NOROWAS,
] as const;

/** Array of Lost Legion expansion heroes */
export const LOST_LEGION_HEROES: readonly HeroId[] = [
  HERO_WOLFHAWK,
] as const;

/** Array of Krang expansion heroes */
export const KRANG_HEROES: readonly HeroId[] = [
  HERO_KRANG,
] as const;

/** Array of Shades of Tezla expansion heroes */
export const SHADES_OF_TEZLA_HEROES: readonly HeroId[] = [
  HERO_BRAEVALAR,
] as const;

/** All heroes (base + all expansions) */
export const ALL_HEROES: readonly HeroId[] = [
  ...BASE_HEROES,
  ...LOST_LEGION_HEROES,
  ...KRANG_HEROES,
  ...SHADES_OF_TEZLA_HEROES,
] as const;

/** Display names for heroes (for UI) */
export const HERO_NAMES: Record<HeroId, string> = {
  [HERO_ARYTHEA]: "Arythea",
  [HERO_TOVAK]: "Tovak",
  [HERO_GOLDYX]: "Goldyx",
  [HERO_NOROWAS]: "Norowas",
  [HERO_WOLFHAWK]: "Wolfhawk",
  [HERO_KRANG]: "Krang",
  [HERO_BRAEVALAR]: "Braevalar",
};

/** Flavor/lore text for hero detail surfaces. */
export interface HeroLore {
  title: string;
  flavorText: string;
}

export const HERO_LORE = {
  [HERO_ARYTHEA]: {
    title: "Arythea, the Blood Cultist",
    flavorText:
      "While the origins of The Breaking are shrouded in mystery, it is spoken in hushed whispers and knowing glances that it may have been the Blood Cultists who were responsible for the cataclysm and resulting chaos that ensued. Evidence exists that the Cultists were finally successful in their ancient quest to awaken the dark god Amara who repaid his followers by unleashing his might upon the land. Believed to be the strongest of the known Mage Knights, Arythea has emerged from the chaos more powerful than ever and she has gone forth spreading Amara's bloody gospel as she crushes her foes under her spiked heel. Under her leadership, the Blood Cultists have slipped the bonds of their former masters in the Dark Crusade and have become a power unto themselves; feared by many and respected by all. No one knows where Arythea will strike next but one thing is certain, the bloody god Amara has directed her to participate in the Council of the Void's plans and will be pleased with her conquests and the proliferation of his teachings.",
  },
  [HERO_TOVAK]: {
    title: "Tovak Wyrmstalker, Head of the Order of the Ninth Circle",
    flavorText:
      "The strongest presence left within the Order of the Ninth Circle, Tovak Wyrmstalker is less a leader of this new faction and more a force of nature to be respected and followed. Originally the Order of the Ninth Circle sold their swords in service to other factions, but under the strong hand of Tovak Wyrmstalker they have become a force unto themselves. The more established factions in the Land are certainly beginning to take notice of the Order's actions. The Mage Spawn that comprise the Order of the Ninth Circle are held together loosely by their common disdain for the self-proclaimed superiority that the other factions profess, and Tovak Wyrmstalker seeks nothing less than the total defeat of the other factions and their lofty aspirations of supremacy. After the sudden demise of the two previous heads of the Order, Tovak Wyrmstalker has embraced his new role as shepherd to the Order's cause and will not rest until all Mage Spawn are free to determine their own paths. That the Council of the Void's current plans are to conquer lands that oppress his people is all the better.",
  },
  [HERO_GOLDYX]: {
    title: "Goldyx, Mightiest of the Draconum",
    flavorText:
      "From the day they are hatched until the day they are killed, Draconum seek only two things; combat and evolution. As they wander the land, Draconum look for worthy opponents strong enough to challenge their brutally honed martial abilities with only one goal in mind; personal augmentation. Draconum have never been closely tied to any one faction and since The Breaking they are even more likely to distrust others, even their own kind. After undergoing the \"Surge\", the most powerful of Draconum evolutions, Goldyx has arisen as the mightiest of his kind. He seeks personal wealth and power and The Council of the Void has promised both beyond anything he had previously dreamed of. That his own brethren may get in his way in his current assignment only makes him more interested in the riches that lie ahead and the foes that are worthy of his attentions.",
  },
  [HERO_NOROWAS]: {
    title: "Norowas, Greatest of the Elf-Lords",
    flavorText:
      "Like all great Elven soldiers, Norowas spent centuries mastering the combat arts of both spell and sword. Prior to The Breaking, Norowas had bartered his influence with the Elvish Free Armies to consolidate a position on the High Elven Council, an organization dedicated to bringing their own brand of order to the realm by any means necessary. Norowas embraces these philosophies wholeheartedly and is not above utilizing destructive tactics to achieve his goals. His recent contact with the Council of the Void has steeled his determination that now is the time and the Council of the Void has the means for him to venture forth and bring an end to the chaos he sees throughout the land, without mercy or hesitation.",
  },
  [HERO_WOLFHAWK]: {
    title: "Wolfhawk",
    flavorText:
      "Orphaned as a child, Wolfhawk was raised by the greatest Amazon warriors of the Cainus Mons forests. She proved to have an exceptional talent for swordsmanship, joining Queen Corella's army at a young age. Her heroic deeds during the Battle of Nepharus Mons did not go unnoticed and soon she was promoted to Corella's personal guard. During the next few years, Wolfhawk became one of the queen's closest and most trusted companions. When Wolfhawk later became oathsworn to the mysterious Solonavi, some said it was on the orders of the queen herself. Whatever the reason, Wolfhawk began to set out alone on secret missions under the cover of night. She would go on months at a time, sometimes years. It was no wonder when no one questioned it when she disappeared during The Breaking. It was assumed she had died on one of her dangerous journeys. But now, she has returned as one of the Mage Knights. Deadlier and swifter than ever, her swords scythe through anyone getting in her way. What convinced the most loyal servant to abandon her queen and leave her oath to the Solonavi behind? We can only guess; Wolfhawk remains as silent, focused and solitary as she ever was.",
  },
  [HERO_KRANG]: {
    title: "Krang",
    flavorText:
      "Krang remembers little about the time before the breaking. Only flashes of memories, images, words here and there, and feelings of confusion and pain. There was the time he was a chaos shaman; the memory of the magestone dust entering his lungs still lingered. There were the words of the council of the void imploring him to give up those ways. Individually, the words were forgotten but collectively the argument was convincing, wasn't it? The painful memories of his purging certainly remain. He was fortunate however, as otherwise the breaking would have destroyed him. Very fortunate. In the years that followed, he was taught other magics by the best the council had to offer. The most was made of his powerful Orcish frame as his blunt but effective martial skills were perfected. Now he has been sent forth to bring order to the lands of the Atlantean Empire. He has turned his back on his Orcish brethren. His true nature has been disguised from locals with help from the council, masters of deceit and trickery. For the first time in years, he has a certainty within him. This he is sure about. This he can do.",
  },
  [HERO_BRAEVALAR]: {
    title: "Braevalar",
    flavorText:
      "Braevalar was a storm druid, a part of the Elementalists faction that is motivated by anger for those who ravage the land as much as by the desire to protect it. Disillusioned by the Elementalists' reluctance to take the fight to their enemies, Braevalar looked for another way. His search ended one night when a voice spoke to him from the darkness of the forest. It told him there was indeed another way for those with the will to do whatever it takes to defeat their enemies; the way of the Council of the Void. Although the training was hard, Braevalar never lacked determination. His cunning and knowledge of how to use the terrain around him were great assets, as were his powers over the natural world. Somewhere along the way, however, he lost sight of the importance of protecting nature and now his motivations are... unclear. He serves the Council.",
  },
} as const satisfies Record<HeroId, HeroLore>;
