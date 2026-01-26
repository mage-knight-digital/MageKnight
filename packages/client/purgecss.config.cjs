/**
 * PurgeCSS configuration for detecting unused CSS.
 *
 * Run with: npx purgecss --config purgecss.config.js --rejected
 *
 * This config safelists dynamic classes that are constructed via template literals
 * and would otherwise be incorrectly flagged as unused.
 */
module.exports = {
  content: ["src/**/*.tsx", "src/**/*.ts"],
  css: ["src/**/*.css"],

  // Output rejected selectors for review
  rejected: true,

  safelist: {
    // Standard: exact matches or ending patterns
    standard: [],

    // Greedy: preserve selector if ANY part matches the pattern
    // Best for dynamically constructed classes like `class--${variable}`
    greedy: [
      // GameIcon sizes: game-icon--size-${size} where size is xs|sm|md|lg|xl
      /game-icon--size-/,

      // Mana token colors: combat-mana__token--${color}
      /combat-mana__token--/,

      // Mana crystal colors: combat-mana__crystal--${color}
      /combat-mana__crystal--/,

      // Top bar token colors: top-bar__token--${color}
      /top-bar__token--/,

      // View mode states: floating-hand--${viewMode} where viewMode is board|ready|focus
      /floating-hand--/,

      // Unit carousel view modes: floating-unit-carousel--${viewMode}
      /floating-unit-carousel--/,

      // Tactic carousel view modes: tactic-carousel--${viewMode}
      /tactic-carousel--/,

      // Carousel track modes: carousel-track--${mode}
      /carousel-track--/,

      // Combat HUD element colors: combat-hud__element--${element}
      /combat-hud__element--/,

      // Combat HUD attack type warning: combat-hud__attack-type--${state}
      /combat-hud__attack-type--/,

      // Site icon types: site-icon--${type}
      /site-icon--/,

      // Mana icon colors: mana-icon--${color}
      /mana-icon--/,

      // Crystal icon colors: crystal-icon--${color}
      /crystal-icon--/,

      // Ability icon types
      /ability-icon--/,

      // App state modifiers: app--${state}
      /app--/,

      // Top bar intro states
      /top-bar--intro-/,

      // End turn seal states
      /end-turn-seal--/,
    ],

    // Deep: preserve selector AND all its children if pattern matches
    deep: [],
  },
};
