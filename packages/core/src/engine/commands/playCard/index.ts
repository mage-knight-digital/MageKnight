/**
 * Play card command modules
 *
 * Exports for the play card command and its helper modules.
 */

export {
  getChoiceOptions,
  handleChoiceEffect,
  type ChoiceHandlingResult,
} from "./choiceHandling.js";

export {
  handleArtifactDestruction,
  type ArtifactDestructionResult,
} from "./artifactDestruction.js";
