/**
 * HotkeyHelp - Modal overlay showing keyboard shortcuts
 */

import { useEffect } from "react";
import "./HotkeyHelp.css";

interface HotkeyHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HotkeyHelp({ isOpen, onClose }: HotkeyHelpProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="hotkey-help__overlay" onClick={onClose}>
      <div className="hotkey-help__modal" onClick={(e) => e.stopPropagation()}>
        <div className="hotkey-help__header">
          <h2 className="hotkey-help__title">Keyboard Shortcuts</h2>
          <button className="hotkey-help__close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="hotkey-help__content">
          <section className="hotkey-help__section">
            <h3 className="hotkey-help__section-title">View Modes</h3>
            <div className="hotkey-help__grid">
              <div className="hotkey-help__key">1</div>
              <div className="hotkey-help__desc">Focus view (large hand)</div>
              <div className="hotkey-help__key">2</div>
              <div className="hotkey-help__desc">Ready view (hand peeking)</div>
              <div className="hotkey-help__key">3</div>
              <div className="hotkey-help__desc">Map view (full map, hand hidden)</div>
              <div className="hotkey-help__key">4</div>
              <div className="hotkey-help__desc">Offers view (units, spells, advanced actions)</div>
            </div>
          </section>

          <section className="hotkey-help__section">
            <h3 className="hotkey-help__section-title">Hand Carousel</h3>
            <div className="hotkey-help__grid">
              <div className="hotkey-help__key">Q</div>
              <div className="hotkey-help__desc">Tactics pane</div>
              <div className="hotkey-help__key">W</div>
              <div className="hotkey-help__desc">Cards pane</div>
              <div className="hotkey-help__key">E</div>
              <div className="hotkey-help__desc">Units pane</div>
            </div>
          </section>

          <section className="hotkey-help__section">
            <h3 className="hotkey-help__section-title">Offers Carousel</h3>
            <div className="hotkey-help__grid">
              <div className="hotkey-help__key">Q</div>
              <div className="hotkey-help__desc">Unit offers</div>
              <div className="hotkey-help__key">W</div>
              <div className="hotkey-help__desc">Spell offers</div>
              <div className="hotkey-help__key">E</div>
              <div className="hotkey-help__desc">Advanced action offers</div>
            </div>
          </section>

          <section className="hotkey-help__section">
            <h3 className="hotkey-help__section-title">Camera</h3>
            <div className="hotkey-help__grid">
              <div className="hotkey-help__key">Arrow Keys</div>
              <div className="hotkey-help__desc">Pan camera</div>
              <div className="hotkey-help__key">Scroll</div>
              <div className="hotkey-help__desc">Zoom in/out</div>
              <div className="hotkey-help__key">Right-click drag</div>
              <div className="hotkey-help__desc">Pan camera</div>
            </div>
          </section>

          <section className="hotkey-help__section">
            <h3 className="hotkey-help__section-title">Actions</h3>
            <div className="hotkey-help__grid">
              <div className="hotkey-help__key">Ctrl+Z</div>
              <div className="hotkey-help__desc">Undo last action</div>
              <div className="hotkey-help__key">Esc</div>
              <div className="hotkey-help__desc">Close menus/dialogs</div>
            </div>
          </section>
        </div>

        <div className="hotkey-help__footer">
          Press <span className="hotkey-help__key hotkey-help__key--inline">Esc</span> or click outside to close
        </div>
      </div>
    </div>
  );
}
