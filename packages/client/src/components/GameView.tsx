import { useState, useCallback } from "react";
import { useGame } from "../hooks/useGame";
import { useMyPlayer } from "../hooks/useMyPlayer";
import { useGameIntro } from "../contexts/GameIntroContext";
import { useCinematic } from "../contexts/CinematicContext";
import { useOverlay, useRegisterOverlay } from "../contexts/OverlayContext";
import { UnifiedCardMenu } from "./CardInteraction";
import { WaitingOverlay } from "./WaitingOverlay";
import { PixiHexGrid } from "./GameBoard/PixiHexGrid";
import { ManaSourceOverlay } from "./GameBoard/ManaSourceOverlay";
import { TopBar } from "./TopBar";
import { TurnActions } from "./TurnActions";
import { PlayerHand } from "./Hand/PlayerHand";
import { ChoiceSelection } from "./Overlays/ChoiceSelection";
import { RewardSelection } from "./Overlays/RewardSelection";
import { ManaStealDecision } from "./Overlays/ManaStealDecision";
import { RethinkDecision } from "./Overlays/RethinkDecision";
import { MidnightMeditationDecision } from "./Overlays/MidnightMeditationDecision";
import { PreparationDecision } from "./Overlays/PreparationDecision";
import { SparingPowerDecision } from "./Overlays/SparingPowerDecision";
import { ManaSearchReroll } from "./Overlays/ManaSearchReroll";
import { GladeWoundDecision } from "./Overlays/GladeWoundDecision";
import { LevelUpRewardSelection } from "./Overlays/LevelUpRewardSelection";
import { CombatOverlay, PixiCombatOverlay } from "./Combat";
import { OfferView, type OfferPane } from "./OfferView";

export function GameView() {
  const { state } = useGame();
  const player = useMyPlayer();
  const { isIntroComplete } = useGameIntro();
  const { isInCinematic } = useCinematic();
  const { isOverlayActive } = useOverlay();
  const [isOfferViewVisible, setIsOfferViewVisible] = useState(false);
  const [offerViewInitialTab, setOfferViewInitialTab] = useState<OfferPane>("units");

  // Show combat overlay when in combat
  // Note: We check state.combat existence, not validActions.combat
  // validActions.combat may be undefined during choice resolution, but we still want
  // to show the combat scene (enemies, phase rail, etc.) while the player makes their choice
  const inCombat = state?.combat != null;

  // Register combat as an overlay to disable hex tooltips during combat
  useRegisterOverlay(inCombat);

  // Handle offer view state from PlayerHand
  const handleOfferViewChange = useCallback((isVisible: boolean) => {
    setIsOfferViewVisible(isVisible);
  }, []);

  // Handle closing offer view (from overlay click or S key in OfferView)
  const handleOfferViewClose = useCallback(() => {
    setIsOfferViewVisible(false);
  }, []);

  // Handle navigating to unit offer from SitePanel
  const handleNavigateToUnitOffer = useCallback(() => {
    setOfferViewInitialTab("units");
    setIsOfferViewVisible(true);
  }, []);

  // Handle navigating to spell offer from site actions
  const handleNavigateToSpellOffer = useCallback(() => {
    setOfferViewInitialTab("spells");
    setIsOfferViewVisible(true);
  }, []);

  if (!state) {
    return <div className="loading">Loading game state...</div>;
  }

  // Check if we're in tactic selection mode
  // Only dim the world after intro completes - don't dim during the theatrical reveal
  const isTacticSelectionActive = player && player.selectedTacticId === null && !!state.validActions.tactics;
  const shouldDimForTactics = isTacticSelectionActive && isIntroComplete;

  const appClassName = [
    "app",
    shouldDimForTactics && "app--tactic-selection",
    inCombat && "app--combat",
    isInCinematic && "app--cinematic",
    isOverlayActive && "app--overlay-active",
  ].filter(Boolean).join(" ");

  return (
    <div className={appClassName}>
      {/* Waiting overlay - shown when not player's turn */}
      <WaitingOverlay />

      {/* Overlays */}
      <UnifiedCardMenu />
      <ChoiceSelection />
      <RewardSelection />
      <LevelUpRewardSelection />
      <ManaStealDecision />
      <RethinkDecision />
      <MidnightMeditationDecision />
      <PreparationDecision />
      <SparingPowerDecision />
      <ManaSearchReroll />
      <GladeWoundDecision />
      {inCombat && (
        <>
          <PixiCombatOverlay combat={state.combat} />
          <CombatOverlay
            combat={state.combat}
            combatOptions={state.validActions.combat}
          />
        </>
      )}

      <TopBar />

      {/* Offer View - Inscryption-style offer display */}
      <OfferView isVisible={isOfferViewVisible} onClose={handleOfferViewClose} initialTab={offerViewInitialTab} />

      <main className="app__main">
        <div className="app__board">
          <PixiHexGrid
            onNavigateToUnitOffer={handleNavigateToUnitOffer}
            onNavigateToSpellOffer={handleNavigateToSpellOffer}
          />
          <ManaSourceOverlay />
        </div>
      </main>

      <PlayerHand onOfferViewChange={handleOfferViewChange} />
      <TurnActions />
    </div>
  );
}
