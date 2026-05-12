# Product

## Register

product

## Users

**Primary:** Solo players learning or playing Mage Knight digitally. Often at a pace where clarity and comprehension matter more than spectacle.

**Secondary:** Small groups playing together with friends, where the UI still needs to keep rules and board state honest.

Sessions are mentally demanding: hex map, hands, overlays, phases. Attention is scarce; ambiguity is frustrating.

## Product Purpose

Ship a trustworthy digital Mage Knight surface so people **understand what happened**, **trust the rules engine**, and walk away feeling they had **a satisfying, crunchy tactical session** rather than wrestling the tool.

Spectacle may grow later ( richer presentation, richer audio, conceivably more dimensional assets ), but the product succeeds on **legibility**, **faithfulness**, and **flow** first.

## Brand Personality

**Three words:** clear, restrained, tactile.

Voice and tone skew **quiet confidence**: the game provides the stakes; the interface does not shout over it. Atmospheric touches are welcome when they support focus ( ambient, map-table energy ), not when they overwhelm state or pacing.

## Anti-references

- **Dominant mystical fantasy cliché.** Overwrought shimmering runes, heavy mystic glow, incense-and-prophecy vibes as primary dressing. Mechanics and board truth stay front and center.
- **Epic heroic bombast.** Big ta-daa orchestral energy, triumphant swords-and-glory framing that fights a thinking-heavy tabletop brain space.
- Interfaces that prioritize **looks over scanability**, so players second-guess legality or state.

Concrete positive north star on mood ( not a mandate to clone ): **Inscryption**-style map **ambient**, **grounded**, **less is more**. Horror is irrelevant; subdued presence and cohesion over spectacle are the takeaway.

## Design Principles

1. **Clarity before spectacle.** Readable, flat-ish information hierarchy in play; embellishment earns its place only if it never obscures state.
2. **The engine is canonical.** Players should never wonder whether the UI matches the Rust rules layer. Surprise belongs to the board game, not to bugs or ambiguous labels.
3. **Crunch is the delight.** Satisfaction comes from tactical depth and good feedback loops, not from UI yelling that you are heroic.
4. **Atmosphere serves focus.** Sound and motion stay **ambient or minimal** unless a beat truly marks a meaningful transition. Avoid heroic fanfare defaults.
5. **Solo usability is non-negotiable.** Flows assume one person holding full cognitive load unless multi-player affordances explicitly apply.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA** on core readability: text contrast, interactive targets where feasible ( especially touch-adjacent or dense panels ), predictable focus paths for modal-style overlays when implemented systematically.
- **Reduced motion:** respect `prefers-reduced-motion` for non-essential animation and cinematics as those systems mature.
