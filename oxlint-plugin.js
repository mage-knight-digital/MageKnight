/**
 * Custom oxlint JavaScript plugin for Mage Knight codebase.
 *
 * Replaces all ESLint `no-restricted-syntax` rules for dramatically faster linting.
 * See each rule for the original ESLint selector it replaces.
 */

// Regex patterns for matching magic strings
const SCREAMING_CASE = /^[A-Z][A-Z0-9_]*$/;
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

// Helper to check if a node is a string literal matching a pattern
function isLiteralMatching(node, pattern) {
  if (!node) return false;
  if (node.type === "Literal" && typeof node.value === "string") {
    return pattern.test(node.value);
  }
  // Handle `as const` expressions: TSAsExpression wrapping a Literal
  if (node.type === "TSAsExpression" && node.expression?.type === "Literal") {
    return pattern.test(node.expression.value);
  }
  return false;
}

// Helper to get the literal value from a node (handles TSAsExpression)
function getLiteralValue(node) {
  if (!node) return null;
  if (node.type === "Literal") return node.value;
  if (node.type === "TSAsExpression" && node.expression?.type === "Literal") {
    return node.expression.value;
  }
  return null;
}

// Helper to check if node is a MemberExpression with a specific property name
function isMemberWithProperty(node, propName) {
  return (
    node?.type === "MemberExpression" &&
    node.property?.type === "Identifier" &&
    node.property.name === propName
  );
}

// Helper to get filename from context
function getFilename(context) {
  return context.filename || context.getFilename?.() || "";
}

// Helper to check if we're in a specific file
function isInFile(context, patterns) {
  const filename = getFilename(context);
  if (typeof patterns === "string") patterns = [patterns];
  return patterns.some((p) => filename.includes(p));
}

// Helper to check if we're NOT in test files
function isNotInTests(context) {
  const filename = getFilename(context);
  return !filename.includes("__tests__") && !filename.includes(".test.");
}

// =============================================================================
// RULE: no-magic-event-types
// Prevents string-literal event types in `events: [{ type: "..." }]` payloads
// =============================================================================
const noMagicEventTypes = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow string-literal event types in events payloads",
    },
  },
  create(context) {
    return {
      Property(node) {
        // Check: Property[key.name="type"] inside ObjectExpression inside ArrayExpression
        // where the ArrayExpression is the value of Property[key.name="events"]
        if (
          node.key?.type === "Identifier" &&
          node.key.name === "type" &&
          isLiteralMatching(node.value, SCREAMING_CASE)
        ) {
          // Walk up: Property -> ObjectExpression -> ArrayExpression -> Property[key.name="events"]
          const objectExpr = node.parent;
          if (objectExpr?.type !== "ObjectExpression") return;

          const arrayExpr = objectExpr.parent;
          if (arrayExpr?.type !== "ArrayExpression") return;

          const eventsProperty = arrayExpr.parent;
          if (
            eventsProperty?.type === "Property" &&
            eventsProperty.key?.type === "Identifier" &&
            eventsProperty.key.name === "events"
          ) {
            context.report({
              node,
              message:
                'Do not use string-literal event types in `events` payloads. Import an exported constant (e.g. `TILE_REVEALED`) or use a `create*Event(...)` helper from `@mage-knight/shared`.',
            });
          }
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-command-types
// Prevents string-literal command types in return statements
// =============================================================================
const noMagicCommandTypes = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow string-literal command types in return statements",
    },
  },
  create(context) {
    return {
      ReturnStatement(node) {
        // ReturnStatement > ObjectExpression > Property[key.name="type"]
        const objectExpr = node.argument;
        if (objectExpr?.type !== "ObjectExpression") return;

        for (const prop of objectExpr.properties || []) {
          if (
            prop.type === "Property" &&
            prop.key?.type === "Identifier" &&
            prop.key.name === "type" &&
            isLiteralMatching(prop.value, SCREAMING_CASE)
          ) {
            context.report({
              node: prop,
              message:
                'Do not use string-literal command types. Import a constant from `packages/core/src/engine/commands/commandTypes.ts`.',
            });
          }
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-validation-codes
// Prevents string-literal validation codes in `invalid(...)` calls
// =============================================================================
const noMagicValidationCodes = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow string-literal validation codes in invalid() calls",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // CallExpression[callee.name="invalid"]
        if (
          node.callee?.type === "Identifier" &&
          node.callee.name === "invalid" &&
          node.arguments?.length > 0
        ) {
          const firstArg = node.arguments[0];
          if (isLiteralMatching(firstArg, SCREAMING_CASE)) {
            context.report({
              node: firstArg,
              message:
                'Do not use string-literal validation codes in `invalid(...)`. Import a constant from `packages/core/src/engine/validators/validationCodes.ts`.',
            });
          }
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-mana-any
// Prevents comparing effect.color to "any" literal
// =============================================================================
const noMagicManaAny = {
  meta: {
    type: "problem",
    docs: {
      description: 'Disallow comparing effect.color to "any" string literal',
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") return;

        const { left, right } = node;

        // Check both directions: .color === "any" or "any" === .color
        const isLeftColorMember = isMemberWithProperty(left, "color");
        const isRightColorMember = isMemberWithProperty(right, "color");
        const leftValue = getLiteralValue(left);
        const rightValue = getLiteralValue(right);

        if (
          (isLeftColorMember && rightValue === "any") ||
          (isRightColorMember && leftValue === "any")
        ) {
          context.report({
            node,
            message:
              'Do not compare `effect.color` to `"any"`. Import and use `MANA_ANY` from `src/types/effectTypes.ts`.',
          });
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-discriminator-comparison (client)
// Prevents switch/comparison on .type with SCREAMING_CASE string literals
// =============================================================================
const noMagicDiscriminatorComparison = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow comparing .type discriminators to string literals",
    },
  },
  create(context) {
    // Only apply to client package
    if (!isInFile(context, "packages/client")) return {};

    return {
      SwitchStatement(node) {
        // SwitchStatement[discriminant.type="MemberExpression"][discriminant.property.name="type"]
        if (!isMemberWithProperty(node.discriminant, "type")) return;

        for (const switchCase of node.cases || []) {
          if (isLiteralMatching(switchCase.test, SCREAMING_CASE)) {
            context.report({
              node: switchCase.test,
              message:
                'Do not use string-literal switch cases for `.type` discriminators. Import the exported constant from `@mage-knight/shared`.',
            });
          }
        }
      },
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") return;

        const { left, right } = node;
        const isLeftTypeMember = isMemberWithProperty(left, "type");
        const isRightTypeMember = isMemberWithProperty(right, "type");

        if (isLeftTypeMember && isLiteralMatching(right, SCREAMING_CASE)) {
          context.report({
            node,
            message:
              'Do not compare `.type` discriminators against string literals. Import the exported constant from `@mage-knight/shared`.',
          });
        }
        if (isRightTypeMember && isLiteralMatching(left, SCREAMING_CASE)) {
          context.report({
            node,
            message:
              'Do not compare `.type` discriminators against string literals. Import the exported constant from `@mage-knight/shared`.',
          });
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-action-comparison (core engine)
// Prevents comparing action.type to string literals in engine files
// =============================================================================
const noMagicActionComparison = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow comparing action.type to string literals in engine",
    },
  },
  create(context) {
    // Only apply to core engine files, excluding tests
    if (!isInFile(context, "packages/core/src/engine")) return {};
    if (!isNotInTests(context)) return {};

    return {
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") return;

        const { left, right } = node;
        const isLeftTypeMember = isMemberWithProperty(left, "type");
        const isRightTypeMember = isMemberWithProperty(right, "type");

        // Check for string literal comparisons
        if (isLeftTypeMember && isLiteralMatching(right, SCREAMING_CASE)) {
          context.report({
            node,
            message:
              'Do not compare `action.type` to a string literal. Import the action constant from `@mage-knight/shared` (e.g. `UNDO_ACTION`, `MOVE_ACTION`).',
          });
        }
        if (isRightTypeMember && isLiteralMatching(left, SCREAMING_CASE)) {
          context.report({
            node,
            message:
              'Do not compare `action.type` to a string literal. Import the action constant from `@mage-knight/shared` (e.g. `UNDO_ACTION`, `MOVE_ACTION`).',
          });
        }

        // Check for _COMMAND constant comparisons
        if (
          isLeftTypeMember &&
          right?.type === "Identifier" &&
          /_COMMAND$/.test(right.name)
        ) {
          context.report({
            node,
            message:
              'Do not compare `action.type` to command-type constants. Use action constants from `@mage-knight/shared` (e.g. `MOVE_ACTION`).',
          });
        }
        if (
          isRightTypeMember &&
          left?.type === "Identifier" &&
          /_COMMAND$/.test(left.name)
        ) {
          context.report({
            node,
            message:
              'Do not compare `action.type` to command-type constants. Use action constants from `@mage-knight/shared` (e.g. `MOVE_ACTION`).',
          });
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-hardcoded-starting-values (server)
// Prevents hardcoded numeric values in createPlayer
// =============================================================================
const noHardcodedStartingValues = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hardcoded starting values in player creation",
    },
  },
  create(context) {
    if (!isInFile(context, "packages/server")) return {};

    const targetProps = [
      "fame",
      "level",
      "reputation",
      "armor",
      "handLimit",
      "commandTokens",
    ];

    return {
      MethodDefinition(node) {
        if (node.key?.name !== "createPlayer") return;

        // Walk the method body to find ObjectExpressions
        const checkNode = (n) => {
          if (!n) return;
          if (n.type === "ObjectExpression") {
            for (const prop of n.properties || []) {
              if (
                prop.type === "Property" &&
                prop.key?.type === "Identifier" &&
                targetProps.includes(prop.key.name) &&
                prop.value?.type === "Literal" &&
                typeof prop.value.value === "number"
              ) {
                context.report({
                  node: prop,
                  message:
                    "Do not hardcode Tier-A numeric starting values in server player creation. Use `STARTING_*` constants from `@mage-knight/shared`.",
                });
              }
            }
          }
          // Recurse
          for (const key in n) {
            if (key === "parent") continue;
            const child = n[key];
            if (child && typeof child === "object") {
              if (Array.isArray(child)) {
                child.forEach(checkNode);
              } else {
                checkNode(child);
              }
            }
          }
        };
        checkNode(node.value?.body);
      },
    };
  },
};

// =============================================================================
// RULE: no-double-cast
// Prevents `as unknown as ...` double casts
// =============================================================================
const noDoubleCast = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow as unknown as double casts",
    },
  },
  create(context) {
    if (!isInFile(context, "packages/core/src")) return {};

    return {
      TSAsExpression(node) {
        // TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]
        if (
          node.expression?.type === "TSAsExpression" &&
          node.expression.typeAnnotation?.type === "TSUnknownKeyword"
        ) {
          context.report({
            node,
            message:
              "Do not use `as unknown as ...` double casts. Fix the underlying types or use a runtime assertion.",
          });
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-checkpoint-reason
// Prevents string-literal checkpoint reasons in commands.ts
// =============================================================================
const noMagicCheckpointReason = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow string-literal checkpoint reasons",
    },
  },
  create(context) {
    if (!isInFile(context, ["commands.ts", "commandStack.ts"])) return {};

    const checkpointReasons = [
      "tile_revealed",
      "enemy_drawn",
      "card_drawn",
      "die_rolled",
      "player_reacted",
    ];

    return {
      ReturnStatement(node) {
        const value = getLiteralValue(node.argument);
        if (checkpointReasons.includes(value)) {
          context.report({
            node,
            message:
              'Do not use string-literal unions for undo checkpoint reasons. Use exported `CHECKPOINT_REASON_*` constants.',
          });
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-test-assertions
// Prevents string-literal event types in test assertions
// =============================================================================
const noMagicTestAssertions = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow string-literal event types in test assertions",
    },
  },
  create(context) {
    if (!isInFile(context, "__tests__")) return {};

    return {
      Property(node) {
        if (node.key?.type === "Identifier" && node.key.name === "type") {
          const value = getLiteralValue(node.value);
          if (value === "INVALID_ACTION") {
            context.report({
              node,
              message:
                'Do not assert event types using string literals. Import the constant from `@mage-knight/shared`.',
            });
          }
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-tile-types
// Prevents string-literal tile/terrain types in tiles.ts
// =============================================================================
const noMagicTileTypes = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow string-literal tile and terrain types",
    },
  },
  create(context) {
    if (!isInFile(context, "tiles.ts")) return {};

    const tileTypes = ["starting", "countryside", "core"];
    const terrainTypes = [
      "plains",
      "hills",
      "forest",
      "wasteland",
      "desert",
      "swamp",
      "lake",
      "mountain",
      "ocean",
    ];

    return {
      Property(node) {
        if (node.key?.type !== "Identifier") return;
        const value = getLiteralValue(node.value);
        if (!value) return;

        if (node.key.name === "type" && tileTypes.includes(value)) {
          context.report({
            node,
            message:
              "Do not use string-literal tile types. Use exported constants (e.g. `TILE_TYPE_STARTING`).",
          });
        }
        if (terrainTypes.includes(value)) {
          context.report({
            node,
            message:
              "Do not use string-literal terrain values. Import `TERRAIN_*` constants from `@mage-knight/shared`.",
          });
        }
      },
      Literal(node) {
        const value = node.value;
        if (typeof value === "string" && terrainTypes.includes(value)) {
          // Avoid double-reporting from Property visitor
          if (node.parent?.type !== "Property" || node.parent.value !== node) {
            context.report({
              node,
              message:
                "Do not use string-literal terrain values. Import `TERRAIN_*` constants from `@mage-knight/shared`.",
            });
          }
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-hardcoded-sentinel-literals
// Prevents specific hardcoded sentinel strings in command files
// =============================================================================
const noHardcodedSentinelLiterals = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hardcoded sentinel literals in commands",
    },
  },
  create(context) {
    if (!isInFile(context, "endRoundCommand.ts")) return {};

    return {
      CallExpression(node) {
        // Check for .startsWith("core_")
        if (
          node.callee?.type === "MemberExpression" &&
          node.callee.property?.name === "startsWith" &&
          node.arguments?.length > 0
        ) {
          const value = getLiteralValue(node.arguments[0]);
          if (value === "core_") {
            context.report({
              node: node.arguments[0],
              message:
                'Do not hardcode `"core_"` tile-id prefix. Use a named constant (e.g. `CORE_TILE_ID_PREFIX`).',
            });
          }
        }
      },
      Property(node) {
        if (node.key?.type === "Identifier" && node.key.name === "playerId") {
          const value = getLiteralValue(node.value);
          if (value === "system") {
            context.report({
              node,
              message:
                'Do not hardcode `"system"` playerId. Use a named constant (e.g. `SYSTEM_PLAYER_ID`).',
            });
          }
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-hardcoded-hand-limit
// Prevents hardcoded numbers in hand limit helpers
// =============================================================================
const noHardcodedHandLimit = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hardcoded hand limit values",
    },
  },
  create(context) {
    if (!isInFile(context, "handLimitHelpers.ts")) return {};

    return {
      Literal(node) {
        if (node.value === 5) {
          context.report({
            node,
            message:
              "Do not hardcode the hand-limit fallback. Use `STARTING_HAND_LIMIT` (or a named constant).",
          });
        }
      },
      BinaryExpression(node) {
        if (
          node.operator === ">=" &&
          node.left?.type === "Identifier" &&
          node.left.name === "currentHandSize" &&
          node.right?.type === "Literal" &&
          node.right.value === 2
        ) {
          context.report({
            node: node.right,
            message:
              "Do not hardcode Planning tactic threshold. Use a named constant.",
          });
        }
      },
      AssignmentExpression(node) {
        if (
          node.operator === "+=" &&
          node.right?.type === "Literal" &&
          node.right.value === 1
        ) {
          context.report({
            node: node.right,
            message:
              "Do not hardcode Planning tactic bonus. Use a named constant.",
          });
        }
      },
    };
  },
};

// =============================================================================
// RULE: no-magic-modifier-discriminators
// Prevents magic string discriminators in modifiers.ts
// =============================================================================
const noMagicModifierDiscriminators = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow magic string discriminators in modifiers",
    },
  },
  create(context) {
    if (!isInFile(context, "modifiers.ts")) return {};

    const modifierFields = ["rule", "condition", "stat", "duration"];

    return {
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") return;

        const { left, right } = node;

        // Check .type comparisons with snake_case
        if (
          isMemberWithProperty(left, "type") &&
          isLiteralMatching(right, SNAKE_CASE)
        ) {
          context.report({
            node,
            message:
              "Do not compare discriminator `.type` against a string literal in `modifiers.ts`. Use exported constants.",
          });
        }
        if (
          isMemberWithProperty(right, "type") &&
          isLiteralMatching(left, SNAKE_CASE)
        ) {
          context.report({
            node,
            message:
              "Do not compare discriminator `.type` against a string literal in `modifiers.ts`. Use exported constants.",
          });
        }

        // Check modifier field comparisons
        for (const field of modifierFields) {
          if (
            isMemberWithProperty(left, field) &&
            isLiteralMatching(right, SNAKE_CASE)
          ) {
            context.report({
              node,
              message:
                "Do not compare modifier fields (rule/condition/stat/duration) against string literals. Use exported constants.",
            });
          }
          if (
            isMemberWithProperty(right, field) &&
            isLiteralMatching(left, SNAKE_CASE)
          ) {
            context.report({
              node,
              message:
                "Do not compare modifier fields (rule/condition/stat/duration) against string literals. Use exported constants.",
            });
          }
        }
      },
      SwitchCase(node) {
        if (isLiteralMatching(node.test, SNAKE_CASE)) {
          context.report({
            node: node.test,
            message:
              "Do not use string-literal switch cases for modifier/trigger discriminator types. Use exported constants.",
          });
        }
      },
    };
  },
};

// =============================================================================
// Export plugin with all rules
// =============================================================================
const plugin = {
  meta: {
    name: "mage-knight",
    version: "1.0.0",
  },
  rules: {
    "no-magic-event-types": noMagicEventTypes,
    "no-magic-command-types": noMagicCommandTypes,
    "no-magic-validation-codes": noMagicValidationCodes,
    "no-magic-mana-any": noMagicManaAny,
    "no-magic-discriminator-comparison": noMagicDiscriminatorComparison,
    "no-magic-action-comparison": noMagicActionComparison,
    "no-hardcoded-starting-values": noHardcodedStartingValues,
    "no-double-cast": noDoubleCast,
    "no-magic-checkpoint-reason": noMagicCheckpointReason,
    "no-magic-test-assertions": noMagicTestAssertions,
    "no-magic-tile-types": noMagicTileTypes,
    "no-hardcoded-sentinel-literals": noHardcodedSentinelLiterals,
    "no-hardcoded-hand-limit": noHardcodedHandLimit,
    "no-magic-modifier-discriminators": noMagicModifierDiscriminators,
  },
};

export default plugin;
