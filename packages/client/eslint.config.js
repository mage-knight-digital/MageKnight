import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import oxlint from "eslint-plugin-oxlint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  oxlint.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // No-magic-strings policy: don't compare/switch on discriminator `.type` using string literals.
      // Import the exported constants from `@mage-knight/shared` instead.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'SwitchStatement[discriminant.type="MemberExpression"][discriminant.property.name="type"] SwitchCase[test.type="Literal"][test.value=/^[A-Z][A-Z0-9_]*$/]',
          message:
            'Do not use string-literal switch cases for `.type` discriminators. Import the exported constant from `@mage-knight/shared`.',
        },
        {
          selector:
            'BinaryExpression[operator=/^(===|!==)$/][left.type="MemberExpression"][left.property.name="type"][right.type="Literal"][right.value=/^[A-Z][A-Z0-9_]*$/]',
          message:
            'Do not compare `.type` discriminators against string literals. Import the exported constant from `@mage-knight/shared`.',
        },
        {
          selector:
            'BinaryExpression[operator=/^(===|!==)$/][right.type="MemberExpression"][right.property.name="type"][left.type="Literal"][left.value=/^[A-Z][A-Z0-9_]*$/]',
          message:
            'Do not compare `.type` discriminators against string literals. Import the exported constant from `@mage-knight/shared`.',
        },
      ],
      // React rules
      "react/jsx-uses-react": "off", // Not needed with React 17+ JSX transform
      "react/react-in-jsx-scope": "off", // Not needed with React 17+ JSX transform
      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    ignores: ["dist/**", "*.config.*", "public/**", "e2e/**"],
  }
);
