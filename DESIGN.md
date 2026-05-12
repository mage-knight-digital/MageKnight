---
name: Mage Knight Client
description: Warm map-room shell via `:root` OKLCH tokens (`--surface-*`, `--text-*`, `--border-*`, `--accent*`) plus restrained parchment overlays; tactical clarity first.
colors:
  surface-ground: "oklch(0.21 0.012 78)"
  surface-canvas: "oklch(0.17 0.011 80)"
  surface-raised: "oklch(0.265 0.013 77)"
  surface-chrome: "oklch(0.195 0.012 79)"
  surface-hover-lift: "oklch(0.22 0.013 76)"
  text-primary-soft: "oklch(0.93 0.008 82)"
  text-muted-mid: "oklch(0.72 0.012 78)"
  text-muted-low: "oklch(0.58 0.014 76)"
  parchment-border-earth: "#5c4a3a"
  parchment-heading-gold: "#e8c476"
  parchment-body-cream: "#f0e6d2"
  combat-antique-gold: "#d4a574"
  combat-night-shell: "#1a1d2e"
  stat-level-amethyst: "#9b59b6"
  stat-fame-gold: "#f1c40f"
  stat-armor-slate: "#95a5a6"
  stat-influence-sky: "#3498db"
  accent-selection-ember: "oklch(0.74 0.085 72)"
  telemetry-teal-debug: "#4ecdc4"
  hero-token-ruby-glow: "#ff4444"
  setup-deep-oklch: "oklch(0.14 0.022 58)"
  setup-gold-oklch: "oklch(0.78 0.11 82)"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.85rem, 4.5vw, 2.65rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "0.14em"
  headline-section:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title-card:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body-reading:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label-dense-cap:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  caption-stat-micro:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  panel-chrome-base:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary-soft}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  overlay-sheet-base:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary-soft}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  reward-option-card-rest:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.text-primary-soft}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  reward-option-card-active:
    backgroundColor: "{colors.surface-hover-lift}"
    textColor: "{colors.text-primary-soft}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  chrome-top-strip:
    backgroundColor: "{colors.surface-chrome}"
    textColor: "{colors.text-primary-soft}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "{spacing.sm} {spacing.md}"
---

# Design System: Mage Knight Client

## Overview

**Creative North Star: "The Quiet Map Room"**

The client reads as **two coordinated families** rather than one flat token bundle. **Play chrome** (shell, hex cradle, panels, modal sheets, top bar, player bubbles) is authored as **warm low-chroma neutrals** in OKLCH on `:root` (`--surface-ground` → `--surface-raised`, `--surface-chrome`) so the perimeter feels like a **map table under soft light**, not cold violet midnight UI. Dedicated flows (setup, parchment-style rewards and level-ups, combat CSS notes and Pixi atmosphere) deliberately adopt **muted brass, earth borders, antiqued parchment cream text** so menu moments stay grounded without flashy fantasy chrome.

PRODUCT.md asks for clarity before spectacle and rejects dominant mystical cliché plus heroic bombast. The structural stack is intentionally **matte and legibility-first**; parchment and combat lanes remain episodic warmth. Going forward the goal is to **narrow drift**: reuse the shared `:root` tokens in new HUD before introducing screen-local hex.

The system rejects **looks-over-scanability** chrome: dense stat rows, multi-panel combat, solo cognitive load demand consistent hit targets and readable captions over flair.

**Key Characteristics:**
- **`--surface-canvas` / `--surface-ground` / `--surface-raised`** tier the Pixi hex board and card-like panels with a warm neutral spine.
- **Parchment-earth** overlays provide warm episodic containment without implying mystic gimmickery.
- **System UI sans** everywhere today: fast, predictable, slightly generic unless weight and letter-spacing cues mark titles.
- **Stat accent colors** intentionally flat and categorical (purple level icon legacy, teal only in debug-heavy replay tooling).
- **Motion** converges on **`--ease-out-expo`** for top bar intro (replacing historical overshoot easing) toward PRODUCT alignment.

## Colors

The palette separates **warm structural chrome** (shared `:root` surfaces, borders, text ramp) from **warm narrative shells** combat and parchment flows already use.

### Primary (CSS custom properties)

- **`--surface-ground`**: dominant app background wash (`body`); low-noise perimeter around the canvas.
- **`--surface-canvas`**: hex-grid container backdrop; darkest functional surface for tactical focus.
- **`--surface-raised`**: default `.panel` and `.overlay__content` interior fill.

These three anchors are authoritative for any new HUD element that wraps live game state unless a flow explicitly adopts the parchment or combat palettes below.

### Secondary

- **Antique Combat Gold** (#d4a574) and **Night Shell Indigo** (#1a1d2e): anchored in `CombatOverlay.css` commentary and mana chrome gradients; aligns CSS UI with Pixi-rendered battlefield atmosphere. Use for combat-adjacent affordances that must read clearly against illustrated backdrops rather than rewriting artwork.

### Tertiary

- **`--accent`** (selection lane, OKLCH): reward grids and affirmative interactive emphasis (hover/active borders); keep dosage low on large fills.

### Neutral

- **`--text-primary`**, **`--text-secondary`**, **`--text-muted`**, **`--text-faint`**: progressive de-emphasis on dark surfaces (audit pairs as surfaces evolve; target WCAG AA on core strings).
- **`--surface-chrome`**: condensed top HUD strip (`TopBar`); opaque matte bar (no violet translucency stack).
- **`--surface-hover-lift`**: hovered elevated cards on dark canvases without jumping to parchment.

### Parchment Overlay Family

- **Parchment Border Earth** (#5c4a3a), **Heading Gold** (#e8c476), **Body Cream** (#f0e6d2): `LevelUpRewardSelection.css`-style overlays; restrained warmth, tactile frames, faint inner highlights rather than gemstone glow.

### Named Rules

**The Two-Family Rule.** When adding a panel, declare whether it belongs to **map-room chrome** (`--surface-*` ladder) or **parchment session** overlays. Avoid inventing a third decorative stack per feature.

**The Stat Color Semantics Rule.** Reuse categorical stat hues (`stat-level-amethyst`, `stat-fame-gold`, `stat-armor-slate`, `stat-influence-sky`) wherever matching hero identity labels to reinforce recognition; do not recolor arbitrarily per screen.

**The OKLCH Setup Lane Rule.** `.setup-screen` uses nested OKLCH custom properties documented in-component; migrating those tokens onto `:root` is preferred long-term while keeping authored OKLCH as canonical for that lane (frontmatter exposes representative strings `setup-deep-oklch`, `setup-gold-oklch` alongside hex neighbors for tooling that demands sRGB literals).

## Typography

**Display Font:** System UI stack (same as BODY; no bespoke display face yet).

**Body Font:** system-ui / -apple-system / BlinkMacSystemFont / Segoe UI / sans-serif.

**Label / mono:** No monospace system defined; captions reuse sans at micro sizes.

**Character:** Practical, tabletop-tool plainspoken. Hierarchy is carved with **weight, letter-spacing**, and localized **uppercase cues** rather than ornate display typography.

### Hierarchy

- **Display** (700, clamp(1.85rem … 2.65rem), ~1.12 line height, tracked wide uppercase context on setup titles): ceremonial entry banners only where flow already established.
- **Headline Section** (600, `1.5rem`, compact): overlay titles (`reward-selection`, similar).
- **Title Card / Row** (`1rem`, 600): list leaders and affirmative actions embedded in overlays.
- **Body Reading** (400, `1rem`, relaxed line-height): explanatory copy targeting ≤75ch widths where prose appears.
- **Label Dense Cap** (~`0.85rem`, 600, capitalize transforms on hero identity lines): condensed HUD labels (top bar).
- **Caption Stat Micro** (~`0.65rem`, 500): inline numeric companions in multiplayer roster chips.

### Named Rules

**The System Spine Rule.** Until a purposeful display face is introduced, retain the single stack everywhere; differentiation is spacing and weight rather than pairing.

**The Legibility Spine Rule.** Never set long instructional copy smaller than Body Reading tokens; PRODUCT solo clarity depends on deliberate reading comfort.

## Elevation

Depth is conveyed mostly through **opaque surface tiering**, **thin neutral borders**, and **selective tonal lifts** (`--surface-hover-lift`, parchment inner highlights). True shadow stacks appear on parchment containers and richer interactive cards (`box-shadow` plus subtle inset rims on gold-forward affordances).

The global `.overlay` stacking context uses **`--scrim-overlay`** (warm-tinted scrim, not pure `#000`) to pull focus inward; overlays do not blur the live board unnecessarily (blur-based glass stacks are discouraged per PRODUCT restraint).

Shadow vocabulary is **split**: combat documentation enumerates illustrative fantasy-earth metals for Pixi cohesion; HUD chrome mostly stays matte.

### Shadow Vocabulary

- **Parchment Tray Shadow** (~`0 8px 32px rgba(0,0,0,0.6)` + inset hairline warmth): tactile framed reward panels (`LevelUpRewardSelection.css`).
- **Active Player Bloom** (~`0 0 10px rgba(241,196,15,0.35)` atop gold border `#f1c40f`): unmistakable solo-turn signal in player bubbles.

## Components

HUD and overlay primitives predominate; game-specific widgets (hands, carousel tracks) visually extend these tokens.

### Buttons / Selectable Tiles

- **Reward option cards**: `rounded.md`, `--surface-canvas` fill at rest, `--border-on-raised` border. Hover lifts background to `--surface-hover-lift`, border shifts to **`--accent`**, slight negative translate upward for tactile acknowledgment (budget motion conscientiously toward WCAG prefers-reduced-motion over time).

### Panels / Containers

- **Standard `.panel`** (global): `rounded.md`, `--surface-raised` fill, uniform `spacing.md`.
- **`.overlay__content`**: enlarged corner radius (`rounded.lg`), expanded padding (`spacing.xl`) for readability.

### Top Bar HUD

- **Height** ~36px, **opaque `--surface-chrome`** bar bridging board and OS chrome; faint bottom hairline (`--border-subtle`) divides context.
- **Stat icons**: flat categorical hues (purple level / armor slate / fame gold / blues) echo player chips for cross-surface reinforcement.

### Player Roster Chips

- **Passive**: softened translucent pill using `color-mix` on `--surface-chrome`, subdued `border-subtle` stroke.
- **Active**: thickened gold ring + restrained outer emphasis emphasizing turn ownership without triumphant orchestral embellishment elsewhere.

### Signature Overlays / Flows

- **Setup Surface**: Implements OKLCH gradient stack with `--ease-out-expo` easing for interactive pulses; aligns with DOCUMENTED intent to converge overlays toward map-table cohesion.
- **Combat Scene**: Transparency-first layout with Pixi painting atmosphere; localized gradient chips echo night palette `#1a1d2e` region.

## Do's and Don'ts

Ground every decision in PRODUCT.md clauses on clarity, subdued atmosphere, mystical/bombastic rejection, scanability mandates, WCAG AA forward posture, reduced motion empathy.

### Do:

- **Do** reuse the **`--surface-ground` → `--surface-canvas` → `--surface-raised`** tier ladder for new HUD unless a flow participates in parchment or combat palettes intentionally.
- **Do** cite **OKLCH setup tokens** or promote them upward when refactoring rather than cloning approximate hex anew.
- **Do** anchor combat-adjacent gold accents around **Antique Combat Gold** (#d4a574 family) documented alongside Pixi's illustrated layers.
- **Do** preserve **readable flat hierarchy** inside dense flows (solo cognitive load mandate).
- **Do** consolidate radii (`6px`, `8px`, `12px`) as the default scale before inventing orphan radii.
- **Do** plan audio direction **ambient grounded map energy** complementary to subdued UI contrasts ( INTERFACE NOT THE HERO ).
- **Do** implement future motion on **exponential ease-out curves** resembling setup's `--ease-out-expo`.

### Don't:

- **Don't** let **Dominant mystical fantasy cliché** (heavy rune shimmer, incense fog decorative noise) occlude authoritative engine-driven state readability.
- **Don't** soundtrack or visually stage **Epic heroic bombast**: overwrought triumphant framing contradicts restrained crunch-forward mood.
- **Don't** bury legibility under ornamental stacks that cause players to mistrust moves or LOS clarity (explicit PRODUCT anti-pattern on looks-over-scanability).
- **Don't** sprinkle **neon candy accent rainbows** arbitrarily; limit categorical color to semantic stat roles (+ intentional debug telemetry hues like teal in replay tooling isolated from default play overlays).
- **Don't** enlarge **glassmorphism + heavy blur layering** casually; tonal scrims suffice today.
- **Don't** widen **thin side-stripe brand gimmicks (`border-left > 1px colored`)** purely for sparkle; impeccable shared prohibition.
