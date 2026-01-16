# Ticket: Site Interaction UI System

**Created:** January 2025
**Priority:** High
**Complexity:** Medium-Large
**Affects:** Client UI, Valid Actions, Site System
**Status:** Phase 1-3 Complete (Basic Implementation)

---

## Problem Statement

There is no UI for players to interact with sites. Players cannot:

1. **See what a site does** — No tooltips or info panels for sites
2. **Enter adventure sites voluntarily** — Dungeons, tombs, etc. require explicit action but have no button/menu
3. **Know about passive effects** — Crystal mines, magical glades give end-of-turn bonuses but nothing indicates this
4. **Understand available options** — Villages can heal, monasteries can train, but there's no discoverable UI

Currently, the only working site interactions are:
- Recruiting units (via Offers Bar, if you know to look there)
- Forced combat (walking into unsafe hexes triggers combat automatically)

---

## Design Goals

Following patterns from **Fire Emblem**, **Slay the Spire**, **XCOM**, and **Civilization**:

1. **Contextual actions appear when relevant** — Don't show site options when not at a site
2. **Clear visual feedback** — Know what will happen before you commit
3. **Consistent patterns** — Reuse existing PieMenu component
4. **Non-intrusive** — Don't block gameplay when no decision needed
5. **Discoverable** — New players can learn what sites do

---

## Proposed Solution: Hex Context Menu

### Core Concept

When a player's movement ends on a hex with actionable options, a **context menu** appears showing available actions. This reuses the existing `PieMenu` component.

### User Flow

```
Player moves to tomb hex
    ↓
Movement animation completes
    ↓
HexContextMenu auto-appears (if hex has options)
    ↓
┌─────────────────────────────┐
│     [TOMB icon/image]       │  ← Center shows site info
│     Unconquered             │
├─────────────────────────────┤
│  ⚔️ ENTER TOMB              │  ← Primary action
│    Fight 2 Draconum         │
│    Night rules, no units    │
│    Reward: Spell + Artifact │
├─────────────────────────────┤
│  ⏹ STAY HERE                │  ← Dismiss menu, keep move points
├─────────────────────────────┤
│  ⏭ END TURN                 │  ← End turn on this hex
└─────────────────────────────┘
```

### When Context Menu Appears

| Condition | Show Menu? | Notes |
|-----------|------------|-------|
| On adventure site (dungeon, tomb, etc.) | ✅ Yes | Shows "Enter" option |
| On inhabited site (village, monastery) | ✅ Yes | Shows "Interact" options |
| On mine/glade with end-of-turn effect | ⚠️ Maybe | Show passive indicator instead? |
| On conquered site with no actions | ❌ No | Nothing to do |
| Player still has move points | ✅ Yes | Include "Continue Moving" option |
| Player has no valid actions | ❌ No | Nothing to show |

### Menu Dismissal

- Clicking outside menu = dismiss (stay on hex)
- Clicking center = dismiss (same as outside)
- Clicking action = execute action
- ESC key = dismiss

---

## Implementation Plan

### Phase 1: Expand SiteOptions in ValidActions

**Goal:** Server provides rich site info for client to display.

#### 1.1 Update Types (`packages/shared/src/types/validActions.ts`)

```typescript
export interface SiteOptions {
  /** The site type (for icon/theming) */
  readonly siteType: SiteType;

  /** Display name for the site */
  readonly siteName: string;

  /** Whether this site has been conquered */
  readonly isConquered: boolean;

  /** Who owns this site (if conquered) */
  readonly owner: string | null;

  /** Can enter this site as an action (adventure sites) */
  readonly canEnter: boolean;

  /** Description of what entering does */
  readonly enterDescription?: string;

  /** Combat restrictions when entering */
  readonly enterRestrictions?: {
    readonly nightManaRules: boolean;
    readonly unitsAllowed: boolean;
  };

  /** Reward description for conquering */
  readonly conquestReward?: string;

  /** Can interact with this site (inhabited sites) */
  readonly canInteract: boolean;

  /** Interaction options */
  readonly interactOptions?: InteractOptions;

  /** Passive effect that triggers at end of turn */
  readonly passiveEffect?: string;
}

export interface InteractOptions {
  /** Can buy healing here */
  readonly canHeal: boolean;
  /** Influence cost per healing point */
  readonly healCost?: number;
  /** Can recruit units here */
  readonly canRecruit: boolean;
  /** Can buy spells here (conquered Mage Tower) */
  readonly canBuySpells: boolean;
  /** Can buy advanced actions here (Monastery) */
  readonly canBuyAdvancedActions: boolean;
}
```

#### 1.2 Create `getSiteOptions()` Function (`packages/core/src/engine/validActions/sites.ts`)

```typescript
export function getSiteOptions(
  state: GameState,
  player: Player
): SiteOptions | undefined {
  if (!player.position) return undefined;

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site) return undefined;

  const site = hex.site;
  const props = SITE_PROPERTIES[site.type];

  // Determine if can enter (adventure sites)
  const canEnter = props.adventureSite &&
    !player.hasTakenActionThisTurn &&
    (site.type === SiteType.Dungeon || site.type === SiteType.Tomb ||
     !site.isConquered || hasEnemies(hex));

  // Build enter description
  const enterDescription = canEnter
    ? getEnterDescription(site.type, site.isConquered)
    : undefined;

  // Combat restrictions
  const enterRestrictions = canEnter &&
    (site.type === SiteType.Dungeon || site.type === SiteType.Tomb)
    ? { nightManaRules: true, unitsAllowed: false }
    : undefined;

  // Conquest reward
  const conquestReward = !site.isConquered
    ? getConquestRewardDescription(site.type)
    : undefined;

  // Interaction options (inhabited sites)
  const canInteract = props.inhabited &&
    (site.isConquered || !props.fortified);

  const interactOptions = canInteract
    ? getInteractOptions(state, player, site)
    : undefined;

  // Passive effects
  const passiveEffect = getPassiveEffectDescription(site.type, hex);

  return {
    siteType: site.type,
    siteName: getSiteName(site.type),
    isConquered: site.isConquered,
    owner: site.owner,
    canEnter,
    enterDescription,
    enterRestrictions,
    conquestReward,
    canInteract,
    interactOptions,
    passiveEffect,
  };
}

function getEnterDescription(siteType: SiteType, isConquered: boolean): string {
  switch (siteType) {
    case SiteType.Dungeon:
      return isConquered
        ? "Fight 1 brown enemy (fame only)"
        : "Fight 2 brown enemies";
    case SiteType.Tomb:
      return isConquered
        ? "Fight 1 red enemy (fame only)"
        : "Fight 2 Draconum";
    case SiteType.MonsterDen:
      return "Fight the monster";
    case SiteType.SpawningGrounds:
      return "Fight 2 monsters";
    case SiteType.AncientRuins:
      return "Explore the ruins";
    // ... etc
  }
}

function getConquestRewardDescription(siteType: SiteType): string | undefined {
  switch (siteType) {
    case SiteType.Dungeon:
      return "Spell or Artifact (die roll)";
    case SiteType.Tomb:
      return "Spell + Artifact";
    case SiteType.MonsterDen:
      return "2 Crystal Rolls";
    case SiteType.SpawningGrounds:
      return "Artifact + 3 Crystal Rolls";
    case SiteType.MageTower:
      return "Spell";
    // ... etc
  }
}

function getPassiveEffectDescription(
  siteType: SiteType,
  hex: HexState
): string | undefined {
  switch (siteType) {
    case SiteType.Mine:
      const color = hex.mineColor; // Need to add this to HexState
      return `End turn: +1 ${color} Crystal`;
    case SiteType.DeepMine:
      return "End turn: Choose crystal color";
    case SiteType.MagicalGlade:
      return "End turn: Discard 1 Wound";
    default:
      return undefined;
  }
}
```

#### 1.3 Wire into `computeValidActions()` (`packages/core/src/engine/validActions/index.ts`)

```typescript
// Replace: sites: undefined, // TODO Phase 6: getSiteOptions(state, player)
// With:
sites: getSiteOptions(state, player),
```

---

### Phase 2: Create HexContextMenu Component

**Goal:** Display context menu when player is on a hex with options.

#### 2.1 Create Component (`packages/client/src/components/HexContextMenu/HexContextMenu.tsx`)

```typescript
import { useMemo } from "react";
import { PieMenu, PieMenuItem } from "../CardActionMenu/PieMenu";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { ENTER_SITE_ACTION, END_TURN_ACTION } from "@mage-knight/shared";
import "./HexContextMenu.css";

interface HexContextMenuProps {
  /** Position to render the menu (screen coordinates) */
  position: { x: number; y: number };
  /** Called when menu should close */
  onClose: () => void;
}

export function HexContextMenu({ position, onClose }: HexContextMenuProps) {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  const siteOptions = state?.validActions.sites;

  // Build menu items from site options
  const menuItems = useMemo<PieMenuItem[]>(() => {
    if (!siteOptions) return [];

    const items: PieMenuItem[] = [];

    // Enter site action (adventure sites)
    if (siteOptions.canEnter) {
      const restrictions = siteOptions.enterRestrictions;
      let sublabel = siteOptions.enterDescription ?? "";
      if (restrictions) {
        const parts: string[] = [];
        if (restrictions.nightManaRules) parts.push("Night rules");
        if (!restrictions.unitsAllowed) parts.push("No units");
        if (parts.length > 0) {
          sublabel += ` (${parts.join(", ")})`;
        }
      }

      items.push({
        id: "enter",
        label: `Enter ${siteOptions.siteName}`,
        sublabel,
        icon: "⚔️",
        color: "rgba(180, 60, 60, 0.9)", // Combat red
      });

      // Show reward as separate info item (disabled)
      if (siteOptions.conquestReward) {
        items.push({
          id: "reward-info",
          label: "Reward",
          sublabel: siteOptions.conquestReward,
          icon: "🏆",
          color: "rgba(180, 150, 50, 0.7)",
          disabled: true,
        });
      }
    }

    // Interact options (inhabited sites)
    if (siteOptions.canInteract && siteOptions.interactOptions) {
      const opts = siteOptions.interactOptions;

      if (opts.canRecruit) {
        items.push({
          id: "recruit",
          label: "Recruit",
          sublabel: "View available units",
          icon: "👥",
          color: "rgba(60, 120, 180, 0.9)",
        });
      }

      if (opts.canHeal && opts.healCost) {
        items.push({
          id: "heal",
          label: "Heal",
          sublabel: `${opts.healCost} Influence per wound`,
          icon: "💚",
          color: "rgba(60, 180, 60, 0.9)",
        });
      }

      if (opts.canBuySpells) {
        items.push({
          id: "buy-spell",
          label: "Buy Spell",
          sublabel: "7 Influence + matching mana",
          icon: "✨",
          color: "rgba(120, 60, 180, 0.9)",
        });
      }

      if (opts.canBuyAdvancedActions) {
        items.push({
          id: "buy-aa",
          label: "Buy Training",
          sublabel: "6 Influence",
          icon: "📜",
          color: "rgba(180, 120, 60, 0.9)",
        });
      }
    }

    // Always show "Stay Here" option
    items.push({
      id: "stay",
      label: "Stay Here",
      icon: "⏹",
      color: "rgba(80, 80, 90, 0.9)",
    });

    // End Turn option (if valid)
    if (state?.validActions.turn?.canEndTurn) {
      items.push({
        id: "end-turn",
        label: "End Turn",
        sublabel: siteOptions.passiveEffect,
        icon: "⏭",
        color: "rgba(60, 60, 70, 0.9)",
      });
    }

    return items;
  }, [siteOptions, state?.validActions.turn?.canEndTurn]);

  const handleSelect = (id: string) => {
    switch (id) {
      case "enter":
        sendAction({ type: ENTER_SITE_ACTION });
        break;
      case "recruit":
        // Open offers bar to units tab
        // TODO: Need to add this functionality
        break;
      case "heal":
        // TODO: Implement healing UI
        break;
      case "buy-spell":
        // Open offers bar to spells tab
        break;
      case "buy-aa":
        // Open offers bar to AA tab
        break;
      case "end-turn":
        sendAction({ type: END_TURN_ACTION });
        break;
      case "stay":
      default:
        // Just close the menu
        break;
    }
    onClose();
  };

  // Don't render if no site options or no actionable items
  if (!siteOptions || menuItems.length === 0) {
    return null;
  }

  // Center content shows site info
  const centerContent = (
    <div className="hex-context-menu__center">
      <div className="hex-context-menu__site-icon">
        {getSiteIcon(siteOptions.siteType)}
      </div>
      <div className="hex-context-menu__site-name">
        {siteOptions.siteName}
      </div>
      {siteOptions.isConquered && (
        <div className="hex-context-menu__conquered">
          Conquered
        </div>
      )}
    </div>
  );

  return (
    <div
      className="hex-context-menu__overlay"
      onClick={onClose}
    >
      <div
        className="hex-context-menu__container"
        style={{
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -50%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <PieMenu
          items={menuItems}
          onSelect={handleSelect}
          onCancel={onClose}
          centerContent={centerContent}
          size={400}
          innerRadius={0.35}
        />
      </div>
    </div>
  );
}

function getSiteIcon(siteType: SiteType): string {
  // Return emoji or could be sprite reference
  const icons: Record<SiteType, string> = {
    [SiteType.Dungeon]: "🏚️",
    [SiteType.Tomb]: "⚰️",
    [SiteType.MonsterDen]: "🕳️",
    [SiteType.SpawningGrounds]: "🪺",
    [SiteType.AncientRuins]: "🏛️",
    [SiteType.Village]: "🏘️",
    [SiteType.Monastery]: "⛪",
    [SiteType.Keep]: "🏰",
    [SiteType.MageTower]: "🗼",
    [SiteType.Mine]: "⛏️",
    [SiteType.MagicalGlade]: "🌳",
    // ... etc
  };
  return icons[siteType] ?? "📍";
}
```

#### 2.2 Create Styles (`packages/client/src/components/HexContextMenu/HexContextMenu.css`)

```css
.hex-context-menu__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  /* Semi-transparent backdrop */
  background: rgba(0, 0, 0, 0.3);
}

.hex-context-menu__container {
  position: absolute;
}

.hex-context-menu__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.hex-context-menu__site-icon {
  font-size: 2rem;
}

.hex-context-menu__site-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.hex-context-menu__conquered {
  font-size: 0.7rem;
  color: #8f8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

### Phase 3: Integrate with HexGrid

**Goal:** Show context menu after movement ends on actionable hex.

#### 3.1 Add State to HexGrid

```typescript
// In HexGrid.tsx
const [showContextMenu, setShowContextMenu] = useState(false);
const [contextMenuPosition, setContextMenuPosition] = useState<{x: number, y: number} | null>(null);
```

#### 3.2 Trigger Menu After Animation

```typescript
// In handleAnimationComplete callback
const handleAnimationComplete = useCallback(() => {
  // ... existing path animation logic ...

  if (nextIndex >= path.length) {
    // Animation complete
    setIsAnimating(false);
    // ... existing cleanup ...

    // Check if we should show context menu
    if (state?.validActions.sites) {
      // Calculate screen position from player's hex
      const hexPos = hexToPixel(player.position);
      // Convert SVG coords to screen coords (may need adjustment)
      setContextMenuPosition({ x: hexPos.x, y: hexPos.y });
      setShowContextMenu(true);
    }
  }
  // ...
}, [sendAction, state?.validActions.sites, player?.position]);
```

#### 3.3 Render Context Menu

```tsx
// At end of HexGrid render
return (
  <>
    <svg ...>
      {/* existing hex rendering */}
    </svg>

    {showContextMenu && contextMenuPosition && (
      <HexContextMenu
        position={contextMenuPosition}
        onClose={() => setShowContextMenu(false)}
      />
    )}
  </>
);
```

#### 3.4 Handle ESC Key

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && showContextMenu) {
      setShowContextMenu(false);
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [showContextMenu]);
```

---

### Phase 4: Hex Hover Tooltip (Future Enhancement)

**Goal:** Show site info on hover, before player moves there.

This is lower priority but builds on Phase 1's `SiteOptions` data:

```typescript
// HexTooltip.tsx - Shows on hex hover
interface HexTooltipProps {
  hex: HexState;
  position: { x: number; y: number };
}

export function HexTooltip({ hex, position }: HexTooltipProps) {
  if (!hex.site) return null;

  return (
    <div className="hex-tooltip" style={{ left: position.x, top: position.y }}>
      <div className="hex-tooltip__name">{getSiteName(hex.site.type)}</div>
      <div className="hex-tooltip__status">
        {hex.site.isConquered ? "Conquered" : "Unconquered"}
      </div>
      {hex.enemies.length > 0 && (
        <div className="hex-tooltip__enemies">
          {hex.enemies.length} {hex.enemies.length === 1 ? "enemy" : "enemies"}
        </div>
      )}
    </div>
  );
}
```

---

## Testing Plan

### Unit Tests

#### `packages/core/src/engine/validActions/__tests__/sites.test.ts`

```typescript
describe("getSiteOptions", () => {
  describe("adventure sites", () => {
    it("should return canEnter=true for unconquered dungeon");
    it("should return canEnter=true for conquered dungeon (fame grinding)");
    it("should return canEnter=false if hasTakenActionThisTurn");
    it("should include nightManaRules for dungeon/tomb");
    it("should include conquestReward description");
  });

  describe("inhabited sites", () => {
    it("should return canInteract=true for village");
    it("should return canHeal with correct cost for village (3)");
    it("should return canHeal with correct cost for monastery (2)");
    it("should return canRecruit=true when units available");
    it("should return canBuySpells=true for conquered mage tower");
  });

  describe("passive effects", () => {
    it("should return passiveEffect for mine");
    it("should return passiveEffect for magical glade");
    it("should return undefined for sites without passive effects");
  });
});
```

### Component Tests

#### `packages/client/src/components/HexContextMenu/__tests__/HexContextMenu.test.tsx`

```typescript
describe("HexContextMenu", () => {
  it("renders menu items based on siteOptions");
  it("shows Enter option for adventure sites");
  it("shows Recruit option for inhabited sites with canRecruit");
  it("shows conquest reward as disabled info item");
  it("always shows Stay Here option");
  it("calls sendAction(ENTER_SITE_ACTION) when Enter clicked");
  it("calls onClose when Stay Here clicked");
  it("calls onClose when clicking overlay");
});
```

### E2E Tests

#### `e2e/site-interaction.spec.ts`

```typescript
test.describe("Site Interaction", () => {
  test("shows context menu when moving to dungeon", async ({ page }) => {
    // Set up game with player adjacent to dungeon
    // Move to dungeon hex
    // Verify context menu appears
    // Verify "Enter Dungeon" option visible
  });

  test("entering dungeon starts combat", async ({ page }) => {
    // Move to dungeon
    // Click "Enter Dungeon" in context menu
    // Verify combat starts
    // Verify 2 brown enemies
  });

  test("can dismiss context menu without acting", async ({ page }) => {
    // Move to dungeon
    // Click "Stay Here"
    // Verify menu closes
    // Verify still on dungeon hex
    // Verify can still move (if move points remain)
  });

  test("shows passive effect for mine", async ({ page }) => {
    // Move to mine hex
    // Verify context menu shows crystal type
    // Verify End Turn option mentions crystal gain
  });
});
```

---

## Implementation Order

1. **Expand `SiteOptions` type** (shared) — 30 min
2. **Create `getSiteOptions()` function** (core) — 1-2 hours
3. **Wire into `computeValidActions()`** (core) — 15 min
4. **Create `HexContextMenu` component** (client) — 2-3 hours
5. **Integrate with `HexGrid`** (client) — 1 hour
6. **Add ESC key handling** (client) — 15 min
7. **Style the menu** (client) — 1 hour
8. **Write unit tests** — 1 hour
9. **Write E2E tests** — 1 hour

**Total estimated effort:** 8-10 hours

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Move through site without stopping | No menu (menu only on movement end) |
| Site with no valid actions | No menu appears |
| Already in combat | No menu (combat UI takes precedence) |
| Pending choice | No menu (choice overlay takes precedence) |
| Multiple players on hex | Each sees their own valid actions |
| Conquered site, no re-entry allowed | canEnter=false, may still show interact options |
| Movement ends but player clicked elsewhere | Menu should not appear if new action queued |

---

## Future Enhancements

1. **Hex hover tooltip** — Show site name/status before moving
2. **Site sprites in menu center** — Replace emoji with actual game art
3. **Animated menu entrance** — Smooth fade/scale in
4. **Sound effects** — Click sounds for menu actions
5. **Keyboard navigation** — Arrow keys to select menu items
6. **Touch support** — Long-press on hex to show info

---

## Dependencies

- Existing `PieMenu` component (no changes needed)
- `ENTER_SITE_ACTION` already implemented
- `SiteType` enum and `SITE_PROPERTIES` already exist
- Movement animation system already working

---

## Acceptance Criteria

- [ ] `SiteOptions` type expanded with full site info
- [ ] `getSiteOptions()` returns correct options for all site types
- [ ] Context menu appears after moving to actionable site
- [ ] Menu shows correct actions based on site type
- [ ] "Enter" action triggers `ENTER_SITE_ACTION` and starts combat
- [ ] "Stay Here" dismisses menu without action
- [ ] "End Turn" works from context menu
- [ ] ESC key dismisses menu
- [ ] Clicking outside menu dismisses it
- [ ] Menu doesn't appear during combat or pending choices
- [ ] All unit tests pass
- [ ] All E2E tests pass

---

## Related Tickets

- `challenge-rampaging-enemies.md` — Similar pattern for combat initiation UI
- `unit-combat-integration.md` — Units in combat (disabled for dungeon/tomb)
- `async-reward-selection.md` — Reward selection after conquest

---

## Notes

The context menu pattern established here can be reused for:
- Challenging rampaging enemies (similar pie menu with enemy selection)
- PvP combat initiation
- Volkare encounter options
- Any future hex-based actions
