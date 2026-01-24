/**
 * DisplayTab - Debug controls for visual display options
 *
 * Provides toggles for:
 * - Show hex coordinates on tiles
 */

import { useDebugDisplay } from "../../contexts/DebugDisplayContext";

export function DisplayTab() {
  const { settings, setShowCoordinates, setShowBoundaryEdges, setShowTileNames } = useDebugDisplay();

  return (
    <>
      <section className="debug-panel__section">
        <h4>Map Display</h4>
        <div className="debug-panel__row">
          <label className="debug-panel__checkbox-label">
            <input
              type="checkbox"
              checked={settings.showCoordinates}
              onChange={(e) => setShowCoordinates(e.target.checked)}
            />
            Show hex coordinates
          </label>
        </div>
        <div className="debug-panel__row">
          <label className="debug-panel__checkbox-label">
            <input
              type="checkbox"
              checked={settings.showBoundaryEdges}
              onChange={(e) => setShowBoundaryEdges(e.target.checked)}
            />
            Show boundary edge debug
          </label>
        </div>
        <div className="debug-panel__row">
          <label className="debug-panel__checkbox-label">
            <input
              type="checkbox"
              checked={settings.showTileNames}
              onChange={(e) => setShowTileNames(e.target.checked)}
            />
            Show tile names
          </label>
        </div>
      </section>
    </>
  );
}
