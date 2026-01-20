# Mage Knight Tactic Cards Reference

Source: Images extracted from TTS Mod to `docs/sprites/tactics/`

Tactic cards determine turn order each Round. Lower numbers go first. Players select tactics during the Tactics phase at the start of each Round.

**Total: 12 Tactic Cards** (6 Day + 6 Night)

---

## Day Tactics

Day tactics have a golden/yellow color scheme.

| # | Name | Effect |
|---|------|--------|
| 1 | **Early Bird** | *(No special effect - just determines turn order)* |
| 2 | **Rethink** | When you take this Tactic, discard up to 3 cards (including Wounds) from your hand, then draw that many cards. Shuffle your discard pile back into your Deed deck. |
| 3 | **Mana Steal** | When you take this Tactic, take one mana die of a basic color from the Source and put it on this card. You can use that mana on any of your turns this Day. If you do, reroll it at the end of that turn and return it to the Source. |
| 4 | **Planning** | At the end of each turn, if you have at least two cards in your hand before you draw, draw as if your Hand limit is 1 higher. |
| 5 | **Great Start** | When you take this Tactic, immediately draw 2 cards. |
| 6 | **The Right Moment** | One time this Day during your turn, you can announce that you will take another turn immediately after this. If you do, flip this card face down. |

---

## Night Tactics

Night tactics have a gray/silver color scheme.

| # | Name | Effect |
|---|------|--------|
| 1 | **From The Dusk** | *(No special effect - just determines turn order)* |
| 2 | **Long Night** | One time this Night, if your Deed deck is empty, you may shuffle your discard pile and put 3 cards at random back into your Deed deck. Then flip this card face down. |
| 3 | **Mana Search** | Once per turn, before you use mana from the Source, you may reroll up to two mana dice in the Source. When choosing dice to reroll, you must pick gold (depleted) dice first, if there are any. |
| 4 | **Midnight Meditation** | One time this Night, before any of your turns, you may shuffle up to 5 cards (including Wounds) from your hand back into your Deed deck and then draw that many cards. Then, flip this card face down. |
| 5 | **Preparation** | When you take this Tactic, search your deck for any one card and put it in your hand, then shuffle your deck. |
| 6 | **Sparing Power** | Once before the start of each of your turns, choose one: Put the top card of your Deed deck face down under this card, or flip this card face down and put all Deed cards under it into your hand. |

---

## Turn Order Rules

- Lower tactic numbers go first (1 before 2 before 3, etc.)
- If tied, the player who didn't have initiative last round goes first
- Day tactics are used during Day rounds, Night tactics during Night rounds
- Each player must choose a different tactic (no duplicates in same round)

## Notes

- Tactics 1 (Early Bird / From The Dusk) have no special ability but guarantee going first
- Tactics 6 (The Right Moment / Sparing Power) give powerful effects but you go last
- Some tactics have one-time effects that flip the card face down after use
- Mana Steal (Day 3) and Mana Search (Night 3) both manipulate the Source

## Image Files

Located in `docs/sprites/tactics/`:
- `day_tactic_1.jpg` through `day_tactic_6.jpg`
- `night_tactic_1.jpg` through `night_tactic_6.jpg`
- `tactic_cards.json` - Metadata and Steam CDN URLs
