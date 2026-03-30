import { useCallback, useMemo } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { PixiPieMenu, type PixiPieMenuItem } from "../CardActionMenu";
import { actionData } from "../../rust/types";
import { hasAction, findAction } from "../../rust/legalActionUtils";

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
  const { sendAction, legalActions } = useGame();
  const player = useMyPlayer();

  const isActive = player?.pending?.kind === "terrain_cost_reduction";

  // Extract terrain options from legal actions
  const terrainActions = useMemo(() => {
    if (!isActive) return [];
    return legalActions.filter(
      (a) => typeof a !== "string" && "ResolveTerrainCostReduction" in a
    );
  }, [isActive, legalActions]);

  const canUndo = hasAction(legalActions, "Undo");

  useRegisterOverlay(isActive);

  const handleSelect = useCallback(
    (terrain: string) => {
      const action = terrainActions.find(
        (a) => actionData(a)?.["terrain"] === terrain
      );
      if (action) sendAction(action);
    },
    [sendAction, terrainActions]
  );

  const handleUndo = useCallback(() => {
    const action = findAction(legalActions, "Undo");
    if (action) sendAction(action);
  }, [sendAction, legalActions]);

  const pieItems: PixiPieMenuItem[] = useMemo(() => {
    if (!isActive) return [];

    return terrainActions.map((a) => {
      const terrain = actionData(a)?.["terrain"] as string;
      const colors = TERRAIN_COLORS[terrain] ?? { fill: 0x666666, hover: 0x777777 };
      return {
        id: terrain,
        label: TERRAIN_LABELS[terrain] ?? terrain,
        sublabel: "Cost reduction",
        color: colors.fill,
        hoverColor: colors.hover,
      };
    });
  }, [isActive, terrainActions]);

  if (!isActive || terrainActions.length === 0) return null;

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
