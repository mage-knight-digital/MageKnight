import { HERO_NAMES, type HeroId } from "@mage-knight/shared";
import "./HotseatPassScreen.css";

interface HotseatPassScreenProps {
  readonly playerId: string;
  readonly hero?: HeroId;
  readonly onContinue: () => void;
}

export function HotseatPassScreen({
  playerId,
  hero,
  onContinue,
}: HotseatPassScreenProps) {
  const heroName = hero ? HERO_NAMES[hero] : "Next player";
  const seatLabel = playerId.replace("_", " ");

  return (
    <div className="hotseat-pass" role="dialog" aria-modal="true" aria-labelledby="hotseat-pass-title">
      <div className="hotseat-pass__panel">
        <p className="hotseat-pass__eyebrow">Hotseat handoff</p>
        <h2 id="hotseat-pass-title" className="hotseat-pass__title">
          Pass to {heroName}
        </h2>
        <p className="hotseat-pass__copy">
          Private cards stay covered until the next player is ready.
        </p>
        <div className="hotseat-pass__seat" aria-label={`Active seat ${seatLabel}`}>
          {seatLabel}
        </div>
        <button type="button" className="hotseat-pass__button" onClick={onContinue} autoFocus>
          Reveal turn
        </button>
      </div>
    </div>
  );
}
