import { useCallback, useMemo } from "react";
import { RESOLVE_TERRAIN_COST_REDUCTION_ACTION, UNDO_ACTION } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { PixiPieMenu, type PixiPieMenuItem } from "../CardActionMenu";

const TERRAIN_COLORS: Record<string, { fill: number; hover: number }> = {
  plains: { fill: 0x88aa44, hover: 0x99bb55 },
  hills: { fill: 0x8b6b3d, hover: 0xa07a4a },
  forest: { fill: 0x336622, hover: 0x447733 },
  wasteland: { fill: 0x665544, hover: 0x776655 },
  desert: { fill: 0xc4a64e, hover: 0xd4b65e },
  swamp: { fill: 0x445544, hover: 0x556655 },
  lake: { fill: 0x3366aa, hover: 0x4477bb },
  mountain: { fill: 0x777777, hover: 0x888888 },
};

const TERRAIN_LABELS: Record<string, string> = {
  plains: "Plains",
  hills: "Hills",
  forest: "Forest",
  wasteland: "Wasteland",
  desert: "Desert",
  swamp: "Swamp",
  lake: "Lake",
  mountain: "Mountain",
};

export function TerrainCostReductionOverlay() {
  const { state, sendAction } = useGame();

  const options =
    state?.validActions?.mode === "pending_terrain_cost_reduction"
      ? state.validActions.terrainCostReduction
      : undefined;

  const canUndo =
    state?.validActions?.mode === "pending_terrain_cost_reduction"
      ? state.validActions.turn.canUndo
      : false;

  useRegisterOverlay(!!options);

  const handleSelect = useCallback(
    (terrain: string) => {
      sendAction({
        type: RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
        terrain,
      });
    },
    [sendAction]
  );

  const handleUndo = useCallback(() => {
    sendAction({ type: UNDO_ACTION });
  }, [sendAction]);

  const pieItems: PixiPieMenuItem[] = useMemo(() => {
    if (!options) return [];

    return options.availableTerrains.map((terrain) => {
      const colors = TERRAIN_COLORS[terrain] ?? { fill: 0x666666, hover: 0x777777 };
      return {
        id: terrain,
        label: TERRAIN_LABELS[terrain] ?? terrain,
        sublabel: `Cost -${Math.abs(options.reduction)}`,
        color: colors.fill,
        hoverColor: colors.hover,
      };
    });
  }, [options]);

  if (!options) return null;

  return (
    <PixiPieMenu
      items={pieItems}
      onSelect={handleSelect}
      onCancel={canUndo ? handleUndo : () => {}}
      overlayOpacity={0.7}
      centerLabel={canUndo ? "Undo" : "Select\nTerrain"}
    />
  );
}
