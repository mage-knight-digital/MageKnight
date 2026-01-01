/**
 * Branded ID types shared between client and server
 *
 * These are used in actions and events that flow between client and server.
 */

// Card IDs (action cards, artifact cards, spell cards, unit cards, wound cards)
export type CardId = string & { readonly __brand: "CardId" };

// Skill IDs
export type SkillId = string & { readonly __brand: "SkillId" };

// Basic mana colors (can be crystals)
export type BasicManaColor = "red" | "blue" | "green" | "white";

// All mana colors including special
export type ManaColor = BasicManaColor | "gold" | "black";
